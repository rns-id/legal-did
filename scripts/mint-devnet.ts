import { Program, AnchorProvider, Wallet, web3, BN } from '@coral-xyz/anchor';
import { ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import * as fs from 'fs';
import * as crypto from 'crypto';

const { 
    Connection, 
    PublicKey, 
    Keypair, 
    ComputeBudgetProgram,
    SYSVAR_RENT_PUBKEY,
    SYSVAR_INSTRUCTIONS_PUBKEY,
    SystemProgram
} = web3;

// 配置
const PROGRAM_ID = new PublicKey('BCkys1re7iw8NhM7nu6xLChGpgg9iCC8mZity2maL9en');
const RPC_URL = 'https://api.devnet.solana.com';

// 铸造目标地址
const MINT_TO_ADDRESS = new PublicKey('H2sykMLjWjBCtALDYCwnqxALEWtDbBwfCXtz7YThoEne');

// 生成唯一的 rnsId 和 tokenIndex
const rnsId = `did-${Date.now()}-${Math.random().toString(36).substring(7)}`;
const tokenIndex = Date.now().toString();
const merkleRoot = '2d852b3c21e923484a93d3a980a45b7571e89552d58875d40dd17c73216a49d7';

// PDA 计算函数
function findNonTransferableProject(): web3.PublicKey {
    const [pda] = PublicKey.findProgramAddressSync(
        [Buffer.from("nt-proj-v2")],
        PROGRAM_ID
    );
    return pda;
}

function getCollectionMintAddress(): web3.PublicKey {
    const [pda] = PublicKey.findProgramAddressSync(
        [Buffer.from("nt-project-mint")],
        PROGRAM_ID
    );
    return pda;
}

function findNonTransferableUserStatus(rnsId: string, wallet: web3.PublicKey): web3.PublicKey {
    const hashedRnsId = crypto.createHash('sha256').update(rnsId).digest().slice(0, 32);
    const [pda] = PublicKey.findProgramAddressSync(
        [Buffer.from("nt-nft-user-status"), hashedRnsId, wallet.toBuffer()],
        PROGRAM_ID
    );
    return pda;
}

function getNonTransferableNftMintAddress(rnsId: string, index: string): web3.PublicKey {
    const [pda] = PublicKey.findProgramAddressSync(
        [Buffer.from("nt-nft-mint"), Buffer.from(index)],
        PROGRAM_ID
    );
    return pda;
}

function findNonTransferableNftStatus(mint: web3.PublicKey): web3.PublicKey {
    const [pda] = PublicKey.findProgramAddressSync(
        [Buffer.from("nt-nft-status"), mint.toBuffer()],
        PROGRAM_ID
    );
    return pda;
}

function findNonTransferableRnsIdStatus(rnsId: string): web3.PublicKey {
    const hashedRnsId = crypto.createHash('sha256').update(rnsId).digest().slice(0, 32);
    const [pda] = PublicKey.findProgramAddressSync(
        [Buffer.from("nt-nft-rnsid-status"), hashedRnsId],
        PROGRAM_ID
    );
    return pda;
}

function getUserAssociatedTokenAccount(wallet: web3.PublicKey, mint: web3.PublicKey): web3.PublicKey {
    const [pda] = PublicKey.findProgramAddressSync(
        [wallet.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
        ASSOCIATED_TOKEN_PROGRAM_ID
    );
    return pda;
}

async function main() {
    console.log('========================================');
    console.log('RNS DID Devnet 铸造脚本');
    console.log('========================================\n');

    // 加载钱包
    const walletPath = process.env.HOME + '/.config/solana/id.json';
    const secretKey = JSON.parse(fs.readFileSync(walletPath, 'utf-8'));
    const adminWallet = Keypair.fromSecretKey(new Uint8Array(secretKey));
    
    console.log('Admin 钱包:', adminWallet.publicKey.toBase58());
    console.log('铸造目标:', MINT_TO_ADDRESS.toBase58());
    console.log('RNS ID:', rnsId);
    console.log('Token Index:', tokenIndex);
    console.log('');

    // 连接
    const connection = new Connection(RPC_URL, 'confirmed');
    const wallet = new Wallet(adminWallet);
    const provider = new AnchorProvider(connection, wallet, { commitment: 'confirmed' });
    
    // 加载 IDL
    const idlPath = './target/idl/rnsdid_core.json';
    const idl = JSON.parse(fs.readFileSync(idlPath, 'utf-8'));
    const program = new Program(idl, provider);

    // 计算所有 PDA
    const nonTransferableProject = findNonTransferableProject();
    const nonTransferableProjectMint = getCollectionMintAddress();
    const nonTransferableUserStatus = findNonTransferableUserStatus(rnsId, MINT_TO_ADDRESS);
    const nonTransferableNftMint = getNonTransferableNftMintAddress(rnsId, tokenIndex);
    const nonTransferableNftStatus = findNonTransferableNftStatus(nonTransferableNftMint);
    const nonTransferableRnsIdStatus = findNonTransferableRnsIdStatus(rnsId);
    const userAssociatedTokenAccount = getUserAssociatedTokenAccount(MINT_TO_ADDRESS, nonTransferableNftMint);

    console.log('PDA 地址:');
    console.log('  Project:', nonTransferableProject.toBase58());
    console.log('  Project Mint:', nonTransferableProjectMint.toBase58());
    console.log('  NFT Mint:', nonTransferableNftMint.toBase58());
    console.log('  User Token Account:', userAssociatedTokenAccount.toBase58());
    console.log('');

    // 检查项目是否已初始化
    const projectInfo = await connection.getAccountInfo(nonTransferableProject);
    if (!projectInfo) {
        console.log('❌ 项目未初始化！需要先运行 initialize');
        return;
    }
    console.log('✅ 项目已初始化\n');

    // 执行 airdrop
    console.log('正在铸造 DID NFT...');
    
    try {
        const setComputeUnitLimitIx = ComputeBudgetProgram.setComputeUnitLimit({
            units: 400_000,
        });

        const tx = await program.methods
            .airdrop(rnsId, MINT_TO_ADDRESS, merkleRoot, tokenIndex)
            .accounts({
                authority: adminWallet.publicKey,
                userAccount: MINT_TO_ADDRESS,
                userTokenAccount: userAssociatedTokenAccount,
                nonTransferableUserStatus: nonTransferableUserStatus,
                nonTransferableNftStatus: nonTransferableNftStatus,
                nonTransferableRnsIdStatus: nonTransferableRnsIdStatus,
                nonTransferableNftMint: nonTransferableNftMint,
                nonTransferableProject: nonTransferableProject,
                nonTransferableProjectMint: nonTransferableProjectMint,
                associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
                tokenProgram: TOKEN_PROGRAM_ID,
                systemProgram: SystemProgram.programId,
                rent: SYSVAR_RENT_PUBKEY,
                sysvarInstructions: SYSVAR_INSTRUCTIONS_PUBKEY,
            })
            .preInstructions([setComputeUnitLimitIx])
            .signers([adminWallet])
            .rpc();

        console.log('\n✅ 铸造成功！');
        console.log('交易签名:', tx);
        console.log(`\n查看交易: https://explorer.solana.com/tx/${tx}?cluster=devnet`);
        console.log(`查看 NFT Mint: https://explorer.solana.com/address/${nonTransferableNftMint.toBase58()}?cluster=devnet`);
        console.log(`查看用户 Token Account: https://explorer.solana.com/address/${userAssociatedTokenAccount.toBase58()}?cluster=devnet`);
        
    } catch (error) {
        console.error('\n❌ 铸造失败:', error);
        throw error;
    }
}

main().catch(console.error);
