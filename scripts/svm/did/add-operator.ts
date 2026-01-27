#!/usr/bin/env ts-node
/**
 * 添加 Operator 到 Solana Legal DID 项目
 * 
 * Usage:
 *   ts-node add-operator.ts [network] <operator_address>
 *   network: devnet (default) | mainnet | localnet
 */

import { 
    Connection, 
    PublicKey, 
    Keypair, 
    Transaction, 
    TransactionInstruction,
    ConfirmOptions
} from '@solana/web3.js';
import * as bs58 from 'bs58';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { getNetworkConfig, getExplorerLink, NetworkConfig } from '../../config';

dotenv.config();

// 添加结果接口
interface AddOperatorResult {
    success: boolean;
    signature?: string;
    error?: string;
}

// 添加 operator 指令的判别器 (来自 IDL)
const ADD_OPERATOR_DISCRIMINATOR = Buffer.from([149, 142, 187, 68, 33, 250, 87, 105]);

export class OperatorManager {
    private connection: Connection;
    private programId: PublicKey;
    private projectPDA: PublicKey;
    private config: NetworkConfig;
    
    constructor(private network: string = 'devnet') {
        this.config = getNetworkConfig(network);
        this.connection = new Connection(this.config.rpcUrl, "confirmed");
        this.programId = new PublicKey(this.config.programId);
        
        // 计算项目PDA
        [this.projectPDA] = PublicKey.findProgramAddressSync(
            [Buffer.from("nt-proj-v5")],
            this.programId
        );
    }
    
    /**
     * 获取 Authority 钱包
     * 优先从 Solana CLI 配置的 keypair 文件读取，否则从环境变量读取
     */
    private getAuthorityWallet(): Keypair {
        // 优先从 Solana CLI 配置的 keypair 文件读取
        const keypairPath = path.join(process.env.HOME || '', '.config/solana/id.json');
        if (fs.existsSync(keypairPath)) {
            const secretKey = JSON.parse(fs.readFileSync(keypairPath, 'utf-8'));
            return Keypair.fromSecretKey(Uint8Array.from(secretKey));
        }
        
        // 否则从环境变量读取
        const authorityPrivateKey = process.env.SOLANA_PRIVATE_KEY;
        if (!authorityPrivateKey) {
            throw new Error("SOLANA_PRIVATE_KEY 环境变量未设置，且未找到 ~/.config/solana/id.json");
        }
        
        return Keypair.fromSecretKey(bs58.decode(authorityPrivateKey));
    }
    
    /**
     * 验证地址格式
     */
    private validateAddress(address: string): PublicKey {
        try {
            return new PublicKey(address);
        } catch (error) {
            throw new Error(`无效的地址格式: ${address}`);
        }
    }
    
    /**
     * 检查钱包余额
     */
    async checkBalance(wallet: PublicKey): Promise<number> {
        const balance = await this.connection.getBalance(wallet);
        return balance / 1000000000; // 转换为 SOL
    }
    
    /**
     * 添加 Operator
     */
    async addOperator(operatorAddress: string): Promise<AddOperatorResult> {
        try {
            console.log("🚀 添加 Operator 到 Solana Legal DID");
            console.log("=" .repeat(40));
            console.log(`📡 网络: ${this.network.toUpperCase()}`);
            console.log(`👤 目标 Operator: ${operatorAddress}`);
            console.log("");
            
            // 获取 Authority 钱包
            const authorityKeypair = this.getAuthorityWallet();
            console.log(`🔑 Authority 地址: ${authorityKeypair.publicKey.toString()}`);
            
            // 验证操作员地址
            const operatorPubkey = this.validateAddress(operatorAddress);
            
            console.log(`📍 项目 PDA: ${this.projectPDA.toString()}`);
            console.log(`🏗️  程序 ID: ${this.programId.toString()}`);
            console.log("");
            
            // 检查余额
            const balance = await this.checkBalance(authorityKeypair.publicKey);
            console.log(`💰 Authority 余额: ${balance} SOL`);
            
            if (balance < 0.01) {
                console.log("⚠️  余额较低，可能无法完成交易");
            }
            
            // 构造指令数据
            const instructionData = Buffer.concat([
                ADD_OPERATOR_DISCRIMINATOR,
                operatorPubkey.toBuffer()
            ]);
            
            console.log(`📝 指令数据长度: ${instructionData.length} bytes`);
            
            // 创建指令
            const addOperatorInstruction = new TransactionInstruction({
                keys: [
                    {
                        pubkey: authorityKeypair.publicKey,
                        isSigner: true,
                        isWritable: true
                    },
                    {
                        pubkey: this.projectPDA,
                        isSigner: false,
                        isWritable: true
                    }
                ],
                programId: this.programId,
                data: instructionData
            });
            
            // 创建交易
            const transaction = new Transaction();
            transaction.add(addOperatorInstruction);
            
            // 获取最新的 blockhash
            const { blockhash } = await this.connection.getLatestBlockhash();
            transaction.recentBlockhash = blockhash;
            transaction.feePayer = authorityKeypair.publicKey;
            
            // 签名交易
            transaction.sign(authorityKeypair);
            
            console.log("📤 发送交易...");
            
            // 发送交易
            const signature = await this.connection.sendRawTransaction(
                transaction.serialize(),
                {
                    skipPreflight: false,
                    preflightCommitment: "confirmed"
                }
            );
            
            console.log(`📋 交易哈希: ${signature}`);
            
            // 等待确认
            console.log("⏳ 等待交易确认...");
            const confirmation = await this.connection.confirmTransaction(
                signature, 
                "confirmed"
            );
            
            if (confirmation.value.err) {
                throw new Error(`交易失败: ${JSON.stringify(confirmation.value.err)}`);
            }
            
            console.log("✅ Operator 添加成功！");
            console.log("");
            
            // 显示链接
            this.showExplorerLinks(signature, operatorPubkey);
            
            return {
                success: true,
                signature
            };
            
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error("❌ 添加 Operator 失败:");
            console.error(`  错误: ${errorMessage}`);
            
            this.showTroubleshooting(errorMessage);
            
            return {
                success: false,
                error: errorMessage
            };
        }
    }
    
    /**
     * 显示浏览器链接
     */
    private showExplorerLinks(signature: string, operatorPubkey: PublicKey): void {
        console.log("🔗 浏览器链接:");
        console.log(`  交易: ${getExplorerLink(signature, this.network, 'tx')}`);
        console.log(`  项目账户: ${getExplorerLink(this.projectPDA.toString(), this.network)}`);
        console.log(`  新 Operator: ${getExplorerLink(operatorPubkey.toString(), this.network)}`);
        
        console.log("");
        console.log("🔍 验证结果:");
        console.log("运行以下命令查看更新后的 operators 列表:");
        console.log(`npx ts-node scripts/svm/did/query-operators.ts ${this.network}`);
    }
    
    /**
     * 显示故障排除信息
     */
    private showTroubleshooting(errorMessage: string): void {
        console.log("");
        
        if (errorMessage.includes("权限") || errorMessage.includes("authority")) {
            console.log("🔧 权限问题解决方案:");
            console.log("  1. 确认 SOLANA_PRIVATE_KEY 是正确的 Authority 私钥");
            console.log("  2. 检查当前网络配置");
            console.log("  3. 验证项目是否已正确初始化");
        } else if (errorMessage.includes("余额") || errorMessage.includes("balance")) {
            console.log("🔧 余额问题解决方案:");
            console.log("  1. 向 Authority 钱包转入更多 SOL");
            console.log("  2. 检查网络连接");
        } else if (errorMessage.includes("地址") || errorMessage.includes("address")) {
            console.log("🔧 地址问题解决方案:");
            console.log("  1. 检查 Operator 地址格式是否正确");
            console.log("  2. 确认地址是有效的 Solana 公钥");
        } else {
            console.log("🔧 通用解决方案:");
            console.log("  1. 检查网络连接");
            console.log("  2. 确认程序 ID 正确");
            console.log("  3. 验证环境变量配置");
            console.log("  4. 重试操作");
        }
    }
    
    /**
     * 获取项目信息
     */
    getProjectInfo(): { programId: string; projectPDA: string; network: string } {
        return {
            programId: this.programId.toString(),
            projectPDA: this.projectPDA.toString(),
            network: this.network
        };
    }
}

async function main(): Promise<void> {
    const network = process.argv[2] || 'devnet';
    const operatorAddress = process.argv[3];
    
    if (!operatorAddress) {
        console.error("❌ 请提供 Operator 地址");
        console.log("用法: npx ts-node scripts/add-operator-final.ts [network] <operator_address>");
        console.log("示例: npx ts-node scripts/add-operator-final.ts devnet GwZXPRhkXF3iMQ3CKpvzqLukBC9bMZ1qfYW4kKF8FzRo");
        process.exit(1);
    }
    
    try {
        const manager = new OperatorManager(network);
        const result = await manager.addOperator(operatorAddress);
        
        if (result.success) {
            console.log("");
            console.log("💡 下一步:");
            console.log("  1. 验证 Operator 权限: npx ts-node scripts/query-operators.ts");
            console.log("  2. 测试 Operator 功能");
            console.log("  3. 通知后端团队更新配置");
            console.log("");
            console.log(`🎉 操作完成！交易: ${result.signature}`);
        } else {
            console.log("");
            console.log("❌ 操作失败，请检查上述错误信息并重试");
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