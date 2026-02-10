/**
 * 生成 removeOperator 的 base58 编码交易，用于导入 Squads TX Builder
 */
import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
} from "@solana/web3.js";
import * as bs58 from "bs58";

const PROGRAM_ID = new PublicKey("BE6yuzEjzapwBEQ9RoAFzG72XZzb17JuWWqhecFHdEQa");
const MULTISIG_VAULT = new PublicKey("wkxCmw6rzM8xeUNhzPhWtWCwp6VoE4S81ymNDhqMWud");
const PROJECT_PDA = new PublicKey("GLdsotriCs2HcxoSNcqA3pp35QuKZi3PGuKQcdiUzP5o");

// 要移除的 operator
const OPERATOR_TO_REMOVE = new PublicKey("GwZXPRhkXF3iMQ3CKpvzqLukBC9bMZ1qfYW4kKF8FzRo");

async function main() {
  const connection = new Connection("https://api.devnet.solana.com", "confirmed");

  // Anchor discriminator for remove_operator: sha256("global:remove_operator")[0:8]
  const crypto = require("crypto");
  const discriminator = crypto
    .createHash("sha256")
    .update("global:remove_operator")
    .digest()
    .slice(0, 8);

  console.log("Discriminator:", Array.from(discriminator));

  // Instruction data = discriminator (8 bytes) + operator pubkey (32 bytes)
  const data = Buffer.concat([discriminator, OPERATOR_TO_REMOVE.toBuffer()]);

  const instruction = new TransactionInstruction({
    keys: [
      { pubkey: MULTISIG_VAULT, isSigner: true, isWritable: true },   // authority
      { pubkey: PROJECT_PDA, isSigner: false, isWritable: true },      // non_transferable_project
    ],
    programId: PROGRAM_ID,
    data,
  });

  const transaction = new Transaction().add(instruction);

  // 需要设置一个 recent blockhash（Squads 会替换掉）
  const { blockhash } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = MULTISIG_VAULT;

  // 序列化（不需要签名，Squads 会处理）
  const serialized = transaction.serialize({
    requireAllSignatures: false,
    verifySignatures: false,
  });

  const base58Tx = bs58.encode(serialized);

  console.log("\n📋 在 Squads TX Builder 中导入：");
  console.log("1. Developers → TX Builder → Create transaction");
  console.log("2. 选择 'Import a base58 encoded transaction'");
  console.log("3. 粘贴以下内容：\n");
  console.log(base58Tx);
  console.log("\n4. 点击 Next → Add Instruction → Run Simulation");
  console.log("\n📝 操作详情:");
  console.log("  指令: removeOperator");
  console.log("  移除的 Operator:", OPERATOR_TO_REMOVE.toString());
}

main().catch(console.error);
