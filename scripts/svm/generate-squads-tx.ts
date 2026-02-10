import * as anchor from "@coral-xyz/anchor";
import { Connection, PublicKey, TransactionMessage, VersionedTransaction } from "@solana/web3.js";
import * as fs from "fs";
import * as bs58 from "bs58";

// ========== 配置区域 - 修改这里 ==========
const ACTION = "add_operator"; // 可选: add_operator, remove_operator, set_mint_price, withdraw
const NEW_OPERATOR = "8bsJcfGRyFWUEzS4bQfADTVBjReUm3YH89x1QY1qp3gd"; // 新 Operator 地址
const MINT_PRICE = 0.01; // SOL (仅 set_mint_price 时使用)
// ========================================

const PROGRAM_ID = new PublicKey("BE6yuzEjzapwBEQ9RoAFzG72XZzb17JuWWqhecFHdEQa");
const SQUADS_VAULT = new PublicKey("wkxCmw6rzM8xeUNhzPhWtWCwp6VoE4S81ymNDhqMWud");
const PROJECT_SEED = "nt-proj-v5";

async function main() {
  const connection = new Connection("https://api.devnet.solana.com", "confirmed");
  
  const [projectPda] = PublicKey.findProgramAddressSync(
    [Buffer.from(PROJECT_SEED)],
    PROGRAM_ID
  );

  const idl = JSON.parse(fs.readFileSync("./target/idl/legaldid.json", "utf-8"));
  const coder = new anchor.BorshCoder(idl);

  let instruction: anchor.web3.TransactionInstruction;

  if (ACTION === "add_operator") {
    const ixData = coder.instruction.encode("add_operator", {
      operator: new PublicKey(NEW_OPERATOR),
    });
    instruction = new anchor.web3.TransactionInstruction({
      programId: PROGRAM_ID,
      keys: [
        { pubkey: SQUADS_VAULT, isSigner: true, isWritable: true },
        { pubkey: projectPda, isSigner: false, isWritable: true },
      ],
      data: Buffer.from(ixData),
    });
    console.log(`\n📝 操作: 添加 Operator`);
    console.log(`   新 Operator: ${NEW_OPERATOR}`);
  } else if (ACTION === "remove_operator") {
    const ixData = coder.instruction.encode("remove_operator", {
      operator: new PublicKey(NEW_OPERATOR),
    });
    instruction = new anchor.web3.TransactionInstruction({
      programId: PROGRAM_ID,
      keys: [
        { pubkey: SQUADS_VAULT, isSigner: true, isWritable: true },
        { pubkey: projectPda, isSigner: false, isWritable: true },
      ],
      data: Buffer.from(ixData),
    });
    console.log(`\n📝 操作: 移除 Operator`);
    console.log(`   移除地址: ${NEW_OPERATOR}`);
  } else if (ACTION === "set_mint_price") {
    const lamports = BigInt(Math.floor(MINT_PRICE * 1e9));
    const ixData = coder.instruction.encode("set_mint_price", {
      mintPrice: lamports,
    });
    instruction = new anchor.web3.TransactionInstruction({
      programId: PROGRAM_ID,
      keys: [
        { pubkey: SQUADS_VAULT, isSigner: true, isWritable: false },
        { pubkey: projectPda, isSigner: false, isWritable: true },
      ],
      data: Buffer.from(ixData),
    });
    console.log(`\n📝 操作: 设置 Mint 价格`);
    console.log(`   新价格: ${MINT_PRICE} SOL`);
  } else {
    throw new Error(`Unknown action: ${ACTION}`);
  }

  // 获取最新 blockhash
  const { blockhash } = await connection.getLatestBlockhash();

  // 创建交易消息
  const messageV0 = new TransactionMessage({
    payerKey: SQUADS_VAULT,
    recentBlockhash: blockhash,
    instructions: [instruction],
  }).compileToV0Message();

  const tx = new VersionedTransaction(messageV0);
  const serialized = tx.serialize();
  const base58Tx = bs58.encode(serialized);

  console.log(`\n${"=".repeat(60)}`);
  console.log("✅ 在 Squads TX Builder 中操作:");
  console.log("=".repeat(60));
  console.log("\n1. 点击 'Import base58 encoded tx'");
  console.log("\n2. 粘贴以下内容:\n");
  console.log(base58Tx);
  console.log("\n3. 点击 Import → Create Transaction → Execute");
  console.log("=".repeat(60));
}

main().catch(console.error);
