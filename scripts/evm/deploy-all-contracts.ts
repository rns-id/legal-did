import { ethers, upgrades } from "hardhat";
import { Contract } from "ethers";

async function main() {
  console.log("🚀 开始部署 Legal DID 完整合约系统...\n");

  const [deployer] = await ethers.getSigners();
  console.log("部署账户:", deployer.address);
  console.log("账户余额:", ethers.formatEther(await deployer.provider.getBalance(deployer.address)), "ETH\n");

  // 部署结果存储
  const deployedContracts: { [key: string]: string } = {};

  try {
    // ========================================
    // 第一阶段：部署原有DID系统 (v0.8.12)
    // ========================================
    console.log("📋 第一阶段：部署原有DID系统...");

    // 部署 LegalDID (可升级合约)
    console.log("部署 LegalDID...");
    const LegalDID = await ethers.getContractFactory("LegalDID");
    const legalDID = await upgrades.deployProxy(LegalDID, [], {
      initializer: "initialize",
      kind: "uups"
    });
    await legalDID.waitForDeployment();
    const legalDIDAddress = await legalDID.getAddress();
    deployedContracts["LegalDID"] = legalDIDAddress;
    console.log("✅ LegalDID 部署完成:", legalDIDAddress);

    // ========================================
    // 第二阶段：部署EAS基础设施
    // ========================================
    console.log("\n📋 第二阶段：部署EAS基础设施...");

    // 注意：在实际部署中，你可能需要使用现有的EAS合约地址
    // 这里假设我们部署自己的EAS实例用于测试
    
    // 部署 SchemaRegistry (模拟EAS的SchemaRegistry)
    console.log("部署 SchemaRegistry...");
    const SchemaRegistry = await ethers.getContractFactory("SchemaRegistry");
    const schemaRegistry = await SchemaRegistry.deploy();
    await schemaRegistry.waitForDeployment();
    const schemaRegistryAddress = await schemaRegistry.getAddress();
    deployedContracts["SchemaRegistry"] = schemaRegistryAddress;
    console.log("✅ SchemaRegistry 部署完成:", schemaRegistryAddress);

    // 部署 EAS
    console.log("部署 EAS...");
    const EAS = await ethers.getContractFactory("EAS");
    const eas = await EAS.deploy(schemaRegistryAddress);
    await eas.waitForDeployment();
    const easAddress = await eas.getAddress();
    deployedContracts["EAS"] = easAddress;
    console.log("✅ EAS 部署完成:", easAddress);

    // ========================================
    // 第三阶段：部署标签式证明系统 (v0.8.26)
    // ========================================
    console.log("\n📋 第三阶段：部署标签式证明系统...");

    // 部署 TaggedResolver
    console.log("部署 TaggedResolver...");
    const TaggedResolver = await ethers.getContractFactory("TaggedResolver");
    const taggedResolver = await TaggedResolver.deploy(easAddress);
    await taggedResolver.waitForDeployment();
    const taggedResolverAddress = await taggedResolver.getAddress();
    deployedContracts["TaggedResolver"] = taggedResolverAddress;
    console.log("✅ TaggedResolver 部署完成:", taggedResolverAddress);

    // 部署 TaggedSchemaRegistrar
    console.log("部署 TaggedSchemaRegistrar...");
    const TaggedSchemaRegistrar = await ethers.getContractFactory("TaggedSchemaRegistrar");
    const taggedSchemaRegistrar = await TaggedSchemaRegistrar.deploy(schemaRegistryAddress);
    await taggedSchemaRegistrar.waitForDeployment();
    const taggedSchemaRegistrarAddress = await taggedSchemaRegistrar.getAddress();
    deployedContracts["TaggedSchemaRegistrar"] = taggedSchemaRegistrarAddress;
    console.log("✅ TaggedSchemaRegistrar 部署完成:", taggedSchemaRegistrarAddress);

    // 部署 TaggedAttester
    console.log("部署 TaggedAttester...");
    const TaggedAttester = await ethers.getContractFactory("TaggedAttester");
    const taggedAttester = await TaggedAttester.deploy(easAddress);
    await taggedAttester.waitForDeployment();
    const taggedAttesterAddress = await taggedAttester.getAddress();
    deployedContracts["TaggedAttester"] = taggedAttesterAddress;
    console.log("✅ TaggedAttester 部署完成:", taggedAttesterAddress);

    // 部署 TaggedQuery
    console.log("部署 TaggedQuery...");
    const TaggedQuery = await ethers.getContractFactory("TaggedQuery");
    const taggedQuery = await TaggedQuery.deploy(easAddress, taggedResolverAddress);
    await taggedQuery.waitForDeployment();
    const taggedQueryAddress = await taggedQuery.getAddress();
    deployedContracts["TaggedQuery"] = taggedQueryAddress;
    console.log("✅ TaggedQuery 部署完成:", taggedQueryAddress);

    // ========================================
    // 第四阶段：部署法律身份系统 (v0.8.26)
    // ========================================
    console.log("\n📋 第四阶段：部署法律身份系统...");

    // 部署 LegalIdentityRegistry
    console.log("部署 LegalIdentityRegistry...");
    const LegalIdentityRegistry = await ethers.getContractFactory("LegalIdentityRegistry");
    const legalIdentityRegistry = await LegalIdentityRegistry.deploy(easAddress);
    await legalIdentityRegistry.waitForDeployment();
    const legalIdentityRegistryAddress = await legalIdentityRegistry.getAddress();
    deployedContracts["LegalIdentityRegistry"] = legalIdentityRegistryAddress;
    console.log("✅ LegalIdentityRegistry 部署完成:", legalIdentityRegistryAddress);

    // 部署 LegalCaseManager
    console.log("部署 LegalCaseManager...");
    const LegalCaseManager = await ethers.getContractFactory("LegalCaseManager");
    const legalCaseManager = await LegalCaseManager.deploy(easAddress);
    await legalCaseManager.waitForDeployment();
    const legalCaseManagerAddress = await legalCaseManager.getAddress();
    deployedContracts["LegalCaseManager"] = legalCaseManagerAddress;
    console.log("✅ LegalCaseManager 部署完成:", legalCaseManagerAddress);

    // ========================================
    // 第五阶段：初始化配置
    // ========================================
    console.log("\n📋 第五阶段：初始化配置...");

    // 注册标签模式
    console.log("注册标签模式...");
    const schemaUIDs = await taggedSchemaRegistrar.batchRegisterAllPredefinedSchemas(
      taggedResolverAddress,
      true // revocable
    );
    console.log("✅ 标签模式注册完成");

    // 设置标签发放权限（示例）
    console.log("设置标签发放权限...");
    await taggedAttester.setAuthorizedIssuer(deployer.address, "validity", true);
    await taggedAttester.setAuthorizedIssuer(deployer.address, "clearance", true);
    await taggedAttester.setAuthorizedIssuer(deployer.address, "age", true);
    await taggedAttester.setAuthorizedIssuer(deployer.address, "gender", true);
    await taggedAttester.setAuthorizedIssuer(deployer.address, "document", true);
    await taggedAttester.setAuthorizedIssuer(deployer.address, "geographic", true);
    console.log("✅ 标签发放权限设置完成");

    // 设置身份发放权限（示例）
    console.log("设置身份发放权限...");
    await legalIdentityRegistry.setAuthorizedIssuer(deployer.address, 0, true); // Lawyer
    await legalIdentityRegistry.setAuthorizedIssuer(deployer.address, 1, true); // Judge
    await legalIdentityRegistry.setAuthorizedIssuer(deployer.address, 2, true); // Notary
    await legalIdentityRegistry.setAuthorizedIssuer(deployer.address, 3, true); // LegalAdvisor
    console.log("✅ 身份发放权限设置完成");

    // 设置案件管理权限（示例）
    console.log("设置案件管理权限...");
    await legalCaseManager.setAuthorizedClerk(deployer.address, true);
    await legalCaseManager.setAuthorizedJudge(deployer.address, true);
    await legalCaseManager.setAuthorizedLawyer(deployer.address, true);
    console.log("✅ 案件管理权限设置完成");

    // ========================================
    // 部署完成总结
    // ========================================
    console.log("\n🎉 所有合约部署完成！");
    console.log("==========================================");
    console.log("📋 部署地址汇总:");
    console.log("==========================================");
    
    Object.entries(deployedContracts).forEach(([name, address]) => {
      console.log(`${name.padEnd(25)}: ${address}`);
    });

    console.log("==========================================");
    console.log("💡 下一步操作建议:");
    console.log("1. 验证合约代码（如果在主网或测试网）");
    console.log("2. 配置前端应用的合约地址");
    console.log("3. 设置适当的权限和角色");
    console.log("4. 进行功能测试");
    console.log("==========================================");

    // 保存部署信息到文件
    const fs = require('fs');
    const deploymentInfo = {
      network: await ethers.provider.getNetwork(),
      timestamp: new Date().toISOString(),
      deployer: deployer.address,
      contracts: deployedContracts
    };

    fs.writeFileSync(
      `deployments/deployment-${Date.now()}.json`,
      JSON.stringify(deploymentInfo, null, 2)
    );
    console.log("📄 部署信息已保存到 deployments/ 目录");

  } catch (error) {
    console.error("❌ 部署过程中发生错误:", error);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });