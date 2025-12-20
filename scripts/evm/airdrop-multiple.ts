import { ethers } from "hardhat";

async function main() {
  const PROXY_ADDRESS = "0x6209624ff78a2dc3e7A30220E00c35aa9d542259";
  
  const rnsId = "082d9a09-aa3c-49dc-ae66-e8800261a2ab"; // 相同的 rnsId
  const wallet = "0x464f65Cc4AF7013239c6B79ed8a2FBd87dF91722"; // 相同的钱包
  const merkleRoot = ethers.ZeroHash;

  const [deployer] = await ethers.getSigners();
  console.log("Airdropping with account:", deployer.address);

  const contract = await ethers.getContractAt("LegalDIDV3", PROXY_ADDRESS);

  console.log("Airdropping first NFT...");
  console.log("  rnsId:", rnsId);
  console.log("  wallet:", wallet);

  // 第一个 NFT
  const tx1 = await contract.airdrop(rnsId, wallet, merkleRoot);
  console.log("First transaction hash:", tx1.hash);
  await tx1.wait();
  
  const tokenId1 = await contract.lastTokenId();
  console.log("✅ First NFT minted! Token ID:", tokenId1.toString());

  console.log("\nAirdropping second NFT (same rnsId + wallet)...");
  
  // 第二个 NFT（相同 rnsId + wallet）
  const tx2 = await contract.airdrop(rnsId, wallet, merkleRoot);
  console.log("Second transaction hash:", tx2.hash);
  await tx2.wait();
  
  const tokenId2 = await contract.lastTokenId();
  console.log("✅ Second NFT minted! Token ID:", tokenId2.toString());

  console.log("\n🎉 Successfully minted 2 NFTs with same rnsId + wallet!");
  console.log("Token IDs:", tokenId1.toString(), "and", tokenId2.toString());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});