import { ethers } from "hardhat";

async function main() {
  const PROXY_ADDRESS = "0x6e008797d8a7f3ed706d1a69f1fba713e74eb96d";
  const WALLET = "0xa97E3d1bDD37a44711df20848D568b3B45e04454";
  const RNS_ID = `test_rns_${Date.now()}`;
  const MERKLE_ROOT = ethers.keccak256(ethers.toUtf8Bytes(`ldid_${RNS_ID}_${Date.now()}`));

  const [signer] = await ethers.getSigners();
  console.log("Signer:", signer.address);

  const contract = await ethers.getContractAt("LegalDIDV4", PROXY_ADDRESS);

  // ========== 测试旧版 authorizeMint ==========
  console.log("\n=== Test Legacy authorizeMint() ===");
  console.log("RNS ID:", RNS_ID);
  console.log("Wallet:", WALLET);

  try {
    const tx1 = await contract.authorizeMint(RNS_ID, WALLET, { value: 0 });
    console.log("TX sent:", tx1.hash);
    const receipt1 = await tx1.wait();
    console.log("✅ authorizeMint() SUCCESS - block:", receipt1?.blockNumber);
    console.log("Etherscan:", `https://sepolia.etherscan.io/tx/${tx1.hash}`);
  } catch (e: any) {
    console.log("❌ authorizeMint() FAILED:", e.message);
  }

  // ========== 测试旧版 airdrop ==========
  console.log("\n=== Test Legacy airdrop() ===");
  console.log("RNS ID:", RNS_ID);
  console.log("Wallet:", WALLET);
  console.log("MerkleRoot:", MERKLE_ROOT);

  try {
    const tx2 = await contract.airdrop(RNS_ID, WALLET, MERKLE_ROOT);
    console.log("TX sent:", tx2.hash);
    const receipt2 = await tx2.wait();
    console.log("✅ airdrop() SUCCESS - block:", receipt2?.blockNumber);
    
    const lastTokenId = await contract.lastTokenId();
    console.log("Token ID:", lastTokenId.toString());
    console.log("Etherscan:", `https://sepolia.etherscan.io/tx/${tx2.hash}`);
  } catch (e: any) {
    console.log("❌ airdrop() FAILED:", e.message);
  }

  console.log("\n=== Legacy Methods Test Complete ===");
}

main().catch(console.error);
