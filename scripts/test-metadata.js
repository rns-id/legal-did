const { 
    createInitializeMintInstruction,
    createInitializeNonTransferableMintInstruction,
    createInitializePermanentDelegateInstruction,
    createInitializeMetadataPointerInstruction,
    getMintLen,
    ExtensionType,
    TOKEN_2022_PROGRAM_ID,
} = require('@solana/spl-token');

const { 
    createInitializeInstruction,
    pack,
} = require('@solana/spl-token-metadata');

const { PublicKey, Keypair, SystemProgram } = require('@solana/web3.js');

// 模拟账户
const mint = Keypair.generate().publicKey;
const mintAuthority = Keypair.generate().publicKey;
const updateAuthority = Keypair.generate().publicKey;
const payer = Keypair.generate().publicKey;

// 元数据
const metadata = {
    mint: mint,
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

console.log('=== Token-2022 with MetadataPointer ===');
console.log('');
console.log('1. Space Calculation:');
console.log('   Mint len (with extensions):', mintLen);
console.log('   Metadata len:', metadataLen);
console.log('   Total len:', mintLen + metadataLen);
console.log('');

console.log('2. Instruction Order:');
console.log('   1. SystemProgram.createAccount');
console.log('   2. createInitializeNonTransferableMintInstruction');
console.log('   3. createInitializePermanentDelegateInstruction');
console.log('   4. createInitializeMetadataPointerInstruction');
console.log('   5. createInitializeMintInstruction');
console.log('   6. createInitializeInstruction (TokenMetadata)');
console.log('');

console.log('3. Key Points:');
console.log('   - MetadataPointer points to the mint itself');
console.log('   - TokenMetadata is stored in the mint account');
console.log('   - Metadata space must be added to mint len');
console.log('');

// 创建指令示例
const ix1 = createInitializeNonTransferableMintInstruction(mint, TOKEN_2022_PROGRAM_ID);
console.log('NonTransferable IX keys:', ix1.keys.length);

const ix2 = createInitializePermanentDelegateInstruction(mint, mintAuthority, TOKEN_2022_PROGRAM_ID);
console.log('PermanentDelegate IX keys:', ix2.keys.length);

const ix3 = createInitializeMetadataPointerInstruction(mint, updateAuthority, mint, TOKEN_2022_PROGRAM_ID);
console.log('MetadataPointer IX keys:', ix3.keys.length);

const ix4 = createInitializeMintInstruction(mint, 0, mintAuthority, null, TOKEN_2022_PROGRAM_ID);
console.log('InitializeMint IX keys:', ix4.keys.length);

const ix5 = createInitializeInstruction({
    programId: TOKEN_2022_PROGRAM_ID,
    mint: mint,
    metadata: mint,
    name: metadata.name,
    symbol: metadata.symbol,
    uri: metadata.uri,
    mintAuthority: mintAuthority,
    updateAuthority: updateAuthority,
});
console.log('TokenMetadata IX keys:', ix5.keys.length);
