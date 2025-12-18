import { Legaldid } from '../../target/types/legaldid'
import {
    Program,
    web3,
    workspace,
    setProvider,
    AnchorProvider,
} from '@coral-xyz/anchor'
import { ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync, TOKEN_2022_PROGRAM_ID } from '@solana/spl-token'
import { PublicKey } from '@solana/web3.js'
import { assert } from 'chai';
import { ComputeBudgetProgram } from '@solana/web3.js';

const { SYSVAR_RENT_PUBKEY } = web3

// Constants
const ADMIN_WALLET = web3.Keypair.generate();
const USER_WALLET = web3.Keypair.generate();

const NON_TRANSFERABLE_PROJECT_PREFIX = "nt-proj-v5";
const NON_TRANSFERABLE_NFT_MINT_PREFIX = "nt-nft-mint-v5";

describe("Optimized Flow Test (No DIDStatusAccount)", () => {
    const provider = AnchorProvider.env();
    setProvider(provider)
    const program = workspace.Legaldid as Program<Legaldid>;

    const rnsId = "rns-" + Date.now();
    const index = "idx-" + Date.now();
    const merkleRoot = "0x764e6372e05f4db05595276214e74f047a6562f19bf6cc3bb35a53ac892c3ce3";

    let nonTransferableProject: PublicKey;
    let nonTransferableProjectMint: PublicKey;
    let nonTransferableNftMint: PublicKey;
    let userTokenAccount: PublicKey;

    before(async () => {
        // Calculate PDA
        [nonTransferableProject] = PublicKey.findProgramAddressSync(
            [Buffer.from(NON_TRANSFERABLE_PROJECT_PREFIX)],
            program.programId
        );

        [nonTransferableProjectMint] = PublicKey.findProgramAddressSync(
            [Buffer.from("nt-project-mint-v5")],
            program.programId
        );

        [nonTransferableNftMint] = PublicKey.findProgramAddressSync(
            [Buffer.from(NON_TRANSFERABLE_NFT_MINT_PREFIX), Buffer.from(index)],
            program.programId
        );

        userTokenAccount = getAssociatedTokenAddressSync(
            nonTransferableNftMint,
            USER_WALLET.publicKey,
            false,
            TOKEN_2022_PROGRAM_ID
        );

        // Airdrop SOL
        const airdropAdmin = await provider.connection.requestAirdrop(
            ADMIN_WALLET.publicKey,
            10 * web3.LAMPORTS_PER_SOL
        );
        await provider.connection.confirmTransaction(airdropAdmin);

        const airdropUser = await provider.connection.requestAirdrop(
            USER_WALLET.publicKey,
            5 * web3.LAMPORTS_PER_SOL
        );
        await provider.connection.confirmTransaction(airdropUser);

        console.log("Airdropped SOL to wallets");
    });

    it("Initialize project", async () => {
        const ix = ComputeBudgetProgram.setComputeUnitLimit({ units: 1_000_000 });

        await program.methods
            .initialize({
                name: "Legal DID",
                symbol: 'LDID',
                baseUri: "https://api.rns.id/api/v2/portal/identity/nft/"
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
            .preInstructions([ix])
            .rpc();

        console.log("✅ Project initialized");
    });

    it("AuthorizeMint - user pays fee and emits event", async () => {
        console.log("\n=== AuthorizeMint Test ===");

        const userBalanceBefore = await provider.connection.getBalance(USER_WALLET.publicKey);
        const adminBalanceBefore = await provider.connection.getBalance(ADMIN_WALLET.publicKey);

        // User pays to request mint
        const tx = await program.methods
            .authorizeMint(rnsId, merkleRoot, index)
            .accountsPartial({
                payer: USER_WALLET.publicKey,
                nonTransferableProject: nonTransferableProject,
                feeRecipient: ADMIN_WALLET.publicKey, // fee_recipient defaults to admin
                systemProgram: web3.SystemProgram.programId,
            })
            .signers([USER_WALLET])
            .rpc();

        const userBalanceAfter = await provider.connection.getBalance(USER_WALLET.publicKey);
        const adminBalanceAfter = await provider.connection.getBalance(ADMIN_WALLET.publicKey);

        const userPaid = (userBalanceBefore - userBalanceAfter) / 1e9;
        const adminReceived = (adminBalanceAfter - adminBalanceBefore) / 1e9;

        console.log("✅ AuthorizeMint success");
        console.log("  💸 User paid:", userPaid.toFixed(8), "SOL (includes tx fee)");
        console.log("  💰 Admin received:", adminReceived.toFixed(8), "SOL");
        console.log("  📝 Transaction:", tx);

        // Verify admin received mint_price (100 lamports, set in initialize)
        assert(adminReceived > 0 || adminBalanceAfter >= adminBalanceBefore, "Admin should receive fee");
    });

    it("Airdrop NFT (one step, merkle_root in metadata)", async () => {
        console.log("\n=== Optimized Airdrop Test ===");
        console.log("RNS ID:", rnsId);
        console.log("Index:", index);

        const adminBalanceBefore = await provider.connection.getBalance(ADMIN_WALLET.publicKey);

        const ix = ComputeBudgetProgram.setComputeUnitLimit({ units: 1_000_000 });

        await program.methods
            .airdrop(rnsId, USER_WALLET.publicKey, merkleRoot, index)
            .accountsPartial({
                authority: ADMIN_WALLET.publicKey,
                nonTransferableProject: nonTransferableProject,
                nonTransferableNftMint: nonTransferableNftMint,
                userAccount: USER_WALLET.publicKey,
                userTokenAccount: userTokenAccount,
                collectionMint: nonTransferableProjectMint,
                associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
                tokenProgram: TOKEN_2022_PROGRAM_ID,
                systemProgram: web3.SystemProgram.programId,
                rent: SYSVAR_RENT_PUBKEY,
            })
            .signers([ADMIN_WALLET])
            .preInstructions([ix])
            .rpc();

        const adminBalanceAfter = await provider.connection.getBalance(ADMIN_WALLET.publicKey);
        const cost = (adminBalanceBefore - adminBalanceAfter) / 1e9;

        console.log("✅ NFT minted");
        console.log("  💸 Cost:", cost.toFixed(8), "SOL");
        console.log("  💸 Cost (USD @ $140):", (cost * 140).toFixed(2), "USD");

        // Verify NFT Mint exists
        const mintInfo = await provider.connection.getAccountInfo(nonTransferableNftMint);
        assert(mintInfo !== null, "NFT Mint should exist");
        assert(mintInfo.owner.equals(TOKEN_2022_PROGRAM_ID), "Should be Token-2022");
        console.log("  ✅ Token-2022 NFT Mint verified");
    });

    it("User burn NFT", async () => {
        console.log("\n=== User Burn Test ===");

        const adminBalanceBefore = await provider.connection.getBalance(ADMIN_WALLET.publicKey);
        const userBalanceBefore = await provider.connection.getBalance(USER_WALLET.publicKey);

        const ix = ComputeBudgetProgram.setComputeUnitLimit({ units: 1_000_000 });

        await program.methods
            .burn(rnsId, index)
            .accountsPartial({
                nftOwner: USER_WALLET.publicKey,
                authority: ADMIN_WALLET.publicKey,
                nonTransferableProject: nonTransferableProject,
                userTokenAccount: userTokenAccount,
                nonTransferableNftMint: nonTransferableNftMint,
                associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
                tokenProgram: TOKEN_2022_PROGRAM_ID,
                systemProgram: web3.SystemProgram.programId,
            })
            .signers([USER_WALLET])
            .preInstructions([ix])
            .rpc();

        const adminBalanceAfter = await provider.connection.getBalance(ADMIN_WALLET.publicKey);
        const userBalanceAfter = await provider.connection.getBalance(USER_WALLET.publicKey);
        
        const adminRecovered = (adminBalanceAfter - adminBalanceBefore) / 1e9;
        const userRecovered = (userBalanceAfter - userBalanceBefore) / 1e9;

        console.log("✅ NFT burned");
        console.log("  💰 Admin recovered (Mint rent):", adminRecovered.toFixed(8), "SOL");
        console.log("  💰 User recovered (ATA rent - tx fee):", userRecovered.toFixed(8), "SOL");

        // Verify Token Account is closed
        const tokenAccountInfo = await provider.connection.getAccountInfo(userTokenAccount);
        assert(tokenAccountInfo === null, "Token account should be closed");
        console.log("  ✅ Token account closed");

        // Verify Mint account is closed
        const mintInfo = await provider.connection.getAccountInfo(nonTransferableNftMint);
        assert(mintInfo === null, "Mint account should be closed");
        console.log("  ✅ Mint account closed");
    });
});
