/**
 * 生成 BPF Loader 的 Extend Program 指令
 * 用于扩展 ProgramData 账户的空间
 */

import { PublicKey } from "@solana/web3.js";
import * as bs58 from "bs58";

const PROGRAM_ID = new PublicKey("BE6yuzEjzapwBEQ9RoAFzG72XZzb17JuWWqhecFHdEQa");
const BPF_LOADER = new PublicKey("BPFLoaderUpgradeab1e11111111111111111111111");
const SYSTEM_PROGRAM = new PublicKey("11111111111111111111111111111111");

// 派生 ProgramData 地址
const [programDataAddress] = PublicKey.findProgramAddressSync(
  [PROGRAM_ID.toBuffer()],
  BPF_LOADER
);

console.log("🔧 生成 Extend Program 指令\n");

console.log("📋 地址信息:");
console.log("  Program ID:", PROGRAM_ID.toString());
console.log("  Program Data:", programDataAddress.toString());
console.log("");

console.log("📊 空间信息:");
console.log("  当前大小: 358960 bytes");
console.log("  需要大小: 361688 bytes");
console.log("  需要扩展: 2728 bytes");
console.log("  建议扩展: 3000 bytes (留一些余量)");
console.log("");

// Extend 指令格式:
// [discriminator: u32 = 5, additional_bytes: u32]
// discriminator = 5 (Extend)
// additional_bytes = 3000

const instructionData = Buffer.alloc(8);
instructionData.writeUInt32LE(5, 0); // Extend discriminator
instructionData.writeUInt32LE(3000, 4); // 扩展 3000 bytes

console.log("📝 Squads UI 填写指南:\n");

console.log("=== Program ID ===");
console.log(BPF_LOADER.toString());
console.log("");

console.log("=== Instruction Data (Base58) ===");
console.log(bs58.encode(instructionData));
console.log("");

console.log("=== Instruction Data (Hex) ===");
console.log(instructionData.toString('hex'));
console.log("");

console.log("=== Accounts (按顺序添加 3 个账户) ===\n");

console.log("Account 1 - Program Data Account:");
console.log("  Address:", programDataAddress.toString());
console.log("  Signer: ❌ NO");
console.log("  Writable: ✅ YES");
console.log("");

console.log("Account 2 - Program Account:");
console.log("  Address:", PROGRAM_ID.toString());
console.log("  Signer: ❌ NO");
console.log("  Writable: ❌ NO");
console.log("");

console.log("Account 3 - System Program:");
console.log("  Address:", SYSTEM_PROGRAM.toString());
console.log("  Signer: ❌ NO");
console.log("  Writable: ❌ NO");
console.log("");

console.log("=== 完整配置 ===");
console.log("");
console.log("Program ID:");
console.log(BPF_LOADER.toString());
console.log("");
console.log("Instruction Data (Raw):");
console.log(bs58.encode(instructionData));
console.log("");
console.log("Account 1:", programDataAddress.toString(), "[Writable]");
console.log("Account 2:", PROGRAM_ID.toString(), "[Read-only]");
console.log("Account 3:", SYSTEM_PROGRAM.toString(), "[Read-only]");
console.log("");

console.log("✅ 配置完成！");
console.log("");
console.log("🎯 操作步骤:");
console.log("1. 在 Squads UI 创建 Custom Instruction");
console.log("2. 填写上面的信息");
console.log("3. 创建提案并投票");
console.log("4. 执行后，ProgramData 空间会扩展 3000 bytes");
console.log("5. 然后再次尝试升级程序");
console.log("");
console.log("💰 费用:");
console.log("  扩展 3000 bytes 需要约 0.02 SOL");
console.log("  这些 SOL 会从多签账户扣除");
