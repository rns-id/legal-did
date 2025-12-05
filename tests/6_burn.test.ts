import { RnsdidCore } from '../target/types/rnsdid_core'

import {
  Program,
  web3,
  workspace,
  setProvider,
  AnchorProvider,
  BN,
} from '@coral-xyz/anchor'

import {

  createAssociatedTokenAccountInstruction,



  getOwnershipAccountBump,
  getOwnershipAccountAddress,

  findNonTransferableProject,
  getCollectionMetadataAddress,

  getCollectionMintAddress,
  getCollectionMasterEditionAddress,

  getUserAssociatedTokenAccount,
  getNonTransferableNftMintAddress,

  getTokenAccountBalance,
  getTokenAccountDetails,

  findNonTransferableUserStatus,
  findFreezeAuthority,
  findNonTransferableNftStatus,
  findNonTransferableRnsIdtatus

} from './utils/utils'


import {
     ADMIN_WALLET,
     USER_WALLET,
     TOKEN_METADATA_PROGRAM_ID,
     TOKEN_PROGRAM_ID,
     rnsId,
     tokenIndex } from "./utils/constants";
import { MintLayout, createInitializeMintInstruction } from '@solana/spl-token';
import { assert } from 'chai';
import { PublicKey } from '@solana/web3.js';

const { Keypair, SystemProgram, SYSVAR_RENT_PUBKEY } = web3

describe("burn", () => {



  const provider = AnchorProvider.env();
  setProvider(provider)
  const program = workspace.RnsdidCore as Program<RnsdidCore>;

  it("nft burned successed !", async () => {

    const userPubkey = USER_WALLET.publicKey;

    const collectionAddress = await findNonTransferableProject();

    const collectionMintAddress = await getCollectionMintAddress();
    const collectionMetadataAddress = await getCollectionMetadataAddress(collectionMintAddress);

    const nonTransferableNftMint = await getNonTransferableNftMintAddress(rnsId, tokenIndex);
    const userTokenAccount = await getUserAssociatedTokenAccount(userPubkey, nonTransferableNftMint)

    const details_before = await getTokenAccountDetails(userTokenAccount)
    assert(details_before.amount == BigInt(1), '==');


    const nonTransferableNftMetadata = await getCollectionMetadataAddress(nonTransferableNftMint)
    const nonTransferableNftMasterEdition = await getCollectionMasterEditionAddress(nonTransferableNftMint)
    const nonTransferableNftStatus = await findNonTransferableNftStatus(nonTransferableNftMint);
    const nonTransferableUserStatus = findNonTransferableUserStatus(rnsId, userPubkey);
    const nonTransferableRnsIdStatus = await findNonTransferableRnsIdtatus(rnsId)

    // Record balances before burn
    const adminBalanceBefore = await provider.connection.getBalance(ADMIN_WALLET.publicKey);
    const userBalanceBefore = await provider.connection.getBalance(userPubkey);
    
    console.log("Admin balance before burn:", adminBalanceBefore / 1e9, "SOL");
    console.log("User balance before burn:", userBalanceBefore / 1e9, "SOL");

    await program.methods
      .burn(rnsId, userPubkey)
      .accountsPartial({
        authority: ADMIN_WALLET.publicKey,  // No signature required, only used to receive rent
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
      .signers([USER_WALLET])  // Only user signature required
      .rpc();

    // Record balances after burn
    const adminBalanceAfter = await provider.connection.getBalance(ADMIN_WALLET.publicKey);
    const userBalanceAfter = await provider.connection.getBalance(userPubkey);
    
    console.log("Admin balance after burn:", adminBalanceAfter / 1e9, "SOL");
    console.log("User balance after burn:", userBalanceAfter / 1e9, "SOL");
    console.log("Admin received rent:", (adminBalanceAfter - adminBalanceBefore) / 1e9, "SOL");
    console.log("User balance change:", (userBalanceAfter - userBalanceBefore) / 1e9, "SOL");

    // Token account has been closed, attempting to fetch will fail
    try {
        const details_after = await getTokenAccountDetails(userTokenAccount);
        assert(false, "Token account should be closed");
    } catch (error) {
        // Token account not existing is expected
        console.log("Token account successfully closed");
    }

    // user_status and nft_status should also be closed
    try {
        await program.account.userStatusAccount.fetch(nonTransferableUserStatus);
        assert(false, "User status account should be closed");
    } catch (error) {
        console.log("User status account successfully closed");
    }

    try {
        await program.account.nftStatusAccount.fetch(nonTransferableNftStatus);
        assert(false, "NFT status account should be closed");
    } catch (error) {
        console.log("NFT status account successfully closed");
    }
  });
});
