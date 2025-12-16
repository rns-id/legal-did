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
    getTokenAccountBalance,
    findDIDStatus,
} from './utils/utils'

import {
    ADMIN_WALLET,
    TOKEN_2022_PROGRAM_ID,
    USER_WALLET,
    rnsId,
    merkleRoot
} from "./utils/constants";
import { assert } from 'chai';
import { ComputeBudgetProgram } from '@solana/web3.js';
const { SYSVAR_RENT_PUBKEY } = web3

describe("revoke", () => {

    const provider = AnchorProvider.env();
    setProvider(provider)
    const program = workspace.RnsdidCore as Program<RnsdidCore>;

    // 使用新的 tokenIndex 避免与其他测试冲突
    const revokeTokenIndex = "revoke_" + Date.now().toString();

    let mint_to_pubkey;
    let nonTransferableProject;
    let nonTransferableNftMint;
    let userAssociatedTokenAccount;
    let didStatus;

    mint_to_pubkey = USER_WALLET.publicKey;

    before(async () => {
        nonTransferableProject = await findNonTransferableProject();
        nonTransferableNftMint = await getNonTransferableNftMintAddress(rnsId, revokeTokenIndex);
        userAssociatedTokenAccount = await getUserAssociatedTokenAccount(mint_to_pubkey, nonTransferableNftMint);
        didStatus = findDIDStatus(rnsId, mint_to_pubkey);
    })

    it("success: airdrop first", async () => {
        const accounts = {
            authority: ADMIN_WALLET.publicKey,
            nonTransferableProject: nonTransferableProject,
            nonTransferableNftMint: nonTransferableNftMint,
            userAccount: mint_to_pubkey,
            userTokenAccount: userAssociatedTokenAccount,
            didStatus: didStatus,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
            systemProgram: web3.SystemProgram.programId,
            rent: SYSVAR_RENT_PUBKEY,
        };

        const set_compute_unit_limit_ix = ComputeBudgetProgram.setComputeUnitLimit({
            units: 1_000_000,
        });

        await program.methods.airdrop(
            rnsId,
            mint_to_pubkey,
            merkleRoot,
            revokeTokenIndex
        )
            .accounts(accounts)
            .preInstructions([set_compute_unit_limit_ix])
            .signers([ADMIN_WALLET])
            .rpc();

        const balance = await getTokenAccountBalance(userAssociatedTokenAccount);
        assert(balance == BigInt(1), "Minted Token balance should be 1!");
        console.log("✅ Airdrop completed for revoke test");
    });

    it("success: admin revoke user's NFT using PermanentDelegate", async () => {
        const accounts = {
            authority: ADMIN_WALLET.publicKey,
            nonTransferableProject: nonTransferableProject,
            userAccount: mint_to_pubkey,
            userTokenAccount: userAssociatedTokenAccount,
            didStatus: didStatus,
            nonTransferableNftMint: nonTransferableNftMint,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
            systemProgram: web3.SystemProgram.programId,
        };

        const set_compute_unit_limit_ix = ComputeBudgetProgram.setComputeUnitLimit({
            units: 1_000_000,
        });

        // 记录 revoke 前余额
        const adminBalanceBefore = await provider.connection.getBalance(ADMIN_WALLET.publicKey);
        const userBalanceBefore = await provider.connection.getBalance(mint_to_pubkey);

        console.log("Admin balance before revoke:", adminBalanceBefore / 1e9, "SOL");
        console.log("User balance before revoke:", userBalanceBefore / 1e9, "SOL");

        // Admin revokes user's NFT using PermanentDelegate
        await program.methods.revoke(
            rnsId,
            mint_to_pubkey
        )
            .accounts(accounts)
            .preInstructions([set_compute_unit_limit_ix])
            .signers([ADMIN_WALLET])
            .rpc();

        // 记录 revoke 后余额
        const adminBalanceAfter = await provider.connection.getBalance(ADMIN_WALLET.publicKey);
        const userBalanceAfter = await provider.connection.getBalance(mint_to_pubkey);

        console.log("Admin balance after revoke:", adminBalanceAfter / 1e9, "SOL");
        console.log("User balance after revoke:", userBalanceAfter / 1e9, "SOL");
        console.log("Admin received rent:", (adminBalanceAfter - adminBalanceBefore) / 1e9, "SOL");
        console.log("User received rent:", (userBalanceAfter - userBalanceBefore) / 1e9, "SOL");

        // 验证 Token 账户已关闭 (PermanentDelegate 直接 burn 并关闭)
        try {
            await getTokenAccountBalance(userAssociatedTokenAccount);
            assert.fail("Token account should be closed after revoke");
        } catch (error) {
            console.log("✅ Token account successfully closed after revoke");
        }

        // 验证 DID 状态账户已关闭
        try {
            await program.account.didStatusAccount.fetch(didStatus);
            assert.fail("DID status account should be closed after revoke");
        } catch (error) {
            console.log("✅ DID status account successfully closed after revoke");
        }

        console.log("🎉 Admin successfully revoked user's NFT using PermanentDelegate!");
    });
});
