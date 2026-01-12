/**
 * Solana DID 集成示例
 * 展示前后端如何对接 Solana 版本的 Legal DID
 */

import { 
    Connection, 
    PublicKey, 
    Keypair,
    SystemProgram,
    LAMPORTS_PER_SOL,
    clusterApiUrl
} from '@solana/web3.js';
import { 
    Program, 
    AnchorProvider, 
    Wallet, 
    BN 
} from '@coral-xyz/anchor';
import { 
    TOKEN_2022_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
    getAssociatedTokenAddressSync
} from '@solana/spl-token';
import { Legaldid } from '../target/types/legaldid';

// 配置信息
const CONFIG = {
    network: "devnet" as const,
    programId: "Ce84NtGdKYpxkFpvWn7a5qqBXzkBfEhXM7gg49NtGuhM",
    rpcUrl: "https://api.devnet.solana.com",
};

// PDA 种子常量
const PROJECT_SEED = "nt-proj-v5";
const PROJECT_MINT_SEED = "nt-project-mint-v5";
const NFT_MINT_SEED = "nt-nft-mint-v5";

/**
 * Solana DID 客户端
 */
export class SolanaDIDClient {
    private connection: Connection;
    private program: Program<Legaldid>;
    private provider: AnchorProvider;

    constructor(wallet: Keypair) {
        this.connection = new Connection(CONFIG.rpcUrl, "confirmed");
        
        const anchorWallet = new Wallet(wallet);
        this.provider = new AnchorProvider(this.connection, anchorWallet, {
            commitment: "confirmed"
        });
        
        const programId = new PublicKey(CONFIG.programId);
        this.program = new Program<Legaldid>(
            require('../target/idl/legaldid.json') as Legaldid,
            programId,
            this.provider
        );
    }

    /**
     * 计算项目 PDA
     */
    getProjectPDA(): PublicKey {
        const [pda] = PublicKey.findProgramAddressSync(
            [Buffer.from(PROJECT_SEED)],
            this.program.programId
        );
        return pda;
    }

    /**
     * 计算集合 Mint PDA
     */
    getCollectionMintPDA(): PublicKey {
        const [pda] = PublicKey.findProgramAddressSync(
            [Buffer.from(PROJECT_MINT_SEED)],
            this.program.programId
        );
        return pda;
    }

    /**
     * 计算 NFT Mint PDA
     */
    getNFTMintPDA(orderId: string): PublicKey {
        const [pda] = PublicKey.findProgramAddressSync(
            [Buffer.from(NFT_MINT_SEED), Buffer.from(orderId)],
            this.program.programId
        );
        return pda;
    }

    /**
     * 获取用户 Token 账户地址
     */
    getUserTokenAccount(nftMint: PublicKey, userWallet: PublicKey): PublicKey {
        return getAssociatedTokenAddressSync(
            nftMint,
            userWallet,
            false,
            TOKEN_2022_PROGRAM_ID
        );
    }

    /**
     * 查询项目信息
     */
    async getProjectInfo() {
        const projectPDA = this.getProjectPDA();
        
        try {
            const projectAccount = await this.program.account.projectAccount.fetch(projectPDA);
            
            return {
                authority: projectAccount.authority.toString(),
                mintPrice: projectAccount.mintPrice.toNumber(),
                destination: projectAccount.destination.toString(),
                lastTokenId: projectAccount.lastTokenId.toNumber(),
                name: projectAccount.name,
                symbol: projectAccount.symbol,
                baseUri: projectAccount.baseUri,
                operators: projectAccount.operators.map(op => op.toString()),
            };
        } catch (error) {
            console.log("项目未初始化");
            return null;
        }
    }

    /**
     * 查询铸造价格
     */
    async getMintPrice(): Promise<number> {
        const projectInfo = await this.getProjectInfo();
        return projectInfo ? projectInfo.mintPrice : 0;
    }

    /**
     * 前端：用户授权铸造
     */
    async authorizeMint(orderId: string, userWallet: PublicKey): Promise<string> {
        const projectPDA = this.getProjectPDA();
        const mintPrice = await this.getMintPrice();

        const tx = await this.program.methods
            .authorizeMint(orderId)
            .accounts({
                payer: userWallet,
                nonTransferableProject: projectPDA,
                systemProgram: SystemProgram.programId,
            })
            .rpc();

        console.log(`✅ 授权铸造成功: ${tx}`);
        console.log(`💰 支付金额: ${mintPrice / LAMPORTS_PER_SOL} SOL`);
        
        return tx;
    }

    /**
     * 后端：空投 DID 给用户
     */
    async airdropDID(
        orderId: string, 
        userWallet: PublicKey, 
        merkleRoot: string,
        operatorWallet: Keypair
    ): Promise<string> {
        const projectPDA = this.getProjectPDA();
        const collectionMintPDA = this.getCollectionMintPDA();
        const nftMintPDA = this.getNFTMintPDA(orderId);
        const userTokenAccount = this.getUserTokenAccount(nftMintPDA, userWallet);

        // 使用操作员钱包
        const operatorProvider = new AnchorProvider(
            this.connection, 
            new Wallet(operatorWallet), 
            { commitment: "confirmed" }
        );
        const operatorProgram = new Program<Legaldid>(
            require('../target/idl/legaldid.json') as Legaldid,
            this.program.programId,
            operatorProvider
        );

        const tx = await operatorProgram.methods
            .airdrop(orderId, userWallet, merkleRoot)
            .accounts({
                authority: operatorWallet.publicKey,
                nonTransferableProject: projectPDA,
                nonTransferableNftMint: nftMintPDA,
                userAccount: userWallet,
                userTokenAccount: userTokenAccount,
                collectionMint: collectionMintPDA,
                associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
                tokenProgram: TOKEN_2022_PROGRAM_ID,
                systemProgram: SystemProgram.programId,
            })
            .rpc();

        console.log(`✅ DID 空投成功: ${tx}`);
        console.log(`🎯 NFT Mint: ${nftMintPDA.toString()}`);
        console.log(`👤 用户钱包: ${userWallet.toString()}`);
        
        return tx;
    }

    /**
     * 用户销毁 DID
     */
    async burnDID(nftMint: PublicKey, userWallet: Keypair): Promise<string> {
        const projectPDA = this.getProjectPDA();
        const userTokenAccount = this.getUserTokenAccount(nftMint, userWallet.publicKey);
        
        // 获取项目权限信息
        const projectInfo = await this.getProjectInfo();
        if (!projectInfo) {
            throw new Error("项目未初始化");
        }

        const tx = await this.program.methods
            .burn()
            .accounts({
                nftOwner: userWallet.publicKey,
                authority: new PublicKey(projectInfo.authority),
                nonTransferableProject: projectPDA,
                userTokenAccount: userTokenAccount,
                nonTransferableNftMint: nftMint,
                associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
                tokenProgram: TOKEN_2022_PROGRAM_ID,
                systemProgram: SystemProgram.programId,
            })
            .signers([userWallet])
            .rpc();

        console.log(`✅ DID 销毁成功: ${tx}`);
        
        return tx;
    }

    /**
     * 监听事件
     */
    setupEventListeners() {
        // 监听授权事件
        this.program.addEventListener("authorizeMintEvent", (event) => {
            console.log("🔔 授权铸造事件:", {
                orderId: event.orderId,
                wallet: event.wallet.toString(),
                payer: event.payer.toString(),
                amount: event.amount.toNumber()
            });
        });

        // 监听空投事件
        this.program.addEventListener("airdropEvent", (event) => {
            console.log("🔔 DID 发行事件:", {
                orderId: event.orderId,
                tokenId: event.tokenId.toNumber(),
                wallet: event.wallet.toString(),
                mint: event.mint.toString(),
                merkleRoot: event.merkleRoot
            });
        });

        // 监听销毁事件
        this.program.addEventListener("burnEvent", (event) => {
            console.log("🔔 DID 销毁事件:", {
                wallet: event.wallet.toString(),
                mint: event.mint.toString()
            });
        });
    }
}

/**
 * 使用示例
 */
async function example() {
    // 1. 创建钱包
    const userWallet = Keypair.generate();
    const operatorWallet = Keypair.generate();
    
    // 2. 初始化客户端
    const client = new SolanaDIDClient(userWallet);
    
    // 3. 设置事件监听
    client.setupEventListeners();
    
    // 4. 查询项目信息
    const projectInfo = await client.getProjectInfo();
    console.log("项目信息:", projectInfo);
    
    // 5. 生成订单号
    const orderId = `did-${Date.now()}`;
    
    try {
        // 6. 用户授权铸造
        const authTx = await client.authorizeMint(orderId, userWallet.publicKey);
        
        // 7. 后端空投 DID (需要等待授权交易确认)
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const merkleRoot = "0x" + "a".repeat(64); // 示例 merkle root
        const airdropTx = await client.airdropDID(
            orderId, 
            userWallet.publicKey, 
            merkleRoot,
            operatorWallet
        );
        
        // 8. 获取 NFT Mint 地址
        const nftMint = client.getNFTMintPDA(orderId);
        
        // 9. 用户销毁 DID (可选)
        // const burnTx = await client.burnDID(nftMint, userWallet);
        
    } catch (error) {
        console.error("操作失败:", error);
    }
}

/**
 * 前端集成示例
 */
export class FrontendDIDService {
    private client: SolanaDIDClient;
    
    constructor(wallet: Keypair) {
        this.client = new SolanaDIDClient(wallet);
    }
    
    /**
     * 申请 DID
     */
    async requestDID(userWallet: PublicKey): Promise<{ orderId: string; txId: string }> {
        // 1. 从后端获取订单号
        const orderId = await this.fetchOrderIdFromBackend();
        
        // 2. 调用授权铸造
        const txId = await this.client.authorizeMint(orderId, userWallet);
        
        // 3. 通知后端处理
        await this.notifyBackendAuthorization(orderId, txId);
        
        return { orderId, txId };
    }
    
    /**
     * 查询用户 DID 状态
     */
    async getUserDIDStatus(userWallet: PublicKey): Promise<any[]> {
        // 实现查询用户持有的 DID NFT
        // 这里需要遍历用户的 Token 账户
        return [];
    }
    
    private async fetchOrderIdFromBackend(): Promise<string> {
        // 调用后端 API 获取订单号
        return `did-${Date.now()}`;
    }
    
    private async notifyBackendAuthorization(orderId: string, txId: string): Promise<void> {
        // 通知后端用户已完成授权支付
        console.log(`通知后端: 订单 ${orderId} 已授权，交易 ${txId}`);
    }
}

/**
 * 后端集成示例
 */
export class BackendDIDService {
    private client: SolanaDIDClient;
    private operatorWallet: Keypair;
    
    constructor(operatorWallet: Keypair) {
        this.client = new SolanaDIDClient(operatorWallet);
        this.operatorWallet = operatorWallet;
        
        // 设置事件监听
        this.client.setupEventListeners();
    }
    
    /**
     * 处理授权事件
     */
    async handleAuthorizationEvent(event: any) {
        const { orderId, wallet, payer, amount } = event;
        
        // 1. 验证订单
        const isValid = await this.validateOrder(orderId);
        if (!isValid) {
            console.log(`❌ 订单验证失败: ${orderId}`);
            return;
        }
        
        // 2. 检查黑名单
        const isBlacklisted = await this.checkBlacklist(wallet);
        if (isBlacklisted) {
            console.log(`❌ 钱包在黑名单中: ${wallet}`);
            return;
        }
        
        // 3. 检查重复铸造
        const hasDID = await this.checkExistingDID(wallet);
        if (hasDID) {
            console.log(`❌ 钱包已有 DID: ${wallet}`);
            return;
        }
        
        // 4. 生成 merkle root
        const merkleRoot = await this.generateMerkleRoot(orderId);
        
        // 5. 空投 DID
        try {
            const txId = await this.client.airdropDID(
                orderId,
                new PublicKey(wallet),
                merkleRoot,
                this.operatorWallet
            );
            
            console.log(`✅ DID 发行成功: ${orderId} -> ${txId}`);
            
        } catch (error) {
            console.error(`❌ DID 发行失败: ${orderId}`, error);
        }
    }
    
    private async validateOrder(orderId: string): Promise<boolean> {
        // 实现订单验证逻辑
        return true;
    }
    
    private async checkBlacklist(wallet: string): Promise<boolean> {
        // 实现黑名单检查
        return false;
    }
    
    private async checkExistingDID(wallet: string): Promise<boolean> {
        // 检查用户是否已有 DID
        return false;
    }
    
    private async generateMerkleRoot(orderId: string): Promise<string> {
        // 生成身份数据的 merkle root
        return "0x" + "a".repeat(64);
    }
}

// 导出主要类
export { SolanaDIDClient, FrontendDIDService, BackendDIDService };

// 如果直接运行此文件
if (require.main === module) {
    example().catch(console.error);
}