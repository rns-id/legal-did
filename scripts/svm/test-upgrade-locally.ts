/**
 * 在本地测试升级指令是否正确
 */

import { 
  Connection, 
  PublicKey, 
  TransactionInstruction,
  Transaction,
  Keypair
} from "@solana/web3.js";

const PROGRAM_ID = new PublicKey("BE6yuzEjzapwBEQ9RoAFzG72XZzb17JuWWqhecFHdEQa");
const BUFFER = new PublicKey("Bq7wFsrV81bsXAZpCUtT9izMj4f616SuNYJiLb8FWeBh");
const SPILL_ACCOUNT = new PublicKey("8bsJcfGRyFWUEzS4bQfADTVBjReUm3YH89x1QY1qp3gd");
const UPGRADE_AUTHORITY = new PublicKey("wkxCmw6rzM8xeUNhzPhWtWCwp6VoE4S81ymNDhqMWud");
const BPF_LOADER = new PublicKey("BPFLoaderUpgradeab1e11111111111111111111111");
const RENT_SYSVAR = new PublicKey("SysvarRent111111111111111111111111111111111");
const CLOCK_SYSVAR = new PublicKey("SysvarC1ock11111111111111111111111111111111");

async function main() {
  const connection = new Connection("https://api.devnet.solana.com", "confirmed");

  // 派生 ProgramData 地址
  const [programDataAddress] = PublicKey.findProgramAddressSync(
    [PROGRAM_ID.toBuffer()],
    BPF_LOADER
  );

  console.log("🔍 验证升级指令\n");
  console.log("Program Data:", programDataAddress.toString());
  console.log("");

  // 创建升级指令
  const upgradeInstruction = new TransactionInstruction({
    programId: BPF_LOADER,
    keys: [
      { pubkey: programDataAddress, isSigner: false, isWritable: true },
      { pubkey: PROGRAM_ID, isSigner: false, isWritable: true },
      { pubkey: BUFFER, isSigner: false, isWritable: true },
      { pubkey: SPILL_ACCOUNT, isSigner: false, isWritable: true },
      { pubkey: UPGRADE_AUTHORITY, isSigner: true, isWritable: false },
      { pubkey: RENT_SYSVAR, isSigner: false, isWritable: false },
      { pubkey: CLOCK_SYSVAR, isSigner: false, isWritable: false },
    ],
    data: Buffer.from([3, 0, 0, 0]), // upgrade discriminator
  });

  console.log("✅ 指令创建成功\n");
  console.log("📋 账户列表:");
  upgradeInstruction.keys.forEach((key, index) => {
    console.log(`  ${index + 1}. ${key.pubkey.toString()}`);
    console.log(`     Signer: ${key.isSigner ? '✅' : '❌'}  Writable: ${key.isWritable ? '✅' : '❌'}`);
  });
  console.log("");

  // 尝试模拟（会失败因为我们没有签名，但可以看到错误）
  try {
    const dummyKeypair = Keypair.generate();
    const transaction = new Transaction().add(upgradeInstruction);
    transaction.feePayer = dummyKeypair.publicKey;
    transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

    const simulation = await connection.simulateTransaction(transaction);
    
    if (simulation.value.err) {
      console.log("⚠️  模拟失败（预期的，因为没有真实签名）:");
      console.log(JSON.stringify(simulation.value.err, null, 2));
      console.log("");
      console.log("如果错误是关于签名的，说明指令格式是正确的！");
    } else {
      console.log("✅ 模拟成功！");
    }
  } catch (error: any) {
    console.log("⚠️  模拟错误:", error.message);
  }

  console.log("");
  console.log("🎯 在 Squads UI 中使用这个配置:");
  console.log("");
  console.log("Program ID: BPFLoaderUpgradeab1e11111111111111111111111");
  console.log("Instruction Data: 5Sxr3");
  console.log("");
  console.log("Accounts (7个):");
  console.log(`1. ${programDataAddress.toString()} [Writable]`);
  console.log(`2. ${PROGRAM_ID.toString()} [Writable]`);
  console.log(`3. ${BUFFER.toString()} [Writable]`);
  console.log(`4. ${SPILL_ACCOUNT.toString()} [Writable]`);
  console.log(`5. ${UPGRADE_AUTHORITY.toString()} [Signer]`);
  console.log(`6. ${RENT_SYSVAR.toString()} [Read-only]`);
  console.log(`7. ${CLOCK_SYSVAR.toString()} [Read-only]`);
}

main().catch(console.error);
