import { LegalAttestation } from '../../target/types/legal_attestation'
import {
    Program,
    web3,
    workspace,
    setProvider,
    AnchorProvider,
    BN,
} from '@coral-xyz/anchor'
import { PublicKey, Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js'
import { assert } from 'chai'

// Constants
const ADMIN_WALLET = Keypair.generate()
const OPERATOR_WALLET = Keypair.generate()
const USER_WALLET = Keypair.generate()
const FEE_RECIPIENT = Keypair.generate()

const ATTESTATION_CONFIG_PREFIX = "attestation-config"

// SAS Program ID (official)
const SAS_PROGRAM_ID = new PublicKey("22zoJMtdu4tQc2PzL74ZUT7FrwgB1Udec8DdW4yw4BdG")

describe("LegalAttestation Tests", () => {
    const provider = AnchorProvider.env()
    setProvider(provider)
    const program = workspace.LegalAttestation as Program<LegalAttestation>

    let configPda: PublicKey
    let configBump: number

    before(async () => {
        // Calculate PDA
        [configPda, configBump] = PublicKey.findProgramAddressSync(
            [Buffer.from(ATTESTATION_CONFIG_PREFIX)],
            program.programId
        )

        // Airdrop SOL to test wallets
        const airdropAdmin = await provider.connection.requestAirdrop(
            ADMIN_WALLET.publicKey,
            10 * LAMPORTS_PER_SOL
        )
        await provider.connection.confirmTransaction(airdropAdmin)

        const airdropOperator = await provider.connection.requestAirdrop(
            OPERATOR_WALLET.publicKey,
            5 * LAMPORTS_PER_SOL
        )
        await provider.connection.confirmTransaction(airdropOperator)

        const airdropUser = await provider.connection.requestAirdrop(
            USER_WALLET.publicKey,
            5 * LAMPORTS_PER_SOL
        )
        await provider.connection.confirmTransaction(airdropUser)

        const airdropFeeRecipient = await provider.connection.requestAirdrop(
            FEE_RECIPIENT.publicKey,
            1 * LAMPORTS_PER_SOL
        )
        await provider.connection.confirmTransaction(airdropFeeRecipient)

        console.log("✅ Airdropped SOL to test wallets")
        console.log("  Admin:", ADMIN_WALLET.publicKey.toBase58())
        console.log("  Operator:", OPERATOR_WALLET.publicKey.toBase58())
        console.log("  User:", USER_WALLET.publicKey.toBase58())
        console.log("  Fee Recipient:", FEE_RECIPIENT.publicKey.toBase58())
        console.log("  Config PDA:", configPda.toBase58())
    })

    describe("Initialize", () => {
        it("should initialize the attestation config", async () => {
            const attestationFee = new BN(0.01 * LAMPORTS_PER_SOL) // 0.01 SOL

            await program.methods
                .initialize({
                    attestationFee,
                    feeRecipient: FEE_RECIPIENT.publicKey,
                })
                .accountsPartial({
                    authority: ADMIN_WALLET.publicKey,
                    config: configPda,
                    systemProgram: web3.SystemProgram.programId,
                })
                .signers([ADMIN_WALLET])
                .rpc()

            // Verify config
            const config = await program.account.attestationConfig.fetch(configPda)
            assert.equal(config.authority.toBase58(), ADMIN_WALLET.publicKey.toBase58())
            assert.equal(config.attestationFee.toString(), attestationFee.toString())
            assert.equal(config.feeRecipient.toBase58(), FEE_RECIPIENT.publicKey.toBase58())
            assert.equal(config.operators.length, 0)
            assert.equal(config.schemaCount.toString(), "0")

            console.log("✅ Config initialized")
            console.log("  Authority:", config.authority.toBase58())
            console.log("  Attestation Fee:", config.attestationFee.toString(), "lamports")
            console.log("  Fee Recipient:", config.feeRecipient.toBase58())
        })
    })

    describe("Operator Management", () => {
        it("should add an operator", async () => {
            await program.methods
                .addOperator(OPERATOR_WALLET.publicKey)
                .accountsPartial({
                    authority: ADMIN_WALLET.publicKey,
                    config: configPda,
                })
                .signers([ADMIN_WALLET])
                .rpc()

            const config = await program.account.attestationConfig.fetch(configPda)
            assert.equal(config.operators.length, 1)
            assert.equal(config.operators[0].toBase58(), OPERATOR_WALLET.publicKey.toBase58())

            console.log("✅ Operator added:", OPERATOR_WALLET.publicKey.toBase58())
        })

        it("should fail to add duplicate operator", async () => {
            try {
                await program.methods
                    .addOperator(OPERATOR_WALLET.publicKey)
                    .accountsPartial({
                        authority: ADMIN_WALLET.publicKey,
                        config: configPda,
                    })
                    .signers([ADMIN_WALLET])
                    .rpc()
                assert.fail("Should have thrown error")
            } catch (err: any) {
                assert.include(err.message, "OperatorAlreadyExists")
                console.log("✅ Correctly rejected duplicate operator")
            }
        })

        it("should fail when non-admin tries to add operator", async () => {
            const randomWallet = Keypair.generate()
            try {
                await program.methods
                    .addOperator(randomWallet.publicKey)
                    .accountsPartial({
                        authority: USER_WALLET.publicKey,
                        config: configPda,
                    })
                    .signers([USER_WALLET])
                    .rpc()
                assert.fail("Should have thrown error")
            } catch (err: any) {
                assert.include(err.message, "Unauthorized")
                console.log("✅ Correctly rejected non-admin")
            }
        })
    })

    describe("Fee Management", () => {
        it("should update attestation fee", async () => {
            const newFee = new BN(0.02 * LAMPORTS_PER_SOL) // 0.02 SOL

            await program.methods
                .setAttestationFee(newFee)
                .accountsPartial({
                    authority: ADMIN_WALLET.publicKey,
                    config: configPda,
                })
                .signers([ADMIN_WALLET])
                .rpc()

            const config = await program.account.attestationConfig.fetch(configPda)
            assert.equal(config.attestationFee.toString(), newFee.toString())

            console.log("✅ Fee updated to:", newFee.toString(), "lamports")
        })

        it("should update fee recipient", async () => {
            const newRecipient = Keypair.generate()

            await program.methods
                .setFeeRecipient(newRecipient.publicKey)
                .accountsPartial({
                    authority: ADMIN_WALLET.publicKey,
                    config: configPda,
                })
                .signers([ADMIN_WALLET])
                .rpc()

            const config = await program.account.attestationConfig.fetch(configPda)
            assert.equal(config.feeRecipient.toBase58(), newRecipient.publicKey.toBase58())

            // Reset to original
            await program.methods
                .setFeeRecipient(FEE_RECIPIENT.publicKey)
                .accountsPartial({
                    authority: ADMIN_WALLET.publicKey,
                    config: configPda,
                })
                .signers([ADMIN_WALLET])
                .rpc()

            console.log("✅ Fee recipient updated and reset")
        })
    })

    describe("Request Attestation (User Flow)", () => {
        it("should allow user to request attestation and pay fee", async () => {
            // Set a known fee first
            const attestationFee = new BN(0.01 * LAMPORTS_PER_SOL)
            await program.methods
                .setAttestationFee(attestationFee)
                .accountsPartial({
                    authority: ADMIN_WALLET.publicKey,
                    config: configPda,
                })
                .signers([ADMIN_WALLET])
                .rpc()

            const userBalanceBefore = await provider.connection.getBalance(USER_WALLET.publicKey)
            const feeRecipientBalanceBefore = await provider.connection.getBalance(FEE_RECIPIENT.publicKey)

            // Mock schema pubkey (in real scenario, this would be a SAS schema)
            const mockSchema = Keypair.generate().publicKey
            const requestId = "request-" + Date.now()

            await program.methods
                .requestAttestation(mockSchema, requestId)
                .accountsPartial({
                    user: USER_WALLET.publicKey,
                    config: configPda,
                    feeRecipient: FEE_RECIPIENT.publicKey,
                    systemProgram: web3.SystemProgram.programId,
                })
                .signers([USER_WALLET])
                .rpc()

            const userBalanceAfter = await provider.connection.getBalance(USER_WALLET.publicKey)
            const feeRecipientBalanceAfter = await provider.connection.getBalance(FEE_RECIPIENT.publicKey)

            const userPaid = userBalanceBefore - userBalanceAfter
            const feeReceived = feeRecipientBalanceAfter - feeRecipientBalanceBefore

            console.log("✅ Attestation requested")
            console.log("  Request ID:", requestId)
            console.log("  Schema:", mockSchema.toBase58())
            console.log("  User paid:", userPaid / LAMPORTS_PER_SOL, "SOL (includes tx fee)")
            console.log("  Fee recipient received:", feeReceived / LAMPORTS_PER_SOL, "SOL")

            // Verify fee was transferred
            assert.equal(feeReceived, attestationFee.toNumber(), "Fee recipient should receive exact fee")
        })

        it("should work with zero fee", async () => {
            // Set fee to 0
            await program.methods
                .setAttestationFee(new BN(0))
                .accountsPartial({
                    authority: ADMIN_WALLET.publicKey,
                    config: configPda,
                })
                .signers([ADMIN_WALLET])
                .rpc()

            const mockSchema = Keypair.generate().publicKey
            const requestId = "free-request-" + Date.now()

            await program.methods
                .requestAttestation(mockSchema, requestId)
                .accountsPartial({
                    user: USER_WALLET.publicKey,
                    config: configPda,
                    feeRecipient: FEE_RECIPIENT.publicKey,
                    systemProgram: web3.SystemProgram.programId,
                })
                .signers([USER_WALLET])
                .rpc()

            console.log("✅ Free attestation request succeeded")
        })
    })

    describe("Remove Operator", () => {
        it("should remove an operator", async () => {
            await program.methods
                .removeOperator(OPERATOR_WALLET.publicKey)
                .accountsPartial({
                    authority: ADMIN_WALLET.publicKey,
                    config: configPda,
                })
                .signers([ADMIN_WALLET])
                .rpc()

            const config = await program.account.attestationConfig.fetch(configPda)
            assert.equal(config.operators.length, 0)

            console.log("✅ Operator removed")
        })
    })
})
