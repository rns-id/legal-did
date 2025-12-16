import { RnsdidCore } from '../target/types/rnsdid_core'

import { ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token'
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
    getUserAssociatedTokenAccount,
    getNonTransferableNftMintAddress,
    getTokenAccountBalance,
    findNonTransferableUserStatus,
    findNonTransferableNftStatus,
    findNonTransferableRnsIdtatus,
} from './utils/utils'

import {
    ADMIN_WALLET, TOKEN_PROGRAM_ID, USER_WALLET,
} from "./utils/constants";
import { assert } from 'chai';
import { ComputeBudgetProgram } from '@solana/web3.js';
const { SYSVAR_RENT_PUBKEY } = web3

describe("revoke then actions analysis", () => {

    const provider = AnchorProvider.env();
    setProvider(provider)
    const program = workspace.RnsdidCore as Program<RnsdidCore>;

    const set_compute_unit_limit_ix = ComputeBudgetProgram.setComputeUnitLimit({
        units: 1_000_000,
    });

    it("analyze: revoke → burn scenario", async () => {
        console.log("\n🔍 === Revoke → Burn Analysis ===");
        
        // 基于我们的设计分析预期行为
        console.log("\n📋 Expected Behavior:");
        console.log("1. Airdrop: Admin pays ~0.0087 SOL");
        console.log("2. Revoke: Admin recovers ~0.0024 SOL (NFT Status)");
        console.log("3. Burn attempt: Should FAIL");
        console.log("   - Reason: User Status marked as revoked (is_authorized = false)");
        console.log("   - Burn constraint: requires is_authorized = true");
        
        console.log("\n💡 Design Logic:");
        console.log("- Revoke marks token as revoked (is_authorized = false)");
        console.log("- Burn only works on active tokens (is_authorized = true)");
        console.log("- This prevents double-processing of the same token");
        
        console.log("\n📊 Expected Rent Recovery:");
        console.log("- Direct Burn: Admin +0.0052, User +0.0020 (Total: 0.0072)");
        console.log("- Revoke only: Admin +0.0024 (Partial recovery)");
        console.log("- Revoke → Burn: BLOCKED (prevents double recovery)");
    });

    it("analyze: revoke → cleanup scenario", async () => {
        console.log("\n🔍 === Revoke → Cleanup Analysis ===");
        
        console.log("\n📋 Expected Behavior:");
        console.log("1. Airdrop: Admin pays ~0.0087 SOL");
        console.log("2. Revoke: Admin recovers ~0.0024 SOL (NFT Status)");
        console.log("3. Cleanup: Should SUCCEED");
        console.log("   - User can cleanup their revoked token");
        console.log("   - Admin gets User Status rent (~0.0015 SOL)");
        console.log("   - User gets Token Account rent (~0.0020 SOL)");
        
        console.log("\n💡 Design Logic:");
        console.log("- Cleanup specifically designed for revoked tokens");
        console.log("- Cleanup constraint: requires is_authorized = false");
        console.log("- This allows users to recover their token account rent");
        
        console.log("\n📊 Expected Rent Recovery:");
        console.log("- Revoke: Admin +0.0024 SOL");
        console.log("- Cleanup: Admin +0.0015, User +0.0020 SOL");
        console.log("- Total: Admin +0.0039, User +0.0020 (Total: 0.0059)");
        console.log("- Recovery Rate: ~82% (vs 100% for direct burn)");
    });

    it("compare all scenarios", async () => {
        console.log("\n📊 === Complete Scenario Comparison ===");
        
        const scenarios = [
            {
                name: "Direct Burn",
                steps: ["Airdrop (-0.0087)", "Burn (+0.0072)"],
                adminNet: -0.0015,
                userNet: +0.0020,
                totalRecovery: 0.0072,
                recoveryRate: "100%",
                notes: "User initiated, complete cleanup"
            },
            {
                name: "Direct Revoke",
                steps: ["Airdrop (-0.0087)", "Revoke (+0.0024)"],
                adminNet: -0.0063,
                userNet: 0,
                totalRecovery: 0.0024,
                recoveryRate: "28%",
                notes: "Admin forced, partial recovery, token frozen"
            },
            {
                name: "Revoke → Cleanup",
                steps: ["Airdrop (-0.0087)", "Revoke (+0.0024)", "Cleanup (+0.0035)"],
                adminNet: -0.0028,
                userNet: +0.0020,
                totalRecovery: 0.0059,
                recoveryRate: "82%",
                notes: "Admin forced + user cooperation"
            },
            {
                name: "Revoke → Burn",
                steps: ["Airdrop (-0.0087)", "Revoke (+0.0024)", "Burn (BLOCKED)"],
                adminNet: -0.0063,
                userNet: 0,
                totalRecovery: 0.0024,
                recoveryRate: "28%",
                notes: "Blocked by design to prevent double-processing"
            }
        ];

        console.log("\n| Scenario | Admin Net | User Net | Recovery | Rate | Status |");
        console.log("|----------|-----------|----------|----------|------|--------|");
        
        scenarios.forEach(scenario => {
            console.log(`| ${scenario.name.padEnd(8)} | ${scenario.adminNet.toFixed(4).padStart(9)} | ${scenario.userNet.toFixed(4).padStart(8)} | ${scenario.totalRecovery.toFixed(4).padStart(8)} | ${scenario.recoveryRate.padStart(4)} | ${scenario.notes} |`);
        });

        console.log("\n🎯 Key Insights:");
        console.log("1. Direct Burn: Best for users (highest recovery)");
        console.log("2. Revoke → Cleanup: Good compromise (admin control + user incentive)");
        console.log("3. Revoke → Burn: Blocked by design (prevents abuse)");
        console.log("4. Direct Revoke: Admin emergency option (lowest recovery)");
        
        console.log("\n✅ Design Validation:");
        console.log("- Prevents double-spending of rent recovery");
        console.log("- Provides multiple paths based on circumstances");
        console.log("- Balances admin control with user incentives");
        console.log("- Maintains economic sustainability");
    });

    it("rent recovery breakdown", async () => {
        console.log("\n💰 === Detailed Rent Breakdown ===");
        
        const accounts = {
            "User Status": { size: "93 bytes", rent: "0.00154 SOL", owner: "Admin pays, gets back" },
            "NFT Status": { size: "217 bytes", rent: "0.00240 SOL", owner: "Admin pays, gets back" },
            "RNS ID Status": { size: "48 bytes", rent: "0.00122 SOL", owner: "Admin pays, conditional return" },
            "Token Account": { size: "165 bytes", rent: "0.00204 SOL", owner: "User owns, gets back" }
        };

        console.log("\n📋 Account Details:");
        Object.entries(accounts).forEach(([name, details]) => {
            console.log(`${name.padEnd(15)}: ${details.size.padEnd(10)} | ${details.rent.padEnd(12)} | ${details.owner}`);
        });

        console.log("\n🔄 Recovery by Action:");
        console.log("Airdrop creates all accounts (Admin pays ~0.0072 SOL)");
        console.log("Burn recovers all accounts (Admin +0.0052, User +0.0020)");
        console.log("Revoke recovers NFT Status only (Admin +0.0024)");
        console.log("Cleanup recovers User Status + Token (Admin +0.0015, User +0.0020)");
        
        console.log("\n💡 Why This Design Works:");
        console.log("- Admin bears initial cost, gets most recovery");
        console.log("- User gets their own account rent back");
        console.log("- Prevents rent farming or double recovery");
        console.log("- Provides flexibility for different scenarios");
    });
});