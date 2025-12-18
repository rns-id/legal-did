/**
 * Admin Revoke Script
 * 
 * Function: Admin forcefully revokes user's DID NFT
 * Rent recovery:
 *   - Mint rent (~0.0049 SOL) → Admin
 *   - ATA rent (~0.0021 SOL) → User closes to recover
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

// ========== CONFIG: NFT to Revoke ==========
const NFT_OWNER = new PublicKey("H2sykMLjWjBCtALDYCwnqxALEWtDbBwfCXtz7YThoEne");
const rnsId = "test-revoke-remint";
const tokenIndex = "idx-revoke-test-001";
// ============================================

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
  console.log("Admin Revoke DID NFT");
  console.log("========================================\n");

  // Load admin wallet
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

  console.log("Admin:", adminWallet.publicKey.toBase58());
  console.log("NFT Owner:", NFT_OWNER.toBase58());
  console.log("RNS ID:", rnsId);
  console.log("NFT Mint:", nonTransferableNftMint.toBase58());
  console.log("User ATA:", userTokenAccount.toBase58());

  // Check if ATA exists and has balance
  const ataInfo = await connection.getAccountInfo(userTokenAccount);
  if (!ataInfo) {
    console.log("\n❌ ATA does not exist, NFT may have been burned");
    return;
  }

  const adminBalanceBefore = await connection.getBalance(adminWallet.publicKey);

  console.log("\nExecuting Revoke...");

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

    console.log("\n✅ Revoke successful!");
    console.log("Transaction signature:", tx);
    console.log(`\n💰 Admin recovered (Mint rent): ${recovered.toFixed(8)} SOL`);
    console.log("📝 User ATA still exists, user can close it to recover ~0.0021 SOL");
    console.log(`\nView transaction: https://explorer.solana.com/tx/${tx}?cluster=devnet`);
  } catch (error: any) {
    console.error("\n❌ Revoke failed:", error.message);
  }
}

main().catch(console.error);
