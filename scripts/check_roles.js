const { ethers } = require("ethers");

const PROXY_ADDRESS = "0xb365e53b64655476e3c3b7a3e225d8bf2e95f71d";
const RPC_URL = "https://eth.llamarpc.com";

// EIP-1967 storage slots
const ADMIN_SLOT = "0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103";
const IMPLEMENTATION_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";

// AccessControl ABI (只需要查询角色的方法)
const ABI = [
  "function DEFAULT_ADMIN_ROLE() view returns (bytes32)",
  "function SECONDARY_ADMIN_ROLE() view returns (bytes32)",
  "function hasRole(bytes32 role, address account) view returns (bool)",
  "function getRoleAdmin(bytes32 role) view returns (bytes32)",
  "function destination() view returns (address)",
  "function mintPrice() view returns (uint256)",
  "function baseURI() view returns (string)",
];

// 已知可能的地址
const KNOWN_ADDRESSES = [
  "0xfA61b6E35613f014Bd4387898790E89572f63B57", // Owner 钱包
  "0xff702678e77f3622ed84ce1b2d4400af5182d2ee", // 之前提到的代理地址
  "0xd4705318503d49faf3643878764c62095cb6599a", // 刚才查的地址
];

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const contract = new ethers.Contract(PROXY_ADDRESS, ABI, provider);

  console.log("=== 合约角色查询 ===");
  console.log("代理合约地址:", PROXY_ADDRESS);
  console.log("");

  // 获取角色 bytes32
  const DEFAULT_ADMIN_ROLE = "0x0000000000000000000000000000000000000000000000000000000000000000";
  const SECONDARY_ADMIN_ROLE = ethers.keccak256(ethers.toUtf8Bytes("SECONDARY_ADMIN_ROLE"));
  
  console.log("DEFAULT_ADMIN_ROLE:", DEFAULT_ADMIN_ROLE);
  console.log("SECONDARY_ADMIN_ROLE:", SECONDARY_ADMIN_ROLE);
  console.log("");

  // 查询已知地址的角色
  console.log("=== 检查已知地址的角色 ===");
  for (const addr of KNOWN_ADDRESSES) {
    const isAdmin = await contract.hasRole(DEFAULT_ADMIN_ROLE, addr);
    const isOperator = await contract.hasRole(SECONDARY_ADMIN_ROLE, addr);
    console.log(`${addr}:`);
    console.log(`  - DEFAULT_ADMIN_ROLE (Owner): ${isAdmin}`);
    console.log(`  - SECONDARY_ADMIN_ROLE (Developer): ${isOperator}`);
  }

  // 查询其他合约状态
  console.log("");
  console.log("=== 合约状态 ===");
  try {
    const destination = await contract.destination();
    console.log("destination (收款地址):", destination);
  } catch (e) {
    console.log("destination: 查询失败");
  }
  
  try {
    const mintPrice = await contract.mintPrice();
    console.log("mintPrice:", ethers.formatEther(mintPrice), "ETH");
  } catch (e) {
    console.log("mintPrice: 查询失败");
  }
}

main().catch(console.error);

// 查询 ProxyAdmin
async function checkProxyAdmin() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  
  console.log("");
  console.log("=== Proxy 信息 (董事会层) ===");
  
  // 读取 ProxyAdmin 地址 (EIP-1967)
  const adminSlotData = await provider.getStorage(PROXY_ADDRESS, ADMIN_SLOT);
  const proxyAdmin = "0x" + adminSlotData.slice(26);
  console.log("ProxyAdmin 合约地址:", proxyAdmin);
  
  // 读取 Implementation 地址
  const implSlotData = await provider.getStorage(PROXY_ADDRESS, IMPLEMENTATION_SLOT);
  const implementation = "0x" + implSlotData.slice(26);
  console.log("Implementation 合约地址:", implementation);
  
  // 查询 ProxyAdmin 的 owner
  const proxyAdminABI = ["function owner() view returns (address)"];
  const proxyAdminContract = new ethers.Contract(proxyAdmin, proxyAdminABI, provider);
  
  try {
    const owner = await proxyAdminContract.owner();
    console.log("ProxyAdmin Owner (董事会):", owner);
  } catch (e) {
    console.log("ProxyAdmin Owner: 查询失败 -", e.message);
  }
}

checkProxyAdmin().catch(console.error);
