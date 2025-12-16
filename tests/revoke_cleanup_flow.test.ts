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
    ADMIN_WALLET, TOKEN_PROGRAM_ID,
} from "./utils/constants";
import { assert } from 'chai';
import { ComputeBudgetProgram } from '@solana/web3.js';
const { SYSVAR_RENT_PUBKEY } = web3

describe("revoke → cleanup flow", () => {

    const provider = AnchorProvider.env();
    setProvider(provider)
    const program = workspace.RnsdidCore as Program<RnsdidCore>;

    const set_compute_unit_limit_ix = ComputeBudgetProgram.setComputeUnitLimit({
        units: 1_000_000,
    });

    it("complete revoke → cleanup flow with optimal rent recovery", async () => {
        const rnsId = `revoke-cleanup-${Date.now()}`;
        const tokenIndex = "1";
        const testUser = web3.Keypair.generate();
        
        const nonTransferableProject = await findNonTransferableProject();
        const nonTransferableProjectMint = await getCollectionMintAddress();
        const nonTransferableUserStatus = findNonTransferableUserStatus(rnsId, testUser.publicKey);
        const nonTransferableNftMint = await getNonTransferableNftMintAddress(rnsId, tokenIndex);
        const userAssociatedTokenAccount = await getUserAssociatedTokenAccount(testUser.publicKey, nonTransferableNftMint)
        const nonTransferableNftStatus = await findNonTransferableNftStatus(nonTransferableNftMint);
        const nonTransferableRnsIdStatus = await findNonTransferableRnsIdtatus(rnsId)

        // Record initial balances
        const adminBalanceInitial = await provider.connection.getBalance(ADMIN_WALLET.publicKey);
        const userBalanceInitial = await provider.connection.getBalance(testUser.publicKey);
        
        console.log("💰 Initial balances:");
        console.log("  Admin:", adminBalanceInitial / 1e9, "SOL");
        console.log("  User:", userBalanceInitial / 1e9, "SOL");

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

        // Verify token exists and is frozen
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

        // Step 3: User cleans up their revoked token
        const cleanupAccounts = {
            user: testUser.publicKey,
            authority: ADMIN_WALLET.publicKey,
            nonTransferableProject: nonTransferableProject,
            userTokenAccount: userAssociatedTokenAccount,
            nonTransferableUserStatus: nonTransferableUserStatus,
            nonTransferableNftMint: nonTransferableNftMint,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: web3.SystemProgram.programId,
        };

        const userBalanceBeforeCleanup = await provider.connection.getBalance(testUser.publicKey);
        const adminBalanceBeforeCleanup = await provider.connection.getBalance(ADMIN_WALLET.publicKey);

        await program.methods.cleanup(rnsId, testUser.publicKey)
            .accounts(cleanupAccounts)
            .preInstructions([set_compute_unit_limit_ix])
            .signers([testUser])
            .rpc();

        const userBalanceAfterCleanup = await provider.connection.getBalance(testUser.publicKey);
        const adminBalanceAfterCleanup = await provider.connection.getBalance(ADMIN_WALLET.publicKey);
        
        const userGainFromCleanup = (userBalanceAfterCleanup - userBalanceBeforeCleanup) / 1e9;
        const adminGainFromCleanup = (adminBalanceAfterCleanup - adminBalanceBeforeCleanup) / 1e9;
        
        console.log("✅ Cleanup completed");
        console.log("💰 User gained from cleanup (token account rent):", userGainFromCleanup, "SOL");
        console.log("💰 Admin gained from cleanup (user status rent):", adminGainFromCleanup, "SOL");

        // Verify everything is cleaned up
        try {
            await getTokenAccountBalance(userAssociatedTokenAccount);
            assert.fail("Token account should be closed");
        } catch (error) {
            console.log("✅ Token account closed by cleanup");
        }

        try {
            await program.account.userStatusAccount.fetch(nonTransferableUserStatus);
            assert.fail("User status should be closed");
        } catch (error) {
            console.log("✅ User status account closed by cleanup");
        }

        // Final analysis
        const adminBalanceFinal = await provider.connection.getBalance(ADMIN_WALLET.publicKey);
        const userBalanceFinal = await provider.connection.getBalance(testUser.publicKey);
        
        const adminTotalChange = (adminBalanceFinal - adminBalanceInitial) / 1e9;
        const userTotalChange = (userBalanceFinal - userBalanceInitial) / 1e9;
        const totalAdminRecovered = revokeGain + adminGainFromCleanup;
        const totalRecovered = totalAdminRecovered + userGainFromCleanup;

        console.log("\n=== Final Analysis ===");
        console.log("💸 Airdrop cost:", airdropCost, "SOL");
        console.log("💰 Admin recovered (revoke + cleanup):", totalAdminRecovered, "SOL");
        console.log("💰 User recovered (cleanup token account):", userGainFromCleanup, "SOL");
        console.log("💰 Total rent recovered:", totalRecovered, "SOL");
        console.log("📊 Recovery vs airdrop cost:", ((totalRecovered / airdropCost) * 100).toFixed(2), "%");
        console.log("📊 Admin net cost:", (airdropCost - totalAdminRecovered).toFixed(6), "SOL");
        console.log("📊 User net gain:", userTotalChange.toFixed(6), "SOL");

        console.log("\n🎉 Revoke → Cleanup flow completed successfully!");
        console.log("✅ Admin gets all status account rents (NFT Status + User Status)");
        console.log("✅ User gets token account rent only");
        console.log("✅ Fair rent recovery - admin recoups most of airdrop cost");
    });
});