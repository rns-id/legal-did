import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { LegalDIDV3 } from "../../../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("LegalDIDV3", function () {
  let contract: LegalDIDV3;
  let owner: SignerWithAddress;
  let admin: SignerWithAddress;
  let user: SignerWithAddress;
  let user2: SignerWithAddress;

  const SECONDARY_ADMIN_ROLE = ethers.keccak256(ethers.toUtf8Bytes("SECONDARY_ADMIN_ROLE"));
  const testRnsId = "test-rns-123";
  const testRnsId2 = "test-rns-456";
  const testMerkleRoot = ethers.keccak256(ethers.toUtf8Bytes("test-merkle"));
  const testOrderId = "order-001";

  beforeEach(async function () {
    [owner, admin, user, user2] = await ethers.getSigners();
    const LegalDIDV3Factory = await ethers.getContractFactory("LegalDIDV3");
    contract = (await upgrades.deployProxy(LegalDIDV3Factory, [], {
      initializer: "initialize",
    })) as unknown as LegalDIDV3;
    await contract.waitForDeployment();
  });

  describe("Initialize", function () {
    it("should set correct name and symbol", async function () {
      expect(await contract.name()).to.equal("Legal DID Test");
      expect(await contract.symbol()).to.equal("LDIDTest");
    });

    it("should set correct mint price", async function () {
      expect(await contract.mintPrice()).to.equal(ethers.parseEther("0.01"));
    });

    it("should grant admin roles to deployer", async function () {
      expect(await contract.hasRole(await contract.DEFAULT_ADMIN_ROLE(), owner.address)).to.be.true;
      expect(await contract.hasRole(SECONDARY_ADMIN_ROLE, owner.address)).to.be.true;
    });
  });

  // ============ Legacy authorizeMint Tests ============
  describe("AuthorizeMint (Legacy)", function () {
    it("should authorize mint with correct fee", async function () {
      await expect(
        contract.connect(user).authorizeMint(testRnsId, user.address, { value: ethers.parseEther("0.01") })
      ).to.emit(contract, "RNSAddressAuthorized").withArgs(testRnsId, user.address);
    });

    it("should fail with insufficient fee", async function () {
      await expect(
        contract.connect(user).authorizeMint(testRnsId, user.address, { value: ethers.parseEther("0.001") })
      ).to.be.revertedWith("insufficient fund");
    });

    it("admin should authorize without fee", async function () {
      await expect(contract.authorizeMint(testRnsId, user.address)).to.emit(contract, "RNSAddressAuthorized");
    });
  });

  // ============ authorizeMintV3 Tests ============
  describe("AuthorizeMintV3", function () {
    it("should emit both RNSAddressAuthorized and OrderProcessed events", async function () {
      const tx = await contract.connect(user).authorizeMintV3(testRnsId, user.address, testOrderId, {
        value: ethers.parseEther("0.01"),
      });

      await expect(tx).to.emit(contract, "RNSAddressAuthorized").withArgs(testRnsId, user.address);

      await expect(tx)
        .to.emit(contract, "OrderProcessed")
        .withArgs(testOrderId, testRnsId, user.address, ethers.parseEther("0.01"));
    });

    it("should fail with insufficient fee", async function () {
      await expect(
        contract.connect(user).authorizeMintV3(testRnsId, user.address, testOrderId, {
          value: ethers.parseEther("0.001"),
        })
      ).to.be.revertedWith("insufficient fund");
    });

    it("admin should authorize without fee", async function () {
      const tx = await contract.authorizeMintV3(testRnsId, user.address, testOrderId);
      await expect(tx).to.emit(contract, "OrderProcessed").withArgs(testOrderId, testRnsId, user.address, 0);
    });

    it("should allow multiple authorizations for same rnsId+wallet (event tracking)", async function () {
      // V3 不再写入 isAuthorized，所以可以多次调用
      await contract.connect(user).authorizeMintV3(testRnsId, user.address, "order-001", {
        value: ethers.parseEther("0.01"),
      });
      await expect(
        contract.connect(user).authorizeMintV3(testRnsId, user.address, "order-002", {
          value: ethers.parseEther("0.01"),
        })
      ).to.emit(contract, "OrderProcessed");
    });
  });

  // ============ Legacy airdrop Tests ============
  describe("Airdrop (Legacy)", function () {
    it("should airdrop NFT to user", async function () {
      await expect(contract.airdrop(testRnsId, user.address, testMerkleRoot))
        .to.emit(contract, "RNSNewID")
        .withArgs(testRnsId, user.address, 1);

      expect(await contract.ownerOf(1)).to.equal(user.address);
      expect(await contract.tokenIdToRnsId(1)).to.equal(testRnsId);
      expect(await contract.tokenIdToMerkle(1)).to.equal(testMerkleRoot);
    });

    it("should fail if non-admin tries to airdrop", async function () {
      await expect(contract.connect(user).airdrop(testRnsId, user.address, testMerkleRoot)).to.be.reverted;
    });

    it("should fail if same rnsId+wallet already minted", async function () {
      await contract.airdrop(testRnsId, user.address, testMerkleRoot);
      await expect(contract.airdrop(testRnsId, user.address, testMerkleRoot)).to.be.revertedWith(
        "One LDID can only mint once to the same wallet."
      );
    });
  });

  // ============ airdropV3 Tests ============
  describe("AirdropV3", function () {
    it("should airdrop NFT and set walletToRnsId mapping", async function () {
      await expect(contract.airdropV3(testRnsId, user.address, testMerkleRoot))
        .to.emit(contract, "RNSNewID")
        .withArgs(testRnsId, user.address, 1);

      expect(await contract.ownerOf(1)).to.equal(user.address);
      expect(await contract.walletToRnsId(user.address)).to.equal(testRnsId);
    });

    it("should allow multiple airdrops to same wallet with same rnsId", async function () {
      await contract.airdropV3(testRnsId, user.address, testMerkleRoot);
      
      // 同一 rnsId 可以再次空投给同一钱包
      const merkleRoot2 = ethers.keccak256(ethers.toUtf8Bytes("test-merkle-2"));
      await expect(contract.airdropV3(testRnsId, user.address, merkleRoot2))
        .to.emit(contract, "RNSNewID")
        .withArgs(testRnsId, user.address, 2);

      expect(await contract.balanceOf(user.address)).to.equal(2);
    });

    it("should reject airdrop to wallet with different rnsId", async function () {
      // 先空投 rnsId1 给 user
      await contract.airdropV3(testRnsId, user.address, testMerkleRoot);

      // 尝试空投不同的 rnsId2 给同一 user，应该失败
      await expect(contract.airdropV3(testRnsId2, user.address, testMerkleRoot)).to.be.revertedWith(
        "Wallet already holds LDID from different identity"
      );
    });

    it("should fail if non-admin tries to airdropV3", async function () {
      await expect(contract.connect(user).airdropV3(testRnsId, user.address, testMerkleRoot)).to.be.reverted;
    });

    it("different wallets can hold same rnsId", async function () {
      await contract.airdropV3(testRnsId, user.address, testMerkleRoot);
      await contract.airdropV3(testRnsId, user2.address, testMerkleRoot);

      expect(await contract.walletToRnsId(user.address)).to.equal(testRnsId);
      expect(await contract.walletToRnsId(user2.address)).to.equal(testRnsId);
    });
  });

  // ============ Burn Tests ============
  describe("Burn", function () {
    beforeEach(async function () {
      await contract.airdropV3(testRnsId, user.address, testMerkleRoot);
    });

    it("owner should burn their NFT", async function () {
      await expect(contract.connect(user).burn(1))
        .to.emit(contract, "RNSBurnID")
        .withArgs(testRnsId, user.address, 1);
    });

    it("should clear mappings after burn", async function () {
      await contract.connect(user).burn(1);
      expect(await contract.tokenIdToWallet(1)).to.equal(ethers.ZeroAddress);
      expect(await contract.tokenIdToRnsId(1)).to.equal("");
    });

    it("should clear walletToRnsId when balance becomes zero", async function () {
      expect(await contract.walletToRnsId(user.address)).to.equal(testRnsId);
      
      await contract.connect(user).burn(1);
      
      expect(await contract.walletToRnsId(user.address)).to.equal("");
    });

    it("should keep walletToRnsId if user still has other LDIDs", async function () {
      // 空投第二个 LDID
      const merkleRoot2 = ethers.keccak256(ethers.toUtf8Bytes("test-merkle-2"));
      await contract.airdropV3(testRnsId, user.address, merkleRoot2);

      expect(await contract.balanceOf(user.address)).to.equal(2);

      // 销毁第一个
      await contract.connect(user).burn(1);

      // walletToRnsId 应该保留
      expect(await contract.walletToRnsId(user.address)).to.equal(testRnsId);
      expect(await contract.balanceOf(user.address)).to.equal(1);
    });

    it("after burn, wallet can bind to different rnsId", async function () {
      await contract.connect(user).burn(1);
      
      // 现在可以绑定不同的 rnsId
      await expect(contract.airdropV3(testRnsId2, user.address, testMerkleRoot))
        .to.emit(contract, "RNSNewID")
        .withArgs(testRnsId2, user.address, 2);

      expect(await contract.walletToRnsId(user.address)).to.equal(testRnsId2);
    });
  });

  // ============ Admin Functions ============
  describe("Admin Functions", function () {
    it("should set mint price", async function () {
      await contract.setMintPrice(ethers.parseEther("0.02"));
      expect(await contract.mintPrice()).to.equal(ethers.parseEther("0.02"));
    });

    it("should set base URI", async function () {
      await contract.setBaseURI("https://new-uri.com/");
      await contract.airdropV3(testRnsId, user.address, testMerkleRoot);
      expect(await contract.tokenURI(1)).to.equal(`https://new-uri.com/${testRnsId}.json`);
    });

    it("should set merkle root for token", async function () {
      await contract.airdropV3(testRnsId, user.address, testMerkleRoot);
      const newMerkle = ethers.keccak256(ethers.toUtf8Bytes("new-merkle"));
      await contract.setTokenIdToMerkle(1, newMerkle);
      expect(await contract.tokenMerkleRoot(1)).to.equal(newMerkle);
    });

    it("should withdraw funds", async function () {
      // 先充值一些 ETH
      await contract.connect(user).authorizeMintV3(testRnsId, user.address, testOrderId, {
        value: ethers.parseEther("0.01"),
      });

      const balanceBefore = await ethers.provider.getBalance(owner.address);
      await contract.withdraw();
      const balanceAfter = await ethers.provider.getBalance(owner.address);

      // 余额应该增加（减去 gas 费用后）
      expect(balanceAfter).to.be.gt(balanceBefore - ethers.parseEther("0.001"));
    });
  });

  // ============ Transfer Restrictions ============
  describe("Transfer Restrictions", function () {
    beforeEach(async function () {
      await contract.airdropV3(testRnsId, user.address, testMerkleRoot);
    });

    it("should not allow transfer between users", async function () {
      await expect(
        contract.connect(user).transferFrom(user.address, user2.address, 1)
      ).to.be.revertedWith("A LDID can only be airdropped or burned.");
    });

    it("should not allow safeTransferFrom between users", async function () {
      await expect(
        contract.connect(user)["safeTransferFrom(address,address,uint256)"](user.address, user2.address, 1)
      ).to.be.revertedWith("A LDID can only be airdropped or burned.");
    });
  });
});
