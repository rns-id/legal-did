/**
 * 生成 BPF Loader 的 SetAuthority 指令
 * 用于将程序升级权限从多签转回个人钱包
 */

import { PublicKey } from "@solana/web3.js";
import * as bs58 from "bs58";

const PROGRAM_ID = new PublicKey("BE6yuzEjzapwBEQ9RoAFzG72XZzb17JuWWqhecFHdEQa");
const CURRENT_AUTHORITY = new PublicKey("wkxCmw6rzM8xeUNhzPhWtWCwp6VoE4S81ymNDhqMWud"); // 多签
const NEW_AUTHORITY = new PublicKey("8bsJcfGRyFWUEzS4bQfADTVBjReUm3YH89x1QY1qp3gd"); // 你的钱包
const BPF_LOADER = new PublicKey("BPFLoaderUpgradeab1e11111111111111111111111");

// 派生 ProgramData 地址
const [programDataAddress] = PublicKey.findProgramAddressSync(
  [PROGRAM_ID.toBuffer()],
  BPF_LOADER
);

console.log("🔧 生成 SetAuthority 指令 - 转移升级权限\n");

console.log("📋 地址信息:");
console.log("  Program ID:", PROGRAM_ID.toString());
console.log("  Program Data:", programDataAddress.toString());
console.log("  当前权限 (多签):", CURRENT_AUTHORITY.toString());
console.log("  新权限 (你的钱包):", NEW_AUTHORITY.toString());
console.log("");

// SetAuthority 指令格式:
// [discriminator: u32 = 4, new_authority: Option<Pubkey>]
// discriminator = 4 (SetAuthority)
// new_authority = Some(pubkey) = [1, ...32 bytes pubkey]

const instructionData = Buffer.alloc(37);
instructionData.writeUInt32LE(4, 0); // SetAuthority discriminator
instructionData.writeUInt8(1, 4); // Option::Some
NEW_AUTHORITY.toBuffer().copy(instructionData, 5); // 32 bytes pubkey

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

console.log("=== Accounts (按顺序添加 2 个账户) ===\n");

console.log("Account 1 - Program Data Account:");
console.log("  Address:", programDataAddress.toString());
console.log("  Signer: ❌ NO");
console.log("  Writable: ✅ YES");
console.log("");

console.log("Account 2 - Current Authority (多签):");
console.log("  Address:", CURRENT_AUTHORITY.toString());
console.log("  Signer: ✅ YES");
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
console.log("Account 2:", CURRENT_AUTHORITY.toString(), "[Signer]");
console.log("");

console.log("✅ 配置完成！");
console.log("");
console.log("🎯 下一步:");
console.log("1. 在 Squads UI 创建 Custom Instruction");
console.log("2. 填写上面的信息");
console.log("3. 创建提案并投票");
console.log("4. 执行后，升级权限会转到你的钱包");
console.log("5. 然后用命令行升级程序");
console.log("6. 最后再转回多签");
