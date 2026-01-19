/**
 * Migrate from old ProjectAccount (with last_token_id) to new structure (without last_token_id)
 * 
 * WARNING: This will close the old project account and create a new one.
 * Any existing NFTs will still work, but you'll need to reconfigure project settings.
 */

import { Program, AnchorProvider, Wallet, web3 } from "@coral-xyz/anchor";
import { TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import * as fs from "fs";
import { getNetworkConfig } from "../../config";

const { Connection, PublicKey, Keypair, SystemProgram, SYSVAR_RENT_PUBKEY } = web3;

const network = process.argv[2] || "devnet";
const config = getNetworkConfig(network);

const PROGRAM_ID = new PublicKey(config.programId);
const RPC_URL = config.rpcUrl;

async function main() {
  console.log("========================================");
  console.log(`Migrate to V5 (Remove last_token_id) - ${network.toUpperCase()}`);
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

  const [projectPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("nt-proj-v5")],
    PROGRAM_ID
  );

  const [collectionMint] = PublicKey.findProgramAddressSync(
    [Buffer.from("nt-project-mint-v5")],
    PROGRAM_ID
  );

  console.log("Project PDA:", projectPda.toBase58());
  console.log("Collection Mint:", collectionMint.toBase58());
  console.log("");

  // Check if old account exists
  const oldAccount = await connection.getAccountInfo(projectPda);
  if (oldAccount) {
    console.log("⚠️  Old project account found (size:", oldAccount.data.length, "bytes)");
    console.log("This account needs to be closed and recreated.");
    console.log("");
    console.log("Note: Existing NFTs will continue to work, but project settings will be reset.");
    console.log("");
    
    // For safety, we won't auto-close. User should manually close if needed.
    console.log("To proceed:");
    console.log("1. Make sure no important data will be lost");
    console.log("2. Run: npx ts-node scripts/svm/did/init.ts", network);
    console.log("");
    console.log("The init script will handle the migration automatically.");
  } else {
    console.log("✅ No old account found. Ready to initialize!");
    console.log("Run: npx ts-node scripts/svm/did/init.ts", network);
  }
}

main().catch(console.error);
