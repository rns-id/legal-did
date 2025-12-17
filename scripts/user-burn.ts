/**
 * 用户 Burn 脚本
 * 
 * 功能：用户主动销毁自己的 DID NFT
 * 租金回收：
 *   - ATA 租金 (~0.0021 SOL) → 用户
 *   - Mint 租金 (~0.0049 SOL) → 管理员
 */

import { Program, AnchorProvider, Wallet, web3 } from "@coral-xyz/anchor";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import * as fs from "fs";
import bs58 from "bs58";

const { Connection, PublicKey, Keypair, ComputeBudgetProgram, SystemProgram } = web3;

const PROGRAM_ID = new PublicKey("JCo8dShYwHu74UpBTmwUcoEcGgWZQWnoTCvFaqjGJ6fc");
const RPC_URL = "https://api.devnet.solana.com";

// ========== 配置 ==========
// 用户私钥 (base58 格式)
const USER_PRIVATE_KEY = "ry95ekWNAHr31ERcMWvkrZruzswgDGoZW41bEPRmmz4HHFBtPuVpLTNqVao697L6Q7HuLDybBxe49u5gRRmcdYE";

// 要 Burn 的 NFT 信息
const rnsId = "082d9a09-aa3c-49dc-ae66-e8800261a2ab";
const tokenIndex = "idx-1765966593824";

// 管理员地址 (接收 Mint 租金)
const ADMIN_ADDRESS = new PublicKey("2fuikT5C2YVctakxoBNQ23NjXzA4kY2cn36Sh6ws3pAt");
// ==========================

function findNonTransferableProject(): web3.PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("nt-proj-v3")],
    PROGRAM_ID
  );
  return pda;
}

function getNftMintAddress(index: string): web3.PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("nt-nft-mint-v3"), Buffer.from(index)],
    PROGRAM_ID
  );
  return pda;
}

async function main() {
  console.log("========================================");
  console.log("用户 Burn DID NFT");
  console.log("========================================\n");

  // 加载用户钱包
  const userWallet = Keypair.fromSecretKey(bs58.decode(USER_PRIVATE_KEY));

  const connection = new Connection(RPC_URL, "confirmed");
  const wallet = new Wallet(userWallet);
  const provider = new AnchorProvider(connection, wallet, { commitment: "confirmed" });

  const idlPath = "./target/idl/rnsdid_core.json";
  const idl = JSON.parse(fs.readFileSync(idlPath, "utf-8"));
  const program = new Program(idl, provider);

  const nonTransferableProject = findNonTransferableProject();
  const nonTransferableNftMint = getNftMintAddress(tokenIndex);
  const userTokenAccount = getAssociatedTokenAddressSync(
    nonTransferableNftMint,
    userWallet.publicKey,
    false,
    TOKEN_2022_PROGRAM_ID
  );

  console.log("用户:", userWallet.publicKey.toBase58());
  console.log("管理员:", ADMIN_ADDRESS.toBase58());
  console.log("RNS ID:", rnsId);
  console.log("NFT Mint:", nonTransferableNftMint.toBase58());
  console.log("User ATA:", userTokenAccount.toBase58());

  // 检查 ATA 是否存在且有余额
  const ataInfo = await connection.getAccountInfo(userTokenAccount);
  if (!ataInfo) {
    console.log("\n❌ ATA 不存在，NFT 可能已被销毁");
    return;
  }

  const userBalanceBefore = await connection.getBalance(userWallet.publicKey);
  const adminBalanceBefore = await connection.getBalance(ADMIN_ADDRESS);

  console.log("\n执行 Burn...");

  try {
    const setComputeUnitLimitIx = ComputeBudgetProgram.setComputeUnitLimit({
      units: 200_000,
    });

    const tx = await program.methods
      .burn(rnsId, tokenIndex)
      .accounts({
        nftOwner: userWallet.publicKey,
        authority: ADMIN_ADDRESS,
        nonTransferableProject: nonTransferableProject,
        userTokenAccount: userTokenAccount,
        nonTransferableNftMint: nonTransferableNftMint,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .preInstructions([setComputeUnitLimitIx])
      .signers([userWallet])
      .rpc();

    const userBalanceAfter = await connection.getBalance(userWallet.publicKey);
    const adminBalanceAfter = await connection.getBalance(ADMIN_ADDRESS);
    
    const userRecovered = (userBalanceAfter - userBalanceBefore) / 1e9;
    const adminRecovered = (adminBalanceAfter - adminBalanceBefore) / 1e9;

    console.log("\n✅ Burn 成功！");
    console.log("交易签名:", tx);
    console.log(`\n💰 用户回收 (ATA 租金 - 交易费): ${userRecovered.toFixed(8)} SOL`);
    console.log(`💰 管理员回收 (Mint 租金): ${adminRecovered.toFixed(8)} SOL`);
    console.log(`\n查看交易: https://explorer.solana.com/tx/${tx}?cluster=devnet`);
  } catch (error: any) {
    console.error("\n❌ Burn 失败:", error.message);
  }
}

main().catch(console.error);
