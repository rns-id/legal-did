import { ethers } from "hardhat";

async function main() {
  // 代理合约地址（不是 implementation）
  const PROXY_ADDRESS = "0x6209624ff78a2dc3e7A30220E00c35aa9d542259";
  
  const rnsId = "082d9a09-aa3c-49dc-ae66-e8800261a2ab";
  const wallet = "0x464f65Cc4AF7013239c6B79ed8a2FBd87dF91722";
  const merkleRoot = ethers.ZeroHash; // 空的 merkle root，可以后续设置

  const [deployer] = await ethers.getSigners();
  console.log("Calling airdrop with account:", deployer.address);

  const contract = await ethers.getContractAt("LegalDIDV2", PROXY_ADDRESS);

  console.log("Airdropping...");
  console.log("  rnsId:", rnsId);
  console.log("  wallet:", wallet);
  console.log("  merkleRoot:", merkleRoot);

  const tx = await contract.airdrop(rnsId, wallet, merkleRoot);
  console.log("Transaction hash:", tx.hash);
  
  const receipt = await tx.wait();
  console.log("✅ Airdrop successful!");
  console.log("Block:", receipt?.blockNumber);
  
  // 查询新铸造的 tokenId
  const lastTokenId = await contract.lastTokenId();
  console.log("Token ID:", lastTokenId.toString());
  
  const tokenURI = await contract.tokenURI(lastTokenId);
  console.log("Token URI:", tokenURI);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
