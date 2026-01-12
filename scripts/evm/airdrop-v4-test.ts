import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Using account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");

  // V4 合约地址
  const proxyAddress = "0x8E8e446C0633EDdD7f83F2778249f787134053f8";
  
  // 空投参数
  const targetWallet = "0x464f65Cc4AF7013239c6B79ed8a2FBd87dF91722";
  const orderId = "test_order_" + Date.now(); // 生成唯一订单ID
  const merkleRoot = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"; // 示例 merkle root
  
  console.log("\n📋 空投参数:");
  console.log("- Target Wallet:", targetWallet);
  console.log("- Order ID:", orderId);
  console.log("- Merkle Root:", merkleRoot);
  
  // 连接到已部署的合约
  const LegalDIDV4 = await ethers.getContractFactory("LegalDIDV4");
  const contract = LegalDIDV4.attach(proxyAddress);

  try {
    // 检查当前状态
    const currentTokenId = await contract.lastTokenId();
    const currentBalance = await contract.balanceOf(targetWallet);
    
    console.log("\n📊 空投前状态:");
    console.log("- Current Last Token ID:", currentTokenId.toString());
    console.log("- Target Wallet Balance:", currentBalance.toString());
    
    // 执行空投
    console.log("\n🚀 执行空投...");
    const tx = await contract.airdropV4(orderId, targetWallet, merkleRoot);
    
    console.log("Transaction hash:", tx.hash);
    console.log("Waiting for confirmation...");
    
    const receipt = await tx.wait();
    console.log("✅ Transaction confirmed in block:", receipt?.blockNumber);
    
    // 检查空投后状态
    const newTokenId = await contract.lastTokenId();
    const newBalance = await contract.balanceOf(targetWallet);
    
    console.log("\n📊 空投后状态:");
    console.log("- New Last Token ID:", newTokenId.toString());
    console.log("- Target Wallet Balance:", newBalance.toString());
    
    // 获取新铸造的 token 信息
    if (newTokenId > currentTokenId) {
      const tokenId = newTokenId;
      const tokenURI = await contract.tokenURI(tokenId);
      const tokenMerkle = await contract.tokenMerkleRoot(tokenId);
      const tokenWallet = await contract.tokenIdToWallet(tokenId);
      
      console.log("\n🎯 新铸造的 NFT 信息:");
      console.log("- Token ID:", tokenId.toString());
      console.log("- Token URI:", tokenURI);
      console.log("- Merkle Root:", tokenMerkle);
      console.log("- Owner Wallet:", tokenWallet);
    }
    
    // 解析事件
    if (receipt?.logs) {
      console.log("\n📝 事件日志:");
      for (const log of receipt.logs) {
        try {
          const parsedLog = contract.interface.parseLog({
            topics: log.topics,
            data: log.data
          });
          
          if (parsedLog?.name === "AirdropV4") {
            console.log("- AirdropV4 Event:");
            console.log("  - Order ID:", parsedLog.args.orderId);
            console.log("  - Wallet:", parsedLog.args.wallet);
            console.log("  - Token ID:", parsedLog.args.tokenId.toString());
            console.log("  - Merkle Root:", parsedLog.args.merkleRoot);
          }
        } catch (e) {
          // 忽略无法解析的日志
        }
      }
    }
    
    console.log("\n🎉 空投成功完成！");
    
  } catch (error: any) {
    console.error("❌ 空投失败:", error.message);
    
    // 检查是否是权限问题
    if (error.message.includes("AccessControl")) {
      console.log("\n💡 提示: 请确保当前账户具有 SECONDARY_ADMIN_ROLE 权限");
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});