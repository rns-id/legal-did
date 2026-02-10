import { PublicKey, Transaction, Message } from "@solana/web3.js";

// 从 URL 解析的 base64 消息
const messageBase64 =
  "AQACA3Dwb0AhRhrq6Imd2FtMFXq8slYYsuaNSPf4nyH0MsTal/AuzYCu930nikccOrK5Du683Uz/vxmWfQQN1FotAMsDBkZv5SEXMv/srbpyw5vnvIzlu8X3EmssQ5s6QAAAAK0tgKO/buOPVmVsaWF0Ztt2QUO9AGmJia+AF0pTo3JGAgIABQLAXBUAAQAA";

const buffer = Buffer.from(messageBase64, "base64");

console.log("\n=== 交易消息详细分析 ===\n");
console.log("消息长度:", buffer.length, "bytes");

let offset = 0;

// 1. 签名数量
const numSignatures = buffer[offset];
console.log("\n1. 签名数量:", numSignatures);
offset += 1;

// 跳过签名占位符
offset += numSignatures * 64;

// 2. 消息头
const numRequiredSignatures = buffer[offset];
const numReadonlySignedAccounts = buffer[offset + 1];
const numReadonlyUnsignedAccounts = buffer[offset + 2];
console.log("\n2. 消息头:");
console.log("   - Required Signatures:", numRequiredSignatures);
console.log("   - Readonly Signed:", numReadonlySignedAccounts);
console.log("   - Readonly Unsigned:", numReadonlyUnsignedAccounts);
offset += 3;

// 3. 账户数量
const numAccounts = buffer[offset];
console.log("\n3. 账户数量:", numAccounts);
offset += 1;

// 4. 读取所有账户
const accounts: string[] = [];
console.log("\n4. 账户列表:");
for (let i = 0; i < numAccounts; i++) {
  const pubkey = new PublicKey(buffer.slice(offset, offset + 32));
  accounts.push(pubkey.toBase58());
  console.log(`   [${i}] ${pubkey.toBase58()}`);
  offset += 32;
}

// 5. Recent Blockhash
const recentBlockhash = new PublicKey(buffer.slice(offset, offset + 32));
console.log("\n5. Recent Blockhash:", recentBlockhash.toBase58());
offset += 32;

// 6. 指令数量
const numInstructions = buffer[offset];
console.log("\n6. 指令数量:", numInstructions);
offset += 1;

// 7. 解析指令
console.log("\n7. 指令详情:");
for (let i = 0; i < numInstructions; i++) {
  const programIdIndex = buffer[offset];
  offset += 1;

  const numAccountIndices = buffer[offset];
  offset += 1;

  const accountIndices: number[] = [];
  for (let j = 0; j < numAccountIndices; j++) {
    accountIndices.push(buffer[offset]);
    offset += 1;
  }

  const dataLength = buffer[offset];
  offset += 1;

  const data = buffer.slice(offset, offset + dataLength);
  offset += dataLength;

  console.log(`\n   指令 ${i + 1}:`);
  console.log(`   - Program: [${programIdIndex}] ${accounts[programIdIndex]}`);
  console.log(`   - 账户索引: ${accountIndices.join(", ")}`);
  console.log(`   - 账户映射:`);
  accountIndices.forEach((idx) => {
    console.log(`     [${idx}] → ${accounts[idx]}`);
  });
  console.log(`   - 数据长度: ${dataLength} bytes`);
  console.log(`   - 数据 (hex): ${data.toString("hex")}`);
  console.log(`   - 数据 (base64): ${data.toString("base64")}`);
}

console.log("\n=== 分析结果 ===\n");

console.log("✅ 交易层面的账户（3个）:");
console.log("   [0] Fee Payer + Signer");
console.log("   [1] Authority (Squads vault)");
console.log("   [2] Project PDA");

console.log("\n❓ 指令层面的账户:");
console.log("   需要检查指令的 accountIndices");
console.log("   如果 accountIndices 包含 [0, 1, 2]，那就是 3 个账户 ❌");
console.log("   如果 accountIndices 包含 [1, 2]，那就是 2 个账户 ✅");

console.log("\n🔍 问题诊断:");
console.log("   如果指令收到了 3 个账户索引，说明 Squads 错误地");
console.log("   将 fee payer 也包含在了指令账户中。");
