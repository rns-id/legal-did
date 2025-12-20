import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { LegalDID } from "../../typechain-types";

describe("LegalDID Gas Analysis", function () {
  let contract: LegalDID;

  const testRnsId = "test-rns-" + Date.now();
  const testMerkleRoot = ethers.keccak256(ethers.toUtf8Bytes("test-merkle"));

  before(async function () {
    const [owner] = await ethers.getSigners();
    const LegalDIDFactory = await ethers.getContractFactory("LegalDID");
    contract = (await upgrades.deployProxy(LegalDIDFactory, [], {
      initializer: "initialize",
    })) as unknown as LegalDID;
    await contract.waitForDeployment();
  });

  it("Gas Analysis: authorizeMint", async function () {
    const [, user] = await ethers.getSigners();
    
    const tx = await contract.connect(user).authorizeMint(testRnsId, user.address, { 
      value: ethers.parseEther("0.01") 
    });
    const receipt = await tx.wait();
    
    console.log("\n=== authorizeMint Gas ===");
    console.log("Gas Used:", receipt?.gasUsed.toString());
    console.log("Gas Price (gwei):", "30"); // Assuming 30 gwei
    
    const gasUsed = Number(receipt?.gasUsed || 0);
    const ethCost = gasUsed * 30 / 1e9;
    const usdCost = ethCost * 2000;
    
    console.log("ETH Cost:", ethCost.toFixed(6), "ETH");
    console.log("USD Cost (@$2000):", "$" + usdCost.toFixed(2));
  });

  it("Gas Analysis: airdrop", async function () {
    const [owner, user] = await ethers.getSigners();
    const rnsId2 = "test-rns-airdrop-" + Date.now();
    
    const tx = await contract.airdrop(rnsId2, user.address, testMerkleRoot);
    const receipt = await tx.wait();
    
    console.log("\n=== airdrop Gas ===");
    console.log("Gas Used:", receipt?.gasUsed.toString());
    
    const gasUsed = Number(receipt?.gasUsed || 0);
    const ethCost = gasUsed * 30 / 1e9;
    const usdCost = ethCost * 2000;
    
    console.log("ETH Cost:", ethCost.toFixed(6), "ETH");
    console.log("USD Cost (@$2000):", "$" + usdCost.toFixed(2));
  });

  it("Gas Analysis: burn", async function () {
    const [owner, user] = await ethers.getSigners();
    
    const tx = await contract.connect(user).burn(1);
    const receipt = await tx.wait();
    
    console.log("\n=== burn Gas ===");
    console.log("Gas Used:", receipt?.gasUsed.toString());
    
    const gasUsed = Number(receipt?.gasUsed || 0);
    const ethCost = gasUsed * 30 / 1e9;
    const usdCost = ethCost * 2000;
    
    console.log("ETH Cost:", ethCost.toFixed(6), "ETH");
    console.log("USD Cost (@$2000):", "$" + usdCost.toFixed(2));
  });

  it("Summary: Total cost for full flow", async function () {
    console.log("\n=== Full Flow Cost Estimate (@ 30 gwei, $2000/ETH) ===");
    console.log("Estimated Gas Usage:");
    console.log("  authorizeMint: ~80,000 gas = $4.80");
    console.log("  airdrop:       ~180,000 gas = $10.80");
    console.log("  burn:          ~100,000 gas = $6.00");
    console.log("  ─────────────────────────────");
    console.log("  Total:         ~360,000 gas = $21.60");
    console.log("\nCost at Different Gas Prices:");
    console.log("  @ 10 gwei: $7.20");
    console.log("  @ 30 gwei: $21.60");
    console.log("  @ 50 gwei: $36.00");
    console.log("  @ 100 gwei: $72.00");
  });
});
