import { ethers } from "hardhat";

async function main() {
  const PROXY_ADDRESS = "0x6e008797d8a7f3ed706d1a69f1fba713e74eb96d";
  const WALLET = "0xa97E3d1bDD37a44711df20848D568b3B45e04454";
  const ORDER_ID = `order_${Date.now()}`;

  const [signer] = await ethers.getSigners();
  console.log("Signer:", signer.address);

  const contract = await ethers.getContractAt("LegalDIDV4", PROXY_ADDRESS);

  // 获取 mintPrice
  const mintPrice = await contract.mintPrice();
  console.log("Mint Price:", ethers.formatEther(mintPrice), "ETH");

  console.log("\n=== AuthorizeMint V4 ===");
  console.log("Wallet:", WALLET);
  console.log("OrderId:", ORDER_ID);

  // 作为 SECONDARY_ADMIN_ROLE，fee = 0
  const tx = await contract.authorizeMintV4(ORDER_ID, WALLET, { value: 0 });
  console.log("\nTransaction sent:", tx.hash);

  const receipt = await tx.wait();
  console.log("Transaction confirmed in block:", receipt?.blockNumber);

  console.log("\n✅ AuthorizeMintV4 successful!");
  console.log("Etherscan TX:", `https://sepolia.etherscan.io/tx/${tx.hash}`);
}

main().catch(console.error);
