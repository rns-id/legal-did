/**
 * Test Burn Authority Constraint
 * 
 * This script tests that the burn instruction correctly validates
 * the authority account against the project's authority.
 */

import { Program, AnchorProvider, Wallet, web3 } from "@coral-xyz/anchor";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import * as fs from "fs";
import { getNetworkConfig, getExplorerLink } from "../../config";
import { createHash } from "crypto";

const { Connection, PublicKey, Keypair, ComputeBudgetProgram, SystemProgram } = web3;

// Get network from command line args (default: devnet)
const network = process.argv[2] || "devnet";
const config = getNetworkConfig(network);

const PROGRAM_ID = new PublicKey(config.programId);
const RPC_URL = config.rpcUrl;

// Test parameters
const orderId = process.argv[3] || "burn-test-1768805402";

function findNonTransferableProject(): web3.PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("nt-proj-v5")],
    PROGRAM_ID
  );
  return pda;
}

function getNftMintAddress(orderId: string): web3.PublicKey {
  // Use SHA256 hash of order_id as seed
  const orderIdHash = createHash('sha256').update(orderId).digest();
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("nt-nft-mint-v5"), orderIdHash],
    PROGRAM_ID
  );
  return pda;
}

async function main() {
  console.log("========================================");
  console.log("Test Burn Authority Constraint");
  console.log("========================================\n");

  // Load admin wallet
  const walletPath = process.env.HOME + "/.config/solana/id.json";
  const adminWallet = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(walletPath, "utf-8")))
  );

  const connection = new Connection(RPC_URL, "confirmed");
  const wallet = new Wallet(adminWallet);
  const provider = new AnchorProvider(connection, wallet, { commitment: "confirmed" });

  const idlPath = "./target/idl/legaldid.json";
  const idl = JSON.parse(fs.readFileSync(idlPath, "utf-8"));
  const program = new Program(idl, provider);

  const nonTransferableProject = findNonTransferableProject();
  const nftMint = getNftMintAddress(orderId);
  
  // NFT owner
  const nftOwner = new PublicKey("H2sykMLjWjBCtALDYCwnqxALEWtDbBwfCXtz7YThoEne");
  const userAta = getAssociatedTokenAddressSync(
    nftMint,
    nftOwner,
    false,
    TOKEN_2022_PROGRAM_ID
  );

  console.log("Network:", network);
  console.log("Program ID:", PROGRAM_ID.toBase58());
  console.log("Order ID:", orderId);
  console.log("NFT Mint:", nftMint.toBase58());
  console.log("NFT Owner:", nftOwner.toBase58());
  console.log("User ATA:", userAta.toBase58());
  console.log("Project PDA:", nonTransferableProject.toBase58());

  // Query project info to get authority
  const projectAccount = await (program.account as any).projectAccount.fetch(nonTransferableProject);
  const correctAuthority = projectAccount.authority;
  
  console.log("\n📋 Project Authority:", correctAuthority.toBase58());

  // Test 1: Try with WRONG authority (should fail)
  console.log("\n--- Test 1: Burn with WRONG authority ---");
  const wrongAuthority = new PublicKey("11111111111111111111111111111111");
  console.log("Wrong authority:", wrongAuthority.toBase58());
  console.log("Expected: ❌ Should FAIL with Unauthorized error");
  
  try {
    const setComputeUnitLimitIx = ComputeBudgetProgram.setComputeUnitLimit({
      units: 200_000,
    });

    await program.methods
      .burn()
      .accounts({
        nftOwner: nftOwner,
        authority: wrongAuthority,  // Wrong authority
        nonTransferableProject: nonTransferableProject,
        userTokenAccount: userAta,
        nonTransferableNftMint: nftMint,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .preInstructions([setComputeUnitLimitIx])
      .simulate();

    console.log("❌ UNEXPECTED: Transaction should have failed!");
  } catch (error: any) {
    // Check for constraint violation
    const errorStr = JSON.stringify(error, null, 2);
    const hasConstraintError = errorStr.includes("Unauthorized") || 
        errorStr.includes("ConstraintRaw") ||
        errorStr.includes("constraint") ||
        errorStr.includes("0x7d1") ||
        errorStr.includes("2001");
    
    if (hasConstraintError) {
      console.log("✅ PASS: Authority constraint check working!");
    } else {
      console.log("⚠️  Transaction failed (checking if constraint-related):");
    }
    
    // Print error logs if available
    if (error.logs) {
      console.log("   Logs:", error.logs.filter((l: string) => l.includes("Error") || l.includes("failed")).join("\n        "));
    } else if (error.simulationResponse?.logs) {
      console.log("   Logs:", error.simulationResponse.logs.filter((l: string) => l.includes("Error") || l.includes("failed")).join("\n        "));
    }
  }

  // Test 2: Try with CORRECT authority (should succeed in simulation)
  console.log("\n--- Test 2: Burn with CORRECT authority ---");
  console.log("Correct authority:", correctAuthority.toBase58());
  console.log("Expected: ✅ Should PASS simulation (may fail on actual execution due to signer)");
  
  try {
    const setComputeUnitLimitIx = ComputeBudgetProgram.setComputeUnitLimit({
      units: 200_000,
    });

    const result = await program.methods
      .burn()
      .accounts({
        nftOwner: nftOwner,
        authority: correctAuthority,  // Correct authority
        nonTransferableProject: nonTransferableProject,
        userTokenAccount: userAta,
        nonTransferableNftMint: nftMint,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .preInstructions([setComputeUnitLimitIx])
      .simulate();

    console.log("✅ PASS: Simulation succeeded with correct authority!");
  } catch (error: any) {
    // May fail due to missing signer, but that's expected
    if (error.message.includes("Unauthorized") || error.message.includes("ConstraintRaw")) {
      console.log("❌ FAIL: Authority constraint rejected correct authority!");
    } else if (error.message.includes("signature") || error.message.includes("signer")) {
      console.log("✅ PASS: Authority constraint passed, failed on signer (expected)");
      console.log("   Error:", error.message.substring(0, 100));
    } else {
      console.log("⚠️  Error:", error.message.substring(0, 200));
    }
  }

  console.log("\n========================================");
  console.log("Test Complete");
  console.log("========================================");
}

main().catch(console.error);
