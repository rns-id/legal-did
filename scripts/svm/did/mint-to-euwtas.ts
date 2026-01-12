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

const PROGRAM_ID = new PublicKey("Ce84NtGdKYpxkFpvWn7a5qqBXzkBfEhXM7gg49NtGuhM");
const RPC_URL = "https://api.devnet.solana.com";

// New mint target address
const MINT_TO_ADDRESS = new PublicKey("EuWtasWBcuESn5Mt1R5a4AVja2xsHtFMLs8YWiMfJX8A");

// New DID parameters
const rnsId = "did-for-euwtas-" + Date.now();
const tokenIndex = "idx-euwtas-" + Date.now();
const merkleRoot = "0x764e6372e05f4db05595276214e74f047a6562f19bf6cc3bb35a53ac892c3ce3";

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
  console.log("Mint DID to EuWtasWBcuESn5Mt1R5a4AVja2xsHtFMLs8YWiMfJX8A");
  console.log("========================================\n");

  const walletPath = process.env.HOME + "/.config/solana/id.json";
  const secretKey = JSON.parse(fs.readFileSync(walletPath, "utf-8"));
  const adminWallet = Keypair.fromSecretKey(new Uint8Array(secretKey));

  console.log("Admin:", adminWallet.publicKey.toBase58());
  console.log("Target Address:", MINT_TO_ADDRESS.toBase58());
  console.log("RNS ID:", rnsId);
  console.log("Token Index:", tokenIndex);
  console.log("");

  const connection = new Connection(RPC_URL, "confirmed");
  const wallet = new Wallet(adminWallet);
  const provider = new AnchorProvider(connection, wallet, { commitment: "confirmed" });

  const idlPath = "./target/idl/legaldid.json";
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

  console.log("Minting...");

  const setComputeUnitLimitIx = ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 });

  const tx = await program.methods
    .airdrop(rnsId, MINT_TO_ADDRESS, merkleRoot)
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

  console.log("\n✅ Mint successful!");
  console.log("Transaction:", tx);
  console.log("NFT Mint:", nonTransferableNftMint.toBase58());
  console.log("\nView: https://explorer.solana.com/tx/" + tx + "?cluster=devnet");
}

main().catch(console.error);
