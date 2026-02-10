/**
 * 直接发送 ExtendProgram 指令
 * ExtendProgram 是无权限限制的（permissionless），任何人都可以付费扩展程序空间
 * Solana CLI 有客户端检查会阻止，但链上指令本身不需要 upgrade authority
 * 
 * Account layout (from Solana source):
 * 0. [writable] ProgramData account
 * 1. [writable] Program account (associated with ProgramData)
 * 2. [] System program (optional, for lamport transfer)
 * 3. [writable, signer] Payer (optional, pays rent)
 * 
 * Instruction data: bincode serialized UpgradeableLoaderInstruction::ExtendProgram { additional_bytes: u32 }
 * = [6, 0, 0, 0] (discriminator for ExtendProgram variant) + [bytes_le_u32]
 */

import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
  Keypair,
  SystemProgram,
} from "@solana/web3.js";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

const PROGRAM_ID = new PublicKey("BE6yuzEjzapwBEQ9RoAFzG72XZzb17JuWWqhecFHdEQa");
const BPF_LOADER_UPGRADEABLE = new PublicKey("BPFLoaderUpgradeab1e11111111111111111111111");
const ADDITIONAL_BYTES = 5000; // extend by 5000 bytes for safety margin

async function main() {
  const keypairPath = path.join(os.homedir(), ".config", "solana", "id.json");
  const keypairData = JSON.parse(fs.readFileSync(keypairPath, "utf-8"));
  const payer = Keypair.fromSecretKey(Uint8Array.from(keypairData));

  const connection = new Connection("https://api.devnet.solana.com", "confirmed");

  // Derive ProgramData address
  const [programDataAddress] = PublicKey.findProgramAddressSync(
    [PROGRAM_ID.toBuffer()],
    BPF_LOADER_UPGRADEABLE
  );

  console.log("📋 信息:");
  console.log("  Program ID:", PROGRAM_ID.toString());
  console.log("  ProgramData:", programDataAddress.toString());
  console.log("  Payer:", payer.publicKey.toString());
  console.log("  扩展字节数:", ADDITIONAL_BYTES);

  const accountInfo = await connection.getAccountInfo(programDataAddress);
  if (!accountInfo) {
    console.error("❌ ProgramData 账户不存在");
    return;
  }
  console.log("  当前大小:", accountInfo.data.length, "bytes");
  console.log("  扩展后大小:", accountInfo.data.length + ADDITIONAL_BYTES, "bytes");

  const balance = await connection.getBalance(payer.publicKey);
  console.log("  Payer 余额:", balance / 1e9, "SOL");

  // Build ExtendProgram instruction
  // Bincode serialization: enum variant index as u32 LE + additional_bytes as u32 LE
  // ExtendProgram is variant index 6
  const data = Buffer.alloc(8);
  data.writeUInt32LE(6, 0); // ExtendProgram discriminator (variant 6)
  data.writeUInt32LE(ADDITIONAL_BYTES, 4);

  const instruction = new TransactionInstruction({
    keys: [
      { pubkey: programDataAddress, isSigner: false, isWritable: true },
      { pubkey: PROGRAM_ID, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: payer.publicKey, isSigner: true, isWritable: true },
    ],
    programId: BPF_LOADER_UPGRADEABLE,
    data,
  });

  const transaction = new Transaction().add(instruction);

  console.log("\n🚀 发送 ExtendProgram 交易...");

  try {
    const signature = await sendAndConfirmTransaction(connection, transaction, [payer], {
      commitment: "confirmed",
    });
    console.log("✅ 交易成功!");
    console.log("  签名:", signature);
    console.log("  Explorer: https://explorer.solana.com/tx/" + signature + "?cluster=devnet");

    const newAccountInfo = await connection.getAccountInfo(programDataAddress);
    if (newAccountInfo) {
      console.log("\n📊 验证:");
      console.log("  新大小:", newAccountInfo.data.length, "bytes");
    }
  } catch (err: any) {
    console.error("❌ 交易失败:", err.message || err);
    if (err.logs) {
      console.error("  日志:", err.logs);
    }
  }
}

main().catch(console.error);
