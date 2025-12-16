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
    findDIDStatus,
    getTokenAccountDetails
} from './utils/utils'

import {
    ADMIN_WALLET,
    TOKEN_2022_PROGRAM_ID,
    USER_WALLET,
    rnsId,
    tokenIndex,
    merkleRoot
} from "./utils/constants";
import { assert } from 'chai';
import { ComputeBudgetProgram } from '@solana/web3.js';
const { SYSVAR_RENT_PUBKEY } = web3

describe("airdrop", () => {

    const provider = AnchorProvider.env();
    setProvider(provider)
    const program = workspace.RnsdidCore as Program<RnsdidCore>;

    let mint_to_pubkey;
    let nonTransferableProject;
    let nonTransferableNftMint;
    let userAssociatedTokenAccount;
    let didStatus;

    mint_to_pubkey = USER_WALLET.publicKey;

    before(async () => {
        nonTransferableProject = await findNonTransferableProject();
        nonTransferableNftMint = await getNonTransferableNftMintAddress(rnsId, tokenIndex);
        userAssociatedTokenAccount = await getUserAssociatedTokenAccount(mint_to_pubkey, nonTransferableNftMint)
        didStatus = findDIDStatus(rnsId, mint_to_pubkey);
    })

    it("success: airdrop with Token-2022", async () => {

        console.log('Admin:', ADMIN_WALLET.publicKey.toBase58())
        console.log('User:', mint_to_pubkey.toBase58())
        console.log('NFT Mint:', nonTransferableNftMint.toBase58());
        console.log('User ATA:', userAssociatedTokenAccount.toBase58());
        console.log('DID Status:', didStatus.toBase58());

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
            tokenIndex
        )
            .accounts(accounts)
            .preInstructions([set_compute_unit_limit_ix])
            .signers([ADMIN_WALLET])
            .rpc();

        // 验证 Token 余额
        const balance = await getTokenAccountBalance(userAssociatedTokenAccount);
        assert(balance == BigInt(1), "Minted Token balance should be 1!");
        console.log("✅ Token minted successfully");

        // 验证 DID 状态账户
        const data = await program.account.didStatusAccount.fetch(didStatus);
        assert(data.wallet.toBase58() === mint_to_pubkey.toBase58(), 'wallet should match');
        assert(data.mint.toBase58() === nonTransferableNftMint.toBase58(), 'mint should match');
        assert(data.status === 2, 'status should be Minted (2)');
        console.log("✅ DID Status account created");
        console.log("   Wallet:", data.wallet.toBase58());
        console.log("   Mint:", data.mint.toBase58());
        console.log("   Status:", data.status, "(Minted)");

        // 验证 Token-2022 Mint
        const mintInfo = await provider.connection.getAccountInfo(nonTransferableNftMint);
        assert(mintInfo !== null, "Mint account should exist");
        assert(mintInfo.owner.equals(TOKEN_2022_PROGRAM_ID), "Mint should be owned by Token-2022");
        console.log("✅ Token-2022 NFT Mint verified");
    });

    it('minted number should be eq 1', async () => {
        const details = await getTokenAccountDetails(userAssociatedTokenAccount);
        assert(details.amount == BigInt(1), 'minted number should be eq 1');
        console.log("✅ Token account balance verified:", details.amount.toString());
    });
});
