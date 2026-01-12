#!/usr/bin/env ts-node
/**
 * Solana DID 发行脚本
 * 参照 EVM 版本参数，为指定钱包发行 Legal DID
 */

import { 
    Connection, 
    PublicKey, 
    Keypair, 
    clusterApiUrl,
    LAMPORTS_PER_SOL,
    ComputeBudgetProgram
} from '@solana/web3.js';
import { 
    Program, 
    AnchorProvider, 
    Wallet, 
    setProvider 
} from '@coral-xyz/anchor';
import { 
    ASSOCIATED_TOKEN_PROGRAM_ID, 
    getAssociatedTokenAddressSync, 
    TOKEN_2022_PROGRAM_ID 
} from '@solana/spl-token';
import { Legaldid } from '../target/types/legaldid';
import { BN } from '@coral-xyz/anchor';
import * as fs from 'fs';
import * as path from 'path';

// 配置参数 (参照 EVM 版本)
const CONFIG = {
    // 合约参数 (对应 EVM deployment-config.json)
    name: "Legal DID",
    symbol: "LDID", 
    baseUri: "https://api.rns.id/api/v2/portal/identity/nft/",
    mintPrice: 0.01, // SOL (对应 EVM 的 0.01 ETH)
    
    // 网络配置
    network: "devnet", // devnet | mainnet-beta
    programId: "Ce84NtGdKYpxkFpvWn7a5qqBXzkBfEhXM7gg49NtGuhM",
    
    // 目标钱包
    targetWallet: "EuWtasWBcuESn5Mt1R5a4AVja2xsHtFMLs8YWiMfJX8A",
    
    // DID 参数
    rnsId: `did-${Date.now()}`, // 唯一标识符
    merkleRoot: "0x764e6372e05f4db05595276214e74f047a6562f19bf6cc3bb35a53ac892c3ce3", // 默认 merkle root
};

// PDA 前缀常量
const NON_TRANSFERABLE_PROJECT_PREFIX = "nt-proj-v5";
const NON_TRANSFERABLE_NFT_MINT_PREFIX = "nt-nft-mint-v5";

class SolanaDIDMinter {
    private connection: Connection;
    private program: Program<Legaldid>;
    private adminWallet: Keypair;
    private targetWallet: PublicKey;
    
    // PDA 地址
    private nonTransferableProject: PublicKey;
    private nonTransferableProjectMint: PublicKey;
    private nonTransferableNftMint: PublicKey;
    private userTokenAccount: PublicKey;

    constructor() {
        // 初始化连接
        const rpcUrl = CONFIG.network === "devnet" 
            ? clusterApiUrl("devnet")
            : clusterApiUrl("mainnet-beta");
        
        this.connection = new Connection(rpcUrl, "confirmed");
        
        // 加载管理员钱包 (需要有 SECONDARY_ADMIN 权限)
        this.loadAdminWallet();
        
        // 设置目标钱包
        this.targetWallet = new PublicKey(CONFIG.targetWallet);
        
        // 初始化 Anchor
        this.initializeAnchor();
        
        // 计算 PDA 地址
        this.calculatePDAs();
    }

    private loadAdminWallet() {
        // 尝试从环境变量或文件加载管理员私钥
        const privateKeyPath = path.join(process.cwd(), 'admin-keypair.json');
        
        if (process.env.ADMIN_PRIVATE_KEY) {
            // 从环境变量加载
            const privateKeyArray = JSON.parse(process.env.ADMIN_PRIVATE_KEY);
            this.adminWallet = Keypair.fromSecretKey(new Uint8Array(privateKeyArray));
        } else if (fs.existsSync(privateKeyPath)) {
            // 从文件加载
            const privateKeyData = JSON.parse(fs.readFileSync(privateKeyPath, 'utf8'));
            this.adminWallet = Keypair.fromSecretKey(new Uint8Array(privateKeyData));
        } else {
            // 生成新的管理员钱包 (仅用于测试)
            console.log("⚠️  未找到管理员私钥，生成临时钱包 (仅用于测试)");
            this.adminWallet = Keypair.generate();
            
            // 保存到文件
            fs.writeFileSync(
                privateKeyPath, 
                JSON.stringify(Array.from(this.adminWallet.secretKey))
            );
            console.log(`📁 管理员钱包已保存到: ${privateKeyPath}`);
        }
        
        console.log(`👤 管理员钱包: ${this.adminWallet.publicKey.toString()}`);
    }

    private initializeAnchor() {
        const wallet = new Wallet(this.adminWallet);
        const provider = new AnchorProvider(this.connection, wallet, {
            commitment: "confirmed"
        });
        setProvider(provider);
        
        // 加载程序
        const programId = new PublicKey(CONFIG.programId);
        this.program = new Program<Legaldid>(
            require('../target/idl/legaldid.json') as Legaldid,
            programId,
            provider
        );
    }

    private calculatePDAs() {
        const programId = this.program.programId;
        const index = CONFIG.rnsId; // 使用 rnsId 作为 index
        
        // 项目 PDA
        [this.nonTransferableProject] = PublicKey.findProgramAddressSync(
            [Buffer.from(NON_TRANSFERABLE_PROJECT_PREFIX)],
            programId
        );

        // 项目 Mint PDA
        [this.nonTransferableProjectMint] = PublicKey.findProgramAddressSync(
            [Buffer.from("nt-project-mint-v5")],
            programId
        );

        // NFT Mint PDA
        [this.nonTransferableNftMint] = PublicKey.findProgramAddressSync(
            [Buffer.from(NON_TRANSFERABLE_NFT_MINT_PREFIX), Buffer.from(index)],
            programId
        );

        // 用户 Token 账户
        this.userTokenAccount = getAssociatedTokenAddressSync(
            this.nonTransferableNftMint,
            this.targetWallet,
            false,
            TOKEN_2022_PROGRAM_ID
        );

        console.log("📍 PDA 地址:");
        console.log(`  项目: ${this.nonTransferableProject.toString()}`);
        console.log(`  项目 Mint: ${this.nonTransferableProjectMint.toString()}`);
        console.log(`  NFT Mint: ${this.nonTransferableNftMint.toString()}`);
        console.log(`  用户 Token 账户: ${this.userTokenAccount.toString()}`);
    }

    async checkBalances() {
        console.log("\n💰 余额检查:");
        
        const adminBalance = await this.connection.getBalance(this.adminWallet.publicKey);
        console.log(`  管理员: ${(adminBalance / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
        
        const userBalance = await this.connection.getBalance(this.targetWallet);
        console.log(`  目标用户: ${(userBalance / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
        
        // 检查管理员余额是否足够
        const minBalance = 0.1 * LAMPORTS_PER_SOL; // 至少需要 0.1 SOL
        if (adminBalance < minBalance) {
            throw new Error(`管理员余额不足，至少需要 0.1 SOL，当前: ${(adminBalance / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
        }
    }

    async checkProjectStatus() {
        console.log("\n🔍 检查项目状态:");
        
        try {
            const projectAccount = await this.program.account.projectAccount.fetch(
                this.nonTransferableProject
            );
            
            console.log("  ✅ 项目已初始化");
            console.log(`  名称: ${projectAccount.name}`);
            console.log(`  符号: ${projectAccount.symbol}`);
            console.log(`  基础 URI: ${projectAccount.baseUri}`);
            console.log(`  铸造价格: ${projectAccount.mintPrice} lamports`);
            console.log(`  管理员: ${projectAccount.authority.toString()}`);
            console.log(`  操作员数量: ${projectAccount.operators.length}`);
            
            // 检查当前钱包是否有权限
            const isAdmin = projectAccount.authority.equals(this.adminWallet.publicKey);
            const isOperator = projectAccount.operators.some((op: any) => op.equals(this.adminWallet.publicKey));
            
            if (!isAdmin && !isOperator) {
                throw new Error("当前钱包没有管理员或操作员权限");
            }
            
            console.log(`  ✅ 权限检查通过 (${isAdmin ? '管理员' : '操作员'})`);
            
            return projectAccount;
            
        } catch (error) {
            console.log("  ❌ 项目未初始化，需要先初始化项目");
            throw error;
        }
    }

    async initializeProject() {
        console.log("\n🚀 初始化项目:");
        
        const ix = ComputeBudgetProgram.setComputeUnitLimit({ units: 1_000_000 });
        
        const tx = await this.program.methods
            .initialize({
                name: CONFIG.name,
                symbol: CONFIG.symbol,
                baseUri: CONFIG.baseUri
            })
            .accountsPartial({
                authority: this.adminWallet.publicKey,
                nonTransferableProject: this.nonTransferableProject,
                nonTransferableProjectMint: this.nonTransferableProjectMint,
                tokenProgram: TOKEN_2022_PROGRAM_ID,
            })
            .signers([this.adminWallet])
            .preInstructions([ix])
            .rpc();
        
        console.log(`  ✅ 项目初始化成功`);
        console.log(`  交易: ${tx}`);
        
        // 设置铸造价格
        if (CONFIG.mintPrice > 0) {
            const mintPriceLamports = Math.floor(CONFIG.mintPrice * LAMPORTS_PER_SOL);
            
            const priceTx = await this.program.methods
                .setMintPrice(new BN(mintPriceLamports))
                .accountsPartial({
                    authority: this.adminWallet.publicKey,
                    nonTransferableProject: this.nonTransferableProject,
                })
                .signers([this.adminWallet])
                .rpc();
            
            console.log(`  ✅ 铸造价格已设置: ${CONFIG.mintPrice} SOL`);
            console.log(`  交易: ${priceTx}`);
        }
    }

    async mintDID() {
        console.log("\n🎯 开始发行 DID:");
        console.log(`  目标钱包: ${this.targetWallet.toString()}`);
        console.log(`  RNS ID: ${CONFIG.rnsId}`);
        console.log(`  Merkle Root: ${CONFIG.merkleRoot}`);
        
        const adminBalanceBefore = await this.connection.getBalance(this.adminWallet.publicKey);
        
        const ix = ComputeBudgetProgram.setComputeUnitLimit({ units: 1_000_000 });
        
        try {
            const tx = await this.program.methods
                .airdrop(
                    CONFIG.rnsId,
                    this.targetWallet,
                    CONFIG.merkleRoot
                )
                .accountsPartial({
                    authority: this.adminWallet.publicKey,
                    nonTransferableProject: this.nonTransferableProject,
                    nonTransferableNftMint: this.nonTransferableNftMint,
                    userAccount: this.targetWallet,
                    userTokenAccount: this.userTokenAccount,
                    collectionMint: this.nonTransferableProjectMint,
                    associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
                    tokenProgram: TOKEN_2022_PROGRAM_ID,
                })
                .signers([this.adminWallet])
                .preInstructions([ix])
                .rpc();
            
            const adminBalanceAfter = await this.connection.getBalance(this.adminWallet.publicKey);
            const cost = (adminBalanceBefore - adminBalanceAfter) / LAMPORTS_PER_SOL;
            
            console.log("  ✅ DID 发行成功!");
            console.log(`  交易: ${tx}`);
            console.log(`  成本: ${cost.toFixed(6)} SOL`);
            console.log(`  成本 (USD @ $140): $${(cost * 140).toFixed(2)}`);
            
            // 验证 NFT
            await this.verifyNFT();
            
            return {
                transactionId: tx,
                mintAddress: this.nonTransferableNftMint.toString(),
                tokenAccount: this.userTokenAccount.toString(),
                cost: cost
            };
            
        } catch (error) {
            console.error("  ❌ DID 发行失败:", error);
            throw error;
        }
    }

    async verifyNFT() {
        console.log("\n✅ 验证 NFT:");
        
        // 检查 Mint 账户
        const mintInfo = await this.connection.getAccountInfo(this.nonTransferableNftMint);
        if (mintInfo) {
            console.log("  ✅ NFT Mint 账户存在");
            console.log(`  所有者: ${mintInfo.owner.toString()}`);
        } else {
            throw new Error("NFT Mint 账户不存在");
        }
        
        // 检查用户 Token 账户
        const tokenAccountInfo = await this.connection.getAccountInfo(this.userTokenAccount);
        if (tokenAccountInfo) {
            console.log("  ✅ 用户 Token 账户存在");
        } else {
            throw new Error("用户 Token 账户不存在");
        }
        
        // 获取浏览器链接
        const explorerUrl = CONFIG.network === "devnet" 
            ? `https://explorer.solana.com/address/${this.nonTransferableNftMint.toString()}?cluster=devnet`
            : `https://explorer.solana.com/address/${this.nonTransferableNftMint.toString()}`;
        
        console.log(`  🔗 浏览器链接: ${explorerUrl}`);
    }

    async saveMintInfo(result: any) {
        const mintInfo = {
            timestamp: new Date().toISOString(),
            network: CONFIG.network,
            programId: CONFIG.programId,
            targetWallet: CONFIG.targetWallet,
            rnsId: CONFIG.rnsId,
            merkleRoot: CONFIG.merkleRoot,
            mintAddress: result.mintAddress,
            tokenAccount: result.tokenAccount,
            transactionId: result.transactionId,
            cost: result.cost,
            explorerUrl: CONFIG.network === "devnet" 
                ? `https://explorer.solana.com/address/${result.mintAddress}?cluster=devnet`
                : `https://explorer.solana.com/address/${result.mintAddress}`,
            config: CONFIG
        };
        
        const filename = `did-mint-${CONFIG.rnsId}-${Date.now()}.json`;
        fs.writeFileSync(filename, JSON.stringify(mintInfo, null, 2));
        
        console.log(`\n📄 发行信息已保存: ${filename}`);
        
        return mintInfo;
    }
}

async function main() {
    console.log("=== Solana Legal DID 发行脚本 ===");
    console.log("参照 EVM 版本参数，为指定钱包发行 DID");
    console.log("");
    
    const minter = new SolanaDIDMinter();
    
    try {
        // 1. 检查余额
        await minter.checkBalances();
        
        // 2. 检查项目状态
        try {
            await minter.checkProjectStatus();
        } catch (error) {
            console.log("项目未初始化，开始初始化...");
            await minter.initializeProject();
        }
        
        // 3. 发行 DID
        const result = await minter.mintDID();
        
        // 4. 保存信息
        const mintInfo = await minter.saveMintInfo(result);
        
        console.log("\n🎉 DID 发行完成!");
        console.log("📋 发行摘要:");
        console.log(`  目标钱包: ${CONFIG.targetWallet}`);
        console.log(`  NFT 地址: ${result.mintAddress}`);
        console.log(`  交易 ID: ${result.transactionId}`);
        console.log(`  成本: ${result.cost.toFixed(6)} SOL`);
        console.log(`  浏览器: ${mintInfo.explorerUrl}`);
        
    } catch (error) {
        console.error("\n❌ 发行失败:", error.message);
        process.exit(1);
    }
}

// 如果直接运行此脚本
if (require.main === module) {
    main().catch(console.error);
}

export { SolanaDIDMinter, CONFIG };