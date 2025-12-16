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
    USER_WALLET,
    rnsId,
    tokenIndex,
    merkleRoot
} from "./utils/constants";
import { assert } from 'chai';
import { ComputeBudgetProgram } from '@solana/web3.js';
const { SYSVAR_RENT_PUBKEY } = web3

describe("revoke", () => {

    const provider = AnchorProvider.env();
    setProvider(provider)
    const program = workspace.RnsdidCore as Program<RnsdidCore>;

    let mint_to_pubkey;
    let nonTransferableProject;
    let nonTransferableProjectMint;
    let nonTransferableUserStatus;
    let nonTransferableNftMint;
    let userAssociatedTokenAccount;
    let nonTransferableNftStatus;
    let nonTransferableRnsIdStatus;

    mint_to_pubkey = USER_WALLET.publicKey;

    before(async () => {
        nonTransferableProject = await findNonTransferableProject();
        nonTransferableProjectMint = await getCollectionMintAddress();
        nonTransferableUserStatus = findNonTransferableUserStatus(rnsId, mint_to_pubkey);
        nonTransferableNftMint = await getNonTransferableNftMintAddress(rnsId, tokenIndex);
        userAssociatedTokenAccount = await getUserAssociatedTokenAccount(mint_to_pubkey, nonTransferableNftMint)
        nonTransferableNftStatus = await findNonTransferableNftStatus(nonTransferableNftMint);
        nonTransferableRnsIdStatus = await findNonTransferableRnsIdtatus(rnsId)
    })
    
    it("success: airdrop first", async () => {
        const accounts = {
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

        const set_compute_unit_limit_ix = ComputeBudgetProgram.setComputeUnitLimit({
            units: 1_000_000,
        });

        // Airdrop first
        await program.methods.airdrop(
            rnsId,
            mint_to_pubkey,
            merkleRoot,
            tokenIndex
        )
            .accounts(accounts)
            .preInstructions([set_compute_unit_limit_ix])
            .signers([ADMIN_WALLET])
            .rpc();

        const balance = await getTokenAccountBalance(userAssociatedTokenAccount);
        assert(balance == BigInt(1), "Minted Token balance not eq 1 !")

        console.log("✅ Airdrop completed");
    });

    it("success: admin revoke user's NFT", async () => {
        const accounts = {
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

        // Admin revokes user's NFT
        await program.methods.revoke(
            rnsId,
            mint_to_pubkey
        )
            .accounts(accounts)
            .preInstructions([set_compute_unit_limit_ix])
            .signers([ADMIN_WALLET])
            .rpc();

        // Verify token still exists but is frozen (revoke closes status accounts but keeps token frozen)
        const balance = await getTokenAccountBalance(userAssociatedTokenAccount);
        assert(balance == BigInt(1), "Token should still exist after revoke (frozen)");
        console.log("✅ Token remains frozen after revoke (status accounts closed)");

        // Verify user status account is closed
        try {
            await program.account.userStatusAccount.fetch(nonTransferableUserStatus);
            assert.fail("User status account should be closed after revoke");
        } catch (error) {
            console.log("✅ User status account successfully closed after revoke");
        }

        // Verify NFT status account is closed
        try {
            await program.account.nftStatusAccount.fetch(nonTransferableNftStatus);
            assert.fail("NFT status account should be closed after revoke");
        } catch (error) {
            console.log("✅ NFT status account successfully closed after revoke");
        }

        console.log("🎉 Admin successfully revoked user's NFT!");
    });
});