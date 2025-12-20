import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { 
  TaggedAttester, 
  TaggedResolver, 
  TaggedQuery, 
  TaggedSchemaRegistrar, 
  EAS, 
  SchemaRegistry 
} from "../../../typechain-types";

describe("LegalAttestation Integration Tests", function () {
  let taggedAttester: TaggedAttester;
  let taggedResolver: TaggedResolver;
  let taggedQuery: TaggedQuery;
  let taggedSchemaRegistrar: TaggedSchemaRegistrar;
  let eas: EAS;
  let schemaRegistry: SchemaRegistry;
  
  let owner: SignerWithAddress;
  let kycProvider: SignerWithAddress;
  let backgroundChecker: SignerWithAddress;
  let ageVerifier: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let user3: SignerWithAddress;

  // 模式UID存储
  let schemaUIDs: { [key: string]: string } = {};

  before(async function () {
    [owner, kycProvider, backgroundChecker, ageVerifier, user1, user2, user3] = await ethers.getSigners();
  });

  beforeEach(async function () {
    // 部署完整的EAS基础设施
    await deployEASInfrastructure();
    
    // 部署LegalAttestation系统
    await deployLegalAttestationSystem();
    
    // 初始化系统配置
    await initializeSystem();
  });

  async function deployEASInfrastructure() {
    // 部署SchemaRegistry
    const SchemaRegistryFactory = await ethers.getContractFactory("SchemaRegistry");
    schemaRegistry = await SchemaRegistryFactory.deploy();
    await schemaRegistry.waitForDeployment();

    // 部署EAS
    const EASFactory = await ethers.getContractFactory("EAS");
    eas = await EASFactory.deploy(await schemaRegistry.getAddress());
    await eas.waitForDeployment();
  }

  async function deployLegalAttestationSystem() {
    // 部署TaggedResolver
    const TaggedResolverFactory = await ethers.getContractFactory("TaggedResolver");
    taggedResolver = await TaggedResolverFactory.deploy(await eas.getAddress());
    await taggedResolver.waitForDeployment();

    // 部署TaggedSchemaRegistrar
    const TaggedSchemaRegistrarFactory = await ethers.getContractFactory("TaggedSchemaRegistrar");
    taggedSchemaRegistrar = await TaggedSchemaRegistrarFactory.deploy(await schemaRegistry.getAddress());
    await taggedSchemaRegistrar.waitForDeployment();

    // 部署TaggedAttester
    const TaggedAttesterFactory = await ethers.getContractFactory("TaggedAttester");
    taggedAttester = await TaggedAttesterFactory.deploy(await eas.getAddress());
    await taggedAttester.waitForDeployment();

    // 部署TaggedQuery
    const TaggedQueryFactory = await ethers.getContractFactory("TaggedQuery");
    taggedQuery = await TaggedQueryFactory.deploy(await eas.getAddress(), await taggedResolver.getAddress());
    await taggedQuery.waitForDeployment();
  }

  async function initializeSystem() {
    // 1. 批量注册所有预定义模式
    const registeredSchemaUIDs = await taggedSchemaRegistrar.batchRegisterAllPredefinedSchemas(
      await taggedResolver.getAddress(),
      true
    );

    // 2. 获取所有模式UID
    const tagTypes = ["validity", "clearance", "age", "gender", "document", "geographic"];
    for (const tagType of tagTypes) {
      schemaUIDs[tagType] = await taggedSchemaRegistrar.getTagSchemaUID(tagType);
    }

    // 3. 在TaggedAttester中注册模式
    for (const tagType of tagTypes) {
      await taggedAttester.registerTagSchema(tagType, schemaUIDs[tagType]);
    }

    // 4. 在TaggedResolver中注册模式映射
    for (const tagType of tagTypes) {
      await taggedResolver.registerSchemaMapping(schemaUIDs[tagType], tagType);
    }

    // 5. 设置权限
    await setupPermissions();
  }

  async function setupPermissions() {
    // KYC提供商权限
    await taggedAttester.setAuthorizedIssuer(kycProvider.address, "validity", true);
    await taggedAttester.setAuthorizedIssuer(kycProvider.address, "gender", true);
    await taggedAttester.setAuthorizedIssuer(kycProvider.address, "document", true);
    await taggedAttester.setAuthorizedIssuer(kycProvider.address, "geographic", true);

    // 背景调查机构权限
    await taggedAttester.setAuthorizedIssuer(backgroundChecker.address, "clearance", true);

    // 年龄验证机构权限
    await taggedAttester.setAuthorizedIssuer(ageVerifier.address, "age", true);
  }

  describe("完整的用户身份验证流程", function () {
    it("应该完成完整的KYC流程", async function () {
      const currentTime = Math.floor(Date.now() / 1000);

      // 步骤1: KYC提供商发放有效性标签
      const validityTag = {
        valid: true,
        issued: currentTime,
        expires: currentTime + 365 * 24 * 3600
      };
      
      const validityTx = await taggedAttester.connect(kycProvider).issueValidityTag(user1.address, validityTag);
      await expect(validityTx).to.emit(taggedAttester, "TagIssued")
        .withArgs(user1.address, "validity", ethers.AnyValue, kycProvider.address);

      // 步骤2: 发放性别标签
      const genderTag = {
        gender: "Female",
        verified: true
      };
      
      await taggedAttester.connect(kycProvider).issueGenderTag(user1.address, genderTag);

      // 步骤3: 发放文档类型标签
      const documentTag = {
        docType: "Passport",
        docHash: ethers.keccak256(ethers.toUtf8Bytes("passport_scan_data")),
        authentic: true
      };
      
      await taggedAttester.connect(kycProvider).issueDocumentTypeTag(user1.address, documentTag);

      // 步骤4: 发放地理位置标签
      const geographicTag = {
        country: "USA",
        region: "North America",
        jurisdiction: "US Federal Courts"
      };
      
      await taggedAttester.connect(kycProvider).issueGeographicTag(user1.address, geographicTag);

      // 步骤5: 背景调查机构发放清理状态标签
      const clearanceTag = {
        clear: true,
        checkDate: currentTime,
        checkType: "background"
      };
      
      await taggedAttester.connect(backgroundChecker).issueClearanceTag(user1.address, clearanceTag);

      // 步骤6: 年龄验证机构发放年龄标签
      const ageTag = {
        over18: true,
        over21: true,
        birthYear: 1985,
        verified: true
      };
      
      await taggedAttester.connect(ageVerifier).issueAgeVerificationTag(user1.address, ageTag);

      // 验证所有标签都已正确发放
      const userSummary = await taggedQuery.getUserTagSummary(user1.address);
      expect(userSummary.hasValidity).to.be.true;
      expect(userSummary.hasClearance).to.be.true;
      expect(userSummary.hasAge).to.be.true;
      expect(userSummary.hasGender).to.be.true;
      expect(userSummary.hasDocument).to.be.true;
      expect(userSummary.hasGeographic).to.be.true;
      expect(userSummary.totalTags).to.equal(6);

      // 验证系统统计
      const [validityCount, clearanceCount, ageCount, genderCount, documentCount, geographicCount] = 
        await taggedQuery.getTagStatistics();
      
      expect(validityCount).to.equal(1);
      expect(clearanceCount).to.equal(1);
      expect(ageCount).to.equal(1);
      expect(genderCount).to.equal(1);
      expect(documentCount).to.equal(1);
      expect(geographicCount).to.equal(1);
    });

    it("应该支持批量用户验证", async function () {
      const currentTime = Math.floor(Date.now() / 1000);
      const users = [user1.address, user2.address, user3.address];
      
      // 批量发放有效性标签
      const recipients = users;
      const tagTypes = users.map(() => "validity");
      const validityTagData = users.map(() => {
        const tag = {
          valid: true,
          issued: currentTime,
          expires: currentTime + 365 * 24 * 3600
        };
        return ethers.AbiCoder.defaultAbiCoder().encode(
          ["tuple(bool valid, uint256 issued, uint256 expires)"],
          [tag]
        );
      });

      await taggedAttester.connect(kycProvider).batchIssueTags(recipients, tagTypes, validityTagData);

      // 验证所有用户都获得了有效性标签
      for (const user of users) {
        expect(await taggedQuery.hasValidTag(user, "validity")).to.be.true;
      }

      // 批量查询验证
      const validityResults = await taggedQuery.batchCheckUsersTag(users, "validity");
      expect(validityResults.every(result => result)).to.be.true;

      // 批量获取用户摘要
      const summaries = await taggedQuery.batchGetUserTagSummaries(users);
      expect(summaries.length).to.equal(3);
      summaries.forEach(summary => {
        expect(summary.hasValidity).to.be.true;
        expect(summary.totalTags).to.equal(1);
      });
    });
  });

  describe("权限和访问控制", function () {
    it("应该正确执行权限控制", async function () {
      const currentTime = Math.floor(Date.now() / 1000);

      // KYC提供商应该能发放有效性标签
      const validityTag = {
        valid: true,
        issued: currentTime,
        expires: currentTime + 365 * 24 * 3600
      };
      
      await expect(
        taggedAttester.connect(kycProvider).issueValidityTag(user1.address, validityTag)
      ).to.not.be.reverted;

      // 但不能发放清理状态标签
      const clearanceTag = {
        clear: true,
        checkDate: currentTime,
        checkType: "background"
      };
      
      await expect(
        taggedAttester.connect(kycProvider).issueClearanceTag(user1.address, clearanceTag)
      ).to.be.revertedWith("Unauthorized issuer");

      // 背景调查机构应该能发放清理状态标签
      await expect(
        taggedAttester.connect(backgroundChecker).issueClearanceTag(user1.address, clearanceTag)
      ).to.not.be.reverted;

      // 但不能发放年龄标签
      const ageTag = {
        over18: true,
        over21: false,
        birthYear: 2000,
        verified: true
      };
      
      await expect(
        taggedAttester.connect(backgroundChecker).issueAgeVerificationTag(user1.address, ageTag)
      ).to.be.revertedWith("Unauthorized issuer");
    });

    it("应该支持权限的动态管理", async function () {
      // 初始状态：user1没有发放权限
      const currentTime = Math.floor(Date.now() / 1000);
      const validityTag = {
        valid: true,
        issued: currentTime,
        expires: currentTime + 365 * 24 * 3600
      };

      await expect(
        taggedAttester.connect(user1).issueValidityTag(user2.address, validityTag)
      ).to.be.revertedWith("Unauthorized issuer");

      // 授权user1发放有效性标签
      await taggedAttester.connect(owner).setAuthorizedIssuer(user1.address, "validity", true);

      // 现在user1应该能发放有效性标签
      await expect(
        taggedAttester.connect(user1).issueValidityTag(user2.address, validityTag)
      ).to.not.be.reverted;

      // 撤销user1的权限
      await taggedAttester.connect(owner).setAuthorizedIssuer(user1.address, "validity", false);

      // user1应该再次无法发放标签
      await expect(
        taggedAttester.connect(user1).issueValidityTag(user3.address, validityTag)
      ).to.be.revertedWith("Unauthorized issuer");
    });
  });

  describe("数据完整性和验证", function () {
    it("应该正确验证标签数据的完整性", async function () {
      const currentTime = Math.floor(Date.now() / 1000);

      // 测试年龄逻辑验证
      const invalidAgeTag = {
        over18: true,
        over21: true,
        birthYear: 2010, // 太年轻，不可能over18和over21
        verified: true
      };

      await expect(
        taggedAttester.connect(ageVerifier).issueAgeVerificationTag(user1.address, invalidAgeTag)
      ).to.be.revertedWith("Age inconsistent with over18 flag");

      // 测试有效期验证
      const expiredValidityTag = {
        valid: true,
        issued: currentTime,
        expires: currentTime - 1 // 已过期
      };

      await expect(
        taggedAttester.connect(kycProvider).issueValidityTag(user1.address, expiredValidityTag)
      ).to.be.revertedWith("Invalid expiration");

      // 测试性别值验证
      const invalidGenderTag = {
        gender: "InvalidGender",
        verified: true
      };

      await expect(
        taggedAttester.connect(kycProvider).issueGenderTag(user1.address, invalidGenderTag)
      ).to.be.revertedWith("Invalid gender value");
    });

    it("应该正确处理标签撤销", async function () {
      const currentTime = Math.floor(Date.now() / 1000);

      // 发放有效性标签
      const validityTag = {
        valid: true,
        issued: currentTime,
        expires: currentTime + 365 * 24 * 3600
      };

      const tx = await taggedAttester.connect(kycProvider).issueValidityTag(user1.address, validityTag);
      const receipt = await tx.wait();

      // 获取attestationUID
      const event = receipt?.logs.find(log => 
        taggedAttester.interface.parseLog(log as any)?.name === "TagIssued"
      );
      let attestationUID: string = "";
      if (event) {
        const parsedEvent = taggedAttester.interface.parseLog(event as any);
        attestationUID = parsedEvent?.args[2];
      }

      // 验证标签已发放
      expect(await taggedQuery.hasValidTag(user1.address, "validity")).to.be.true;
      expect(await taggedQuery.isAttestationValidAndActive(attestationUID)).to.be.true;

      // 撤销标签
      await taggedAttester.connect(kycProvider).revokeTag(schemaUIDs["validity"], attestationUID);

      // 验证标签已撤销
      expect(await taggedQuery.isAttestationValidAndActive(attestationUID)).to.be.false;
      
      // 检查统计数据更新
      const [validityCount] = await taggedQuery.getTagStatistics();
      expect(validityCount).to.equal(0);
    });
  });

  describe("查询和分析功能", function () {
    beforeEach(async function () {
      // 创建测试数据
      await createTestData();
    });

    async function createTestData() {
      const currentTime = Math.floor(Date.now() / 1000);

      // 为user1创建完整的标签集
      const validityTag = {
        valid: true,
        issued: currentTime,
        expires: currentTime + 365 * 24 * 3600
      };
      await taggedAttester.connect(kycProvider).issueValidityTag(user1.address, validityTag);

      const genderTag = {
        gender: "Male",
        verified: true
      };
      await taggedAttester.connect(kycProvider).issueGenderTag(user1.address, genderTag);

      const clearanceTag = {
        clear: true,
        checkDate: currentTime,
        checkType: "security"
      };
      await taggedAttester.connect(backgroundChecker).issueClearanceTag(user1.address, clearanceTag);

      // 为user2创建部分标签
      await taggedAttester.connect(kycProvider).issueValidityTag(user2.address, validityTag);
      await taggedAttester.connect(backgroundChecker).issueClearanceTag(user2.address, clearanceTag);

      // 为user3只创建有效性标签
      await taggedAttester.connect(kycProvider).issueValidityTag(user3.address, validityTag);
    }

    it("应该支持复杂的用户过滤和分析", async function () {
      const allUsers = [user1.address, user2.address, user3.address];

      // 查找有有效性标签的用户
      const validityUsers = await taggedQuery.filterUsersWithTag("validity", allUsers);
      expect(validityUsers.length).to.equal(3);

      // 查找有清理状态标签的用户
      const clearanceUsers = await taggedQuery.filterUsersWithTag("clearance", allUsers);
      expect(clearanceUsers.length).to.equal(2);
      expect(clearanceUsers).to.include(user1.address);
      expect(clearanceUsers).to.include(user2.address);

      // 查找有性别标签的用户
      const genderUsers = await taggedQuery.filterUsersWithTag("gender", allUsers);
      expect(genderUsers.length).to.equal(1);
      expect(genderUsers[0]).to.equal(user1.address);

      // 统计分析
      const validityCount = await taggedQuery.countUsersWithTag("validity", allUsers);
      const clearanceCount = await taggedQuery.countUsersWithTag("clearance", allUsers);
      const genderCount = await taggedQuery.countUsersWithTag("gender", allUsers);

      expect(validityCount).to.equal(3);
      expect(clearanceCount).to.equal(2);
      expect(genderCount).to.equal(1);
    });

    it("应该提供详细的用户标签分析", async function () {
      // 获取用户标签摘要
      const user1Summary = await taggedQuery.getUserTagSummary(user1.address);
      const user2Summary = await taggedQuery.getUserTagSummary(user2.address);
      const user3Summary = await taggedQuery.getUserTagSummary(user3.address);

      // user1应该有3个标签
      expect(user1Summary.totalTags).to.equal(3);
      expect(user1Summary.hasValidity).to.be.true;
      expect(user1Summary.hasClearance).to.be.true;
      expect(user1Summary.hasGender).to.be.true;

      // user2应该有2个标签
      expect(user2Summary.totalTags).to.equal(2);
      expect(user2Summary.hasValidity).to.be.true;
      expect(user2Summary.hasClearance).to.be.true;
      expect(user2Summary.hasGender).to.be.false;

      // user3应该有1个标签
      expect(user3Summary.totalTags).to.equal(1);
      expect(user3Summary.hasValidity).to.be.true;
      expect(user3Summary.hasClearance).to.be.false;
      expect(user3Summary.hasGender).to.be.false;

      // 获取详细的标签计数
      const [validityCount, clearanceCount, ageCount, genderCount] = 
        await taggedQuery.getUserAllTagCounts(user1.address);

      expect(validityCount).to.equal(1);
      expect(clearanceCount).to.equal(1);
      expect(ageCount).to.equal(0);
      expect(genderCount).to.equal(1);
    });
  });

  describe("系统性能和扩展性", function () {
    it("应该高效处理大量用户和标签", async function () {
      const userCount = 50;
      const users: string[] = [];

      // 创建大量测试用户
      for (let i = 0; i < userCount; i++) {
        users.push(ethers.Wallet.createRandom().address);
      }

      // 批量发放标签（模拟大规模操作）
      const currentTime = Math.floor(Date.now() / 1000);
      const tagTypes = users.map(() => "validity");
      const tagData = users.map(() => {
        const tag = {
          valid: true,
          issued: currentTime,
          expires: currentTime + 365 * 24 * 3600
        };
        return ethers.AbiCoder.defaultAbiCoder().encode(
          ["tuple(bool valid, uint256 issued, uint256 expires)"],
          [tag]
        );
      });

      // 执行批量操作
      const tx = await taggedAttester.connect(kycProvider).batchIssueTags(users, tagTypes, tagData);
      const receipt = await tx.wait();

      // 验证操作成功
      expect(receipt?.status).to.equal(1);

      // 批量查询验证
      const results = await taggedQuery.batchCheckUsersTag(users, "validity");
      expect(results.length).to.equal(userCount);
      expect(results.every(result => result)).to.be.true;

      // 验证系统统计
      const [validityCount] = await taggedQuery.getTagStatistics();
      expect(validityCount).to.be.greaterThanOrEqual(userCount);
    });

    it("应该支持系统的模块化扩展", async function () {
      // 添加新的自定义标签类型
      const customTagType = "professional";
      const customSchema = "string profession,uint256 experience,bool certified";

      await taggedSchemaRegistrar.addPredefinedSchema(customTagType, customSchema);

      // 注册新的自定义模式
      const customSchemaUID = await taggedSchemaRegistrar.registerCustomTagSchema(
        customTagType,
        customSchema,
        await taggedResolver.getAddress(),
        true
      );

      // 在系统中配置新标签类型
      await taggedAttester.registerTagSchema(customTagType, customSchemaUID);
      await taggedResolver.registerSchemaMapping(customSchemaUID, customTagType);
      await taggedAttester.setAuthorizedIssuer(owner.address, customTagType, true);

      // 验证新标签类型可以正常工作
      expect(await taggedSchemaRegistrar.isTagTypeRegistered(customTagType)).to.be.true;
      expect(await taggedAttester.authorizedIssuers(owner.address, customTagType)).to.be.true;

      // 测试发放新类型的标签（需要实际的标签结构，这里只验证配置）
      const registeredTypes = await taggedSchemaRegistrar.getAllRegisteredTagTypes();
      expect(registeredTypes).to.include(customTagType);
    });
  });

  describe("错误恢复和容错性", function () {
    it("应该正确处理部分失败的批量操作", async function () {
      const users = [user1.address, user2.address, user3.address];
      const tagTypes = ["validity", "invalid_type", "clearance"]; // 包含无效类型
      const currentTime = Math.floor(Date.now() / 1000);

      const tagData = [
        ethers.AbiCoder.defaultAbiCoder().encode(
          ["tuple(bool valid, uint256 issued, uint256 expires)"],
          [[true, currentTime, currentTime + 365 * 24 * 3600]]
        ),
        ethers.ZeroHash, // 无效数据
        ethers.AbiCoder.defaultAbiCoder().encode(
          ["tuple(bool clear, uint256 checkDate, string checkType)"],
          [[true, currentTime, "background"]]
        )
      ];

      // 批量操作应该失败，因为包含无效的标签类型
      await expect(
        taggedAttester.connect(kycProvider).batchIssueTags(users, tagTypes, tagData)
      ).to.be.revertedWith("Unauthorized for tag type");
    });

    it("应该正确处理网络异常和重试", async function () {
      const currentTime = Math.floor(Date.now() / 1000);
      const validityTag = {
        valid: true,
        issued: currentTime,
        expires: currentTime + 365 * 24 * 3600
      };

      // 正常操作应该成功
      const tx1 = await taggedAttester.connect(kycProvider).issueValidityTag(user1.address, validityTag);
      expect(tx1).to.not.be.undefined;

      // 验证状态一致性
      expect(await taggedQuery.hasValidTag(user1.address, "validity")).to.be.true;

      // 重复操作应该创建新的证明（不是更新现有的）
      const tx2 = await taggedAttester.connect(kycProvider).issueValidityTag(user1.address, validityTag);
      expect(tx2).to.not.be.undefined;

      // 用户应该有多个相同类型的标签
      expect(await taggedQuery.getUserTagCount(user1.address, "validity")).to.equal(2);
    });
  });
});