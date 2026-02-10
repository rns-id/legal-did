import { ethers, upgrades } from "hardhat";

async function main() {
  console.log("验证 V1 → V4 升级兼容性...\n");
  
  // 获取合约工厂
  const LegalDID = await ethers.getContractFactory("LegalDID");
  const LegalDIDV4 = await ethers.getContractFactory("LegalDIDV4");
  
  try {
    // 本地验证：V1 → V4 存储布局兼容性
    console.log("验证存储布局兼容性 (LegalDID → LegalDIDV4)...");
    await upgrades.validateUpgrade(LegalDID, LegalDIDV4, {
      kind: 'transparent',
    });
    console.log("✅ 存储布局兼容，可以安全升级!\n");
  } catch (e: any) {
    console.log("❌ 升级验证失败:", e.message, "\n");
    process.exit(1);
  }
  
  console.log("=".repeat(50));
  console.log("升级验证通过！可以继续部署。");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
