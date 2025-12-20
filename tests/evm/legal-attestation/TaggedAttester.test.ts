import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { TaggedAttester, TaggedResolver, TaggedSchemaRegistrar, EAS, SchemaRegistry } from "../../../typechain-types";

describe("TaggedAttester", function () {
  let taggedAttester: TaggedAttester;
  let taggedResolver: TaggedResolver;
  let schemaRegistrar: TaggedSchemaRegistrar;
  let eas: EAS;
  let schemaRegistry: SchemaRegistry;
  
  let owner: SignerWithAddress;
  let issuer: SignerWithAddress;
  let user: SignerWithAddress;
  let unauthorized: SignerWithAddress;

  // 标签模式UID
  let validitySchemaUID: string;
  let clearanceSchemaUID: string;
  let ageSchemaUID: string;
  let genderSchemaUID: string;
  let documentSchemaUID: string;
  let geographicSchemaUID: string;

  beforeEach(async function () {
    [owner, issuer, user, unauthorized] = await ethers.getSigners();

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

    // 部署TaggedSchemaRegistrar
    const TaggedSchemaRegistrarFactory = await ethers.getContractFactory("TaggedSchemaRegistrar");
    schemaRegistrar = await TaggedSchemaRegistrarFactory.deploy(await schemaRegistry.getAddress());
    await schemaRegistrar.waitForDeployment();

    // 部署TaggedAttester
    const TaggedAttesterFactory = await ethers.getContractFactory("TaggedAttester");
    taggedAttester = await TaggedAttesterFactory.deploy(await eas.getAddress());
    await taggedAttester.waitForDeployment();

    // 注册所有标签模式
    const schemaUIDs = await schemaRegistrar.batchRegisterAllPredefinedSchemas(
      await taggedResolver.getAddress(),
      true // revocable
    );

    // 获取模式UID
    validitySchemaUID = await schemaRegistrar.getTagSchemaUID("validity");
    clearanceSchemaUID = await schemaRegistrar.getTagSchemaUID("clearance");
    ageSchemaUID = await schemaRegistrar.getTagSchemaUID("age");
    genderSchemaUID = await schemaRegistrar.getTagSchemaUID("gender");
    documentSchemaUID = await schemaRegistrar.getTagSchemaUID("document");
    geographicSchemaUID = await schemaRegistrar.getTagSchemaUID("geographic");

    // 在TaggedAttester中注册模式
    await taggedAttester.registerTagSchema("validity", validitySchemaUID);
    await taggedAttester.registerTagSchema("clearance", clearanceSchemaUID);
    await taggedAttester.registerTagSchema("age", ageSchemaUID);
    await taggedAttester.registerTagSchema("gender", genderSchemaUID);
    await taggedAttester.registerTagSchema("document", documentSchemaUID);
    await taggedAttester.registerTagSchema("geographic", geographicSchemaUID);

    // 在TaggedResolver中注册模式映射
    await taggedResolver.registerSchemaMapping(validitySchemaUID, "validity");
    await taggedResolver.registerSchemaMapping(clearanceSchemaUID, "clearance");
    await taggedResolver.registerSchemaMapping(ageSchemaUID, "age");
    await taggedResolver.registerSchemaMapping(genderSchemaUID, "gender");
    await taggedResolver.registerSchemaMapping(documentSchemaUID, "document");
    await taggedResolver.registerSchemaMapping(geographicSchemaUID, "geographic");

    // 设置发放权限
    await taggedAttester.setAuthorizedIssuer(issuer.address, "validity", true);
    await taggedAttester.setAuthorizedIssuer(issuer.address, "clearance", true);
    await taggedAttester.setAuthorizedIssuer(issuer.address, "age", true);
    await taggedAttester.setAuthorizedIssuer(issuer.address, "gender", true);
    await taggedAttester.setAuthorizedIssuer(issuer.address, "document", true);
    await taggedAttester.setAuthorizedIssuer(issuer.address, "geographic", true);
  });

  describe("部署和初始化", function () {
    it("应该正确部署合约", async function () {
      expect(await taggedAttester.getAddress()).to.be.properAddress;
      expect(await taggedAttester.owner()).to.equal(owner.address);
      expect(await taggedAttester.getEAS()).to.equal(await eas.getAddress());
    });

    it("应该正确设置授权发放者", async function () {
      expect(await taggedAttester.authorizedIssuers(issuer.address, "validity")).to.be.true;
      expect(await taggedAttester.authorizedIssuers(unauthorized.address, "validity")).to.be.false;
    });

    it("应该正确注册标签模式", async function () {
      expect(await taggedAttester.tagSchemas("validity")).to.equal(validitySchemaUID);
      expect(await taggedAttester.tagSchemas("clearance")).to.equal(clearanceSchemaUID);
    });
  });

  describe("有效性标签 (Validity Tag)", function () {
    it("应该成功发放有效性标签", async function () {
      const currentTime = Math.floor(Date.now() / 1000);
      const validityTag = {
        valid: true,
        issued: currentTime,
        expires: currentTime + 365 * 24 * 3600 // 1年后过期
      };

      const tx = await taggedAttester.connect(issuer).issueValidityTag(user.address, validityTag);
      const receipt = await tx.wait();

      // 检查事件
      expect(tx).to.emit(taggedAttester, "TagIssued")
        .withArgs(user.address, "validity", receipt?.logs[0], issuer.address);
    });

    it("应该拒绝过期的有效性标签", async function () {
      const currentTime = Math.floor(Date.now() / 1000);
      const validityTag = {
        valid: true,
        issued: currentTime,
        expires: currentTime - 1 // 已过期
      };

      await expect(
        taggedAttester.connect(issuer).issueValidityTag(user.address, validityTag)
      ).to.be.revertedWith("Invalid expiration");
    });

    it("应该拒绝未授权用户发放标签", async function () {
      const currentTime = Math.floor(Date.now() / 1000);
      const validityTag = {
        valid: true,
        issued: currentTime,
        expires: currentTime + 365 * 24 * 3600
      };

      await expect(
        taggedAttester.connect(unauthorized).issueValidityTag(user.address, validityTag)
      ).to.be.revertedWith("Unauthorized issuer");
    });
  });

  describe("清理状态标签 (Clearance Tag)", function () {
    it("应该成功发放清理状态标签", async function () {
      const currentTime = Math.floor(Date.now() / 1000);
      const clearanceTag = {
        clear: true,
        checkDate: currentTime,
        checkType: "background"
      };

      const tx = await taggedAttester.connect(issuer).issueClearanceTag(user.address, clearanceTag);
      
      expect(tx).to.emit(taggedAttester, "TagIssued")
        .withArgs(user.address, "clearance", ethers.AnyValue, issuer.address);
    });

    it("应该拒绝未来的检查日期", async function () {
      const futureTime = Math.floor(Date.now() / 1000) + 3600; // 1小时后
      const clearanceTag = {
        clear: true,
        checkDate: futureTime,
        checkType: "background"
      };

      await expect(
        taggedAttester.connect(issuer).issueClearanceTag(user.address, clearanceTag)
      ).to.be.revertedWith("Invalid check date");
    });
  });

  describe("年龄验证标签 (Age Verification Tag)", function () {
    it("应该成功发放年龄验证标签", async function () {
      const ageTag = {
        over18: true,
        over21: true,
        birthYear: 1990,
        verified: true
      };

      const tx = await taggedAttester.connect(issuer).issueAgeVerificationTag(user.address, ageTag);
      
      expect(tx).to.emit(taggedAttester, "TagIssued")
        .withArgs(user.address, "age", ethers.AnyValue, issuer.address);
    });

    it("应该验证年龄逻辑一致性", async function () {
      const currentYear = Math.floor(Date.now() / (1000 * 365 * 24 * 3600)) + 1970;
      const ageTag = {
        over18: true,
        over21: false,
        birthYear: currentYear - 10, // 10岁，但声称over18
        verified: true
      };

      await expect(
        taggedAttester.connect(issuer).issueAgeVerificationTag(user.address, ageTag)
      ).to.be.revertedWith("Age inconsistent with over18 flag");
    });
  });

  describe("性别标签 (Gender Tag)", function () {
    it("应该成功发放有效的性别标签", async function () {
      const genderTag = {
        gender: "Male",
        verified: true
      };

      const tx = await taggedAttester.connect(issuer).issueGenderTag(user.address, genderTag);
      
      expect(tx).to.emit(taggedAttester, "TagIssued")
        .withArgs(user.address, "gender", ethers.AnyValue, issuer.address);
    });

    it("应该拒绝无效的性别值", async function () {
      const genderTag = {
        gender: "Invalid",
        verified: true
      };

      await expect(
        taggedAttester.connect(issuer).issueGenderTag(user.address, genderTag)
      ).to.be.revertedWith("Invalid gender value");
    });

    it("应该接受所有有效的性别值", async function () {
      const validGenders = ["Male", "Female", "Other"];
      
      for (const gender of validGenders) {
        const genderTag = {
          gender: gender,
          verified: true
        };

        await expect(
          taggedAttester.connect(issuer).issueGenderTag(user.address, genderTag)
        ).to.not.be.reverted;
      }
    });
  });

  describe("文档类型标签 (Document Type Tag)", function () {
    it("应该成功发放文档类型标签", async function () {
      const documentTag = {
        docType: "ID",
        docHash: ethers.keccak256(ethers.toUtf8Bytes("document_content")),
        authentic: true
      };

      const tx = await taggedAttester.connect(issuer).issueDocumentTypeTag(user.address, documentTag);
      
      expect(tx).to.emit(taggedAttester, "TagIssued")
        .withArgs(user.address, "document", ethers.AnyValue, issuer.address);
    });

    it("应该拒绝空的文档哈希", async function () {
      const documentTag = {
        docType: "ID",
        docHash: ethers.ZeroHash,
        authentic: true
      };

      await expect(
        taggedAttester.connect(issuer).issueDocumentTypeTag(user.address, documentTag)
      ).to.be.revertedWith("Invalid document hash");
    });

    it("应该拒绝空的文档类型", async function () {
      const documentTag = {
        docType: "",
        docHash: ethers.keccak256(ethers.toUtf8Bytes("document_content")),
        authentic: true
      };

      await expect(
        taggedAttester.connect(issuer).issueDocumentTypeTag(user.address, documentTag)
      ).to.be.revertedWith("Invalid document type");
    });
  });

  describe("地理位置标签 (Geographic Tag)", function () {
    it("应该成功发放地理位置标签", async function () {
      const geographicTag = {
        country: "PALAU",
        region: "Pacific",
        jurisdiction: "Palau Courts"
      };

      const tx = await taggedAttester.connect(issuer).issueGeographicTag(user.address, geographicTag);
      
      expect(tx).to.emit(taggedAttester, "TagIssued")
        .withArgs(user.address, "geographic", ethers.AnyValue, issuer.address);
    });

    it("应该拒绝空的国家代码", async function () {
      const geographicTag = {
        country: "",
        region: "Pacific",
        jurisdiction: "Palau Courts"
      };

      await expect(
        taggedAttester.connect(issuer).issueGeographicTag(user.address, geographicTag)
      ).to.be.revertedWith("Invalid country");
    });
  });

  describe("批量操作", function () {
    it("应该成功批量发放标签", async function () {
      const recipients = [user.address, unauthorized.address];
      const tagTypes = ["validity", "clearance"];
      
      const currentTime = Math.floor(Date.now() / 1000);
      const validityTagData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["tuple(bool valid, uint256 issued, uint256 expires)"],
        [[true, currentTime, currentTime + 365 * 24 * 3600]]
      );
      
      const clearanceTagData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["tuple(bool clear, uint256 checkDate, string checkType)"],
        [[true, currentTime, "background"]]
      );
      
      const tagData = [validityTagData, clearanceTagData];

      const tx = await taggedAttester.connect(issuer).batchIssueTags(recipients, tagTypes, tagData);
      
      expect(tx).to.emit(taggedAttester, "TagIssued");
    });

    it("应该拒绝长度不匹配的批量操作", async function () {
      const recipients = [user.address];
      const tagTypes = ["validity", "clearance"]; // 长度不匹配
      const tagData = [ethers.ZeroHash];

      await expect(
        taggedAttester.connect(issuer).batchIssueTags(recipients, tagTypes, tagData)
      ).to.be.revertedWithCustomError(taggedAttester, "InvalidInput");
    });
  });

  describe("标签撤销", function () {
    let attestationUID: string;

    beforeEach(async function () {
      const currentTime = Math.floor(Date.now() / 1000);
      const validityTag = {
        valid: true,
        issued: currentTime,
        expires: currentTime + 365 * 24 * 3600
      };

      const tx = await taggedAttester.connect(issuer).issueValidityTag(user.address, validityTag);
      const receipt = await tx.wait();
      
      // 从事件中获取attestationUID
      const event = receipt?.logs.find(log => 
        taggedAttester.interface.parseLog(log as any)?.name === "TagIssued"
      );
      if (event) {
        const parsedEvent = taggedAttester.interface.parseLog(event as any);
        attestationUID = parsedEvent?.args[2];
      }
    });

    it("应该成功撤销标签", async function () {
      await expect(
        taggedAttester.connect(issuer).revokeTag(validitySchemaUID, attestationUID)
      ).to.not.be.reverted;
    });
  });

  describe("权限管理", function () {
    it("只有所有者可以设置授权发放者", async function () {
      await expect(
        taggedAttester.connect(unauthorized).setAuthorizedIssuer(user.address, "validity", true)
      ).to.be.revertedWith("Only owner");
    });

    it("只有所有者可以注册标签模式", async function () {
      await expect(
        taggedAttester.connect(unauthorized).registerTagSchema("test", ethers.ZeroHash)
      ).to.be.revertedWith("Only owner");
    });

    it("应该成功转移所有权", async function () {
      await taggedAttester.connect(owner).transferOwnership(issuer.address);
      expect(await taggedAttester.owner()).to.equal(issuer.address);
    });

    it("应该拒绝转移给零地址", async function () {
      await expect(
        taggedAttester.connect(owner).transferOwnership(ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid new owner");
    });
  });
});