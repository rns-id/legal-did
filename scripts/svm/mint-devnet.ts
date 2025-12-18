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

// Config - updated to new program ID
const PROGRAM_ID = new PublicKey(
  "JCo8dShYwHu74UpBTmwUcoEcGgWZQWnoTCvFaqjGJ6fc"
);
const RPC_URL = "https://api.devnet.solana.com";

// Mint target address
const MINT_TO_ADDRESS = new PublicKey(
  "H2sykMLjWjBCtALDYCwnqxALEWtDbBwfCXtz7YThoEne"
);

// Test re-mint after revoke
const rnsId = "test-revoke-remint";
const tokenIndex = "idx-revoke-test-001";
const merkleRoot = "2d852b3c21e923484a93d3a980a45b7571e89552d58875d40dd17c73216a49d7";

// PDA calculation functions (v5 version - with Collection + Metadata)
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
  console.log("RNS DID Devnet Mint Script (Token-2022 v4 + Collection)");
  console.log("========================================\n");

  // Load wallet
  const walletPath = process.env.HOME + "/.config/solana/id.json";
  const secretKey = JSON.parse(fs.readFileSync(walletPath, "utf-8"));
  const adminWallet = Keypair.fromSecretKey(new Uint8Array(secretKey));

  console.log("Admin Wallet:", adminWallet.publicKey.toBase58());
  console.log("Mint Target:", MINT_TO_ADDRESS.toBase58());
  console.log("RNS ID:", rnsId);
  console.log("Token Index:", tokenIndex);
  console.log("");

  // Connect
  const connection = new Connection(RPC_URL, "confirmed");
  const wallet = new Wallet(adminWallet);
  const provider = new AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });

  // Load IDL
  const idlPath = "./target/idl/rnsdid_core.json";
  const idl = JSON.parse(fs.readFileSync(idlPath, "utf-8"));
  const program = new Program(idl, provider);

  // Calculate all PDAs
  const nonTransferableProject = findNonTransferableProject();
  const collectionMint = findCollectionMint();
  const nonTransferableNftMint = getNftMintAddress(tokenIndex);
  const userTokenAccount = getAssociatedTokenAddressSync(
    nonTransferableNftMint,
    MINT_TO_ADDRESS,
    false,
    TOKEN_2022_PROGRAM_ID
  );

  console.log("PDA Addresses:");
  console.log("  Project:", nonTransferableProject.toBase58());
  console.log("  Collection Mint:", collectionMint.toBase58());
  console.log("  NFT Mint:", nonTransferableNftMint.toBase58());
  console.log("  User Token Account:", userTokenAccount.toBase58());
  console.log("");

  // Check if project is initialized
  const projectInfo = await connection.getAccountInfo(nonTransferableProject);
  if (!projectInfo) {
    console.log("❌ Project not initialized! Run init-devnet.ts first");
    return;
  }
  console.log("✅ Project initialized\n");

  // Execute airdrop
  console.log("Minting DID NFT (Token-2022 + merkle_root in metadata)...");

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
    console.log("Transaction signature:", tx);
    console.log(
      `\nView transaction: https://explorer.solana.com/tx/${tx}?cluster=devnet`
    );
    console.log(
      `View NFT Mint: https://explorer.solana.com/address/${nonTransferableNftMint.toBase58()}?cluster=devnet`
    );
    console.log(
      `View User Token Account: https://explorer.solana.com/address/${userTokenAccount.toBase58()}?cluster=devnet`
    );
  } catch (error) {
    console.error("\n❌ Mint failed:", error);
    throw error;
  }
}

main().catch(console.error);
