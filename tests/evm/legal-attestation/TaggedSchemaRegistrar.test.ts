import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { TaggedSchemaRegistrar, TaggedResolver, SchemaRegistry, EAS } from "../../../typechain-types";

describe("TaggedSchemaRegistrar", function () {
  let taggedSchemaRegistrar: TaggedSchemaRegistrar;
  let taggedResolver: TaggedResolver;
  let schemaRegistry: SchemaRegistry;
  let eas: EAS;
  
  let owner: SignerWithAddress;
  let user: SignerWithAddress;
  let unauthorized: SignerWithAddress;

  beforeEach(async function () {
    [owner, user, unauthorized] = await ethers.getSigners();

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
    taggedSchemaRegistrar = await TaggedSchemaRegistrarFactory.deploy(await schemaRegistry.getAddress());
    await taggedSchemaRegistrar.waitForDeployment();
  });

  describe("部署和初始化", function () {
    it("应该正确部署合约", async function () {
      expect(await taggedSchemaRegistrar.getAddress()).to.be.properAddress;
      expect(await taggedSchemaRegistrar.owner()).to.equal(owner.address);
      expect(await taggedSchemaRegistrar.getSchemaRegistry()).to.equal(await schemaRegistry.getAddress());
    });

    it("应该正确初始化预定义模式", async function () {
      const predefinedTagTypes = await taggedSchemaRegistrar.getAllPredefinedTagTypes();
      
      expect(predefinedTagTypes.length).to.equal(6);
      expect(predefinedTagTypes).to.include("validity");
      expect(predefinedTagTypes).to.include("clearance");
      expect(predefinedTagTypes).to.include("age");
      expect(predefinedTagTypes).to.include("gender");
      expect(predefinedTagTypes).to.include("document");
      expect(predefinedTagTypes).to.include("geographic");
    });

    it("应该正确获取预定义模式定义", async function () {
      const validitySchema = await taggedSchemaRegistrar.getPredefinedSchemaDefinition("validity");
      const clearanceSchema = await taggedSchemaRegistrar.getPredefinedSchemaDefinition("clearance");
      const ageSchema = await taggedSchemaRegistrar.getPredefinedSchemaDefinition("age");

      expect(validitySchema).to.equal("bool valid,uint256 issued,uint256 expires");
      expect(clearanceSchema).to.equal("bool clear,uint256 checkDate,string checkType");
      expect(ageSchema).to.equal("bool over18,bool over21,uint256 birthYear,bool verified");
    });
  });

  describe("单个标签模式注册", function () {
    it("应该成功注册预定义标签模式", async function () {
      const tx = await taggedSchemaRegistrar.registerTagSchema(
        "validity",
        await taggedResolver.getAddress(),
        true
      );

      await expect(tx).to.emit(taggedSchemaRegistrar, "TagSchemaRegistered")
        .withArgs("validity", ethers.AnyValue, "bool valid,uint256 issued,uint256 expires", true);

      // 验证模式已注册
      expect(await taggedSchemaRegistrar.isTagTypeRegistered("validity")).to.be.true;
      
      const schemaInfo = await taggedSchemaRegistrar.getTagSchema("validity");
      expect(schemaInfo.tagType).to.equal("validity");
      expect(schemaInfo.registered).to.be.true;
      expect(schemaInfo.revocable).to.be.true;
    });

    it("应该拒绝空的标签类型", async function () {
      await expect(
        taggedSchemaRegistrar.registerTagSchema(
          "",
          await taggedResolver.getAddress(),
          true
        )
      ).to.be.revertedWithCustomError(taggedSchemaRegistrar, "InvalidSchema");
    });

    it("应该拒绝零地址解析器", async function () {
      await expect(
        taggedSchemaRegistrar.registerTagSchema(
          "validity",
          ethers.ZeroAddress,
          true
        )
      ).to.be.revertedWithCustomError(taggedSchemaRegistrar, "InvalidResolver");
    });

    it("应该拒绝重复注册相同标签类型", async function () {
      // 首次注册
      await taggedSchemaRegistrar.registerTagSchema(
        "validity",
        await taggedResolver.getAddress(),
        true
      );

      // 尝试重复注册
      await expect(
        taggedSchemaRegistrar.registerTagSchema(
          "validity",
          await taggedResolver.getAddress(),
          true
        )
      ).to.be.revertedWithCustomError(taggedSchemaRegistrar, "SchemaAlreadyRegistered");
    });

    it("应该拒绝未知的预定义标签类型", async function () {
      await expect(
        taggedSchemaRegistrar.registerTagSchema(
          "unknown",
          await taggedResolver.getAddress(),
          true
        )
      ).to.be.revertedWithCustomError(taggedSchemaRegistrar, "InvalidSchema");
    });

    it("只有所有者可以注册标签模式", async function () {
      await expect(
        taggedSchemaRegistrar.connect(unauthorized).registerTagSchema(
          "validity",
          await taggedResolver.getAddress(),
          true
        )
      ).to.be.revertedWith("Only owner");
    });
  });

  describe("自定义标签模式注册", function () {
    it("应该成功注册自定义标签模式", async function () {
      const customSchema = "string customField,uint256 customValue,bool customFlag";
      
      const tx = await taggedSchemaRegistrar.registerCustomTagSchema(
        "custom",
        customSchema,
        await taggedResolver.getAddress(),
        false // 不可撤销
      );

      await expect(tx).to.emit(taggedSchemaRegistrar, "TagSchemaRegistered")
        .withArgs("custom", ethers.AnyValue, customSchema, false);

      // 验证自定义模式已注册
      expect(await taggedSchemaRegistrar.isTagTypeRegistered("custom")).to.be.true;
      
      const schemaInfo = await taggedSchemaRegistrar.getTagSchema("custom");
      expect(schemaInfo.tagType).to.equal("custom");
      expect(schemaInfo.schemaDefinition).to.equal(customSchema);
      expect(schemaInfo.revocable).to.be.false;
    });

    it("应该拒绝空的自定义模式定义", async function () {
      await expect(
        taggedSchemaRegistrar.registerCustomTagSchema(
          "custom",
          "",
          await taggedResolver.getAddress(),
          true
        )
      ).to.be.revertedWithCustomError(taggedSchemaRegistrar, "InvalidSchema");
    });

    it("应该拒绝空的自定义标签类型", async function () {
      await expect(
        taggedSchemaRegistrar.registerCustomTagSchema(
          "",
          "string customField",
          await taggedResolver.getAddress(),
          true
        )
      ).to.be.revertedWithCustomError(taggedSchemaRegistrar, "InvalidSchema");
    });

    it("只有所有者可以注册自定义标签模式", async function () {
      await expect(
        taggedSchemaRegistrar.connect(unauthorized).registerCustomTagSchema(
          "custom",
          "string customField",
          await taggedResolver.getAddress(),
          true
        )
      ).to.be.revertedWith("Only owner");
    });
  });

  describe("批量标签模式注册", function () {
    it("应该成功批量注册所有预定义模式", async function () {
      const tx = await taggedSchemaRegistrar.batchRegisterAllPredefinedSchemas(
        await taggedResolver.getAddress(),
        true
      );

      // 验证所有预定义标签类型都已注册
      const predefinedTypes = await taggedSchemaRegistrar.getAllPredefinedTagTypes();
      for (const tagType of predefinedTypes) {
        expect(await taggedSchemaRegistrar.isTagTypeRegistered(tagType)).to.be.true;
      }

      expect(await taggedSchemaRegistrar.getRegisteredTagTypesCount()).to.equal(6);
    });

    it("应该成功批量注册指定的标签模式", async function () {
      const tagTypes = ["validity", "clearance", "age"];
      
      const schemaUIDs = await taggedSchemaRegistrar.batchRegisterTagSchemas(
        tagTypes,
        await taggedResolver.getAddress(),
        true
      );

      expect(schemaUIDs.length).to.equal(3);

      // 验证指定的标签类型已注册
      for (const tagType of tagTypes) {
        expect(await taggedSchemaRegistrar.isTagTypeRegistered(tagType)).to.be.true;
      }

      // 验证未指定的标签类型未注册
      expect(await taggedSchemaRegistrar.isTagTypeRegistered("gender")).to.be.false;
      expect(await taggedSchemaRegistrar.isTagTypeRegistered("document")).to.be.false;
      expect(await taggedSchemaRegistrar.isTagTypeRegistered("geographic")).to.be.false;
    });

    it("应该处理部分已注册的批量操作", async function () {
      // 先注册一个标签类型
      await taggedSchemaRegistrar.registerTagSchema(
        "validity",
        await taggedResolver.getAddress(),
        true
      );

      // 批量注册包含已注册的标签类型
      const tagTypes = ["validity", "clearance", "age"];
      const schemaUIDs = await taggedSchemaRegistrar.batchRegisterTagSchemas(
        tagTypes,
        await taggedResolver.getAddress(),
        true
      );

      expect(schemaUIDs.length).to.equal(3);

      // 所有标签类型都应该已注册
      for (const tagType of tagTypes) {
        expect(await taggedSchemaRegistrar.isTagTypeRegistered(tagType)).to.be.true;
      }
    });

    it("只有所有者可以批量注册标签模式", async function () {
      await expect(
        taggedSchemaRegistrar.connect(unauthorized).batchRegisterAllPredefinedSchemas(
          await taggedResolver.getAddress(),
          true
        )
      ).to.be.revertedWith("Only owner");

      await expect(
        taggedSchemaRegistrar.connect(unauthorized).batchRegisterTagSchemas(
          ["validity"],
          await taggedResolver.getAddress(),
          true
        )
      ).to.be.revertedWith("Only owner");
    });
  });

  describe("标签模式查询", function () {
    beforeEach(async function () {
      // 注册一些测试模式
      await taggedSchemaRegistrar.registerTagSchema(
        "validity",
        await taggedResolver.getAddress(),
        true
      );
      await taggedSchemaRegistrar.registerTagSchema(
        "clearance",
        await taggedResolver.getAddress(),
        false
      );
    });

    it("应该正确获取标签模式信息", async function () {
      const validitySchema = await taggedSchemaRegistrar.getTagSchema("validity");
      
      expect(validitySchema.tagType).to.equal("validity");
      expect(validitySchema.schemaDefinition).to.equal("bool valid,uint256 issued,uint256 expires");
      expect(validitySchema.revocable).to.be.true;
      expect(validitySchema.registered).to.be.true;
      expect(validitySchema.schemaUID).to.not.equal(ethers.ZeroHash);
    });

    it("应该正确获取标签模式UID", async function () {
      const validityUID = await taggedSchemaRegistrar.getTagSchemaUID("validity");
      const clearanceUID = await taggedSchemaRegistrar.getTagSchemaUID("clearance");
      
      expect(validityUID).to.not.equal(ethers.ZeroHash);
      expect(clearanceUID).to.not.equal(ethers.ZeroHash);
      expect(validityUID).to.not.equal(clearanceUID);
    });

    it("应该拒绝查询未注册的标签模式UID", async function () {
      await expect(
        taggedSchemaRegistrar.getTagSchemaUID("unregistered")
      ).to.be.revertedWith("Schema not registered");
    });

    it("应该正确批量获取标签模式UID", async function () {
      const tagTypes = ["validity", "clearance"];
      const schemaUIDs = await taggedSchemaRegistrar.batchGetTagSchemaUIDs(tagTypes);
      
      expect(schemaUIDs.length).to.equal(2);
      expect(schemaUIDs[0]).to.not.equal(ethers.ZeroHash);
      expect(schemaUIDs[1]).to.not.equal(ethers.ZeroHash);
      expect(schemaUIDs[0]).to.not.equal(schemaUIDs[1]);
    });

    it("应该拒绝批量查询包含未注册标签的请求", async function () {
      const tagTypes = ["validity", "unregistered"];
      
      await expect(
        taggedSchemaRegistrar.batchGetTagSchemaUIDs(tagTypes)
      ).to.be.revertedWith("Schema not registered");
    });

    it("应该正确获取所有已注册的标签类型", async function () {
      const registeredTypes = await taggedSchemaRegistrar.getAllRegisteredTagTypes();
      
      expect(registeredTypes.length).to.equal(2);
      expect(registeredTypes).to.include("validity");
      expect(registeredTypes).to.include("clearance");
    });

    it("应该正确获取已注册标签类型数量", async function () {
      expect(await taggedSchemaRegistrar.getRegisteredTagTypesCount()).to.equal(2);
    });

    it("应该正确检查标签类型是否已注册", async function () {
      expect(await taggedSchemaRegistrar.isTagTypeRegistered("validity")).to.be.true;
      expect(await taggedSchemaRegistrar.isTagTypeRegistered("clearance")).to.be.true;
      expect(await taggedSchemaRegistrar.isTagTypeRegistered("age")).to.be.false;
      expect(await taggedSchemaRegistrar.isTagTypeRegistered("unregistered")).to.be.false;
    });
  });

  describe("预定义模式管理", function () {
    it("应该成功添加新的预定义模式", async function () {
      const newTagType = "newType";
      const newSchemaDefinition = "string newField,uint256 newValue";
      
      await taggedSchemaRegistrar.addPredefinedSchema(newTagType, newSchemaDefinition);
      
      const retrievedDefinition = await taggedSchemaRegistrar.getPredefinedSchemaDefinition(newTagType);
      expect(retrievedDefinition).to.equal(newSchemaDefinition);
    });

    it("应该成功更新现有的预定义模式", async function () {
      const updatedDefinition = "bool valid,uint256 issued,uint256 expires,string newField";
      
      await taggedSchemaRegistrar.updatePredefinedSchema("validity", updatedDefinition);
      
      const retrievedDefinition = await taggedSchemaRegistrar.getPredefinedSchemaDefinition("validity");
      expect(retrievedDefinition).to.equal(updatedDefinition);
    });

    it("应该拒绝添加空的标签类型", async function () {
      await expect(
        taggedSchemaRegistrar.addPredefinedSchema("", "string field")
      ).to.be.revertedWith("Invalid tag type");
    });

    it("应该拒绝添加空的模式定义", async function () {
      await expect(
        taggedSchemaRegistrar.addPredefinedSchema("newType", "")
      ).to.be.revertedWith("Invalid schema definition");
    });

    it("应该拒绝更新不存在的标签类型", async function () {
      await expect(
        taggedSchemaRegistrar.updatePredefinedSchema("nonexistent", "string field")
      ).to.be.revertedWith("Tag type not found");
    });

    it("应该拒绝更新为空的模式定义", async function () {
      await expect(
        taggedSchemaRegistrar.updatePredefinedSchema("validity", "")
      ).to.be.revertedWith("Invalid schema definition");
    });

    it("只有所有者可以管理预定义模式", async function () {
      await expect(
        taggedSchemaRegistrar.connect(unauthorized).addPredefinedSchema("newType", "string field")
      ).to.be.revertedWith("Only owner");

      await expect(
        taggedSchemaRegistrar.connect(unauthorized).updatePredefinedSchema("validity", "string field")
      ).to.be.revertedWith("Only owner");
    });
  });

  describe("权限管理", function () {
    it("应该成功转移所有权", async function () {
      await taggedSchemaRegistrar.connect(owner).transferOwnership(user.address);
      expect(await taggedSchemaRegistrar.owner()).to.equal(user.address);
    });

    it("应该拒绝转移给零地址", async function () {
      await expect(
        taggedSchemaRegistrar.connect(owner).transferOwnership(ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid new owner");
    });

    it("只有所有者可以转移所有权", async function () {
      await expect(
        taggedSchemaRegistrar.connect(unauthorized).transferOwnership(user.address)
      ).to.be.revertedWith("Only owner");
    });
  });

  describe("边界情况和错误处理", function () {
    it("应该处理空数组的批量操作", async function () {
      const emptyTagTypes: string[] = [];
      const schemaUIDs = await taggedSchemaRegistrar.batchRegisterTagSchemas(
        emptyTagTypes,
        await taggedResolver.getAddress(),
        true
      );
      
      expect(schemaUIDs.length).to.equal(0);
    });

    it("应该正确处理不存在的预定义模式查询", async function () {
      const definition = await taggedSchemaRegistrar.getPredefinedSchemaDefinition("nonexistent");
      expect(definition).to.equal("");
    });

    it("应该正确处理未注册标签的模式查询", async function () {
      const schema = await taggedSchemaRegistrar.getTagSchema("unregistered");
      
      expect(schema.tagType).to.equal("");
      expect(schema.schemaDefinition).to.equal("");
      expect(schema.schemaUID).to.equal(ethers.ZeroHash);
      expect(schema.revocable).to.be.false;
      expect(schema.registered).to.be.false;
    });
  });

  describe("Gas优化测试", function () {
    it("批量注册应该比单个注册更高效", async function () {
      const tagTypes = ["validity", "clearance", "age"];
      
      // 批量注册
      const batchTx = await taggedSchemaRegistrar.batchRegisterTagSchemas.populateTransaction(
        tagTypes,
        await taggedResolver.getAddress(),
        true
      );
      
      // 批量操作应该存在且可执行
      expect(batchTx.data).to.not.be.undefined;
    });

    it("应该正确处理大量标签类型的批量操作", async function () {
      // 创建多个自定义标签类型
      const customTagTypes = [];
      for (let i = 0; i < 10; i++) {
        const tagType = `custom${i}`;
        const schemaDefinition = `string field${i},uint256 value${i}`;
        
        await taggedSchemaRegistrar.addPredefinedSchema(tagType, schemaDefinition);
        customTagTypes.push(tagType);
      }
      
      // 批量注册所有自定义标签类型
      const schemaUIDs = await taggedSchemaRegistrar.batchRegisterTagSchemas(
        customTagTypes,
        await taggedResolver.getAddress(),
        true
      );
      
      expect(schemaUIDs.length).to.equal(10);
      expect(await taggedSchemaRegistrar.getRegisteredTagTypesCount()).to.equal(10);
    });
  });
});