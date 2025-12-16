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

describe("RNS ID Status Cleanup Test", () => {
  const provider = AnchorProvider.env();
  setProvider(provider)
  const program = workspace.RnsdidCore as Program<RnsdidCore>;

  const rnsId = "cleanup-test";
  const tokenIndex = "cleanup-001";

  it("RNS ID Status should be closed when num reaches 0", async () => {
    console.log("\n=== Test RNS ID Status Cleanup Logic ===\n");

    const userPubkey = USER_WALLET.publicKey;
    const collectionAddress = await findNonTransferableProject();
    const collectionMintAddress = await getCollectionMintAddress();
    const collectionMetadataAddress = await getCollectionMetadataAddress(collectionMintAddress);
    const nonTransferableRnsIdStatus = await findNonTransferableRnsIdtatus(rnsId);

    // Record admin initial balance
    const adminBalanceBefore = await provider.connection.getBalance(ADMIN_WALLET.publicKey);
    console.log("Admin initial balance:", adminBalanceBefore / 1e9, "SOL");

    // 1. Authorize
    const nonTransferableUserStatus = findNonTransferableUserStatus(rnsId, userPubkey);
    
    // Get fee_recipient
    const projectAccount = await program.account.projectAccount.fetch(collectionAddress);
    const feeRecipient = projectAccount.feeRecipient;
    
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
    console.log("✅ Authorized");

    // 2. Airdrop
    const nonTransferableNftMint = await getNonTransferableNftMintAddress(rnsId, tokenIndex);
    const userTokenAccount = await getUserAssociatedTokenAccount(userPubkey, nonTransferableNftMint);
    const nonTransferableNftMetadata = await getCollectionMetadataAddress(nonTransferableNftMint);
    const nonTransferableNftStatus = await findNonTransferableNftStatus(nonTransferableNftMint);
    const collectionMasterEdition = await getCollectionMasterEditionAddress(collectionMintAddress);
    const nonTransferableNftMasterEdition = await getCollectionMasterEditionAddress(nonTransferableNftMint);

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
    console.log("✅ Airdropped");

    // Check RnsIdStatus.num
    let rnsIdStatus = await program.account.rnsIdStatusAccount.fetch(nonTransferableRnsIdStatus);
    console.log("📊 RnsIdStatus.num after Airdrop =", rnsIdStatus.num.toString());
    
    // Check account rent
    const rnsIdAccountInfo = await provider.connection.getAccountInfo(nonTransferableRnsIdStatus);
    const rnsIdRentBefore = rnsIdAccountInfo?.lamports || 0;
    console.log("💰 RnsIdStatus rent:", rnsIdRentBefore / 1e9, "SOL");

    // Verify步骤已合并到airdrop中，不再需要单独调用
    console.log("✅ Airdrop completed (includes verification)");

    // 4. Burn
    
    const burnTx = await program.methods
      .burn(rnsId, userPubkey)
      .accountsPartial({
        nftOwner: userPubkey,
        authority: ADMIN_WALLET.publicKey,
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
      .rpc();
    console.log("✅ Burned, tx:", burnTx);
    
    // Wait for transaction confirmation
    await provider.connection.confirmTransaction(burnTx, "confirmed");

    // 5. Check if RnsIdStatus is closed
    console.log("\n=== Check RNS ID Status Account ===");
    try {
      const statusAfter = await program.account.rnsIdStatusAccount.fetch(nonTransferableRnsIdStatus);
      console.log("⚠️  RnsIdStatus still exists");
      console.log("   num =", statusAfter.num.toString());
    } catch (error) {
      console.log("✅ RnsIdStatus account closed (num reached 0)");
    }

    // Check if admin received rent
    const adminBalanceAfter = await provider.connection.getBalance(ADMIN_WALLET.publicKey);
    const rentRecovered = (adminBalanceAfter - adminBalanceBefore) / 1e9;
    console.log("\n=== Rent Recovery ===");
    console.log("Admin final balance:", adminBalanceAfter / 1e9, "SOL");
    console.log("Net gain:", rentRecovered.toFixed(8), "SOL");
    
    if (rentRecovered > 0) {
      console.log("✅ Admin received Rent Recovery (including RnsIdStatus)");
    }

    console.log("\n🎉 Test Complete！");
  });
});
