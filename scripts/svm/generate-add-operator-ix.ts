import * as anchor from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import * as fs from "fs";
import * as bs58 from "bs58";

// 配置 - 修改这里的新 Operator 地址
const NEW_OPERATOR = new PublicKey("8bsJcfGRyFWUEzS4bQfADTVBjReUm3YH89x1QY1qp3gd"); // 改成你要添加的地址

const PROGRAM_ID = new PublicKey("BE6yuzEjzapwBEQ9RoAFzG72XZzb17JuWWqhecFHdEQa");
const SQUADS_VAULT = new PublicKey("wkxCmw6rzM8xeUNhzPhWtWCwp6VoE4S81ymNDhqMWud");
const PROJECT_SEED = "nt-proj-v5";

async function main() {
  // 计算 Project PDA
  const [projectPda] = PublicKey.findProgramAddressSync(
    [Buffer.from(PROJECT_SEED)],
    PROGRAM_ID
  );

  // 加载 IDL
  const idl = JSON.parse(fs.readFileSync("./target/idl/legaldid.json", "utf-8"));
  
  // 创建指令数据 (add_operator 的 discriminator + operator pubkey)
  const coder = new anchor.BorshCoder(idl);
  const ixData = coder.instruction.encode("add_operator", {
    operator: NEW_OPERATOR,
  });

  console.log("=== Add Operator Instruction for Squads ===\n");
  console.log("Program ID:", PROGRAM_ID.toBase58());
  console.log("New Operator:", NEW_OPERATOR.toBase58());
  console.log("\n--- Accounts ---");
  console.log("1. authority (signer, writable):", SQUADS_VAULT.toBase58());
  console.log("2. nonTransferableProject (writable):", projectPda.toBase58());
  
  console.log("\n--- Instruction Data ---");
  console.log("Hex:", Buffer.from(ixData).toString("hex"));
  console.log("Base58:", bs58.encode(ixData));
  console.log("Bytes:", Array.from(ixData).join(", "));
  
  console.log("\n=== Squads TX Builder 配置 ===");
  console.log(`
在 Squads TX Builder 中:

1. Program ID: ${PROGRAM_ID.toBase58()}

2. Accounts (按顺序添加):
   - Account 1: ${SQUADS_VAULT.toBase58()}
     - Signer: ✅ (勾选)
     - Writable: ✅ (勾选)
   
   - Account 2: ${projectPda.toBase58()}
     - Signer: ❌ (不勾选)
     - Writable: ✅ (勾选)

3. Instruction Data (Base58): ${bs58.encode(ixData)}

4. 点击 "Create Transaction" 创建提案
5. 等待其他 Owner 批准（如果阈值 > 1）
6. 执行交易
`);
}

main().catch(console.error);
