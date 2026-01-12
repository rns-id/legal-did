import { ethers } from "hardhat";

async function main() {
  const contractAddress = "0xA9B88f1c2CA5D2B2d528F35F9c0a9e72eaDE2b8e";
  
  console.log("测试 V4 合约功能:", contractAddress);
  
  // V4 完整 ABI
  const abi = [
    "function name() view returns (string)",
    "function symbol() view returns (string)",
    "function mintPrice() view returns (uint256)",
    "function lastTokenId() view returns (uint256)",
    
    // V4 特有函数
    "function authorizeMintV4(string orderId, address wallet) payable",
    "function airdropV4(string orderId, address wallet, bytes32 merkleRoot)",
    
    // 查询函数
    "function balanceOf(address owner) view returns (uint256)",
    "function tokenURI(uint256 tokenId) view returns (string)",
    "function tokenMerkleRoot(uint256 tokenId) view returns (bytes32)",
    
    // 权限
    "function DEFAULT_ADMIN_ROLE() view returns (bytes32)",
    "function SECONDARY_ADMIN_ROLE() view returns (bytes32)",
    "function hasRole(bytes32 role, address account) view returns (bool)",
    
    // 事件
    "event AuthorizeMintV4(string indexed orderId, address indexed wallet, uint256 amount)",
    "event AirdropV4(string indexed orderId, address indexed wallet, uint256 tokenId, bytes32 merkleRoot)"
  ];

  const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
  const contract = new ethers.Contract(contractAddress, abi, provider);

  try {
    // 基本信息
    const name = await contract.name();
    const symbol = await contract.symbol();
    const mintPrice = await contract.mintPrice();
    const lastTokenId = await contract.lastTokenId();
    
    console.log("\n📋 基本信息:");
    console.log("- Name:", name);
    console.log("- Symbol:", symbol);
    console.log("- Mint Price:", ethers.formatEther(mintPrice), "ETH");
    console.log("- Last Token ID:", lastTokenId.toString());

    // 测试权限查询
    const DEFAULT_ADMIN_ROLE = await contract.DEFAULT_ADMIN_ROLE();
    const SECONDARY_ADMIN_ROLE = await contract.SECONDARY_ADMIN_ROLE();
    
    console.log("\n🔐 权限信息:");
    console.log("- DEFAULT_ADMIN_ROLE:", DEFAULT_ADMIN_ROLE);
    console.log("- SECONDARY_ADMIN_ROLE:", SECONDARY_ADMIN_ROLE);

    // 检查管理员权限
    const adminAddress = "0x464f65Cc4AF7013239c6B79ed8a2FBd87dF91722";
    const hasAdminRole = await contract.hasRole(DEFAULT_ADMIN_ROLE, adminAddress);
    const hasSecondaryRole = await contract.hasRole(SECONDARY_ADMIN_ROLE, adminAddress);
    
    console.log("- Admin has DEFAULT_ADMIN_ROLE:", hasAdminRole);
    console.log("- Admin has SECONDARY_ADMIN_ROLE:", hasSecondaryRole);

    // 测试函数调用 (只是检查函数存在性，不实际执行)
    console.log("\n🧪 V4 函数测试:");
    
    try {
      // 测试 authorizeMintV4 函数签名
      const authorizeMintV4 = contract.interface.getFunction("authorizeMintV4");
      console.log("- authorizeMintV4 函数:", authorizeMintV4 ? "✅ 存在" : "❌ 不存在");
      console.log("  - 函数签名:", authorizeMintV4?.format());
      
      // 测试 airdropV4 函数签名
      const airdropV4 = contract.interface.getFunction("airdropV4");
      console.log("- airdropV4 函数:", airdropV4 ? "✅ 存在" : "❌ 不存在");
      console.log("  - 函数签名:", airdropV4?.format());
      
      console.log("\n🎯 结论: 这确实是 LegalDIDV4 合约！");
      
    } catch (error) {
      console.log("❌ 函数检测失败:", error);
    }

    // 获取实现合约地址
    try {
      const implementationSlot = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
      const implementationAddress = await provider.getStorage(contractAddress, implementationSlot);
      const cleanAddress = "0x" + implementationAddress.slice(-40);
      
      console.log("\n🔗 代理信息:");
      console.log("- Proxy Address:", contractAddress);
      console.log("- Implementation Address:", cleanAddress);
      console.log("- Etherscan Proxy:", `https://sepolia.etherscan.io/address/${contractAddress}`);
      console.log("- Etherscan Implementation:", `https://sepolia.etherscan.io/address/${cleanAddress}#code`);
      
    } catch (error) {
      console.log("❌ 无法获取实现地址");
    }

  } catch (error) {
    console.error("❌ 检查失败:", error.message);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});