#!/usr/bin/env node
/**
 * 检查 Solana Legal DID 项目状态
 */

const { 
    Connection, 
    PublicKey, 
    Keypair, 
    clusterApiUrl,
    LAMPORTS_PER_SOL
} = require('@solana/web3.js');

const { 
    AnchorProvider, 
    Wallet, 
    setProvider,
    Program
} = require('@coral-xyz/anchor');

const fs = require('fs');
const path = require('path');

const PROGRAM_ID = new PublicKey("Ce84NtGdKYpxkFpvWn7a5qqBXzkBfEhXM7gg49NtGuhM");

async function main() {
    console.log("=== 检查项目状态 ===");
    
    try {
        // 1. 连接
        const connection = new Connection(clusterApiUrl("devnet"), "confirmed");
        
        // 2. 加载钱包
        const keypairPath = path.join(process.env.HOME, '.config/solana/id.json');
        const keypairData = JSON.parse(fs.readFileSync(keypairPath, 'utf8'));
        const wallet = Keypair.fromSecretKey(new Uint8Array(keypairData));
        
        console.log(`👤 钱包: ${wallet.publicKey.toString()}`);
        
        // 3. 初始化 Anchor
        const anchorWallet = new Wallet(wallet);
        const provider = new AnchorProvider(connection, anchorWallet, { commitment: "confirmed" });
        setProvider(provider);
        
        // 4. 加载程序
        const idlPath = path.join(__dirname, '../target/idl/legaldid.json');
        const idl = JSON.parse(fs.readFileSync(idlPath, 'utf8'));
        const program = new Program(idl, PROGRAM_ID, provider);
        
        // 5. 计算项目 PDA
        const [projectPDA] = PublicKey.findProgramAddressSync(
            [Buffer.from("nt-proj-v5")],
            PROGRAM_ID
        );
        
        console.log(`📍 项目 PDA: ${projectPDA.toString()}`);
        
        // 6. 检查项目账户
        const projectAccount = await connection.getAccountInfo(projectPDA);
        if (!projectAccount) {
            console.log("❌ 项目账户不存在，需要先初始化");
            return;
        }
        
        console.log("✅ 项目账户存在");
        
        // 7. 获取项目数据
        try {
            const projectData = await program.account.projectAccount.fetch(projectPDA);
            
            console.log("\n📋 项目信息:");
            console.log(`  名称: ${projectData.name}`);
            console.log(`  符号: ${projectData.symbol}`);
            console.log(`  基础 URI: ${projectData.baseUri}`);
            console.log(`  管理员: ${projectData.authority.toString()}`);
            console.log(`  铸造价格: ${projectData.mintPrice} lamports (${projectData.mintPrice / LAMPORTS_PER_SOL} SOL)`);
            console.log(`  目标地址: ${projectData.destination.toString()}`);
            console.log(`  最后 Token ID: ${projectData.lastTokenId}`);
            console.log(`  操作员数量: ${projectData.operators.length}`);
            
            if (projectData.operators.length > 0) {
                console.log("  操作员列表:");
                projectData.operators.forEach((op, i) => {
                    console.log(`    ${i + 1}. ${op.toString()}`);
                });
            }
            
            // 8. 计算下一个 NFT mint 地址
            const nextTokenId = projectData.lastTokenId + 1;
            const tokenIdBytes = Buffer.alloc(8);
            tokenIdBytes.writeBigUInt64LE(BigInt(nextTokenId), 0);
            
            const [nextNftMint] = PublicKey.findProgramAddressSync(
                [Buffer.from("nt-nft-mint-v5"), tokenIdBytes],
                PROGRAM_ID
            );
            
            console.log(`\n🎯 下一个 NFT:`);
            console.log(`  Token ID: ${nextTokenId}`);
            console.log(`  NFT Mint 地址: ${nextNftMint.toString()}`);
            
            // 9. 检查权限
            const isAdmin = projectData.authority.equals(wallet.publicKey);
            const isOperator = projectData.operators.some(op => op.equals(wallet.publicKey));
            
            console.log(`\n🔐 权限检查:`);
            console.log(`  当前钱包是管理员: ${isAdmin}`);
            console.log(`  当前钱包是操作员: ${isOperator}`);
            console.log(`  可以发行 DID: ${isAdmin || isOperator}`);
            
        } catch (error) {
            console.log("❌ 无法读取项目数据:", error.message);
        }
        
    } catch (error) {
        console.error("❌ 检查失败:", error.message);
        throw error;
    }
}

if (require.main === module) {
    main().catch(error => {
        console.error("\n❌ 脚本执行失败:", error.message);
        process.exit(1);
    });
}