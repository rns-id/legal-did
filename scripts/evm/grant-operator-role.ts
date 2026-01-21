import { ethers } from "hardhat";

async function main() {
  const PROXY_ADDRESS = "0x6e008797d8a7f3ed706d1a69f1fba713e74eb96d";
  const NEW_OPERATOR = "0xcea1489161A0663AD68985b90849daFbbff10039";
  
  // OPERATOR_ROLE hash
  const OPERATOR_ROLE = ethers.keccak256(ethers.toUtf8Bytes("OPERATOR_ROLE"));
  
  console.log("=".repeat(60));
  console.log("Grant OPERATOR_ROLE");
  console.log("=".repeat(60));
  console.log(`\nProxy Address: ${PROXY_ADDRESS}`);
  console.log(`New Operator: ${NEW_OPERATOR}`);
  console.log(`OPERATOR_ROLE: ${OPERATOR_ROLE}`);
  
  const [signer] = await ethers.getSigners();
  console.log(`\nSigner: ${signer.address}`);
  
  // Get contract instance
  const abi = [
    "function grantRole(bytes32 role, address account) external",
    "function hasRole(bytes32 role, address account) view returns (bool)",
  ];
  const contract = new ethers.Contract(PROXY_ADDRESS, abi, signer);
  
  // Check if already has role
  const hasRole = await contract.hasRole(OPERATOR_ROLE, NEW_OPERATOR);
  if (hasRole) {
    console.log(`\n${NEW_OPERATOR} already has OPERATOR_ROLE`);
    return;
  }
  
  console.log(`\nGranting OPERATOR_ROLE to ${NEW_OPERATOR}...`);
  
  const tx = await contract.grantRole(OPERATOR_ROLE, NEW_OPERATOR);
  console.log(`Transaction hash: ${tx.hash}`);
  
  const receipt = await tx.wait();
  console.log(`Transaction confirmed in block: ${receipt.blockNumber}`);
  
  // Verify
  const hasRoleAfter = await contract.hasRole(OPERATOR_ROLE, NEW_OPERATOR);
  console.log(`\nVerification: ${NEW_OPERATOR} has OPERATOR_ROLE: ${hasRoleAfter}`);
  
  console.log("\n" + "=".repeat(60));
  console.log("Done!");
  console.log("=".repeat(60));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
