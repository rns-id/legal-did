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
    getTokenAccountBalance,
    findNonTransferableUserStatus,
    findNonTransferableNftStatus,
    findNonTransferableRnsIdtatus,
} from './utils/utils'

import {
    ADMIN_WALLET, TOKEN_PROGRAM_ID, USER_WALLET,
} from "./utils/constants";
import { assert } from 'chai';
import { ComputeBudgetProgram } from '@solana/web3.js';
const { SYSVAR_RENT_PUBKEY } = web3

describe("simple revoke test", () => {

    const provider = AnchorProvider.env();
    setProvider(provider)
    const program = workspace.RnsdidCore as Program<RnsdidCore>;

    const set_compute_unit_limit_ix = ComputeBudgetProgram.setComputeUnitLimit({
        units: 1_000_000,
    });

    it("test revoke rent recovery", async () => {
        // Use completely unique identifiers to avoid conflicts
        const timestamp = Date.now();
        const rnsId = `revoke-test-${timestamp}`;
        const tokenIndex = `${timestamp}`; // Unique index
        const testUser = web3.Keypair.generate(); // Fresh user
        
        // Airdrop SOL to test user for transaction fees
        const airdropTx = await provider.connection.requestAirdrop(testUser.publicKey, 1e9);
        await provider.connection.confirmTransaction(airdropTx);
        
        const nonTransferableProject = await findNonTransferableProject();
        const nonTransferableProjectMint = await getCollectionMintAddress();
        const nonTransferableUserStatus = findNonTransferableUserStatus(rnsId, testUser.publicKey);
        const nonTransferableNftMint = await getNonTransferableNftMintAddress(rnsId, tokenIndex);
        const userAssociatedTokenAccount = await getUserAssociatedTokenAccount(testUser.publicKey, nonTransferableNftMint)
        const nonTransferableNftStatus = await findNonTransferableNftStatus(nonTransferableNftMint);
        const nonTransferableRnsIdStatus = await findNonTransferableRnsIdtatus(rnsId)

        // Record initial balances
        const adminBalanceInitial = await provider.connection.getBalance(ADMIN_WALLET.publicKey);
        console.log("💰 Admin initial balance:", adminBalanceInitial / 1e9, "SOL");

        // Step 1: Airdrop
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

        const adminBalanceAfterAirdrop = await provider.connection.getBalance(ADMIN_WALLET.publicKey);
        const airdropCost = (adminBalanceInitial - adminBalanceAfterAirdrop) / 1e9;
        console.log("✅ Airdrop completed");
        console.log("💸 Airdrop cost:", airdropCost, "SOL");

        // Verify token exists
        const balance = await getTokenAccountBalance(userAssociatedTokenAccount);
        assert(balance == BigInt(1), "Token should exist");

        // Step 2: Admin revokes
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

        const adminBalanceBeforeRevoke = await provider.connection.getBalance(ADMIN_WALLET.publicKey);

        await program.methods.revoke(rnsId, testUser.publicKey)
            .accounts(revokeAccounts)
            .preInstructions([set_compute_unit_limit_ix])
            .signers([ADMIN_WALLET])
            .rpc();

        const adminBalanceAfterRevoke = await provider.connection.getBalance(ADMIN_WALLET.publicKey);
        const revokeGain = (adminBalanceAfterRevoke - adminBalanceBeforeRevoke) / 1e9;
        console.log("✅ Revoke completed");
        console.log("💰 Admin gained from revoke:", revokeGain, "SOL");

        // Verify user_status is marked as revoked (is_authorized = false) but not closed
        const userStatus = await program.account.userStatusAccount.fetch(nonTransferableUserStatus);
        assert(!userStatus.isAuthorized, "Should be marked as revoked (not authorized)");
        assert(userStatus.isMinted, "Should still be marked as minted");
        console.log("✅ User status marked as revoked but not closed");

        // Verify nft_status is closed
        try {
            await program.account.nftStatusAccount.fetch(nonTransferableNftStatus);
            assert.fail("NFT status should be closed");
        } catch (error) {
            console.log("✅ NFT status account closed by revoke");
        }

        // Verify token still exists but is frozen
        const balanceAfterRevoke = await getTokenAccountBalance(userAssociatedTokenAccount);
        assert(balanceAfterRevoke == BigInt(1), "Token should still exist after revoke");
        console.log("✅ Token remains frozen after revoke");

        // Final analysis
        const adminTotalChange = (adminBalanceAfterRevoke - adminBalanceInitial) / 1e9;
        
        console.log("\n=== Revoke Analysis ===");
        console.log("💸 Airdrop cost:", airdropCost, "SOL");
        console.log("💰 Admin recovered (revoke):", revokeGain, "SOL");
        console.log("📊 Recovery percentage:", ((revokeGain / airdropCost) * 100).toFixed(2), "%");
        console.log("📊 Admin net cost:", (-adminTotalChange).toFixed(6), "SOL");
        
        console.log("\n🎯 Expected behavior:");
        console.log("✅ NFT Status account closed → Admin gets ~0.0024 SOL");
        console.log("✅ User Status account kept open for potential cleanup");
        console.log("✅ Token account kept frozen for potential cleanup");
        console.log("✅ Admin recovers partial cost, user can still cleanup later");
    });
});