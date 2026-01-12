#!/usr/bin/env node
/**
 * 初始化 Solana Legal DID 项目
 */

const { 
    Connection, 
    PublicKey, 
    Keypair, 
    clusterApiUrl,
    LAMPORTS_PER_SOL,
    ComputeBudgetProgram,
    SystemProgram
} = require('@solana/web3.js');

const { 
    AnchorProvider, 
    Wallet, 
    setProvider,
    Program
} = require('@coral-xyz/anchor');

const { TOKEN_2022_PROGRAM_ID } = require('@solana/spl-token');

const fs = require('fs');
const path = require('path');

// 配置
const CONFIG = {
    name: "Legal DID",
    symbol: "LDID", 
    baseUri: "https://api.rns.id/api/v2/portal/identity/nft/",
    mintPrice: 0.001, // 0.001 SOL
    programId: "Ce84NtGdKYpxkFpvWn7a5qqBXzkBfEhXM7gg49NtGuhM"
};

async function main() {
    console.log("=== 初始化 Solana Legal DID 项目 ===");
    console.log("");
    
    try {
        // 1. 连接和钱包
        const connection = new Connection(clusterApiUrl("devnet"), "confirmed");
        const keypairPath = path.join(process.env.HOME, '.config/solana/id.json');
        const keypairData = JSON.parse(fs.readFileSync(keypairPath, 'utf8'));
        const adminWallet = Keypair.fromSecretKey(new Uint8Array(keypairData));
        
        console.log(`👤 管理员钱包: ${adminWallet.publicKey.toString()}`);
        
        const balance = await connection.getBalance(adminWallet.publicKey);
        console.log(`💰 余额: ${(balance / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
        
        if (balance < 0.1 * LAMPORTS_PER_SOL) {
            throw new Error("余额不足，至少需要 0.1 SOL");
        }
        
        // 2. 初始化 Anchor
        const wallet = new Wallet(adminWallet);
        const provider = new AnchorProvider(connection, wallet, { commitment: "confirmed" });
        setProvider(provider);
        
        // 3. 加载程序
        const programId = new PublicKey(CONFIG.programId);
        const idlPath = path.join(__dirname, '../target/idl/legaldid.json');
        const idl = JSON.parse(fs.readFileSync(idlPath, 'utf8'));
        const program = new Program(idl, programId, provider);
        
        console.log(`📋 程序 ID: ${programId.toString()}`);
        
        // 4. 计算 PDA
        const [nonTransferableProject] = PublicKey.findProgramAddressSync(
            [Buffer.from("nt-proj-v5")],
            programId
        );

        const [nonTransferableProjectMint] = PublicKey.findProgramAddressSync(
            [Buffer.from("nt-project-mint-v5")],
            programId
        );
        
        console.log(`📍 项目 PDA: ${nonTransferableProject.toString()}`);
        console.log(`📍 项目 Mint PDA: ${nonTransferableProjectMint.toString()}`);
        
        // 5. 检查是否已初始化
        const projectAccount = await connection.getAccountInfo(nonTransferableProject);
        if (projectAccount) {
            console.log("⚠️  项目已经初始化，跳过初始化步骤");
            
            // 尝试获取项目数据
            try {
                const projectData = await program.account.nonTransferableProject.fetch(nonTransferableProject);
                console.log("📋 当前项目信息:");
                console.log(`  名称: ${projectData.name}`);
                console.log(`  符号: ${projectData.symbol}`);
                console.log(`  管理员: ${projectData.authority.toString()}`);
                console.log(`  铸造价格: ${projectData.mintPrice} lamports (${projectData.mintPrice / LAMPORTS_PER_SOL} SOL)`);
                return;
            } catch (error) {
                console.log("⚠️  无法读取项目数据，可能需要重新初始化");
            }
        }
        
        // 6. 初始化项目
        console.log("\n🚀 开始初始化项目...");
        
        const balanceBefore = await connection.getBalance(adminWallet.publicKey);
        
        const ix = ComputeBudgetProgram.setComputeUnitLimit({ units: 1_000_000 });
        
        const initTx = await program.methods
            .initialize({
                name: CONFIG.name,
                symbol: CONFIG.symbol,
                baseUri: CONFIG.baseUri
            })
            .accounts({
                authority: adminWallet.publicKey,
                nonTransferableProject: nonTransferableProject,
                nonTransferableProjectMint: nonTransferableProjectMint,
                tokenProgram: TOKEN_2022_PROGRAM_ID,
                systemProgram: SystemProgram.programId,
                rent: new PublicKey("SysvarRent111111111111111111111111111111111"),
            })
            .signers([adminWallet])
            .preInstructions([ix])
            .rpc();
        
        const balanceAfter = await connection.getBalance(adminWallet.publicKey);
        const cost = (balanceBefore - balanceAfter) / LAMPORTS_PER_SOL;
        
        console.log(`✅ 项目初始化成功!`);
        console.log(`  交易: ${initTx}`);
        console.log(`  成本: ${cost.toFixed(6)} SOL`);
        
        // 7. 设置铸造价格
        if (CONFIG.mintPrice > 0) {
            console.log("\n⚙️  设置铸造价格...");
            
            const mintPriceLamports = Math.floor(CONFIG.mintPrice * LAMPORTS_PER_SOL);
            
            const priceTx = await program.methods
                .setMintPrice(mintPriceLamports)
                .accounts({
                    authority: adminWallet.publicKey,
                    nonTransferableProject: nonTransferableProject,
                })
                .signers([adminWallet])
                .rpc();
            
            console.log(`✅ 铸造价格已设置: ${CONFIG.mintPrice} SOL`);
            console.log(`  交易: ${priceTx}`);
        }
        
        // 8. 验证初始化
        console.log("\n✅ 验证初始化结果...");
        
        const projectData = await program.account.nonTransferableProject.fetch(nonTransferableProject);
        console.log("📋 项目信息:");
        console.log(`  名称: ${projectData.name}`);
        console.log(`  符号: ${projectData.symbol}`);
        console.log(`  基础 URI: ${projectData.baseUri}`);
        console.log(`  管理员: ${projectData.authority.toString()}`);
        console.log(`  操作员数量: ${projectData.operators.length}`);
        console.log(`  铸造价格: ${projectData.mintPrice} lamports (${projectData.mintPrice / LAMPORTS_PER_SOL} SOL)`);
        
        // 9. 保存初始化信息
        const initInfo = {
            timestamp: new Date().toISOString(),
            network: "devnet",
            programId: CONFIG.programId,
            projectPDA: nonTransferableProject.toString(),
            projectMintPDA: nonTransferableProjectMint.toString(),
            authority: adminWallet.publicKey.toString(),
            initTransaction: initTx,
            config: CONFIG,
            cost: cost
        };
        
        const filename = `project-init-${Date.now()}.json`;
        fs.writeFileSync(filename, JSON.stringify(initInfo, null, 2));
        
        console.log(`\n📄 初始化信息已保存: ${filename}`);
        console.log("\n🎉 项目初始化完成!");
        console.log("现在可以开始发行 DID 了。");
        
    } catch (error) {
        console.error("❌ 初始化失败:", error.message);
        
        if (error.logs) {
            console.log("错误日志:");
            error.logs.forEach(log => console.log(`  ${log}`));
        }
        
        throw error;
    }
}

if (require.main === module) {
    main().catch(error => {
        console.error("\n❌ 脚本执行失败:", error.message);
        process.exit(1);
    });
}