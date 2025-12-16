import { Program, web3, AnchorProvider, Wallet, setProvider } from '@coral-xyz/anchor'
import { RnsdidCore } from '../target/types/rnsdid_core'
import { ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { ComputeBudgetProgram, PublicKey, SYSVAR_RENT_PUBKEY } from '@solana/web3.js'
import * as crypto from 'crypto'
import * as fs from 'fs'
import * as path from 'path'

const TOKEN_2022_PROGRAM_ID = new PublicKey('TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb')
const TARGET_WALLET = new PublicKey('H2sykMLjWjBCtALDYCwnqxALEWtDbBwfCXtz7YThoEne')
const PROGRAM_ID = new PublicKey('BCkys1re7iw8NhM7nu6xLChGpgg9iCC8mZity2maL9en')

// 使用真实的 metadata UUID
const REAL_METADATA_ID = '082d9a09-aa3c-49dc-ae66-e8800261a2ab'
const REAL_BASE_URI = 'https://api.rns.id/api/v2/portal/identity/nft/'

async function main() {
    const connection = new web3.Connection('https://api.devnet.solana.com', 'confirmed')
    
    const walletPath = path.join(process.env.HOME || '', '.config/solana/id.json')
    const secretKey = JSON.parse(fs.readFileSync(walletPath, 'utf-8'))
    const keypair = web3.Keypair.fromSecretKey(new Uint8Array(secretKey))
    const wallet = new Wallet(keypair)
    
    const provider = new AnchorProvider(connection, wallet, { commitment: 'confirmed' })
    setProvider(provider)
    
    const idlPath = path.join(__dirname, '../target/idl/rnsdid_core.json')
    const idl = JSON.parse(fs.readFileSync(idlPath, 'utf-8'))
    const program = new Program(idl, provider) as Program<RnsdidCore>

    console.log('========================================')
    console.log('RNSID Mint with Real Metadata')
    console.log('========================================')
    console.log('Program ID:', PROGRAM_ID.toBase58())
    console.log('Target Wallet:', TARGET_WALLET.toBase58())
    console.log('Metadata URI:', `${REAL_BASE_URI}${REAL_METADATA_ID}.json`)
    console.log('')

    const [nonTransferableProject] = PublicKey.findProgramAddressSync(
        [Buffer.from('nt-proj-v3')],
        PROGRAM_ID
    )
    const [nonTransferableProjectMint] = PublicKey.findProgramAddressSync(
        [Buffer.from('nt-project-mint-v3')],
        PROGRAM_ID
    )

    // 使用真实的 metadata ID 作为 rnsId
    const rnsId = REAL_METADATA_ID
    const tokenIndex = Date.now().toString()
    const merkleRoot = '2d852b3c21e923484a93d3a980a45b7571e89552d58875d40dd17c73216a49d7'

    const hashedRnsId = crypto.createHash('sha256').update(rnsId).digest().slice(0, 32)
    const [didStatus] = PublicKey.findProgramAddressSync(
        [Buffer.from('did-status-v3'), hashedRnsId, TARGET_WALLET.toBuffer()],
        PROGRAM_ID
    )

    console.log('RNS ID (metadata UUID):', rnsId)
    console.log('DID Status PDA:', didStatus.toBase58())

    const projectAccount = await program.account.projectAccount.fetch(nonTransferableProject)
    const feeRecipient = projectAccount.feeRecipient

    // 检查当前 base_uri
    console.log('Current Base URI:', projectAccount.baseUri)

    // 如果 base_uri 不对，需要更新
    if (projectAccount.baseUri !== REAL_BASE_URI) {
        console.log('\n--- Updating Base URI ---')
        try {
            const updateTx = await program.methods
                .setBaseUri(REAL_BASE_URI)
                .accountsPartial({
                    authority: wallet.publicKey,
                    nonTransferableProject: nonTransferableProject,
                })
                .rpc()
            console.log('✅ Base URI updated, tx:', updateTx)
        } catch (error: any) {
            console.log('⚠️  Could not update base URI:', error.message)
        }
    }

    // 授权铸造
    console.log('\n--- Authorize Mint ---')
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
            console.log('⚠️  Already authorized, continuing to mint...')
        } else {
            throw error
        }
    }

    // 铸造 NFT
    console.log('\n--- Mint NFT ---')
    const [nonTransferableNftMint] = PublicKey.findProgramAddressSync(
        [Buffer.from('nt-nft-mint-v3'), Buffer.from(tokenIndex)],
        PROGRAM_ID
    )
    const [userTokenAccount] = PublicKey.findProgramAddressSync(
        [TARGET_WALLET.toBuffer(), TOKEN_2022_PROGRAM_ID.toBuffer(), nonTransferableNftMint.toBuffer()],
        ASSOCIATED_TOKEN_PROGRAM_ID
    )

    console.log('Token Index:', tokenIndex)
    console.log('NFT Mint:', nonTransferableNftMint.toBase58())

    const ix = ComputeBudgetProgram.setComputeUnitLimit({ units: 1_000_000 })

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

    console.log('\n========================================')
    console.log('🎉 Success!')
    console.log('========================================')
    console.log('NFT Mint:', nonTransferableNftMint.toBase58())
    console.log('Metadata URI:', `${REAL_BASE_URI}${rnsId}.json`)
    console.log('Transaction:', tx)
    console.log('')
    console.log('View on Explorer:')
    console.log(`https://explorer.solana.com/address/${nonTransferableNftMint.toBase58()}?cluster=devnet`)
    console.log(`https://explorer.solana.com/tx/${tx}?cluster=devnet`)
}

main().catch(console.error)
