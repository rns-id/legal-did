import { ethers, upgrades } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");

  const LegalDID = await ethers.getContractFactory("LegalDID");
  console.log("Deploying LegalDID proxy...");
  
  const proxy = await upgrades.deployProxy(LegalDID, [], {
    initializer: "initialize",
    timeout: 300000, // 5 minutes
    pollingInterval: 10000, // 10 seconds
  });

  await proxy.waitForDeployment();
  const proxyAddress = await proxy.getAddress();

  console.log("✅ LegalDID proxy deployed to:", proxyAddress);
  console.log("✅ Implementation deployed to:", await upgrades.erc1967.getImplementationAddress(proxyAddress));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
