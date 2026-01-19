import { Program, AnchorProvider, Wallet, web3 } from "@coral-xyz/anchor";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import * as fs from "fs";
import { getNetworkConfig, getExplorerLink } from "../../config";
import { createHash } from "crypto";

const {
  Connection,
  PublicKey,
  Keypair,
  ComputeBudgetProgram,
  SYSVAR_RENT_PUBKEY,
  SystemProgram,
} = web3;

// Get network from command line args (default: devnet)
const network = process.argv[2] || "devnet";
const config = getNetworkConfig(network);

const PROGRAM_ID = new PublicKey(config.programId);
const RPC_URL = config.rpcUrl;

// Mint target address - can be overridden via command line
const MINT_TO_ADDRESS = new PublicKey(
  process.argv[3] || "H2sykMLjWjBCtALDYCwnqxALEWtDbBwfCXtz7YThoEne"
);

// Test parameters - can be overridden via command line
const orderId = process.argv[4] || "test-order-001";
const merkleRoot = process.argv[5] || "2d852b3c21e923484a93d3a980a45b7571e89552d58875d40dd17c73216a49d7";

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

// NFT Mint PDA is derived from order_id hash (to support long UUIDs)
function getNftMintAddress(orderId: string): web3.PublicKey {
  const hash = createHash('sha256').update(orderId).digest();
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("nt-nft-mint-v5"), hash],
    PROGRAM_ID
  );
  return pda;
}

async function main() {
  console.log("========================================");
  console.log(`RNS DID Mint Script (Token-2022 v4 + Collection) - ${network.toUpperCase()}`);
  console.log("========================================\n");

  // Load wallet
  const walletPath = process.env.HOME + "/.config/solana/id.json";
  const secretKey = JSON.parse(fs.readFileSync(walletPath, "utf-8"));
  const adminWallet = Keypair.fromSecretKey(new Uint8Array(secretKey));

  console.log("Network:", network);
  console.log("RPC URL:", RPC_URL);
  console.log("Program ID:", PROGRAM_ID.toBase58());
  console.log("Admin Wallet:", adminWallet.publicKey.toBase58());
  console.log("Mint Target:", MINT_TO_ADDRESS.toBase58());
  console.log("Order ID:", orderId);
  console.log("Merkle Root:", merkleRoot);
  console.log("");

  // Connect
  const connection = new Connection(RPC_URL, "confirmed");
  const wallet = new Wallet(adminWallet);
  const provider = new AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });

  // Load IDL
  const idlPath = "./target/idl/legaldid.json";
  const idl = JSON.parse(fs.readFileSync(idlPath, "utf-8"));
  const program = new Program(idl, provider);

  // Calculate all PDAs
  const nonTransferableProject = findNonTransferableProject();
  const collectionMint = findCollectionMint();
  
  // Check if project is initialized
  const projectAccountInfo = await connection.getAccountInfo(nonTransferableProject);
  if (!projectAccountInfo) {
    console.log("❌ Project not initialized! Run init.ts first");
    return;
  }
  
  // NFT Mint PDA is derived from order_id
  const nonTransferableNftMint = getNftMintAddress(orderId);
  const userTokenAccount = getAssociatedTokenAddressSync(
    nonTransferableNftMint,
    MINT_TO_ADDRESS,
    false,
    TOKEN_2022_PROGRAM_ID
  );

  console.log("PDA Addresses:");
  console.log("  Project:", nonTransferableProject.toBase58());
  console.log("  Collection Mint:", collectionMint.toBase58());
  console.log("  NFT Mint (order_id=" + orderId + "):", nonTransferableNftMint.toBase58());
  console.log("  User Token Account:", userTokenAccount.toBase58());
  console.log("");
  console.log("✅ Project initialized\n");

  // Execute airdrop
  console.log("Minting DID NFT (Token-2022 + merkle_root in metadata)...");

  try {
    const setComputeUnitLimitIx = ComputeBudgetProgram.setComputeUnitLimit({
      units: 400_000,
    });

    const tx = await program.methods
      .airdrop(orderId, MINT_TO_ADDRESS, merkleRoot)
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
    console.log("Order ID:", orderId);
    console.log(`\nView transaction: ${getExplorerLink(tx, network, 'tx')}`);
    console.log(`View NFT Mint: ${getExplorerLink(nonTransferableNftMint.toBase58(), network)}`);
    console.log(`View User Token Account: ${getExplorerLink(userTokenAccount.toBase58(), network)}`);
  } catch (error) {
    console.error("\n❌ Mint failed:", error);
    throw error;
  }
}

main().catch(console.error);
