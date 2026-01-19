import { Program, AnchorProvider, Wallet, web3 } from "@coral-xyz/anchor";
import { TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import * as fs from "fs";

const {
  Connection,
  PublicKey,
  Keypair,
  ComputeBudgetProgram,
  SYSVAR_RENT_PUBKEY,
  SystemProgram,
} = web3;

// Config - updated to current program ID
const PROGRAM_ID = new PublicKey(
  "BE6yuzEjzapwBEQ9RoAFzG72XZzb17JuWWqhecFHdEQa"
);
const RPC_URL = "https://api.devnet.solana.com";

// PDA calculation functions
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
  console.log("Legal DID Devnet Init Script");
  console.log("========================================\n");

  // Load wallet
  const walletPath = process.env.HOME + "/.config/solana/id.json";
  const secretKey = JSON.parse(fs.readFileSync(walletPath, "utf-8"));
  const adminWallet = Keypair.fromSecretKey(new Uint8Array(secretKey));

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
    console.log(
      `\nView transaction: https://explorer.solana.com/tx/${tx}?cluster=devnet`
    );
  } catch (error) {
    console.error("\n❌ Initialization failed:", error);
    throw error;
  }
}

main().catch(console.error);