import { RnsdidCore } from '../target/types/rnsdid_core'

import { ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token'
import {
    Program,
    web3,
    workspace,
    setProvider,
    AnchorProvider,
    BN,
} from '@coral-xyz/anchor'
import { Metadata, Edition } from '@metaplex-foundation/mpl-token-metadata';

import {

    createAssociatedTokenAccountInstruction,

    getOwnershipAccountBump,
    getOwnershipAccountAddress,


    findNonTransferableProject,
    getCollectionMetadataAddress,

    getCollectionMintAddress,
    getCollectionVaultAddress,
    getCollectionMasterEditionAddress,

    getUserAssociatedTokenAccount,
    getNonTransferableNftMintAddress,
    getCollectionMintBump,
    getTokenAccountBalance,
    findNonTransferableUserStatus,
    findNonTransferableNftStatus,
    findNonTransferableRnsIdtatus,
    getAccountNFTs,
    getTokenAccountDetails
} from './utils/utils'


import {
    ADMIN_WALLET, TOKEN_METADATA_PROGRAM_ID, TOKEN_PROGRAM_ID,
    USER_WALLET,
    rnsId,
    tokenIndex,
    merkleRoot
} from "./utils/constants";
import { assert } from 'chai';
import { ComputeBudgetProgram, Transaction } from '@solana/web3.js';
const { Keypair, SystemProgram, SYSVAR_RENT_PUBKEY } = web3

describe("airdrop", () => {

    const provider = AnchorProvider.env();
    setProvider(provider)
    const program = workspace.RnsdidCore as Program<RnsdidCore>;

    let mint_to_pubkey;
    let nonTransferableProject;
    let nonTransferableProjectMint;
    let nonTransferableProjectMetadata;
    let nonTransferableProjectMasterEdition;
    let nonTransferableUserStatus;
    let nonTransferableNftMint;
    let nonTransferableNftMetadata;
    let nonTransferableNftMasterEdition;
    let userAssociatedTokenAccount;
    let nonTransferableNftStatus;
    let nonTransferableRnsIdStatus;

    mint_to_pubkey = USER_WALLET.publicKey;

    before(async () => {
        nonTransferableProject = await findNonTransferableProject();
        nonTransferableProjectMint = await getCollectionMintAddress();
        nonTransferableProjectMetadata = await getCollectionMetadataAddress(nonTransferableProjectMint);
        nonTransferableProjectMasterEdition = await getCollectionMasterEditionAddress(nonTransferableProjectMint);
        nonTransferableUserStatus = findNonTransferableUserStatus(rnsId, mint_to_pubkey);
        nonTransferableNftMint = await getNonTransferableNftMintAddress(rnsId, tokenIndex);
        nonTransferableNftMetadata = await getCollectionMetadataAddress(nonTransferableNftMint)
        nonTransferableNftMasterEdition = await getCollectionMasterEditionAddress(nonTransferableNftMint)
        userAssociatedTokenAccount = await getUserAssociatedTokenAccount(mint_to_pubkey, nonTransferableNftMint)
        nonTransferableNftStatus = await findNonTransferableNftStatus(nonTransferableNftMint);
        nonTransferableRnsIdStatus = await findNonTransferableRnsIdtatus(rnsId)
    })
    
    it("successed: airdrop ", async () => {

        // console.log('admin:', ADMIN_WALLET.publicKey.toBase58())
        // console.log('user::', mint_to_pubkey.toBase58())

        // console.log('nonTransferableProject:', nonTransferableProject.toBase58())
        // console.log('nonTransferableProjectMint:', nonTransferableProjectMint.toBase58())
        // console.log('nonTransferableProjectMetadata:', nonTransferableProjectMetadata.toBase58())
        // console.log('nonTransferableProjectMasterEdition:', nonTransferableProjectMasterEdition.toBase58())

        // console.log('nonTransferableNftMint:', nonTransferableNftMint.toBase58());
        // console.log('nonTransferableNftMetadata:', nonTransferableNftMetadata.toBase58());
        // console.log('nonTransferableNftMasterEdition:', nonTransferableNftMasterEdition.toBase58());
        // console.log('userAssociatedTokenAccount:', userAssociatedTokenAccount.toBase58());

        const accounts = {

            authority: ADMIN_WALLET.publicKey,

            userAccount: mint_to_pubkey,
            userTokenAccount: userAssociatedTokenAccount,
            nonTransferableUserStatus: nonTransferableUserStatus,
            nonTransferableNftStatus: nonTransferableNftStatus,
            nonTransferableRnsIdStatus: nonTransferableRnsIdStatus,

            nonTransferableNftMint: nonTransferableNftMint,
            nonTransferableNftMetadata: nonTransferableNftMetadata,
            nonTransferableNftMasterEdition: nonTransferableNftMasterEdition,

            nonTransferableProject: nonTransferableProject,
            nonTransferableProjectMint: nonTransferableProjectMint,
            nonTransferableProjectMetadata: nonTransferableProjectMetadata,
            nonTransferableProjectMasterEdition: nonTransferableProjectMasterEdition,

            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: web3.SystemProgram.programId,
            rent: SYSVAR_RENT_PUBKEY,
            sysvarInstructions: web3.SYSVAR_INSTRUCTIONS_PUBKEY,
        };

        const merkleRoot = '2d852b3c21e923484a93d3a980a45b7571e89552d58875d40dd17c73216a49d7';
        const set_compute_unit_limit_ix = ComputeBudgetProgram.setComputeUnitLimit({
            units: 1_000_000, // Requested compute units, adjust as needed
        });

        // Transaction 1: airdrop
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

        // Transaction 2: verify
        await program.methods.verify(
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

        const metadataAccountInfo = await provider.connection.getAccountInfo(nonTransferableNftMetadata);
        if (!metadataAccountInfo) {
            console.error('Metadata account not found');
            return;
        }

        const data = await program.account.nftStatusAccount.fetch(nonTransferableNftStatus)
        assert(rnsId == data.rnsId, 'rnsId')
        assert(mint_to_pubkey.toBase58() == data.authority.toBase58(), 'authority')
        assert(merkleRoot.toString() == data.merkleRoot.toString(), 'merkleRoot')
        assert(nonTransferableNftMint.toBase58() == data.mint.toBase58(), 'mint')

        const { isAuthorized, isMinted } = await program.account.userStatusAccount.fetch(nonTransferableUserStatus)
        assert(isMinted, "did 's is_minted must be true!")


    });


    it("sucessed:set_merkle_root", async () => {
        const nonTransferableProject = await findNonTransferableProject();

        const data_before = await program.account.nftStatusAccount.fetch(nonTransferableNftStatus)
        assert(data_before.rnsId == rnsId && data_before.merkleRoot == merkleRoot, "set_merkle_root setting failed!")

        const merkleRoot_2 = '2d852b3c21e923484a93d3a980a45b7571e89552d58875d40dd17c73216a49d8';
        await program.methods
            .setMerkleRoot(rnsId, merkleRoot_2)
            .accountsPartial({
                authority: ADMIN_WALLET.publicKey,  // Explicitly specify authority
                nonTransferableProject: nonTransferableProject,
                nonTransferableNftMint: nonTransferableNftMint,
                nonTransferableNftStatus: nonTransferableNftStatus,
            })
            .signers([
                ADMIN_WALLET
            ])
            .rpc();

        const data = await program.account.nftStatusAccount.fetch(nonTransferableNftStatus)
        assert(data.rnsId == rnsId && data.merkleRoot == merkleRoot_2, "set_merkle_root setting failed!")

    });

    it('minted number should be eq 1', async () => {

        const userTokenAccount = await getUserAssociatedTokenAccount(mint_to_pubkey, nonTransferableNftMint)

        const details = await getTokenAccountDetails(userTokenAccount)

        assert(details.amount == BigInt(1), 'minted number should be eq 1');

        // await getAccountNFTs(mint_to_pubkey, nonTransferableProjectMint.toBase58())
        //     .then(nfts => {
        //         console.log('NFTs:', nfts);
        //     })
        //     .catch(err => {
        //         console.error('Error:', err);
        //     });

    });
});
