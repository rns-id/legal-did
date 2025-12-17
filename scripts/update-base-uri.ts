import { Program, AnchorProvider, Wallet, web3 } from "@coral-xyz/anchor";
import * as fs from "fs";

const { Connection, PublicKey, Keypair } = web3;

const PROGRAM_ID = new PublicKey("JCo8dShYwHu74UpBTmwUcoEcGgWZQWnoTCvFaqjGJ6fc");
const RPC_URL = "https://api.devnet.solana.com";

function findNonTransferableProject(): web3.PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("nt-proj-v3")],
    PROGRAM_ID
  );
  return pda;
}

async function main() {
  console.log("========================================");
  console.log("更新 Base URI");
  console.log("========================================\n");

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

  // 新的 base URI
  const newBaseUri = "https://api.rns.id/api/v2/portal/identity/nft/";

  console.log("Project:", nonTransferableProject.toBase58());
  console.log("新 Base URI:", newBaseUri);

  const tx = await program.methods
    .setBaseUri(newBaseUri)
    .accounts({
      nonTransferableProject: nonTransferableProject,
      authority: adminWallet.publicKey,
    })
    .signers([adminWallet])
    .rpc();

  console.log("\n✅ Base URI 更新成功！");
  console.log("交易签名:", tx);

  // 验证更新
  const projectData = await (program.account as any).projectAccount.fetch(nonTransferableProject);
  console.log("\n更新后的项目信息:");
  console.log("  Base URI:", projectData.baseUri);
}

main().catch(console.error);
