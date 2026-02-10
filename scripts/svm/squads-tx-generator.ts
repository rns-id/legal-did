/**
 * Squads 多签管理员操作 - Base58 交易生成器
 *
 * 用法:
 *   npx ts-node scripts/svm/squads-tx-generator.ts <command> [args...]
 *
 * 命令:
 *   removeOperator <operator_pubkey>
 *   addOperator <operator_pubkey>
 *   setMintPrice <price_in_lamports>
 *   setBaseUri <uri>
 *   setFeeRecipient <pubkey>
 *   setFundDestination <pubkey>
 *   transferAuthority <new_authority_pubkey>
 *   withdraw
 */

import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import * as bs58 from "bs58";
import * as nodeCrypto from "crypto";

// ============ 配置 ============
const PROGRAM_ID = new PublicKey("BE6yuzEjzapwBEQ9RoAFzG72XZzb17JuWWqhecFHdEQa");
const MULTISIG_VAULT = new PublicKey("wkxCmw6rzM8xeUNhzPhWtWCwp6VoE4S81ymNDhqMWud");
const PROJECT_PDA = new PublicKey("GLdsotriCs2HcxoSNcqA3pp35QuKZi3PGuKQcdiUzP5o");
const RPC_URL = "https://api.devnet.solana.com";
// ==============================

function anchorDiscriminator(name: string): Buffer {
  return nodeCrypto
    .createHash("sha256")
    .update(`global:${name}`)
    .digest()
    .slice(0, 8) as Buffer;
}

function encodePubkey(pubkey: string): Buffer {
  return new PublicKey(pubkey).toBuffer();
}

function encodeU64(value: bigint): Buffer {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(value);
  return buf;
}

function encodeString(str: string): Buffer {
  const strBuf = Buffer.from(str, "utf-8");
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32LE(strBuf.length);
  return Buffer.concat([lenBuf, strBuf]);
}

type InstructionDef = {
  discriminatorName: string;
  data: Buffer;
  accounts: { pubkey: PublicKey; isSigner: boolean; isWritable: boolean }[];
};

function buildInstruction(command: string, args: string[]): InstructionDef {
  const vaultSigner = { pubkey: MULTISIG_VAULT, isSigner: true, isWritable: true };
  const projectWritable = { pubkey: PROJECT_PDA, isSigner: false, isWritable: true };

  switch (command) {
    case "removeOperator": {
      if (!args[0]) throw new Error("用法: removeOperator <operator_pubkey>");
      return {
        discriminatorName: "remove_operator",
        data: encodePubkey(args[0]),
        accounts: [vaultSigner, projectWritable],
      };
    }
    case "addOperator": {
      if (!args[0]) throw new Error("用法: addOperator <operator_pubkey>");
      return {
        discriminatorName: "add_operator",
        data: encodePubkey(args[0]),
        accounts: [vaultSigner, projectWritable],
      };
    }
    case "setMintPrice": {
      if (!args[0]) throw new Error("用法: setMintPrice <price_in_lamports>");
      return {
        discriminatorName: "set_mint_price",
        data: encodeU64(BigInt(args[0])),
        accounts: [
          { pubkey: MULTISIG_VAULT, isSigner: true, isWritable: false },
          projectWritable,
        ],
      };
    }
    case "setBaseUri": {
      if (!args[0]) throw new Error("用法: setBaseUri <uri>");
      return {
        discriminatorName: "set_base_uri",
        data: encodeString(args[0]),
        accounts: [projectWritable, vaultSigner],
      };
    }
    case "setFeeRecipient": {
      if (!args[0]) throw new Error("用法: setFeeRecipient <pubkey>");
      return {
        discriminatorName: "set_fee_recipient",
        data: encodePubkey(args[0]),
        accounts: [projectWritable, vaultSigner],
      };
    }
    case "setFundDestination": {
      if (!args[0]) throw new Error("用法: setFundDestination <pubkey>");
      return {
        discriminatorName: "set_fund_destination",
        data: encodePubkey(args[0]),
        accounts: [projectWritable, vaultSigner],
      };
    }
    case "transferAuthority": {
      if (!args[0]) throw new Error("用法: transferAuthority <new_authority_pubkey>");
      return {
        discriminatorName: "transfer_authority",
        data: encodePubkey(args[0]),
        accounts: [vaultSigner, projectWritable],
      };
    }
    case "withdraw": {
      // withdraw 需要额外的账户，这里简化处理
      throw new Error("withdraw 指令需要额外账户（destination 等），请使用 Squads Programs 页面的 IDL 模式");
    }
    default:
      throw new Error(`未知命令: ${command}\n支持: removeOperator, addOperator, setMintPrice, setBaseUri, setFeeRecipient, setFundDestination, transferAuthority`);
  }
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  if (!command) {
    console.log(`
Squads 多签管理员操作 - Base58 交易生成器

用法: npx ts-node scripts/svm/squads-tx-generator.ts <command> [args...]

命令:
  removeOperator <operator_pubkey>        移除 operator
  addOperator <operator_pubkey>           添加 operator
  setMintPrice <price_in_lamports>        设置 mint 价格
  setBaseUri <uri>                        设置 base URI
  setFeeRecipient <pubkey>                设置费用接收地址
  setFundDestination <pubkey>             设置资金目标地址
  transferAuthority <new_authority>        转移管理员权限

示例:
  npx ts-node scripts/svm/squads-tx-generator.ts removeOperator GwZXPRhkXF3iMQ3CKpvzqLukBC9bMZ1qfYW4kKF8FzRo
  npx ts-node scripts/svm/squads-tx-generator.ts addOperator GwZXPRhkXF3iMQ3CKpvzqLukBC9bMZ1qfYW4kKF8FzRo
  npx ts-node scripts/svm/squads-tx-generator.ts setMintPrice 100000
`);
    return;
  }

  const def = buildInstruction(command, args);
  const discriminator = anchorDiscriminator(def.discriminatorName);
  const instructionData = Buffer.concat([discriminator, def.data]);

  const ix = new TransactionInstruction({
    keys: def.accounts,
    programId: PROGRAM_ID,
    data: instructionData,
  });

  const connection = new Connection(RPC_URL, "confirmed");
  const { blockhash } = await connection.getLatestBlockhash();

  const tx = new Transaction();
  tx.add(ix);
  tx.recentBlockhash = blockhash;
  tx.feePayer = MULTISIG_VAULT;

  const serialized = tx.serialize({ requireAllSignatures: false, verifySignatures: false });
  const b58 = bs58.encode(serialized);

  console.log(`\n✅ 指令: ${command}`);
  console.log(`   Discriminator: ${def.discriminatorName} -> [${Array.from(discriminator).join(", ")}]`);
  if (args.length > 0) console.log(`   参数: ${args.join(" ")}`);
  console.log(`\n📋 Squads TX Builder 操作步骤:`);
  console.log(`   1. Developers → TX Builder → Create transaction`);
  console.log(`   2. 选择 "Import a base58 encoded transaction"`);
  console.log(`   3. 粘贴以下 base58 字符串:`);
  console.log(`\n${b58}\n`);
  console.log(`   4. Next → Add Instruction → Save draft`);
  console.log(`   5. Run Simulation 验证`);
  console.log(`   6. Initiate Transaction → 投票 → 执行`);
}

main().catch((err) => {
  console.error("❌", err.message);
  process.exit(1);
});
