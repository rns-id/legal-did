import { Program, AnchorProvider, Wallet, web3 } from "@coral-xyz/anchor";
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
} = web3;

// Get network from command line args (default: devnet)
const network = process.argv[2] || "devnet";
const config = getNetworkConfig(network);

const PROGRAM_ID = new PublicKey(config.programId);
const RPC_URL = config.rpcUrl;

// PDA calculation functions (v5 version - with Collection + Metadata)
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
  console.log(`RNS DID Init Script (Token-2022 v5 + Collection + Metadata) - ${network.toUpperCase()}`);
  console.log("========================================\n");

  // Load wallet
  const walletPath = process.env.HOME + "/.config/solana/id.json";
  const secretKey = JSON.parse(fs.readFileSync(walletPath, "utf-8"));
  const adminWallet = Keypair.fromSecretKey(new Uint8Array(secretKey));

  console.log("Network:", network);
  console.log("RPC URL:", RPC_URL);
  console.log("Program ID:", PROGRAM_ID.toBase58());
  console.log("Admin Wallet:", adminWallet.publicKey.toBase58());

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
  const nonTransferableProjectMint = getProjectMintAddress();

  console.log("\nPDA Addresses:");
  console.log("  Project:", nonTransferableProject.toBase58());
  console.log("  Project Mint (Token-2022):", nonTransferableProjectMint.toBase58());
  console.log("");

  // Check if project is already initialized
  const projectInfo = await connection.getAccountInfo(nonTransferableProject);
  if (projectInfo) {
    console.log("✅ Project already initialized!");

    // Display project info
    try {
      const projectData = await (program.account as any).projectAccount.fetch(
        nonTransferableProject
      );
      console.log("\nProject Info:");
      console.log("  Name:", projectData.name);
      console.log("  Symbol:", projectData.symbol);
      console.log("  Base URI:", projectData.baseUri);
      console.log("  Authority:", projectData.authority.toBase58());
    } catch (e) {
      console.log("Unable to read project data");
    }
    return;
  }

  console.log("Initializing project (Token-2022)...");

  try {
    const setComputeUnitLimitIx = ComputeBudgetProgram.setComputeUnitLimit({
      units: 400_000,
    });

    const domain = "https://api.rns.id/";

    const tx = await program.methods
      .initialize({
        name: "Legal DID",
        symbol: "LDID",
        baseUri: `${domain}api/v2/portal/identity/nft/`,
      })
      .accounts({
        authority: adminWallet.publicKey,
        nonTransferableProject: nonTransferableProject,
        nonTransferableProjectMint: nonTransferableProjectMint,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .preInstructions([setComputeUnitLimitIx])
      .signers([adminWallet])
      .rpc();

    console.log("\n✅ Initialization successful!");
    console.log("Transaction signature:", tx);
    console.log(`\nView transaction: ${getExplorerLink(tx, network, 'tx')}`);
  } catch (error) {
    console.error("\n❌ Initialization failed:", error);
    throw error;
  }
}

main().catch(console.error);
