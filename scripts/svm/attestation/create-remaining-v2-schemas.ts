/**
 * 创建剩余的 v2 Schema (String 类型) 并创建测试 Attestation
 * - age_verification_v2
 * - sanctions_v2
 * - validity_v2
 *
 * 运行: npx ts-node --project scripts/svm/attestation/tsconfig.json scripts/svm/attestation/create-remaining-v2-schemas.ts
 */

import {
    deriveCredentialPda,
    deriveSchemaPda,
    deriveAttestationPda,
    getCreateSchemaInstruction,
    getCreateAttestationInstruction,
    fetchSchema,
    serializeAttestationData,
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
    generateKeyPairSigner,
} from "@solana/kit";
import {
    createKeyPairSignerFromPrivateKeyBytes,
    signTransactionMessageWithSigners,
} from "@solana/signers";
import * as fs from "fs";

const CREDENTIAL_NAME = "legal-did-credential";

// 新的 v2 Schemas
const SCHEMAS_V2 = [
    {
        name: "age_verification_v2",
        description: "Age verification with string fields",
        layout: [12, 12, 12], // 3 个 String 字段
        fieldNames: ["over_18", "over_21", "birth_year"],
        testData: { over_18: "true", over_21: "true", birth_year: "1990" },
    },
    {
        name: "sanctions_v2",
        description: "Sanctions check with string fields",
        layout: [12, 12], // 2 个 String 字段
        fieldNames: ["clear", "check_date"],
        testData: { clear: "true", check_date: "2024-12-18" },
    },
    {
        name: "validity_v2",
        description: "Validity status with string fields",
        layout: [12, 12, 12], // 3 个 String 字段
        fieldNames: ["valid", "issued", "expires"],
        testData: { valid: "true", issued: "2024-12-01", expires: "2025-12-01" },
    },
];

interface SchemaResult {
    name: string;
    schemaAddress: string;
    schemaCost?: number;
    attestationAddress?: string;
    attestationCost?: number;
    accountSize?: number;
    data: Record<string, string>;
}

async function main(): Promise<void> {
    console.log("\n" + "=".repeat(80));
    console.log("🔧 创建剩余的 v2 Schema (String 类型)");
    console.log("=".repeat(80));

    const rpc = createSolanaRpc("https://api.devnet.solana.com");
    const rpcSubscriptions = createSolanaRpcSubscriptions("wss://api.devnet.solana.com");

    // 加载钱包
    const walletPath = process.env.HOME + "/.config/solana/id.json";
    const walletData = JSON.parse(fs.readFileSync(walletPath, "utf8"));
    const privateKeyBytes = new Uint8Array(walletData.slice(0, 32));
    const payer = await createKeyPairSignerFromPrivateKeyBytes(privateKeyBytes);

    console.log(`\n📍 钱包地址: ${payer.address}`);

    const initialBalance = (await rpc.getBalance(payer.address as any).send()) as any;
    console.log(`💰 初始余额: ${(Number(initialBalance.value) / 1e9).toFixed(4)} SOL`);

    // 计算 Credential PDA
    const [credentialPda] = await deriveCredentialPda({
        authority: payer.address,
        name: CREDENTIAL_NAME,
    });
    console.log(`📜 Credential: ${credentialPda}`);

    const results: SchemaResult[] = [];

    for (const schemaConfig of SCHEMAS_V2) {
        console.log(`\n${"─".repeat(60)}`);
        console.log(`📋 处理: ${schemaConfig.name}`);
        console.log(`${"─".repeat(60)}`);

        const result: SchemaResult = {
            name: schemaConfig.name,
            schemaAddress: "",
            data: schemaConfig.testData,
        };

        // ========== 1. 创建 Schema ==========
        const [schemaPda] = await deriveSchemaPda({
            credential: credentialPda,
            name: schemaConfig.name,
            version: 1,
        });
        result.schemaAddress = schemaPda.toString();

        console.log(`\n🔨 Schema: ${schemaConfig.name}`);
        console.log(`   PDA: ${schemaPda}`);
        console.log(`   Layout: { ${schemaConfig.fieldNames.map(f => `${f}: String`).join(", ")} }`);

        // 检查 Schema 是否已存在
        const schemaAccountInfo = (await rpc.getAccountInfo(schemaPda as any).send()) as any;
        if (schemaAccountInfo.value) {
            console.log(`   ✅ Schema 已存在`);
        } else {
            const balanceBefore = (await rpc.getBalance(payer.address as any).send()) as any;

            const schemaIx = getCreateSchemaInstruction({
                payer: payer,
                authority: payer,
                credential: credentialPda,
                schema: schemaPda,
                name: schemaConfig.name,
                description: schemaConfig.description,
                layout: new Uint8Array(schemaConfig.layout),
                fieldNames: schemaConfig.fieldNames,
            });

            const blockhashResult = (await rpc.getLatestBlockhash().send()) as any;
            const latestBlockhash = blockhashResult.value;

            const txMessage = pipe(
                createTransactionMessage({ version: 0 }),
                (tx: any) => setTransactionMessageFeePayer(payer.address, tx),
                (tx: any) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
                (tx: any) => appendTransactionMessageInstruction(schemaIx, tx)
            );

            const signedTx = await signTransactionMessageWithSigners(txMessage as any);
            const sendAndConfirm = sendAndConfirmTransactionFactory({ rpc, rpcSubscriptions } as any);

            try {
                await sendAndConfirm(signedTx as any, { commitment: "confirmed", skipPreflight: true });
                const signature = getSignatureFromTransaction(signedTx as any);

                const balanceAfter = (await rpc.getBalance(payer.address as any).send()) as any;
                const cost = Number(balanceBefore.value) - Number(balanceAfter.value);
                result.schemaCost = cost;

                console.log(`   ✅ 创建成功! TX: ${signature}`);
                console.log(`   💰 成本: ${cost.toLocaleString()} lamports`);
            } catch (error) {
                const err = error as Error;
                console.log(`   ❌ 创建失败:`, err.message || err);
                continue;
            }
        }

        // ========== 2. 创建 Attestation ==========
        // 获取 Schema 数据
        let schemaAccount;
        try {
            schemaAccount = await fetchSchema(rpc, schemaPda);
        } catch (e) {
            console.log(`   ⚠️ 无法获取 Schema 数据，跳过 Attestation 创建`);
            results.push(result);
            continue;
        }

        // 生成随机 nonce
        const nonceSigner = await generateKeyPairSigner();
        const nonce = nonceSigner.address;

        // 计算 Attestation PDA
        const [attestationPda] = await deriveAttestationPda({
            credential: credentialPda,
            schema: schemaPda,
            nonce: nonce,
        });

        console.log(`\n🎫 Attestation`);
        console.log(`   PDA: ${attestationPda}`);
        console.log(`   数据: ${JSON.stringify(schemaConfig.testData)}`);

        // 序列化数据
        const dataBuffer = serializeAttestationData(schemaAccount.data, schemaConfig.testData);
        console.log(`   📦 序列化: ${dataBuffer.length} bytes`);

        const balanceBefore2 = (await rpc.getBalance(payer.address as any).send()) as any;

        // 设置过期时间为 1 年后
        const oneYearFromNow = BigInt(Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60);

        const attestationIx = getCreateAttestationInstruction({
            payer: payer,
            authority: payer,
            credential: credentialPda,
            schema: schemaPda,
            attestation: attestationPda,
            nonce: nonce,
            data: dataBuffer,
            expiry: oneYearFromNow,
        });

        const blockhashResult2 = (await rpc.getLatestBlockhash().send()) as any;
        const latestBlockhash2 = blockhashResult2.value;

        const txMessage2 = pipe(
            createTransactionMessage({ version: 0 }),
            (tx: any) => setTransactionMessageFeePayer(payer.address, tx),
            (tx: any) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash2, tx),
            (tx: any) => appendTransactionMessageInstruction(attestationIx, tx)
        );

        const signedTx2 = await signTransactionMessageWithSigners(txMessage2 as any);
        const sendAndConfirm2 = sendAndConfirmTransactionFactory({ rpc, rpcSubscriptions } as any);

        try {
            await sendAndConfirm2(signedTx2 as any, { commitment: "confirmed", skipPreflight: true });
            const signature = getSignatureFromTransaction(signedTx2 as any);

            const balanceAfter2 = (await rpc.getBalance(payer.address as any).send()) as any;
            const cost = Number(balanceBefore2.value) - Number(balanceAfter2.value);

            result.attestationAddress = attestationPda.toString();
            result.attestationCost = cost;

            console.log(`   ✅ 创建成功! TX: ${signature}`);
            console.log(`   💰 成本: ${cost.toLocaleString()} lamports (${(cost / 1e9).toFixed(6)} SOL)`);

            // 计算 USD
            const solPrice = 140;
            const usdCost = (cost / 1e9) * solPrice;
            console.log(`   💵 USD: $${usdCost.toFixed(2)} (@$${solPrice}/SOL)`);
        } catch (error) {
            const err = error as Error;
            console.log(`   ❌ 创建失败:`, err.message || err);
        }

        results.push(result);

        // 等待一下避免 rate limit
        await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    // ========== 汇总 ==========
    const finalBalance = (await rpc.getBalance(payer.address as any).send()) as any;
    const totalSpent = Number(initialBalance.value) - Number(finalBalance.value);

    console.log("\n" + "=".repeat(80));
    console.log("📊 汇总");
    console.log("=".repeat(80));

    console.log("\n### Schema v2 地址\n");
    console.log("| Schema | 地址 | Layout |");
    console.log("|--------|------|--------|");
    for (const r of results) {
        const schema = SCHEMAS_V2.find((s) => s.name === r.name);
        const layoutStr = schema?.fieldNames.map((f) => `${f}: String`).join(", ");
        console.log(`| ${r.name} | \`${r.schemaAddress}\` | \`{${layoutStr}}\` |`);
    }

    console.log("\n### Attestation v2 地址\n");
    console.log("| 标签 | 数据 | Attestation 地址 |");
    console.log("|------|------|-----------------|");
    for (const r of results) {
        if (r.attestationAddress) {
            console.log(`| ${r.name} | \`${JSON.stringify(r.data)}\` | \`${r.attestationAddress}\` |`);
        }
    }

    console.log(`\n💰 总花费: ${totalSpent.toLocaleString()} lamports (${(totalSpent / 1e9).toFixed(6)} SOL)`);
    console.log(`💰 最终余额: ${(Number(finalBalance.value) / 1e9).toFixed(4)} SOL`);

    // 保存结果
    const outputPath = "scripts/svm/attestation/remaining-v2-results.json";
    fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
    console.log(`\n📄 结果已保存到: ${outputPath}`);
}

main().catch(console.error);
