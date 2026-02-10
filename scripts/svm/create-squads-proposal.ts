import Squads from "@sqds/sdk";
import {
  Connection,
  PublicKey,
  TransactionInstruction,
  Keypair,
} from "@solana/web3.js";
import * as crypto from "crypto";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

// 计算指令 discriminator
function getDiscriminator(name: string): Buffer {
  const hash = crypto.createHash("sha256");
  hash.update(`global:${name}`);
  return Buffer.from(hash.digest().slice(0, 8));
}

async function main() {
  console.log("\n=== 使用 Squads SDK 创建提案 ===\n");

  // 连接到 devnet
  const connection = new Connection("https://api.devnet.solana.com", "confirmed");

  // 加载钱包
  const keypairPath = path.join(os.homedir(), ".config/solana/id.json");
  console.log("加载钱包:", keypairPath);

  if (!fs.existsSync(keypairPath)) {
    console.error("❌ 钱包文件不存在:", keypairPath);
    console.error("请确保你有 Solana 钱包配置");
    process.exit(1);
  }

  const keypairData = JSON.parse(fs.readFileSync(keypairPath, "utf-8"));
  const wallet = Keypair.fromSecretKey(new Uint8Array(keypairData));
  console.log("钱包地址:", wallet.publicKey.toBase58());

  // 检查余额
  const balance = await connection.getBalance(wallet.publicKey);
  console.log("钱包余额:", balance / 1e9, "SOL");

  if (balance < 0.01 * 1e9) {
    console.warn("⚠️ 余额较低，可能不足以支付交易费用");
  }

  // Squads 多签地址
  const multisigPda = new PublicKey("wkxCmw6rzM8xeUNhzPhWtWCwp6VoE4S81ymNDhqMWud");
  console.log("\n多签地址:", multisigPda.toBase58());

  // 构建 removeOperator 指令
  const programId = new PublicKey("BE6yuzEjzapwBEQ9RoAFzG72XZzb17JuWWqhecFHdEQa");
  const projectPda = new PublicKey("GLdsotriCs2HcxoSNcqA3pp35QuKZi3PGuKQcdiUzP5o");
  const operatorToRemove = new PublicKey("GwZXPRhkXF3iMQ3CKpvzqLukBC9bMZ1qfYW4kKF8FzRo");

  const discriminator = getDiscriminator("remove_operator");
  const data = Buffer.concat([discriminator, operatorToRemove.toBuffer()]);

  const instruction = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: multisigPda, isSigner: true, isWritable: true },
      { pubkey: projectPda, isSigner: false, isWritable: true },
    ],
    data,
  });

  console.log("\n指令详情:");
  console.log("  Program:", programId.toBase58());
  console.log("  Operator to remove:", operatorToRemove.toBase58());
  console.log("  Instruction data:", data.toString("base64"));

  console.log("\n账户:");
  instruction.keys.forEach((key, i) => {
    console.log(`  [${i}] ${key.pubkey.toBase58()}`);
    console.log(`      Signer: ${key.isSigner}, Writable: ${key.isWritable}`);
  });

  // 初始化 Squads SDK
  console.log("\n初始化 Squads SDK...");
  const squads = Squads.devnet(wallet);

  try {
    console.log("\n创建提案...");

    // 创建交易提案
    const createResult = await squads.createTransaction(multisigPda, 1); // 1 = authorityIndex

    console.log("✅ 交易已创建!");
    console.log("  Transaction PDA:", createResult.transactionPda.toBase58());

    // 添加指令到交易
    console.log("\n添加指令到交易...");
    const addResult = await squads.addInstruction(
      createResult.transactionPda,
      instruction
    );

    console.log("✅ 指令已添加!");

    // 激活提案
    console.log("\n激活提案...");
    const activateResult = await squads.activateTransaction(
      createResult.transactionPda
    );

    console.log("✅ 提案已激活!");

    // 自动投票（如果你是成员）
    console.log("\n尝试投票...");
    try {
      const voteResult = await squads.approveTransaction(
        createResult.transactionPda
      );
      console.log("✅ 已投赞成票!");
    } catch (error: any) {
      console.log("⚠️ 投票失败（可能你不是多签成员）:", error.message);
    }

    console.log("\n=== 提案创建成功！===");
    console.log("\n下一步:");
    console.log("1. 访问 Squads 界面: https://devnet.squads.so/");
    console.log("2. 找到你的多签: wkxCmw6rzM8xeUNhzPhWtWCwp6VoE4S81ymNDhqMWud");
    console.log("3. 查看新创建的提案");
    console.log("4. 多签成员投票");
    console.log("5. 达到阈值后执行");

    console.log("\n提案详情:");
    console.log("  Transaction PDA:", createResult.transactionPda.toBase58());
    console.log(
      "  浏览器:",
      `https://explorer.solana.com/address/${createResult.transactionPda.toBase58()}?cluster=devnet`
    );
  } catch (error: any) {
    console.error("\n❌ 创建提案失败:");
    console.error(error.message);
    if (error.logs) {
      console.error("\nLogs:");
      error.logs.forEach((log: string) => console.error("  ", log));
    }
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("❌ 错误:", error);
  process.exit(1);
});
