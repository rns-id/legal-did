#!/usr/bin/env node
/**
 * 简化版 Solana DID 发行脚本
 * 直接使用 JavaScript，无需 TypeScript 编译
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
    Program, 
    AnchorProvider, 
    Wallet, 
    setProvider 
} = require('@coral-xyz/anchor');

const { 
    ASSOCIATED_TOKEN_PROGRAM_ID, 
    getAssociatedTokenAddressSync, 
    TOKEN_2022_PROGRAM_ID 
} = require('@solana/spl-token');

const fs = require('fs');
const path = require('path');

// 配置参数
const CONFIG = {
    name: "Legal DID",
    symbol: "LDID", 
    baseUri: "https://api.rns.id/api/v2/portal/identity/nft/",
    mintPrice: 0.001, // 0.001 SOL (便宜一些用于测试)
    
    network: "devnet",
    programId: "Ce84NtGdKYpxkFpvWn7a5qqBXzkBfEhXM7gg49NtGuhM",
    
    // 目标钱包
    targetWallet: "EuWtasWBcuESn5Mt1R5a4AVja2xsHtFMLs8YWiMfJX8A",
    
    // DID 参数
    rnsId: `did-${Date.now()}`,
    merkleRoot: "0x764e6372e05f4db05595276214e74f047a6562f19bf6cc3bb35a53ac892c3ce3",
};

// PDA 前缀
const NON_TRANSFERABLE_PROJECT_PREFIX = "nt-proj-v5";
const NON_TRANSFERABLE_NFT_MINT_PREFIX = "nt-nft-mint-v5";

async function main() {
    console.log("=== Solana Legal DID 发行脚本 ===");
    console.log(`目标钱包: ${CONFIG.targetWallet}`);
    console.log("");

    // 1. 初始化连接
    const connection = new Connection(clusterApiUrl("devnet"), "confirmed");
    
    // 2. 加载管理员钱包 (使用当前 Solana CLI 钱包)
    const keypairPath = path.join(process.env.HOME, '.config/solana/id.json');
    const keypairData = JSON.parse(fs.readFileSync(keypairPath, 'utf8'));
    const adminWallet = Keypair.fromSecretKey(new Uint8Array(keypairData));
    
    console.log(`👤 管理员钱包: ${adminWallet.publicKey.toString()}`);
    
    // 3. 检查余额
    const adminBalance = await connection.getBalance(adminWallet.publicKey);
    console.log(`💰 管理员余额: ${(adminBalance / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
    
    if (adminBalance < 0.1 * LAMPORTS_PER_SOL) {
        throw new Error("余额不足，至少需要 0.1 SOL");
    }
    
    // 4. 初始化 Anchor
    const wallet = new Wallet(adminWallet);
    const provider = new AnchorProvider(connection, wallet, { commitment: "confirmed" });
    setProvider(provider);
    
    // 5. 加载程序 IDL
    const programId = new PublicKey(CONFIG.programId);
    
    // 直接使用程序 ID 创建程序实例，让 Anchor 自动获取 IDL
    let program;
    try {
        program = await Program.at(programId, provider);
    } catch (error) {
        // 如果自动获取失败，尝试从本地文件加载
        const idlPath = path.join(__dirname, '../target/idl/legaldid.json');
        if (fs.existsSync(idlPath)) {
            const idl = JSON.parse(fs.readFileSync(idlPath, 'utf8'));
            program = new Program(idl, programId, provider);
        } else {
            throw new Error("无法加载程序 IDL");
        }
    }
    
    console.log(`📋 程序 ID: ${programId.toString()}`);
    
    // 6. 计算 PDA 地址
    const index = CONFIG.rnsId;
    
    const [nonTransferableProject] = PublicKey.findProgramAddressSync(
        [Buffer.from(NON_TRANSFERABLE_PROJECT_PREFIX)],
        programId
    );

    const [nonTransferableProjectMint] = PublicKey.findProgramAddressSync(
        [Buffer.from("nt-project-mint-v5")],
        programId
    );

    const [nonTransferableNftMint] = PublicKey.findProgramAddressSync(
        [Buffer.from(NON_TRANSFERABLE_NFT_MINT_PREFIX), Buffer.from(index)],
        programId
    );

    const targetWallet = new PublicKey(CONFIG.targetWallet);
    const userTokenAccount = getAssociatedTokenAddressSync(
        nonTransferableNftMint,
        targetWallet,
        false,
        TOKEN_2022_PROGRAM_ID
    );

    console.log("📍 PDA 地址:");
    console.log(`  项目: ${nonTransferableProject.toString()}`);
    console.log(`  NFT Mint: ${nonTransferableNftMint.toString()}`);
    console.log(`  用户 Token 账户: ${userTokenAccount.toString()}`);
    
    // 7. 检查项目是否已初始化
    let projectInitialized = false;
    try {
        const projectAccount = await program.account.nonTransferableProject.fetch(nonTransferableProject);
        console.log("\n✅ 项目已初始化");
        console.log(`  名称: ${projectAccount.name}`);
        console.log(`  符号: ${projectAccount.symbol}`);
        console.log(`  管理员: ${projectAccount.authority.toString()}`);
        projectInitialized = true;
    } catch (error) {
        console.log("\n⚠️  项目未初始化，需要先初始化");
    }
    
    // 8. 如果未初始化，先初始化项目
    if (!projectInitialized) {
        console.log("\n🚀 初始化项目...");
        
        const ix = ComputeBudgetProgram.setComputeUnitLimit({ units: 1_000_000 });
        
        try {
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
            
            console.log(`  ✅ 项目初始化成功: ${initTx}`);
            
            // 设置铸造价格
            const mintPriceLamports = Math.floor(CONFIG.mintPrice * LAMPORTS_PER_SOL);
            const priceTx = await program.methods
                .setMintPrice(mintPriceLamports)
                .accounts({
                    authority: adminWallet.publicKey,
                    nonTransferableProject: nonTransferableProject,
                })
                .signers([adminWallet])
                .rpc();
            
            console.log(`  ✅ 铸造价格已设置: ${CONFIG.mintPrice} SOL (${priceTx})`);
            
        } catch (error) {
            console.error("❌ 初始化失败:", error.message);
            throw error;
        }
    }
    
    // 9. 发行 DID
    console.log("\n🎯 开始发行 DID...");
    console.log(`  RNS ID: ${CONFIG.rnsId}`);
    
    const adminBalanceBefore = await connection.getBalance(adminWallet.publicKey);
    
    try {
        const ix = ComputeBudgetProgram.setComputeUnitLimit({ units: 1_000_000 });
        
        const mintTx = await program.methods
            .airdrop(
                CONFIG.rnsId,
                targetWallet,
                CONFIG.merkleRoot,
                CONFIG.rnsId
            )
            .accounts({
                authority: adminWallet.publicKey,
                nonTransferableProject: nonTransferableProject,
                nonTransferableNftMint: nonTransferableNftMint,
                userAccount: targetWallet,
                userTokenAccount: userTokenAccount,
                collectionMint: nonTransferableProjectMint,
                associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
                tokenProgram: TOKEN_2022_PROGRAM_ID,
                systemProgram: SystemProgram.programId,
                rent: new PublicKey("SysvarRent111111111111111111111111111111111"),
            })
            .signers([adminWallet])
            .preInstructions([ix])
            .rpc();
        
        const adminBalanceAfter = await connection.getBalance(adminWallet.publicKey);
        const cost = (adminBalanceBefore - adminBalanceAfter) / LAMPORTS_PER_SOL;
        
        console.log("  ✅ DID 发行成功!");
        console.log(`  交易: ${mintTx}`);
        console.log(`  成本: ${cost.toFixed(6)} SOL`);
        
        // 10. 验证 NFT
        console.log("\n✅ 验证 NFT:");
        
        const mintInfo = await connection.getAccountInfo(nonTransferableNftMint);
        if (mintInfo) {
            console.log("  ✅ NFT Mint 账户存在");
        }
        
        const tokenAccountInfo = await connection.getAccountInfo(userTokenAccount);
        if (tokenAccountInfo) {
            console.log("  ✅ 用户 Token 账户存在");
        }
        
        const explorerUrl = `https://explorer.solana.com/address/${nonTransferableNftMint.toString()}?cluster=devnet`;
        console.log(`  🔗 浏览器: ${explorerUrl}`);
        
        // 11. 保存发行信息
        const mintResult = {
            timestamp: new Date().toISOString(),
            network: CONFIG.network,
            programId: CONFIG.programId,
            targetWallet: CONFIG.targetWallet,
            rnsId: CONFIG.rnsId,
            mintAddress: nonTransferableNftMint.toString(),
            tokenAccount: userTokenAccount.toString(),
            transactionId: mintTx,
            cost: cost,
            explorerUrl: explorerUrl
        };
        
        const filename = `did-mint-${CONFIG.rnsId}.json`;
        fs.writeFileSync(filename, JSON.stringify(mintResult, null, 2));
        
        console.log(`\n📄 发行信息已保存: ${filename}`);
        
        console.log("\n🎉 DID 发行完成!");
        console.log("📋 摘要:");
        console.log(`  目标钱包: ${CONFIG.targetWallet}`);
        console.log(`  NFT 地址: ${nonTransferableNftMint.toString()}`);
        console.log(`  交易 ID: ${mintTx}`);
        console.log(`  成本: ${cost.toFixed(6)} SOL`);
        console.log(`  浏览器: ${explorerUrl}`);
        
    } catch (error) {
        console.error("❌ DID 发行失败:", error.message);
        
        // 打印详细错误信息
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