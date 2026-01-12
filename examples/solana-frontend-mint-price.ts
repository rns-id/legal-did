// Solana 前端查询 Mint Price 实用示例

import { Connection, PublicKey } from '@solana/web3.js';

// 配置
const PROGRAM_ID = new PublicKey("JCo8dShYwHu74UpBTmwUcoEcGgWZQWnoTCvFaqjGJ6fc"); // Devnet
const RPC_URL = "https://api.devnet.solana.com";

// 计算项目账户 PDA
function getProjectAccountPDA(): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
        [Buffer.from("nt-proj-v5")],
        PROGRAM_ID
    );
}

// 简单的 Mint Price 查询服务
class SolanaMintPriceService {
    private connection: Connection;
    private projectAccountPDA: PublicKey;

    constructor(rpcUrl: string = RPC_URL) {
        this.connection = new Connection(rpcUrl, 'confirmed');
        [this.projectAccountPDA] = getProjectAccountPDA();
    }

    // 查询当前 mint price
    async getMintPrice(): Promise<{
        mintPrice: number;        // lamports
        mintPriceSOL: number;     // SOL
        lastTokenId: number;
    }> {
        try {
            const accountInfo = await this.connection.getAccountInfo(this.projectAccountPDA);
            
            if (!accountInfo) {
                throw new Error("Project account not found - program may not be initialized");
            }

            // 解析账户数据 (简化版)
            const data = accountInfo.data;
            let offset = 8; // 跳过 discriminator

            // authority (32 bytes) - 跳过
            offset += 32;
            
            // mint_price (8 bytes, u64 little-endian)
            const mintPriceLamports = Number(data.readBigUInt64LE(offset));
            offset += 8;
            
            // destination (32 bytes) - 跳过
            offset += 32;
            
            // bump (1 byte) - 跳过
            offset += 1;
            
            // mint_bump (1 byte) - 跳过  
            offset += 1;
            
            // last_token_id (8 bytes, u64 little-endian)
            const lastTokenId = Number(data.readBigUInt64LE(offset));

            return {
                mintPrice: mintPriceLamports,
                mintPriceSOL: mintPriceLamports / 1_000_000_000, // lamports to SOL
                lastTokenId
            };
        } catch (error) {
            console.error("Failed to get mint price:", error);
            throw error;
        }
    }

    // 实时监听价格变化 (WebSocket)
    subscribeToPriceUpdates(callback: (priceInfo: any) => void): number {
        return this.connection.onAccountChange(
            this.projectAccountPDA,
            async (accountInfo) => {
                try {
                    // 重新解析数据
                    const data = accountInfo.data;
                    let offset = 40; // 跳到 mint_price 位置
                    const mintPriceLamports = Number(data.readBigUInt64LE(offset));
                    
                    callback({
                        mintPrice: mintPriceLamports,
                        mintPriceSOL: mintPriceLamports / 1_000_000_000,
                        timestamp: Date.now()
                    });
                } catch (error) {
                    console.error("Failed to parse price update:", error);
                }
            },
            'confirmed'
        );
    }

    // 取消订阅
    async unsubscribe(subscriptionId: number): Promise<void> {
        await this.connection.removeAccountChangeListener(subscriptionId);
    }
}

// React Hook 示例 (TypeScript)
export function useSolanaMintPrice() {
    const [priceInfo, setPriceInfo] = useState<{
        mintPrice: number;
        mintPriceSOL: number;
        lastTokenId: number;
    } | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const service = new SolanaMintPriceService();
        let subscriptionId: number | null = null;

        // 初始化
        const init = async () => {
            try {
                setLoading(true);
                
                // 获取初始价格
                const initialPrice = await service.getMintPrice();
                setPriceInfo(initialPrice);
                
                // 订阅价格变化
                subscriptionId = service.subscribeToPriceUpdates((newPriceInfo) => {
                    setPriceInfo(prev => ({
                        ...prev!,
                        mintPrice: newPriceInfo.mintPrice,
                        mintPriceSOL: newPriceInfo.mintPriceSOL
                    }));
                    console.log("Price updated:", newPriceInfo);
                });
                
                setLoading(false);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Unknown error');
                setLoading(false);
            }
        };

        init();

        // 清理
        return () => {
            if (subscriptionId !== null) {
                service.unsubscribe(subscriptionId);
            }
        };
    }, []);

    return { priceInfo, loading, error };
}

// 简单的轮询版本 (不需要 WebSocket)
export class PollingMintPriceService extends SolanaMintPriceService {
    private intervalId: NodeJS.Timeout | null = null;
    private callbacks: ((priceInfo: any) => void)[] = [];

    startPolling(intervalMs: number = 5000) {
        this.stopPolling();
        
        this.intervalId = setInterval(async () => {
            try {
                const priceInfo = await this.getMintPrice();
                this.callbacks.forEach(callback => callback(priceInfo));
            } catch (error) {
                console.error("Polling error:", error);
            }
        }, intervalMs);
    }

    stopPolling() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }

    onPriceUpdate(callback: (priceInfo: any) => void) {
        this.callbacks.push(callback);
    }
}

// 使用示例
async function example() {
    const service = new SolanaMintPriceService();
    
    try {
        // 1. 一次性查询
        const priceInfo = await service.getMintPrice();
        console.log("Current mint price:", priceInfo);
        
        // 2. 实时监听 (WebSocket)
        const subscriptionId = service.subscribeToPriceUpdates((newPrice) => {
            console.log("Price updated:", newPrice);
            // 更新 UI
        });
        
        // 3. 轮询方式 (备选)
        const pollingService = new PollingMintPriceService();
        pollingService.onPriceUpdate((priceInfo) => {
            console.log("Polled price:", priceInfo);
        });
        pollingService.startPolling(3000); // 每3秒查询一次
        
    } catch (error) {
        console.error("Error:", error);
    }
}

// React 组件示例
export const MintPriceDisplay = () => {
    const { priceInfo, loading, error } = useSolanaMintPrice();

    if (loading) return <div>Loading price...</div>;
    if (error) return <div>Error: {error}</div>;
    if (!priceInfo) return <div>No price data</div>;

    return (
        <div>
            <h3>Current Mint Price</h3>
            <p><strong>{priceInfo.mintPriceSOL.toFixed(4)} SOL</strong></p>
            <p><small>{priceInfo.mintPrice.toLocaleString()} lamports</small></p>
            <p>Last Token ID: {priceInfo.lastTokenId}</p>
        </div>
    );
};

export default SolanaMintPriceService;