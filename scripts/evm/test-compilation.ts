import { ethers } from "hardhat";

async function main() {
  console.log("🔍 测试合约编译...\n");

  try {
    // 测试原有DID系统合约 (v0.8.12)
    console.log("📋 测试原有DID系统合约编译...");
    
    console.log("- 检查 LegalDID...");
    const LegalDID = await ethers.getContractFactory("LegalDID");
    console.log("✅ LegalDID 编译成功");

    console.log("- 检查 LegalDIDV2...");
    const LegalDIDV2 = await ethers.getContractFactory("LegalDIDV2");
    console.log("✅ LegalDIDV2 编译成功");

    console.log("- 检查 LegalDIDV3...");
    const LegalDIDV3 = await ethers.getContractFactory("LegalDIDV3");
    console.log("✅ LegalDIDV3 编译成功");

    // 测试标签式证明系统合约 (v0.8.26)
    console.log("\n📋 测试标签式证明系统合约编译...");
    
    console.log("- 检查 TaggedAttester...");
    const TaggedAttester = await ethers.getContractFactory("TaggedAttester");
    console.log("✅ TaggedAttester 编译成功");

    console.log("- 检查 TaggedResolver...");
    const TaggedResolver = await ethers.getContractFactory("TaggedResolver");
    console.log("✅ TaggedResolver 编译成功");

    console.log("- 检查 TaggedQuery...");
    const TaggedQuery = await ethers.getContractFactory("TaggedQuery");
    console.log("✅ TaggedQuery 编译成功");

    console.log("- 检查 TaggedSchemaRegistrar...");
    const TaggedSchemaRegistrar = await ethers.getContractFactory("TaggedSchemaRegistrar");
    console.log("✅ TaggedSchemaRegistrar 编译成功");

    // 测试法律身份系统合约 (v0.8.26)
    console.log("\n📋 测试法律身份系统合约编译...");
    
    console.log("- 检查 LegalIdentityRegistry...");
    const LegalIdentityRegistry = await ethers.getContractFactory("LegalIdentityRegistry");
    console.log("✅ LegalIdentityRegistry 编译成功");

    console.log("- 检查 LegalCaseManager...");
    const LegalCaseManager = await ethers.getContractFactory("LegalCaseManager");
    console.log("✅ LegalCaseManager 编译成功");

    console.log("\n🎉 所有合约编译测试通过！");
    console.log("==========================================");
    console.log("✅ 原有DID系统 (v0.8.12): 3个合约");
    console.log("✅ 标签式证明系统 (v0.8.26): 4个合约");
    console.log("✅ 法律身份系统 (v0.8.26): 2个合约");
    console.log("==========================================");
    console.log("📋 总计: 9个合约全部编译成功");

  } catch (error) {
    console.error("❌ 编译测试失败:", error);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });