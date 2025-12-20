/**
 * 测试 create_attestation 实际成本 (TypeScript 版本)
 *
 * 运行: npx ts-node scripts/svm/attestation/test-create-attestation-official.ts
 */

import {
    deriveCredentialPda,
    deriveSchemaPda,
    deriveAttestationPda,
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

// Schema 配置接口
interface SchemaConfig {
    name: string;
    data: Record<string, unknown>;
}

// 结果接口
interface AttestationResult {
    name: string;
    attestation: string;
    signature: string;
    cost: number;
    dataSize: number;
}

// Schema 配置 - 数据必须匹配 Schema 的 layout
// Layout 类型映射:
// 0: u8, 1: u16, 2: u32, 3: u64, 4: u128
// 5: i8, 6: i16, 7: i32, 8: i64, 9: i128
// 10: bool, 11: char, 12: String
// 13: Vec<u8>, 14: Vec<u16>, 15: Vec<u32>, 16: Vec<u64>
const SCHEMAS: SchemaConfig[] = [
    // jurisdiction: layout = [16] (Vec<u64>), field = "country"
    { name: "jurisdiction", data: { country: [80n, 65n, 76n, 65n, 85n] } },
    // age_verification: layout = [1, 1, 2] (u16, u16, u32)
    { name: "age_verification", data: { age_over_18: 1, age_over_21: 1, birth_year: 1990 } },
    // gender: layout = [8] (i64)
    { name: "gender", data: { gender: 77n } },
    // sanctions: layout = [1, 8] (u16, i64)
    { name: "sanctions", data: { sanctions_clear: 1, check_date: BigInt(Math.floor(Date.now() / 1000)) } },
    // validity: layout = [1, 8, 8] (u16, i64, i64)
    { name: "validity", data: { valid: 1, issued: 1732924800n, expires: 1764460800n } },
    // identity: layout = [4, 16] (u128, Vec<u64>)
    { name: "identity", data: { type: 1n, hash: [0xb8n, 0xa5n, 0x89n, 0x9bn] } },
];

async function loadWallet(): Promise<any> {
    const walletPath = process.env.HOME + "/.config/solana/id.json";
    const walletData = JSON.parse(fs.readFileSync(walletPath, "utf8"));
    const privateKeyBytes = new Uint8Array(walletData.slice(0, 32));
    return createKeyPairSignerFromPrivateKeyBytes(privateKeyBytes);
}

async function getBalance(rpc: any, address: any): Promise<number> {
    const result = await rpc.getBalance(address).send();
    return Number(result.value);
}

async function main(): Promise<void> {
    console.log("\n" + "=".repeat(80));
    console.log("🚀 测试 create_attestation 实际成本 (TypeScript)");
    console.log("=".repeat(80));

    const rpc = createSolanaRpc("https://api.devnet.solana.com");
    const rpcSubscriptions = createSolanaRpcSubscriptions("wss://api.devnet.solana.com");

    // 加载钱包
    const payer = await loadWallet();
    const authority = payer;

    console.log(`\n📍 钱包地址: ${payer.address}`);

    const initialBalance = await getBalance(rpc, payer.address);
    console.log(`💰 初始余额: ${(initialBalance / 1e9).toFixed(4)} SOL`);

    // 计算 Credential PDA
    const [credentialPda] = await deriveCredentialPda({
        authority: authority.address,
        name: CREDENTIAL_NAME,
    });
    console.log(`\n📜 Credential: ${credentialPda}`);

    // 测试每个 Schema 的 attestation 创建
    console.log("\n" + "=".repeat(80));
    console.log("📊 创建 Attestations");
    console.log("=".repeat(80));

    const results: AttestationResult[] = [];

    for (const schemaConfig of SCHEMAS) {
        // 计算 Schema PDA
        const [schemaPda] = await deriveSchemaPda({
            credential: credentialPda,
            name: schemaConfig.name,
            version: 1,
        });

        // 获取 Schema 数据以进行序列化
        let schemaAccount;
        try {
            schemaAccount = await fetchSchema(rpc, schemaPda);
            if (!(schemaAccount as any).exists) {
                console.log(`\n⚠️ Schema "${schemaConfig.name}" 不存在，跳过`);
                continue;
            }
        } catch (e) {
            const error = e as Error;
            console.log(`\n⚠️ 无法获取 Schema "${schemaConfig.name}": ${error.message}`);
            continue;
        }

        // 生成随机 nonce 作为 attestation 的唯一标识
        const nonceSigner = await generateKeyPairSigner();
        const nonce = nonceSigner.address;

        // 计算 Attestation PDA
        const [attestationPda] = await deriveAttestationPda({
            credential: credentialPda,
            schema: schemaPda,
            nonce: nonce,
        });

        console.log(`\n🔨 创建 Attestation: ${schemaConfig.name}`);
        console.log(`   Schema: ${schemaPda}`);
        console.log(`   Nonce: ${nonce}`);
        console.log(`   Attestation: ${attestationPda}`);

        const balanceBefore = await getBalance(rpc, payer.address);

        // 使用 SAS 库序列化数据
        let dataBuffer: Uint8Array;
        try {
            dataBuffer = serializeAttestationData(schemaAccount.data, schemaConfig.data);
            console.log(`   📦 序列化数据: ${dataBuffer.length} bytes`);
            console.log(`   📦 数据 (hex): ${Buffer.from(dataBuffer).toString("hex")}`);
        } catch (e) {
            const error = e as Error;
            console.log(`   ❌ 序列化失败: ${error.message}`);
            // 尝试使用原始 JSON (处理 BigInt)
            const jsonStr = JSON.stringify(schemaConfig.data, (_, value) =>
                typeof value === "bigint" ? value.toString() : value
            );
            dataBuffer = new TextEncoder().encode(jsonStr);
            console.log(`   ⚠️ 使用 JSON 回退: ${dataBuffer.length} bytes`);
        }

        // 设置过期时间为 1 年后
        const oneYearFromNow = BigInt(Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60);

        const attestationInput = {
            payer: payer,
            authority: authority,
            credential: credentialPda,
            schema: schemaPda,
            attestation: attestationPda,
            nonce: nonce,
            data: dataBuffer,
            expiry: oneYearFromNow,
        };

        console.log(`   ⏰ 过期时间: ${new Date(Number(oneYearFromNow) * 1000).toISOString()}`);

        const attestationIx = getCreateAttestationInstruction(attestationInput);

        // 打印指令详情用于调试
        console.log(`   📝 指令账户数: ${attestationIx.accounts.length}`);
        attestationIx.accounts.forEach((acc, i) => {
            console.log(`      ${i}: ${acc.address}`);
        });

        const blockhashResult = await rpc.getLatestBlockhash().send() as any;
        const latestBlockhash = blockhashResult.value;

        const txMessage = pipe(
            createTransactionMessage({ version: 0 }),
            (tx) => setTransactionMessageFeePayer(payer.address, tx),
            (tx) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
            (tx) => appendTransactionMessageInstruction(attestationIx, tx)
        );

        const signedTx = await signTransactionMessageWithSigners(txMessage);
        const sendAndConfirm = sendAndConfirmTransactionFactory({ rpc, rpcSubscriptions } as any);

        try {
            await sendAndConfirm(signedTx as any, { commitment: "confirmed", skipPreflight: true });
            const signature = getSignatureFromTransaction(signedTx as any);

            const balanceAfter = await getBalance(rpc, payer.address);
            const cost = balanceBefore - balanceAfter;

            console.log(`   ✅ 成功! TX: ${signature}`);
            console.log(`   💰 成本: ${cost.toLocaleString()} lamports (${(cost / 1e9).toFixed(6)} SOL)`);

            results.push({
                name: schemaConfig.name,
                attestation: attestationPda.toString(),
                signature: signature.toString(),
                cost,
                dataSize: dataBuffer.length,
            });
        } catch (error) {
            const err = error as Error;
            console.log(`   ❌ 失败:`, err.message || err);

            // 尝试获取更详细的错误信息
            if (err.message?.includes("custom program error")) {
                console.log(`   🔍 这可能是 SAS 程序的错误，检查:`);
                console.log(`      - Schema 是否处于活动状态`);
                console.log(`      - Authority 是否有权限创建 attestation`);
                console.log(`      - 数据格式是否正确`);
            }
        }
    }

    // 汇总
    const finalBalance = await getBalance(rpc, payer.address);
    const totalSpent = initialBalance - finalBalance;

    console.log("\n" + "=".repeat(80));
    console.log("📊 汇总");
    console.log("=".repeat(80));

    if (results.length > 0) {
        const totalCost = results.reduce((sum, r) => sum + r.cost, 0);
        const avgCost = totalCost / results.length;

        console.log(`\n✅ 成功创建 ${results.length} 个 Attestation:`);
        console.log(`\n| 标签 | 数据大小 | 成本 (lamports) | 成本 (SOL) |`);
        console.log(`|------|---------|----------------|-----------|`);
        for (const r of results) {
            console.log(
                `| ${r.name} | ${r.dataSize} bytes | ${r.cost.toLocaleString()} | ${(r.cost / 1e9).toFixed(6)} |`
            );
        }
        console.log(`| **总计** | - | ${totalCost.toLocaleString()} | ${(totalCost / 1e9).toFixed(6)} |`);
        console.log(`| **平均** | - | ${Math.round(avgCost).toLocaleString()} | ${(avgCost / 1e9).toFixed(6)} |`);

        // 保存结果
        const outputPath = "scripts/svm/attestation/attestation-costs.json";
        fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
        console.log(`\n📄 结果已保存到: ${outputPath}`);
    }

    console.log(`\n💰 总花费: ${totalSpent.toLocaleString()} lamports (${(totalSpent / 1e9).toFixed(6)} SOL)`);
    console.log(`💰 最终余额: ${(finalBalance / 1e9).toFixed(4)} SOL`);
}

main().catch(console.error);
