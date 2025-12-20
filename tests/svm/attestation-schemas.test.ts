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
import * as borsh from 'borsh'

// Constants
const ADMIN_WALLET = Keypair.generate()
const USER_WALLET = Keypair.generate()
const FEE_RECIPIENT = Keypair.generate()

const ATTESTATION_CONFIG_PREFIX = "attestation-config"

// Schema definitions - 模拟 SAS 的 Schema 结构
interface SchemaDefinition {
    name: string
    description: string
    fields: { name: string; type: string }[]
}

// 定义 6 个 Schema
const SCHEMAS: SchemaDefinition[] = [
    {
        name: "jurisdiction",
        description: "Jurisdiction attestation - country/region of legal identity",
        fields: [{ name: "jurisdiction", type: "string" }]
    },
    {
        name: "age_verification",
        description: "Age verification attestation",
        fields: [
            { name: "age_over_18", type: "bool" },
            { name: "age_over_21", type: "bool" },
            { name: "birth_year", type: "u16" }
        ]
    },
    {
        name: "gender",
        description: "Gender attestation",
        fields: [{ name: "gender", type: "string" }]
    },
    {
        name: "sanctions",
        description: "Sanctions check attestation",
        fields: [
            { name: "sanctions_clear", type: "bool" },
            { name: "check_date", type: "i64" }
        ]
    },
    {
        name: "validity",
        description: "Validity status attestation",
        fields: [
            { name: "valid", type: "bool" },
            { name: "issued", type: "i64" },
            { name: "expires", type: "i64" }
        ]
    },
    {
        name: "identity",
        description: "Identity document attestation",
        fields: [
            { name: "id_type", type: "string" },
            { name: "photo_hash", type: "string" }
        ]
    }
]

// 模拟用户的标签数据（基于你提供的 JSON）
const USER_ATTESTATION_DATA = {
    jurisdiction: { jurisdiction: "PALAU" },
    age_verification: { age_over_18: true, age_over_21: true, birth_year: 1990 },
    gender: { gender: "M" },
    sanctions: { sanctions_clear: true, check_date: Date.now() },
    validity: { valid: true, issued: 1732924800, expires: 1764460800 },
    identity: { id_type: "ID", photo_hash: "b8a5899b5255fdb3bc40017f39bead0f" }
}

describe("LegalAttestation - Multiple Schemas Test", () => {
    const provider = AnchorProvider.env()
    setProvider(provider)
    const program = workspace.LegalAttestation as Program<LegalAttestation>

    let configPda: PublicKey

    before(async () => {
        // Calculate PDA
        [configPda] = PublicKey.findProgramAddressSync(
            [Buffer.from(ATTESTATION_CONFIG_PREFIX)],
            program.programId
        )

        // Airdrop SOL
        const airdropAdmin = await provider.connection.requestAirdrop(
            ADMIN_WALLET.publicKey,
            10 * LAMPORTS_PER_SOL
        )
        await provider.connection.confirmTransaction(airdropAdmin)

        const airdropUser = await provider.connection.requestAirdrop(
            USER_WALLET.publicKey,
            5 * LAMPORTS_PER_SOL
        )
        await provider.connection.confirmTransaction(airdropUser)

        const airdropFee = await provider.connection.requestAirdrop(
            FEE_RECIPIENT.publicKey,
            1 * LAMPORTS_PER_SOL
        )
        await provider.connection.confirmTransaction(airdropFee)

        console.log("\n✅ Test wallets funded")
        console.log("  Admin:", ADMIN_WALLET.publicKey.toBase58())
        console.log("  User:", USER_WALLET.publicKey.toBase58())
    })

    describe("Setup", () => {
        it("should initialize config", async () => {
            const attestationFee = new BN(0.005 * LAMPORTS_PER_SOL) // 0.005 SOL per attestation

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

            console.log("✅ Config initialized with fee:", attestationFee.toNumber() / LAMPORTS_PER_SOL, "SOL")
        })
    })

    describe("Schema Definitions", () => {
        it("should list all 6 schema definitions", () => {
            console.log("\n📋 Available Schemas:")
            console.log("=" .repeat(60))
            
            SCHEMAS.forEach((schema, index) => {
                console.log(`\n${index + 1}. ${schema.name}`)
                console.log(`   Description: ${schema.description}`)
                console.log(`   Fields:`)
                schema.fields.forEach(field => {
                    console.log(`     - ${field.name}: ${field.type}`)
                })
            })
            
            console.log("\n" + "=".repeat(60))
            console.log(`Total: ${SCHEMAS.length} schemas available`)
            
            assert.equal(SCHEMAS.length, 6, "Should have 6 schemas")
        })
    })

    describe("User Attestation Requests", () => {
        it("should request all 6 attestations for a user", async () => {
            console.log("\n🏷️ Requesting attestations for user:", USER_WALLET.publicKey.toBase58())
            console.log("=" .repeat(60))

            const userBalanceBefore = await provider.connection.getBalance(USER_WALLET.publicKey)
            const feeRecipientBalanceBefore = await provider.connection.getBalance(FEE_RECIPIENT.publicKey)

            // Request each attestation type
            for (const schema of SCHEMAS) {
                const mockSchemaId = Keypair.generate().publicKey
                const requestId = `${schema.name}-${Date.now()}`
                
                await program.methods
                    .requestAttestation(mockSchemaId, requestId)
                    .accountsPartial({
                        user: USER_WALLET.publicKey,
                        config: configPda,
                        feeRecipient: FEE_RECIPIENT.publicKey,
                        systemProgram: web3.SystemProgram.programId,
                    })
                    .signers([USER_WALLET])
                    .rpc()

                const data = USER_ATTESTATION_DATA[schema.name as keyof typeof USER_ATTESTATION_DATA]
                console.log(`\n✅ Requested: ${schema.name}`)
                console.log(`   Data: ${JSON.stringify(data)}`)
            }

            const userBalanceAfter = await provider.connection.getBalance(USER_WALLET.publicKey)
            const feeRecipientBalanceAfter = await provider.connection.getBalance(FEE_RECIPIENT.publicKey)

            const totalUserPaid = (userBalanceBefore - userBalanceAfter) / LAMPORTS_PER_SOL
            const totalFeeReceived = (feeRecipientBalanceAfter - feeRecipientBalanceBefore) / LAMPORTS_PER_SOL

            console.log("\n" + "=".repeat(60))
            console.log("💰 Cost Summary:")
            console.log(`   Total user paid: ${totalUserPaid.toFixed(4)} SOL (includes tx fees)`)
            console.log(`   Total fees received: ${totalFeeReceived.toFixed(4)} SOL`)
            console.log(`   Fee per attestation: ${(totalFeeReceived / SCHEMAS.length).toFixed(4)} SOL`)
            console.log(`   USD cost @ $140/SOL: $${(totalUserPaid * 140).toFixed(2)}`)
        })
    })

    describe("Attestation Data Examples", () => {
        it("should show example attestation data for the user", () => {
            console.log("\n📄 User Attestation Data (from JSON):")
            console.log("=" .repeat(60))
            
            // Jurisdiction
            console.log("\n1. Jurisdiction Attestation:")
            console.log(`   jurisdiction: "${USER_ATTESTATION_DATA.jurisdiction.jurisdiction}"`)
            
            // Age Verification
            console.log("\n2. Age Verification Attestation:")
            console.log(`   age_over_18: ${USER_ATTESTATION_DATA.age_verification.age_over_18}`)
            console.log(`   age_over_21: ${USER_ATTESTATION_DATA.age_verification.age_over_21}`)
            console.log(`   birth_year: ${USER_ATTESTATION_DATA.age_verification.birth_year}`)
            
            // Gender
            console.log("\n3. Gender Attestation:")
            console.log(`   gender: "${USER_ATTESTATION_DATA.gender.gender}"`)
            
            // Sanctions
            console.log("\n4. Sanctions Attestation:")
            console.log(`   sanctions_clear: ${USER_ATTESTATION_DATA.sanctions.sanctions_clear}`)
            console.log(`   check_date: ${new Date(USER_ATTESTATION_DATA.sanctions.check_date).toISOString()}`)
            
            // Validity
            console.log("\n5. Validity Attestation:")
            console.log(`   valid: ${USER_ATTESTATION_DATA.validity.valid}`)
            console.log(`   issued: ${new Date(USER_ATTESTATION_DATA.validity.issued * 1000).toISOString()}`)
            console.log(`   expires: ${new Date(USER_ATTESTATION_DATA.validity.expires * 1000).toISOString()}`)
            
            // Identity
            console.log("\n6. Identity Attestation:")
            console.log(`   id_type: "${USER_ATTESTATION_DATA.identity.id_type}"`)
            console.log(`   photo_hash: "${USER_ATTESTATION_DATA.identity.photo_hash}"`)
            
            console.log("\n" + "=".repeat(60))
        })
    })

    describe("Cost Analysis", () => {
        it("should calculate total cost for all attestations", () => {
            const feePerAttestation = 0.005 // SOL
            const sasRentPerAttestation = 0.00214 // SOL (estimated)
            const txFeePerAttestation = 0.00001 // SOL
            
            const totalSchemas = SCHEMAS.length
            
            // User pays
            const userTotalFee = feePerAttestation * totalSchemas
            const userTotalTxFee = txFeePerAttestation * totalSchemas
            const userTotal = userTotalFee + userTotalTxFee
            
            // Admin pays (for actual attestation creation)
            const adminTotalRent = sasRentPerAttestation * totalSchemas
            const adminTotalTxFee = txFeePerAttestation * totalSchemas
            const adminTotal = adminTotalRent + adminTotalTxFee
            
            console.log("\n💵 Cost Analysis for 6 Attestations:")
            console.log("=" .repeat(60))
            
            console.log("\n👤 User Costs (request_attestation):")
            console.log(`   Fee per attestation: ${feePerAttestation} SOL`)
            console.log(`   Total fees: ${userTotalFee} SOL`)
            console.log(`   Total tx fees: ${userTotalTxFee.toFixed(5)} SOL`)
            console.log(`   User Total: ${userTotal.toFixed(5)} SOL ($${(userTotal * 140).toFixed(2)})`)
            
            console.log("\n👨‍💼 Admin Costs (create_attestation via SAS):")
            console.log(`   Rent per attestation: ~${sasRentPerAttestation} SOL`)
            console.log(`   Total rent: ~${adminTotalRent.toFixed(5)} SOL`)
            console.log(`   Total tx fees: ${adminTotalTxFee.toFixed(5)} SOL`)
            console.log(`   Admin Total: ~${adminTotal.toFixed(5)} SOL ($${(adminTotal * 140).toFixed(2)})`)
            
            console.log("\n📊 Summary:")
            console.log(`   Total attestations: ${totalSchemas}`)
            console.log(`   User pays: ~$${(userTotal * 140).toFixed(2)}`)
            console.log(`   Admin pays: ~$${(adminTotal * 140).toFixed(2)}`)
            console.log(`   Net profit per user: ~$${((userTotalFee - adminTotalRent) * 140).toFixed(2)}`)
            
            console.log("\n" + "=".repeat(60))
        })
    })
})
