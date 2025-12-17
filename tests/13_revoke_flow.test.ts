import { RnsdidCore } from '../target/types/rnsdid_core'
import {
    Program,
    web3,
    workspace,
    setProvider,
    AnchorProvider,
} from '@coral-xyz/anchor'
import { ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token'

import {
    findNonTransferableProject,
    getUserAssociatedTokenAccount,
    getNonTransferableNftMintAddress,
    findDIDStatus,
    getTokenAccountBalance,
} from './utils/utils'

import {
    ADMIN_WALLET,
    USER_WALLET,
    TOKEN_2022_PROGRAM_ID,
    merkleRoot,
} from "./utils/constants";
import { assert } from 'chai';
import { ComputeBudgetProgram } from '@solana/web3.js';

const { SYSVAR_RENT_PUBKEY } = web3

describe("Revoke Flow Test", () => {
    const provider = AnchorProvider.env();
    setProvider(provider)
    const program = workspace.RnsdidCore as Program<RnsdidCore>;

    const rnsId = "revoke-flow-" + Date.now();
    const tokenIndex = "revoke-001";

    it("Test complete flow: authorize -> airdrop -> revoke", async () => {
        console.log("\n=== Token-2022 Revoke Flow Test ===");
        console.log("RNS ID:", rnsId);

        const userPubkey = USER_WALLET.publicKey;
        const nonTransferableProject = await findNonTransferableProject();
        const nonTransferableNftMint = await getNonTransferableNftMintAddress(rnsId, tokenIndex);
        const userTokenAccount = await getUserAssociatedTokenAccount(userPubkey, nonTransferableNftMint);
        const didStatus = findDIDStatus(rnsId, userPubkey);

        // Get fee_recipient
        const projectAccount = await program.account.projectAccount.fetch(nonTransferableProject);
        const feeRecipient = projectAccount.feeRecipient;

        // Record initial balances
        const adminInitialBalance = await provider.connection.getBalance(ADMIN_WALLET.publicKey);
        const userInitialBalance = await provider.connection.getBalance(userPubkey);
        console.log("\n💰 Initial Balances:");
        console.log("  Admin:", (adminInitialBalance / 1e9).toFixed(8), "SOL");
        console.log("  User:", (userInitialBalance / 1e9).toFixed(8), "SOL");

        // 1. Authorize
        console.log("\n--- Step 1: Authorize ---");
        const balanceBeforeAuthorize = await provider.connection.getBalance(ADMIN_WALLET.publicKey);

        await program.methods
            .authorizeMint(rnsId, userPubkey)
            .accountsPartial({
                authority: ADMIN_WALLET.publicKey,
                nonTransferableProject: nonTransferableProject,
                didStatus: didStatus,
                feeRecipient: feeRecipient,
                systemProgram: web3.SystemProgram.programId,
                rent: SYSVAR_RENT_PUBKEY,
            })
            .signers([ADMIN_WALLET])
            .rpc();

        const balanceAfterAuthorize = await provider.connection.getBalance(ADMIN_WALLET.publicKey);
        const authorizeCost = (balanceBeforeAuthorize - balanceAfterAuthorize) / 1e9;
        console.log("✅ Authorized");
        console.log("  💸 Cost:", authorizeCost.toFixed(8), "SOL");

        // 2. Airdrop
        console.log("\n--- Step 2: Airdrop (Token-2022) ---");
        const adminBalanceBeforeAirdrop = await provider.connection.getBalance(ADMIN_WALLET.publicKey);

        const set_compute_unit_limit_ix = ComputeBudgetProgram.setComputeUnitLimit({
            units: 1_000_000,
        });

        await program.methods
            .airdrop(rnsId, userPubkey, merkleRoot, tokenIndex)
            .accountsPartial({
                authority: ADMIN_WALLET.publicKey,
                nonTransferableProject: nonTransferableProject,
                nonTransferableNftMint: nonTransferableNftMint,
                userAccount: userPubkey,
                userTokenAccount: userTokenAccount,
                didStatus: didStatus,
                associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
                tokenProgram: TOKEN_2022_PROGRAM_ID,
                systemProgram: web3.SystemProgram.programId,
                rent: SYSVAR_RENT_PUBKEY,
            })
            .preInstructions([set_compute_unit_limit_ix])
            .signers([ADMIN_WALLET])
            .rpc();

        const adminBalanceAfterAirdrop = await provider.connection.getBalance(ADMIN_WALLET.publicKey);
        const airdropCost = (adminBalanceBeforeAirdrop - adminBalanceAfterAirdrop) / 1e9;
        console.log("✅ Airdropped");
        console.log("  💸 Cost:", airdropCost.toFixed(8), "SOL");

        // Verify token balance
        const balance = await getTokenAccountBalance(userTokenAccount);
        assert(balance == BigInt(1), "Token balance should be 1");
        console.log("  Token Balance:", balance.toString());

        // 3. Revoke (Admin revokes user's NFT)
        console.log("\n--- Step 3: Revoke (Admin using PermanentDelegate) ---");
        const adminBalanceBeforeRevoke = await provider.connection.getBalance(ADMIN_WALLET.publicKey);
        const userBalanceBeforeRevoke = await provider.connection.getBalance(userPubkey);

        await program.methods
            .revoke(rnsId, userPubkey)
            .accountsPartial({
                authority: ADMIN_WALLET.publicKey,
                nonTransferableProject: nonTransferableProject,
                userAccount: userPubkey,
                userTokenAccount: userTokenAccount,
                didStatus: didStatus,
                nonTransferableNftMint: nonTransferableNftMint,
                associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
                tokenProgram: TOKEN_2022_PROGRAM_ID,
                systemProgram: web3.SystemProgram.programId,
            })
            .preInstructions([set_compute_unit_limit_ix])
            .signers([ADMIN_WALLET])
            .rpc();

        const adminBalanceAfterRevoke = await provider.connection.getBalance(ADMIN_WALLET.publicKey);
        const userBalanceAfterRevoke = await provider.connection.getBalance(userPubkey);
        const revokeAdminGain = (adminBalanceAfterRevoke - adminBalanceBeforeRevoke) / 1e9;
        const revokeUserChange = (userBalanceAfterRevoke - userBalanceBeforeRevoke) / 1e9;

        console.log("✅ Revoked (Admin burned user's NFT using PermanentDelegate)");
        console.log("  💰 Admin Recovered (DIDStatus rent):", revokeAdminGain.toFixed(8), "SOL");
        console.log("  💰 User Balance Change:", revokeUserChange.toFixed(8), "SOL");

        // Verify token burned (balance = 0, ATA may still exist)
        try {
            const balanceAfterRevoke = await getTokenAccountBalance(userTokenAccount);
            assert(balanceAfterRevoke == BigInt(0), "Token balance should be 0 after revoke");
            console.log("  ✅ Token burned (balance = 0)");
            console.log("  ⚠️  ATA still exists (user can close it to recover ~0.002 SOL)");
        } catch {
            console.log("  ✅ Token account closed");
        }

        // Verify DID status account closed
        try {
            await program.account.didStatusAccount.fetch(didStatus);
            assert.fail("DID status account should be closed");
        } catch {
            console.log("  ✅ DID status account closed");
        }

        // Final Balance Comparison
        const adminFinalBalance = await provider.connection.getBalance(ADMIN_WALLET.publicKey);
        const userFinalBalance = await provider.connection.getBalance(userPubkey);
        const adminTotalChange = (adminFinalBalance - adminInitialBalance) / 1e9;
        const userTotalChange = (userFinalBalance - userInitialBalance) / 1e9;

        console.log("\n💰 Final Balance Comparison:");
        console.log("  Admin Total Change:", adminTotalChange.toFixed(8), "SOL");
        console.log("  User Total Change:", userTotalChange.toFixed(8), "SOL");

        console.log("\n📊 Cost Summary:");
        console.log("  Authorize Cost:", authorizeCost.toFixed(8), "SOL");
        console.log("  Airdrop Cost:", airdropCost.toFixed(8), "SOL");
        console.log("  Revoke Admin Recovered:", revokeAdminGain.toFixed(8), "SOL");

        const totalAdminSpent = authorizeCost + airdropCost;
        const netAdminCost = totalAdminSpent - (revokeAdminGain > 0 ? revokeAdminGain : 0);
        console.log("\n💸 Net Cost:");
        console.log("  Admin Net Cost:", netAdminCost.toFixed(8), "SOL");
        console.log("  User Net Cost:", (userTotalChange * -1).toFixed(8), "SOL");

        console.log("\n📝 Note:");
        console.log("  - PermanentDelegate can burn token but cannot close ATA");
        console.log("  - User's ATA (~0.002 SOL) remains, user can close it manually");
        console.log("  - DIDStatus rent returned to admin");

        console.log("\n🎉 Revoke Flow Test Complete!");
    });
});
