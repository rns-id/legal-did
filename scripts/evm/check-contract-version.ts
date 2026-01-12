import { ethers } from "hardhat";

async function main() {
  const contractAddress = "0xA9B88f1c2CA5D2B2d528F35F9c0a9e72eaDE2b8e";
  
  console.log("检查合约版本:", contractAddress);
  
  // 通用 ABI，包含所有版本的函数
  const abi = [
    "function name() view returns (string)",
    "function symbol() view returns (string)",
    "function mintPrice() view returns (uint256)",
    "function lastTokenId() view returns (uint256)",
    
    // V4 特有函数
    "function authorizeMintV4(string, address) payable",
    "function airdropV4(string, address, bytes32)",
    
    // V3 特有函数  
    "function authorizeMintV3(string, address, string) payable",
    "function airdropV3(string, address, bytes32)",
    
    // 通用函数
    "function authorizeMint(string, address) payable",
    "function airdrop(string, address, bytes32)",
    
    // 权限相关
    "function DEFAULT_ADMIN_ROLE() view returns (bytes32)",
    "function SECONDARY_ADMIN_ROLE() view returns (bytes32)",
    "function hasRole(bytes32, address) view returns (bool)"
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

    // 检查 V4 特有函数
    console.log("\n🔍 版本检测:");
    
    try {
      // 尝试调用 V4 函数 (只是检查函数是否存在，不实际执行)
      const v4Interface = new ethers.Interface([
        "function authorizeMintV4(string, address) payable",
        "function airdropV4(string, address, bytes32)"
      ]);
      
      // 检查合约字节码中是否包含 V4 函数选择器
      const code = await provider.getCode(contractAddress);
      
      const authorizeMintV4Selector = v4Interface.getFunction("authorizeMintV4")?.selector;
      const airdropV4Selector = v4Interface.getFunction("airdropV4")?.selector;
      
      const hasAuthorizeMintV4 = code.includes(authorizeMintV4Selector?.slice(2) || "");
      const hasAirdropV4 = code.includes(airdropV4Selector?.slice(2) || "");
      
      console.log("- authorizeMintV4 函数:", hasAuthorizeMintV4 ? "✅ 存在" : "❌ 不存在");
      console.log("- airdropV4 函数:", hasAirdropV4 ? "✅ 存在" : "❌ 不存在");
      
      if (hasAuthorizeMintV4 && hasAirdropV4) {
        console.log("\n🎯 结论: 这是 LegalDIDV4 合约");
      } else {
        console.log("\n🎯 结论: 这不是 LegalDIDV4 合约，可能是 V1/V2/V3");
      }
      
    } catch (error) {
      console.log("❌ V4 函数检测失败");
    }

    // 检查 V3 特有函数
    try {
      const v3Interface = new ethers.Interface([
        "function authorizeMintV3(string, address, string) payable",
        "function airdropV3(string, address, bytes32)"
      ]);
      
      const code = await provider.getCode(contractAddress);
      const authorizeMintV3Selector = v3Interface.getFunction("authorizeMintV3")?.selector;
      const airdropV3Selector = v3Interface.getFunction("airdropV3")?.selector;
      
      const hasAuthorizeMintV3 = code.includes(authorizeMintV3Selector?.slice(2) || "");
      const hasAirdropV3 = code.includes(airdropV3Selector?.slice(2) || "");
      
      console.log("- authorizeMintV3 函数:", hasAuthorizeMintV3 ? "✅ 存在" : "❌ 不存在");
      console.log("- airdropV3 函数:", hasAirdropV3 ? "✅ 存在" : "❌ 不存在");
      
      if (hasAuthorizeMintV3 && hasAirdropV3) {
        console.log("\n🎯 可能结论: 这可能是 LegalDIDV3 合约");
      }
      
    } catch (error) {
      console.log("❌ V3 函数检测失败");
    }

    // 获取实现合约地址
    try {
      const implementationSlot = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
      const implementationAddress = await provider.getStorage(contractAddress, implementationSlot);
      const cleanAddress = "0x" + implementationAddress.slice(-40);
      
      console.log("\n🔗 代理信息:");
      console.log("- Proxy Address:", contractAddress);
      console.log("- Implementation Address:", cleanAddress);
      console.log("- Etherscan:", `https://sepolia.etherscan.io/address/${cleanAddress}#code`);
      
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