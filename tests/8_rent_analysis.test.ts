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
  getUserAssociatedTokenAccount,
  getNonTransferableNftMintAddress,
  findNonTransferableUserStatus,
  findNonTransferableNftStatus,
  findNonTransferableRnsIdtatus
} from './utils/utils'

import {
  ADMIN_WALLET,
  USER_WALLET,
  TOKEN_METADATA_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from "./utils/constants";

const { SYSVAR_RENT_PUBKEY } = web3

describe("Rent Analysis - Complete Lifecycle", () => {
  const provider = AnchorProvider.env();
  setProvider(provider)
  const program = workspace.RnsdidCore as Program<RnsdidCore>;

  const rnsId = "rent-test";
  const tokenIndex = "rent-test-001";

  it("Track rent through complete NFT lifecycle", async () => {
    const userPubkey = USER_WALLET.publicKey;

    // Record initial balances
    const adminBalanceStart = await provider.connection.getBalance(ADMIN_WALLET.publicKey);
    const userBalanceStart = await provider.connection.getBalance(userPubkey);

    console.log("\n=== Initial Balances ===");
    console.log("Admin:", adminBalanceStart / 1e9, "SOL");
    console.log("User:", userBalanceStart / 1e9, "SOL");

    // 1. Authorize Mint
    const collectionAddress = await findNonTransferableProject();
    const nonTransferableUserStatus = findNonTransferableUserStatus(rnsId, userPubkey);

    await program.methods
      .authorizeMint(rnsId, userPubkey)
      .accountsPartial({
        authority: ADMIN_WALLET.publicKey,
        nonTransferableProject: collectionAddress,
        nonTransferableUserStatus: nonTransferableUserStatus,
        feeRecipient: ADMIN_WALLET.publicKey,
        systemProgram: web3.SystemProgram.programId,
        rent: web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([ADMIN_WALLET])
      .rpc();

    const adminBalanceAfterAuth = await provider.connection.getBalance(ADMIN_WALLET.publicKey);
    console.log("\n=== After Authorize ===");
    console.log("Admin:", adminBalanceAfterAuth / 1e9, "SOL");
    console.log("Cost:", (adminBalanceStart - adminBalanceAfterAuth) / 1e9, "SOL");

    // 2. Airdrop (Create NFT)
    const collectionMintAddress = await getCollectionMintAddress();
    const collectionMetadataAddress = await getCollectionMetadataAddress(collectionMintAddress);
    const nonTransferableNftMint = await getNonTransferableNftMintAddress(rnsId, tokenIndex);
    const userTokenAccount = await getUserAssociatedTokenAccount(userPubkey, nonTransferableNftMint);
    const nonTransferableNftMetadata = await getCollectionMetadataAddress(nonTransferableNftMint);
    const nonTransferableNftStatus = await findNonTransferableNftStatus(nonTransferableNftMint);
    const nonTransferableRnsIdStatus = await findNonTransferableRnsIdtatus(rnsId);

    await program.methods
      .airdrop(rnsId, userPubkey, "", tokenIndex)
      .accountsPartial({
        authority: ADMIN_WALLET.publicKey,
        nonTransferableProject: collectionAddress,
        nonTransferableProjectMint: collectionMintAddress,
        nonTransferableProjectMetadata: collectionMetadataAddress,
        nonTransferableNftMint: nonTransferableNftMint,
        userAccount: userPubkey,
        userTokenAccount: userTokenAccount,
        nonTransferableUserStatus: nonTransferableUserStatus,
        nonTransferableNftStatus: nonTransferableNftStatus,
        nonTransferableRnsIdStatus: nonTransferableRnsIdStatus,
        nonTransferableNftMetadata: nonTransferableNftMetadata,
        tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: web3.SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .signers([ADMIN_WALLET])
      .rpc();

    const adminBalanceAfterAirdrop = await provider.connection.getBalance(ADMIN_WALLET.publicKey);
    console.log("\n=== After Airdrop（NFT Created）===");
    console.log("Admin:", adminBalanceAfterAirdrop / 1e9, "SOL");
    console.log("Cost:", (adminBalanceAfterAuth - adminBalanceAfterAirdrop) / 1e9, "SOL");

    // Check created account sizes and rent
    const mintAccount = await provider.connection.getAccountInfo(nonTransferableNftMint);
    const tokenAccount = await provider.connection.getAccountInfo(userTokenAccount);
    const metadataAccount = await provider.connection.getAccountInfo(nonTransferableNftMetadata);
    const userStatusAccount = await provider.connection.getAccountInfo(nonTransferableUserStatus);
    const nftStatusAccount = await provider.connection.getAccountInfo(nonTransferableNftStatus);
    const rnsIdStatusAccount = await provider.connection.getAccountInfo(nonTransferableRnsIdStatus);

    console.log("\n=== Account Rent Details ===");
    console.log("NFT Mint:", mintAccount?.lamports ? (mintAccount.lamports / 1e9).toFixed(8) : "0", "SOL", `(${mintAccount?.data.length} bytes)`);
    console.log("Token Account:", tokenAccount?.lamports ? (tokenAccount.lamports / 1e9).toFixed(8) : "0", "SOL", `(${tokenAccount?.data.length} bytes)`);
    console.log("Metadata:", metadataAccount?.lamports ? (metadataAccount.lamports / 1e9).toFixed(8) : "0", "SOL", `(${metadataAccount?.data.length} bytes)`);
    console.log("User Status:", userStatusAccount?.lamports ? (userStatusAccount.lamports / 1e9).toFixed(8) : "0", "SOL", `(${userStatusAccount?.data.length} bytes)`);
    console.log("NFT Status:", nftStatusAccount?.lamports ? (nftStatusAccount.lamports / 1e9).toFixed(8) : "0", "SOL", `(${nftStatusAccount?.data.length} bytes)`);
    console.log("RNS ID Status:", rnsIdStatusAccount?.lamports ? (rnsIdStatusAccount.lamports / 1e9).toFixed(8) : "0", "SOL", `(${rnsIdStatusAccount?.data.length} bytes)`);

    const totalRent = (mintAccount?.lamports || 0) + 
                      (tokenAccount?.lamports || 0) + 
                      (metadataAccount?.lamports || 0) + 
                      (userStatusAccount?.lamports || 0) + 
                      (nftStatusAccount?.lamports || 0) + 
                      (rnsIdStatusAccount?.lamports || 0);
    console.log("Total Rent:", (totalRent / 1e9).toFixed(8), "SOL");

    // Verify步骤已合并到airdrop中，不再需要单独调用
    const adminBalanceAfterVerify = adminBalanceAfterAirdrop; // 现在verify包含在airdrop中
    console.log("\n=== After Airdrop (includes verification) ===");
    console.log("Admin:", adminBalanceAfterVerify / 1e9, "SOL");
    console.log("Verify cost: 0 SOL (included in airdrop)");

    // 4. Burn
    const nonTransferableNftMasterEdition = await getCollectionMetadataAddress(nonTransferableNftMint);

    await program.methods
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
      .rpc();

    const adminBalanceEnd = await provider.connection.getBalance(ADMIN_WALLET.publicKey);
    const userBalanceEnd = await provider.connection.getBalance(userPubkey);

    console.log("\n=== After Burn（Final）===");
    console.log("Admin:", adminBalanceEnd / 1e9, "SOL");
    console.log("User:", userBalanceEnd / 1e9, "SOL");

    console.log("\n=== Complete Lifecycle Summary ===");
    console.log("Admin Total Spent:", (adminBalanceStart - adminBalanceEnd) / 1e9, "SOL");
    console.log("User Net Gain:", (userBalanceEnd - userBalanceStart) / 1e9, "SOL");
    console.log("Admin Net Cost:", (adminBalanceStart - adminBalanceEnd) / 1e9, "SOL", "/ NFT");

    // Check which accounts still exist
    const mintAfterBurn = await provider.connection.getAccountInfo(nonTransferableNftMint);
    const rnsIdAfterBurn = await provider.connection.getAccountInfo(nonTransferableRnsIdStatus);

    console.log("\n=== Accounts still existing after Burn (unrecovered rent)===");
    if (mintAfterBurn) {
      console.log("NFT Mint:", (mintAfterBurn.lamports / 1e9).toFixed(8), "SOL");
    }
    if (rnsIdAfterBurn) {
      console.log("RNS ID Status:", (rnsIdAfterBurn.lamports / 1e9).toFixed(8), "SOL");
    }
    const unrecoveredRent = (mintAfterBurn?.lamports || 0) + (rnsIdAfterBurn?.lamports || 0);
    console.log("Total unrecovered:", (unrecoveredRent / 1e9).toFixed(8), "SOL");
  });
});
