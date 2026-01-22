import { ethers } from "hardhat";

async function main() {
  const PROXY = "0x6e008797d8a7f3ed706d1a69f1fba713e74eb96d";
  const ADDR = "0xcea1489161A0663AD68985b90849daFbbff10039";
  const SECONDARY_ADMIN_ROLE = ethers.keccak256(ethers.toUtf8Bytes("SECONDARY_ADMIN_ROLE"));

  const [signer] = await ethers.getSigners();
  console.log("Signer:", signer.address);

  const contract = await ethers.getContractAt("LegalDIDV4", PROXY);

  console.log("\nGranting SECONDARY_ADMIN_ROLE to:", ADDR);
  
  const tx = await contract.grantRole(SECONDARY_ADMIN_ROLE, ADDR);
  console.log("TX sent:", tx.hash);
  
  await tx.wait();
  console.log("✅ Role granted!");

  // 验证
  const hasRole = await contract.hasRole(SECONDARY_ADMIN_ROLE, ADDR);
  console.log("SECONDARY_ADMIN_ROLE:", hasRole);
  
  console.log("\nEtherscan:", `https://sepolia.etherscan.io/tx/${tx.hash}`);
}

main().catch(console.error);
