import { Connection, PublicKey } from '@solana/web3.js';

/**
 * 查询指定地址在 Solana 主网上作为 upgrade authority 部署的程序数量
 * 
 * 由于直接查询 BPF Upgradeable Loader 的所有账户会超出限制，
 * 我们使用 Helius 或其他高性能 RPC 端点
 */

// 使用 Helius 的免费 RPC 端点，支持更大的查询
const MAINNET_RPC_URL = 'https://rpc.helius.xyz/?api-key=demo';
const BPF_UPGRADEABLE_LOADER_ID = new PublicKey('BPFLoaderUpgradeab1e11111111111111111111111');

async function queryDeployedPrograms(upgradeAuthorityAddress: string) {
  try {
    const connection = new Connection(MAINNET_RPC_URL, 'confirmed');
    const upgradeAuthority = new PublicKey(upgradeAuthorityAddress);
    
    console.log(`查询地址 ${upgradeAuthorityAddress} 部署的程序...`);
    
    // 首先检查地址是否存在
    try {
      const accountInfo = await connection.getAccountInfo(upgradeAuthority);
      if (!accountInfo) {
        console.log(`⚠️  地址 ${upgradeAuthorityAddress} 在主网上不存在或没有余额`);
      } else {
        console.log(`✅ 地址存在，余额: ${accountInfo.lamports / 1e9} SOL`);
        console.log(`   所有者: ${accountInfo.owner.toBase58()}`);
      }
    } catch (e) {
      console.log(`⚠️  无法获取地址信息: ${e}`);
    }
    
    console.log('\n正在查询程序账户...');
    
    // 使用过滤器只查询程序账户类型
    const programAccounts = await connection.getProgramAccounts(
      BPF_UPGRADEABLE_LOADER_ID,
      {
        commitment: 'confirmed',
        filters: [
          {
            memcmp: {
              offset: 0,
              bytes: 'AwAAAA==', // Base64 编码的 [3, 0, 0, 0] (程序账户类型)
            },
          },
        ],
        dataSlice: {
          offset: 0,
          length: 100, // 只获取前100字节
        }
      }
    );

    console.log(`找到 ${programAccounts.length} 个程序账户`);
    
    let matchingPrograms = 0;
    const matchingProgramsList: string[] = [];
    
    for (const account of programAccounts) {
      try {
        const data = account.account.data as Buffer;
        
        // 检查是否有upgrade authority (offset 37)
        if (data.length > 37 && data[37] === 1) {
          // 提取upgrade authority (offset 38-69)
          if (data.length >= 70) {
            const authorityBytes = data.slice(38, 70);
            const authority = new PublicKey(authorityBytes);
            
            if (authority.equals(upgradeAuthority)) {
              matchingPrograms++;
              matchingProgramsList.push(account.pubkey.toBase58());
            }
          }
        }
      } catch (e) {
        // 忽略解析错误的账户
        continue;
      }
    }

    console.log(`\n找到 ${matchingPrograms} 个由地址 ${upgradeAuthorityAddress} 部署的程序：\n`);
    
    matchingProgramsList.forEach((programId, index) => {
      console.log(`${index + 1}. 程序地址: ${programId}`);
    });

    return matchingPrograms;
    
  } catch (error) {
    console.error('查询失败:', error);
    
    // 如果 RPC 查询失败，提供替代方案
    console.log('\n💡 替代查询方案：');
    console.log('1. 使用 Solscan API: https://api.solscan.io/');
    console.log('2. 使用 Helius API: https://docs.helius.dev/');
    console.log('3. 使用 Solana CLI: solana program show <program-id>');
    console.log(`4. 在浏览器中查看: https://solscan.io/account/${upgradeAuthorityAddress}`);
    
    return 0;
  }
}

// 查询指定地址
const targetAddress = '2fuikT5C2YVctakxoBNQ23NjXzA4kY2cn36Sh6ws3pAt';

queryDeployedPrograms(targetAddress)
  .then(count => {
    console.log(`\n总计：地址 ${targetAddress} 在主网上部署了 ${count} 个程序`);
  })
  .catch(console.error);