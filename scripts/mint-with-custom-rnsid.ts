import { Program, web3, AnchorProvider, Wallet, setProvider } from '@coral-xyz/anchor'
import { RnsdidCore } from '../target/types/rnsdid_core'
import { ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { ComputeBudgetProgram, PublicKey, SYSVAR_RENT_PUBKEY } from '@solana/web3.js'
import * as crypto from 'crypto'
import * as fs from 'fs'
import * as path from 'path'

// Token-2022 Program ID
const TOKEN_2022_PROGRAM_ID = new PublicKey('TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb')

// 目标钱包
const TARGET_WALLET = new PublicKey('H2sykMLjWjBCtALDYCwnqxALEWtDbBwfCXtz7YThoEne')

// Program ID
const PROGRAM_ID = new PublicKey('BCkys1re7iw8NhM7nu6xLChGpgg9iCC8mZity2maL9en')

// 自定义 RNS ID
const CUSTOM_RNS_ID = 'ae5e6091-871b-4aba-8014-d9ede2d188ba'

// 新的 Base URI (生产环境)
const NEW_BASE_URI = 'https://api.rns.id/api/v2/portal/identity/nft/'

async function main() {
    // 连接 devnet
    const connection = new web3.Connection('https://api.devnet.solana.com', 'confirmed')
    
    // 加载钱包
    const walletPath = path.join(process.env.HOME || '', '.config/solana/id.json')
    const secretKey = JSON.parse(fs.readFileSync(walletPath, 'utf-8'))
    const keypair = web3.Keypair.fromSecretKey(new Uint8Array(secretKey))
    const wallet = new Wallet(keypair)
    
    // 创建 provider
    const provider = new AnchorProvider(connection, wallet, { commitment: 'confirmed' })
    setProvider(provider)
    
    // 加载 IDL
    const idlPath = path.join(__dirname, '../target/idl/rnsdid_core.json')
    const idl = JSON.parse(fs.readFileSync(idlPath, 'utf-8'))
    const program = new Program(idl, provider) as Program<RnsdidCore>

    console.log('========================================')
    console.log('RNSID Token-2022 Mint with Custom RNS ID')
    console.log('========================================')
    console.log('Program ID:', PROGRAM_ID.toBase58())
    console.log('Admin:', wallet.publicKey.toBase58())
    console.log('Target Wallet:', TARGET_WALLET.toBase58())
    console.log('Custom RNS ID:', CUSTOM_RNS_ID)
    console.log('')

    // PDA 计算 (v3 版本)
    const [nonTransferableProject] = PublicKey.findProgramAddressSync(
        [Buffer.from('nt-proj-v3')],
        PROGRAM_ID
    )

    console.log('Project PDA:', nonTransferableProject.toBase58())

    // 1. 更新 Base URI
    console.log('\n--- Step 1: Update Base URI ---')
    
    const projectAccount = await program.account.projectAccount.fetch(nonTransferableProject)
    console.log('Current Base URI:', projectAccount.baseUri)
    
    if (projectAccount.baseUri !== NEW_BASE_URI) {
        const updateTx = await program.methods
            .setBaseUri(NEW_BASE_URI)
            .accountsPartial({
                authority: wallet.publicKey,
                nonTransferableProject: nonTransferableProject,
            })
            .rpc()
        console.log('✅ Base URI updated, tx:', updateTx)
    } else {
        console.log('✅ Base URI already set correctly')
    }

    // 2. 授权
    console.log('\n--- Step 2: Authorize Mint ---')

    const rnsId = CUSTOM_RNS_ID
    const tokenIndex = Date.now().toString()
    const merkleRoot = '2d852b3c21e923484a93d3a980a45b7571e89552d58875d40dd17c73216a49d7'

    // 计算 DID Status PDA
    const hashedRnsId = crypto.createHash('sha256').update(rnsId).digest().slice(0, 32)
    const [didStatus] = PublicKey.findProgramAddressSync(
        [Buffer.from('did-status-v3'), hashedRnsId, TARGET_WALLET.toBuffer()],
        PROGRAM_ID
    )

    console.log('RNS ID:', rnsId)
    console.log('DID Status PDA:', didStatus.toBase58())

    // 获取 fee_recipient
    const updatedProject = await program.account.projectAccount.fetch(nonTransferableProject)
    const feeRecipient = updatedProject.feeRecipient

    try {
        const authTx = await program.methods
            .authorizeMint(rnsId, TARGET_WALLET)
            .accountsPartial({
                authority: wallet.publicKey,
                nonTransferableProject: nonTransferableProject,
                didStatus: didStatus,
                feeRecipient: feeRecipient,
                systemProgram: web3.SystemProgram.programId,
                rent: SYSVAR_RENT_PUBKEY,
            })
            .rpc()

        console.log('✅ Authorized, tx:', authTx)
    } catch (error: any) {
        if (error.message?.includes('already in use') || error.message?.includes('LDIDHasAuthorized')) {
            console.log('⚠️  Already authorized, continuing...')
        } else {
            console.log('Error:', error.message)
            throw error
        }
    }

    // 3. 铸造 NFT
    console.log('\n--- Step 3: Mint NFT to Target Wallet ---')

    // 计算 NFT Mint PDA
    const [nonTransferableNftMint] = PublicKey.findProgramAddressSync(
        [Buffer.from('nt-nft-mint-v3'), Buffer.from(tokenIndex)],
        PROGRAM_ID
    )

    // Token-2022 ATA
    const [userTokenAccount] = PublicKey.findProgramAddressSync(
        [TARGET_WALLET.toBuffer(), TOKEN_2022_PROGRAM_ID.toBuffer(), nonTransferableNftMint.toBuffer()],
        ASSOCIATED_TOKEN_PROGRAM_ID
    )

    console.log('Token Index:', tokenIndex)
    console.log('NFT Mint:', nonTransferableNftMint.toBase58())
    console.log('User ATA:', userTokenAccount.toBase58())

    const ix = ComputeBudgetProgram.setComputeUnitLimit({ units: 1_000_000 })

    try {
        const tx = await program.methods
            .airdrop(rnsId, TARGET_WALLET, merkleRoot, tokenIndex)
            .accountsPartial({
                authority: wallet.publicKey,
                nonTransferableProject: nonTransferableProject,
                nonTransferableNftMint: nonTransferableNftMint,
                userAccount: TARGET_WALLET,
                userTokenAccount: userTokenAccount,
                didStatus: didStatus,
                associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
                tokenProgram: TOKEN_2022_PROGRAM_ID,
                systemProgram: web3.SystemProgram.programId,
                rent: SYSVAR_RENT_PUBKEY,
            })
            .preInstructions([ix])
            .rpc()

        console.log('\n✅ NFT Minted!')
        console.log('Transaction:', tx)
        console.log('')
        console.log('========================================')
        console.log('🎉 Success!')
        console.log('========================================')
        console.log('Target Wallet:', TARGET_WALLET.toBase58())
        console.log('NFT Mint:', nonTransferableNftMint.toBase58())
        console.log('')
        console.log('Metadata URI:', `${NEW_BASE_URI}${rnsId}.json`)
        console.log('')
        console.log('View on Explorer:')
        console.log(`https://explorer.solana.com/address/${nonTransferableNftMint.toBase58()}?cluster=devnet`)
        console.log(`https://explorer.solana.com/address/${TARGET_WALLET.toBase58()}?cluster=devnet`)
        console.log(`https://explorer.solana.com/tx/${tx}?cluster=devnet`)
    } catch (error) {
        console.error('Error:', error)
    }
}

main().catch(console.error)
