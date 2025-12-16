import { RnsdidCore } from '../target/types/rnsdid_core'
import { web3, workspace, setProvider, AnchorProvider } from '@coral-xyz/anchor'
import { findNonTransferableUserStatus } from './utils/utils'
import { ADMIN_WALLET } from "./utils/constants";

describe("debug seeds", () => {
    const provider = AnchorProvider.env();
    setProvider(provider)
    const program = workspace.RnsdidCore as Program<RnsdidCore>;

    it("debug account derivation", async () => {
        const rnsId = "test-debug-123";
        const testUser = web3.Keypair.generate();
        
        console.log("=== Debug Info ===");
        console.log("RNS ID:", rnsId);
        console.log("User Pubkey:", testUser.publicKey.toBase58());
        
        // Generate the expected account address
        const expectedUserStatus = findNonTransferableUserStatus(rnsId, testUser.publicKey);
        console.log("Expected UserStatus:", expectedUserStatus.toBase58());
        
        // Let's also check what the program would derive
        console.log("\n=== Manual Derivation ===");
        const crypto = require('crypto');
        const hashedRnsId = crypto.createHash('sha256').update(rnsId).digest().slice(0, 32);
        console.log("Hashed RNS ID:", hashedRnsId.toString('hex'));
        
        const seeds = [
            Buffer.from("nt-nft-user-status"),
            Buffer.from(hashedRnsId),
            testUser.publicKey.toBuffer(),
        ];
        
        const [derivedAddress, bump] = web3.PublicKey.findProgramAddressSync(
            seeds,
            program.programId
        );
        
        console.log("Manually derived address:", derivedAddress.toBase58());
        console.log("Bump:", bump);
        console.log("Addresses match:", expectedUserStatus.equals(derivedAddress));
    });
});