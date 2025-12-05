import { RnsdidCore } from '../target/types/rnsdid_core'

import {
    Program,
    web3,
    workspace,
    setProvider,
    AnchorProvider,
    BN,
} from '@coral-xyz/anchor'
import {
    createAssociatedTokenAccountInstruction,
    // getCollectionId,
    // getSbtId,
    getCollectionMetadataAddress,
    getUserAssociatedTokenAccount,


    getOwnershipAccountBump,
    getOwnershipAccountAddress,
    findNonTransferableProject,
    // getCollectionAccount

    findNonTransferableUserStatus,
} from './utils/utils'
import { LAMPORTS_PER_SOL, PublicKey, SYSVAR_RENT_PUBKEY } from '@solana/web3.js';
import {
    rnsId,
    ADMIN_WALLET,
    USER_WALLET,

 } from './utils/constants';
import { assert } from 'chai';


describe("authorize_mint", () => {

    const provider = AnchorProvider.env();

    setProvider(provider);

    const program = workspace.RnsdidCore as Program<RnsdidCore>;

    let nonTransferableProject;
    let nonTransferableUserStatus;
    let accounts;

    before(async () => {

        // console.log('USER_WALLET:', USER_WALLET.publicKey.toBase58())
        nonTransferableProject = await findNonTransferableProject();
        nonTransferableUserStatus = findNonTransferableUserStatus(rnsId, USER_WALLET.publicKey);

        accounts = {
            authority: USER_WALLET.publicKey,
            nonTransferableProject: nonTransferableProject,
            nonTransferableUserStatus: nonTransferableUserStatus,
            feeRecipient: ADMIN_WALLET.publicKey,
            systemProgram: web3.SystemProgram.programId,
            rent: SYSVAR_RENT_PUBKEY,
        };
    })

    it("sucessed:airdrop some gas!", async () => {
        const amount = 5;
        // Request airdrop LAMPORTS
        const airdropSignature = await provider.connection.requestAirdrop(
            new PublicKey(USER_WALLET.publicKey),
            LAMPORTS_PER_SOL * amount // Amount in SOL
        );
        // Confirm the transaction
        await provider.connection.confirmTransaction(airdropSignature);
        // console.log(`Airdropped ${amount} SOL to ${USER_WALLET.publicKey}`);
    });

    it("successed: authorize_mint", async () => {

        await program.methods
            .authorizeMint(rnsId, USER_WALLET.publicKey)
            .accounts(accounts)
            .signers([
                USER_WALLET
            ])
            .rpc();

        // console.log("Your txHash:", txHash);
        // Fetch data from the new account
        const data = await program.account.userStatusAccount.fetch(nonTransferableUserStatus)
        assert(data.isAuthorized, "user status authorize failed!")
        assert(!data.isMinted, "did 's is_minted must be false!")

        // console.log('\nThe owner:\n', data.owner.toBase58())
    });

    it("failed: ldid auuthorized again", async () => {

        try {
            await program.methods
                .authorizeMint(rnsId, USER_WALLET.publicKey)
                .accounts(accounts)
                .signers([
                    USER_WALLET
                ])
                .rpc();

        } catch ( { error, logs } ) {

            assert(error.errorCode.code == 'LDIDHasAuthorized', "LDIDHasAuthorized")

        }
    })

});
