/**
 * 使用官方 sas-lib 设置 SAS Credential 和 Schema
 * 
 * 参考: https://github.com/solana-foundation/solana-attestation-service/blob/master/examples/typescript/setup-koranet-schema.ts
 * 
 * 运行: npx ts-node scripts/svm/attestation/setup-sas-official.ts
 */

import {
    deriveCredentialPda,
    deriveSchemaPda,
    getCreateCredentialInstruction,
    getCreateSchemaInstruction,
    type CreateCredentialInput,
    type CreateSchemaInput,
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
    type Address,
} from "@solana/kit";
import { createKeyPairSignerFromPrivateKeyBytes, signTransactionMessageWithSigners } from "@solana/signers";
import * as fs from "fs";

// Schema 定义
const SCHEMAS = [
    { 
        name: "jurisdiction", 
        description: "Jurisdiction attestation - country/region",
        layout: { jurisdiction: 32 }, // string max 32 bytes
    },
    { 
        name: "age_verification", 
        description: "Age verification attestation",
        layout: { age_over_18: 1, age_over_21: 1, birth_year: 2 }, // bool, bool, u16
    },
    { 
        name: "gender", 
        description: "Gender attestation",
        layout: { gender: 8 }, // string max 8 bytes
    },
    { 
        name: "sanctions", 
        description: "Sanctions check attestation",
        layout: { sanctions_clear: 1, check_date: 8 }, // bool, i64
    },
    { 
        name: "validity", 
        description: "Validity status attestation",
        layout: { valid: 1, issued: 8, expires: 8 }, // bool, i64, i64
    },
    { 
        name: "identity", 
        description: "Identity document attestation",
        layout: { id_type: 16, photo_hash: 32 }, // string, string
    }
];

const CREDENTIAL_NAME = "legal-did-credential";

async function main() {
    console.log("\n" + "=".repeat(80));
    console.log("🔧 使用官方 sas-lib 设置 SAS Credential 和 Schema");
    console.log("=".repeat(80));

    // 创建 RPC 客户端
    const rpc = createSolanaRpc("https://api.devnet.solana.com");
    const rpcSubscriptions = createSolanaRpcSubscriptions("wss://api.devnet.solana.com");

    // 加载钱包
    const walletPath = process.env.HOME + "/.config/solana/id.json";
    const walletData = JSON.parse(fs.readFileSync(walletPath, "utf8"));
    const privateKeyBytes = new Uint8Array(walletData);
    
    const payer = await createKeyPairSignerFromPrivateKeyBytes(privateKeyBytes);
    const authority = payer; // 使用同一个钱包作为 authority

    console.log(`\n📍 钱包地址: ${payer.address}`);

    // 获取余额
    const balanceResult = await rpc.getBalance(payer.address as Address).send();
    console.log(`💰 余额: ${Number(balanceResult.value) / 1e9} SOL`);

    // 计算 Credential PDA
    const [credentialPda] = await deriveCredentialPda({
        authority: authority.address,
        name: CREDENTIAL_NAME,
    });
    console.log(`\n📜 Credential PDA: ${credentialPda}`);

    // 检查 Credential 是否存在
    const credentialInfo = await rpc.getAccountInfo(credentialPda as Address).send();
    
    if (!credentialInfo.value) {
        console.log(`\n🔨 创建 Credential: ${CREDENTIAL_NAME}`);
        
        const credentialInput: CreateCredentialInput = {
            payer: payer,
            authority: authority,
            credential: credentialPda,
            name: CREDENTIAL_NAME,
            signers: [], // 空的 signers 数组
        };

        const credentialIx = getCreateCredentialInstruction(credentialInput);
        const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();

        const txMessage = pipe(
            createTransactionMessage({ version: 0 }),
            tx => setTransactionMessageFeePayer(payer.address, tx),
            tx => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
            tx => appendTransactionMessageInstruction(credentialIx, tx),
        );

        const signedTx = await signTransactionMessageWithSigners(txMessage);
        const sendAndConfirm = sendAndConfirmTransactionFactory({ rpc, rpcSubscriptions });

        try {
            await sendAndConfirm(signedTx, { commitment: "confirmed", skipPreflight: true });
            const signature = getSignatureFromTransaction(signedTx);
            console.log(`   ✅ 成功! TX: ${signature}`);
        } catch (error: any) {
            console.log(`   ❌ 失败:`, error.message || error);
            return;
        }
    } else {
        console.log(`   ✅ Credential 已存在`);
    }

    // 创建 Schemas
    console.log("\n" + "=".repeat(80));
    console.log("📋 创建 Schemas");
    console.log("=".repeat(80));

    const schemaResults: { name: string; address: string; cost?: number }[] = [];

    for (const schema of SCHEMAS) {
        // 计算 Schema PDA (version = 1)
        const [schemaPda] = await deriveSchemaPda({
            credential: credentialPda,
            name: schema.name,
            version: 1,
        });

        console.log(`\n🔨 创建 Schema: ${schema.name}`);
        console.log(`   Schema PDA: ${schemaPda}`);

        // 检查 Schema 是否存在
        const schemaInfo = await rpc.getAccountInfo(schemaPda as Address).send();
        if (schemaInfo.value) {
            console.log(`   ✅ Schema 已存在`);
            schemaResults.push({ name: schema.name, address: schemaPda.toString() });
            continue;
        }

        const balanceBefore = await rpc.getBalance(payer.address as Address).send();

        const schemaInput: CreateSchemaInput = {
            payer: payer,
            authority: authority,
            credential: credentialPda,
            schema: schemaPda,
            name: schema.name,
            description: schema.description,
            layout: new Uint8Array(Object.values(schema.layout)),
            fieldNames: Object.keys(schema.layout),
        };

        const schemaIx = getCreateSchemaInstruction(schemaInput);
        const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();

        const txMessage = pipe(
            createTransactionMessage({ version: 0 }),
            tx => setTransactionMessageFeePayer(payer.address, tx),
            tx => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
            tx => appendTransactionMessageInstruction(schemaIx, tx),
        );

        const signedTx = await signTransactionMessageWithSigners(txMessage);
        const sendAndConfirm = sendAndConfirmTransactionFactory({ rpc, rpcSubscriptions });

        try {
            await sendAndConfirm(signedTx, { commitment: "confirmed", skipPreflight: true });
            const signature = getSignatureFromTransaction(signedTx);
            
            const balanceAfter = await rpc.getBalance(payer.address as Address).send();
            const cost = Number(balanceBefore.value) - Number(balanceAfter.value);
            
            console.log(`   ✅ 成功! TX: ${signature}`);
            console.log(`   💰 成本: ${cost.toLocaleString()} lamports (${(cost / 1e9).toFixed(6)} SOL)`);
            
            schemaResults.push({ name: schema.name, address: schemaPda.toString(), cost });
        } catch (error: any) {
            console.log(`   ❌ 失败:`, error.message || error);
        }
    }

    // 汇总
    const finalBalance = await rpc.getBalance(payer.address as Address).send();
    
    console.log("\n" + "=".repeat(80));
    console.log("📊 汇总");
    console.log("=".repeat(80));
    
    if (schemaResults.length > 0) {
        console.log(`\n✅ Schema 列表 (${schemaResults.length} 个):`);
        for (const r of schemaResults) {
            console.log(`   ${r.name}: ${r.address}`);
            if (r.cost) {
                console.log(`      成本: ${r.cost.toLocaleString()} lamports`);
            }
        }
        
        // 保存到文件
        const outputPath = "scripts/svm/attestation/schema-addresses.json";
        fs.writeFileSync(outputPath, JSON.stringify({
            credential: credentialPda.toString(),
            schemas: schemaResults,
        }, null, 2));
        console.log(`\n📄 Schema 地址已保存到: ${outputPath}`);
    }
    
    console.log(`\n💰 最终余额: ${Number(finalBalance.value) / 1e9} SOL`);
}

main().catch(console.error);
