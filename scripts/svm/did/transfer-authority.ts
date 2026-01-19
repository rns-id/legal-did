#!/usr/bin/env ts-node
/**
 * Legal DID - 转移 Authority 权限
 * 
 * ⚠️ 警告: 此操作不可逆！
 * 转移后，当前 Authority 将失去所有管理权限。
 * 
 * 用法: npx ts-node scripts/svm/did/transfer-authority.ts <network> <new_authority_address>
 * 示例: npx ts-node scripts/svm/did/transfer-authority.ts devnet BossWa11etAddressXXXXXXXXXXXXXXXXXXXXXXXXXXXX
 */

import { 
    Connection, 
    PublicKey, 
    Keypair,
    SystemProgram
} from '@solana/web3.js';
import { Program, AnchorProvider, Wallet } from '@coral-xyz/anchor';
import { Legaldid } from '../../target/types/legaldid';
import * as bs58 from 'bs58';
import * as dotenv from 'dotenv';
import * as readline from 'readline';

dotenv.config();

// 网络配置
interface NetworkConfig {
    rpcUrl: string;
    programId: string;
    explorerUrl: string;
}

const NETWORKS: Record<string, NetworkConfig> = {
    devnet: {
        rpcUrl: process.env.SOLANA_DEVNET_RPC_URL || "https://api.devnet.solana.com",
        programId: "BE6yuzEjzapwBEQ9RoAFzG72XZzb17JuWWqhecFHdEQa",
        explorerUrl: "https://explorer.solana.com"
    },
    mainnet: {
        rpcUrl: process.env.SOLANA_MAINNET_RPC_URL || "https://api.mainnet-beta.solana.com",
        programId: "BE6yuzEjzapwBEQ9RoAFzG72XZzb17JuWWqhecFHdEQa",
        explorerUrl: "https://explorer.solana.com"
    }
};

// 转移结果接口
interface TransferResult {
    success: boolean;
    signature?: string;
    oldAuthority: string;
    newAuthority: string;
    error?: string;
}

/**
 * 用户确认
 */
function askConfirmation(question: string): Promise<boolean> {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            rl.close();
            resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y');
        });
    });
}

/**
 * 转移 Authority 权限
 */
async function transferAuthority(
    network: string,
    newAuthorityAddress: string
): Promise<TransferResult> {
    try {
        console.log("=".repeat(60));
        console.log("🔄 Legal DID - 转移 Authority 权限");
        console.log("=".repeat(60));
        console.log("");
        console.log(`📡 网络: ${network.toUpperCase()}`);
        console.log(`🎯 新 Authority: ${newAuthorityAddress}`);
        console.log("");

        // 获取网络配置
        const config = NETWORKS[network];
        if (!config) {
            throw new Error(`不支持的网络: ${network}. 支持: ${Object.keys(NETWORKS).join(', ')}`);
        }

        // 获取当前 Authority 钱包
        const authorityPrivateKey = process.env.SOLANA_PRIVATE_KEY;
        if (!authorityPrivateKey) {
            throw new Error("SOLANA_PRIVATE_KEY 环境变量未设置");
        }

        const currentAuthority = Keypair.fromSecretKey(bs58.decode(authorityPrivateKey));
        console.log(`🔑 当前 Authority: ${currentAuthority.publicKey.toString()}`);

        // 验证新 Authority 地址
        let newAuthority: PublicKey;
        try {
            newAuthority = new PublicKey(newAuthorityAddress);
        } catch (error) {
            throw new Error(`无效的地址格式: ${newAuthorityAddress}`);
        }

        // 检查是否转移给自己
        if (newAuthority.equals(currentAuthority.publicKey)) {
            throw new Error("新 Authority 不能是当前 Authority（相同地址）");
        }

        // 连接到网络
        const connection = new Connection(config.rpcUrl, "confirmed");
        const wallet = new Wallet(currentAuthority);
        const provider = new AnchorProvider(connection, wallet, {
            commitment: "confirmed"
        });

        // 加载程序
        const programId = new PublicKey(config.programId);
        const idl = await Program.fetchIdl(programId, provider);
        
        let program: Program<Legaldid>;
        if (!idl) {
            const localIdl = require('../../target/idl/legaldid.json');
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
        const projectAccount = await program.account.projectAccount.fetch(projectPDA);
        
        console.log("✅ 项目信息:");
        console.log(`  名称: ${projectAccount.name}`);
        console.log(`  符号: ${projectAccount.symbol}`);
        console.log(`  当前 Authority: ${projectAccount.authority.toString()}`);
        console.log(`  Operators 数量: ${projectAccount.operators.length}`);
        console.log("");

        // 验证当前用户是 Authority
        if (!projectAccount.authority.equals(currentAuthority.publicKey)) {
            throw new Error(
                `权限验证失败！\n` +
                `  当前钱包: ${currentAuthority.publicKey.toString()}\n` +
                `  项目 Authority: ${projectAccount.authority.toString()}\n` +
                `  你不是当前的 Authority，无法转移权限。`
            );
        }

        // 显示警告
        console.log("⚠️  " + "=".repeat(56));
        console.log("⚠️  警告: 此操作不可逆！");
        console.log("⚠️  " + "=".repeat(56));
        console.log("");
        console.log("转移权限后:");
        console.log("  ❌ 你将失去所有 Authority 权限");
        console.log("  ❌ 无法修改铸造价格");
        console.log("  ❌ 无法添加/移除 Operator");
        console.log("  ❌ 无法更新配置");
        console.log("  ❌ 无法提取资金");
        console.log("  ❌ 无法再次转移权限");
        console.log("");
        console.log("新 Authority 将获得:");
        console.log("  ✅ 所有管理权限");
        console.log("  ✅ 可以修改所有配置");
        console.log("  ✅ 可以添加/移除 Operator");
        console.log("  ✅ 可以提取资金");
        console.log("  ✅ 可以再次转移权限");
        console.log("");

        // 显示转移信息
        console.log("📋 转移详情:");
        console.log(`  从: ${currentAuthority.publicKey.toString()}`);
        console.log(`  到: ${newAuthority.toString()}`);
        console.log(`  网络: ${network.toUpperCase()}`);
        console.log("");

        // 检查余额
        const balance = await connection.getBalance(currentAuthority.publicKey);
        const balanceSOL = balance / 1e9;
        console.log(`💰 当前余额: ${balanceSOL.toFixed(6)} SOL`);
        
        if (balance < 0.000005 * 1e9) {
            throw new Error("余额不足，无法支付交易费用");
        }
        console.log("");

        // 用户确认
        const confirmed = await askConfirmation(
            "❓ 确认转移权限？输入 'yes' 继续，其他任何输入取消: "
        );

        if (!confirmed) {
            console.log("");
            console.log("❌ 操作已取消");
            return {
                success: false,
                oldAuthority: currentAuthority.publicKey.toString(),
                newAuthority: newAuthority.toString(),
                error: "用户取消操作"
            };
        }

        console.log("");
        console.log("📤 发送转移交易...");

        // 执行转移
        const tx = await program.methods
            .transferAuthority(newAuthority)
            .accounts({
                authority: currentAuthority.publicKey,
                nonTransferableProject: projectPDA,
            })
            .rpc();

        console.log("✅ 交易已发送！");
        console.log(`📋 交易哈希: ${tx}`);
        console.log("");

        // 等待确认
        console.log("⏳ 等待交易确认...");
        await connection.confirmTransaction(tx, "confirmed");
        
        console.log("✅ 交易已确认！");
        console.log("");

        // 验证转移
        console.log("🔍 验证权限转移...");
        const updatedProject = await program.account.projectAccount.fetch(projectPDA);
        
        if (updatedProject.authority.equals(newAuthority)) {
            console.log("✅ 权限转移成功！");
            console.log("");
            console.log("📊 新的项目信息:");
            console.log(`  Authority: ${updatedProject.authority.toString()}`);
            console.log(`  ✅ 已更新为新 Authority`);
        } else {
            console.log("⚠️  警告: 权限可能未正确转移");
            console.log(`  预期: ${newAuthority.toString()}`);
            console.log(`  实际: ${updatedProject.authority.toString()}`);
        }

        console.log("");
        console.log("🔗 浏览器链接:");
        const explorerCluster = network === 'devnet' ? '?cluster=devnet' : '';
        console.log(`  交易: ${config.explorerUrl}/tx/${tx}${explorerCluster}`);
        console.log(`  项目: ${config.explorerUrl}/address/${projectPDA.toString()}${explorerCluster}`);
        console.log(`  新 Authority: ${config.explorerUrl}/address/${newAuthority.toString()}${explorerCluster}`);
        console.log("");

        // 显示后续步骤
        console.log("📝 后续步骤:");
        console.log("");
        console.log("1. 新 Authority 验证权限:");
        console.log(`   npx ts-node scripts/svm/did/query-operators.ts ${network}`);
        console.log("");
        console.log("2. 新 Authority 测试权限:");
        console.log(`   npx ts-node scripts/svm/did/set-mint-price.ts ${network} 0.001`);
        console.log("");
        console.log("3. 你（旧 Authority）清理本地私钥:");
        console.log("   rm .env");
        console.log("   rm deploy-wallet.json");
        console.log("");
        console.log("4. 如需继续提供技术支持，让新 Authority 添加你为 Operator:");
        console.log(`   npx ts-node scripts/svm/did/add-operator.ts ${network} ${currentAuthority.publicKey.toString()}`);
        console.log("");

        return {
            success: true,
            signature: tx,
            oldAuthority: currentAuthority.publicKey.toString(),
            newAuthority: newAuthority.toString()
        };

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error("");
        console.error("❌ 权限转移失败:");
        console.error(`  ${errorMessage}`);
        console.error("");

        // 故障排除
        if (errorMessage.includes("权限验证失败")) {
            console.error("🔧 解决方案:");
            console.error("  1. 确认 SOLANA_PRIVATE_KEY 是当前 Authority 的私钥");
            console.error("  2. 运行查询确认当前 Authority:");
            console.error("     npx ts-node scripts/svm/did/query-operators.ts devnet");
        } else if (errorMessage.includes("余额不足")) {
            console.error("🔧 解决方案:");
            console.error("  1. 向当前钱包转入更多 SOL");
            console.error("  2. 至少需要 0.000005 SOL 支付交易费");
        } else if (errorMessage.includes("无效的地址")) {
            console.error("🔧 解决方案:");
            console.error("  1. 检查新 Authority 地址格式是否正确");
            console.error("  2. 地址应该是 Base58 格式的 Solana 公钥");
        } else {
            console.error("🔧 通用解决方案:");
            console.error("  1. 检查网络连接");
            console.error("  2. 确认程序 ID 正确");
            console.error("  3. 验证环境变量配置");
            console.error("  4. 查看交易日志");
        }

        return {
            success: false,
            oldAuthority: '',
            newAuthority: newAuthorityAddress,
            error: errorMessage
        };
    }
}

async function main(): Promise<void> {
    const network = process.argv[2];
    const newAuthorityAddress = process.argv[3];

    // 验证参数
    if (!network || !newAuthorityAddress) {
        console.error("❌ 缺少参数");
        console.log("");
        console.log("用法: npx ts-node scripts/svm/did/transfer-authority.ts <network> <new_authority_address>");
        console.log("");
        console.log("示例:");
        console.log("  npx ts-node scripts/svm/did/transfer-authority.ts devnet BossWa11etAddressXXXXXXXXXXXXXXXXXXXXXXXXXXXX");
        console.log("  npx ts-node scripts/svm/did/transfer-authority.ts mainnet BossWa11etAddressXXXXXXXXXXXXXXXXXXXXXXXXXXXX");
        console.log("");
        console.log("支持的网络: devnet, mainnet");
        process.exit(1);
    }

    // 验证网络
    if (!['devnet', 'mainnet'].includes(network)) {
        console.error(`❌ 不支持的网络: ${network}`);
        console.log("支持的网络: devnet, mainnet");
        process.exit(1);
    }

    try {
        const result = await transferAuthority(network, newAuthorityAddress);

        if (result.success) {
            console.log("=".repeat(60));
            console.log("🎉 权限转移完成！");
            console.log("=".repeat(60));
            console.log("");
            console.log(`✅ 旧 Authority: ${result.oldAuthority}`);
            console.log(`✅ 新 Authority: ${result.newAuthority}`);
            console.log(`✅ 交易: ${result.signature}`);
            console.log("");
            console.log("⚠️  重要提醒:");
            console.log("  1. 请妥善保管新 Authority 的私钥");
            console.log("  2. 建议使用硬件钱包");
            console.log("  3. 定期备份私钥");
            console.log("  4. 不要分享私钥给任何人");
            console.log("");
        } else {
            console.log("=".repeat(60));
            console.log("❌ 权限转移失败");
            console.log("=".repeat(60));
            console.log("");
            console.log("请检查上述错误信息并重试");
            process.exit(1);
        }

    } catch (error) {
        console.error("脚本执行失败:", error instanceof Error ? error.message : String(error));
        process.exit(1);
    }
}

// 导出函数
export { transferAuthority, TransferResult };

// 如果直接运行此脚本
if (require.main === module) {
    main().catch((error) => {
        console.error('Script failed:', error);
        process.exit(1);
    });
}
