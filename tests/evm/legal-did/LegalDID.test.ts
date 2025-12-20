import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { LegalDID } from "../../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("LegalDID", function () {
  let contract: LegalDID;
  let owner: SignerWithAddress;
  let admin: SignerWithAddress;
  let user: SignerWithAddress;

  const SECONDARY_ADMIN_ROLE = ethers.keccak256(ethers.toUtf8Bytes("SECONDARY_ADMIN_ROLE"));
  const testRnsId = "test-rns-123";
  const testMerkleRoot = ethers.keccak256(ethers.toUtf8Bytes("test-merkle"));

  beforeEach(async function () {
    [owner, admin, user] = await ethers.getSigners();
    const LegalDIDFactory = await ethers.getContractFactory("LegalDID");
    contract = (await upgrades.deployProxy(LegalDIDFactory, [], {
      initializer: "initialize",
    })) as unknown as LegalDID;
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

  describe("AuthorizeMint", function () {
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

  describe("Airdrop", function () {
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

  describe("Burn", function () {
    beforeEach(async function () {
      await contract.airdrop(testRnsId, user.address, testMerkleRoot);
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
  });

  describe("Admin Functions", function () {
    it("should set mint price", async function () {
      await contract.setMintPrice(ethers.parseEther("0.02"));
      expect(await contract.mintPrice()).to.equal(ethers.parseEther("0.02"));
    });

    it("should set base URI", async function () {
      await contract.setBaseURI("https://new-uri.com/");
      await contract.airdrop(testRnsId, user.address, testMerkleRoot);
      expect(await contract.tokenURI(1)).to.equal(`https://new-uri.com/${testRnsId}.json`);
    });

    it("should block address", async function () {
      await contract.setIsBlockedAddress(user.address, true);
      await expect(contract.airdrop(testRnsId, user.address, testMerkleRoot)).to.be.revertedWith(
        "the wallet is blacklisted"
      );
    });

    it("should block rnsId", async function () {
      await contract.setIsBlockedRnsID(testRnsId, true);
      await expect(contract.airdrop(testRnsId, user.address, testMerkleRoot)).to.be.revertedWith(
        "the LDID is blacklisted"
      );
    });
  });
});
