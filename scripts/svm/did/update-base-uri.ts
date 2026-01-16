/**
 * Update Base URI Script
 * 
 * Function: Update the base URI for NFT metadata
 * 
 * Usage:
 *   ts-node update-base-uri.ts [network]
 *   network: devnet (default) | mainnet | localnet
 */

import { Program, AnchorProvider, Wallet, web3 } from "@coral-xyz/anchor";
import * as fs from "fs";
import { getNetworkConfig, getExplorerLink } from "../../config";

const { Connection, PublicKey, Keypair } = web3;

// Get network from command line args (default: devnet)
const network = process.argv[2] || "devnet";
const config = getNetworkConfig(network);

const PROGRAM_ID = new PublicKey(config.programId);
const RPC_URL = config.rpcUrl;

function findNonTransferableProject(): web3.PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("nt-proj-v4")],
    PROGRAM_ID
  );
  return pda;
}

async function main() {
  console.log("========================================");
  console.log(`Update Base URI - ${network.toUpperCase()}`);
  console.log("========================================\n");

  const walletPath = process.env.HOME + "/.config/solana/id.json";
  const secretKey = JSON.parse(fs.readFileSync(walletPath, "utf-8"));
  const adminWallet = Keypair.fromSecretKey(new Uint8Array(secretKey));

  const connection = new Connection(RPC_URL, "confirmed");
  const wallet = new Wallet(adminWallet);
  const provider = new AnchorProvider(connection, wallet, { commitment: "confirmed" });

  const idlPath = "./target/idl/legaldid.json";
  const idl = JSON.parse(fs.readFileSync(idlPath, "utf-8"));
  const program = new Program(idl, provider);

  const nonTransferableProject = findNonTransferableProject();

  // New base URI
  const newBaseUri = "https://api.rns.id/api/v2/portal/identity/nft/";

  console.log("Network:", network);
  console.log("RPC URL:", RPC_URL);
  console.log("Program ID:", PROGRAM_ID.toBase58());
  console.log("Project:", nonTransferableProject.toBase58());
  console.log("New Base URI:", newBaseUri);

  const tx = await program.methods
    .setBaseUri(newBaseUri)
    .accounts({
      nonTransferableProject: nonTransferableProject,
      authority: adminWallet.publicKey,
    })
    .signers([adminWallet])
    .rpc();

  console.log("\n✅ Base URI updated successfully!");
  console.log("Transaction signature:", tx);
  console.log(`\nView transaction: ${getExplorerLink(tx, network, 'tx')}`);

  // Verify update
  const projectData = await (program.account as any).projectAccount.fetch(nonTransferableProject);
  console.log("\nUpdated project info:");
  console.log("  Base URI:", projectData.baseUri);
}

main().catch(console.error);
