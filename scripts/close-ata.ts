import { web3 } from "@coral-xyz/anchor";
import { createCloseAccountInstruction, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import bs58 from "bs58";

const { Connection, PublicKey, Keypair, Transaction, sendAndConfirmTransaction } = web3;

const RPC_URL = "https://api.devnet.solana.com";

// 用户私钥
const USER_PRIVATE_KEY = "ry95ekWNAHr31ERcMWvkrZruzswgDGoZW41bEPRmmz4HHFBtPuVpLTNqVao697L6Q7HuLDybBxe49u5gRRmcdYE";

// 要关闭的 ATA
const ATA_ADDRESS = new PublicKey("HtkUwMKr6DQWTtVr553SgEXc1rGhsDFN4UKbKt6kdhK3");

async function main() {
  console.log("========================================");
  console.log("关闭 Token Account 回收租金");
  console.log("========================================\n");

  // 解析用户私钥
  const userWallet = Keypair.fromSecretKey(bs58.decode(USER_PRIVATE_KEY));
  console.log("用户钱包:", userWallet.publicKey.toBase58());
  console.log("ATA 地址:", ATA_ADDRESS.toBase58());

  const connection = new Connection(RPC_URL, "confirmed");

  // 检查 ATA 状态
  const ataInfo = await connection.getAccountInfo(ATA_ADDRESS);
  if (!ataInfo) {
    console.log("\n❌ ATA 不存在");
    return;
  }

  const rentLamports = ataInfo.lamports;
  console.log(`\nATA 租金: ${rentLamports} lamports (${rentLamports / 1e9} SOL)`);

  // 获取用户当前余额
  const balanceBefore = await connection.getBalance(userWallet.publicKey);
  console.log(`用户余额 (关闭前): ${balanceBefore / 1e9} SOL`);

  // 创建关闭 ATA 指令
  const closeIx = createCloseAccountInstruction(
    ATA_ADDRESS,
    userWallet.publicKey, // 租金接收者
    userWallet.publicKey, // owner
    [],
    TOKEN_2022_PROGRAM_ID
  );

  const tx = new Transaction().add(closeIx);

  console.log("\n正在关闭 ATA...");

  try {
    const sig = await sendAndConfirmTransaction(connection, tx, [userWallet]);
    console.log("\n✅ ATA 关闭成功！");
    console.log("交易签名:", sig);

    // 获取用户新余额
    const balanceAfter = await connection.getBalance(userWallet.publicKey);
    const recovered = balanceAfter - balanceBefore;
    console.log(`\n用户余额 (关闭后): ${balanceAfter / 1e9} SOL`);
    console.log(`💰 回收租金: ${recovered / 1e9} SOL (扣除交易费后)`);
    console.log(`\n查看交易: https://explorer.solana.com/tx/${sig}?cluster=devnet`);
  } catch (error) {
    console.error("\n❌ 关闭失败:", error);
  }
}

main().catch(console.error);
