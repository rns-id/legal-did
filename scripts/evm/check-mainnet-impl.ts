import { ethers } from "hardhat";

async function main() {
  const PROXY = "0xb365e53b64655476e3c3b7a3e225d8bf2e95f71d";
  const IMPLEMENTATION_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";

  const implSlotValue = await ethers.provider.getStorage(PROXY, IMPLEMENTATION_SLOT);
  const implementationAddress = "0x" + implSlotValue.slice(-40);

  console.log("Proxy:", PROXY);
  console.log("Current Implementation:", implementationAddress);
}

main().catch(console.error);
