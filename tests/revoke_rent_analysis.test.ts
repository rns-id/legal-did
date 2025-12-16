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

describe("revoke rent analysis", () => {

    const provider = AnchorProvider.env();
    setProvider(provider)
    const program = workspace.RnsdidCore as Program<RnsdidCore>;

    const rnsId = `revoke-rent-test-${Date.now()}`;
    const tokenIndex = "1";
    const testUser = web3.Keypair.generate(); // Create a new user for this test
    let mint_to_pubkey;
    let nonTransferableProject;
    let nonTransferableProjectMint;
    let nonTransferableUserStatus;
    let nonTransferableNftMint;
    let userAssociatedTokenAccount;
    let nonTransferableNftStatus;
    let nonTransferableRnsIdStatus;

    mint_to_pubkey = testUser.publicKey;

    before(async () => {
        nonTransferableProject = await findNonTransferableProject();
        nonTransferableProjectMint = await getCollectionMintAddress();
        nonTransferableUserStatus = findNonTransferableUserStatus(rnsId, mint_to_pubkey);
        nonTransferableNftMint = await getNonTransferableNftMintAddress(rnsId, tokenIndex);
        userAssociatedTokenAccount = await getUserAssociatedTokenAccount(mint_to_pubkey, nonTransferableNftMint)
        nonTransferableNftStatus = await findNonTransferableNftStatus(nonTransferableNftMint);
        nonTransferableRnsIdStatus = await findNonTransferableRnsIdtatus(rnsId)
    })
    
    it("analyze revoke rent recovery", async () => {
        const airdropAccounts = {
            authority: ADMIN_WALLET.publicKey,
            userAccount: mint_to_pubkey,
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

        const revokeAccounts = {
            authority: ADMIN_WALLET.publicKey,
            nonTransferableProject: nonTransferableProject,
            userAccount: mint_to_pubkey,
            userTokenAccount: userAssociatedTokenAccount,
            nonTransferableUserStatus: nonTransferableUserStatus,
            nonTransferableRnsIdStatus: nonTransferableRnsIdStatus,
            nonTransferableNftStatus: nonTransferableNftStatus,
            nonTransferableNftMint: nonTransferableNftMint,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: web3.SystemProgram.programId,
        };

        const set_compute_unit_limit_ix = ComputeBudgetProgram.setComputeUnitLimit({
            units: 1_000_000,
        });

        // Record admin balance before airdrop
        const adminBalanceBeforeAirdrop = await provider.connection.getBalance(ADMIN_WALLET.publicKey);
        console.log("💰 Admin balance before airdrop:", adminBalanceBeforeAirdrop / 1e9, "SOL");

        // Step 1: Airdrop first
        await program.methods.airdrop(
            rnsId,
            mint_to_pubkey,
            "test-merkle-root",
            tokenIndex
        )
            .accounts(airdropAccounts)
            .preInstructions([set_compute_unit_limit_ix])
            .signers([ADMIN_WALLET])
            .rpc();

        const adminBalanceAfterAirdrop = await provider.connection.getBalance(ADMIN_WALLET.publicKey);
        const airdropCost = (adminBalanceBeforeAirdrop - adminBalanceAfterAirdrop) / 1e9;
        console.log("💰 Admin balance after airdrop:", adminBalanceAfterAirdrop / 1e9, "SOL");
        console.log("💸 Airdrop cost:", airdropCost, "SOL");

        // Check account balances before revoke
        console.log("\n=== Account Rent Analysis Before Revoke ===");
        
        const userStatusAccountInfo = await provider.connection.getAccountInfo(nonTransferableUserStatus);
        const userStatusRent = userStatusAccountInfo?.lamports || 0;
        console.log("📊 UserStatus account rent:", userStatusRent / 1e9, "SOL");
        console.log("📊 UserStatus account size:", userStatusAccountInfo?.data.length, "bytes");

        const nftStatusAccountInfo = await provider.connection.getAccountInfo(nonTransferableNftStatus);
        const nftStatusRent = nftStatusAccountInfo?.lamports || 0;
        console.log("📊 NftStatus account rent:", nftStatusRent / 1e9, "SOL");
        console.log("📊 NftStatus account size:", nftStatusAccountInfo?.data.length, "bytes");

        const rnsIdStatusAccountInfo = await provider.connection.getAccountInfo(nonTransferableRnsIdStatus);
        const rnsIdStatusRent = rnsIdStatusAccountInfo?.lamports || 0;
        console.log("📊 RnsIdStatus account rent:", rnsIdStatusRent / 1e9, "SOL");
        console.log("📊 RnsIdStatus account size:", rnsIdStatusAccountInfo?.data.length, "bytes");

        const tokenAccountInfo = await provider.connection.getAccountInfo(userAssociatedTokenAccount);
        const tokenAccountRent = tokenAccountInfo?.lamports || 0;
        console.log("📊 Token account rent:", tokenAccountRent / 1e9, "SOL");
        console.log("📊 Token account size:", tokenAccountInfo?.data.length, "bytes");

        const totalRentBeforeRevoke = (userStatusRent + nftStatusRent + rnsIdStatusRent + tokenAccountRent) / 1e9;
        console.log("📊 Total rent in accounts:", totalRentBeforeRevoke, "SOL");

        // Step 2: Revoke
        const adminBalanceBeforeRevoke = await provider.connection.getBalance(ADMIN_WALLET.publicKey);
        console.log("\n💰 Admin balance before revoke:", adminBalanceBeforeRevoke / 1e9, "SOL");

        await program.methods.revoke(
            rnsId,
            mint_to_pubkey  // wallet parameter should match the user_account
        )
            .accounts(revokeAccounts)
            .preInstructions([set_compute_unit_limit_ix])
            .signers([ADMIN_WALLET])
            .rpc();

        const adminBalanceAfterRevoke = await provider.connection.getBalance(ADMIN_WALLET.publicKey);
        const revokeGain = (adminBalanceAfterRevoke - adminBalanceBeforeRevoke) / 1e9;
        console.log("💰 Admin balance after revoke:", adminBalanceAfterRevoke / 1e9, "SOL");
        console.log("💰 Revoke rent recovery:", revokeGain, "SOL");

        // Verify which accounts were closed
        console.log("\n=== Account Status After Revoke ===");
        
        try {
            await provider.connection.getAccountInfo(nonTransferableUserStatus);
            console.log("❌ UserStatus account still exists");
        } catch (error) {
            console.log("✅ UserStatus account closed");
        }

        try {
            await provider.connection.getAccountInfo(nonTransferableNftStatus);
            console.log("❌ NftStatus account still exists");
        } catch (error) {
            console.log("✅ NftStatus account closed");
        }

        const rnsIdStatusAfter = await provider.connection.getAccountInfo(nonTransferableRnsIdStatus);
        if (rnsIdStatusAfter) {
            console.log("⚠️  RnsIdStatus account still exists (num > 0)");
        } else {
            console.log("✅ RnsIdStatus account closed (num reached 0)");
        }

        const tokenAccountAfter = await provider.connection.getAccountInfo(userAssociatedTokenAccount);
        if (tokenAccountAfter) {
            console.log("⚠️  Token account still exists (frozen)");
        } else {
            console.log("❌ Token account closed (unexpected)");
        }

        // Calculate total cost/benefit
        const totalAdminChange = (adminBalanceAfterRevoke - adminBalanceBeforeAirdrop) / 1e9;
        console.log("\n=== Final Analysis ===");
        console.log("💸 Total admin cost (airdrop):", airdropCost, "SOL");
        console.log("💰 Total admin recovery (revoke):", revokeGain, "SOL");
        console.log("📊 Net admin cost:", totalAdminChange, "SOL");
        console.log("📊 Recovery percentage:", ((revokeGain / airdropCost) * 100).toFixed(2), "%");

        // Expected recoverable rent (UserStatus + NftStatus + potentially RnsIdStatus)
        const expectedRecovery = (userStatusRent + nftStatusRent + (rnsIdStatusAfter ? 0 : rnsIdStatusRent)) / 1e9;
        console.log("📊 Expected recovery:", expectedRecovery, "SOL");
        console.log("📊 Actual vs Expected:", (revokeGain / expectedRecovery * 100).toFixed(2), "%");

        console.log("✅ Revoke rent analysis completed");
    });
});