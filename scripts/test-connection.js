#!/usr/bin/env node
/**
 * 测试 Solana 程序连接
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

async function main() {
    console.log("=== 测试 Solana 程序连接 ===");
    
    try {
        // 1. 连接
        const connection = new Connection(clusterApiUrl("devnet"), "confirmed");
        console.log("✅ 连接到 devnet");
        
        // 2. 加载钱包
        const keypairPath = path.join(process.env.HOME, '.config/solana/id.json');
        const keypairData = JSON.parse(fs.readFileSync(keypairPath, 'utf8'));
        const wallet = Keypair.fromSecretKey(new Uint8Array(keypairData));
        console.log(`✅ 钱包加载: ${wallet.publicKey.toString()}`);
        
        // 3. 检查余额
        const balance = await connection.getBalance(wallet.publicKey);
        console.log(`✅ 余额: ${(balance / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
        
        // 4. 检查程序账户
        const programId = new PublicKey("Ce84NtGdKYpxkFpvWn7a5qqBXzkBfEhXM7gg49NtGuhM");
        const programAccount = await connection.getAccountInfo(programId);
        
        if (programAccount) {
            console.log("✅ 程序账户存在");
            console.log(`  所有者: ${programAccount.owner.toString()}`);
            console.log(`  数据长度: ${programAccount.data.length} bytes`);
            console.log(`  可执行: ${programAccount.executable}`);
        } else {
            console.log("❌ 程序账户不存在");
            return;
        }
        
        // 5. 初始化 Anchor Provider
        const anchorWallet = new Wallet(wallet);
        const provider = new AnchorProvider(connection, anchorWallet, { commitment: "confirmed" });
        setProvider(provider);
        console.log("✅ Anchor Provider 初始化");
        
        // 6. 计算项目 PDA
        const [projectPDA] = PublicKey.findProgramAddressSync(
            [Buffer.from("nt-proj-v5")],
            programId
        );
        console.log(`✅ 项目 PDA: ${projectPDA.toString()}`);
        
        // 7. 检查项目账户是否存在
        const projectAccount = await connection.getAccountInfo(projectPDA);
        if (projectAccount) {
            console.log("✅ 项目账户已存在");
            console.log(`  数据长度: ${projectAccount.data.length} bytes`);
            console.log(`  所有者: ${projectAccount.owner.toString()}`);
        } else {
            console.log("⚠️  项目账户不存在，需要初始化");
        }
        
        // 8. 尝试加载程序 IDL
        try {
            const idlPath = path.join(__dirname, '../target/idl/legaldid.json');
            const idl = JSON.parse(fs.readFileSync(idlPath, 'utf8'));
            console.log("✅ IDL 文件加载成功");
            console.log(`  程序名称: ${idl.metadata.name}`);
            console.log(`  版本: ${idl.metadata.version}`);
            console.log(`  指令数量: ${idl.instructions.length}`);
            
            // 创建程序实例
            const program = new Program(idl, programId, provider);
            console.log("✅ 程序实例创建成功");
            
            // 如果项目账户存在，尝试获取数据
            if (projectAccount) {
                try {
                    const projectData = await program.account.nonTransferableProject.fetch(projectPDA);
                    console.log("✅ 项目数据获取成功:");
                    console.log(`  名称: ${projectData.name}`);
                    console.log(`  符号: ${projectData.symbol}`);
                    console.log(`  管理员: ${projectData.authority.toString()}`);
                    console.log(`  操作员数量: ${projectData.operators.length}`);
                    console.log(`  铸造价格: ${projectData.mintPrice} lamports`);
                } catch (error) {
                    console.log("⚠️  无法解析项目数据:", error.message);
                }
            }
            
        } catch (error) {
            console.log("❌ IDL 加载失败:", error.message);
        }
        
        console.log("\n🎉 连接测试完成!");
        
    } catch (error) {
        console.error("❌ 测试失败:", error.message);
        throw error;
    }
}

if (require.main === module) {
    main().catch(error => {
        console.error("\n❌ 脚本执行失败:", error.message);
        process.exit(1);
    });
}