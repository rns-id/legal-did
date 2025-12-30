import { ethers, upgrades, run } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying LegalDIDV3 with account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");

  const LegalDIDV3 = await ethers.getContractFactory("LegalDIDV3");
  
  console.log("\nDeploying proxy...");
  const proxy = await upgrades.deployProxy(LegalDIDV3, [], {
    initializer: "initialize",
  });

  await proxy.waitForDeployment();
  const proxyAddress = await proxy.getAddress();
  const implAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);

  console.log("\n✅ Deployment successful!");
  console.log("Proxy address:", proxyAddress);
  console.log("Implementation address:", implAddress);

  // 等待几个区块确认后验证合约
  console.log("\nWaiting for block confirmations...");
  await new Promise((resolve) => setTimeout(resolve, 30000));

  try {
    console.log("Verifying implementation contract on Etherscan...");
    await run("verify:verify", {
      address: implAddress,
      constructorArguments: [],
    });
    console.log("✅ Contract verified!");
  } catch (error: any) {
    if (error.message.includes("Already Verified")) {
      console.log("Contract already verified");
    } else {
      console.log("Verification failed:", error.message);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
