/**
 * Close Token Account Script
 * 
 * Function: Close an empty ATA to recover rent
 * 
 * Usage:
 *   ts-node close-ata.ts [network]
 *   network: devnet (default) | mainnet | localnet
 */

import { web3 } from "@coral-xyz/anchor";
import { createCloseAccountInstruction, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import bs58 from "bs58";
import * as dotenv from "dotenv";
import { getNetworkConfig, getExplorerLink } from "../../config";

// Load environment variables
dotenv.config();

const { Connection, PublicKey, Keypair, Transaction, sendAndConfirmTransaction } = web3;

// Get network from command line args (default: devnet)
const network = process.argv[2] || "devnet";
const config = getNetworkConfig(network);

const RPC_URL = config.rpcUrl;

// User private key - load from environment or Solana CLI
const USER_PRIVATE_KEY = process.env.USER_PRIVATE_KEY || (() => {
  throw new Error("Please set USER_PRIVATE_KEY environment variable");
})();

// ATA to close
const ATA_ADDRESS = new PublicKey("HtkUwMKr6DQWTtVr553SgEXc1rGhsDFN4UKbKt6kdhK3");

async function main() {
  console.log("========================================");
  console.log(`Close Token Account to Recover Rent - ${network.toUpperCase()}`);
  console.log("========================================\n");

  // Parse user private key
  const userWallet = Keypair.fromSecretKey(bs58.decode(USER_PRIVATE_KEY));
  console.log("Network:", network);
  console.log("RPC URL:", RPC_URL);
  console.log("User Wallet:", userWallet.publicKey.toBase58());
  console.log("ATA Address:", ATA_ADDRESS.toBase58());

  const connection = new Connection(RPC_URL, "confirmed");

  // Check ATA status
  const ataInfo = await connection.getAccountInfo(ATA_ADDRESS);
  if (!ataInfo) {
    console.log("\n❌ ATA does not exist");
    return;
  }

  const rentLamports = ataInfo.lamports;
  console.log(`\nATA Rent: ${rentLamports} lamports (${rentLamports / 1e9} SOL)`);

  // Get user current balance
  const balanceBefore = await connection.getBalance(userWallet.publicKey);
  console.log(`User Balance (before close): ${balanceBefore / 1e9} SOL`);

  // Create close ATA instruction
  const closeIx = createCloseAccountInstruction(
    ATA_ADDRESS,
    userWallet.publicKey, // rent recipient
    userWallet.publicKey, // owner
    [],
    TOKEN_2022_PROGRAM_ID
  );

  const tx = new Transaction().add(closeIx);

  console.log("\nClosing ATA...");

  try {
    const sig = await sendAndConfirmTransaction(connection, tx, [userWallet]);
    console.log("\n✅ ATA closed successfully!");
    console.log("Transaction signature:", sig);

    // Get user new balance
    const balanceAfter = await connection.getBalance(userWallet.publicKey);
    const recovered = balanceAfter - balanceBefore;
    console.log(`\nUser Balance (after close): ${balanceAfter / 1e9} SOL`);
    console.log(`💰 Recovered rent: ${recovered / 1e9} SOL (after tx fee)`);
    console.log(`\nView transaction: ${getExplorerLink(sig, network, 'tx')}`);
  } catch (error) {
    console.error("\n❌ Close failed:", error);
  }
}

main().catch(console.error);
