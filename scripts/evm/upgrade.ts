import { ethers, upgrades } from "hardhat";

async function main() {
  const PROXY_ADDRESS = "0x73C9B870Bac1FcD4C9b2ac3Dc1e78e2d5f3460F5";

  const [deployer] = await ethers.getSigners();
  console.log("Upgrading with account:", deployer.address);

  const LegalDIDV2 = await ethers.getContractFactory("LegalDIDV2");

  console.log("Upgrading LegalDID to V2...");
  const upgraded = await upgrades.upgradeProxy(PROXY_ADDRESS, LegalDIDV2);

  await upgraded.waitForDeployment();

  console.log("LegalDID upgraded successfully!");
  console.log("Proxy address:", PROXY_ADDRESS);
  console.log(
    "New implementation:",
    await upgrades.erc1967.getImplementationAddress(PROXY_ADDRESS)
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
