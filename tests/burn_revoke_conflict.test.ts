import { RnsdidCore } from '../target/types/rnsdid_core'

import { ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token'
import {
    Program,
    web3,
    workspace,
    setProvider,
    AnchorProvider,
} from '@coral-xyz/anchor'

import {
    findNonTransferableProject,
    getCollectionMintAddress,
    getUserAssociatedTokenAccount,
    getNonTransferableNftMintAddress,
    findNonTransferableUserStatus,
    findNonTransferableNftStatus,
    findNonTransferableRnsIdtatus,
} from './utils/utils'

import {
    ADMIN_WALLET, TOKEN_PROGRAM_ID,
} from "./utils/constants";
import { assert } from 'chai';
import { ComputeBudgetProgram } from '@solana/web3.js';
const { SYSVAR_RENT_PUBKEY } = web3

describe("burn revoke conflict tests", () => {

    const provider = AnchorProvider.env();
    setProvider(provider)
    const program = workspace.RnsdidCore as Program<RnsdidCore>;

    const set_compute_unit_limit_ix = ComputeBudgetProgram.setComputeUnitLimit({
        units: 1_000_000,
    });

    it("test 1: burn then try revoke (should fail)", async () => {
        const rnsId = `burn-then-revoke-${Date.now()}`;
        const tokenIndex = "1";
        const testUser = web3.Keypair.generate();
        
        const nonTransferableProject = await findNonTransferableProject();
        const nonTransferableProjectMint = await getCollectionMintAddress();
        const nonTransferableUserStatus = findNonTransferableUserStatus(rnsId, testUser.publicKey);
        const nonTransferableNftMint = await getNonTransferableNftMintAddress(rnsId, tokenIndex);
        const userAssociatedTokenAccount = await getUserAssociatedTokenAccount(testUser.publicKey, nonTransferableNftMint)
        const nonTransferableNftStatus = await findNonTransferableNftStatus(nonTransferableNftMint);
        const nonTransferableRnsIdStatus = await findNonTransferableRnsIdtatus(rnsId)

        const airdropAccounts = {
            authority: ADMIN_WALLET.publicKey,
            userAccount: testUser.publicKey,
            userTokenAccount: userAssociatedTokenAccount,
            nonTransferableUserStatus: nonTransferableUserStatus,
            nonTransferableNftStatus: nonTransferableNftStatus,
            nonTransferableRnsIdStatus: nonTransferableRnsIdStatus,
            nonTransferableNftMint: nonTransferableNftMint,
            nonTransferableProject: nonTransferableProject,
            nonTransferableProjectMint: nonTransferableProjectMint,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: web3.SystemProgram.programId,
            rent: SYSVAR_RENT_PUBKEY,
        };

        // Step 1: Airdrop
        await program.methods.airdrop(
            rnsId,
            testUser.publicKey,
            "test-merkle-root",
            tokenIndex
        )
            .accounts(airdropAccounts)
            .preInstructions([set_compute_unit_limit_ix])
            .signers([ADMIN_WALLET])
            .rpc();

        console.log("✅ Airdrop completed");

        // Step 2: User burns their NFT
        const burnAccounts = {
            authority: ADMIN_WALLET.publicKey,
            nftOwner: testUser.publicKey,
            userTokenAccount: userAssociatedTokenAccount,
            nonTransferableNftMint: nonTransferableNftMint,
            nonTransferableUserStatus: nonTransferableUserStatus,
            nonTransferableNftStatus: nonTransferableNftStatus,
            nonTransferableRnsIdStatus: nonTransferableRnsIdStatus,
            nonTransferableProject: nonTransferableProject,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: web3.SystemProgram.programId,
            rent: SYSVAR_RENT_PUBKEY,
        };

        await program.methods.burn(rnsId, testUser.publicKey)
            .accounts(burnAccounts)
            .signers([testUser])
            .rpc();

        console.log("✅ Burn completed");

        // Step 3: Try to revoke (should fail because accounts are closed)
        const revokeAccounts = {
            authority: ADMIN_WALLET.publicKey,
            nonTransferableProject: nonTransferableProject,
            userAccount: testUser.publicKey,
            userTokenAccount: userAssociatedTokenAccount,
            nonTransferableUserStatus: nonTransferableUserStatus,
            nonTransferableRnsIdStatus: nonTransferableRnsIdStatus,
            nonTransferableNftStatus: nonTransferableNftStatus,
            nonTransferableNftMint: nonTransferableNftMint,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: web3.SystemProgram.programId,
        };

        try {
            await program.methods.revoke(rnsId, testUser.publicKey)
                .accounts(revokeAccounts)
                .preInstructions([set_compute_unit_limit_ix])
                .signers([ADMIN_WALLET])
                .rpc();
            
            assert.fail("Revoke should fail after burn");
        } catch (error) {
            console.log("✅ Revoke correctly failed after burn:", error.message);
        }
    });

    it("test 2: revoke then try burn (should fail)", async () => {
        const rnsId = `revoke-then-burn-${Date.now()}`;
        const tokenIndex = "2";
        const testUser = web3.Keypair.generate();
        
        const nonTransferableProject = await findNonTransferableProject();
        const nonTransferableProjectMint = await getCollectionMintAddress();
        const nonTransferableUserStatus = findNonTransferableUserStatus(rnsId, testUser.publicKey);
        const nonTransferableNftMint = await getNonTransferableNftMintAddress(rnsId, tokenIndex);
        const userAssociatedTokenAccount = await getUserAssociatedTokenAccount(testUser.publicKey, nonTransferableNftMint)
        const nonTransferableNftStatus = await findNonTransferableNftStatus(nonTransferableNftMint);
        const nonTransferableRnsIdStatus = await findNonTransferableRnsIdtatus(rnsId)

        const airdropAccounts = {
            authority: ADMIN_WALLET.publicKey,
            userAccount: testUser.publicKey,
            userTokenAccount: userAssociatedTokenAccount,
            nonTransferableUserStatus: nonTransferableUserStatus,
            nonTransferableNftStatus: nonTransferableNftStatus,
            nonTransferableRnsIdStatus: nonTransferableRnsIdStatus,
            nonTransferableNftMint: nonTransferableNftMint,
            nonTransferableProject: nonTransferableProject,
            nonTransferableProjectMint: nonTransferableProjectMint,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: web3.SystemProgram.programId,
            rent: SYSVAR_RENT_PUBKEY,
        };

        // Step 1: Airdrop
        await program.methods.airdrop(
            rnsId,
            testUser.publicKey,
            "test-merkle-root",
            tokenIndex
        )
            .accounts(airdropAccounts)
            .preInstructions([set_compute_unit_limit_ix])
            .signers([ADMIN_WALLET])
            .rpc();

        console.log("✅ Airdrop completed");

        // Step 2: Admin revokes the NFT
        const revokeAccounts = {
            authority: ADMIN_WALLET.publicKey,
            nonTransferableProject: nonTransferableProject,
            userAccount: testUser.publicKey,
            userTokenAccount: userAssociatedTokenAccount,
            nonTransferableUserStatus: nonTransferableUserStatus,
            nonTransferableRnsIdStatus: nonTransferableRnsIdStatus,
            nonTransferableNftStatus: nonTransferableNftStatus,
            nonTransferableNftMint: nonTransferableNftMint,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: web3.SystemProgram.programId,
        };

        await program.methods.revoke(rnsId, testUser.publicKey)
            .accounts(revokeAccounts)
            .preInstructions([set_compute_unit_limit_ix])
            .signers([ADMIN_WALLET])
            .rpc();

        console.log("✅ Revoke completed");

        // Step 3: Try to burn (should fail because status accounts are closed)
        const burnAccounts = {
            authority: ADMIN_WALLET.publicKey,
            nftOwner: testUser.publicKey,
            userTokenAccount: userAssociatedTokenAccount,
            nonTransferableNftMint: nonTransferableNftMint,
            nonTransferableUserStatus: nonTransferableUserStatus,
            nonTransferableNftStatus: nonTransferableNftStatus,
            nonTransferableRnsIdStatus: nonTransferableRnsIdStatus,
            nonTransferableProject: nonTransferableProject,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: web3.SystemProgram.programId,
            rent: SYSVAR_RENT_PUBKEY,
        };

        try {
            await program.methods.burn(rnsId, testUser.publicKey)
                .accounts(burnAccounts)
                .signers([testUser])
                .rpc();
            
            assert.fail("Burn should fail after revoke");
        } catch (error) {
            console.log("✅ Burn correctly failed after revoke:", error.message);
        }
    });
});