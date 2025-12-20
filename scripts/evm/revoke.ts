import { ethers } from "hardhat";

async function main() {
  const PROXY_ADDRESS = "0x6209624ff78a2dc3e7A30220E00c35aa9d542259";
  const TOKEN_ID = 1; // 之前铸造的 tokenId

  const [deployer] = await ethers.getSigners();
  console.log("Revoking with account:", deployer.address);

  const contract = await ethers.getContractAt("LegalDIDV3", PROXY_ADDRESS);

  console.log("Revoking token ID:", TOKEN_ID);

  const tx = await contract.revoke(TOKEN_ID);
  console.log("Transaction hash:", tx.hash);

  const receipt = await tx.wait();
  console.log("✅ Revoke successful!");
  console.log("Block:", receipt?.blockNumber);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
