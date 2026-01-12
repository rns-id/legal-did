const https = require('https');

const PROXY_ADDRESS = "0xb365e53b64655476e3c3b7a3e225d8bf2e95f71d";
const API_KEY = "VC46C38S72HIT9AHSYJT4BXD2FZ4HIUI3F";

// RoleGranted 事件签名
const ROLE_GRANTED_TOPIC = "0x2f8788117e7eff1d82e926ec794901d17c78024a50270940304540a733656f0d";
const ROLE_REVOKED_TOPIC = "0xf6391f5c32d9c69d2a47ea670b442974b53935d1edc7fd64eb21e047a839171b";

// 角色常量
const DEFAULT_ADMIN_ROLE = "0x0000000000000000000000000000000000000000000000000000000000000000";
const SECONDARY_ADMIN_ROLE = "0xb1d1e34523ad878924973c8df66f437adf68e51db0e13ecb3dc261c3c08479e3";

function fetch(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
}

async function main() {
  console.log("=== 通过 Etherscan 扫描角色事件 ===");
  console.log("合约地址:", PROXY_ADDRESS);
  console.log("");

  // 查询 RoleGranted 事件
  const grantedUrl = `https://api.etherscan.io/api?module=logs&action=getLogs&address=${PROXY_ADDRESS}&topic0=${ROLE_GRANTED_TOPIC}&fromBlock=0&toBlock=latest&apikey=${API_KEY}`;
  
  const grantedResult = await fetch(grantedUrl);
  
  if (grantedResult.status !== "1") {
    console.log("查询失败:", grantedResult.message);
    console.log("提示: 免费 API 有速率限制，可能需要等待或使用 API key");
    return;
  }

  const roleNames = {
    [DEFAULT_ADMIN_ROLE]: "DEFAULT_ADMIN_ROLE (Owner)",
    [SECONDARY_ADMIN_ROLE]: "SECONDARY_ADMIN_ROLE (Developer)",
  };

  console.log(`找到 ${grantedResult.result.length} 个 RoleGranted 事件\n`);

  // 解析事件
  const currentRoles = {}; // address -> Set of roles

  for (const log of grantedResult.result) {
    const role = log.topics[1];
    const account = "0x" + log.topics[2].slice(26);
    const sender = "0x" + log.topics[3].slice(26);
    const blockNumber = parseInt(log.blockNumber, 16);

    const roleName = roleNames[role] || role;
    
    console.log(`授权: ${roleName}`);
    console.log(`  账户: ${account}`);
    console.log(`  操作者: ${sender}`);
    console.log(`  区块: ${blockNumber}`);
    console.log("");

    if (!currentRoles[account]) currentRoles[account] = new Set();
    currentRoles[account].add(role);
  }

  // 查询 RoleRevoked 事件
  const revokedUrl = `https://api.etherscan.io/api?module=logs&action=getLogs&address=${PROXY_ADDRESS}&topic0=${ROLE_REVOKED_TOPIC}&fromBlock=0&toBlock=latest&apikey=${API_KEY}`;
  
  const revokedResult = await fetch(revokedUrl);
  
  if (revokedResult.status === "1" && revokedResult.result.length > 0) {
    console.log(`\n找到 ${revokedResult.result.length} 个 RoleRevoked 事件\n`);
    
    for (const log of revokedResult.result) {
      const role = log.topics[1];
      const account = "0x" + log.topics[2].slice(26);
      const sender = "0x" + log.topics[3].slice(26);
      const blockNumber = parseInt(log.blockNumber, 16);

      const roleName = roleNames[role] || role;
      
      console.log(`撤销: ${roleName}`);
      console.log(`  账户: ${account}`);
      console.log(`  操作者: ${sender}`);
      console.log(`  区块: ${blockNumber}`);
      console.log("");

      if (currentRoles[account]) {
        currentRoles[account].delete(role);
      }
    }
  } else {
    console.log("\n没有 RoleRevoked 事件");
  }

  // 汇总
  console.log("\n=== 当前角色持有者汇总 ===");
  for (const [account, roles] of Object.entries(currentRoles)) {
    if (roles.size > 0) {
      console.log(`${account}:`);
      for (const role of roles) {
        console.log(`  ✅ ${roleNames[role] || role}`);
      }
    }
  }
}

main().catch(console.error);
