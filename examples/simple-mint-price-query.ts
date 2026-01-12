// 简单的一次性查询 Solana Mint Price

import { Connection, PublicKey } from '@solana/web3.js';

// 配置
const PROGRAM_ID = new PublicKey("JCo8dShYwHu74UpBTmwUcoEcGgWZQWnoTCvFaqjGJ6fc"); // Devnet
const RPC_URL = "https://api.devnet.solana.com";

// 计算项目账户地址
function getProjectAccountAddress(): PublicKey {
    const [pda] = PublicKey.findProgramAddressSync(
        [Buffer.from("nt-proj-v5")],
        PROGRAM_ID
    );
    return pda;
}

// 简单查询函数
async function getMintPrice(): Promise<{
    mintPrice: number;      // lamports
    mintPriceSOL: number;   // SOL
    success: boolean;
    error?: string;
}> {
    try {
        const connection = new Connection(RPC_URL, 'confirmed');
        const projectAccount = getProjectAccountAddress();
        
        // 获取账户信息
        const accountInfo = await connection.getAccountInfo(projectAccount);
        
        if (!accountInfo) {
            return {
                mintPrice: 0,
                mintPriceSOL: 0,
                success: false,
                error: "Project account not found"
            };
        }

        // 解析 mint_price (跳过前面的字段直接定位)
        const data = accountInfo.data;
        const offset = 8 + 32; // discriminator(8) + authority(32)
        const mintPriceLamports = Number(data.readBigUInt64LE(offset));
        
        return {
            mintPrice: mintPriceLamports,
            mintPriceSOL: mintPriceLamports / 1_000_000_000,
            success: true
        };
    } catch (error) {
        return {
            mintPrice: 0,
            mintPriceSOL: 0,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}

// React Hook 版本
import { useState, useCallback } from 'react';

export function useMintPriceQuery() {
    const [loading, setLoading] = useState(false);
    
    const queryPrice = useCallback(async () => {
        setLoading(true);
        try {
            const result = await getMintPrice();
            return result;
        } finally {
            setLoading(false);
        }
    }, []);

    return { queryPrice, loading };
}

// React 组件示例
import React, { useState } from 'react';

export const MintPriceQueryButton: React.FC = () => {
    const [priceInfo, setPriceInfo] = useState<any>(null);
    const { queryPrice, loading } = useMintPriceQuery();

    const handleQuery = async () => {
        const result = await queryPrice();
        setPriceInfo(result);
    };

    return (
        <div>
            <button onClick={handleQuery} disabled={loading}>
                {loading ? 'Querying...' : 'Get Current Price'}
            </button>
            
            {priceInfo && (
                <div style={{ marginTop: '10px' }}>
                    {priceInfo.success ? (
                        <div>
                            <p><strong>Mint Price: {priceInfo.mintPriceSOL.toFixed(4)} SOL</strong></p>
                            <p><small>{priceInfo.mintPrice.toLocaleString()} lamports</small></p>
                        </div>
                    ) : (
                        <p style={{ color: 'red' }}>Error: {priceInfo.error}</p>
                    )}
                </div>
            )}
        </div>
    );
};

// 纯 JavaScript 版本 (不依赖 React)
class SimpleMintPriceQuery {
    private connection: Connection;
    private projectAccount: PublicKey;

    constructor(rpcUrl: string = RPC_URL) {
        this.connection = new Connection(rpcUrl, 'confirmed');
        this.projectAccount = getProjectAccountAddress();
    }

    async getPrice() {
        try {
            const accountInfo = await this.connection.getAccountInfo(this.projectAccount);
            
            if (!accountInfo) {
                throw new Error("Project account not found");
            }

            const data = accountInfo.data;
            const offset = 8 + 32; // discriminator + authority
            const mintPriceLamports = Number(data.readBigUInt64LE(offset));
            
            return {
                lamports: mintPriceLamports,
                sol: mintPriceLamports / 1_000_000_000
            };
        } catch (error) {
            throw new Error(`Failed to get mint price: ${error}`);
        }
    }
}

// 使用示例
export async function example() {
    // 方式1: 直接调用函数
    const priceResult = await getMintPrice();
    if (priceResult.success) {
        console.log(`Current price: ${priceResult.mintPriceSOL} SOL`);
    } else {
        console.error(`Error: ${priceResult.error}`);
    }

    // 方式2: 使用类
    const priceQuery = new SimpleMintPriceQuery();
    try {
        const price = await priceQuery.getPrice();
        console.log(`Price: ${price.sol} SOL (${price.lamports} lamports)`);
    } catch (error) {
        console.error('Query failed:', error);
    }
}

// 导出主要函数
export { getMintPrice, SimpleMintPriceQuery };