import { ethers } from "hardhat";

/**
 * 仅部署新的 Implementation 合约（不执行升级）
 * 升级操作由老板通过 ProxyAdmin 执行
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");

  console.log("\n=== Deploying LegalDIDV4 Implementation ===\n");

  const LegalDIDV4 = await ethers.getContractFactory("LegalDIDV4");
  const impl = await LegalDIDV4.deploy();
  await impl.waitForDeployment();

  const implAddress = await impl.getAddress();

  console.log("✅ Implementation deployed successfully!");
  console.log("");
  console.log("=".repeat(60));
  console.log("新 Implementation 地址:", implAddress);
  console.log("=".repeat(60));
  console.log("");
  console.log("下一步操作：");
  console.log("1. 验证合约: npx hardhat verify --network mainnet", implAddress);
  console.log("2. 将此地址交给老板，由老板调用 ProxyAdmin.upgrade()");
  console.log("");
  console.log("老板操作：");
  console.log("- ProxyAdmin 地址: 0xff702678e77f3622ed84ce1b2d4400af5182d2ee");
  console.log("- Proxy 地址: 0xb365e53b64655476e3c3b7a3e225d8bf2e95f71d");
  console.log("- 调用 upgrade(proxy, implementation)");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
