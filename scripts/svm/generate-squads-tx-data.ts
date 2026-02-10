import { PublicKey, TransactionInstruction } from "@solana/web3.js";
import * as crypto from "crypto";
import * as fs from "fs";

// 计算指令 discriminator
function getDiscriminator(name: string): Buffer {
  const hash = crypto.createHash("sha256");
  hash.update(`global:${name}`);
  return Buffer.from(hash.digest().slice(0, 8));
}

async function main() {
  console.log("\n=== 生成 Squads 提案数据 ===\n");

  const programId = new PublicKey("BE6yuzEjzapwBEQ9RoAFzG72XZzb17JuWWqhecFHdEQa");
  const authority = new PublicKey("wkxCmw6rzM8xeUNhzPhWtWCwp6VoE4S81ymNDhqMWud");
  const projectPda = new PublicKey("GLdsotriCs2HcxoSNcqA3pp35QuKZi3PGuKQcdiUzP5o");
  const operatorToRemove = new PublicKey("GwZXPRhkXF3iMQ3CKpvzqLukBC9bMZ1qfYW4kKF8FzRo");

  // 构建指令数据
  const discriminator = getDiscriminator("remove_operator");
  const data = Buffer.concat([discriminator, operatorToRemove.toBuffer()]);

  // 创建指令
  const instruction = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: authority, isSigner: true, isWritable: true },
      { pubkey: projectPda, isSigner: false, isWritable: true },
    ],
    data,
  });

  console.log("=== 指令详情 ===\n");
  console.log("Program ID:");
  console.log(programId.toBase58());
  console.log("\nInstruction Data (Base64):");
  console.log(data.toString("base64"));
  console.log("\nInstruction Data (Hex):");
  console.log(data.toString("hex"));
  console.log("\n账户列表:");
  instruction.keys.forEach((key, i) => {
    console.log(`\n${i + 1}. ${key.pubkey.toBase58()}`);
    console.log(`   Signer: ${key.isSigner ? "Yes" : "No"}`);
    console.log(`   Writable: ${key.isWritable ? "Yes" : "No"}`);
  });

  // 保存为 JSON
  const output = {
    programId: programId.toBase58(),
    instructionData: {
      base64: data.toString("base64"),
      hex: data.toString("hex"),
    },
    accounts: instruction.keys.map((key, i) => ({
      index: i + 1,
      pubkey: key.pubkey.toBase58(),
      isSigner: key.isSigner,
      isWritable: key.isWritable,
    })),
    metadata: {
      title: "Remove Operator",
      description: `Remove operator ${operatorToRemove.toBase58()} from the project`,
      operatorToRemove: operatorToRemove.toBase58(),
    },
  };

  const filename = "squads-remove-operator-proposal.json";
  fs.writeFileSync(filename, JSON.stringify(output, null, 2));

  console.log(`\n\n✅ 数据已保存到: ${filename}`);

  console.log("\n\n=== 下一步操作 ===\n");
  console.log("方法 1: 在 Squads UI 中手动创建提案");
  console.log("  1. 访问: https://devnet.squads.so/");
  console.log("  2. 选择你的多签");
  console.log("  3. 创建新提案 → Raw Transaction");
  console.log("  4. 复制上面的数据填入");
  console.log("");
  console.log("方法 2: 联系 Squads 支持");
  console.log("  - Discord: https://discord.gg/squads");
  console.log("  - 说明 UI 有 bug，提供这个数据");
  console.log("");
  console.log("方法 3: 等待 Squads 修复 UI bug");
  console.log("  - 本地测试已经成功");
  console.log("  - 问题在 Squads UI，不在你的配置");
}

main().catch(console.error);
