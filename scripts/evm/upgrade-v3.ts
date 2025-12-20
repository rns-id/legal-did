import { ethers, upgrades } from "hardhat";

async function main() {
  // 测试代理地址
  const PROXY_ADDRESS = "0x6209624ff78a2dc3e7A30220E00c35aa9d542259";

  const [deployer] = await ethers.getSigners();
  console.log("Upgrading with account:", deployer.address);
  console.log("Current implementation:", await upgrades.erc1967.getImplementationAddress(PROXY_ADDRESS));

  const LegalDIDV3 = await ethers.getContractFactory("LegalDIDV3");

  console.log("Upgrading to V3...");
  const upgraded = await upgrades.upgradeProxy(PROXY_ADDRESS, LegalDIDV3);

  await upgraded.waitForDeployment();

  console.log("✅ Upgrade to V3 successful!");
  console.log("Proxy address:", PROXY_ADDRESS);
  console.log("New implementation:", await upgrades.erc1967.getImplementationAddress(PROXY_ADDRESS));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
