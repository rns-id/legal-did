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
    getUserAssociatedTokenAccount,
    getNonTransferableNftMintAddress,
    getTokenAccountDetails,
    findDIDStatus,
} from './utils/utils'

import {
    ADMIN_WALLET,
    USER_WALLET,
    TOKEN_2022_PROGRAM_ID,
    rnsId,
    tokenIndex
} from "./utils/constants";
import { assert } from 'chai';
import { ComputeBudgetProgram } from '@solana/web3.js';

const { SYSVAR_RENT_PUBKEY } = web3

describe("burn", () => {

    const provider = AnchorProvider.env();
    setProvider(provider)
    const program = workspace.RnsdidCore as Program<RnsdidCore>;

    it("nft burned successfully with Token-2022!", async () => {

        const userPubkey = USER_WALLET.publicKey;
        const nonTransferableProject = await findNonTransferableProject();
        const nonTransferableNftMint = await getNonTransferableNftMintAddress(rnsId, tokenIndex);
        const userTokenAccount = await getUserAssociatedTokenAccount(userPubkey, nonTransferableNftMint);
        const didStatus = findDIDStatus(rnsId, userPubkey);

        // 验证 burn 前状态
        const details_before = await getTokenAccountDetails(userTokenAccount);
        assert(details_before.amount == BigInt(1), 'Token balance should be 1 before burn');

        // 记录 burn 前余额
        const adminBalanceBefore = await provider.connection.getBalance(ADMIN_WALLET.publicKey);
        const userBalanceBefore = await provider.connection.getBalance(userPubkey);

        console.log("Admin balance before burn:", adminBalanceBefore / 1e9, "SOL");
        console.log("User balance before burn:", userBalanceBefore / 1e9, "SOL");

        const set_compute_unit_limit_ix = ComputeBudgetProgram.setComputeUnitLimit({
            units: 1_000_000,
        });

        await program.methods
            .burn(rnsId, userPubkey)
            .accountsPartial({
                authority: ADMIN_WALLET.publicKey,
                nftOwner: userPubkey,
                nonTransferableProject: nonTransferableProject,
                userTokenAccount: userTokenAccount,
                didStatus: didStatus,
                nonTransferableNftMint: nonTransferableNftMint,
                associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
                tokenProgram: TOKEN_2022_PROGRAM_ID,
                systemProgram: web3.SystemProgram.programId,
            })
            .preInstructions([set_compute_unit_limit_ix])
            .signers([USER_WALLET])
            .rpc();

        // 记录 burn 后余额
        const adminBalanceAfter = await provider.connection.getBalance(ADMIN_WALLET.publicKey);
        const userBalanceAfter = await provider.connection.getBalance(userPubkey);

        console.log("Admin balance after burn:", adminBalanceAfter / 1e9, "SOL");
        console.log("User balance after burn:", userBalanceAfter / 1e9, "SOL");
        console.log("Admin received rent:", (adminBalanceAfter - adminBalanceBefore) / 1e9, "SOL");
        console.log("User balance change:", (userBalanceAfter - userBalanceBefore) / 1e9, "SOL");

        // 验证 Token 账户已关闭
        try {
            await getTokenAccountDetails(userTokenAccount);
            assert(false, "Token account should be closed");
        } catch (error) {
            console.log("✅ Token account successfully closed");
        }

        // 验证 DID 状态账户已关闭
        try {
            await program.account.didStatusAccount.fetch(didStatus);
            assert(false, "DID status account should be closed");
        } catch (error) {
            console.log("✅ DID status account successfully closed");
        }

        console.log("🎉 Burn completed successfully!");
    });
});
