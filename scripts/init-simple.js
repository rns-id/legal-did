#!/usr/bin/env node
/**
 * 简化版项目初始化脚本
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

const CONFIG = {
    programId: "Ce84NtGdKYpxkFpvWn7a5qqBXzkBfEhXM7gg49NtGuhM",
    name: "Legal DID",
    symbol: "LDID", 
    baseUri: "https://api.rns.id/api/v2/portal/identity/nft/"
};

async function main() {
    console.log("=== 初始化 Legal DID 项目 ===");
    console.log("");
    
    try {
        // 1. 连接
        const connection = new Connection(clusterApiUrl("devnet"), "confirmed");
        
        // 2. 加载钱包
        const keypairPath = path.join(process.env.HOME, '.config/solana/id.json');
        const keypairData = JSON.parse(fs.readFileSync(keypairPath, 'utf8'));
        const adminWallet = Keypair.fromSecretKey(new Uint8Array(keypairData));
        
        console.log(`👤 管理员钱包: ${adminWallet.publicKey.toString()}`);
        
        const balance = await connection.getBalance(adminWallet.publicKey);
        console.log(`💰 余额: ${(balance / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
        
        // 3. 初始化 Anchor
        const wallet = new Wallet(adminWallet);
        const provider = new AnchorProvider(connection, wallet, { commitment: "confirmed" });
        setProvider(provider);
        
        // 4. 加载程序
        const programId = new PublicKey(CONFIG.programId);
        const idlPath = path.join(__dirname, '../target/idl/legaldid.json');
        const idl = JSON.parse(fs.readFileSync(idlPath, 'utf8'));
        const program = new Program(idl, programId, provider);
        
        console.log(`📋 程序 ID: ${programId.toString()}`);
        
        // 5. 计算 PDA
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
        
        // 6. 检查是否已初始化
        const projectAccount = await connection.getAccountInfo(projectPDA);
        if (projectAccount) {
            console.log("✅ 项目已经初始化");
            return;
        }
        
        // 7. 初始化项目
        console.log("\n🚀 开始初始化项目...");
        
        const balanceBefore = await connection.getBalance(adminWallet.publicKey);
        
        const ix = ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 });
        
        const tx = await program.methods
            .initialize({
                name: CONFIG.name,
                symbol: CONFIG.symbol,
                baseUri: CONFIG.baseUri
            })
            .accounts({
                authority: adminWallet.publicKey,
                nonTransferableProject: projectPDA,
                nonTransferableProjectMint: projectMintPDA,
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
        console.log(`  交易: ${tx}`);
        console.log(`  成本: ${cost.toFixed(6)} SOL`);
        console.log(`  浏览器: https://explorer.solana.com/tx/${tx}?cluster=devnet`);
        
        console.log("\n🎉 初始化完成!");
        
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