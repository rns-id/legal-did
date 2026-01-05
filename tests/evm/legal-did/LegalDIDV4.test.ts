import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { LegalDIDV4 } from "../../../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("LegalDIDV4", function () {
  let contract: LegalDIDV4;
  let owner: SignerWithAddress;
  let admin: SignerWithAddress;
  let user: SignerWithAddress;
  let user2: SignerWithAddress;

  const SECONDARY_ADMIN_ROLE = ethers.keccak256(ethers.toUtf8Bytes("SECONDARY_ADMIN_ROLE"));
  const testOrderId = "order-001";
  const testOrderId2 = "order-002";
  const testOrderId3 = "order-003";
  const testRnsId = "test-rns-123";
  const testMerkleRoot = ethers.keccak256(ethers.toUtf8Bytes("test-merkle"));
  const testMerkleRoot2 = ethers.keccak256(ethers.toUtf8Bytes("test-merkle-2"));

  beforeEach(async function () {
    [owner, admin, user, user2] = await ethers.getSigners();
    const LegalDIDV4Factory = await ethers.getContractFactory("LegalDIDV4");
    contract = (await upgrades.deployProxy(LegalDIDV4Factory, [], {
      initializer: "initialize",
    })) as unknown as LegalDIDV4;
    await contract.waitForDeployment();
  });

  // ============ Initialize Tests ============
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

  // ============ V4 Core Feature: Multiple Mints for Same Wallet ============
  describe("V4 Core: Multiple Mints for Same Wallet (Renewal Support)", function () {
    it("should allow same wallet to receive multiple airdrops with different orderIds", async function () {
      // First airdrop
      await contract.airdropV4(testOrderId, user.address, testMerkleRoot);
      expect(await contract.balanceOf(user.address)).to.equal(1);

      // Second airdrop (renewal scenario)
      await contract.airdropV4(testOrderId2, user.address, testMerkleRoot2);
      expect(await contract.balanceOf(user.address)).to.equal(2);

      // Third airdrop
      await contract.airdropV4(testOrderId3, user.address, testMerkleRoot);
      expect(await contract.balanceOf(user.address)).to.equal(3);
    });

    it("should allow same wallet to authorize multiple times with different orderIds", async function () {
      // First authorization
      await expect(
        contract.connect(user).authorizeMintV4(testOrderId, user.address, {
          value: ethers.parseEther("0.01"),
        })
      ).to.emit(contract, "AuthorizeMintV4");

      // Second authorization (renewal scenario)
      await expect(
        contract.connect(user).authorizeMintV4(testOrderId2, user.address, {
          value: ethers.parseEther("0.01"),
        })
      ).to.emit(contract, "AuthorizeMintV4");
    });

    it("should track each mint with unique orderId in events", async function () {
      const tx1 = await contract.airdropV4(testOrderId, user.address, testMerkleRoot);
      await expect(tx1).to.emit(contract, "AirdropV4").withArgs(testOrderId, user.address, 1, testMerkleRoot);

      const tx2 = await contract.airdropV4(testOrderId2, user.address, testMerkleRoot2);
      await expect(tx2).to.emit(contract, "AirdropV4").withArgs(testOrderId2, user.address, 2, testMerkleRoot2);
    });
  });

  // ============ authorizeMintV4 Tests ============
  describe("AuthorizeMintV4", function () {
    it("should emit AuthorizeMintV4 event with orderId", async function () {
      const tx = await contract.connect(user).authorizeMintV4(testOrderId, user.address, {
        value: ethers.parseEther("0.01"),
      });

      await expect(tx)
        .to.emit(contract, "AuthorizeMintV4")
        .withArgs(testOrderId, user.address, ethers.parseEther("0.01"));
    });

    it("should fail with insufficient fee", async function () {
      await expect(
        contract.connect(user).authorizeMintV4(testOrderId, user.address, {
          value: ethers.parseEther("0.001"),
        })
      ).to.be.revertedWith("insufficient fund");
    });

    it("admin should authorize without fee", async function () {
      const tx = await contract.authorizeMintV4(testOrderId, user.address);
      await expect(tx).to.emit(contract, "AuthorizeMintV4").withArgs(testOrderId, user.address, 0);
    });

    it("should NOT write to isAuthorized mapping (V4 optimization)", async function () {
      await contract.connect(user).authorizeMintV4(testOrderId, user.address, {
        value: ethers.parseEther("0.01"),
      });
      
      // V4 does not write to isAuthorized
      const key = ethers.solidityPacked(["string", "address"], [testRnsId, user.address]);
      expect(await contract.isAuthorized(testRnsId + user.address.toLowerCase())).to.be.false;
    });
  });

  // ============ airdropV4 Tests ============
  describe("AirdropV4", function () {
    it("should emit AirdropV4 event with orderId and merkleRoot", async function () {
      const tx = await contract.airdropV4(testOrderId, user.address, testMerkleRoot);

      await expect(tx)
        .to.emit(contract, "AirdropV4")
        .withArgs(testOrderId, user.address, 1, testMerkleRoot);

      expect(await contract.ownerOf(1)).to.equal(user.address);
      expect(await contract.tokenIdToMerkle(1)).to.equal(testMerkleRoot);
    });

    it("should NOT store tokenIdToRnsId (V4 optimization)", async function () {
      await contract.airdropV4(testOrderId, user.address, testMerkleRoot);
      expect(await contract.tokenIdToRnsId(1)).to.equal("");
    });

    it("should NOT write to isMinted mapping (V4 optimization)", async function () {
      await contract.airdropV4(testOrderId, user.address, testMerkleRoot);
      // V4 does not write to isMinted
      expect(await contract.isMinted(testRnsId + user.address.toLowerCase())).to.be.false;
    });

    it("should fail if non-admin tries to airdropV4", async function () {
      await expect(contract.connect(user).airdropV4(testOrderId, user.address, testMerkleRoot)).to.be.reverted;
    });

    it("should store tokenIdToWallet correctly", async function () {
      await contract.airdropV4(testOrderId, user.address, testMerkleRoot);
      expect(await contract.tokenIdToWallet(1)).to.equal(user.address);
    });
  });

  // ============ tokenURI Tests (V4 uses merkleRoot) ============
  describe("TokenURI (V4 - merkleRoot based)", function () {
    it("should return merkleRoot-based URI", async function () {
      await contract.airdropV4(testOrderId, user.address, testMerkleRoot);
      const uri = await contract.tokenURI(1);
      
      // merkleRoot hex string (without 0x prefix)
      const expectedMerkle = testMerkleRoot.slice(2); // remove 0x
      expect(uri).to.equal(`https://api.rns.id/api/v2/portal/identity/nft/${expectedMerkle}.json`);
    });

    it("should return different URIs for different merkleRoots", async function () {
      await contract.airdropV4(testOrderId, user.address, testMerkleRoot);
      await contract.airdropV4(testOrderId2, user2.address, testMerkleRoot2);
      
      const uri1 = await contract.tokenURI(1);
      const uri2 = await contract.tokenURI(2);
      
      expect(uri1).to.not.equal(uri2);
      expect(uri1).to.contain(testMerkleRoot.slice(2));
      expect(uri2).to.contain(testMerkleRoot2.slice(2));
    });
  });

  // ============ Burn Tests ============
  describe("Burn (V4)", function () {
    beforeEach(async function () {
      await contract.airdropV4(testOrderId, user.address, testMerkleRoot);
    });

    it("should emit BurnV4 event", async function () {
      await expect(contract.connect(user).burn(1))
        .to.emit(contract, "BurnV4")
        .withArgs(user.address, 1);
    });

    it("should clear tokenIdToWallet and tokenIdToMerkle", async function () {
      await contract.connect(user).burn(1);
      expect(await contract.tokenIdToWallet(1)).to.equal(ethers.ZeroAddress);
      expect(await contract.tokenIdToMerkle(1)).to.equal(ethers.ZeroHash);
    });

    it("should allow wallet to receive new airdrop after burn", async function () {
      await contract.connect(user).burn(1);
      expect(await contract.balanceOf(user.address)).to.equal(0);

      // Can receive new airdrop
      await contract.airdropV4(testOrderId2, user.address, testMerkleRoot2);
      expect(await contract.balanceOf(user.address)).to.equal(1);
    });
  });

  // ============ Legacy Compatibility Tests ============
  describe("Legacy Compatibility", function () {
    it("authorizeMint (legacy) should still work", async function () {
      await expect(
        contract.connect(user).authorizeMint(testRnsId, user.address, { value: ethers.parseEther("0.01") })
      ).to.emit(contract, "RNSAddressAuthorized").withArgs(testRnsId, user.address);
    });

    it("airdrop (legacy) should still work", async function () {
      await expect(contract.airdrop(testRnsId, user.address, testMerkleRoot))
        .to.emit(contract, "RNSNewID")
        .withArgs(testRnsId, user.address, 1);
      
      // Legacy airdrop still writes tokenIdToRnsId
      expect(await contract.tokenIdToRnsId(1)).to.equal(testRnsId);
    });

    it("legacy airdrop should still enforce isMinted check", async function () {
      await contract.airdrop(testRnsId, user.address, testMerkleRoot);
      
      // Legacy airdrop blocks duplicate
      await expect(contract.airdrop(testRnsId, user.address, testMerkleRoot))
        .to.be.revertedWith("One LDID can only mint once to the same wallet.");
    });

    it("V4 airdrop should work even after legacy airdrop to same wallet", async function () {
      // Legacy airdrop
      await contract.airdrop(testRnsId, user.address, testMerkleRoot);
      expect(await contract.balanceOf(user.address)).to.equal(1);

      // V4 airdrop should still work (no isMinted check)
      await contract.airdropV4(testOrderId, user.address, testMerkleRoot2);
      expect(await contract.balanceOf(user.address)).to.equal(2);
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
      await contract.airdropV4(testOrderId, user.address, testMerkleRoot);
      const uri = await contract.tokenURI(1);
      expect(uri).to.contain("https://new-uri.com/");
    });

    it("should withdraw funds", async function () {
      await contract.connect(user).authorizeMintV4(testOrderId, user.address, {
        value: ethers.parseEther("0.01"),
      });

      const balanceBefore = await ethers.provider.getBalance(owner.address);
      await contract.withdraw();
      const balanceAfter = await ethers.provider.getBalance(owner.address);

      expect(balanceAfter).to.be.gt(balanceBefore - ethers.parseEther("0.001"));
    });

    it("should set fund destination", async function () {
      await contract.setFundDestination(user2.address);
      
      await contract.connect(user).authorizeMintV4(testOrderId, user.address, {
        value: ethers.parseEther("0.01"),
      });

      const balanceBefore = await ethers.provider.getBalance(user2.address);
      await contract.withdraw();
      const balanceAfter = await ethers.provider.getBalance(user2.address);

      expect(balanceAfter).to.be.gt(balanceBefore);
    });
  });

  // ============ Transfer Restrictions ============
  describe("Transfer Restrictions", function () {
    beforeEach(async function () {
      await contract.airdropV4(testOrderId, user.address, testMerkleRoot);
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

  // ============ Gas Optimization Verification ============
  describe("Gas Optimization", function () {
    it("airdropV4 should use less gas than legacy airdrop", async function () {
      // Legacy airdrop
      const tx1 = await contract.airdrop(testRnsId, user.address, testMerkleRoot);
      const receipt1 = await tx1.wait();
      const gasUsed1 = receipt1!.gasUsed;

      // V4 airdrop (different user to avoid conflicts)
      const tx2 = await contract.airdropV4(testOrderId, user2.address, testMerkleRoot2);
      const receipt2 = await tx2.wait();
      const gasUsed2 = receipt2!.gasUsed;

      console.log(`Legacy airdrop gas: ${gasUsed1}`);
      console.log(`V4 airdrop gas: ${gasUsed2}`);
      console.log(`Gas saved: ${gasUsed1 - gasUsed2}`);

      // V4 should use less gas (no isMinted write, no tokenIdToRnsId write)
      expect(gasUsed2).to.be.lt(gasUsed1);
    });
  });

  // ============ Event Tracking for Backend ============
  describe("Event Tracking for Backend", function () {
    it("should emit all necessary data for backend tracking in AuthorizeMintV4", async function () {
      const tx = await contract.connect(user).authorizeMintV4(testOrderId, user.address, {
        value: ethers.parseEther("0.01"),
      });

      // indexed string is hashed, so we check via event emission
      await expect(tx)
        .to.emit(contract, "AuthorizeMintV4")
        .withArgs(testOrderId, user.address, ethers.parseEther("0.01"));
    });

    it("should emit all necessary data for backend tracking in AirdropV4", async function () {
      const tx = await contract.airdropV4(testOrderId, user.address, testMerkleRoot);

      await expect(tx)
        .to.emit(contract, "AirdropV4")
        .withArgs(testOrderId, user.address, 1, testMerkleRoot);
    });
  });
});
