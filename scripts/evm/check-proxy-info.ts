import { ethers } from "hardhat";
import { EventLog } from "ethers";

// EIP-1967 storage slots
const IMPLEMENTATION_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
const ADMIN_SLOT = "0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103";

// Role hashes
const DEFAULT_ADMIN_ROLE = "0x0000000000000000000000000000000000000000000000000000000000000000";
const OPERATOR_ROLE = ethers.keccak256(ethers.toUtf8Bytes("OPERATOR_ROLE"));

async function main() {
  const PROXY_ADDRESS = "0x6e008797d8a7f3ed706d1a69f1fba713e74eb96d";
  
  console.log("=".repeat(60));
  console.log("LegalDID Proxy Contract Info (Sepolia)");
  console.log("=".repeat(60));
  console.log(`\nProxy Address: ${PROXY_ADDRESS}`);
  
  const provider = ethers.provider;
  
  // Read implementation address from EIP-1967 slot
  const implSlotValue = await provider.getStorage(PROXY_ADDRESS, IMPLEMENTATION_SLOT);
  const implementationAddress = "0x" + implSlotValue.slice(-40);
  console.log(`\nImplementation Address: ${implementationAddress}`);
  
  // Read admin address from EIP-1967 slot
  const adminSlotValue = await provider.getStorage(PROXY_ADDRESS, ADMIN_SLOT);
  const proxyAdminAddress = "0x" + adminSlotValue.slice(-40);
  console.log(`ProxyAdmin Address: ${proxyAdminAddress}`);
  
  // Get contract instance to read roles - use a minimal ABI
  const minimalABI = [
    "function hasRole(bytes32 role, address account) view returns (bool)",
    "function mintPrice() view returns (uint256)",
    "function destination() view returns (address)",
    "function lastTokenId() view returns (uint256)",
    "function baseURI() view returns (string)",
    "function owner() view returns (address)",
  ];
  
  const contract = new ethers.Contract(PROXY_ADDRESS, minimalABI, provider);
  
  console.log("\n" + "-".repeat(60));
  console.log("Role Information:");
  console.log("-".repeat(60));
  
  console.log(`\nDEFAULT_ADMIN_ROLE: ${DEFAULT_ADMIN_ROLE}`);
  console.log(`OPERATOR_ROLE: ${OPERATOR_ROLE}`);
  
  // Get mint price
  try {
    const mintPrice = await contract.mintPrice();
    console.log(`\nMint Price: ${ethers.formatEther(mintPrice)} ETH`);
  } catch (e) {
    console.log("\nCould not get mint price");
  }
  
  // Get last token ID
  try {
    const lastTokenId = await contract.lastTokenId();
    console.log(`Last Token ID: ${lastTokenId}`);
  } catch (e) {
    console.log("Could not get last token ID");
  }
  
  // Get destination address
  try {
    const destination = await contract.destination();
    console.log(`Destination (收款地址): ${destination}`);
  } catch (e) {
    console.log("Could not get destination");
  }
  
  // Get ProxyAdmin owner
  const proxyAdminABI = [
    "function owner() view returns (address)",
  ];
  const proxyAdminContract = new ethers.Contract(proxyAdminAddress, proxyAdminABI, provider);
  
  let proxyAdminOwner = "";
  try {
    proxyAdminOwner = await proxyAdminContract.owner();
    console.log(`\nProxyAdmin Owner (可升级合约的人): ${proxyAdminOwner}`);
  } catch (e) {
    console.log("\nCould not get ProxyAdmin owner");
  }
  
  // Check roles for known addresses
  const roleCheckABI = [
    "function hasRole(bytes32 role, address account) view returns (bool)",
    "function getRoleMemberCount(bytes32 role) view returns (uint256)",
    "function getRoleMember(bytes32 role, uint256 index) view returns (address)",
  ];
  const roleContract = new ethers.Contract(PROXY_ADDRESS, roleCheckABI, provider);
  
  console.log("\n" + "-".repeat(60));
  console.log("Role Members (角色成员):");
  console.log("-".repeat(60));
  
  // Get all DEFAULT_ADMIN_ROLE members
  try {
    const adminCount = await roleContract.getRoleMemberCount(DEFAULT_ADMIN_ROLE);
    console.log(`\nDEFAULT_ADMIN_ROLE 成员数量: ${adminCount}`);
    for (let i = 0; i < Number(adminCount); i++) {
      const member = await roleContract.getRoleMember(DEFAULT_ADMIN_ROLE, i);
      console.log(`  Admin ${i}: ${member}`);
    }
  } catch (e) {
    console.log("合约不支持角色枚举，通过事件日志查询 DEFAULT_ADMIN_ROLE...");
    
    const roleGrantedABI = [
      "event RoleGranted(bytes32 indexed role, address indexed account, address indexed sender)",
      "event RoleRevoked(bytes32 indexed role, address indexed account, address indexed sender)",
    ];
    const eventContract = new ethers.Contract(PROXY_ADDRESS, roleGrantedABI, provider);
    
    try {
      const grantedFilter = eventContract.filters.RoleGranted(DEFAULT_ADMIN_ROLE);
      const grantedEvents = await eventContract.queryFilter(grantedFilter, 0, "latest");
      
      const revokedFilter = eventContract.filters.RoleRevoked(DEFAULT_ADMIN_ROLE);
      const revokedEvents = await eventContract.queryFilter(revokedFilter, 0, "latest");
      
      const admins = new Set<string>();
      
      console.log("\nDEFAULT_ADMIN_ROLE 事件历史:");
      for (const event of grantedEvents) {
        if (event instanceof EventLog && event.args) {
          admins.add(event.args.account);
          console.log(`  [Granted] ${event.args.account} by ${event.args.sender}`);
        }
      }
      
      for (const event of revokedEvents) {
        if (event instanceof EventLog && event.args) {
          admins.delete(event.args.account);
          console.log(`  [Revoked] ${event.args.account} by ${event.args.sender}`);
        }
      }
      
      console.log(`\n当前 DEFAULT_ADMIN_ROLE 持有者:`);
      if (admins.size === 0) {
        console.log("  (无事件记录，可能是初始化时设置)");
      } else {
        admins.forEach(admin => console.log(`  - ${admin}`));
      }
    } catch (eventError) {
      console.log("无法查询事件日志");
    }
  }
  
  // Get all OPERATOR_ROLE members
  try {
    const operatorCount = await roleContract.getRoleMemberCount(OPERATOR_ROLE);
    console.log(`\nOPERATOR_ROLE 成员数量: ${operatorCount}`);
    for (let i = 0; i < Number(operatorCount); i++) {
      const member = await roleContract.getRoleMember(OPERATOR_ROLE, i);
      console.log(`  Operator ${i}: ${member}`);
    }
  } catch (e) {
    console.log("合约不支持角色枚举，通过事件日志查询...");
    
    // Query RoleGranted events for OPERATOR_ROLE
    const roleGrantedABI = [
      "event RoleGranted(bytes32 indexed role, address indexed account, address indexed sender)",
      "event RoleRevoked(bytes32 indexed role, address indexed account, address indexed sender)",
    ];
    const eventContract = new ethers.Contract(PROXY_ADDRESS, roleGrantedABI, provider);
    
    try {
      // Get all RoleGranted events for OPERATOR_ROLE
      const grantedFilter = eventContract.filters.RoleGranted(OPERATOR_ROLE);
      const grantedEvents = await eventContract.queryFilter(grantedFilter, 0, "latest");
      
      // Get all RoleRevoked events for OPERATOR_ROLE
      const revokedFilter = eventContract.filters.RoleRevoked(OPERATOR_ROLE);
      const revokedEvents = await eventContract.queryFilter(revokedFilter, 0, "latest");
      
      // Build a set of current operators
      const operators = new Set<string>();
      
      for (const event of grantedEvents) {
        if (event instanceof EventLog && event.args) {
          operators.add(event.args.account);
          console.log(`  [Granted] ${event.args.account} by ${event.args.sender}`);
        }
      }
      
      for (const event of revokedEvents) {
        if (event instanceof EventLog && event.args) {
          operators.delete(event.args.account);
          console.log(`  [Revoked] ${event.args.account} by ${event.args.sender}`);
        }
      }
      
      console.log(`\n当前 OPERATOR_ROLE 持有者:`);
      if (operators.size === 0) {
        console.log("  (无)");
      } else {
        operators.forEach(op => console.log(`  - ${op}`));
      }
    } catch (eventError) {
      console.log("无法查询事件日志");
    }
  }
  
  // Also check specific addresses for both roles
  console.log("\n" + "-".repeat(60));
  console.log("Role Check for Known Addresses:");
  console.log("-".repeat(60));
  
  const addressesToCheck = [
    "0x464f65Cc4AF7013239c6B79ed8a2FBd87dF91722", // ProxyAdmin owner
  ];
  
  for (const addr of addressesToCheck) {
    try {
      const hasAdminRole = await roleContract.hasRole(DEFAULT_ADMIN_ROLE, addr);
      const hasOperatorRole = await roleContract.hasRole(OPERATOR_ROLE, addr);
      console.log(`\n${addr}:`);
      console.log(`  DEFAULT_ADMIN_ROLE: ${hasAdminRole}`);
      console.log(`  OPERATOR_ROLE: ${hasOperatorRole}`);
    } catch (e) {
      console.log(`Could not check roles for ${addr}`);
    }
  }
  
  console.log("\n" + "=".repeat(60));
  console.log("Summary (总结):");
  console.log("=".repeat(60));
  console.log(`
┌─────────────────────────────────────────────────────────────────────────────┐
│ 合约地址信息                                                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│ Proxy 代理合约:        ${PROXY_ADDRESS}  │
│ Implementation 实现:   ${implementationAddress}  │
│ ProxyAdmin 管理合约:   ${proxyAdminAddress}  │
├─────────────────────────────────────────────────────────────────────────────┤
│ 权限信息                                                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│ ProxyAdmin Owner:      ${proxyAdminOwner}  │
│ (此地址可以升级合约)                                                           │
└─────────────────────────────────────────────────────────────────────────────┘
`);
  
  console.log("Etherscan Links:");
  console.log(`Proxy: https://sepolia.etherscan.io/address/${PROXY_ADDRESS}`);
  console.log(`Implementation: https://sepolia.etherscan.io/address/${implementationAddress}`);
  console.log(`ProxyAdmin: https://sepolia.etherscan.io/address/${proxyAdminAddress}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
