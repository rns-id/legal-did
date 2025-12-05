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

    getCollectionMetadataAddress,
    getUserAssociatedTokenAccount,

    getOwnershipAccountBump,
    getOwnershipAccountAddress,
    findNonTransferableProject,
    // getCollectionAccount
} from './utils/utils'
import { assert } from 'chai';
import { Keypair, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import {
    ADMIN_WALLET,
    USER_WALLET,
 } from './utils/constants';


describe("config settings", () => {

    const provider = AnchorProvider.env();

    setProvider(provider);

    const program = workspace.RnsdidCore as Program<RnsdidCore>;

    // it("sucessed:airdrop some gas!", async () => {
    //     const amount = 5;
    //      // Request airdrop LAMPORTS
    //     const airdropSignature = await provider.connection.requestAirdrop(
    //         new PublicKey(USER_WALLET.publicKey),
    //         LAMPORTS_PER_SOL * amount // Amount in SOL
    //     );
    //     // Confirm the transaction
    //     await provider.connection.confirmTransaction(airdropSignature);
    //     // console.log(`Airdropped ${amount} SOL to ${USER_WALLET.publicKey}`);
    // });

    it("sucessed:set_mint_price", async () => {

        const nonTransferableProject = await findNonTransferableProject();

        const mintPrice = new BN(100);

        // console.log('mintPrice:', mintPrice.toNumber())
        let tx = await program.methods
            .setMintPrice(mintPrice)
            .accountsPartial({
                authority: ADMIN_WALLET.publicKey,
                nonTransferableProject: nonTransferableProject,
            })
            .signers([
                ADMIN_WALLET
            ])
            .rpc();

        const _collection = await program.account.projectAccount.fetch(nonTransferableProject)
        assert(mintPrice.toString() == _collection.mintPrice.toString(), 'mintPrice not eq!');
    });

    it("sucessed:set_fee_recipient!", async () => {

        const nonTransferableProject = await findNonTransferableProject();

        const mintPrice = new BN(100);

        await program.methods
            .setFeeRecipient(ADMIN_WALLET.publicKey)
            .accountsPartial({
                authority: ADMIN_WALLET.publicKey,
                nonTransferableProject: nonTransferableProject,
            })
            .signers([
                ADMIN_WALLET
            ])
            .rpc();

        const _collection = await program.account.projectAccount.fetch(nonTransferableProject)

        assert(ADMIN_WALLET.publicKey.toBase58().toString() == _collection.feeRecipient.toBase58().toString(), 'mintPrice not eq!');
    });

    it("sucessed:set_base_uri", async () => {

        const nonTransferableProject = await findNonTransferableProject();

        // https://dev-api-1.rns.id/api/v2/portal/identity/nft/8b3c57e5-12f7-4fa0-8e34-4a89cf31bf3b.json
        const _base_uri = "https://dev-api-1.rns.id/api/v2/portal/identity/nft/";
        //mainnet: "https://api.rns.id/api/v2/portal/identity/nft/";

        await program.methods
            .setBaseUri(_base_uri)
            .accountsPartial({
                authority: ADMIN_WALLET.publicKey,
                nonTransferableProject: nonTransferableProject,
            })
            .signers([
                ADMIN_WALLET
            ])
            .rpc();

        const data = await program.account.projectAccount.fetch(nonTransferableProject)

        assert(data.baseUri.toString() == _base_uri, "base uri setting failed!")

    });

    it("sucessed:set_is_blocked_address", async () => {

        const nonTransferableProject = await findNonTransferableProject();

        const _wallet = Keypair.generate().publicKey;

        await program.methods
            .setIsBlockedAddress(_wallet, true)
            .accountsPartial({
                authority: ADMIN_WALLET.publicKey,
                nonTransferableProject: nonTransferableProject,
            })
            .signers([
                ADMIN_WALLET
            ])
            .rpc();

        const data = await program.account.projectAccount.fetch(nonTransferableProject)

        let item  = data.isBlockedAddress[0];

        assert(item.key.toBase58() == _wallet.toBase58() && item.value == true, "set_is_blocked_address setting failed!")

    });

    it("sucessed:set_is_blocked_rns_id", async () => {
        const nonTransferableProject = await findNonTransferableProject();
        const rns_id = "3"

        await program.methods
            .setIsBlockedRnsId(rns_id, true)
            .accountsPartial({
                authority: ADMIN_WALLET.publicKey,
                nonTransferableProject: nonTransferableProject,
            })
            .signers([
                ADMIN_WALLET
            ])
            .rpc();

        const data = await program.account.projectAccount.fetch(nonTransferableProject)

        let item  = data.isBlockedRnsId[0];

        assert(item.key == rns_id && item.value == true, "set_is_blocked_address setting failed!")

    });

 

});
