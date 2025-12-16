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
    findNonTransferableProject,
} from './utils/utils'
import { assert } from 'chai';
import { Keypair } from '@solana/web3.js';
import {
    ADMIN_WALLET,
} from './utils/constants';


describe("config settings", () => {

    const provider = AnchorProvider.env();
    setProvider(provider);
    const program = workspace.RnsdidCore as Program<RnsdidCore>;

    it("success: set_mint_price", async () => {
        const nonTransferableProject = await findNonTransferableProject();
        const mintPrice = new BN(100);

        await program.methods
            .setMintPrice(mintPrice)
            .accountsPartial({
                authority: ADMIN_WALLET.publicKey,
                nonTransferableProject: nonTransferableProject,
            })
            .signers([ADMIN_WALLET])
            .rpc();

        const _collection = await program.account.projectAccount.fetch(nonTransferableProject);
        assert(mintPrice.toString() == _collection.mintPrice.toString(), 'mintPrice not eq!');
        console.log("✅ set_mint_price:", mintPrice.toString());
    });

    it("success: set_fee_recipient", async () => {
        const nonTransferableProject = await findNonTransferableProject();

        await program.methods
            .setFeeRecipient(ADMIN_WALLET.publicKey)
            .accountsPartial({
                authority: ADMIN_WALLET.publicKey,
                nonTransferableProject: nonTransferableProject,
            })
            .signers([ADMIN_WALLET])
            .rpc();

        const _collection = await program.account.projectAccount.fetch(nonTransferableProject);
        assert(ADMIN_WALLET.publicKey.toBase58() == _collection.feeRecipient.toBase58(), 'feeRecipient not eq!');
        console.log("✅ set_fee_recipient:", ADMIN_WALLET.publicKey.toBase58());
    });

    it("success: set_base_uri", async () => {
        const nonTransferableProject = await findNonTransferableProject();
        const _base_uri = "https://api.rns.id/api/v2/portal/identity/nft/";

        await program.methods
            .setBaseUri(_base_uri)
            .accountsPartial({
                authority: ADMIN_WALLET.publicKey,
                nonTransferableProject: nonTransferableProject,
            })
            .signers([ADMIN_WALLET])
            .rpc();

        const data = await program.account.projectAccount.fetch(nonTransferableProject);
        assert(data.baseUri.toString() == _base_uri, "base uri setting failed!");
        console.log("✅ set_base_uri:", _base_uri);
    });

    it("success: set_is_blocked_address", async () => {
        const nonTransferableProject = await findNonTransferableProject();
        const _wallet = Keypair.generate().publicKey;

        await program.methods
            .setIsBlockedAddress(_wallet, true)
            .accountsPartial({
                authority: ADMIN_WALLET.publicKey,
                nonTransferableProject: nonTransferableProject,
            })
            .signers([ADMIN_WALLET])
            .rpc();

        const data = await program.account.projectAccount.fetch(nonTransferableProject);
        let item = data.isBlockedAddress[0];
        assert(item.key.toBase58() == _wallet.toBase58() && item.value == true, "set_is_blocked_address failed!");
        console.log("✅ set_is_blocked_address:", _wallet.toBase58());
    });

    it("success: set_is_blocked_rns_id", async () => {
        const nonTransferableProject = await findNonTransferableProject();
        const rns_id = "blocked-rns-id-test";

        await program.methods
            .setIsBlockedRnsId(rns_id, true)
            .accountsPartial({
                authority: ADMIN_WALLET.publicKey,
                nonTransferableProject: nonTransferableProject,
            })
            .signers([ADMIN_WALLET])
            .rpc();

        const data = await program.account.projectAccount.fetch(nonTransferableProject);
        let item = data.isBlockedRnsId[0];
        assert(item.key == rns_id && item.value == true, "set_is_blocked_rns_id failed!");
        console.log("✅ set_is_blocked_rns_id:", rns_id);
    });
});
