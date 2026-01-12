const { ethers } = require("ethers");

const PROXY_ADDRESS = "0xb365e53b64655476e3c3b7a3e225d8bf2e95f71d";
const RPC_URL = "https://eth-mainnet.g.alchemy.com/v2/d7CkzFLMTtJttwjFJHPYe";

// 角色常量
const DEFAULT_ADMIN_ROLE = "0x0000000000000000000000000000000000000000000000000000000000000000";
const SECONDARY_ADMIN_ROLE = "0xb1d1e34523ad878924973c8df66f437adf68e51db0e13ecb3dc261c3c08479e3";

// AccessControl 事件 ABI
const ABI = [
  "event RoleGranted(bytes32 indexed role, address indexed account, address indexed sender)",
  "event RoleRevoked(bytes32 indexed role, address indexed account, address indexed sender)",
  "function hasRole(bytes32 role, address account) view returns (bool)",
];

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const contract = new ethers.Contract(PROXY_ADDRESS, ABI, provider);

  console.log("=== 扫描角色授权事件 ===");
  console.log("合约地址:", PROXY_ADDRESS);
  console.log("");

  // 获取所有 RoleGranted 事件
  const grantedFilter = contract.filters.RoleGranted();
  const revokedFilter = contract.filters.RoleRevoked();

  console.log("正在扫描事件（从创建区块开始）...");
  
  // 分批查询，避免 RPC 限制
  const currentBlock = await provider.getBlockNumber();
  const batchSize = 100000;
  
  let grantedEvents = [];
  let revokedEvents = [];
  
  // 从 15000000 开始扫描（合约部署大约在 2022 年）
  for (let fromBlock = 15000000; fromBlock < currentBlock; fromBlock += batchSize) {
    const toBlock = Math.min(fromBlock + batchSize - 1, currentBlock);
    console.log(`扫描区块 ${fromBlock} - ${toBlock}...`);
    
    try {
      const [granted, revoked] = await Promise.all([
        contract.queryFilter(grantedFilter, fromBlock, toBlock),
        contract.queryFilter(revokedFilter, fromBlock, toBlock),
      ]);
      grantedEvents = grantedEvents.concat(granted);
      revokedEvents = revokedEvents.concat(revoked);
    } catch (e) {
      console.log(`区块 ${fromBlock}-${toBlock} 查询失败，跳过`);
    }
  }

  console.log(`找到 ${grantedEvents.length} 个 RoleGranted 事件`);
  console.log(`找到 ${revokedEvents.length} 个 RoleRevoked 事件`);
  console.log("");

  // 处理事件
  const roleNames = {
    [DEFAULT_ADMIN_ROLE]: "DEFAULT_ADMIN_ROLE (Owner)",
    [SECONDARY_ADMIN_ROLE]: "SECONDARY_ADMIN_ROLE (Developer)",
  };

  console.log("=== RoleGranted 事件 ===");
  for (const event of grantedEvents) {
    const roleName = roleNames[event.args.role] || event.args.role;
    console.log(`授权: ${roleName}`);
    console.log(`  账户: ${event.args.account}`);
    console.log(`  操作者: ${event.args.sender}`);
    console.log(`  区块: ${event.blockNumber}`);
    console.log("");
  }

  console.log("=== RoleRevoked 事件 ===");
  if (revokedEvents.length === 0) {
    console.log("没有撤销记录");
  }
  for (const event of revokedEvents) {
    const roleName = roleNames[event.args.role] || event.args.role;
    console.log(`撤销: ${roleName}`);
    console.log(`  账户: ${event.args.account}`);
    console.log(`  操作者: ${event.args.sender}`);
    console.log(`  区块: ${event.blockNumber}`);
    console.log("");
  }

  // 汇总当前状态
  console.log("=== 当前角色持有者（验证） ===");
  
  // 收集所有出现过的地址
  const allAddresses = new Set();
  for (const event of grantedEvents) {
    allAddresses.add(event.args.account);
  }

  for (const addr of allAddresses) {
    const isAdmin = await contract.hasRole(DEFAULT_ADMIN_ROLE, addr);
    const isDev = await contract.hasRole(SECONDARY_ADMIN_ROLE, addr);
    
    if (isAdmin || isDev) {
      console.log(`${addr}:`);
      if (isAdmin) console.log(`  ✅ DEFAULT_ADMIN_ROLE (Owner)`);
      if (isDev) console.log(`  ✅ SECONDARY_ADMIN_ROLE (Developer)`);
    }
  }
}

main().catch(console.error);
