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

const PROGRAM_ID = new PublicKey("JCo8dShYwHu74UpBTmwUcoEcGgWZQWnoTCvFaqjGJ6fc");
const RPC_URL = "https://api.devnet.solana.com";

// 新的铸造目标地址
const MINT_TO_ADDRESS = new PublicKey("EuWtasWBcuESn5Mt1R5a4AVja2xsHtFMLs8YWiMfJX8A");

// 新的 DID 参数
const rnsId = "did-for-euwtas-003";
const tokenIndex = "idx-euwtas-" + Date.now();
const merkleRoot = "082d9a09-aa3c-49dc-ae66-e8800261a2ab";

function findNonTransferableProject(): web3.PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("nt-proj-v5")],
    PROGRAM_ID
  );
  return pda;
}

function findCollectionMint(): web3.PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("nt-project-mint-v5")],
    PROGRAM_ID
  );
  return pda;
}

function getNftMintAddress(index: string): web3.PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("nt-nft-mint-v5"), Buffer.from(index)],
    PROGRAM_ID
  );
  return pda;
}

async function main() {
  console.log("========================================");
  console.log("铸造 DID 给 EuWtasWBcuESn5Mt1R5a4AVja2xsHtFMLs8YWiMfJX8A");
  console.log("========================================\n");

  const walletPath = process.env.HOME + "/.config/solana/id.json";
  const secretKey = JSON.parse(fs.readFileSync(walletPath, "utf-8"));
  const adminWallet = Keypair.fromSecretKey(new Uint8Array(secretKey));

  console.log("Admin:", adminWallet.publicKey.toBase58());
  console.log("目标地址:", MINT_TO_ADDRESS.toBase58());
  console.log("RNS ID:", rnsId);
  console.log("Token Index:", tokenIndex);
  console.log("");

  const connection = new Connection(RPC_URL, "confirmed");
  const wallet = new Wallet(adminWallet);
  const provider = new AnchorProvider(connection, wallet, { commitment: "confirmed" });

  const idlPath = "./target/idl/rnsdid_core.json";
  const idl = JSON.parse(fs.readFileSync(idlPath, "utf-8"));
  const program = new Program(idl, provider);

  const nonTransferableProject = findNonTransferableProject();
  const collectionMint = findCollectionMint();
  const nonTransferableNftMint = getNftMintAddress(tokenIndex);
  const userTokenAccount = getAssociatedTokenAddressSync(
    nonTransferableNftMint,
    MINT_TO_ADDRESS,
    false,
    TOKEN_2022_PROGRAM_ID
  );

  console.log("NFT Mint:", nonTransferableNftMint.toBase58());
  console.log("User ATA:", userTokenAccount.toBase58());
  console.log("");

  console.log("正在铸造...");

  const setComputeUnitLimitIx = ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 });

  const tx = await program.methods
    .airdrop(rnsId, MINT_TO_ADDRESS, merkleRoot, tokenIndex)
    .accounts({
      authority: adminWallet.publicKey,
      nonTransferableProject: nonTransferableProject,
      nonTransferableNftMint: nonTransferableNftMint,
      userAccount: MINT_TO_ADDRESS,
      userTokenAccount: userTokenAccount,
      collectionMint: collectionMint,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
      rent: SYSVAR_RENT_PUBKEY,
    })
    .preInstructions([setComputeUnitLimitIx])
    .signers([adminWallet])
    .rpc();

  console.log("\n✅ 铸造成功！");
  console.log("交易:", tx);
  console.log("NFT Mint:", nonTransferableNftMint.toBase58());
  console.log("\n查看: https://explorer.solana.com/tx/" + tx + "?cluster=devnet");
}

main().catch(console.error);
