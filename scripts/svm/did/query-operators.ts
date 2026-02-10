import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Connection, PublicKey } from "@solana/web3.js";
import * as fs from "fs";

// 配置
const PROGRAM_ID = new PublicKey("BE6yuzEjzapwBEQ9RoAFzG72XZzb17JuWWqhecFHdEQa");
const PROJECT_SEED = "nt-proj-v5";

async function main() {
  const network = process.argv[2] || "devnet";
  
  let rpcUrl: string;
  if (network === "mainnet") {
    rpcUrl = "https://api.mainnet-beta.solana.com";
  } else {
    rpcUrl = "https://api.devnet.solana.com";
  }
  
  console.log(`\n🔍 查询 LegalDID Operators (${network})\n`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  
  const connection = new Connection(rpcUrl, "confirmed");
  
  // 计算 Project PDA
  const [projectPda] = PublicKey.findProgramAddressSync(
    [Buffer.from(PROJECT_SEED)],
    PROGRAM_ID
  );
  
  console.log("Program ID:", PROGRAM_ID.toBase58());
  console.log("Project PDA:", projectPda.toBase58());
  console.log("");
  
  // 获取账户信息
  const accountInfo = await connection.getAccountInfo(projectPda);
  
  if (!accountInfo) {
    console.log("❌ Project 账户不存在");
    process.exit(1);
  }
  
  console.log("✅ Project 账户存在");
  console.log("  Data Length:", accountInfo.data.length, "bytes");
  console.log("");
  
  // 解析 Authority (前8字节是discriminator，接下来32字节是authority)
  const authority = new PublicKey(accountInfo.data.slice(8, 40));
  console.log("📋 Project Authority:");
  console.log("  ", authority.toBase58());
  console.log("");
  
  // 加载 IDL 并解析完整数据
  try {
    const idlPath = "./target/idl/legaldid.json";
    if (!fs.existsSync(idlPath)) {
      console.log("⚠️  IDL 文件不存在，无法解析详细信息");
      console.log("   运行 'anchor build' 生成 IDL");
      return;
    }
    
    const idl = JSON.parse(fs.readFileSync(idlPath, "utf-8"));
    
    const dummyWallet = {
      publicKey: authority,
      signTransaction: async (tx: any) => tx,
      signAllTransactions: async (txs: any[]) => txs,
    };
    
    const provider = new anchor.AnchorProvider(
      connection,
      dummyWallet as any,
      { commitment: "confirmed" }
    );
    
    const program = new Program(idl, provider);
    
    // 获取 Project 数据
    const projectData: any = await program.account["nonTransferableProject"].fetch(projectPda);
    
    console.log("📊 Project 详细信息:");
    console.log("  Name:", projectData.name);
    console.log("  Symbol:", projectData.symbol);
    console.log("  Base URI:", projectData.baseUri);
    console.log("  Mint Price:", projectData.mintPrice.toString(), "lamports");
    console.log("  Destination:", projectData.destination.toBase58());
    console.log("");
    
    console.log("👥 Operators 列表:");
    if (projectData.operators && projectData.operators.length > 0) {
      projectData.operators.forEach((op: PublicKey, i: number) => {
        console.log(`  ${i + 1}. ${op.toBase58()}`);
      });
      console.log("");
      console.log(`  总计: ${projectData.operators.length} 个操作员`);
    } else {
      console.log("  (无操作员)");
    }
    console.log("");
    
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("");
    console.log("🔗 浏览器链接:");
    if (network === "devnet") {
      console.log(`  https://explorer.solana.com/address/${projectPda.toBase58()}?cluster=devnet`);
    } else {
      console.log(`  https://explorer.solana.com/address/${projectPda.toBase58()}`);
    }
    console.log("");
    
  } catch (error: any) {
    console.log("❌ 解析 Project 数据失败:");
    console.log("  ", error.message);
    console.log("");
    console.log("💡 提示: 确保已运行 'anchor build' 生成 IDL");
  }
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
