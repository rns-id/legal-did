/**
 * 管理员 Revoke 脚本
 * 
 * 功能：管理员强制撤销用户的 DID NFT
 * 租金回收：
 *   - Mint 租金 (~0.0049 SOL) → 管理员
 *   - ATA 租金 (~0.0021 SOL) → 用户自己关闭回收
 */

import { Program, AnchorProvider, Wallet, web3 } from "@coral-xyz/anchor";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import * as fs from "fs";

const { Connection, PublicKey, Keypair, ComputeBudgetProgram, SystemProgram } = web3;

const PROGRAM_ID = new PublicKey("JCo8dShYwHu74UpBTmwUcoEcGgWZQWnoTCvFaqjGJ6fc");
const RPC_URL = "https://api.devnet.solana.com";

// ========== 配置要 Revoke 的 NFT ==========
const NFT_OWNER = new PublicKey("H2sykMLjWjBCtALDYCwnqxALEWtDbBwfCXtz7YThoEne");
const rnsId = "test-revoke-remint";
const tokenIndex = "idx-revoke-test-001";
// ==========================================

function findNonTransferableProject(): web3.PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("nt-proj-v4")],
    PROGRAM_ID
  );
  return pda;
}

function getNftMintAddress(index: string): web3.PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("nt-nft-mint-v4"), Buffer.from(index)],
    PROGRAM_ID
  );
  return pda;
}

async function main() {
  console.log("========================================");
  console.log("管理员 Revoke DID NFT");
  console.log("========================================\n");

  // 加载管理员钱包
  const walletPath = process.env.HOME + "/.config/solana/id.json";
  const secretKey = JSON.parse(fs.readFileSync(walletPath, "utf-8"));
  const adminWallet = Keypair.fromSecretKey(new Uint8Array(secretKey));

  const connection = new Connection(RPC_URL, "confirmed");
  const wallet = new Wallet(adminWallet);
  const provider = new AnchorProvider(connection, wallet, { commitment: "confirmed" });

  const idlPath = "./target/idl/rnsdid_core.json";
  const idl = JSON.parse(fs.readFileSync(idlPath, "utf-8"));
  const program = new Program(idl, provider);

  const nonTransferableProject = findNonTransferableProject();
  const nonTransferableNftMint = getNftMintAddress(tokenIndex);
  const userTokenAccount = getAssociatedTokenAddressSync(
    nonTransferableNftMint,
    NFT_OWNER,
    false,
    TOKEN_2022_PROGRAM_ID
  );

  console.log("管理员:", adminWallet.publicKey.toBase58());
  console.log("NFT Owner:", NFT_OWNER.toBase58());
  console.log("RNS ID:", rnsId);
  console.log("NFT Mint:", nonTransferableNftMint.toBase58());
  console.log("User ATA:", userTokenAccount.toBase58());

  // 检查 ATA 是否存在且有余额
  const ataInfo = await connection.getAccountInfo(userTokenAccount);
  if (!ataInfo) {
    console.log("\n❌ ATA 不存在，NFT 可能已被销毁");
    return;
  }

  const adminBalanceBefore = await connection.getBalance(adminWallet.publicKey);

  console.log("\n执行 Revoke...");

  try {
    const setComputeUnitLimitIx = ComputeBudgetProgram.setComputeUnitLimit({
      units: 200_000,
    });

    const tx = await program.methods
      .revoke(rnsId, NFT_OWNER, tokenIndex)
      .accounts({
        authority: adminWallet.publicKey,
        nonTransferableProject: nonTransferableProject,
        userAccount: NFT_OWNER,
        userTokenAccount: userTokenAccount,
        nonTransferableNftMint: nonTransferableNftMint,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .preInstructions([setComputeUnitLimitIx])
      .signers([adminWallet])
      .rpc();

    const adminBalanceAfter = await connection.getBalance(adminWallet.publicKey);
    const recovered = (adminBalanceAfter - adminBalanceBefore) / 1e9;

    console.log("\n✅ Revoke 成功！");
    console.log("交易签名:", tx);
    console.log(`\n💰 管理员回收 (Mint 租金): ${recovered.toFixed(8)} SOL`);
    console.log("📝 用户 ATA 仍存在，用户可自行关闭回收 ~0.0021 SOL");
    console.log(`\n查看交易: https://explorer.solana.com/tx/${tx}?cluster=devnet`);
  } catch (error: any) {
    console.error("\n❌ Revoke 失败:", error.message);
  }
}

main().catch(console.error);
