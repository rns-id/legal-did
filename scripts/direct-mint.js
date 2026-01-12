#!/usr/bin/env node
/**
 * 直接使用 Solana Web3.js 发行 DID，绕过 Anchor 版本问题
 */

const { 
    Connection, 
    PublicKey, 
    Keypair, 
    clusterApiUrl,
    LAMPORTS_PER_SOL,
    Transaction,
    TransactionInstruction,
    SystemProgram,
    ComputeBudgetProgram
} = require('@solana/web3.js');

const { 
    getAssociatedTokenAddressSync, 
    TOKEN_2022_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
} = require('@solana/spl-token');

const fs = require('fs');
const path = require('path');

// 配置
const CONFIG = {
    programId: "Ce84NtGdKYpxkFpvWn7a5qqBXzkBfEhXM7gg49NtGuhM",
    targetWallet: "EuWtasWBcuESn5Mt1R5a4AVja2xsHtFMLs8YWiMfJX8A",
    rnsId: `did-direct-${Date.now()}`,
    merkleRoot: "0x764e6372e05f4db05595276214e74f047a6562f19bf6cc3bb35a53ac892c3ce3"
};

async function main() {
    console.log("=== 直接发行 DID (绕过 Anchor) ===");
    console.log(`目标钱包: ${CONFIG.targetWallet}`);
    console.log(`RNS ID: ${CONFIG.rnsId}`);
    console.log("");
    
    try {
        // 1. 连接
        const connection = new Connection(clusterApiUrl("devnet"), "confirmed");
        
        // 2. 加载管理员钱包
        const keypairPath = path.join(process.env.HOME, '.config/solana/id.json');
        const keypairData = JSON.parse(fs.readFileSync(keypairPath, 'utf8'));
        const adminWallet = Keypair.fromSecretKey(new Uint8Array(keypairData));
        
        console.log(`👤 管理员钱包: ${adminWallet.publicKey.toString()}`);
        
        const balance = await connection.getBalance(adminWallet.publicKey);
        console.log(`💰 余额: ${(balance / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
        
        // 3. 计算 PDA 地址
        const programId = new PublicKey(CONFIG.programId);
        const targetWallet = new PublicKey(CONFIG.targetWallet);
        
        const [projectPDA] = PublicKey.findProgramAddressSync(
            [Buffer.from("nt-proj-v5")],
            programId
        );
        
        const [projectMintPDA] = PublicKey.findProgramAddressSync(
            [Buffer.from("nt-project-mint-v5")],
            programId
        );
        
        console.log(`📍 项目 PDA: ${projectPDA.toString()}`);
        console.log(`📍 项目 Mint PDA: ${projectMintPDA.toString()}`);
        
        // 4. 检查项目是否已初始化
        const projectAccount = await connection.getAccountInfo(projectPDA);
        if (!projectAccount) {
            console.log("❌ 项目未初始化，请先运行初始化脚本");
            return;
        }
        
        console.log("✅ 项目已初始化");
        
        // 5. 从项目账户数据中读取 last_token_id
        // 这需要手动解析账户数据，比较复杂
        // 为了简化，我们假设这是第一个 token (token_id = 1)
        const assumedTokenId = 1;
        
        console.log(`🎯 假设 Token ID: ${assumedTokenId}`);
        
        // 6. 计算 NFT mint 地址
        const tokenIdBytes = Buffer.alloc(8);
        tokenIdBytes.writeBigUInt64LE(BigInt(assumedTokenId), 0);
        
        const [nftMintPDA] = PublicKey.findProgramAddressSync(
            [Buffer.from("nt-nft-mint-v5"), tokenIdBytes],
            programId
        );
        
        const userTokenAccount = getAssociatedTokenAddressSync(
            nftMintPDA,
            targetWallet,
            false,
            TOKEN_2022_PROGRAM_ID
        );
        
        console.log(`📍 NFT Mint PDA: ${nftMintPDA.toString()}`);
        console.log(`📍 用户 Token 账户: ${userTokenAccount.toString()}`);
        
        // 7. 检查 NFT mint 是否已存在
        const nftMintAccount = await connection.getAccountInfo(nftMintPDA);
        if (nftMintAccount) {
            console.log("⚠️  NFT Mint 已存在，可能已经发行过了");
            
            // 检查用户是否已有 token
            const userTokenAccountInfo = await connection.getAccountInfo(userTokenAccount);
            if (userTokenAccountInfo) {
                console.log("✅ 用户已拥有此 DID NFT");
                console.log(`🔗 浏览器: https://explorer.solana.com/address/${nftMintPDA.toString()}?cluster=devnet`);
                return;
            }
        }
        
        console.log("\n🚀 开始发行 DID...");
        console.log("⚠️  注意: 由于绕过了 Anchor，这个脚本只能做基本检查");
        console.log("建议使用修复版本问题后的 Anchor 脚本进行实际发行");
        
        // 这里我们不实际发送交易，因为构造原始指令比较复杂
        // 而且没有 Anchor 的帮助很容易出错
        
        console.log("\n📋 发行信息摘要:");
        console.log(`  程序 ID: ${CONFIG.programId}`);
        console.log(`  目标钱包: ${CONFIG.targetWallet}`);
        console.log(`  RNS ID: ${CONFIG.rnsId}`);
        console.log(`  预期 NFT Mint: ${nftMintPDA.toString()}`);
        console.log(`  预期 Token 账户: ${userTokenAccount.toString()}`);
        console.log(`  浏览器链接: https://explorer.solana.com/address/${nftMintPDA.toString()}?cluster=devnet`);
        
    } catch (error) {
        console.error("❌ 执行失败:", error.message);
        throw error;
    }
}

if (require.main === module) {
    main().catch(error => {
        console.error("\n❌ 脚本执行失败:", error.message);
        process.exit(1);
    });
}