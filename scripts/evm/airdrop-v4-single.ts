import { ethers } from "hardhat";

async function main() {
  const PROXY_ADDRESS = "0x6e008797d8a7f3ed706d1a69f1fba713e74eb96d";
  const RECIPIENT = "0xa97E3d1bDD37a44711df20848D568b3B45e04454";
  const ORDER_ID = `order_${Date.now()}`; // 生成唯一 orderId
  const MERKLE_ROOT = ethers.keccak256(ethers.toUtf8Bytes(`ldid_${RECIPIENT}_${Date.now()}`));

  const [signer] = await ethers.getSigners();
  console.log("Signer:", signer.address);

  const contract = await ethers.getContractAt("LegalDIDV4", PROXY_ADDRESS);

  console.log("\n=== Airdrop V4 ===");
  console.log("Recipient:", RECIPIENT);
  console.log("OrderId:", ORDER_ID);
  console.log("MerkleRoot:", MERKLE_ROOT);

  const tx = await contract.airdropV4(ORDER_ID, RECIPIENT, MERKLE_ROOT);
  console.log("\nTransaction sent:", tx.hash);

  const receipt = await tx.wait();
  console.log("Transaction confirmed in block:", receipt?.blockNumber);

  // 获取新铸造的 tokenId
  const lastTokenId = await contract.lastTokenId();
  console.log("\n✅ Airdrop successful!");
  console.log("Token ID:", lastTokenId.toString());
  console.log("Owner:", await contract.ownerOf(lastTokenId));
  
  console.log("\nEtherscan TX:", `https://sepolia.etherscan.io/tx/${tx.hash}`);
}

main().catch(console.error);
