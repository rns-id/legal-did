import { ethers, upgrades } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");

  const LegalDID = await ethers.getContractFactory("LegalDID");
  console.log("Deploying proxy (implementation already exists)...");
  
  const proxy = await upgrades.deployProxy(LegalDID, [], {
    initializer: "initialize",
  });

  console.log("Waiting for deployment...");
  await proxy.waitForDeployment();
  
  const proxyAddress = await proxy.getAddress();
  console.log("✅ Proxy deployed to:", proxyAddress);
  console.log("✅ Implementation:", await upgrades.erc1967.getImplementationAddress(proxyAddress));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
