import { Connection, PublicKey } from '@solana/web3.js';

/**
 * 检查指定地址的基本信息
 */

const MAINNET_RPC_URL = 'https://api.mainnet-beta.solana.com';

async function checkAddressInfo(address: string) {
  try {
    const connection = new Connection(MAINNET_RPC_URL, 'confirmed');
    const pubkey = new PublicKey(address);
    
    console.log(`检查地址: ${address}`);
    console.log(`地址是否有效: ${PublicKey.isOnCurve(pubkey.toBytes())}`);
    
    // 获取账户信息
    const accountInfo = await connection.getAccountInfo(pubkey);
    
    if (!accountInfo) {
      console.log('❌ 该地址在主网上不存在或没有余额');
      return;
    }
    
    console.log('✅ 地址信息:');
    console.log(`   余额: ${accountInfo.lamports / 1e9} SOL`);
    console.log(`   所有者: ${accountInfo.owner.toBase58()}`);
    console.log(`   数据长度: ${accountInfo.data.length} 字节`);
    console.log(`   可执行: ${accountInfo.executable}`);
    console.log(`   租金周期: ${accountInfo.rentEpoch}`);
    
    // 检查是否是程序账户
    if (accountInfo.executable) {
      console.log('🔧 这是一个可执行程序账户');
    }
    
    // 检查是否是系统程序拥有的账户
    const systemProgram = new PublicKey('11111111111111111111111111111112');
    if (accountInfo.owner.equals(systemProgram)) {
      console.log('💰 这是一个普通的钱包地址（系统程序拥有）');
    }
    
    // 获取交易历史
    try {
      const signatures = await connection.getSignaturesForAddress(pubkey, { limit: 5 });
      console.log(`\n📜 最近的交易记录 (${signatures.length} 条):`);
      signatures.forEach((sig, index) => {
        console.log(`   ${index + 1}. ${sig.signature} (${new Date(sig.blockTime! * 1000).toLocaleString()})`);
      });
    } catch (e) {
      console.log('⚠️  无法获取交易历史');
    }
    
  } catch (error) {
    console.error('查询失败:', error);
  }
}

// 检查指定地址
const targetAddress = '2fuikT5C2YVctakxoBNQ23NjXzA4kY2cn36Sh6ws3pAt';
checkAddressInfo(targetAddress);