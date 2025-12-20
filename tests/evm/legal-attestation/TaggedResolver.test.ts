import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { TaggedResolver, EAS, SchemaRegistry } from "../../../typechain-types";

describe("TaggedResolver", function () {
  let taggedResolver: TaggedResolver;
  let eas: EAS;
  let schemaRegistry: SchemaRegistry;
  
  let owner: SignerWithAddress;
  let attester: SignerWithAddress;
  let user: SignerWithAddress;

  // 测试用的模式UID
  let validitySchemaUID: string;
  let clearanceSchemaUID: string;
  let ageSchemaUID: string;
  let genderSchemaUID: string;
  let documentSchemaUID: string;
  let geographicSchemaUID: string;

  beforeEach(async function () {
    [owner, attester, user] = await ethers.getSigners();

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
  });

  describe("部署和初始化", function () {
    it("应该正确部署合约", async function () {
      expect(await taggedResolver.getAddress()).to.be.properAddress;
      expect(await taggedResolver.owner()).to.equal(owner.address);
    });

    it("应该正确注册模式映射", async function () {
      expect(await taggedResolver.schemaToTagType(validitySchemaUID)).to.equal("validity");
      expect(await taggedResolver.schemaToTagType(clearanceSchemaUID)).to.equal("clearance");
    });
  });

  describe("有效性标签处理", function () {
    it("应该成功处理有效的有效性标签", async function () {
      const currentTime = Math.floor(Date.now() / 1000);
      const validityTag = {
        valid: true,
        issued: currentTime,
        expires: currentTime + 365 * 24 * 3600
      };

      const attestationData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["tuple(bool valid, uint256 issued, uint256 expires)"],
        [validityTag]
      );

      const tx = await eas.connect(attester).attest({
        schema: validitySchemaUID,
        data: {
          recipient: user.address,
          expirationTime: validityTag.expires,
          revocable: true,
          refUID: ethers.ZeroHash,
          data: attestationData,
          value: 0
        }
      });

      await expect(tx).to.emit(taggedResolver, "ValidityTagProcessed")
        .withArgs(user.address, validityTag.valid, validityTag.expires, ethers.AnyValue);

      // 检查用户标签状态
      expect(await taggedResolver.userTags(user.address, "validity")).to.be.true;
      expect(await taggedResolver.tagCounts("validity")).to.equal(1);
    });

    it("应该拒绝已过期的有效性标签", async function () {
      const currentTime = Math.floor(Date.now() / 1000);
      const validityTag = {
        valid: true,
        issued: currentTime,
        expires: currentTime - 1 // 已过期
      };

      const attestationData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["tuple(bool valid, uint256 issued, uint256 expires)"],
        [validityTag]
      );

      await expect(
        eas.connect(attester).attest({
          schema: validitySchemaUID,
          data: {
            recipient: user.address,
            expirationTime: validityTag.expires,
            revocable: true,
            refUID: ethers.ZeroHash,
            data: attestationData,
            value: 0
          }
        })
      ).to.be.reverted; // 解析器会拒绝
    });

    it("应该拒绝未来的发放时间", async function () {
      const currentTime = Math.floor(Date.now() / 1000);
      const validityTag = {
        valid: true,
        issued: currentTime + 3600, // 未来时间
        expires: currentTime + 365 * 24 * 3600
      };

      const attestationData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["tuple(bool valid, uint256 issued, uint256 expires)"],
        [validityTag]
      );

      await expect(
        eas.connect(attester).attest({
          schema: validitySchemaUID,
          data: {
            recipient: user.address,
            expirationTime: validityTag.expires,
            revocable: true,
            refUID: ethers.ZeroHash,
            data: attestationData,
            value: 0
          }
        })
      ).to.be.reverted;
    });
  });

  describe("清理状态标签处理", function () {
    it("应该成功处理有效的清理状态标签", async function () {
      const currentTime = Math.floor(Date.now() / 1000);
      const clearanceTag = {
        clear: true,
        checkDate: currentTime,
        checkType: "background"
      };

      const attestationData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["tuple(bool clear, uint256 checkDate, string checkType)"],
        [clearanceTag]
      );

      const tx = await eas.connect(attester).attest({
        schema: clearanceSchemaUID,
        data: {
          recipient: user.address,
          expirationTime: 0, // 无过期时间
          revocable: true,
          refUID: ethers.ZeroHash,
          data: attestationData,
          value: 0
        }
      });

      await expect(tx).to.emit(taggedResolver, "ClearanceTagProcessed")
        .withArgs(user.address, clearanceTag.clear, clearanceTag.checkDate, ethers.AnyValue);

      expect(await taggedResolver.userTags(user.address, "clearance")).to.be.true;
    });

    it("应该验证检查类型的有效性", async function () {
      const currentTime = Math.floor(Date.now() / 1000);
      const clearanceTag = {
        clear: true,
        checkDate: currentTime,
        checkType: "invalid_type" // 无效类型
      };

      const attestationData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["tuple(bool clear, uint256 checkDate, string checkType)"],
        [clearanceTag]
      );

      await expect(
        eas.connect(attester).attest({
          schema: clearanceSchemaUID,
          data: {
            recipient: user.address,
            expirationTime: 0,
            revocable: true,
            refUID: ethers.ZeroHash,
            data: attestationData,
            value: 0
          }
        })
      ).to.be.reverted;
    });

    it("应该接受所有有效的检查类型", async function () {
      const validCheckTypes = ["background", "security", "compliance"];
      const currentTime = Math.floor(Date.now() / 1000);

      for (const checkType of validCheckTypes) {
        const clearanceTag = {
          clear: true,
          checkDate: currentTime,
          checkType: checkType
        };

        const attestationData = ethers.AbiCoder.defaultAbiCoder().encode(
          ["tuple(bool clear, uint256 checkDate, string checkType)"],
          [clearanceTag]
        );

        await expect(
          eas.connect(attester).attest({
            schema: clearanceSchemaUID,
            data: {
              recipient: user.address,
              expirationTime: 0,
              revocable: true,
              refUID: ethers.ZeroHash,
              data: attestationData,
              value: 0
            }
          })
        ).to.not.be.reverted;
      }
    });
  });

  describe("年龄验证标签处理", function () {
    it("应该成功处理有效的年龄验证标签", async function () {
      const ageTag = {
        over18: true,
        over21: true,
        birthYear: 1990,
        verified: true
      };

      const attestationData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["tuple(bool over18, bool over21, uint256 birthYear, bool verified)"],
        [ageTag]
      );

      const tx = await eas.connect(attester).attest({
        schema: ageSchemaUID,
        data: {
          recipient: user.address,
          expirationTime: 0,
          revocable: false,
          refUID: ethers.ZeroHash,
          data: attestationData,
          value: 0
        }
      });

      await expect(tx).to.emit(taggedResolver, "AgeTagProcessed")
        .withArgs(user.address, ageTag.over18, ageTag.over21, ethers.AnyValue);

      expect(await taggedResolver.userTags(user.address, "age")).to.be.true;
    });

    it("应该验证年龄逻辑一致性", async function () {
      const currentYear = Math.floor(Date.now() / (1000 * 365 * 24 * 3600)) + 1970;
      const ageTag = {
        over18: true,
        over21: false,
        birthYear: currentYear - 10, // 10岁但声称over18
        verified: true
      };

      const attestationData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["tuple(bool over18, bool over21, uint256 birthYear, bool verified)"],
        [ageTag]
      );

      await expect(
        eas.connect(attester).attest({
          schema: ageSchemaUID,
          data: {
            recipient: user.address,
            expirationTime: 0,
            revocable: false,
            refUID: ethers.ZeroHash,
            data: attestationData,
            value: 0
          }
        })
      ).to.be.reverted;
    });

    it("应该拒绝不合理的出生年份", async function () {
      const ageTag = {
        over18: false,
        over21: false,
        birthYear: 1800, // 太久远
        verified: true
      };

      const attestationData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["tuple(bool over18, bool over21, uint256 birthYear, bool verified)"],
        [ageTag]
      );

      await expect(
        eas.connect(attester).attest({
          schema: ageSchemaUID,
          data: {
            recipient: user.address,
            expirationTime: 0,
            revocable: false,
            refUID: ethers.ZeroHash,
            data: attestationData,
            value: 0
          }
        })
      ).to.be.reverted;
    });
  });

  describe("性别标签处理", function () {
    it("应该成功处理有效的性别标签", async function () {
      const genderTag = {
        gender: "Male",
        verified: true
      };

      const attestationData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["tuple(string gender, bool verified)"],
        [genderTag]
      );

      const tx = await eas.connect(attester).attest({
        schema: genderSchemaUID,
        data: {
          recipient: user.address,
          expirationTime: 0,
          revocable: true,
          refUID: ethers.ZeroHash,
          data: attestationData,
          value: 0
        }
      });

      await expect(tx).to.emit(taggedResolver, "GenderTagProcessed")
        .withArgs(user.address, genderTag.gender, ethers.AnyValue);

      expect(await taggedResolver.userTags(user.address, "gender")).to.be.true;
    });

    it("应该拒绝无效的性别值", async function () {
      const genderTag = {
        gender: "Invalid",
        verified: true
      };

      const attestationData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["tuple(string gender, bool verified)"],
        [genderTag]
      );

      await expect(
        eas.connect(attester).attest({
          schema: genderSchemaUID,
          data: {
            recipient: user.address,
            expirationTime: 0,
            revocable: true,
            refUID: ethers.ZeroHash,
            data: attestationData,
            value: 0
          }
        })
      ).to.be.reverted;
    });
  });

  describe("文档类型标签处理", function () {
    it("应该成功处理有效的文档类型标签", async function () {
      const documentTag = {
        docType: "ID",
        docHash: ethers.keccak256(ethers.toUtf8Bytes("document_content")),
        authentic: true
      };

      const attestationData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["tuple(string docType, bytes32 docHash, bool authentic)"],
        [documentTag]
      );

      const tx = await eas.connect(attester).attest({
        schema: documentSchemaUID,
        data: {
          recipient: user.address,
          expirationTime: 0,
          revocable: true,
          refUID: ethers.ZeroHash,
          data: attestationData,
          value: 0
        }
      });

      await expect(tx).to.emit(taggedResolver, "DocumentTagProcessed")
        .withArgs(user.address, documentTag.docType, documentTag.docHash, ethers.AnyValue);

      expect(await taggedResolver.userTags(user.address, "document")).to.be.true;
    });

    it("应该拒绝空的文档哈希", async function () {
      const documentTag = {
        docType: "ID",
        docHash: ethers.ZeroHash,
        authentic: true
      };

      const attestationData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["tuple(string docType, bytes32 docHash, bool authentic)"],
        [documentTag]
      );

      await expect(
        eas.connect(attester).attest({
          schema: documentSchemaUID,
          data: {
            recipient: user.address,
            expirationTime: 0,
            revocable: true,
            refUID: ethers.ZeroHash,
            data: attestationData,
            value: 0
          }
        })
      ).to.be.reverted;
    });

    it("应该验证文档类型的有效性", async function () {
      const validDocTypes = ["ID", "Passport", "License", "Certificate"];

      for (const docType of validDocTypes) {
        const documentTag = {
          docType: docType,
          docHash: ethers.keccak256(ethers.toUtf8Bytes("document_content")),
          authentic: true
        };

        const attestationData = ethers.AbiCoder.defaultAbiCoder().encode(
          ["tuple(string docType, bytes32 docHash, bool authentic)"],
          [documentTag]
        );

        await expect(
          eas.connect(attester).attest({
            schema: documentSchemaUID,
            data: {
              recipient: user.address,
              expirationTime: 0,
              revocable: true,
              refUID: ethers.ZeroHash,
              data: attestationData,
              value: 0
            }
          })
        ).to.not.be.reverted;
      }
    });
  });

  describe("地理位置标签处理", function () {
    it("应该成功处理有效的地理位置标签", async function () {
      const geographicTag = {
        country: "PALAU",
        region: "Pacific",
        jurisdiction: "Palau Courts"
      };

      const attestationData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["tuple(string country, string region, string jurisdiction)"],
        [geographicTag]
      );

      const tx = await eas.connect(attester).attest({
        schema: geographicSchemaUID,
        data: {
          recipient: user.address,
          expirationTime: 0,
          revocable: true,
          refUID: ethers.ZeroHash,
          data: attestationData,
          value: 0
        }
      });

      await expect(tx).to.emit(taggedResolver, "GeographicTagProcessed")
        .withArgs(user.address, geographicTag.country, ethers.AnyValue);

      expect(await taggedResolver.userTags(user.address, "geographic")).to.be.true;
    });

    it("应该拒绝空的国家代码", async function () {
      const geographicTag = {
        country: "",
        region: "Pacific",
        jurisdiction: "Palau Courts"
      };

      const attestationData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["tuple(string country, string region, string jurisdiction)"],
        [geographicTag]
      );

      await expect(
        eas.connect(attester).attest({
          schema: geographicSchemaUID,
          data: {
            recipient: user.address,
            expirationTime: 0,
            revocable: true,
            refUID: ethers.ZeroHash,
            data: attestationData,
            value: 0
          }
        })
      ).to.be.reverted;
    });

    it("应该拒绝过长的国家代码", async function () {
      const geographicTag = {
        country: "A".repeat(20), // 过长的国家代码
        region: "Pacific",
        jurisdiction: "Palau Courts"
      };

      const attestationData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["tuple(string country, string region, string jurisdiction)"],
        [geographicTag]
      );

      await expect(
        eas.connect(attester).attest({
          schema: geographicSchemaUID,
          data: {
            recipient: user.address,
            expirationTime: 0,
            revocable: true,
            refUID: ethers.ZeroHash,
            data: attestationData,
            value: 0
          }
        })
      ).to.be.reverted;
    });
  });

  describe("标签撤销处理", function () {
    let attestationUID: string;

    beforeEach(async function () {
      const currentTime = Math.floor(Date.now() / 1000);
      const validityTag = {
        valid: true,
        issued: currentTime,
        expires: currentTime + 365 * 24 * 3600
      };

      const attestationData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["tuple(bool valid, uint256 issued, uint256 expires)"],
        [validityTag]
      );

      const tx = await eas.connect(attester).attest({
        schema: validitySchemaUID,
        data: {
          recipient: user.address,
          expirationTime: validityTag.expires,
          revocable: true,
          refUID: ethers.ZeroHash,
          data: attestationData,
          value: 0
        }
      });

      const receipt = await tx.wait();
      // 从EAS事件中获取attestationUID
      const attestEvent = receipt?.logs.find(log => 
        eas.interface.parseLog(log as any)?.name === "Attested"
      );
      if (attestEvent) {
        const parsedEvent = eas.interface.parseLog(attestEvent as any);
        attestationUID = parsedEvent?.args[2]; // uid参数
      }
    });

    it("应该成功处理标签撤销", async function () {
      const tx = await eas.connect(attester).revoke({
        schema: validitySchemaUID,
        data: {
          uid: attestationUID,
          value: 0
        }
      });

      await expect(tx).to.emit(taggedResolver, "TagRevoked")
        .withArgs(user.address, attestationUID, validitySchemaUID);

      // 检查标签计数是否减少
      expect(await taggedResolver.tagCounts("validity")).to.equal(0);
    });
  });

  describe("统计和查询", function () {
    beforeEach(async function () {
      // 创建一些测试标签
      const currentTime = Math.floor(Date.now() / 1000);
      
      // 有效性标签
      const validityTag = {
        valid: true,
        issued: currentTime,
        expires: currentTime + 365 * 24 * 3600
      };
      const validityData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["tuple(bool valid, uint256 issued, uint256 expires)"],
        [validityTag]
      );
      await eas.connect(attester).attest({
        schema: validitySchemaUID,
        data: {
          recipient: user.address,
          expirationTime: validityTag.expires,
          revocable: true,
          refUID: ethers.ZeroHash,
          data: validityData,
          value: 0
        }
      });

      // 性别标签
      const genderTag = {
        gender: "Male",
        verified: true
      };
      const genderData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["tuple(string gender, bool verified)"],
        [genderTag]
      );
      await eas.connect(attester).attest({
        schema: genderSchemaUID,
        data: {
          recipient: user.address,
          expirationTime: 0,
          revocable: true,
          refUID: ethers.ZeroHash,
          data: genderData,
          value: 0
        }
      });
    });

    it("应该正确统计标签数量", async function () {
      expect(await taggedResolver.tagCounts("validity")).to.equal(1);
      expect(await taggedResolver.tagCounts("gender")).to.equal(1);
      expect(await taggedResolver.tagCounts("clearance")).to.equal(0);
    });

    it("应该正确跟踪用户标签状态", async function () {
      expect(await taggedResolver.userTags(user.address, "validity")).to.be.true;
      expect(await taggedResolver.userTags(user.address, "gender")).to.be.true;
      expect(await taggedResolver.userTags(user.address, "clearance")).to.be.false;
    });

    it("应该正确返回用户标签计数", async function () {
      expect(await taggedResolver.getUserTagCount(user.address, "validity")).to.equal(1);
      expect(await taggedResolver.getUserTagCount(user.address, "gender")).to.equal(1);
      expect(await taggedResolver.getUserTagCount(user.address, "clearance")).to.equal(0);
    });

    it("应该正确返回所有标签状态", async function () {
      const [hasValidity, hasClearance, hasAge, hasGender, hasDocument, hasGeographic] = 
        await taggedResolver.getUserAllTagStatus(user.address);

      expect(hasValidity).to.be.true;
      expect(hasClearance).to.be.false;
      expect(hasAge).to.be.false;
      expect(hasGender).to.be.true;
      expect(hasDocument).to.be.false;
      expect(hasGeographic).to.be.false;
    });

    it("应该正确返回所有标签统计", async function () {
      const [validityCount, clearanceCount, ageCount, genderCount, documentCount, geographicCount] = 
        await taggedResolver.getAllTagStatistics();

      expect(validityCount).to.equal(1);
      expect(clearanceCount).to.equal(0);
      expect(ageCount).to.equal(0);
      expect(genderCount).to.equal(1);
      expect(documentCount).to.equal(0);
      expect(geographicCount).to.equal(0);
    });
  });

  describe("权限管理", function () {
    it("只有所有者可以注册模式映射", async function () {
      await expect(
        taggedResolver.connect(attester).registerSchemaMapping(ethers.ZeroHash, "test")
      ).to.be.revertedWith("Only owner");
    });

    it("只有所有者可以批量注册模式映射", async function () {
      await expect(
        taggedResolver.connect(attester).batchRegisterSchemaMappings([ethers.ZeroHash], ["test"])
      ).to.be.revertedWith("Only owner");
    });

    it("应该成功转移所有权", async function () {
      await taggedResolver.connect(owner).transferOwnership(attester.address);
      expect(await taggedResolver.owner()).to.equal(attester.address);
    });

    it("应该拒绝转移给零地址", async function () {
      await expect(
        taggedResolver.connect(owner).transferOwnership(ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid new owner");
    });
  });
});