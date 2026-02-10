import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Connection, PublicKey, Keypair } from "@solana/web3.js";
import * as fs from "fs";
import * as os from "os";

// 配置
const PROGRAM_ID = new PublicKey("BE6yuzEjzapwBEQ9RoAFzG72XZzb17JuWWqhecFHdEQa");
const SQUADS_VAULT = new PublicKey("wkxCmw6rzM8xeUNhzPhWtWCwp6VoE4S81ymNDhqMWud");
const PROJECT_SEED = "nt-proj-v5";

async function main() {
  // 连接 devnet
  const connection = new Connection("https://api.devnet.solana.com", "confirmed");
  
  // 加载钱包
  const walletPath = `${os.homedir()}/.config/solana/id.json`;
  const secretKey = JSON.parse(fs.readFileSync(walletPath, "utf-8"));
  const wallet = Keypair.fromSecretKey(Uint8Array.from(secretKey));
  
  console.log("=== Transfer Authority to Squads Vault ===");
  console.log("Current Authority:", wallet.publicKey.toBase58());
  console.log("New Authority (Squads Vault):", SQUADS_VAULT.toBase58());
  console.log("Program ID:", PROGRAM_ID.toBase58());
  
  // 计算 Project PDA
  const [projectPda] = PublicKey.findProgramAddressSync(
    [Buffer.from(PROJECT_SEED)],
    PROGRAM_ID
  );
  console.log("Project PDA:", projectPda.toBase58());
  
  // 验证当前 authority
  const accountInfo = await connection.getAccountInfo(projectPda);
  if (!accountInfo) {
    throw new Error("Project account not found");
  }
  
  const currentAuthority = new PublicKey(accountInfo.data.slice(8, 40));
  console.log("Current Authority (on-chain):", currentAuthority.toBase58());
  
  if (!currentAuthority.equals(wallet.publicKey)) {
    throw new Error(`Current wallet is not the authority. Expected: ${currentAuthority.toBase58()}`);
  }
  
  // 加载 IDL
  const idlPath = "./target/idl/legaldid.json";
  if (!fs.existsSync(idlPath)) {
    throw new Error("IDL not found. Run 'anchor build' first.");
  }
  const idl = JSON.parse(fs.readFileSync(idlPath, "utf-8"));
  
  // 创建 provider 和 program
  const provider = new anchor.AnchorProvider(
    connection,
    new anchor.Wallet(wallet),
    { commitment: "confirmed" }
  );
  anchor.setProvider(provider);
  
  const program = new Program(idl, provider);
  
  console.log("\n>>> Transferring authority...");
  
  // 调用 transfer_authority
  const tx = await program.methods
    .transferAuthority(SQUADS_VAULT)
    .accounts({
      authority: wallet.publicKey,
      nonTransferableProject: projectPda,
    })
    .signers([wallet])
    .rpc();
  
  console.log("✅ Transaction successful!");
  console.log("Signature:", tx);
  console.log("Explorer: https://explorer.solana.com/tx/" + tx + "?cluster=devnet");
  
  // 验证转移结果
  const newAccountInfo = await connection.getAccountInfo(projectPda);
  if (newAccountInfo) {
    const newAuthority = new PublicKey(newAccountInfo.data.slice(8, 40));
    console.log("\n=== Verification ===");
    console.log("New Authority (on-chain):", newAuthority.toBase58());
    
    if (newAuthority.equals(SQUADS_VAULT)) {
      console.log("✅ Authority successfully transferred to Squads Vault!");
    } else {
      console.log("❌ Authority transfer verification failed");
    }
  }
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
