/**
 * 解码交易中的指令数据
 */

const instructionData = Buffer.from([231, 173, 49, 91, 235, 24, 68, 19, 9, 0, 0, 0, 0, 1, 2, 3, 4, 5, 6, 7, 8]);

console.log("🔍 解码指令数据\n");

console.log("完整数据 (hex):", instructionData.toString('hex'));
console.log("完整数据 (bytes):", Array.from(instructionData));
console.log("长度:", instructionData.length, "bytes");
console.log("");

// 前 8 bytes 可能是 Squads 的 discriminator
const squadsDiscriminator = instructionData.slice(0, 8);
console.log("前 8 bytes (可能是 Squads discriminator):");
console.log("  Hex:", squadsDiscriminator.toString('hex'));
console.log("  Bytes:", Array.from(squadsDiscriminator));
console.log("");

// 接下来 4 bytes 可能是指令索引
const instructionIndex = instructionData.readUInt32LE(8);
console.log("Bytes 8-11 (可能是指令索引):", instructionIndex);
console.log("");

// 剩余的 bytes
const remaining = instructionData.slice(12);
console.log("剩余数据 (bytes 12+):");
console.log("  Hex:", remaining.toString('hex'));
console.log("  Bytes:", Array.from(remaining));
console.log("  可能是账户索引:", Array.from(remaining));
console.log("");

console.log("❌ 问题:");
console.log("  Squads 传递给 BPF Loader 的数据不是原始的升级指令数据");
console.log("  应该是: [3, 0, 0, 0]");
console.log("  实际是:", Array.from(instructionData));
console.log("");

console.log("💡 这说明:");
console.log("  Squads 在包装指令时添加了自己的元数据");
console.log("  BPF Loader 无法识别这个格式");
console.log("  这是 Squads 的 bug 或者我们使用方式不对");
