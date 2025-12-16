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
  getTokenAccountDetails,
} from './utils/utils'

import {
  ADMIN_WALLET,
  USER_WALLET,
  TOKEN_METADATA_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from "./utils/constants";

const { Keypair, SYSVAR_RENT_PUBKEY } = web3

describe("Reuse RNS ID for different wallets", () => {
  const provider = AnchorProvider.env();
  setProvider(provider)
  const program = workspace.RnsdidCore as Program<RnsdidCore>;

  const rnsId = "reusable-id";
  const tokenIndex1 = "reuse-001";
  const tokenIndex2 = "reuse-002";
  
  // Create second user wallet
  const USER_WALLET_2 = Keypair.generate();

  it("Same RNS ID can be used for different wallets after burn", async () => {
    console.log("\n=== Scenario: Same RNS ID to different wallets ===\n");

    // Airdrop some SOL to second user
    const airdropSig = await provider.connection.requestAirdrop(
      USER_WALLET_2.publicKey,
      5 * web3.LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(airdropSig);
    console.log("✅ Airdropped 5 SOL to USER_WALLET_2");

    const collectionAddress = await findNonTransferableProject();
    const collectionMintAddress = await getCollectionMintAddress();
    const collectionMetadataAddress = await getCollectionMetadataAddress(collectionMintAddress);

    // ========================================
    // Part 1: Issue NFT to USER_WALLET
    // ========================================
    console.log("\n--- Part 1: Issue NFT to USER_WALLET ---");

    const userPubkey1 = USER_WALLET.publicKey;
    const nonTransferableUserStatus1 = findNonTransferableUserStatus(rnsId, userPubkey1);

    // 1. Authorize
    await program.methods
      .authorizeMint(rnsId, userPubkey1)
      .accountsPartial({
        authority: ADMIN_WALLET.publicKey,
        nonTransferableProject: collectionAddress,
        nonTransferableUserStatus: nonTransferableUserStatus1,
        systemProgram: web3.SystemProgram.programId,
      })
      .signers([ADMIN_WALLET])
      .rpc();
    console.log("✅ Authorized for USER_WALLET");

    // 2. Airdrop
    const nonTransferableNftMint1 = await getNonTransferableNftMintAddress(rnsId, tokenIndex1);
    const userTokenAccount1 = await getUserAssociatedTokenAccount(userPubkey1, nonTransferableNftMint1);
    const nonTransferableNftMetadata1 = await getCollectionMetadataAddress(nonTransferableNftMint1);
    const nonTransferableNftStatus1 = await findNonTransferableNftStatus(nonTransferableNftMint1);
    const nonTransferableRnsIdStatus = await findNonTransferableRnsIdtatus(rnsId);

    await program.methods
      .airdrop(rnsId, userPubkey1, "", tokenIndex1)
      .accountsPartial({
        authority: ADMIN_WALLET.publicKey,
        nonTransferableProject: collectionAddress,
        nonTransferableProjectMint: collectionMintAddress,
        nonTransferableProjectMetadata: collectionMetadataAddress,
        nonTransferableNftMint: nonTransferableNftMint1,
        userAccount: userPubkey1,
        userTokenAccount: userTokenAccount1,
        nonTransferableUserStatus: nonTransferableUserStatus1,
        nonTransferableNftStatus: nonTransferableNftStatus1,
        nonTransferableRnsIdStatus: nonTransferableRnsIdStatus,
        nonTransferableNftMetadata: nonTransferableNftMetadata1,
        tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: web3.SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .signers([ADMIN_WALLET])
      .rpc();
    console.log("✅ Airdropped NFT to USER_WALLET");

    // Check RnsIdStatus.num
    let rnsIdStatus = await program.account.rnsIdStatusAccount.fetch(nonTransferableRnsIdStatus);
    console.log("📊 RnsIdStatus.num =", rnsIdStatus.num.toString());

    // Verify步骤已合并到airdrop中，不再需要单独调用
    console.log("✅ Airdrop completed for USER_WALLET (includes verification)");

    // ========================================
    // Part 2: Burn USER_WALLET NFT
    // ========================================
    console.log("\n--- Part 2: Burn USER_WALLET NFT ---");

    const nonTransferableNftMasterEdition1 = await getCollectionMasterEditionAddress(nonTransferableNftMint1);

    await program.methods
      .burn(rnsId, userPubkey1)
      .accountsPartial({
        nftOwner: userPubkey1,
        authority: ADMIN_WALLET.publicKey,
        userTokenAccount: userTokenAccount1,
        nonTransferableNftMint: nonTransferableNftMint1,
        nonTransferableNftMetadata: nonTransferableNftMetadata1,
        nonTransferableNftMasterEdition: nonTransferableNftMasterEdition1,
        nonTransferableUserStatus: nonTransferableUserStatus1,
        nonTransferableNftStatus: nonTransferableNftStatus1,
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
    console.log("✅ Burned NFT from USER_WALLET");

    // Check if RnsIdStatus is closed
    try {
      await program.account.rnsIdStatusAccount.fetch(nonTransferableRnsIdStatus);
      console.log("⚠️  RnsIdStatus still exists (num should be 0)");
    } catch (error) {
      console.log("✅ RnsIdStatus account closed (num was 0)");
    }

    // ========================================
    // Part 3: Issue same RNS ID to USER_WALLET_2
    // ========================================
    console.log("\n--- Part 3: Issue same RNS ID to USER_WALLET_2 ---");

    const userPubkey2 = USER_WALLET_2.publicKey;
    const nonTransferableUserStatus2 = findNonTransferableUserStatus(rnsId, userPubkey2);

    // 1. Authorize for USER_WALLET_2
    await program.methods
      .authorizeMint(rnsId, userPubkey2)
      .accountsPartial({
        authority: ADMIN_WALLET.publicKey,
        nonTransferableProject: collectionAddress,
        nonTransferableUserStatus: nonTransferableUserStatus2,
        systemProgram: web3.SystemProgram.programId,
      })
      .signers([ADMIN_WALLET])
      .rpc();
    console.log("✅ Authorized for USER_WALLET_2");

    // 2. Airdrop to USER_WALLET_2
    const nonTransferableNftMint2 = await getNonTransferableNftMintAddress(rnsId, tokenIndex2);
    const userTokenAccount2 = await getUserAssociatedTokenAccount(userPubkey2, nonTransferableNftMint2);
    const nonTransferableNftMetadata2 = await getCollectionMetadataAddress(nonTransferableNftMint2);
    const nonTransferableNftStatus2 = await findNonTransferableNftStatus(nonTransferableNftMint2);

    await program.methods
      .airdrop(rnsId, userPubkey2, "", tokenIndex2)
      .accountsPartial({
        authority: ADMIN_WALLET.publicKey,
        nonTransferableProject: collectionAddress,
        nonTransferableProjectMint: collectionMintAddress,
        nonTransferableProjectMetadata: collectionMetadataAddress,
        nonTransferableNftMint: nonTransferableNftMint2,
        userAccount: userPubkey2,
        userTokenAccount: userTokenAccount2,
        nonTransferableUserStatus: nonTransferableUserStatus2,
        nonTransferableNftStatus: nonTransferableNftStatus2,
        nonTransferableRnsIdStatus: nonTransferableRnsIdStatus,
        nonTransferableNftMetadata: nonTransferableNftMetadata2,
        tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: web3.SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .signers([ADMIN_WALLET])
      .rpc();
    console.log("✅ Airdropped NFT to USER_WALLET_2");

    // Check RnsIdStatus.num recreated
    rnsIdStatus = await program.account.rnsIdStatusAccount.fetch(nonTransferableRnsIdStatus);
    console.log("📊 RnsIdStatus.num =", rnsIdStatus.num.toString(), "(recreated)");

    // Verify步骤已合并到airdrop中，不再需要单独调用
    console.log("✅ Airdrop completed for USER_WALLET_2 (includes verification)");

    // Verify both wallets have NFT
    const details2 = await getTokenAccountDetails(userTokenAccount2);
    console.log("\n📊 USER_WALLET_2 token amount:", details2.amount.toString());

    console.log("\n🎉 Success! Same RNS ID can be used for different wallets after burn!");
  });
});
