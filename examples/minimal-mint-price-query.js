// 最简单的 Solana Mint Price 查询
// 可以直接在浏览器控制台或 Node.js 中使用

// 如果在浏览器中使用，需要先引入 @solana/web3.js
// <script src="https://unpkg.com/@solana/web3.js@latest/lib/index.iife.min.js"></script>

// 如果在 Node.js 中使用，需要先安装依赖
// npm install @solana/web3.js

// 配置
const PROGRAM_ID = "JCo8dShYwHu74UpBTmwUcoEcGgWZQWnoTCvFaqjGJ6fc"; // Devnet
const RPC_URL = "https://api.devnet.solana.com";

// 简单查询函数 (浏览器版本)
async function getMintPriceBrowser() {
    try {
        // 使用全局的 solanaWeb3 对象
        const connection = new solanaWeb3.Connection(RPC_URL, 'confirmed');
        const programId = new solanaWeb3.PublicKey(PROGRAM_ID);
        
        // 计算项目账户地址
        const [projectAccount] = solanaWeb3.PublicKey.findProgramAddressSync(
            [Buffer.from("nt-proj-v5")],
            programId
        );
        
        console.log("Project Account:", projectAccount.toString());
        
        // 获取账户信息
        const accountInfo = await connection.getAccountInfo(projectAccount);
        
        if (!accountInfo) {
            throw new Error("Project account not found");
        }
        
        // 解析 mint_price (位置: discriminator(8) + authority(32) = offset 40)
        const data = accountInfo.data;
        const mintPriceLamports = Number(data.readBigUInt64LE(40));
        const mintPriceSOL = mintPriceLamports / 1_000_000_000;
        
        console.log("✅ Mint Price Query Result:");
        console.log(`💰 Price: ${mintPriceSOL} SOL`);
        console.log(`🔢 Lamports: ${mintPriceLamports.toLocaleString()}`);
        
        return {
            sol: mintPriceSOL,
            lamports: mintPriceLamports,
            account: projectAccount.toString()
        };
        
    } catch (error) {
        console.error("❌ Query failed:", error.message);
        return null;
    }
}

// Node.js 版本
async function getMintPriceNode() {
    // 需要先: npm install @solana/web3.js
    const { Connection, PublicKey } = require('@solana/web3.js');
    
    try {
        const connection = new Connection(RPC_URL, 'confirmed');
        const programId = new PublicKey(PROGRAM_ID);
        
        // 计算项目账户地址
        const [projectAccount] = PublicKey.findProgramAddressSync(
            [Buffer.from("nt-proj-v5")],
            programId
        );
        
        console.log("Project Account:", projectAccount.toString());
        
        // 获取账户信息
        const accountInfo = await connection.getAccountInfo(projectAccount);
        
        if (!accountInfo) {
            throw new Error("Project account not found");
        }
        
        // 解析 mint_price
        const data = accountInfo.data;
        const mintPriceLamports = Number(data.readBigUInt64LE(40));
        const mintPriceSOL = mintPriceLamports / 1_000_000_000;
        
        console.log("✅ Mint Price Query Result:");
        console.log(`💰 Price: ${mintPriceSOL} SOL`);
        console.log(`🔢 Lamports: ${mintPriceLamports.toLocaleString()}`);
        
        return {
            sol: mintPriceSOL,
            lamports: mintPriceLamports,
            account: projectAccount.toString()
        };
        
    } catch (error) {
        console.error("❌ Query failed:", error.message);
        return null;
    }
}

// React 组件版本 (最简单)
function MintPriceButton() {
    const [price, setPrice] = React.useState(null);
    const [loading, setLoading] = React.useState(false);
    
    const handleQuery = async () => {
        setLoading(true);
        const result = await getMintPriceBrowser();
        setPrice(result);
        setLoading(false);
    };
    
    return (
        <div>
            <button onClick={handleQuery} disabled={loading}>
                {loading ? 'Querying...' : 'Get Mint Price'}
            </button>
            
            {price && (
                <div>
                    <p>Price: {price.sol} SOL</p>
                    <p>Lamports: {price.lamports.toLocaleString()}</p>
                </div>
            )}
        </div>
    );
}

// Vue 组件版本 (最简单)
const MintPriceComponent = {
    data() {
        return {
            price: null,
            loading: false
        };
    },
    methods: {
        async queryPrice() {
            this.loading = true;
            this.price = await getMintPriceBrowser();
            this.loading = false;
        }
    },
    template: `
        <div>
            <button @click="queryPrice" :disabled="loading">
                {{ loading ? 'Querying...' : 'Get Mint Price' }}
            </button>
            
            <div v-if="price">
                <p>Price: {{ price.sol }} SOL</p>
                <p>Lamports: {{ price.lamports.toLocaleString() }}</p>
            </div>
        </div>
    `
};

// 使用示例
console.log("🚀 Solana Mint Price Query Examples");
console.log("📝 Usage:");
console.log("1. Browser: getMintPriceBrowser()");
console.log("2. Node.js: getMintPriceNode()");
console.log("");

// 如果在浏览器环境，可以直接调用
if (typeof window !== 'undefined' && typeof solanaWeb3 !== 'undefined') {
    console.log("🌐 Browser environment detected");
    console.log("💡 Try: getMintPriceBrowser()");
    
    // 自动查询一次 (可选)
    // getMintPriceBrowser();
}

// 如果在 Node.js 环境
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { getMintPriceNode };
    console.log("🖥️  Node.js environment detected");
    console.log("💡 Try: getMintPriceNode()");
}