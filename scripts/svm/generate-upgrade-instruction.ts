/**
 * 生成程序升级指令数据
 */

import { PublicKey, TransactionInstruction } from "@solana/web3.js";
import * as bs58 from "bs58";

// 地址
const PROGRAM_ID = new PublicKey("BE6yuzEjzapwBEQ9RoAFzG72XZzb17JuWWqhecFHdEQa");
const BUFFER = new PublicKey("Bq7wFsrV81bsXAZpCUtT9izMj4f616SuNYJiLb8FWeBh");
const SPILL_ACCOUNT = new PublicKey("8bsJcfGRyFWUEzS4bQfADTVBjReUm3YH89x1QY1qp3gd");
const UPGRADE_AUTHORITY = new PublicKey("wkxCmw6rzM8xeUNhzPhWtWCwp6VoE4S81ymNDhqMWud");
const BPF_UPGRADEABLE_LOADER = new PublicKey("BPFLoaderUpgradeab1e11111111111111111111111");

// 派生 ProgramData 地址
const [programDataAddress] = PublicKey.findProgramAddressSync(
  [PROGRAM_ID.toBuffer()],
  BPF_UPGRADEABLE_LOADER
);

console.log("🔧 程序升级指令数据\n");

console.log("📋 地址信息:");
console.log("  Program ID:", PROGRAM_ID.toString());
console.log("  Program Data:", programDataAddress.toString());
console.log("  Buffer:", BUFFER.toString());
console.log("  Spill Account:", SPILL_ACCOUNT.toString());
console.log("  Upgrade Authority:", UPGRADE_AUTHORITY.toString());
console.log("  BPF Loader:", BPF_UPGRADEABLE_LOADER.toString());
console.log("");

// Upgrade 指令的 discriminator 是 3
const instructionData = Buffer.from([3, 0, 0, 0]);

console.log("📝 Squads UI 填写指南:\n");

console.log("=== Program ID ===");
console.log(BPF_UPGRADEABLE_LOADER.toString());
console.log("");

console.log("=== Instruction Data (Base58) ===");
console.log(bs58.encode(instructionData));
console.log("");

console.log("=== Accounts (按顺序添加 5 个账户) ===\n");

console.log("Account 1 - Program Data Account:");
console.log("  Address:", programDataAddress.toString());
console.log("  Signer: ❌ NO");
console.log("  Writable: ✅ YES");
console.log("");

console.log("Account 2 - Program Account:");
console.log("  Address:", PROGRAM_ID.toString());
console.log("  Signer: ❌ NO");
console.log("  Writable: ✅ YES");
console.log("");

console.log("Account 3 - Buffer Account:");
console.log("  Address:", BUFFER.toString());
console.log("  Signer: ❌ NO");
console.log("  Writable: ✅ YES");
console.log("");

console.log("Account 4 - Spill Account:");
console.log("  Address:", SPILL_ACCOUNT.toString());
console.log("  Signer: ❌ NO");
console.log("  Writable: ✅ YES");
console.log("");

console.log("Account 5 - Upgrade Authority:");
console.log("  Address:", UPGRADE_AUTHORITY.toString());
console.log("  Signer: ✅ YES");
console.log("  Writable: ❌ NO");
console.log("");

console.log("=== 完整的 Base58 指令数据 ===");
console.log(bs58.encode(instructionData));
console.log("");

// 创建完整的指令用于验证
const instruction = new TransactionInstruction({
  programId: BPF_UPGRADEABLE_LOADER,
  keys: [
    { pubkey: programDataAddress, isSigner: false, isWritable: true },
    { pubkey: PROGRAM_ID, isSigner: false, isWritable: true },
    { pubkey: BUFFER, isSigner: false, isWritable: true },
    { pubkey: SPILL_ACCOUNT, isSigner: false, isWritable: true },
    { pubkey: UPGRADE_AUTHORITY, isSigner: true, isWritable: false },
    { pubkey: new PublicKey("SysvarRent111111111111111111111111111111111"), isSigner: false, isWritable: false },
    { pubkey: new PublicKey("SysvarC1ock11111111111111111111111111111111"), isSigner: false, isWritable: false },
  ],
  data: instructionData,
});

console.log("✅ 指令创建成功！");
console.log("");
console.log("🎯 下一步:");
console.log("1. 在 Squads UI 填写上面的信息");
console.log("2. 点击 'Save draft'");
console.log("3. 点击 'Initiate Transaction'");
console.log("4. 投票并执行");
