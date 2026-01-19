#!/usr/bin/env ts-node
/**
 * Solana Legal DID - 用户请求铸造 (authorize_mint)
 * 用户支付费用，请求铸造 DID
 * 
 * Usage:
 *   ts-node authorize-mint.ts [network] <order_id>
 *   network: devnet (default) | mainnet | localnet
 */

import { 
    Connection, 
    PublicKey, 
    Keypair,
    SystemProgram,
    LAMPORTS_PER_SOL
} from '@solana/web3.js';
import { Program, AnchorProvider, Wallet } from '@coral-xyz/anchor';
import * as bs58 from 'bs58';
import * as dotenv from 'dotenv';
import { getNetworkConfig, getExplorerLink, NetworkConfig } from '../../config';

dotenv.config();

// 授权结果接口
interface AuthorizeMintResult {
    success: boolean;
    signature?: string;
    orderId: string;
    payer: string;
    amount: number;
    error?: string;
}

export class AuthorizeMintManager {
    private connection: Connection;
    private program: Program<any>;
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
     * 获取用户钱包
     */
    private getUserWallet(): Keypair {
        const userPrivateKey = process.env.USER_PRIVATE_KEY;
        if (!userPrivateKey) {
            throw new Error("USER_PRIVATE_KEY 环境变量未设置");
        }
        
        return Keypair.fromSecretKey(bs58.decode(userPrivateKey));
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
            this.program = new Program(localIdl, provider);
        } else {
            this.program = new Program(idl, provider);
        }
    }
    
    /**
     * 查询当前铸造价格
     */
    async getMintPrice(): Promise<number> {
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
     * 用户请求铸造 DID
     */
    async authorizeMint(orderId: string): Promise<AuthorizeMintResult> {
        try {
            console.log("🚀 用户请求铸造 DID (authorize_mint)");
            console.log("=" .repeat(40));
            console.log(`📡 网络: ${this.network.toUpperCase()}`);
            console.log(`📋 订单ID: ${orderId}`);
            console.log("");
            
            // 获取用户钱包
            const userWallet = this.getUserWallet();
            console.log(`👤 用户钱包: ${userWallet.publicKey.toString()}`);
            
            // 初始化程序
            await this.initializeProgram(userWallet);
            
            console.log(`📍 项目 PDA: ${this.projectPDA.toString()}`);
            console.log(`🏗️  程序 ID: ${this.config.programId}`);
            console.log("");
            
            // 查询铸造价格
            const mintPrice = await this.getMintPrice();
            const mintPriceSOL = mintPrice / LAMPORTS_PER_SOL;
            
            console.log(`💰 铸造价格: ${mintPriceSOL} SOL (${mintPrice} lamports)`);
            
            // 检查用户余额
            const balance = await this.connection.getBalance(userWallet.publicKey);
            const balanceSOL = balance / LAMPORTS_PER_SOL;
            
            console.log(`💳 用户余额: ${balanceSOL} SOL`);
            
            if (balance < mintPrice) {
                throw new Error(`余额不足。需要: ${mintPriceSOL} SOL, 当前: ${balanceSOL} SOL`);
            }
            
            console.log("✅ 余额充足");
            console.log("");
            
            // 执行 authorize_mint
            console.log("📤 发送 authorize_mint 交易...");
            
            const tx = await (this.program.methods as any)
                .authorizeMint(orderId)
                .accounts({
                    payer: userWallet.publicKey,
                    nonTransferableProject: this.projectPDA,
                    systemProgram: SystemProgram.programId,
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
            
            // 显示链接
            this.showExplorerLinks(tx, userWallet.publicKey);
            
            return {
                success: true,
                signature: tx,
                orderId,
                payer: userWallet.publicKey.toString(),
                amount: mintPrice
            };
            
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error("❌ 请求铸造失败:");
            console.error(`  错误: ${errorMessage}`);
            
            this.showTroubleshooting(errorMessage);
            
            return {
                success: false,
                orderId,
                payer: '',
                amount: 0,
                error: errorMessage
            };
        }
    }
    
    /**
     * 显示浏览器链接
     */
    private showExplorerLinks(signature: string, payer: PublicKey): void {
        console.log("🔗 浏览器链接:");
        console.log(`  交易: ${getExplorerLink(signature, this.network, 'tx')}`);
        console.log(`  项目账户: ${getExplorerLink(this.projectPDA.toString(), this.network)}`);
        console.log(`  用户钱包: ${getExplorerLink(payer.toString(), this.network)}`);
        
        console.log("");
        console.log("💡 下一步:");
        console.log("  1. 后端监听 AuthorizeMintEvent 事件");
        console.log("  2. 审核通过后，调用 airdrop 发行 DID");
        console.log("  3. 用户将收到 DID NFT");
    }
    
    /**
     * 显示故障排除信息
     */
    private showTroubleshooting(errorMessage: string): void {
        console.log("");
        
        if (errorMessage.includes("余额不足") || errorMessage.includes("balance")) {
            console.log("🔧 余额问题解决方案:");
            console.log("  1. 向用户钱包转入更多 SOL");
            console.log("  2. 检查铸造价格是否正确");
        } else if (errorMessage.includes("项目尚未初始化")) {
            console.log("🔧 项目问题解决方案:");
            console.log("  1. 确认项目已正确初始化");
            console.log("  2. 检查程序 ID 是否正确");
        } else if (errorMessage.includes("USER_PRIVATE_KEY")) {
            console.log("🔧 配置问题解决方案:");
            console.log("  1. 在 .env 文件中设置 USER_PRIVATE_KEY");
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
    const orderId = process.argv[3];
    
    if (!orderId) {
        console.error("❌ 请提供订单ID");
        console.log("用法: npx ts-node scripts/authorize-mint.ts [network] <order_id>");
        console.log("示例: npx ts-node scripts/authorize-mint.ts devnet order-12345");
        process.exit(1);
    }
    
    try {
        const manager = new AuthorizeMintManager(network);
        const result = await manager.authorizeMint(orderId);
        
        if (result.success) {
            console.log("");
            console.log("🎉 铸造请求已提交！");
            console.log(`📋 订单ID: ${result.orderId}`);
            console.log(`💰 支付金额: ${result.amount / LAMPORTS_PER_SOL} SOL`);
            console.log(`📋 交易: ${result.signature}`);
            console.log("");
            console.log("⏳ 等待后端审核和发行...");
        } else {
            console.log("");
            console.log("❌ 铸造请求失败，请检查上述错误信息并重试");
            process.exit(1);
        }
        
    } catch (error) {
        console.error("脚本执行失败:", error instanceof Error ? error.message : String(error));
        process.exit(1);
    }
}

// 如果直接运行此脚本
if (require.main === module) {
    main().catch((error) => {
        console.error('Script failed:', error);
        process.exit(1);
    });
}