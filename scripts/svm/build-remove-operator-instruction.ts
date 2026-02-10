import * as anchor from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import * as crypto from "crypto";

// 手动计算指令 discriminator
function getInstructionDiscriminator(instructionName: string): Buffer {
  const hash = crypto.createHash("sha256");
  hash.update(`global:${instructionName}`);
  return Buffer.from(hash.digest().slice(0, 8));
}

async function main() {
  console.log("\n=== 构建 removeOperator 指令 ===\n");

  // 指令 discriminator
  const discriminator = getInstructionDiscriminator("remove_operator");
  console.log("Discriminator (hex):", discriminator.toString("hex"));
  console.log("Discriminator (base64):", discriminator.toString("base64"));

  // 要删除的 operator
  const operatorToRemove = new PublicKey(
    "GwZXPRhkXF3iMQ3CKpvzqLukBC9bMZ1qfYW4kKF8FzRo"
  );

  // 构建完整的指令数据
  const instructionData = Buffer.concat([
    discriminator,
    operatorToRemove.toBuffer(),
  ]);

  console.log("\n=== 完整指令数据 ===");
  console.log("Hex:", instructionData.toString("hex"));
  console.log("Base64:", instructionData.toString("base64"));
  console.log("长度:", instructionData.length, "bytes");

  console.log("\n=== Squads TX Builder 配置 ===\n");
  console.log("Program ID:");
  console.log("  BE6yuzEjzapwBEQ9RoAFzG72XZzb17JuWWqhecFHdEQa");
  console.log("\nProgram Name:");
  console.log("  legaldid");
  console.log("\nChosen Instruction:");
  console.log("  removeOperator");
  console.log("\n账户配置（按顺序）:");
  console.log("\n1. authority");
  console.log("   Address: wkxCmw6rzM8xeUNhzPhWtWCwp6VoE4S81ymNDhqMWud");
  console.log("   ☑ Signer");
  console.log("   ☑ Writable");
  console.log("\n2. nonTransferableProject");
  console.log("   Address: GLdsotriCs2HcxoSNcqA3pp35QuKZi3PGuKQcdiUzP5o");
  console.log("   ☐ Signer");
  console.log("   ☑ Writable");
  console.log("\nArgs:");
  console.log("  operator: GwZXPRhkXF3iMQ3CKpvzqLukBC9bMZ1qfYW4kKF8FzRo");

  console.log("\n=== 重要提示 ===");
  console.log("❌ 不要添加第三个账户！");
  console.log("✅ removeOperator 只需要 2 个账户");
  console.log("✅ 如果 Squads 自动添加了其他账户，请删除");
}

main().catch(console.error);
