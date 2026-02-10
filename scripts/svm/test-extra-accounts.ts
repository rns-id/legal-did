import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import * as crypto from "crypto";

function getDiscriminator(name: string): Buffer {
  const hash = crypto.createHash("sha256");
  hash.update(`global:${name}`);
  return Buffer.from(hash.digest().slice(0, 8));
}

async function main() {
  console.log("\n=== 测试：传入多余账户会不会报错 ===\n");

  const connection = new Connection("https://api.devnet.solana.com", "confirmed");

  const programId = new PublicKey("BE6yuzEjzapwBEQ9RoAFzG72XZzb17JuWWqhecFHdEQa");
  const authority = new PublicKey("wkxCmw6rzM8xeUNhzPhWtWCwp6VoE4S81ymNDhqMWud");
  const projectPda = new PublicKey("GLdsotriCs2HcxoSNcqA3pp35QuKZi3PGuKQcdiUzP5o");
  const operatorToRemove = new PublicKey("GwZXPRhkXF3iMQ3CKpvzqLukBC9bMZ1qfYW4kKF8FzRo");
  const systemProgram = new PublicKey("11111111111111111111111111111111");

  const discriminator = getDiscriminator("remove_operator");
  const data = Buffer.concat([discriminator, operatorToRemove.toBuffer()]);

  // 测试 1: 只传 2 个账户（正确的）
  console.log("测试 1: 传入 2 个账户（合约需要的）");
  const instruction2 = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: authority, isSigner: true, isWritable: true },
      { pubkey: projectPda, isSigner: false, isWritable: true },
    ],
    data,
  });

  const tx2 = new Transaction().add(instruction2);
  tx2.feePayer = authority;
  try {
    const { blockhash } = await connection.getLatestBlockhash();
    tx2.recentBlockhash = blockhash;
    const sim2 = await connection.simulateTransaction(tx2);
    if (sim2.value.err) {
      console.log("  ❌ 失败:", JSON.stringify(sim2.value.err));
    } else {
      console.log("  ✅ 成功!");
    }
  } catch (error: any) {
    console.log("  ❌ 错误:", error.message);
  }

  // 测试 2: 传 3 个账户（多一个 dummy）
  console.log("\n测试 2: 传入 3 个账户（多一个 System Program）");
  const instruction3 = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: authority, isSigner: true, isWritable: true },
      { pubkey: projectPda, isSigner: false, isWritable: true },
      { pubkey: systemProgram, isSigner: false, isWritable: false }, // ← Dummy
    ],
    data,
  });

  const tx3 = new Transaction().add(instruction3);
  tx3.feePayer = authority;
  try {
    const { blockhash } = await connection.getLatestBlockhash();
    tx3.recentBlockhash = blockhash;
    const sim3 = await connection.simulateTransaction(tx3);
    if (sim3.value.err) {
      console.log("  ❌ 失败:", JSON.stringify(sim3.value.err));
    } else {
      console.log("  ✅ 成功!");
    }
  } catch (error: any) {
    console.log("  ❌ 错误:", error.message);
  }

  // 测试 3: 传 4 个账户（多两个 dummy）
  console.log("\n测试 3: 传入 4 个账户（多两个 dummy）");
  const instruction4 = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: authority, isSigner: true, isWritable: true },
      { pubkey: projectPda, isSigner: false, isWritable: true },
      { pubkey: systemProgram, isSigner: false, isWritable: false }, // ← Dummy 1
      { pubkey: systemProgram, isSigner: false, isWritable: false }, // ← Dummy 2
    ],
    data,
  });

  const tx4 = new Transaction().add(instruction4);
  tx4.feePayer = authority;
  try {
    const { blockhash } = await connection.getLatestBlockhash();
    tx4.recentBlockhash = blockhash;
    const sim4 = await connection.simulateTransaction(tx4);
    if (sim4.value.err) {
      console.log("  ❌ 失败:", JSON.stringify(sim4.value.err));
    } else {
      console.log("  ✅ 成功!");
    }
  } catch (error: any) {
    console.log("  ❌ 错误:", error.message);
  }

  console.log("\n=== 结论 ===");
  console.log("Solana 允许传入多余的账户，合约会忽略它们。");
  console.log("所以添加 dummy 账户不会导致 '账户数量不对' 的错误。");
}

main().catch(console.error);
