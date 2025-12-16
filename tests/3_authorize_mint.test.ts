import { RnsdidCore } from '../target/types/rnsdid_core'

import {
    Program,
    web3,
    workspace,
    setProvider,
    AnchorProvider,
} from '@coral-xyz/anchor'
import {
    findNonTransferableProject,
    findDIDStatus,
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
    let didStatus;
    let accounts;

    before(async () => {
        nonTransferableProject = await findNonTransferableProject();
        didStatus = findDIDStatus(rnsId, USER_WALLET.publicKey);

        accounts = {
            authority: USER_WALLET.publicKey,
            nonTransferableProject: nonTransferableProject,
            didStatus: didStatus,
            feeRecipient: ADMIN_WALLET.publicKey,
            systemProgram: web3.SystemProgram.programId,
            rent: SYSVAR_RENT_PUBKEY,
        };
    })

    it("success: airdrop some gas!", async () => {
        const amount = 5;
        const airdropSignature = await provider.connection.requestAirdrop(
            new PublicKey(USER_WALLET.publicKey),
            LAMPORTS_PER_SOL * amount
        );
        await provider.connection.confirmTransaction(airdropSignature);
        console.log(`✅ Airdropped ${amount} SOL to ${USER_WALLET.publicKey.toBase58()}`);
    });

    it("success: authorize_mint", async () => {
        await program.methods
            .authorizeMint(rnsId, USER_WALLET.publicKey)
            .accounts(accounts)
            .signers([USER_WALLET])
            .rpc();

        // 验证 DID 状态账户
        const data = await program.account.didStatusAccount.fetch(didStatus);
        assert(data.status === 1, "status should be Authorized (1)");
        assert(data.wallet.toBase58() === USER_WALLET.publicKey.toBase58(), "wallet should match");
        console.log("✅ authorize_mint success");
        console.log("   Status:", data.status, "(Authorized)");
        console.log("   Wallet:", data.wallet.toBase58());
    });

    it("failed: ldid authorized again", async () => {
        try {
            await program.methods
                .authorizeMint(rnsId, USER_WALLET.publicKey)
                .accounts(accounts)
                .signers([USER_WALLET])
                .rpc();
            assert.fail("Should have thrown LDIDHasAuthorized error");
        } catch ({ error }) {
            assert(error.errorCode.code === 'LDIDHasAuthorized', "Should be LDIDHasAuthorized error");
            console.log("✅ Correctly rejected duplicate authorization");
        }
    });
});
