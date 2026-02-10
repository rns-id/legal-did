import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Connection, PublicKey, TransactionInstruction } from "@solana/web3.js";
import * as fs from "fs";

// 配置
const PROGRAM_ID = new PublicKey("BE6yuzEjzapwBEQ9RoAFzG72XZzb17JuWWqhecFHdEQa");
const SQUADS_VAULT = new PublicKey("wkxCmw6rzM8xeUNhzPhWtWCwp6VoE4S81ymNDhqMWud");
const PROJECT_SEED = "nt-proj-v5";
const OPERATOR_TO_ADD = new PublicKey("8bsJcfGRyFWUEzS4bQfADTVBjReUm3YH89x1QY1qp3gd");

async function main() {
  console.log("=== 构建添加操作员交易参数 ===\n");
  
  // 连接 devnet
  const connection = new Connection("https://api.devnet.solana.com", "confirmed");
  
  // 计算 Project PDA
  const [projectPda] = PublicKey.findProgramAddressSync(
    [Buffer.from(PROJECT_SEED)],
    PROGRAM_ID
  );
  
  console.log("📋 基本信息:");
  console.log("  Program ID:", PROGRAM_ID.toBase58());
  console.log("  Project PDA:", projectPda.toBase58());
  console.log("  Authority (Squads):", SQUADS_VAULT.toBase58());
  console.log("  要添加的 Operator:", OPERATOR_TO_ADD.toBase58());
  console.log("");
  
  // 加载 IDL
  const idlPath = "./target/idl/legaldid.json";
  if (!fs.existsSync(idlPath)) {
    throw new Error("IDL not found. Run 'anchor build' first.");
  }
  const idl = JSON.parse(fs.readFileSync(idlPath, "utf-8"));
  
  // 创建一个临时 provider
  const dummyWallet = {
    publicKey: SQUADS_VAULT,
    signTransaction: async (tx: any) => tx,
    signAllTransactions: async (txs: any[]) => txs,
  };
  
  const provider = new anchor.AnchorProvider(
    connection,
    dummyWallet as any,
    { commitment: "confirmed" }
  );
  
  const program = new Program(idl, provider);
  
  // 构建指令
  const instruction = await program.methods
    .addOperator(OPERATOR_TO_ADD)
    .accounts({
      authority: SQUADS_VAULT,
      nonTransferableProject: projectPda,
    })
    .instruction();
  
  console.log("🔧 交易指令信息:");
  console.log("  Program ID:", instruction.programId.toBase58());
  console.log("  Instruction Data (hex):", instruction.data.toString('hex'));
  console.log("  Instruction Data (base64):", instruction.data.toString('base64'));
  console.log("");
  
  console.log("📝 Accounts (按顺序):");
  instruction.keys.forEach((key, index) => {
    console.log(`  ${index + 1}. ${key.pubkey.toBase58()}`);
    console.log(`     - isSigner: ${key.isSigner}`);
    console.log(`     - isWritable: ${key.isWritable}`);
  });
  console.log("");
  
  // 查找 add_operator 指令的 discriminator
  const addOperatorIx = idl.instructions.find((ix: any) => ix.name === "addOperator");
  if (addOperatorIx) {
    console.log("📌 指令详情:");
    console.log("  指令名称: addOperator");
    console.log("  指令索引:", idl.instructions.indexOf(addOperatorIx));
  }
  console.log("");
  
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("🎯 方式 1: 使用 Program Instruction (推荐尝试)");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("");
  console.log("Program ID: " + PROGRAM_ID.toBase58());
  console.log("Program Name: legaldid");
  console.log("Chain Instruction: addOperator");
  console.log("");
  console.log("Accounts:");
  console.log("  1. authority");
  console.log("     Address: " + SQUADS_VAULT.toBase58());
  console.log("     Signer: ✓");
  console.log("     Writable: ✓");
  console.log("");
  console.log("  2. nonTransferableProject");
  console.log("     Address: " + projectPda.toBase58());
  console.log("     Signer: ✗");
  console.log("     Writable: ✓");
  console.log("");
  console.log("Args:");
  console.log("  operator (publicKey):");
  console.log("  " + OPERATOR_TO_ADD.toBase58());
  console.log("");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("🎯 方式 2: 使用 Raw Transaction (如果方式1失败)");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("");
  console.log("Program ID:");
  console.log("  " + PROGRAM_ID.toBase58());
  console.log("");
  console.log("Instruction Data (Base64):");
  console.log("  " + instruction.data.toString('base64'));
  console.log("");
  console.log("Instruction Data (Hex):");
  console.log("  " + instruction.data.toString('hex'));
  console.log("");
  console.log("Accounts (按顺序):");
  instruction.keys.forEach((key, index) => {
    console.log(`  ${index}. ${key.pubkey.toBase58()}`);
    console.log(`     Signer: ${key.isSigner ? '✓' : '✗'}`);
    console.log(`     Writable: ${key.isWritable ? '✓' : '✗'}`);
  });
  console.log("");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("");
  
  // 验证当前状态
  console.log("🔍 验证当前状态:");
  const accountInfo = await connection.getAccountInfo(projectPda);
  if (accountInfo) {
    const currentAuthority = new PublicKey(accountInfo.data.slice(8, 40));
    console.log("  当前 Authority:", currentAuthority.toBase58());
    
    if (currentAuthority.equals(SQUADS_VAULT)) {
      console.log("  ✅ Authority 是 Squads 多签");
    } else {
      console.log("  ⚠️  Authority 不是 Squads 多签！");
      console.log("  需要先转移 Project Authority");
    }
    
    // 尝试解析 operators
    try {
      const projectData: any = await program.account["nonTransferableProject"].fetch(projectPda);
      console.log("  当前 Operators:", projectData.operators.length);
      projectData.operators.forEach((op: PublicKey, i: number) => {
        console.log(`    ${i + 1}. ${op.toBase58()}`);
      });
    } catch (e: any) {
      console.log("  无法解析 operators 列表:", e.message);
    }
  } else {
    console.log("  ❌ Project 账户不存在");
  }
  console.log("");
  
  // 生成原始交易数据（用于高级用户）
  console.log("🔧 原始交易数据 (Advanced):");
  console.log("  Instruction Data (Base64):", instruction.data.toString('base64'));
  console.log("  Accounts JSON:");
  console.log(JSON.stringify(instruction.keys.map(k => ({
    pubkey: k.pubkey.toBase58(),
    isSigner: k.isSigner,
    isWritable: k.isWritable
  })), null, 2));
  console.log("");
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
