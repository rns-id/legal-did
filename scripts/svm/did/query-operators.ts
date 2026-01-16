#!/usr/bin/env ts-node
/**
 * 查询 Solana Legal DID 项目的 operators 列表
 * 
 * Usage:
 *   ts-node query-operators.ts [network]
 *   network: devnet (default) | mainnet | localnet
 */

import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { getNetworkConfig, getExplorerLink, NetworkConfig } from '../../config';

// 项目信息接口
interface ProjectInfo {
    authority: string;
    mintPrice: number;
    mintPriceSOL: number;
    destination: string;
    name: string;
    symbol: string;
    baseUri: string;
    operators: string[];
}

export class OperatorQuery {
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
     * 查询项目完整信息
     */
    async getProjectInfo(): Promise<ProjectInfo> {
        const projectAccount = await this.connection.getAccountInfo(this.projectPDA);
        
        if (!projectAccount) {
            throw new Error("项目尚未初始化");
        }
        
        // 解析项目数据
        const data = projectAccount.data;
        let offset = 8; // 跳过判别器
        
        // 读取 authority (32 bytes)
        const authority = new PublicKey(data.subarray(offset, offset + 32));
        offset += 32;
        
        // 读取 mintPrice (8 bytes)
        const mintPriceBuffer = data.subarray(offset, offset + 8);
        const mintPrice = Number(mintPriceBuffer.readBigUInt64LE(0));
        offset += 8;
        
        // 读取 destination (32 bytes)
        const destination = new PublicKey(data.subarray(offset, offset + 32));
        offset += 32;
        
        // 跳过 bump + mintBump (1 + 1 = 2 bytes)
        offset += 2;
        
        // 读取字符串 (name, symbol, baseUri)
        const name = this.readString(data, offset);
        offset += 4 + name.length;
        
        const symbol = this.readString(data, offset);
        offset += 4 + symbol.length;
        
        const baseUri = this.readString(data, offset);
        offset += 4 + baseUri.length;
        
        // 读取 operators 数组
        const operatorsLength = data.readUInt32LE(offset);
        offset += 4;
        
        const operators: string[] = [];
        for (let i = 0; i < operatorsLength; i++) {
            const operator = new PublicKey(data.subarray(offset, offset + 32));
            operators.push(operator.toString());
            offset += 32;
        }
        
        return {
            authority: authority.toString(),
            mintPrice,
            mintPriceSOL: mintPrice / LAMPORTS_PER_SOL,
            destination: destination.toString(),
            name,
            symbol,
            baseUri,
            operators
        };
    }
    
    /**
     * 仅查询 operators 列表
     */
    async getOperators(): Promise<string[]> {
        const projectInfo = await this.getProjectInfo();
        return projectInfo.operators;
    }
    
    /**
     * 检查地址是否为 operator
     */
    async isOperator(address: string): Promise<boolean> {
        const operators = await this.getOperators();
        return operators.includes(address);
    }
    
    /**
     * 获取浏览器链接
     */
    getExplorerLinks(): { project: string; authority: string; operators: string[] } {
        return {
            project: getExplorerLink(this.projectPDA.toString(), this.network),
            authority: '', // 需要先查询才能获得
            operators: [] // 需要先查询才能获得
        };
    }
    
    /**
     * 读取字符串辅助方法
     */
    private readString(data: Buffer, offset: number): string {
        const length = data.readUInt32LE(offset);
        return data.subarray(offset + 4, offset + 4 + length).toString('utf8');
    }
}

async function main(): Promise<void> {
    const network = process.argv[2] || 'devnet';
    
    console.log(`🔍 查询 Solana Legal DID Operators (${network.toUpperCase()})`);
    console.log("=".repeat(50));
    
    try {
        const query = new OperatorQuery(network);
        
        console.log(`📍 项目PDA: ${query.getProjectPDA().toString()}`);
        console.log(`🏗️  程序ID: ${query.getNetworkConfig().programId}`);
        console.log("");
        
        // 查询项目信息
        console.log("📊 查询项目信息...");
        const projectInfo = await query.getProjectInfo();
        
        console.log("✅ 查询成功!");
        console.log("");
        
        // 显示项目基本信息
        console.log("📋 项目基本信息:");
        console.log(`  名称: ${projectInfo.name}`);
        console.log(`  符号: ${projectInfo.symbol}`);
        console.log(`  基础URI: ${projectInfo.baseUri}`);
        console.log(`  铸造价格: ${projectInfo.mintPriceSOL} SOL`);
        console.log("");
        
        // 显示权限角色
        console.log("👑 权限角色:");
        console.log(`  Authority (管理员): ${projectInfo.authority}`);
        console.log(`  Destination (资金接收): ${projectInfo.destination}`);
        console.log("");
        
        // 显示 operators
        console.log("👥 Operators (运营者):");
        if (projectInfo.operators.length === 0) {
            console.log("  ❌ 暂无 operators");
        } else {
            projectInfo.operators.forEach((operator, index) => {
                console.log(`  ${index + 1}. ${operator}`);
            });
        }
        
        console.log("");
        console.log("📊 角色统计:");
        console.log(`  Authority: 1 个`);
        console.log(`  Operators: ${projectInfo.operators.length} 个`);
        console.log(`  总角色数: ${1 + projectInfo.operators.length} 个`);
        
        console.log("");
        console.log("🔐 权限说明:");
        console.log("  Authority:");
        console.log("    • 添加/移除 operators");
        console.log("    • 设置铸造价格");
        console.log("    • 设置基础URI");
        console.log("    • 设置资金接收地址");
        console.log("    • 转移管理权限");
        console.log("    • 提取资金");
        console.log("");
        console.log("  Operators:");
        console.log("    • 执行 DID 空投 (airdrop)");
        console.log("    • 处理用户铸造请求");
        console.log("");
        
        // 浏览器链接
        console.log("🔗 浏览器链接:");
        console.log(`  项目账户: ${getExplorerLink(query.getProjectPDA().toString(), network)}`);
        console.log(`  Authority: ${getExplorerLink(projectInfo.authority, network)}`);
        
        if (projectInfo.operators.length > 0) {
            projectInfo.operators.forEach((operator, index) => {
                console.log(`  Operator ${index + 1}: ${getExplorerLink(operator, network)}`);
            });
        }
        
    } catch (error) {
        console.error("❌ 查询失败:");
        
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        if (errorMessage.includes("项目尚未初始化")) {
            console.error("  原因: 项目尚未初始化");
            console.error("  解决: 请先运行项目初始化脚本");
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

// 导出类和接口
export { NetworkConfig, ProjectInfo };

// 如果直接运行此脚本
if (require.main === module) {
    main().catch((error) => {
        console.error('Script failed:', error);
        process.exit(1);
    });
}