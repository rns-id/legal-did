/**
 * 生成正确的 BPF Upgradeable Loader upgrade 指令数据
 */

import * as bs58 from "bs58";

// BPF Upgradeable Loader 的 upgrade 指令
// 指令格式: [discriminator: u32]
// Upgrade 的 discriminator 是 3

// 创建指令数据 (4 bytes, little-endian)
const instructionData = Buffer.alloc(4);
instructionData.writeUInt32LE(3, 0);

console.log("🔧 BPF Upgradeable Loader Upgrade 指令数据\n");

console.log("=== Hex ===");
console.log(instructionData.toString('hex'));
console.log("");

console.log("=== Base58 ===");
console.log(bs58.encode(instructionData));
console.log("");

console.log("=== Bytes (Array) ===");
console.log(Array.from(instructionData));
console.log("");

console.log("=== 验证 ===");
console.log("Discriminator (u32 LE):", instructionData.readUInt32LE(0));
console.log("应该是: 3");
console.log("");

// 也尝试其他可能的格式
console.log("=== 其他可能的格式 ===");

// 只有 1 byte
const singleByte = Buffer.from([3]);
console.log("Single byte (3):", bs58.encode(singleByte));

// 8 bytes (u64)
const eightBytes = Buffer.alloc(8);
eightBytes.writeUInt32LE(3, 0);
console.log("8 bytes (u64 LE):", bs58.encode(eightBytes));

console.log("");
console.log("✅ 在 Squads UI 中使用:");
console.log("Instruction Data (Raw):", bs58.encode(instructionData));
