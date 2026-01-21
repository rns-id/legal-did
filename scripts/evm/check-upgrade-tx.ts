import { ethers } from "hardhat";

async function main() {
  const TX_HASH = "0x0ec0c5d66d10f78687d4653b08ddf36f95306732b3e26968374c3cf7301eb373";
  
  console.log("=".repeat(60));
  console.log("Upgrade Transaction Analysis");
  console.log("=".repeat(60));
  console.log(`\nTransaction Hash: ${TX_HASH}`);
  
  const provider = ethers.provider;
  
  // Get transaction
  const tx = await provider.getTransaction(TX_HASH);
  if (!tx) {
    console.log("Transaction not found");
    return;
  }
  
  console.log(`\nFrom: ${tx.from}`);
  console.log(`To: ${tx.to}`);
  console.log(`Block: ${tx.blockNumber}`);
  
  // Get transaction receipt
  const receipt = await provider.getTransactionReceipt(TX_HASH);
  if (!receipt) {
    console.log("Receipt not found");
    return;
  }
  
  console.log(`\nStatus: ${receipt.status === 1 ? "Success" : "Failed"}`);
  console.log(`Gas Used: ${receipt.gasUsed}`);
  
  // Parse logs for Upgraded event
  // EIP-1967 Upgraded event: event Upgraded(address indexed implementation)
  const UPGRADED_TOPIC = ethers.id("Upgraded(address)");
  
  console.log("\n" + "-".repeat(60));
  console.log("Events:");
  console.log("-".repeat(60));
  
  for (const log of receipt.logs) {
    console.log(`\nLog from: ${log.address}`);
    console.log(`Topics: ${log.topics.length}`);
    
    if (log.topics[0] === UPGRADED_TOPIC) {
      // Upgraded event found
      const newImplementation = "0x" + log.topics[1].slice(-40);
      console.log(`\n*** UPGRADED EVENT ***`);
      console.log(`New Implementation: ${newImplementation}`);
    }
    
    // Also check for AdminChanged event
    const ADMIN_CHANGED_TOPIC = ethers.id("AdminChanged(address,address)");
    if (log.topics[0] === ADMIN_CHANGED_TOPIC) {
      console.log(`\n*** ADMIN CHANGED EVENT ***`);
    }
  }
  
  // Decode the transaction input data
  console.log("\n" + "-".repeat(60));
  console.log("Transaction Input Data:");
  console.log("-".repeat(60));
  
  // ProxyAdmin upgrade function signature
  // upgrade(address proxy, address implementation)
  // upgradeAndCall(address proxy, address implementation, bytes data)
  
  const UPGRADE_SIG = "0x99a88ec4"; // upgrade(address,address)
  const UPGRADE_AND_CALL_SIG = "0x9623609d"; // upgradeAndCall(address,address,bytes)
  
  const inputData = tx.data;
  const selector = inputData.slice(0, 10);
  
  console.log(`Function Selector: ${selector}`);
  
  if (selector === UPGRADE_SIG) {
    console.log("Function: upgrade(address proxy, address implementation)");
    // Decode parameters
    const params = ethers.AbiCoder.defaultAbiCoder().decode(
      ["address", "address"],
      "0x" + inputData.slice(10)
    );
    console.log(`Proxy: ${params[0]}`);
    console.log(`New Implementation: ${params[1]}`);
  } else if (selector === UPGRADE_AND_CALL_SIG) {
    console.log("Function: upgradeAndCall(address proxy, address implementation, bytes data)");
    const params = ethers.AbiCoder.defaultAbiCoder().decode(
      ["address", "address", "bytes"],
      "0x" + inputData.slice(10)
    );
    console.log(`Proxy: ${params[0]}`);
    console.log(`New Implementation: ${params[1]}`);
    console.log(`Call Data: ${params[2]}`);
  }
  
  // Get the implementation before this block
  const IMPLEMENTATION_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
  const PROXY_ADDRESS = "0x6e008797d8a7f3ed706d1a69f1fba713e74eb96d";
  
  if (tx.blockNumber) {
    // Get implementation before upgrade
    const prevBlock = tx.blockNumber - 1;
    const prevImpl = await provider.getStorage(PROXY_ADDRESS, IMPLEMENTATION_SLOT, prevBlock);
    const prevImplAddress = "0x" + prevImpl.slice(-40);
    
    // Get implementation after upgrade
    const afterImpl = await provider.getStorage(PROXY_ADDRESS, IMPLEMENTATION_SLOT, tx.blockNumber);
    const afterImplAddress = "0x" + afterImpl.slice(-40);
    
    console.log("\n" + "=".repeat(60));
    console.log("Implementation Change:");
    console.log("=".repeat(60));
    console.log(`\nBefore (Block ${prevBlock}): ${prevImplAddress}`);
    console.log(`After  (Block ${tx.blockNumber}): ${afterImplAddress}`);
    
    console.log("\n" + "-".repeat(60));
    console.log("Etherscan Links:");
    console.log("-".repeat(60));
    console.log(`Old Implementation: https://sepolia.etherscan.io/address/${prevImplAddress}`);
    console.log(`New Implementation: https://sepolia.etherscan.io/address/${afterImplAddress}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
