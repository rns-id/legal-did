import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Using account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");

  // 使用现有的 V4 合约地址
  const proxyAddress = "0xA9B88f1c2CA5D2B2d528F35F9c0a9e72eaDE2b8e";
  
  // 空投参数
  const targetWallet = "0x464f65Cc4AF7013239c6B79ed8a2FBd87dF91722";
  const orderId = "existing_v4_order_" + Date.now(); // 生成唯一订单ID
  const merkleRoot = "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"; // 不同的 merkle root
  
  console.log("\n📋 空投参数:");
  console.log("- Contract Address:", proxyAddress);
  console.log("- Target Wallet:", targetWallet);
  console.log("- Order ID:", orderId);
  console.log("- Merkle Root:", merkleRoot);
  
  // V4 合约 ABI
  const abi = [
    "function name() view returns (string)",
    "function symbol() view returns (string)",
    "function mintPrice() view returns (uint256)",
    "function lastTokenId() view returns (uint256)",
    "function balanceOf(address owner) view returns (uint256)",
    "function tokenURI(uint256 tokenId) view returns (string)",
    "function tokenMerkleRoot(uint256 tokenId) view returns (bytes32)",
    "function tokenIdToWallet(uint256 tokenId) view returns (address)",
    "function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)",
    "function airdropV4(string orderId, address wallet, bytes32 merkleRoot)",
    "function DEFAULT_ADMIN_ROLE() view returns (bytes32)",
    "function SECONDARY_ADMIN_ROLE() view returns (bytes32)",
    "function hasRole(bytes32 role, address account) view returns (bool)",
    "event AirdropV4(string indexed orderId, address indexed wallet, uint256 tokenId, bytes32 merkleRoot)"
  ];
  
  // 连接到现有合约
  const contract = new ethers.Contract(proxyAddress, abi, deployer);

  try {
    // 检查合约基本信息
    const name = await contract.name();
    const symbol = await contract.symbol();
    console.log("\n📊 合约信息:");
    console.log("- Name:", name);
    console.log("- Symbol:", symbol);
    
    // 检查权限
    const SECONDARY_ADMIN_ROLE = await contract.SECONDARY_ADMIN_ROLE();
    const hasAdminRole = await contract.hasRole(SECONDARY_ADMIN_ROLE, deployer.address);
    console.log("- Has Admin Role:", hasAdminRole);
    
    if (!hasAdminRole) {
      console.log("❌ 当前账户没有管理员权限，无法执行空投");
      return;
    }
    
    // 检查空投前状态
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
    console.log("🔗 查看交易:", `https://sepolia.etherscan.io/tx/${tx.hash}`);
    console.log("🔗 查看合约:", `https://sepolia.etherscan.io/address/${proxyAddress}`);
    
  } catch (error: any) {
    console.error("❌ 空投失败:", error.message);
    
    // 检查常见错误
    if (error.message.includes("AccessControl")) {
      console.log("\n💡 提示: 请确保当前账户具有 SECONDARY_ADMIN_ROLE 权限");
    } else if (error.message.includes("insufficient funds")) {
      console.log("\n💡 提示: 账户余额不足，请确保有足够的 ETH 支付 Gas 费");
    } else if (error.message.includes("nonce")) {
      console.log("\n💡 提示: Nonce 错误，请稍后重试");
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});