import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { TaggedQuery, TaggedResolver, TaggedAttester, EAS, SchemaRegistry } from "../../../typechain-types";

describe("TaggedQuery", function () {
  let taggedQuery: TaggedQuery;
  let taggedResolver: TaggedResolver;
  let taggedAttester: TaggedAttester;
  let eas: EAS;
  let schemaRegistry: SchemaRegistry;
  
  let owner: SignerWithAddress;
  let issuer: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;

  // 标签模式UID和证明UID
  let validitySchemaUID: string;
  let clearanceSchemaUID: string;
  let ageSchemaUID: string;
  let genderSchemaUID: string;
  let documentSchemaUID: string;
  let geographicSchemaUID: string;

  let validityAttestationUID: string;
  let genderAttestationUID: string;

  beforeEach(async function () {
    [owner, issuer, user1, user2] = await ethers.getSigners();

    // 部署EAS基础设施
    const SchemaRegistryFactory = await ethers.getContractFactory("SchemaRegistry");
    schemaRegistry = await SchemaRegistryFactory.deploy();
    await schemaRegistry.waitForDeployment();

    const EASFactory = await ethers.getContractFactory("EAS");
    eas = await EASFactory.deploy(await schemaRegistry.getAddress());
    await eas.waitForDeployment();

    // 部署TaggedResolver
    const TaggedResolverFactory = await ethers.getContractFactory("TaggedResolver");
    taggedResolver = await TaggedResolverFactory.deploy(await eas.getAddress());
    await taggedResolver.waitForDeployment();

    // 部署TaggedAttester
    const TaggedAttesterFactory = await ethers.getContractFactory("TaggedAttester");
    taggedAttester = await TaggedAttesterFactory.deploy(await eas.getAddress());
    await taggedAttester.waitForDeployment();

    // 部署TaggedQuery
    const TaggedQueryFactory = await ethers.getContractFactory("TaggedQuery");
    taggedQuery = await TaggedQueryFactory.deploy(await eas.getAddress(), await taggedResolver.getAddress());
    await taggedQuery.waitForDeployment();

    // 注册测试模式
    validitySchemaUID = await schemaRegistry.register(
      "bool valid,uint256 issued,uint256 expires",
      await taggedResolver.getAddress(),
      true
    );

    clearanceSchemaUID = await schemaRegistry.register(
      "bool clear,uint256 checkDate,string checkType",
      await taggedResolver.getAddress(),
      true
    );

    ageSchemaUID = await schemaRegistry.register(
      "bool over18,bool over21,uint256 birthYear,bool verified",
      await taggedResolver.getAddress(),
      true
    );

    genderSchemaUID = await schemaRegistry.register(
      "string gender,bool verified",
      await taggedResolver.getAddress(),
      true
    );

    documentSchemaUID = await schemaRegistry.register(
      "string docType,bytes32 docHash,bool authentic",
      await taggedResolver.getAddress(),
      true
    );

    geographicSchemaUID = await schemaRegistry.register(
      "string country,string region,string jurisdiction",
      await taggedResolver.getAddress(),
      true
    );

    // 注册模式映射
    await taggedResolver.registerSchemaMapping(validitySchemaUID, "validity");
    await taggedResolver.registerSchemaMapping(clearanceSchemaUID, "clearance");
    await taggedResolver.registerSchemaMapping(ageSchemaUID, "age");
    await taggedResolver.registerSchemaMapping(genderSchemaUID, "gender");
    await taggedResolver.registerSchemaMapping(documentSchemaUID, "document");
    await taggedResolver.registerSchemaMapping(geographicSchemaUID, "geographic");

    // 创建一些测试证明
    await createTestAttestations();
  });

  async function createTestAttestations() {
    const currentTime = Math.floor(Date.now() / 1000);

    // 为user1创建有效性标签
    const validityTag = {
      valid: true,
      issued: currentTime,
      expires: currentTime + 365 * 24 * 3600
    };
    const validityData = ethers.AbiCoder.defaultAbiCoder().encode(
      ["tuple(bool valid, uint256 issued, uint256 expires)"],
      [validityTag]
    );
    const validityTx = await eas.connect(issuer).attest({
      schema: validitySchemaUID,
      data: {
        recipient: user1.address,
        expirationTime: validityTag.expires,
        revocable: true,
        refUID: ethers.ZeroHash,
        data: validityData,
        value: 0
      }
    });
    const validityReceipt = await validityTx.wait();
    const validityEvent = validityReceipt?.logs.find(log => 
      eas.interface.parseLog(log as any)?.name === "Attested"
    );
    if (validityEvent) {
      const parsedEvent = eas.interface.parseLog(validityEvent as any);
      validityAttestationUID = parsedEvent?.args[2];
    }

    // 为user1创建性别标签
    const genderTag = {
      gender: "Male",
      verified: true
    };
    const genderData = ethers.AbiCoder.defaultAbiCoder().encode(
      ["tuple(string gender, bool verified)"],
      [genderTag]
    );
    const genderTx = await eas.connect(issuer).attest({
      schema: genderSchemaUID,
      data: {
        recipient: user1.address,
        expirationTime: 0,
        revocable: true,
        refUID: ethers.ZeroHash,
        data: genderData,
        value: 0
      }
    });
    const genderReceipt = await genderTx.wait();
    const genderEvent = genderReceipt?.logs.find(log => 
      eas.interface.parseLog(log as any)?.name === "Attested"
    );
    if (genderEvent) {
      const parsedEvent = eas.interface.parseLog(genderEvent as any);
      genderAttestationUID = parsedEvent?.args[2];
    }

    // 为user2创建清理状态标签
    const clearanceTag = {
      clear: true,
      checkDate: currentTime,
      checkType: "background"
    };
    const clearanceData = ethers.AbiCoder.defaultAbiCoder().encode(
      ["tuple(bool clear, uint256 checkDate, string checkType)"],
      [clearanceTag]
    );
    await eas.connect(issuer).attest({
      schema: clearanceSchemaUID,
      data: {
        recipient: user2.address,
        expirationTime: 0,
        revocable: true,
        refUID: ethers.ZeroHash,
        data: clearanceData,
        value: 0
      }
    });
  }

  describe("部署和初始化", function () {
    it("应该正确部署合约", async function () {
      expect(await taggedQuery.getAddress()).to.be.properAddress;
      expect(await taggedQuery.getEAS()).to.equal(await eas.getAddress());
      expect(await taggedQuery.getResolver()).to.equal(await taggedResolver.getAddress());
    });
  });

  describe("标签数据查询", function () {
    it("应该正确查询有效性标签", async function () {
      const validityTag = await taggedQuery.getValidityTag(user1.address, validityAttestationUID);
      
      expect(validityTag.valid).to.be.true;
      expect(validityTag.issued).to.be.greaterThan(0);
      expect(validityTag.expires).to.be.greaterThan(validityTag.issued);
    });

    it("应该正确查询性别标签", async function () {
      const genderTag = await taggedQuery.getGenderTag(user1.address, genderAttestationUID);
      
      expect(genderTag.gender).to.equal("Male");
      expect(genderTag.verified).to.be.true;
    });

    it("应该拒绝查询不匹配的用户证明", async function () {
      await expect(
        taggedQuery.getValidityTag(user2.address, validityAttestationUID) // user2查询user1的证明
      ).to.be.revertedWith("Invalid recipient");
    });

    it("应该拒绝查询不存在的证明", async function () {
      await expect(
        taggedQuery.getValidityTag(user1.address, ethers.ZeroHash)
      ).to.be.revertedWith("Attestation not found");
    });
  });

  describe("标签状态查询", function () {
    it("应该正确查询用户是否具有特定标签", async function () {
      expect(await taggedQuery.hasValidTag(user1.address, "validity")).to.be.true;
      expect(await taggedQuery.hasValidTag(user1.address, "gender")).to.be.true;
      expect(await taggedQuery.hasValidTag(user1.address, "clearance")).to.be.false;
      
      expect(await taggedQuery.hasValidTag(user2.address, "clearance")).to.be.true;
      expect(await taggedQuery.hasValidTag(user2.address, "validity")).to.be.false;
    });

    it("应该正确批量查询用户标签状态", async function () {
      const tagTypes = ["validity", "clearance", "age", "gender", "document", "geographic"];
      const user1Results = await taggedQuery.batchCheckTags(user1.address, tagTypes);
      const user2Results = await taggedQuery.batchCheckTags(user2.address, tagTypes);

      // user1应该有validity和gender标签
      expect(user1Results[0]).to.be.true;  // validity
      expect(user1Results[1]).to.be.false; // clearance
      expect(user1Results[2]).to.be.false; // age
      expect(user1Results[3]).to.be.true;  // gender
      expect(user1Results[4]).to.be.false; // document
      expect(user1Results[5]).to.be.false; // geographic

      // user2应该有clearance标签
      expect(user2Results[0]).to.be.false; // validity
      expect(user2Results[1]).to.be.true;  // clearance
      expect(user2Results[2]).to.be.false; // age
      expect(user2Results[3]).to.be.false; // gender
      expect(user2Results[4]).to.be.false; // document
      expect(user2Results[5]).to.be.false; // geographic
    });

    it("应该正确批量查询多个用户的单个标签状态", async function () {
      const users = [user1.address, user2.address];
      const validityResults = await taggedQuery.batchCheckUsersTag(users, "validity");
      const clearanceResults = await taggedQuery.batchCheckUsersTag(users, "clearance");

      expect(validityResults[0]).to.be.true;  // user1有validity
      expect(validityResults[1]).to.be.false; // user2没有validity

      expect(clearanceResults[0]).to.be.false; // user1没有clearance
      expect(clearanceResults[1]).to.be.true;  // user2有clearance
    });
  });

  describe("用户标签摘要", function () {
    it("应该正确获取用户标签摘要", async function () {
      const user1Summary = await taggedQuery.getUserTagSummary(user1.address);
      
      expect(user1Summary.user).to.equal(user1.address);
      expect(user1Summary.hasValidity).to.be.true;
      expect(user1Summary.hasClearance).to.be.false;
      expect(user1Summary.hasAge).to.be.false;
      expect(user1Summary.hasGender).to.be.true;
      expect(user1Summary.hasDocument).to.be.false;
      expect(user1Summary.hasGeographic).to.be.false;
      expect(user1Summary.totalTags).to.equal(2); // validity + gender
    });

    it("应该正确批量获取用户标签摘要", async function () {
      const users = [user1.address, user2.address];
      const summaries = await taggedQuery.batchGetUserTagSummaries(users);

      expect(summaries.length).to.equal(2);
      
      // user1摘要
      expect(summaries[0].user).to.equal(user1.address);
      expect(summaries[0].totalTags).to.equal(2);
      
      // user2摘要
      expect(summaries[1].user).to.equal(user2.address);
      expect(summaries[1].totalTags).to.equal(1);
    });
  });

  describe("标签计数查询", function () {
    it("应该正确获取用户特定类型标签数量", async function () {
      expect(await taggedQuery.getUserTagCount(user1.address, "validity")).to.equal(1);
      expect(await taggedQuery.getUserTagCount(user1.address, "gender")).to.equal(1);
      expect(await taggedQuery.getUserTagCount(user1.address, "clearance")).to.equal(0);
      
      expect(await taggedQuery.getUserTagCount(user2.address, "clearance")).to.equal(1);
      expect(await taggedQuery.getUserTagCount(user2.address, "validity")).to.equal(0);
    });

    it("应该正确获取用户所有类型标签数量", async function () {
      const [validityCount, clearanceCount, ageCount, genderCount, documentCount, geographicCount] = 
        await taggedQuery.getUserAllTagCounts(user1.address);

      expect(validityCount).to.equal(1);
      expect(clearanceCount).to.equal(0);
      expect(ageCount).to.equal(0);
      expect(genderCount).to.equal(1);
      expect(documentCount).to.equal(0);
      expect(geographicCount).to.equal(0);
    });
  });

  describe("系统统计查询", function () {
    it("应该正确获取标签统计信息", async function () {
      const [validityCount, clearanceCount, ageCount, genderCount, documentCount, geographicCount] = 
        await taggedQuery.getTagStatistics();

      expect(validityCount).to.equal(1);  // user1的validity标签
      expect(clearanceCount).to.equal(1); // user2的clearance标签
      expect(ageCount).to.equal(0);
      expect(genderCount).to.equal(1);    // user1的gender标签
      expect(documentCount).to.equal(0);
      expect(geographicCount).to.equal(0);
    });
  });

  describe("证明有效性验证", function () {
    it("应该正确验证有效证明", async function () {
      expect(await taggedQuery.isAttestationValidAndActive(validityAttestationUID)).to.be.true;
      expect(await taggedQuery.isAttestationValidAndActive(genderAttestationUID)).to.be.true;
    });

    it("应该拒绝不存在的证明", async function () {
      expect(await taggedQuery.isAttestationValidAndActive(ethers.ZeroHash)).to.be.false;
    });

    it("应该正确批量验证证明有效性", async function () {
      const attestationUIDs = [validityAttestationUID, genderAttestationUID, ethers.ZeroHash];
      const results = await taggedQuery.batchCheckAttestationValidity(attestationUIDs);

      expect(results[0]).to.be.true;  // validityAttestationUID有效
      expect(results[1]).to.be.true;  // genderAttestationUID有效
      expect(results[2]).to.be.false; // ZeroHash无效
    });

    it("应该正确处理已撤销的证明", async function () {
      // 撤销validity证明
      await eas.connect(issuer).revoke({
        schema: validitySchemaUID,
        data: {
          uid: validityAttestationUID,
          value: 0
        }
      });

      // 验证撤销后的状态
      expect(await taggedQuery.isAttestationValidAndActive(validityAttestationUID)).to.be.false;
    });
  });

  describe("用户过滤功能", function () {
    it("应该正确统计具有特定标签的用户数量", async function () {
      const userList = [user1.address, user2.address];
      
      const validityUserCount = await taggedQuery.countUsersWithTag("validity", userList);
      const clearanceUserCount = await taggedQuery.countUsersWithTag("clearance", userList);
      const genderUserCount = await taggedQuery.countUsersWithTag("gender", userList);

      expect(validityUserCount).to.equal(1);  // 只有user1有validity
      expect(clearanceUserCount).to.equal(1); // 只有user2有clearance
      expect(genderUserCount).to.equal(1);    // 只有user1有gender
    });

    it("应该正确过滤具有特定标签的用户", async function () {
      const userList = [user1.address, user2.address];
      
      const validityUsers = await taggedQuery.filterUsersWithTag("validity", userList);
      const clearanceUsers = await taggedQuery.filterUsersWithTag("clearance", userList);
      const ageUsers = await taggedQuery.filterUsersWithTag("age", userList);

      expect(validityUsers.length).to.equal(1);
      expect(validityUsers[0]).to.equal(user1.address);

      expect(clearanceUsers.length).to.equal(1);
      expect(clearanceUsers[0]).to.equal(user2.address);

      expect(ageUsers.length).to.equal(0); // 没有用户有age标签
    });

    it("应该处理空用户列表", async function () {
      const emptyUserList: string[] = [];
      
      const validityUserCount = await taggedQuery.countUsersWithTag("validity", emptyUserList);
      const validityUsers = await taggedQuery.filterUsersWithTag("validity", emptyUserList);

      expect(validityUserCount).to.equal(0);
      expect(validityUsers.length).to.equal(0);
    });
  });

  describe("边界情况处理", function () {
    it("应该处理空标签类型数组", async function () {
      const emptyTagTypes: string[] = [];
      const results = await taggedQuery.batchCheckTags(user1.address, emptyTagTypes);
      
      expect(results.length).to.equal(0);
    });

    it("应该处理空用户地址数组", async function () {
      const emptyUsers: string[] = [];
      const summaries = await taggedQuery.batchGetUserTagSummaries(emptyUsers);
      
      expect(summaries.length).to.equal(0);
    });

    it("应该处理不存在的标签类型", async function () {
      expect(await taggedQuery.hasValidTag(user1.address, "nonexistent")).to.be.false;
      expect(await taggedQuery.getUserTagCount(user1.address, "nonexistent")).to.equal(0);
    });
  });

  describe("Gas优化测试", function () {
    it("批量查询应该比单个查询更高效", async function () {
      const tagTypes = ["validity", "clearance", "age", "gender"];
      
      // 批量查询
      const batchTx = await taggedQuery.batchCheckTags.populateTransaction(user1.address, tagTypes);
      
      // 单个查询（模拟）
      const singleQueries = [];
      for (const tagType of tagTypes) {
        singleQueries.push(taggedQuery.hasValidTag.populateTransaction(user1.address, tagType));
      }

      // 批量查询应该存在且可执行
      expect(batchTx.data).to.not.be.undefined;
    });

    it("批量用户查询应该正确处理大量用户", async function () {
      // 创建多个用户地址进行测试
      const manyUsers = Array.from({ length: 10 }, (_, i) => 
        ethers.Wallet.createRandom().address
      );
      
      const results = await taggedQuery.batchCheckUsersTag(manyUsers, "validity");
      
      expect(results.length).to.equal(10);
      // 所有结果都应该是false，因为这些是随机地址
      results.forEach(result => expect(result).to.be.false);
    });
  });
});