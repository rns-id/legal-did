import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Testing LegalDIDV4 deployment with account:", deployer.address);

  // V4 合约地址
  const proxyAddress = "0x8E8e446C0633EDdD7f83F2778249f787134053f8";
  
  // 连接到已部署的合约
  const LegalDIDV4 = await ethers.getContractFactory("LegalDIDV4");
  const contract = LegalDIDV4.attach(proxyAddress);

  console.log("\n📋 合约基本信息:");
  
  try {
    // 测试基本读取功能
    const name = await contract.name();
    const symbol = await contract.symbol();
    const mintPrice = await contract.mintPrice();
    const lastTokenId = await contract.lastTokenId();
    
    console.log("- Name:", name);
    console.log("- Symbol:", symbol);
    console.log("- Mint Price:", ethers.formatEther(mintPrice), "ETH");
    console.log("- Last Token ID:", lastTokenId.toString());
    
    // 测试权限
    const DEFAULT_ADMIN_ROLE = await contract.DEFAULT_ADMIN_ROLE();
    const SECONDARY_ADMIN_ROLE = await contract.SECONDARY_ADMIN_ROLE();
    const hasAdminRole = await contract.hasRole(DEFAULT_ADMIN_ROLE, deployer.address);
    const hasSecondaryRole = await contract.hasRole(SECONDARY_ADMIN_ROLE, deployer.address);
    
    console.log("\n🔐 权限信息:");
    console.log("- Has Admin Role:", hasAdminRole);
    console.log("- Has Secondary Admin Role:", hasSecondaryRole);
    
    console.log("\n✅ 合约部署成功，基本功能正常！");
    
  } catch (error) {
    console.error("❌ 测试失败:", error);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});