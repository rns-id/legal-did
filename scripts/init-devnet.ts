import { Program, AnchorProvider, Wallet, web3 } from '@coral-xyz/anchor';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import * as fs from 'fs';

const { 
    Connection, 
    PublicKey, 
    Keypair, 
    ComputeBudgetProgram,
    SYSVAR_RENT_PUBKEY,
    SystemProgram
} = web3;

// 配置
const PROGRAM_ID = new PublicKey('BCkys1re7iw8NhM7nu6xLChGpgg9iCC8mZity2maL9en');
const TOKEN_METADATA_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');
const RPC_URL = 'https://api.devnet.solana.com';

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

function getCollectionVaultAddress(): web3.PublicKey {
    const [pda] = PublicKey.findProgramAddressSync(
        [Buffer.from("nt-project-mint-vault")],
        PROGRAM_ID
    );
    return pda;
}

function getCollectionMetadataAddress(mint: web3.PublicKey): web3.PublicKey {
    const [pda] = PublicKey.findProgramAddressSync(
        [Buffer.from('metadata'), TOKEN_METADATA_PROGRAM_ID.toBuffer(), mint.toBuffer()],
        TOKEN_METADATA_PROGRAM_ID
    );
    return pda;
}

function getCollectionMasterEditionAddress(mint: web3.PublicKey): web3.PublicKey {
    const [pda] = PublicKey.findProgramAddressSync(
        [Buffer.from('metadata'), TOKEN_METADATA_PROGRAM_ID.toBuffer(), mint.toBuffer(), Buffer.from('edition')],
        TOKEN_METADATA_PROGRAM_ID
    );
    return pda;
}

async function main() {
    console.log('========================================');
    console.log('RNS DID Devnet 初始化脚本');
    console.log('========================================\n');

    // 加载钱包
    const walletPath = process.env.HOME + '/.config/solana/id.json';
    const secretKey = JSON.parse(fs.readFileSync(walletPath, 'utf-8'));
    const adminWallet = Keypair.fromSecretKey(new Uint8Array(secretKey));
    
    console.log('Admin 钱包:', adminWallet.publicKey.toBase58());

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
    const nonTransferableProjectVault = getCollectionVaultAddress();
    const nonTransferableProjectMetadata = getCollectionMetadataAddress(nonTransferableProjectMint);
    const nonTransferableProjectMasterEdition = getCollectionMasterEditionAddress(nonTransferableProjectMint);

    console.log('\nPDA 地址:');
    console.log('  Project:', nonTransferableProject.toBase58());
    console.log('  Project Mint:', nonTransferableProjectMint.toBase58());
    console.log('  Project Vault:', nonTransferableProjectVault.toBase58());
    console.log('  Project Metadata:', nonTransferableProjectMetadata.toBase58());
    console.log('  Project Master Edition:', nonTransferableProjectMasterEdition.toBase58());
    console.log('');

    // 检查项目是否已初始化
    const projectInfo = await connection.getAccountInfo(nonTransferableProject);
    if (projectInfo) {
        console.log('✅ 项目已经初始化过了！');
        return;
    }

    console.log('正在初始化项目...');
    
    try {
        const setComputeUnitLimitIx = ComputeBudgetProgram.setComputeUnitLimit({
            units: 400_000,
        });

        const domain = "https://dev-api-1.rns.id/";
        
        const tx = await program.methods
            .initialize({
                name: "Legal DID",
                symbol: 'LDID',
                uri: `${domain}api/v2/portal/identity/collection/metadata/`,
                baseUri: `${domain}api/v2/portal/identity/nft/`
            })
            .accounts({
                authority: adminWallet.publicKey,
                nonTransferableProject: nonTransferableProject,
                nonTransferableProjectMint: nonTransferableProjectMint,
                nonTransferableProjectVault: nonTransferableProjectVault,
                nonTransferableProjectMetadata: nonTransferableProjectMetadata,
                nonTransferableProjectMasterEdition: nonTransferableProjectMasterEdition,
                tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
                tokenProgram: TOKEN_PROGRAM_ID,
                systemProgram: SystemProgram.programId,
                rent: SYSVAR_RENT_PUBKEY,
            })
            .preInstructions([setComputeUnitLimitIx])
            .signers([adminWallet])
            .rpc();

        console.log('\n✅ 初始化成功！');
        console.log('交易签名:', tx);
        console.log(`\n查看交易: https://explorer.solana.com/tx/${tx}?cluster=devnet`);
        
    } catch (error) {
        console.error('\n❌ 初始化失败:', error);
        throw error;
    }
}

main().catch(console.error);
