import { ethers } from "hardhat";

async function main() {
  const PROXY = "0x6e008797d8a7f3ed706d1a69f1fba713e74eb96d";
  const ADDR = "0xcea1489161A0663AD68985b90849daFbbff10039";
  const SECONDARY_ADMIN_ROLE = ethers.keccak256(ethers.toUtf8Bytes("SECONDARY_ADMIN_ROLE"));
  const DEFAULT_ADMIN_ROLE = "0x0000000000000000000000000000000000000000000000000000000000000000";

  const contract = await ethers.getContractAt("LegalDIDV4", PROXY);
  
  console.log("Checking roles for:", ADDR);
  console.log("Contract:", PROXY);
  console.log("");
  
  const hasSecondaryAdmin = await contract.hasRole(SECONDARY_ADMIN_ROLE, ADDR);
  const hasDefaultAdmin = await contract.hasRole(DEFAULT_ADMIN_ROLE, ADDR);
  
  console.log("SECONDARY_ADMIN_ROLE:", hasSecondaryAdmin);
  console.log("DEFAULT_ADMIN_ROLE:", hasDefaultAdmin);
}

main().catch(console.error);
