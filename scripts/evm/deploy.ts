import { ethers, upgrades } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);

  const LegalDID = await ethers.getContractFactory("LegalDID");
  const proxy = await upgrades.deployProxy(LegalDID, [], {
    initializer: "initialize",
  });

  await proxy.waitForDeployment();
  const proxyAddress = await proxy.getAddress();

  console.log("LegalDID proxy deployed to:", proxyAddress);
  console.log("Implementation deployed to:", await upgrades.erc1967.getImplementationAddress(proxyAddress));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
