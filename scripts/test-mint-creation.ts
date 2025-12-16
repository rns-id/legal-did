import { 
    Connection, 
    Keypair, 
    SystemProgram, 
    Transaction, 
    sendAndConfirmTransaction,
    LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import { 
    createInitializeMintInstruction,
    createInitializeNonTransferableMintInstruction,
    createInitializePermanentDelegateInstruction,
    createInitializeMetadataPointerInstruction,
    getMintLen,
    ExtensionType,
    TOKEN_2022_PROGRAM_ID,
} from '@solana/spl-token';
import { 
    createInitializeInstruction,
    pack,
} from '@solana/spl-token-metadata';
import * as fs from 'fs';

async function main() {
    const connection = new Connection('http://localhost:8899', 'confirmed');
    
    // 加载钱包
    const walletPath = process.env.HOME + '/.config/solana/id.json';
    const secretKey = JSON.parse(fs.readFileSync(walletPath, 'utf-8'));
    const payer = Keypair.fromSecretKey(new Uint8Array(secretKey));
    
    console.log('Payer:', payer.publicKey.toBase58());
    
    // 创建新的 Mint
    const mint = Keypair.generate();
    const mintAuthority = payer.publicKey;
    const updateAuthority = payer.publicKey;
    
    console.log('Mint:', mint.publicKey.toBase58());
    
    // 元数据
    const metadata = {
        mint: mint.publicKey,
        name: 'Test NFT',
        symbol: 'TEST',
        uri: 'https://example.com/metadata.json',
        additionalMetadata: [],
    };
    
    // 计算空间
    const extensions = [
        ExtensionType.NonTransferable,
        ExtensionType.PermanentDelegate,
        ExtensionType.MetadataPointer,
    ];
    
    const mintLen = getMintLen(extensions);
    const metadataLen = pack(metadata).length;
    const totalLen = mintLen + metadataLen;
    
    console.log('');
    console.log('Space calculation:');
    console.log('  Mint len:', mintLen);
    console.log('  Metadata len:', metadataLen);
    console.log('  Total len:', totalLen);
    
    // 计算租金
    const lamports = await connection.getMinimumBalanceForRentExemption(totalLen);
    console.log('  Lamports:', lamports);
    
    // 创建交易
    const transaction = new Transaction().add(
        // 1. 创建账户
        SystemProgram.createAccount({
            fromPubkey: payer.publicKey,
            newAccountPubkey: mint.publicKey,
            space: totalLen,
            lamports,
            programId: TOKEN_2022_PROGRAM_ID,
        }),
        // 2. NonTransferable
        createInitializeNonTransferableMintInstruction(mint.publicKey, TOKEN_2022_PROGRAM_ID),
        // 3. PermanentDelegate
        createInitializePermanentDelegateInstruction(mint.publicKey, mintAuthority, TOKEN_2022_PROGRAM_ID),
        // 4. MetadataPointer
        createInitializeMetadataPointerInstruction(mint.publicKey, updateAuthority, mint.publicKey, TOKEN_2022_PROGRAM_ID),
        // 5. InitializeMint
        createInitializeMintInstruction(mint.publicKey, 0, mintAuthority, null, TOKEN_2022_PROGRAM_ID),
        // 6. TokenMetadata
        createInitializeInstruction({
            programId: TOKEN_2022_PROGRAM_ID,
            mint: mint.publicKey,
            metadata: mint.publicKey,
            name: metadata.name,
            symbol: metadata.symbol,
            uri: metadata.uri,
            mintAuthority: mintAuthority,
            updateAuthority: updateAuthority,
        }),
    );
    
    console.log('');
    console.log('Sending transaction...');
    
    try {
        const signature = await sendAndConfirmTransaction(connection, transaction, [payer, mint]);
        console.log('Success! Signature:', signature);
    } catch (error) {
        console.error('Error:', error);
    }
}

main().catch(console.error);
