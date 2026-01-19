/**
 * User Burn Script
 * 
 * Function: User voluntarily burns their own DID NFT
 * Rent recovery:
 *   - ATA rent (~0.0021 SOL) → User
 *   - Mint rent (~0.0049 SOL) → Admin
 * 
 * Usage:
 *   ts-node user-burn.ts [network]
 *   network: devnet (default) | mainnet | localnet
 */

import { Program, AnchorProvider, Wallet, web3 } from "@coral-xyz/anchor";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import * as fs from "fs";
import bs58 from "bs58";
import * as dotenv from "dotenv";
import { getNetworkConfig, getExplorerLink } from "../../config";

// Load environment variables
dotenv.config();

const { Connection, PublicKey, Keypair, ComputeBudgetProgram, SystemProgram } = web3;

// Get network from command line args (default: devnet)
const network = process.argv[2] || "devnet";
const config = getNetworkConfig(network);

const PROGRAM_ID = new PublicKey(config.programId);
const RPC_URL = config.rpcUrl;

// ========== CONFIG ==========
// User private key (base58 format) - load from environment
const USER_PRIVATE_KEY = process.env.USER_PRIVATE_KEY || (() => {
  throw new Error("Please set USER_PRIVATE_KEY environment variable");
})();

// NFT info to burn (v5 version)
const orderId = "test-order-001"; // Use the order_id that was used during minting

// Admin address (receives Mint rent)
const ADMIN_ADDRESS = new PublicKey("2fuikT5C2YVctakxoBNQ23NjXzA4kY2cn36Sh6ws3pAt");
// ==========================

function findNonTransferableProject(): web3.PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("nt-proj-v5")],
    PROGRAM_ID
  );
  return pda;
}

function getNftMintAddress(orderId: string): web3.PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("nt-nft-mint-v5"), Buffer.from(orderId)],
    PROGRAM_ID
  );
  return pda;
}

async function main() {
  console.log("========================================");
  console.log(`User Burn DID NFT - ${network.toUpperCase()}`);
  console.log("========================================\n");

  // Load user wallet
  const userWallet = Keypair.fromSecretKey(bs58.decode(USER_PRIVATE_KEY));

  const connection = new Connection(RPC_URL, "confirmed");
  const wallet = new Wallet(userWallet);
  const provider = new AnchorProvider(connection, wallet, { commitment: "confirmed" });

  const idlPath = "./target/idl/legaldid.json";
  const idl = JSON.parse(fs.readFileSync(idlPath, "utf-8"));
  const program = new Program(idl, provider);

  const nonTransferableProject = findNonTransferableProject();
  const nonTransferableNftMint = getNftMintAddress(orderId);
  const userTokenAccount = getAssociatedTokenAddressSync(
    nonTransferableNftMint,
    userWallet.publicKey,
    false,
    TOKEN_2022_PROGRAM_ID
  );

  console.log("Network:", network);
  console.log("RPC URL:", RPC_URL);
  console.log("Program ID:", PROGRAM_ID.toBase58());
  console.log("User:", userWallet.publicKey.toBase58());
  console.log("Admin:", ADMIN_ADDRESS.toBase58());
  console.log("Order ID:", orderId);
  console.log("NFT Mint:", nonTransferableNftMint.toBase58());
  console.log("User ATA:", userTokenAccount.toBase58());

  // Check if ATA exists and has balance
  const ataInfo = await connection.getAccountInfo(userTokenAccount);
  if (!ataInfo) {
    console.log("\n❌ ATA does not exist, NFT may have been burned");
    return;
  }

  const userBalanceBefore = await connection.getBalance(userWallet.publicKey);
  const adminBalanceBefore = await connection.getBalance(ADMIN_ADDRESS);

  console.log("\nExecuting Burn...");

  try {
    const setComputeUnitLimitIx = ComputeBudgetProgram.setComputeUnitLimit({
      units: 200_000,
    });

    const tx = await program.methods
      .burn()
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

    console.log("\n✅ Burn successful!");
    console.log("Transaction signature:", tx);
    console.log(`\n💰 User recovered (ATA rent - tx fee): ${userRecovered.toFixed(8)} SOL`);
    console.log(`💰 Admin recovered (Mint rent): ${adminRecovered.toFixed(8)} SOL`);
    console.log(`\nView transaction: ${getExplorerLink(tx, network, 'tx')}`);
  } catch (error: any) {
    console.error("\n❌ Burn failed:", error.message);
  }
}

main().catch(console.error);
