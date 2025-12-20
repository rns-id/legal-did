/**
 * 添加 Authority 到 Credential 的 authorizedSigners 列表
 *
 * 运行: npx ts-node --project scripts/svm/attestation/tsconfig.json scripts/svm/attestation/add-authorized-signer.ts
 */

import {
    deriveCredentialPda,
    getChangeAuthorizedSignersInstruction,
} from "sas-lib";
import {
    createSolanaRpc,
    createSolanaRpcSubscriptions,
    createTransactionMessage,
    setTransactionMessageFeePayer,
    setTransactionMessageLifetimeUsingBlockhash,
    appendTransactionMessageInstruction,
    pipe,
    getSignatureFromTransaction,
    sendAndConfirmTransactionFactory,
} from "@solana/kit";
import {
    createKeyPairSignerFromPrivateKeyBytes,
    signTransactionMessageWithSigners,
} from "@solana/signers";
import * as fs from "fs";

const CREDENTIAL_NAME = "legal-did-credential";

async function main(): Promise<void> {
    console.log("\n" + "=".repeat(80));
    console.log("🔧 添加 Authority 到 authorizedSigners");
    console.log("=".repeat(80));

    const rpc = createSolanaRpc("https://api.devnet.solana.com");
    const rpcSubscriptions = createSolanaRpcSubscriptions("wss://api.devnet.solana.com");

    // 加载钱包
    const walletPath = process.env.HOME + "/.config/solana/id.json";
    const walletData = JSON.parse(fs.readFileSync(walletPath, "utf8"));
    const privateKeyBytes = new Uint8Array(walletData.slice(0, 32));
    const payer = await createKeyPairSignerFromPrivateKeyBytes(privateKeyBytes);

    console.log(`\n📍 钱包地址: ${payer.address}`);

    // 计算 Credential PDA
    const [credentialPda] = await deriveCredentialPda({
        authority: payer.address,
        name: CREDENTIAL_NAME,
    });
    console.log(`📜 Credential: ${credentialPda}`);

    // 创建指令 - 添加 authority 到 authorizedSigners
    console.log(`\n🔨 添加 ${payer.address} 到 authorizedSigners...`);

    const ix = getChangeAuthorizedSignersInstruction({
        payer: payer,
        authority: payer,
        credential: credentialPda,
        signers: [payer.address], // 添加 authority 自己
    });

    const blockhashResult = (await rpc.getLatestBlockhash().send()) as any;
    const latestBlockhash = blockhashResult.value;

    const txMessage = pipe(
        createTransactionMessage({ version: 0 }),
        (tx) => setTransactionMessageFeePayer(payer.address, tx),
        (tx) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
        (tx) => appendTransactionMessageInstruction(ix, tx)
    );

    const signedTx = await signTransactionMessageWithSigners(txMessage);
    const sendAndConfirm = sendAndConfirmTransactionFactory({ rpc, rpcSubscriptions } as any);

    try {
        await sendAndConfirm(signedTx as any, { commitment: "confirmed", skipPreflight: true });
        const signature = getSignatureFromTransaction(signedTx);
        console.log(`✅ 成功! TX: ${signature}`);
    } catch (error) {
        const err = error as Error;
        console.log(`❌ 失败:`, err.message || err);
    }
}

main().catch(console.error);
