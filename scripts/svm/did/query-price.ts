#!/usr/bin/env ts-node
/**
 * Solana Legal DID 铸造价格查询脚本
 * 
 * Usage:
 *   ts-node query-price.ts [network]
 *   network: devnet (default) | mainnet | localnet
 */

import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import * as process from 'process';
import { getNetworkConfig, getExplorerLink, NetworkConfig } from '../../config';

// 类型定义
interface ProjectInfo {
    authority: string;
    mintPrice: number;
    mintPriceSOL: number;
    name: string;
    symbol: string;
    baseUri: string;
    accountInfo: {
        dataLength: number;
        owner: string;
        lamports: number;
        executable: boolean;
    };
}

interface MintPriceInfo {
    lamports: number;
    sol: number;
    usd: number;
}

interface ProjectStatus {
    initialized: boolean;
    dataLength: number;
    owner: string | null;
    lamports: number;
    error?: string;
}

export class SolanaPriceQuery {
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
     * 获取项目PDA地址
     */
    getProjectPDA(): PublicKey {
        return this.projectPDA;
    }
    
    /**
     * 获取网络配置
     */
    getNetworkConfig(): NetworkConfig {
        return this.config;
    }
    
    /**
     * 查询项目基本信息
     */
    async getProjectInfo(): Promise<ProjectInfo> {
        try {
            const projectAccount = await this.connection.getAccountInfo(this.projectPDA);
            
            if (!projectAccount) {
                throw new Error("项目尚未初始化");
            }
            
            // 解析项目数据
            const data = projectAccount.data;
            
            if (data.length < 100) {
                throw new Error("项目数据格式错误");
            }
            
            let offset = 8; // 跳过判别器
            
            // 读取 authority (32 bytes)
            const authority = new PublicKey(data.subarray(offset, offset + 32));
            offset += 32;
            
            // 读取 mintPrice (8 bytes, u64)
            const mintPriceBuffer = data.subarray(offset, offset + 8);
            const mintPrice = Number(mintPriceBuffer.readBigUInt64LE(0));
            offset += 8;
            
            // 跳过其他字段
            offset += 32 + 1 + 1; // destination + bump + mintBump
            
            // 读取字符串 (name)
            const nameLength = data.readUInt32LE(offset);
            offset += 4;
            const name = data.subarray(offset, offset + nameLength).toString('utf8');
            offset += nameLength;
            
            // 读取 symbol
            const symbolLength = data.readUInt32LE(offset);
            offset += 4;
            const symbol = data.subarray(offset, offset + symbolLength).toString('utf8');
            offset += symbolLength;
            
            // 读取 baseUri
            const baseUriLength = data.readUInt32LE(offset);
            offset += 4;
            const baseUri = data.subarray(offset, offset + baseUriLength).toString('utf8');
            
            return {
                authority: authority.toString(),
                mintPrice: mintPrice,
                mintPriceSOL: mintPrice / LAMPORTS_PER_SOL,
                name: name,
                symbol: symbol,
                baseUri: baseUri,
                accountInfo: {
                    dataLength: projectAccount.data.length,
                    owner: projectAccount.owner.toString(),
                    lamports: projectAccount.lamports,
                    executable: projectAccount.executable
                }
            };
            
        } catch (error) {
            if (error instanceof Error && error.message.includes("项目尚未初始化")) {
                throw error;
            }
            throw new Error(`查询失败: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    
    /**
     * 仅查询铸造价格
     */
    async getMintPrice(): Promise<MintPriceInfo> {
        const projectInfo = await this.getProjectInfo();
        return {
            lamports: projectInfo.mintPrice,
            sol: projectInfo.mintPriceSOL,
            usd: projectInfo.mintPriceSOL * 140 // 假设SOL价格
        };
    }
    
    /**
     * 检查项目状态
     */
    async checkProjectStatus(): Promise<ProjectStatus> {
        try {
            const projectAccount = await this.connection.getAccountInfo(this.projectPDA);
            
            return {
                initialized: !!projectAccount,
                dataLength: projectAccount?.data.length || 0,
                owner: projectAccount?.owner.toString() || null,
                lamports: projectAccount?.lamports || 0
            };
        } catch (error) {
            return {
                initialized: false,
                dataLength: 0,
                owner: null,
                lamports: 0,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }
    
    /**
     * 获取浏览器链接
     */
    getExplorerLinks(): { project: string; program: string } {
        return {
            project: getExplorerLink(this.projectPDA.toString(), this.network),
            program: getExplorerLink(this.config.programId, this.network)
        };
    }
}

async function main(): Promise<void> {
    const network = process.argv[2] || 'devnet';
    
    console.log("🔍 Solana Legal DID 价格查询");
    console.log(`📡 网络: ${network.toUpperCase()}`);
    
    try {
        const priceQuery = new SolanaPriceQuery(network);
        const config = priceQuery.getNetworkConfig();
        
        console.log(`🏗️  程序ID: ${config.programId}`);
        console.log("");
        
        console.log(`📍 项目PDA: ${priceQuery.getProjectPDA().toString()}`);
        console.log("");
        
        // 1. 检查项目状态
        console.log("🔍 检查项目状态...");
        const status = await priceQuery.checkProjectStatus();
        
        if (!status.initialized) {
            console.log("❌ 项目尚未初始化");
            if (status.error) {
                console.log(`  错误: ${status.error}`);
            }
            console.log("请先运行初始化脚本: node scripts/final-init.js");
            process.exit(1);
        }
        
        console.log("✅ 项目已初始化");
        console.log(`  数据长度: ${status.dataLength} bytes`);
        console.log(`  账户余额: ${(status.lamports / LAMPORTS_PER_SOL).toFixed(6)} SOL`);
        console.log("");
        
        // 2. 查询详细信息
        console.log("📊 查询项目信息...");
        const projectInfo = await priceQuery.getProjectInfo();
        
        console.log("✅ 查询成功!");
        console.log("");
        
        // 3. 显示项目基本信息
        console.log("📋 项目信息:");
        console.log(`  名称: ${projectInfo.name}`);
        console.log(`  符号: ${projectInfo.symbol}`);
        console.log(`  管理员: ${projectInfo.authority}`);
        console.log(`  基础URI: ${projectInfo.baseUri}`);
        console.log("");
        
        // 4. 显示铸造价格
        console.log("💰 铸造价格:");
        console.log(`  ${projectInfo.mintPriceSOL} SOL`);
        console.log(`  ${projectInfo.mintPrice.toLocaleString()} lamports`);
        
        // 估算USD价格
        const estimatedUSD = projectInfo.mintPriceSOL * 140;
        console.log(`  ~$${estimatedUSD.toFixed(2)} USD (假设 SOL = $140)`);
        console.log("");
        
        // 5. 显示浏览器链接
        const links = priceQuery.getExplorerLinks();
        console.log("🔗 浏览器链接:");
        console.log(`  项目账户: ${links.project}`);
        console.log(`  程序地址: ${links.program}`);
        
        // 6. 显示集成示例
        console.log("");
        console.log("💻 集成示例:");
        console.log("```typescript");
        console.log("import { SolanaPriceQuery } from './scripts/query-price';");
        console.log("");
        console.log(`const query = new SolanaPriceQuery('${network}');`);
        console.log("const price = await query.getMintPrice();");
        console.log("console.log(`价格: ${price.sol} SOL`);");
        console.log("```");
        
    } catch (error) {
        console.error("❌ 查询失败:");
        
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        if (errorMessage.includes("项目尚未初始化")) {
            console.error("  原因: 项目尚未初始化");
            console.error("  解决: 请先运行 node scripts/final-init.js");
        } else if (errorMessage.includes("不支持的网络")) {
            console.error(`  原因: ${errorMessage}`);
            console.error("  解决: 使用 devnet 或 mainnet");
        } else if (errorMessage.includes("fetch")) {
            console.error("  原因: 网络连接问题");
            console.error("  解决: 检查网络连接或更换RPC端点");
        } else {
            console.error(`  详细错误: ${errorMessage}`);
        }
        
        console.log("");
        console.log("🔧 故障排除:");
        console.log("1. 检查网络连接");
        console.log("2. 确认程序ID正确");
        console.log("3. 验证项目是否已初始化");
        console.log("4. 尝试使用不同的RPC端点");
        
        process.exit(1);
    }
}

// 导出类和类型
export { NetworkConfig, ProjectInfo, MintPriceInfo, ProjectStatus };

// 如果直接运行此脚本
if (require.main === module) {
    main().catch((error) => {
        console.error('Script failed:', error);
        process.exit(1);
    });
}