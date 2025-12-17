import { Program, AnchorProvider, Wallet, web3 } from "@coral-xyz/anchor";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import * as fs from "fs";

const {
  Connection,
  PublicKey,
  Keypair,
  ComputeBudgetProgram,
  SYSVAR_RENT_PUBKEY,
  SystemProgram,
} = web3;

// 配置 - 更新为新的程序 ID
const PROGRAM_ID = new PublicKey(
  "JCo8dShYwHu74UpBTmwUcoEcGgWZQWnoTCvFaqjGJ6fc"
);
const RPC_URL = "https://api.devnet.solana.com";

// 铸造目标地址
const MINT_TO_ADDRESS = new PublicKey(
  "H2sykMLjWjBCtALDYCwnqxALEWtDbBwfCXtz7YThoEne"
);

// 使用指定的 rnsId
const rnsId = "082d9a09-aa3c-49dc-ae66-e8800261a2ab";
const tokenIndex = `idx-${Date.now()}`;
const merkleRoot = "2d852b3c21e923484a93d3a980a45b7571e89552d58875d40dd17c73216a49d7";

// PDA 计算函数 (v3 版本)
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
  console.log("RNS DID Devnet 铸造脚本 (Token-2022 v3)");
  console.log("========================================\n");

  // 加载钱包
  const walletPath = process.env.HOME + "/.config/solana/id.json";
  const secretKey = JSON.parse(fs.readFileSync(walletPath, "utf-8"));
  const adminWallet = Keypair.fromSecretKey(new Uint8Array(secretKey));

  console.log("Admin 钱包:", adminWallet.publicKey.toBase58());
  console.log("铸造目标:", MINT_TO_ADDRESS.toBase58());
  console.log("RNS ID:", rnsId);
  console.log("Token Index:", tokenIndex);
  console.log("");

  // 连接
  const connection = new Connection(RPC_URL, "confirmed");
  const wallet = new Wallet(adminWallet);
  const provider = new AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });

  // 加载 IDL
  const idlPath = "./target/idl/rnsdid_core.json";
  const idl = JSON.parse(fs.readFileSync(idlPath, "utf-8"));
  const program = new Program(idl, provider);

  // 计算所有 PDA
  const nonTransferableProject = findNonTransferableProject();
  const nonTransferableNftMint = getNftMintAddress(tokenIndex);
  const userTokenAccount = getAssociatedTokenAddressSync(
    nonTransferableNftMint,
    MINT_TO_ADDRESS,
    false,
    TOKEN_2022_PROGRAM_ID
  );

  console.log("PDA 地址:");
  console.log("  Project:", nonTransferableProject.toBase58());
  console.log("  NFT Mint:", nonTransferableNftMint.toBase58());
  console.log("  User Token Account:", userTokenAccount.toBase58());
  console.log("");

  // 检查项目是否已初始化
  const projectInfo = await connection.getAccountInfo(nonTransferableProject);
  if (!projectInfo) {
    console.log("❌ 项目未初始化！需要先运行 init-devnet.ts");
    return;
  }
  console.log("✅ 项目已初始化\n");

  // 执行 airdrop
  console.log("正在铸造 DID NFT (Token-2022 + merkle_root in metadata)...");

  try {
    const setComputeUnitLimitIx = ComputeBudgetProgram.setComputeUnitLimit({
      units: 400_000,
    });

    const tx = await program.methods
      .airdrop(rnsId, MINT_TO_ADDRESS, merkleRoot, tokenIndex)
      .accounts({
        authority: adminWallet.publicKey,
        nonTransferableProject: nonTransferableProject,
        nonTransferableNftMint: nonTransferableNftMint,
        userAccount: MINT_TO_ADDRESS,
        userTokenAccount: userTokenAccount,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .preInstructions([setComputeUnitLimitIx])
      .signers([adminWallet])
      .rpc();

    console.log("\n✅ 铸造成功！");
    console.log("交易签名:", tx);
    console.log(
      `\n查看交易: https://explorer.solana.com/tx/${tx}?cluster=devnet`
    );
    console.log(
      `查看 NFT Mint: https://explorer.solana.com/address/${nonTransferableNftMint.toBase58()}?cluster=devnet`
    );
    console.log(
      `查看用户 Token Account: https://explorer.solana.com/address/${userTokenAccount.toBase58()}?cluster=devnet`
    );
  } catch (error) {
    console.error("\n❌ 铸造失败:", error);
    throw error;
  }
}

main().catch(console.error);
