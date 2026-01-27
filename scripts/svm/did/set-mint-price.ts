#!/usr/bin/env ts-node
/**
 * Solana Legal DID - 设置铸造价格 (set_mint_price)
 * Authority 设置 DID 铸造价格
 * 
 * Usage:
 *   ts-node set-mint-price.ts [network] <price_in_sol>
 *   network: devnet (default) | mainnet | localnet
 */

import { 
    Connection, 
    PublicKey, 
    Keypair,
    LAMPORTS_PER_SOL
} from '@solana/web3.js';
import { Program, AnchorProvider, Wallet, BN } from '@coral-xyz/anchor';
import { Legaldid } from '../../../target/types/legaldid';
import * as bs58 from 'bs58';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { getNetworkConfig, getExplorerLink, NetworkConfig } from '../../config';

dotenv.config();

// 设置结果接口
interface SetPriceResult {
    success: boolean;
    signature?: string;
    oldPrice: number;
    newPrice: number;
    error?: string;
}

export class MintPriceManager {
    private connection: Connection;
    private program: Program<Legaldid>;
    private projectPDA: PublicKey;
    private config: NetworkConfig;
    
    constructor(private network: string = 'devnet') {
        this.config = getNetworkConfig(network);
        this.connection = new Connection(this.config.rpcUrl, "confirmed");
        
        // 计算项目PDA
        const programId = new PublicKey(this.config.programId);
        [this.projectPDA] = PublicKey.findProgramAddressSync(
            [Buffer.from("nt-proj-v5")],
            programId
        );
    }
    
    /**
     * 获取 Authority 钱包
     * 优先从 Solana CLI 配置的 keypair 文件读取
     */
    private getAuthorityWallet(): Keypair {
        const keypairPath = path.join(process.env.HOME || '', '.config/solana/id.json');
        if (fs.existsSync(keypairPath)) {
            const secretKey = JSON.parse(fs.readFileSync(keypairPath, 'utf-8'));
            return Keypair.fromSecretKey(Uint8Array.from(secretKey));
        }
        
        const authorityPrivateKey = process.env.SOLANA_PRIVATE_KEY;
        if (!authorityPrivateKey) {
            throw new Error("SOLANA_PRIVATE_KEY 环境变量未设置，且未找到 ~/.config/solana/id.json");
        }
        
        return Keypair.fromSecretKey(bs58.decode(authorityPrivateKey));
    }
    
    /**
     * 初始化 Anchor Program
     */
    private async initializeProgram(wallet: Keypair): Promise<void> {
        const anchorWallet = new Wallet(wallet);
        const provider = new AnchorProvider(this.connection, anchorWallet, {
            commitment: "confirmed"
        });
        
        const programId = new PublicKey(this.config.programId);
        const idl = await Program.fetchIdl(programId, provider);
        
        if (!idl) {
            // 如果无法从链上获取，使用本地 IDL
            const localIdl = require('../../../target/idl/legaldid.json');
            this.program = new Program(localIdl as Legaldid, provider);
        } else {
            this.program = new Program(idl as Legaldid, provider);
        }
    }
    
    /**
     * 查询当前铸造价格
     */
    async getCurrentPrice(): Promise<number> {
        try {
            const projectAccount = await this.connection.getAccountInfo(this.projectPDA);
            
            if (!projectAccount) {
                throw new Error("项目尚未初始化");
            }
            
            // 解析 mintPrice (offset: 8 + 32 = 40)
            const data = projectAccount.data;
            const mintPriceBuffer = data.subarray(40, 48);
            const mintPrice = Number(mintPriceBuffer.readBigUInt64LE(0));
            
            return mintPrice;
            
        } catch (error) {
            throw new Error(`查询铸造价格失败: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    
    /**
     * 设置铸造价格
     */
    async setMintPrice(priceInSOL: number): Promise<SetPriceResult> {
        try {
            console.log("🚀 设置 DID 铸造价格 (set_mint_price)");
            console.log("=" .repeat(40));
            console.log(`📡 网络: ${this.network.toUpperCase()}`);
            console.log(`💰 新价格: ${priceInSOL} SOL`);
            console.log("");
            
            // 获取 Authority 钱包
            const authorityWallet = this.getAuthorityWallet();
            console.log(`🔑 Authority 地址: ${authorityWallet.publicKey.toString()}`);
            
            // 初始化程序
            await this.initializeProgram(authorityWallet);
            
            console.log(`📍 项目 PDA: ${this.projectPDA.toString()}`);
            console.log(`🏗️  程序 ID: ${this.config.programId}`);
            console.log("");
            
            // 查询当前价格
            const oldPrice = await this.getCurrentPrice();
            const oldPriceSOL = oldPrice / LAMPORTS_PER_SOL;
            
            console.log(`📊 当前价格: ${oldPriceSOL} SOL (${oldPrice} lamports)`);
            
            // 转换新价格为 lamports
            const newPriceLamports = Math.floor(priceInSOL * LAMPORTS_PER_SOL);
            
            console.log(`📊 新价格: ${priceInSOL} SOL (${newPriceLamports} lamports)`);
            
            if (oldPrice === newPriceLamports) {
                console.log("⚠️  新价格与当前价格相同，无需更新");
                return {
                    success: true,
                    oldPrice,
                    newPrice: newPriceLamports
                };
            }
            
            console.log("");
            
            // 执行 set_mint_price
            console.log("📤 发送 set_mint_price 交易...");
            
            const tx = await this.program.methods
                .setMintPrice(new BN(newPriceLamports))
                .accounts({
                    authority: authorityWallet.publicKey,
                    nonTransferableProject: this.projectPDA,
                })
                .rpc();
            
            console.log("✅ 交易成功！");
            console.log(`📋 交易哈希: ${tx}`);
            console.log("");
            
            // 等待确认
            console.log("⏳ 等待交易确认...");
            await this.connection.confirmTransaction(tx, "confirmed");
            
            console.log("✅ 交易已确认");
            console.log("");
            
            // 验证新价格
            const verifiedPrice = await this.getCurrentPrice();
            const verifiedPriceSOL = verifiedPrice / LAMPORTS_PER_SOL;
            
            console.log("🔍 验证新价格:");
            console.log(`  设置的价格: ${priceInSOL} SOL`);
            console.log(`  实际价格: ${verifiedPriceSOL} SOL`);
            
            if (verifiedPrice === newPriceLamports) {
                console.log("  ✅ 价格设置成功");
            } else {
                console.log("  ⚠️  价格验证失败");
            }
            
            console.log("");
            
            // 显示链接
            this.showExplorerLinks(tx);
            
            return {
                success: true,
                signature: tx,
                oldPrice,
                newPrice: newPriceLamports
            };
            
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error("❌ 设置价格失败:");
            console.error(`  错误: ${errorMessage}`);
            
            this.showTroubleshooting(errorMessage);
            
            return {
                success: false,
                oldPrice: 0,
                newPrice: 0,
                error: errorMessage
            };
        }
    }
    
    /**
     * 显示浏览器链接
     */
    private showExplorerLinks(signature: string): void {
        console.log("🔗 浏览器链接:");
        console.log(`  交易: ${getExplorerLink(signature, this.network, 'tx')}`);
        console.log(`  项目账户: ${getExplorerLink(this.projectPDA.toString(), this.network)}`);
        
        console.log("");
        console.log("💡 下一步:");
        console.log(`  1. 验证价格: npx ts-node scripts/svm/did/query-price.ts ${this.network}`);
        console.log("  2. 通知前端团队更新价格显示");
        console.log("  3. 测试用户铸造流程");
    }
    
    /**
     * 显示故障排除信息
     */
    private showTroubleshooting(errorMessage: string): void {
        console.log("");
        
        if (errorMessage.includes("权限") || errorMessage.includes("authority")) {
            console.log("🔧 权限问题解决方案:");
            console.log("  1. 确认 SOLANA_PRIVATE_KEY 是正确的 Authority 私钥");
            console.log("  2. 检查当前钱包是否有 Authority 权限");
            console.log("  3. 验证项目是否已正确初始化");
        } else if (errorMessage.includes("项目尚未初始化")) {
            console.log("🔧 项目问题解决方案:");
            console.log("  1. 确认项目已正确初始化");
            console.log("  2. 检查程序 ID 是否正确");
            console.log("  3. 运行: node scripts/final-init.js");
        } else if (errorMessage.includes("SOLANA_PRIVATE_KEY")) {
            console.log("🔧 配置问题解决方案:");
            console.log("  1. 在 .env 文件中设置 SOLANA_PRIVATE_KEY");
            console.log("  2. 确保私钥格式正确 (Base58)");
        } else {
            console.log("🔧 通用解决方案:");
            console.log("  1. 检查网络连接");
            console.log("  2. 确认程序 ID 正确");
            console.log("  3. 验证环境变量配置");
            console.log("  4. 重试操作");
        }
    }
}

async function main(): Promise<void> {
    const network = process.argv[2] || 'devnet';
    const priceStr = process.argv[3];
    
    if (!priceStr) {
        console.error("❌ 请提供新的铸造价格 (SOL)");
        console.log("用法: npx ts-node scripts/set-mint-price.ts [network] <price_in_sol>");
        console.log("示例: npx ts-node scripts/set-mint-price.ts devnet 0.001");
        console.log("      npx ts-node scripts/set-mint-price.ts mainnet 0.01");
        process.exit(1);
    }
    
    const price = parseFloat(priceStr);
    
    if (isNaN(price) || price < 0) {
        console.error("❌ 无效的价格，必须是正数");
        process.exit(1);
    }
    
    try {
        const manager = new MintPriceManager(network);
        const result = await manager.setMintPrice(price);
        
        if (result.success) {
            console.log("");
            console.log("🎉 铸造价格设置成功！");
            console.log(`📊 旧价格: ${result.oldPrice / LAMPORTS_PER_SOL} SOL`);
            console.log(`📊 新价格: ${result.newPrice / LAMPORTS_PER_SOL} SOL`);
            if (result.signature) {
                console.log(`📋 交易: ${result.signature}`);
            }
        } else {
            console.log("");
            console.log("❌ 设置价格失败，请检查上述错误信息并重试");
            process.exit(1);
        }
        
    } catch (error) {
        console.error("脚本执行失败:", error instanceof Error ? error.message : String(error));
        process.exit(1);
    }
}

// 导出类和接口
export { SetPriceResult };

// 如果直接运行此脚本
if (require.main === module) {
    main().catch((error) => {
        console.error('Script failed:', error);
        process.exit(1);
    });
}