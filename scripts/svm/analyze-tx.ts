import { Connection, Transaction, Message, PublicKey } from "@solana/web3.js";
import bs58 from "bs58";

async function analyzeTx() {
  // 从 URL 解码的 message
  const messageBase64 = "AQACA3Dwb0AhRhrq6Imd2FtMFXq8slYYsuaNSPf4nyH0MsTal/AuzYCu930nikccOrK5Du683Uz/vxmWfQQN1FotAMsDBkZv5SEXMv/srbpyw5vnvIzlu8X3EmssQ5s6QAAAAK0tgKO/buOPVmVsaWF0Ztt2QUO9AGmJia+AF0pTo3JGAgIABQLAXBUAAQAA";
  
  console.log("🔍 分析 Squads 交易\n");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  
  try {
    const messageBuffer = Buffer.from(messageBase64, "base64");
    console.log("Message Buffer (hex):", messageBuffer.toString("hex").substring(0, 100) + "...");
    console.log("Message Length:", messageBuffer.length, "bytes");
    console.log("");
    
    // 手动解析消息头
    let offset = 0;
    const numRequiredSignatures = messageBuffer[offset++];
    const numReadonlySignedAccounts = messageBuffer[offset++];
    const numReadonlyUnsignedAccounts = messageBuffer[offset++];
    
    console.log("📋 消息头:");
    console.log("  Required Signatures:", numRequiredSignatures);
    console.log("  Readonly Signed Accounts:", numReadonlySignedAccounts);
    console.log("  Readonly Unsigned Accounts:", numReadonlyUnsignedAccounts);
    console.log("");
    
    // 读取账户数量（compact-u16）
    const numAccounts = messageBuffer[offset++];
    console.log("  Total Accounts:", numAccounts);
    console.log("");
    
    // 读取所有账户
    console.log("📝 Accounts:");
    const accounts: PublicKey[] = [];
    for (let i = 0; i < numAccounts; i++) {
      const pubkeyBytes = messageBuffer.slice(offset, offset + 32);
      const pubkey = new PublicKey(pubkeyBytes);
      accounts.push(pubkey);
      
      let role = "";
      if (i < numRequiredSignatures - numReadonlySignedAccounts) {
        role = "Signer + Writable";
      } else if (i < numRequiredSignatures) {
        role = "Signer + Readonly";
      } else if (i < numAccounts - numReadonlyUnsignedAccounts) {
        role = "Writable";
      } else {
        role = "Readonly";
      }
      
      console.log(`  ${i + 1}. ${pubkey.toBase58()}`);
      console.log(`     Role: ${role}`);
      
      offset += 32;
    }
    console.log("");
    
    // 读取 recent blockhash
    const recentBlockhash = bs58.encode(messageBuffer.slice(offset, offset + 32));
    console.log("🔗 Recent Blockhash:", recentBlockhash);
    offset += 32;
    console.log("");
    
    // 读取指令数量
    const numInstructions = messageBuffer[offset++];
    console.log("📦 Instructions:", numInstructions);
    console.log("");
    
    // 读取每个指令
    for (let i = 0; i < numInstructions; i++) {
      console.log(`Instruction ${i + 1}:`);
      
      const programIdIndex = messageBuffer[offset++];
      console.log(`  Program ID Index: ${programIdIndex}`);
      console.log(`  Program ID: ${accounts[programIdIndex].toBase58()}`);
      
      // 读取账户索引数量
      const numAccountIndices = messageBuffer[offset++];
      console.log(`  Account Indices (${numAccountIndices}):`);
      
      const accountIndices: number[] = [];
      for (let j = 0; j < numAccountIndices; j++) {
        const index = messageBuffer[offset++];
        accountIndices.push(index);
        console.log(`    ${j + 1}. Index ${index} -> ${accounts[index].toBase58()}`);
      }
      
      // 读取指令数据长度
      const dataLength = messageBuffer[offset++];
      console.log(`  Data Length: ${dataLength} bytes`);
      
      if (dataLength > 0) {
        const data = messageBuffer.slice(offset, offset + dataLength);
        console.log(`  Data (hex): ${data.toString("hex")}`);
        console.log(`  Data (base64): ${data.toString("base64")}`);
        offset += dataLength;
      }
      console.log("");
    }
    
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("");
    
    // 分析可能的问题
    console.log("🔍 问题分析:");
    console.log("");
    
    // 检查是否是我们的程序
    const ourProgramId = "BE6yuzEjzapwBEQ9RoAFzG72XZzb17JuWWqhecFHdEQa";
    const squadsVault = "wkxCmw6rzM8xeUNhzPhWtWCwp6VoE4S81ymNDhqMWud";
    const projectPda = "GLdsotriCs2HcxoSNcqA3pp35QuKZi3PGuKQcdiUzP5o";
    
    const hasOurProgram = accounts.some(acc => acc.toBase58() === ourProgramId);
    const hasSquadsVault = accounts.some(acc => acc.toBase58() === squadsVault);
    const hasProjectPda = accounts.some(acc => acc.toBase58() === projectPda);
    
    console.log("  包含我们的 Program ID:", hasOurProgram ? "✅" : "❌");
    console.log("  包含 Squads Vault:", hasSquadsVault ? "✅" : "❌");
    console.log("  包含 Project PDA:", hasProjectPda ? "✅" : "❌");
    console.log("");
    
    if (!hasOurProgram) {
      console.log("⚠️  这个交易不包含我们的程序 ID");
      console.log("   可能是 Squads 内部的交易");
    }
    
    if (numRequiredSignatures === 1) {
      console.log("⚠️  只需要 1 个签名");
      console.log("   Squads 多签交易通常需要多个签名");
    }
    
  } catch (error: any) {
    console.error("❌ 解析失败:", error.message);
  }
}

analyzeTx();
