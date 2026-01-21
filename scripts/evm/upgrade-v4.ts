import { ethers, upgrades } from "hardhat";

async function main() {
  // 目标代理地址 - 需要升级的合约
  const PROXY_ADDRESS = process.env.PROXY_ADDRESS || "0x6e008797d8a7f3ed706d1a69f1fba713e74eb96d";

  const [deployer] = await ethers.getSigners();
  console.log("Upgrading with account:", deployer.address);
  console.log("Target proxy:", PROXY_ADDRESS);
  
  let currentImpl: string;
  try {
    currentImpl = await upgrades.erc1967.getImplementationAddress(PROXY_ADDRESS);
    console.log("Current implementation:", currentImpl);
  } catch (e) {
    console.log("Could not fetch current implementation (might be first check)");
  }

  const LegalDIDV4 = await ethers.getContractFactory("LegalDIDV4");
  
  // 先尝试 forceImport，如果代理未注册
  console.log("\nChecking if proxy needs to be imported...");
  try {
    // 使用 LegalDID (V1) 作为当前实现来导入
    const LegalDID = await ethers.getContractFactory("LegalDID");
    await upgrades.forceImport(PROXY_ADDRESS, LegalDID, { kind: 'transparent' });
    console.log("Proxy imported successfully");
  } catch (e: any) {
    if (e.message.includes("already registered") || e.message.includes("already imported")) {
      console.log("Proxy already registered, proceeding with upgrade");
    } else {
      console.log("Import note:", e.message);
    }
  }

  console.log("\nUpgrading to LegalDIDV4...");
  const upgraded = await upgrades.upgradeProxy(PROXY_ADDRESS, LegalDIDV4);

  await upgraded.waitForDeployment();

  const newImpl = await upgrades.erc1967.getImplementationAddress(PROXY_ADDRESS);
  
  console.log("\n✅ Upgrade to V4 successful!");
  console.log("Proxy address:", PROXY_ADDRESS);
  console.log("New implementation:", newImpl);
  
  // 验证升级后的合约
  const contract = await ethers.getContractAt("LegalDIDV4", PROXY_ADDRESS);
  const mintPrice = await contract.mintPrice();
  console.log("\nVerification - mintPrice:", ethers.formatEther(mintPrice), "ETH");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
