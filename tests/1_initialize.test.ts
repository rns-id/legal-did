import { RnsdidCore } from "../target/types/rnsdid_core";

import {
    Program,
    web3,
    workspace,
    setProvider,
    AnchorProvider,
    BN,
} from '@coral-xyz/anchor'

import { defaultPlugins } from "@metaplex-foundation/umi-bundle-defaults";
import {
    getUserAssociatedTokenAccount,

    findNonTransferableProject,
    getCollectionVaultAddress,
    getCollectionMintAddress,

    getCollectionMetadataAddress,
    getCollectionMasterEditionAddress,

    getCollectionVaultAccount,
} from './utils/utils'

import { ADMIN_WALLET, TOKEN_METADATA_PROGRAM_ID, TOKEN_PROGRAM_ID, USER_WALLET } from "./utils/constants";
import { Metadata, Edition, fetchMetadataFromSeeds } from "@metaplex-foundation/mpl-token-metadata";
import { createUmi } from "@metaplex-foundation/umi";
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

    it("Is initialized!", async () => {

        const nonTransferableProject = await findNonTransferableProject();
        const nonTransferableProjectMint = await getCollectionMintAddress();
        const nonTransferableProjectVault = await getCollectionVaultAddress();
        const nonTransferableProjectMetadata = await getCollectionMetadataAddress(nonTransferableProjectMint);
        const nonTransferableProjectMasterEdition = await getCollectionMasterEditionAddress(nonTransferableProjectMint);
        const collectionVaultAccount = await getCollectionVaultAccount();
        const userTokenAccountAddress = await getUserAssociatedTokenAccount(USER_WALLET.publicKey, nonTransferableProjectMint);

        const transaction = new web3.Transaction()
        const ix_1 = ComputeBudgetProgram.setComputeUnitLimit({
            units: 1_000_000, // Requested compute units, adjust as needed
        });

        const domain = "https://dev-api-1.rns.id/"
        // const domain = "https://api.rns.id/"
        await program.methods
            .initialize({
                name: "Legal DID",
                symbol: 'LDID',
                uri: `${domain}api/v2/portal/identity/collection/metadata/`,
                baseUri: `${domain}api/v2/portal/identity/nft/`
            })
            .accountsPartial({

                authority: ADMIN_WALLET.publicKey,

                nonTransferableProject: nonTransferableProject,
                nonTransferableProjectMint: nonTransferableProjectMint,
                nonTransferableProjectVault: nonTransferableProjectVault,
                nonTransferableProjectMetadata: nonTransferableProjectMetadata,
                nonTransferableProjectMasterEdition: nonTransferableProjectMasterEdition,

                tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
                tokenProgram: TOKEN_PROGRAM_ID,
                systemProgram: web3.SystemProgram.programId,
                rent: SYSVAR_RENT_PUBKEY,
            })
            .signers([
                ADMIN_WALLET,
            ])
            .preInstructions([ix_1])
            .rpc();

        const context = createUmi().use(defaultPlugins("http://localhost:8899", { commitment: "processed" }));
        const metadata = await fetchMetadataFromSeeds(context, { mint: nonTransferableProjectMint as any });
        console.log(metadata.uri)

        assert(metadata.uri == "https://dev-api-1.rns.id/api/v2/portal/identity/collection/metadata/", "!")
        if (!metadata) {
            console.error('Metadata account not found');
            return;
        }
        
    });
});
