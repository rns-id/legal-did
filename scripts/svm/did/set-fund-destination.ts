#!/usr/bin/env ts-node
/**
 * Legal DID - 设置资金接收地址 (set_fund_destination)
 * 
 * 用法: npx ts-node scripts/svm/did/set-fund-destination.ts <network> <destination_address>
 * 示例: npx ts-node scripts/svm/did/set-fund-destination.ts devnet BossWa11etAddressXXXXXXXXXXXXXXXXXXXXXXXXXXXX
 */

import { 
    Connection, 
    PublicKey, 
    Keypair
} from '@solana/web3.js';
import { Program, AnchorProvider, Wallet } from '@coral-xyz/anchor';
import { Legaldid } from '../../../target/types/legaldid';
import * as bs58 from 'bs58';
import * as dotenv from 'dotenv';
import { getNetworkConfig, getExplorerLink } from '../../config';

dotenv.config();

async function setFundDestination(network: string, destinationAddress: string): Promise<void> {
    console.log("=".repeat(60));
    console.log("🏦 Legal DID - 设置资金接收地址");
    console.log("=".repeat(60));
    console.log("");
    console.log(`📡 网络: ${network.toUpperCase()}`);
    console.log(`🎯 新接收地址: ${destinationAddress}`);
    console.log("");

    // 获取网络配置
    const config = getNetworkConfig(network);

    // 获取 Authority 钱包
    const authorityPrivateKey = process.env.SOLANA_PRIVATE_KEY;
    if (!authorityPrivateKey) {
        throw new Error("SOLANA_PRIVATE_KEY 环境变量未设置");
    }

    const authority = Keypair.fromSecretKey(bs58.decode(authorityPrivateKey));
    console.log(`🔑 Authority: ${authority.publicKey.toString()}`);

    // 验证目标地址
    let destination: PublicKey;
    try {
        destination = new PublicKey(destinationAddress);
    } catch (error) {
        throw new Error(`无效的地址格式: ${destinationAddress}`);
    }

    // 连接到网络
    const connection = new Connection(config.rpcUrl, "confirmed");
    const wallet = new Wallet(authority);
    const provider = new AnchorProvider(connection, wallet, {
        commitment: "confirmed"
    });

    // 加载程序
    const programId = new PublicKey(config.programId);
    const idl = await Program.fetchIdl(programId, provider);
    
    let program: Program<Legaldid>;
    if (!idl) {
        const localIdl = require('../../../target/idl/legaldid.json');
        program = new Program(localIdl as Legaldid, provider);
    } else {
        program = new Program(idl as Legaldid, provider);
    }

    // 计算项目 PDA
    const [projectPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("nt-proj-v5")],
        programId
    );

    console.log(`📍 项目 PDA: ${projectPDA.toString()}`);
    console.log(`🏗️  程序 ID: ${programId.toString()}`);
    console.log("");

    // 查询当前项目信息
    console.log("🔍 查询当前项目信息...");
    const projectAccount = await (program.account as any).projectAccount.fetch(projectPDA);
    
    const currentDestination = projectAccount.destination.toString();
    console.log(`📊 当前接收地址: ${currentDestination}`);
    console.log(`📊 新接收地址: ${destination.toString()}`);
    
    if (currentDestination === destination.toString()) {
        console.log("");
        console.log("⚠️  新地址与当前地址相同，无需更新");
        return;
    }

    // 验证当前用户是 Authority
    if (projectAccount.authority.toString() !== authority.publicKey.toString()) {
        throw new Error(
            `权限验证失败！\n` +
            `  当前钱包: ${authority.publicKey.toString()}\n` +
            `  项目 Authority: ${projectAccount.authority.toString()}\n` +
            `  你不是当前的 Authority，无法修改资金接收地址。`
        );
    }

    console.log("");
    console.log("📤 发送 set_fund_destination 交易...");

    // 执行设置
    const tx = await program.methods
        .setFundDestination(destination)
        .accounts({
            authority: authority.publicKey,
            nonTransferableProject: projectPDA,
        })
        .rpc();

    console.log("✅ 交易成功！");
    console.log(`📋 交易哈希: ${tx}`);
    console.log("");

    // 等待确认
    console.log("⏳ 等待交易确认...");
    await connection.confirmTransaction(tx, "confirmed");
    console.log("✅ 交易已确认");
    console.log("");

    // 验证更新
    const updatedProject = await (program.account as any).projectAccount.fetch(projectPDA);
    console.log("🔍 验证更新:");
    console.log(`  旧地址: ${currentDestination}`);
    console.log(`  新地址: ${updatedProject.destination.toString()}`);
    
    if (updatedProject.destination.toString() === destination.toString()) {
        console.log("  ✅ 更新成功");
    } else {
        console.log("  ⚠️  更新可能失败");
    }

    console.log("");
    console.log("🔗 浏览器链接:");
    console.log(`  交易: ${getExplorerLink(tx, network, 'tx')}`);
    console.log(`  项目: ${getExplorerLink(projectPDA.toString(), network)}`);
    console.log(`  新接收地址: ${getExplorerLink(destination.toString(), network)}`);
    console.log("");

    console.log("=".repeat(60));
    console.log("🎉 资金接收地址设置完成！");
    console.log("=".repeat(60));
    console.log("");
    console.log("💡 说明:");
    console.log("  用户通过 authorize_mint 支付的 SOL 将转入此地址");
    console.log("  Authority 可以随时修改此地址");
}

async function main(): Promise<void> {
    const network = process.argv[2];
    const destinationAddress = process.argv[3];

    if (!network || !destinationAddress) {
        console.error("❌ 缺少参数");
        console.log("");
        console.log("用法: npx ts-node scripts/svm/did/set-fund-destination.ts <network> <destination_address>");
        console.log("");
        console.log("示例:");
        console.log("  npx ts-node scripts/svm/did/set-fund-destination.ts devnet BossWa11etAddress...");
        console.log("  npx ts-node scripts/svm/did/set-fund-destination.ts mainnet BossWa11etAddress...");
        console.log("");
        console.log("支持的网络: devnet, mainnet");
        process.exit(1);
    }

    if (!['devnet', 'mainnet', 'localnet'].includes(network)) {
        console.error(`❌ 不支持的网络: ${network}`);
        console.log("支持的网络: devnet, mainnet, localnet");
        process.exit(1);
    }

    try {
        await setFundDestination(network, destinationAddress);
    } catch (error) {
        console.error("❌ 设置失败:", error instanceof Error ? error.message : String(error));
        process.exit(1);
    }
}

if (require.main === module) {
    main().catch((error) => {
        console.error('Script failed:', error);
        process.exit(1);
    });
}
