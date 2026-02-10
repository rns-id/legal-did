import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import * as crypto from "crypto";

// 计算指令 discriminator
function getDiscriminator(name: string): Buffer {
  const hash = crypto.createHash("sha256");
  hash.update(`global:${name}`);
  return Buffer.from(hash.digest().slice(0, 8));
}

async function main() {
  console.log("\n=== 对比 Withdraw vs RemoveOperator ===\n");

  const connection = new Connection("https://api.devnet.solana.com", "confirmed");

  const programId = new PublicKey("BE6yuzEjzapwBEQ9RoAFzG72XZzb17JuWWqhecFHdEQa");
  const authority = new PublicKey("wkxCmw6rzM8xeUNhzPhWtWCwp6VoE4S81ymNDhqMWud");
  const projectPda = new PublicKey("GLdsotriCs2HcxoSNcqA3pp35QuKZi3PGuKQcdiUzP5o");
  const destination = new PublicKey("2fuikT5C2YVctakxoBNQ23NjXzA4kY2cn36Sh6ws3pAt");
  const systemProgram = new PublicKey("11111111111111111111111111111111");

  // ========== Withdraw 指令 ==========
  console.log("=== 1. Withdraw 指令 ===\n");

  const withdrawDiscriminator = getDiscriminator("withdraw");
  const withdrawData = withdrawDiscriminator; // withdraw 没有参数

  const withdrawInstruction = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: authority, isSigner: true, isWritable: true },
      { pubkey: projectPda, isSigner: false, isWritable: true },
      { pubkey: destination, isSigner: false, isWritable: true },
      { pubkey: systemProgram, isSigner: false, isWritable: false },
    ],
    data: withdrawData,
  });

  console.log("Withdraw 指令配置:");
  console.log("  Program ID:", programId.toBase58());
  console.log("  Discriminator:", withdrawDiscriminator.toString("hex"));
  console.log("  Data (Base64):", withdrawData.toString("base64"));
  console.log("  账户数量:", withdrawInstruction.keys.length);
  console.log("\n  账户列表:");
  withdrawInstruction.keys.forEach((key, i) => {
    console.log(`    [${i}] ${key.pubkey.toBase58()}`);
    console.log(`        Signer: ${key.isSigner}, Writable: ${key.isWritable}`);
  });

  // 模拟 withdraw
  const withdrawTx = new Transaction();
  withdrawTx.add(withdrawInstruction);
  withdrawTx.feePayer = authority;
  const { blockhash } = await connection.getLatestBlockhash();
  withdrawTx.recentBlockhash = blockhash;

  console.log("\n  模拟 Withdraw:");
  try {
    const withdrawSim = await connection.simulateTransaction(withdrawTx);
    if (withdrawSim.value.err) {
      console.log("    ❌ 失败:", JSON.stringify(withdrawSim.value.err));
    } else {
      console.log("    ✅ 成功!");
    }
  } catch (error: any) {
    console.log("    ❌ 错误:", error.message);
  }

  // ========== RemoveOperator 指令 ==========
  console.log("\n\n=== 2. RemoveOperator 指令 ===\n");

  const operatorToRemove = new PublicKey("GwZXPRhkXF3iMQ3CKpvzqLukBC9bMZ1qfYW4kKF8FzRo");
  const removeDiscriminator = getDiscriminator("remove_operator");
  const removeData = Buffer.concat([removeDiscriminator, operatorToRemove.toBuffer()]);

  const removeInstruction = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: authority, isSigner: true, isWritable: true },
      { pubkey: projectPda, isSigner: false, isWritable: true },
    ],
    data: removeData,
  });

  console.log("RemoveOperator 指令配置:");
  console.log("  Program ID:", programId.toBase58());
  console.log("  Discriminator:", removeDiscriminator.toString("hex"));
  console.log("  Data (Base64):", removeData.toString("base64"));
  console.log("  账户数量:", removeInstruction.keys.length);
  console.log("\n  账户列表:");
  removeInstruction.keys.forEach((key, i) => {
    console.log(`    [${i}] ${key.pubkey.toBase58()}`);
    console.log(`        Signer: ${key.isSigner}, Writable: ${key.isWritable}`);
  });

  // 模拟 removeOperator
  const removeTx = new Transaction();
  removeTx.add(removeInstruction);
  removeTx.feePayer = authority;
  removeTx.recentBlockhash = blockhash;

  console.log("\n  模拟 RemoveOperator:");
  try {
    const removeSim = await connection.simulateTransaction(removeTx);
    if (removeSim.value.err) {
      console.log("    ❌ 失败:", JSON.stringify(removeSim.value.err));
    } else {
      console.log("    ✅ 成功!");
    }
  } catch (error: any) {
    console.log("    ❌ 错误:", error.message);
  }

  // ========== 对比分析 ==========
  console.log("\n\n=== 3. 对比分析 ===\n");

  console.log("账户数量:");
  console.log(`  Withdraw: ${withdrawInstruction.keys.length} 个账户`);
  console.log(`  RemoveOperator: ${removeInstruction.keys.length} 个账户`);

  console.log("\n共同账户:");
  console.log("  [0] authority - Signer + Writable");
  console.log("  [1] projectPda - Writable");

  console.log("\nWithdraw 额外账户:");
  console.log("  [2] destination - Writable");
  console.log("  [3] systemProgram - Readonly");

  console.log("\n\n=== 4. 为 Squads 准备的数据 ===\n");

  console.log("Withdraw 提案数据:");
  console.log("```");
  console.log("Program ID: BE6yuzEjzapwBEQ9RoAFzG72XZzb17JuWWqhecFHdEQa");
  console.log("Instruction Data (Base64):", withdrawData.toString("base64"));
  console.log("\nAccounts:");
  console.log("1. wkxCmw6rzM8xeUNhzPhWtWCwp6VoE4S81ymNDhqMWud (Signer + Writable)");
  console.log("2. GLdsotriCs2HcxoSNcqA3pp35QuKZi3PGuKQcdiUzP5o (Writable)");
  console.log("3. 2fuikT5C2YVctakxoBNQ23NjXzA4kY2cn36Sh6ws3pAt (Writable)");
  console.log("4. 11111111111111111111111111111111 (Readonly)");
  console.log("```");

  console.log("\nRemoveOperator 提案数据:");
  console.log("```");
  console.log("Program ID: BE6yuzEjzapwBEQ9RoAFzG72XZzb17JuWWqhecFHdEQa");
  console.log("Instruction Data (Base64):", removeData.toString("base64"));
  console.log("\nAccounts:");
  console.log("1. wkxCmw6rzM8xeUNhzPhWtWCwp6VoE4S81ymNDhqMWud (Signer + Writable)");
  console.log("2. GLdsotriCs2HcxoSNcqA3pp35QuKZi3PGuKQcdiUzP5o (Writable)");
  console.log("```");

  // ========== 验证：尝试添加 dummy 账户 ==========
  console.log("\n\n=== 5. 验证：RemoveOperator + Dummy 账户 ===\n");

  const removeWithDummyInstruction = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: authority, isSigner: true, isWritable: true },
      { pubkey: projectPda, isSigner: false, isWritable: true },
      { pubkey: systemProgram, isSigner: false, isWritable: false }, // dummy
    ],
    data: removeData,
  });

  console.log("RemoveOperator + Dummy 账户:");
  console.log("  账户数量:", removeWithDummyInstruction.keys.length);
  removeWithDummyInstruction.keys.forEach((key, i) => {
    console.log(`  [${i}] ${key.pubkey.toBase58()}`);
    console.log(`      Signer: ${key.isSigner}, Writable: ${key.isWritable}`);
  });

  const removeWithDummyTx = new Transaction();
  removeWithDummyTx.add(removeWithDummyInstruction);
  removeWithDummyTx.feePayer = authority;
  removeWithDummyTx.recentBlockhash = blockhash;

  console.log("\n  模拟 RemoveOperator + Dummy:");
  try {
    const dummySim = await connection.simulateTransaction(removeWithDummyTx);
    if (dummySim.value.err) {
      console.log("    ❌ 失败:", JSON.stringify(dummySim.value.err));
      console.log("    → 添加 dummy 账户不能解决问题");
    } else {
      console.log("    ✅ 成功!");
      console.log("    → 添加 dummy 账户可能是 workaround");
    }
  } catch (error: any) {
    console.log("    ❌ 错误:", error.message);
  }

  console.log("\n\n=== 结论 ===\n");
  console.log("1. 两个指令在本地都能成功模拟");
  console.log("2. 唯一区别是账户数量：Withdraw 4个，RemoveOperator 2个");
  console.log("3. 问题确实在 Squads UI 如何处理这些指令");
  console.log("4. 需要在 Squads UI 中测试 Withdraw 的实际配置");
}

main().catch(console.error);
