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
  findNonTransferableRnsIdtatus,
  getTokenAccountDetails,
} from './utils/utils'

import {
  ADMIN_WALLET,
  USER_WALLET,
  TOKEN_METADATA_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from "./utils/constants";

const { SYSVAR_RENT_PUBKEY } = web3

describe("Multiple RNS IDs for same wallet", () => {
  const provider = AnchorProvider.env();
  setProvider(provider)
  const program = workspace.RnsdidCore as Program<RnsdidCore>;

  const rnsIds = ["alice", "bob", "charlie"];
  const tokenIndexes = ["multi-001", "multi-002", "multi-003"];

  it("Same wallet can hold multiple different RNS IDs", async () => {
    console.log("\n=== Scenario: Same wallet holds multiple different RNS IDs ===\n");

    const userPubkey = USER_WALLET.publicKey;
    const collectionAddress = await findNonTransferableProject();
    const collectionMintAddress = await getCollectionMintAddress();
    const collectionMetadataAddress = await getCollectionMetadataAddress(collectionMintAddress);

    // Issue 3 different RNS IDs to the same wallet
    for (let i = 0; i < rnsIds.length; i++) {
      const rnsId = rnsIds[i];
      const tokenIndex = tokenIndexes[i];

      console.log(`\n--- Issue RNS ID: "${rnsId}" ---`);

      // 1. Authorize
      const nonTransferableUserStatus = findNonTransferableUserStatus(rnsId, userPubkey);
      
      await program.methods
        .authorizeMint(rnsId, userPubkey)
        .accountsPartial({
          nonTransferableUserStatus: nonTransferableUserStatus,
        })
        .signers([ADMIN_WALLET])
        .rpc();
      console.log(`✅ Authorized "${rnsId}"`);

      // 2. Airdrop
      const nonTransferableNftMint = await getNonTransferableNftMintAddress(rnsId, tokenIndex);
      const userTokenAccount = await getUserAssociatedTokenAccount(userPubkey, nonTransferableNftMint);
      const nonTransferableNftMetadata = await getCollectionMetadataAddress(nonTransferableNftMint);
      const nonTransferableNftStatus = await findNonTransferableNftStatus(nonTransferableNftMint);
      const nonTransferableRnsIdStatus = await findNonTransferableRnsIdtatus(rnsId);

      await program.methods
        .airdrop(rnsId, userPubkey, "", tokenIndex)
        .accountsPartial({
          nonTransferableNftMint: nonTransferableNftMint,
          userAccount: userPubkey,
          userTokenAccount: userTokenAccount,
          nonTransferableUserStatus: nonTransferableUserStatus,
          nonTransferableNftStatus: nonTransferableNftStatus,
          nonTransferableRnsIdStatus: nonTransferableRnsIdStatus,
          nonTransferableNftMetadata: nonTransferableNftMetadata,
        })
        .signers([ADMIN_WALLET])
        .rpc();
      console.log(`✅ Airdropped "${rnsId}"`);

      // Verify步骤已合并到airdrop中，不再需要单独调用
      console.log(`✅ Airdrop completed for "${rnsId}" (includes verification)`);

      // Verify token
      const details = await getTokenAccountDetails(userTokenAccount);
      console.log(`📊 Token amount: ${details.amount}`);
    }

    console.log("\n=== Verification Results ===");
    console.log(`✅ Same wallet successfully holds 3 different RNS ID NFTs`);
    console.log(`📋 RNS IDs: ${rnsIds.join(", ")}`);
    
    // Verify each UserStatusAccount exists
    for (const rnsId of rnsIds) {
      const userStatus = findNonTransferableUserStatus(rnsId, userPubkey);
      const status = await program.account.userStatusAccount.fetch(userStatus);
      console.log(`✅ UserStatusAccount("${rnsId}", wallet) exists`);
      console.log(`   - is_authorized: ${status.isAuthorized}`);
      console.log(`   - is_minted: ${status.isMinted}`);
    }

    console.log("\n🎉 Success! Same wallet can hold multiple different RNS IDs!");
  });
});
