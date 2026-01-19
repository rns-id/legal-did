import { Program, AnchorProvider, Wallet, web3 } from "@coral-xyz/anchor";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import * as fs from "fs";
import { getNetworkConfig, getExplorerLink } from "../../config";

const {
  Connection,
  PublicKey,
  Keypair,
  ComputeBudgetProgram,
  SYSVAR_RENT_PUBKEY,
  SystemProgram,
} = web3;

// Get parameters from command line
const network = process.argv[2] || "devnet";
const recipientAddress = process.argv[3];
const orderId = process.argv[4];
const merkleRoot = process.argv[5] || "0000000000000000000000000000000000000000000000000000000000000000";

if (!recipientAddress || !orderId) {
  console.log("Usage: npx ts-node scripts/svm/did/mint-single.ts <network> <recipient> <orderId> [merkleRoot]");
  console.log("Example: npx ts-node scripts/svm/did/mint-single.ts devnet 7s3NWENLzKzL18yGfy4rQNYFQPNFhiHnXYSgjptEwhBg d275d072-21e1-48d3-b17c-e0855712b067");
  process.exit(1);
}

const config = getNetworkConfig(network);
const PROGRAM_ID = new PublicKey(config.programId);
const RPC_URL = config.rpcUrl;
const MINT_TO_ADDRESS = new PublicKey(recipientAddress);

// PDA calculation functions
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

function getNftMintAddress(orderId: string): web3.PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("nt-nft-mint-v5"), Buffer.from(orderId)],
    PROGRAM_ID
  );
  return pda;
}

async function main() {
  console.log("========================================");
  console.log(`Mint DID NFT - ${network.toUpperCase()}`);
  console.log("========================================\n");

  // Load wallet
  const walletPath = process.env.HOME + "/.config/solana/id.json";
  const secretKey = JSON.parse(fs.readFileSync(walletPath, "utf-8"));
  const adminWallet = Keypair.fromSecretKey(new Uint8Array(secretKey));

  console.log("Network:", network);
  console.log("Program ID:", PROGRAM_ID.toBase58());
  console.log("Admin Wallet:", adminWallet.publicKey.toBase58());
  console.log("Recipient:", MINT_TO_ADDRESS.toBase58());
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
  console.log("  NFT Mint:", nonTransferableNftMint.toBase58());
  console.log("  User Token Account:", userTokenAccount.toBase58());
  console.log("");

  // Check if NFT already exists
  const nftMintInfo = await connection.getAccountInfo(nonTransferableNftMint);
  if (nftMintInfo) {
    console.log("❌ NFT with this order ID already exists!");
    console.log(`View existing NFT: ${getExplorerLink(nonTransferableNftMint.toBase58(), network)}`);
    return;
  }

  console.log("✅ Ready to mint\n");

  // Execute airdrop
  console.log("Minting DID NFT...");

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
    console.log("Transaction:", tx);
    console.log("Order ID:", orderId);
    console.log("Recipient:", MINT_TO_ADDRESS.toBase58());
    console.log(`\nView transaction: ${getExplorerLink(tx, network, 'tx')}`);
    console.log(`View NFT Mint: ${getExplorerLink(nonTransferableNftMint.toBase58(), network)}`);
    console.log(`View User Token Account: ${getExplorerLink(userTokenAccount.toBase58(), network)}`);
  } catch (error) {
    console.error("\n❌ Mint failed:", error);
    throw error;
  }
}

main().catch(console.error);
