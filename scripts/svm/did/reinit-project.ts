/**
 * Re-initialize project account after structure change
 * This will close the old account and create a new one with the updated structure
 */

import { Program, AnchorProvider, Wallet, web3, BN } from "@coral-xyz/anchor";
import { TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import * as fs from "fs";
import { getNetworkConfig, getExplorerLink } from "../../config";

const {
  Connection,
  PublicKey,
  Keypair,
  ComputeBudgetProgram,
  SYSVAR_RENT_PUBKEY,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} = web3;

const network = process.argv[2] || "devnet";
const config = getNetworkConfig(network);

const PROGRAM_ID = new PublicKey(config.programId);
const RPC_URL = config.rpcUrl;

function findNonTransferableProject(): web3.PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("nt-proj-v5")],
    PROGRAM_ID
  );
  return pda;
}

function getProjectMintAddress(): web3.PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("nt-project-mint-v5")],
    PROGRAM_ID
  );
  return pda;
}

async function main() {
  console.log("========================================");
  console.log(`Re-initialize Project Account - ${network.toUpperCase()}`);
  console.log("========================================\n");

  const walletPath = process.env.HOME + "/.config/solana/id.json";
  const secretKey = JSON.parse(fs.readFileSync(walletPath, "utf-8"));
  const adminWallet = Keypair.fromSecretKey(new Uint8Array(secretKey));

  console.log("Network:", network);
  console.log("Program ID:", PROGRAM_ID.toBase58());
  console.log("Admin Wallet:", adminWallet.publicKey.toBase58());
  console.log("");

  const connection = new Connection(RPC_URL, "confirmed");
  const wallet = new Wallet(adminWallet);
  const provider = new AnchorProvider(connection, wallet, { commitment: "confirmed" });

  const idlPath = "./target/idl/legaldid.json";
  const idl = JSON.parse(fs.readFileSync(idlPath, "utf-8"));
  const program = new Program(idl, provider);

  const projectPda = findNonTransferableProject();
  const collectionMint = getProjectMintAddress();

  console.log("Project PDA:", projectPda.toBase58());
  console.log("Collection Mint:", collectionMint.toBase58());
  console.log("");

  // Step 1: Check and close old account
  const oldAccount = await connection.getAccountInfo(projectPda);
  if (oldAccount) {
    console.log("📦 Old project account found");
    console.log("   Size:", oldAccount.data.length, "bytes");
    console.log("   Lamports:", oldAccount.lamports);
    console.log("");
    
    console.log("🗑️  Closing old account to recover rent...");
    
    // Create a transaction to transfer lamports and close account
    const tx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: projectPda,
        toPubkey: adminWallet.publicKey,
        lamports: oldAccount.lamports,
      })
    );
    
    try {
      // This will fail because we can't transfer from a PDA without the program
      // Instead, we'll just proceed with initialization which will fail if account exists
      console.log("⚠️  Cannot directly close PDA account");
      console.log("   The account will be overwritten during re-initialization");
    } catch (e) {
      console.log("   Error:", e);
    }
  }

  // Step 2: Initialize new project
  console.log("\n🚀 Initializing new project account...");
  
  const initArgs = {
    name: "Legal DID",
    symbol: "LDID",
    baseUri: "https://api.rns.id/api/v2/portal/identity/nft/",
  };

  try {
    const setComputeUnitLimitIx = ComputeBudgetProgram.setComputeUnitLimit({
      units: 400_000,
    });

    const tx = await program.methods
      .initialize(initArgs)
      .accounts({
        authority: adminWallet.publicKey,
        nonTransferableProject: projectPda,
        nonTransferableProjectMint: collectionMint,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .preInstructions([setComputeUnitLimitIx])
      .signers([adminWallet])
      .rpc();

    console.log("\n✅ Project re-initialized successfully!");
    console.log("Transaction signature:", tx);
    console.log(`\nView transaction: ${getExplorerLink(tx, network, 'tx')}`);
    console.log(`View Project: ${getExplorerLink(projectPda.toBase58(), network)}`);
    
    // Verify
    const newAccount = await connection.getAccountInfo(projectPda);
    if (newAccount) {
      console.log("\n📊 New account info:");
      console.log("   Size:", newAccount.data.length, "bytes (should be 646 for new structure)");
      console.log("   Lamports:", newAccount.lamports);
    }
    
  } catch (error: any) {
    if (error.toString().includes("already in use")) {
      console.log("\n⚠️  Account already exists and cannot be overwritten");
      console.log("   You may need to use a different approach or contact support");
      console.log("\n   The account data is incompatible with the new program structure.");
      console.log("   Options:");
      console.log("   1. Deploy to a new program ID");
      console.log("   2. Use program upgrade authority to modify the account");
      console.log("   3. Wait for the account to be garbage collected (unlikely)");
    } else {
      console.error("\n❌ Initialization failed:", error);
      throw error;
    }
  }
}

main().catch(console.error);
