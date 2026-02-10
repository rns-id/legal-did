import * as anchor from "@coral-xyz/anchor";
import { Program, AnchorProvider } from "@coral-xyz/anchor";
import { Connection, PublicKey, Keypair, Transaction } from "@solana/web3.js";
import * as crypto from "crypto";

// 计算指令 discriminator
function getDiscriminator(name: string): Buffer {
  const hash = crypto.createHash("sha256");
  hash.update(`global:${name}`);
  return Buffer.from(hash.digest().slice(0, 8));
}

async function main() {
  console.log("\n=== 本地测试 removeOperator 指令 ===\n");

  // 连接到 devnet
  const connection = new Connection("https://api.devnet.solana.com", "confirmed");

  const programId = new PublicKey("BE6yuzEjzapwBEQ9RoAFzG72XZzb17JuWWqhecFHdEQa");
  const authority = new PublicKey("wkxCmw6rzM8xeUNhzPhWtWCwp6VoE4S81ymNDhqMWud");
  const projectPda = new PublicKey("GLdsotriCs2HcxoSNcqA3pp35QuKZi3PGuKQcdiUzP5o");
  const operatorToRemove = new PublicKey("GwZXPRhkXF3iMQ3CKpvzqLukBC9bMZ1qfYW4kKF8FzRo");

  console.log("Program ID:", programId.toBase58());
  console.log("Authority:", authority.toBase58());
  console.log("Project PDA:", projectPda.toBase58());
  console.log("Operator to remove:", operatorToRemove.toBase58());

  // 构建指令数据
  const discriminator = getDiscriminator("remove_operator");
  const data = Buffer.concat([discriminator, operatorToRemove.toBuffer()]);

  console.log("\n指令数据:");
  console.log("  Discriminator:", discriminator.toString("hex"));
  console.log("  Full data (hex):", data.toString("hex"));
  console.log("  Full data (base64):", data.toString("base64"));

  // 创建指令
  const instruction = {
    programId,
    keys: [
      { pubkey: authority, isSigner: true, isWritable: true },
      { pubkey: projectPda, isSigner: false, isWritable: true },
    ],
    data,
  };

  console.log("\n指令账户:");
  instruction.keys.forEach((key, i) => {
    console.log(`  [${i}] ${key.pubkey.toBase58()}`);
    console.log(`      Signer: ${key.isSigner}, Writable: ${key.isWritable}`);
  });

  // 创建交易
  const transaction = new Transaction();
  transaction.add(instruction);
  transaction.feePayer = authority; // 使用 authority 作为 fee payer

  // 获取最近的 blockhash
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;

  console.log("\n=== 模拟交易 ===\n");

  try {
    // 模拟交易（不需要签名）
    const simulation = await connection.simulateTransaction(transaction);

    if (simulation.value.err) {
      console.log("❌ 模拟失败:");
      console.log(JSON.stringify(simulation.value.err, null, 2));
      console.log("\nLogs:");
      simulation.value.logs?.forEach((log) => console.log("  ", log));
    } else {
      console.log("✅ 模拟成功!");
      console.log("\nLogs:");
      simulation.value.logs?.forEach((log) => console.log("  ", log));
    }
  } catch (error: any) {
    console.log("❌ 模拟出错:");
    console.log(error.message);
    if (error.logs) {
      console.log("\nLogs:");
      error.logs.forEach((log: string) => console.log("  ", log));
    }
  }

  console.log("\n=== 检查账户状态 ===\n");

  // 检查 Project 账户
  try {
    const projectAccount = await connection.getAccountInfo(projectPda);
    if (projectAccount) {
      console.log("✅ Project 账户存在");
      console.log("  Owner:", projectAccount.owner.toBase58());
      console.log("  Data length:", projectAccount.data.length);
      console.log("  Lamports:", projectAccount.lamports);

      // 解析 authority
      const authorityFromData = new PublicKey(projectAccount.data.slice(8, 40));
      console.log("  Authority (from data):", authorityFromData.toBase58());
      console.log("  Authority matches:", authorityFromData.equals(authority) ? "✅" : "❌");
    } else {
      console.log("❌ Project 账户不存在");
    }
  } catch (error: any) {
    console.log("❌ 获取 Project 账户失败:", error.message);
  }

  // 检查 Program
  try {
    const programAccount = await connection.getAccountInfo(programId);
    if (programAccount) {
      console.log("\n✅ Program 存在");
      console.log("  Owner:", programAccount.owner.toBase58());
      console.log("  Executable:", programAccount.executable);
    } else {
      console.log("\n❌ Program 不存在");
    }
  } catch (error: any) {
    console.log("\n❌ 获取 Program 失败:", error.message);
  }
}

main().catch(console.error);
