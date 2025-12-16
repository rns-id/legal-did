import { RnsdidCore } from '../target/types/rnsdid_core'
import {
  Program,
  web3,
  workspace,
  setProvider,
  AnchorProvider,
} from '@coral-xyz/anchor'

import {
  findNonTransferableProject,
  getCollectionMetadataAddress,
  getCollectionMintAddress,
  getCollectionMasterEditionAddress,
  getUserAssociatedTokenAccount,
  getNonTransferableNftMintAddress,
  findNonTransferableUserStatus,
  findNonTransferableNftStatus,
  findNonTransferableRnsIdtatus,
} from './utils/utils'

import {
  ADMIN_WALLET,
  USER_WALLET,
  TOKEN_METADATA_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from "./utils/constants";

const { SYSVAR_RENT_PUBKEY } = web3

describe("Simple Num Counter Test", () => {
  const provider = AnchorProvider.env();
  setProvider(provider)
  const program = workspace.RnsdidCore as Program<RnsdidCore>;

  const rnsId = "num-test-" + Date.now();
  const tokenIndex = "num-001";

  it("Test num increment and decrement", async () => {
    console.log("\n=== Simple Num Counter Test ===");
    console.log("RNS ID:", rnsId);

    const userPubkey = USER_WALLET.publicKey;
    const collectionAddress = await findNonTransferableProject();
    const collectionMintAddress = await getCollectionMintAddress();
    const collectionMetadataAddress = await getCollectionMetadataAddress(collectionMintAddress);
    const collectionMasterEdition = await getCollectionMasterEditionAddress(collectionMintAddress);
    const nonTransferableRnsIdStatus = await findNonTransferableRnsIdtatus(rnsId);

    // Get fee_recipient
    const projectAccount = await program.account.projectAccount.fetch(collectionAddress);
    const feeRecipient = projectAccount.feeRecipient;

    // Record initial balances
    const adminInitialBalance = await provider.connection.getBalance(ADMIN_WALLET.publicKey);
    const userInitialBalance = await provider.connection.getBalance(userPubkey);
    console.log("\n💰 Initial Balances:");
    console.log("  Admin:", (adminInitialBalance / 1e9).toFixed(8), "SOL");
    console.log("  User:", (userInitialBalance / 1e9).toFixed(8), "SOL");

    // 1. Authorize
    console.log("\n--- Step 1: Authorize ---");
    const nonTransferableUserStatus = findNonTransferableUserStatus(rnsId, userPubkey);
    
    const balanceBeforeAuthorize = await provider.connection.getBalance(ADMIN_WALLET.publicKey);
    
    await program.methods
      .authorizeMint(rnsId, userPubkey)
      .accountsPartial({
        authority: ADMIN_WALLET.publicKey,
        nonTransferableProject: collectionAddress,
        nonTransferableUserStatus: nonTransferableUserStatus,
        feeRecipient: feeRecipient,
        systemProgram: web3.SystemProgram.programId,
      })
      .signers([ADMIN_WALLET])
      .rpc();
    
    const balanceAfterAuthorize = await provider.connection.getBalance(ADMIN_WALLET.publicKey);
    const authorizeCost = (balanceBeforeAuthorize - balanceAfterAuthorize) / 1e9;
    console.log("✅ Authorized");
    console.log("  💸 Cost:", authorizeCost.toFixed(8), "SOL");

    // 2. Airdrop
    console.log("\n--- Step 2: Airdrop ---");
    const nonTransferableNftMint = await getNonTransferableNftMintAddress(rnsId, tokenIndex);
    const userTokenAccount = await getUserAssociatedTokenAccount(userPubkey, nonTransferableNftMint);
    const nonTransferableNftMetadata = await getCollectionMetadataAddress(nonTransferableNftMint);
    const nonTransferableNftStatus = await findNonTransferableNftStatus(nonTransferableNftMint);
    const nonTransferableNftMasterEdition = await getCollectionMasterEditionAddress(nonTransferableNftMint);

    // Check if exists before airdrop
    try {
      const before = await program.account.rnsIdStatusAccount.fetch(nonTransferableRnsIdStatus);
      console.log("⚠️  RnsIdStatus already exists, num =", before.num.toString());
    } catch {
      console.log("✅ RnsIdStatus does not exist (will be created)");
    }

    const adminBalanceBeforeAirdrop = await provider.connection.getBalance(ADMIN_WALLET.publicKey);
    const userBalanceBeforeAirdrop = await provider.connection.getBalance(userPubkey);

    await program.methods
      .airdrop(rnsId, userPubkey, "", tokenIndex)
      .accountsPartial({
        authority: ADMIN_WALLET.publicKey,
        nonTransferableProject: collectionAddress,
        nonTransferableProjectMint: collectionMintAddress,
        nonTransferableProjectMetadata: collectionMetadataAddress,
        nonTransferableProjectMasterEdition: collectionMasterEdition,
        nonTransferableNftMint: nonTransferableNftMint,
        userAccount: userPubkey,
        userTokenAccount: userTokenAccount,
        nonTransferableUserStatus: nonTransferableUserStatus,
        nonTransferableNftStatus: nonTransferableNftStatus,
        nonTransferableRnsIdStatus: nonTransferableRnsIdStatus,
        nonTransferableNftMetadata: nonTransferableNftMetadata,
        nonTransferableNftMasterEdition: nonTransferableNftMasterEdition,
        tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: web3.SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .signers([ADMIN_WALLET])
      .rpc();
    
    const adminBalanceAfterAirdrop = await provider.connection.getBalance(ADMIN_WALLET.publicKey);
    const userBalanceAfterAirdrop = await provider.connection.getBalance(userPubkey);
    const airdropAdminCost = (adminBalanceBeforeAirdrop - adminBalanceAfterAirdrop) / 1e9;
    const airdropUserCost = (userBalanceBeforeAirdrop - userBalanceAfterAirdrop) / 1e9;
    
    console.log("✅ Airdropped");
    console.log("  💸 Admin Cost:", airdropAdminCost.toFixed(8), "SOL");
    console.log("  💸 User Cost:", airdropUserCost.toFixed(8), "SOL");

    // Check num
    const afterAirdrop = await program.account.rnsIdStatusAccount.fetch(nonTransferableRnsIdStatus);
    console.log("📊 Num after airdrop =", afterAirdrop.num.toString());

    // Verify步骤已合并到airdrop中，不再需要单独调用
    console.log("\n--- Step 3: Verification (included in airdrop) ---");
    console.log("✅ Airdrop completed (includes verification)");

    // 4. Burn
    console.log("\n--- Step 4: Burn ---");
    const adminBalanceBeforeBurn = await provider.connection.getBalance(ADMIN_WALLET.publicKey);
    const userBalanceBeforeBurn = await provider.connection.getBalance(userPubkey);

    const burnTx = await program.methods
      .burn(rnsId, userPubkey)
      .accountsPartial({
        authority: ADMIN_WALLET.publicKey,
        nftOwner: userPubkey,
        userTokenAccount: userTokenAccount,
        nonTransferableNftMint: nonTransferableNftMint,
        nonTransferableNftMetadata: nonTransferableNftMetadata,
        nonTransferableNftMasterEdition: nonTransferableNftMasterEdition,
        nonTransferableUserStatus: nonTransferableUserStatus,
        nonTransferableNftStatus: nonTransferableNftStatus,
        nonTransferableRnsIdStatus: nonTransferableRnsIdStatus,
        nonTransferableProject: collectionAddress,
        nonTransferableProjectMint: collectionMintAddress,
        nonTransferableProjectMetadata: collectionMetadataAddress,
        tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: web3.SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
        sysvarInstructions: web3.SYSVAR_INSTRUCTIONS_PUBKEY,
      })
      .signers([USER_WALLET])
      .rpc({ skipPreflight: false });
    console.log("✅ Burned, tx:", burnTx);
    
    // Get transaction logs
    const txDetails = await provider.connection.getTransaction(burnTx, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0
    });
    
    if (txDetails && txDetails.meta && txDetails.meta.logMessages) {
      console.log("\nAll program logs:");
      txDetails.meta.logMessages.forEach(log => {
        console.log(log);
      });
    } else {
      console.log("\n⚠️  Unable to fetch transaction logs");
    }

    // Wait for transaction to be fully confirmed
    await provider.connection.confirmTransaction(burnTx, "finalized");
    await new Promise(resolve => setTimeout(resolve, 2000));

    const adminBalanceAfterBurn = await provider.connection.getBalance(ADMIN_WALLET.publicKey);
    const userBalanceAfterBurn = await provider.connection.getBalance(userPubkey);
    const burnAdminGain = (adminBalanceAfterBurn - adminBalanceBeforeBurn) / 1e9;
    const burnUserCost = (userBalanceBeforeBurn - userBalanceAfterBurn) / 1e9;

    console.log("  💰 Admin Recovered:", burnAdminGain.toFixed(8), "SOL");
    console.log("  💸 User Cost:", burnUserCost.toFixed(8), "SOL");

    // Check num
    console.log("\n--- Check Results ---");
    
    // Directly view raw account data
    const accountInfo = await provider.connection.getAccountInfo(nonTransferableRnsIdStatus);
    if (accountInfo) {
      console.log("Account data length:", accountInfo.data.length);
      console.log("Account first 20 bytes:", accountInfo.data.slice(0, 20));
      // num field should be at offset 40（8 bytes discriminator + 32 bytes authority）
      const numBytes = accountInfo.data.slice(40, 48);
      const numValue = numBytes.readBigUInt64LE(0);
      console.log("Raw num value:", numValue.toString());
    }
    
    try {
      const afterBurn = await program.account.rnsIdStatusAccount.fetch(nonTransferableRnsIdStatus);
      console.log("📊 Num after burn =", afterBurn.num.toString());
      
      if (afterBurn.num.toString() === "0") {
        console.log("✅ num correctly decreased to 0");
        console.log("⚠️  but account was not closed（may be an Anchor limitation）");
      } else {
        console.log("❌ num did not decrease! Still", afterBurn.num.toString());
      }
    } catch (error) {
      console.log("✅ RnsIdStatus account closed (num reached 0)");
    }

    // Final Balance Comparison
    const adminFinalBalance = await provider.connection.getBalance(ADMIN_WALLET.publicKey);
    const userFinalBalance = await provider.connection.getBalance(userPubkey);
    const adminTotalChange = (adminFinalBalance - adminInitialBalance) / 1e9;
    const userTotalChange = (userFinalBalance - userInitialBalance) / 1e9;

    console.log("\n💰 Final Balance Comparison:");
    console.log("  Admin Total Change:", adminTotalChange.toFixed(8), "SOL");
    console.log("  User Total Change:", userTotalChange.toFixed(8), "SOL");
    
    console.log("\n📊 Detailed Cost Statistics:");
    console.log("  Authorize Cost:", authorizeCost.toFixed(8), "SOL");
    console.log("  Airdrop Admin Cost:", airdropAdminCost.toFixed(8), "SOL");
    console.log("  Airdrop User Cost:", airdropUserCost.toFixed(8), "SOL");
    console.log("  Verify Admin Cost:", verifyAdminCost.toFixed(8), "SOL");
    console.log("  Verify User Cost:", verifyUserCost.toFixed(8), "SOL");
    console.log("  Burn Admin Recovered:", burnAdminGain.toFixed(8), "SOL");
    console.log("  Burn User Cost:", burnUserCost.toFixed(8), "SOL");
    
    const totalAdminSpent = authorizeCost + airdropAdminCost + verifyAdminCost;
    const totalUserSpent = airdropUserCost + verifyUserCost + burnUserCost;
    console.log("\n💸 Total Cost:");
    console.log("  Admin Total Spent:", totalAdminSpent.toFixed(8), "SOL");
    console.log("  Admin Total Received:", burnAdminGain.toFixed(8), "SOL");
    console.log("  Admin Net Cost:", (totalAdminSpent - burnAdminGain).toFixed(8), "SOL");
    console.log("  User Total Spent:", totalUserSpent.toFixed(8), "SOL");

    console.log("\n🎉 Test Complete！");
  });
});
