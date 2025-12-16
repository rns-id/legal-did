import { RnsdidCore } from "../target/types/rnsdid_core";

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
} from './utils/utils'

import { ADMIN_WALLET, TOKEN_2022_PROGRAM_ID } from "./utils/constants";
import { assert } from "chai";

const { ComputeBudgetProgram, SYSVAR_RENT_PUBKEY } = web3

describe("initialize", () => {

    const provider = AnchorProvider.env()
    setProvider(provider)
    const program = workspace.RnsdidCore as Program<RnsdidCore>;

    before(async () => {
        // Airdrop SOL to test account
        const airdropSignature = await provider.connection.requestAirdrop(
            ADMIN_WALLET.publicKey,
            10 * web3.LAMPORTS_PER_SOL
        );
        await provider.connection.confirmTransaction(airdropSignature);
        console.log("Airdropped 10 SOL to ADMIN_WALLET");
    });

    it("Is initialized with Token-2022!", async () => {

        const nonTransferableProject = await findNonTransferableProject();
        const nonTransferableProjectMint = await getCollectionMintAddress();

        const ix_1 = ComputeBudgetProgram.setComputeUnitLimit({
            units: 1_000_000,
        });

        const domain = "https://dev-api-1.rns.id/"

        await program.methods
            .initialize({
                name: "Legal DID",
                symbol: 'LDID',
                baseUri: `${domain}api/v2/portal/identity/nft/`
            })
            .accountsPartial({
                authority: ADMIN_WALLET.publicKey,
                nonTransferableProject: nonTransferableProject,
                nonTransferableProjectMint: nonTransferableProjectMint,
                tokenProgram: TOKEN_2022_PROGRAM_ID,
                systemProgram: web3.SystemProgram.programId,
                rent: SYSVAR_RENT_PUBKEY,
            })
            .signers([ADMIN_WALLET])
            .preInstructions([ix_1])
            .rpc();

        // 验证项目账户
        const projectAccount = await program.account.projectAccount.fetch(nonTransferableProject);
        assert(projectAccount.name === "Legal DID", "Name should be Legal DID");
        assert(projectAccount.symbol === "LDID", "Symbol should be LDID");
        console.log("✅ Project initialized with Token-2022");
        console.log("   Name:", projectAccount.name);
        console.log("   Symbol:", projectAccount.symbol);
        console.log("   Base URI:", projectAccount.baseUri);

        // 验证 Mint 账户存在
        const mintInfo = await provider.connection.getAccountInfo(nonTransferableProjectMint);
        assert(mintInfo !== null, "Mint account should exist");
        assert(mintInfo.owner.equals(TOKEN_2022_PROGRAM_ID), "Mint should be owned by Token-2022 program");
        console.log("✅ Token-2022 Mint created with extensions");
    });
});
