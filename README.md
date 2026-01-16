# Legal DID Protocol

A comprehensive decentralized identity and attestation system supporting both Solana (SVM) and Ethereum (EVM) blockchains. The protocol provides legal identity verification, tagged attestations, and soulbound NFT capabilities.

## 🎉 Devnet Status (2025-01-15)

**✅ DEVNET IS READY FOR TESTING AND INTEGRATION**

- ✅ Contracts deployed with V4 event naming
- ✅ All scripts tested and working
- ✅ Token ID auto-increment verified
- ✅ Multi-network support enabled
- ✅ IDL browser validation fixed ⭐
- ✅ Documentation complete
- ✅ Mainnet deployment SOP ready ⭐

👉 **[View Devnet Status](./DEVNET_READY_2025-01-15.md)** for quick start guide and integration examples.

👉 **[Mainnet Deployment SOP](./MAINNET_DEPLOYMENT_SOP.md)** for complete mainnet deployment standard operating procedure.

👉 **[Upload IDL Guide](./HOW_TO_UPLOAD_IDL.md)** for uploading IDL to Solana Explorer and other tools.

---

## 🌟 Features

### Solana (SVM) Implementation
- **Token-2022 Standard**: Uses SPL Token Extensions with advanced features
- **NonTransferable**: Soulbound NFT that cannot be transferred
- **PermanentDelegate**: Permanent delegation for admin revoke/burn operations
- **MetadataPointer**: On-chain metadata pointer to external JSON
- **Legal Attestation**: SAS-based attestation system for legal credentials
- **Multi-Network Support**: Unified scripts support devnet, mainnet, and localnet ⭐
- **Event Naming V4**: Consistent event naming with EVM V4 (AuthorizeMintV4, AirdropV4, etc.) ⭐

### Ethereum (EVM) Implementation
- **EAS Integration**: Ethereum Attestation Service based tagged attestation system
- **Upgradeable Contracts**: OpenZeppelin proxy pattern for contract upgrades
- **Multi-Network Support**: Ethereum, Polygon, Arbitrum, Optimism, Base
- **Role-Based Access Control**: Granular permission management

## 🎯 Recent Updates (2025-01-15)

### ✅ Completed
1. **Event Names Unified**: Updated Solana events to match EVM V4 naming convention
2. **Scripts Refactored**: All 10 core scripts now support multi-network (devnet/mainnet/localnet)
3. **Unified Configuration**: Created `scripts/config.ts` for centralized network management
4. **Documentation Enhanced**: Complete deployment guides and quick reference cards
5. **Scripts Cleaned**: Removed 40+ duplicate/outdated scripts, consolidated to 15 core TypeScript scripts

### 📚 New Documentation
- [Quick Reference](QUICK_REFERENCE.md) - Fast command reference
- [Mainnet Deployment SOP](MAINNET_DEPLOYMENT_SOP.md) - ⭐ Complete standard operating procedure
- [Mainnet Deployment Executive Summary](MAINNET_DEPLOYMENT_EXECUTIVE_SUMMARY.md) - One-page summary
- [Mainnet Deployment Steps](MAINNET_DEPLOYMENT_STEPS.md) - Detailed deployment guide
- [Authority Handover Guide](AUTHORITY_HANDOVER_GUIDE.md) - Permission transfer guide
- [All Scripts Network Support](ALL_SCRIPTS_NETWORK_SUPPORT_COMPLETE.md) - Network support details
- [Final Summary](FINAL_SUMMARY.md) - Project completion summary

## 🚀 Deployments

### Solana Networks

| Network | Legal DID Program | Legal Attestation Program |
|---------|-------------------|---------------------------|
| Mainnet | `3WaA2C9VRHczjqcdVgWw8Ug2VfoCVbCzEp9bwPPG6Qj6` | `4L4PvfugSGXuosyZSQxGxL5B9WqhUVqMEfwqMEUdUGiW` |
| Devnet | `Ce84NtGdKYpxkFpvWn7a5qqBXzkBfEhXM7gg49NtGuhM` | `4L4PvfugSGXuosyZSQxGxL5B9WqhUVqMEfwqMEUdUGiW` |
| Testnet | `3WaA2C9VRHczjqcdVgWw8Ug2VfoCVbCzEp9bwPPG6Qj6` | `4L4PvfugSGXuosyZSQxGxL5B9WqhUVqMEfwqMEUdUGiW` |

### Ethereum Networks

| Network | LegalDIDV4 Proxy | LegalDIDV4 Implementation |
|---------|------------------|---------------------------|
| Sepolia | `0x8E8e446C0633EDdD7f83F2778249f787134053f8` | `0xcC7Aa59ae9C17753035A586e0c4Eb4939a48D411` |
| Mainnet | *TBD* | *TBD* |

**Sepolia Testnet Links:**
- [Proxy Contract](https://sepolia.etherscan.io/address/0x8E8e446C0633EDdD7f83F2778249f787134053f8)
- [Implementation Contract](https://sepolia.etherscan.io/address/0xcC7Aa59ae9C17753035A586e0c4Eb4939a48D411#code)

## 📁 Project Structure

```plaintext
.
├── programs/                   # Solana Programs (Rust)
│   ├── LegalDID/              # Legal DID NFT Program
│   │   └── src/
│   │       ├── lib.rs         # Program entry point
│   │       ├── instructions/  # Instruction handlers
│   │       ├── state/         # Account state definitions
│   │       └── error.rs       # Error definitions
│   └── LegalAttestation/      # Legal Attestation Program
│       └── src/
│           ├── lib.rs         # SAS-based attestation system
│           ├── instructions/  # Attestation operations
│           └── state/         # Attestation state
├── contracts/                 # Ethereum Contracts (Solidity)
│   ├── LegalDID/             # EVM Legal DID Contracts
│   │   ├── LegalDID.sol      # Main DID contract (v0.8.12)
│   │   ├── LegalDIDV2.sol    # Upgraded version
│   │   └── LegalDIDV3.sol    # Latest version
│   └── LegalAttestation/     # EAS-based Tagged Attestation
│       ├── TaggedAttester.sol    # Tag issuance contract
│       ├── TaggedResolver.sol    # Tag verification
│       ├── TaggedQuery.sol       # Tag queries
│       └── TaggedSchemaRegistrar.sol # Schema management
├── scripts/                  # Deployment & utility scripts
│   ├── svm/                  # Solana scripts
│   │   ├── did/              # DID operations
│   │   └── attestation/      # Attestation operations
│   └── evm/                  # Ethereum scripts
├── tests/                    # Test suites
│   ├── svm/                  # Solana tests
│   └── evm/                  # Ethereum tests
└── docs/                     # Documentation
```

## 🛠 Requirements

- **Rust**: 1.82.0+
- **Solana CLI**: 2.3.8+
- **Anchor**: 0.31.1+
- **Node.js**: 18+
- **Hardhat**: 2.22.0+ (for EVM contracts)

## ⚡ Quick Start

### Installation

```sh
git clone https://github.com/rns-id/legal-did-solana.git
cd legal-did-solana
yarn install
```

### Solana Development

```sh
# Build Solana programs
yarn svm:build

# Build and fix IDL for browser compatibility
./build-and-fix-idl.sh

# Test Solana programs
yarn svm:test

# Deploy to Devnet
yarn svm:deploy:devnet
```

**Note**: After building, the IDL file at `target/idl/legaldid.json` is automatically fixed for browser compatibility. See [IDL Fix Guide](./IDL_FIX_2025-01-15.md) for details.

### Ethereum Development

```sh
# Compile EVM contracts
yarn evm:compile

# Test EVM contracts
yarn evm:test

# Deploy to local network
yarn evm:node &
yarn evm:deploy:all:local
```

## 💡 Usage Examples

### Solana Legal DID

#### 1. Initialize Project

```typescript
await program.methods
  .initialize({
    name: 'Legal DID',
    symbol: 'LDID',
    baseUri: 'https://api.rns.id/api/v2/portal/identity/nft/',
  })
  .accounts({...})
  .rpc()
```

#### 2. Authorize Mint

```typescript
await program.methods
  .authorizeMint(rnsId, index)
  .accounts({...})
  .rpc()
```

#### 3. Airdrop NFT

```typescript
await program.methods
  .airdrop(rnsId, targetWallet, merkleRoot, index)
  .accounts({...})
  .rpc()
```

#### 4. Revoke / Burn

```typescript
// Admin revoke
await program.methods.revoke(rnsId, wallet, index).accounts({...}).rpc()

// User burn
await program.methods.burn(rnsId, index).accounts({...}).rpc()
```

### Solana Legal Attestation

#### 1. Create Schema

```typescript
await program.methods
  .createSchema(name, description, layout, fieldNames)
  .accounts({...})
  .rpc()
```

#### 2. Request Attestation

```typescript
await program.methods
  .requestAttestation(schema, requestId)
  .accounts({...})
  .rpc()
```

#### 3. Create Attestation

```typescript
await program.methods
  .createAttestation(nonce, data, expiry)
  .accounts({...})
  .rpc()
```

### Ethereum Tagged Attestation

#### 1. Issue Validity Tag

```typescript
const validityTag = {
  valid: true,
  issued: Math.floor(Date.now() / 1000),
  expires: Math.floor(Date.now() / 1000) + 365 * 24 * 3600
};

await taggedAttester.issueValidityTag(recipient, validityTag);
```

#### 2. Issue Age Verification Tag

```typescript
const ageTag = {
  over18: true,
  over21: true,
  birthYear: 1990,
  verified: true
};

await taggedAttester.issueAgeVerificationTag(recipient, ageTag);
```

#### 3. Query Tags

```typescript
const hasValidTag = await taggedQuery.hasValidTag(userAddress, "validity");
const ageInfo = await taggedQuery.getAgeVerification(userAddress);
```

## 💰 Cost Estimation

### Solana (SOL = $140)

| Operation | SOL | USD | Description |
|-----------|-----|-----|-------------|
| authorize_mint | 0.00163 | $0.23 | DID Status PDA creation (106 bytes) |
| airdrop | 0.00628 | $0.88 | NFT Mint + ATA creation (471 + 174 bytes) |
| **Total per mint** | **0.00791** | **$1.11** | Complete DID issuance |

### Ethereum (Gas estimates at 30 gwei)

| Operation | Gas | ETH (30 gwei) | USD (ETH=$2000) |
|-----------|-----|---------------|-----------------|
| Deploy TaggedAttester | ~2,500,000 | 0.075 | $150 |
| Issue Validity Tag | ~150,000 | 0.0045 | $9 |
| Issue Age Tag | ~120,000 | 0.0036 | $7.2 |
| Batch Issue (10 tags) | ~800,000 | 0.024 | $48 |

## 📊 On-chain Data

### Solana

#### DID Status PDA (106 bytes)
- `rns_id` hash (32 bytes)
- `wallet` address (32 bytes)
- `merkle_root` (32 bytes)
- Status flags and metadata

#### NFT Mint Account (471 bytes)
- Token-2022 base data
- NonTransferableMint extension
- PermanentDelegate extension
- MetadataPointer extension
- TokenMetadata extension

### Ethereum

#### Tagged Attestation Data
- Validity tags (expiration, issue date)
- Clearance tags (background checks)
- Age verification tags (over18, over21)
- Gender tags
- Document type tags
- Geographic tags

## 🔧 Available Scripts

### Solana (SVM) Scripts

| Script | Description |
|--------|-------------|
| `yarn svm:build` | Build Solana programs |
| `yarn svm:test` | Run Solana tests |
| `yarn svm:deploy:devnet` | Deploy to Devnet |
| `yarn svm:init-devnet` | Initialize Devnet project |
| `yarn svm:mint-devnet` | Mint NFT on Devnet |
| `yarn svm:admin-revoke` | Admin revoke DID |
| `yarn svm:user-burn` | User burn DID |
| `yarn svm:update-base-uri` | Update metadata base URI |

### Ethereum (EVM) Scripts

| Script | Description |
|--------|-------------|
| `yarn evm:compile` | Compile EVM contracts |
| `yarn evm:test` | Run all EVM tests |
| `yarn evm:test:legal-did` | Test Legal DID contracts |
| `yarn evm:test:legal-attestation` | Test Legal Attestation contracts |
| `yarn evm:test:coverage` | Generate test coverage report |
| `yarn evm:deploy:all:local` | Deploy all contracts locally |
| `yarn evm:deploy:all:sepolia` | Deploy all contracts to Sepolia |
| `yarn evm:deploy:all:mainnet` | Deploy all contracts to mainnet |
| `yarn evm:node` | Start local Hardhat node |

### Testing Scripts

| Script | Description |
|--------|-------------|
| `yarn evm:test:runner` | Run Legal Attestation test suite |
| `yarn evm:test:runner:coverage` | Run tests with coverage |
| `yarn evm:test:runner:gas` | Run tests with gas analysis |
| `yarn evm:test:all` | Run all EVM tests |
| `yarn clippy` | Run Rust clippy linter |

## 🏗 Architecture

### Solana Programs

#### Legal DID Program
- **Initialize**: Set up project configuration
- **Authorize Mint**: User pays fee to request DID
- **Airdrop**: Admin mints soulbound NFT to user
- **Revoke**: Admin revokes user's DID
- **Burn**: User voluntarily burns their DID

#### Legal Attestation Program
- **SAS Integration**: Uses Solana Attestation Service
- **Schema Management**: Create and manage attestation schemas
- **Request System**: Users request attestations, admins approve
- **Credential System**: Manage attestation credentials and signers

### Ethereum Contracts

#### Tagged Attestation System
- **TaggedAttester**: Issues various types of tags (validity, age, gender, etc.)
- **TaggedResolver**: Resolves and validates tag data
- **TaggedQuery**: Provides query interface for tags
- **TaggedSchemaRegistrar**: Manages attestation schemas

#### Legal DID System
- **LegalDID**: Main DID contract with upgrade support
- **Role-based Access**: Admin and secondary admin roles
- **Soulbound NFTs**: Non-transferable identity tokens

## 🔐 Security Features

### Access Control
- **Multi-signature support**: Critical operations require multiple signatures
- **Role-based permissions**: Granular access control for different operations
- **Operator management**: Add/remove operators for day-to-day operations
- **Time-locked operations**: Certain operations have time delays for security

### Attestation Security
- **Cryptographic proofs**: All attestations are cryptographically signed
- **Expiration management**: Tags can have expiration dates
- **Revocation support**: Attestations can be revoked when necessary
- **Schema validation**: Strict schema validation for all attestation data

### Audit Trail
- **Comprehensive events**: All operations emit detailed events
- **Immutable records**: Blockchain-based immutable audit trail
- **Query capabilities**: Full query support for historical data

## 🌐 Multi-Chain Support

### Solana Features
- **Low cost**: ~$1.11 per complete DID issuance
- **High throughput**: Fast transaction processing
- **Token-2022**: Advanced token features (non-transferable, permanent delegate)
- **SAS integration**: Native attestation service support

### Ethereum Features
- **EAS compatibility**: Full Ethereum Attestation Service integration
- **Multi-network**: Support for Ethereum, Polygon, Arbitrum, Optimism, Base
- **Upgradeable contracts**: OpenZeppelin proxy pattern for future upgrades
- **Rich ecosystem**: Extensive tooling and infrastructure support

## 📚 Documentation

- [Migration Guide](./MIGRATION_GUIDE.md) - How to migrate from older versions
- [Security Analysis](./SECURITY.md) - Security considerations and best practices
- [API Documentation](./docs/) - Detailed API documentation
- [Integration Examples](./docs/examples/) - Code examples for integration

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🔗 Links

- [Website](https://rns.id)
- [Documentation](https://docs.rns.id)
- [Discord](https://discord.gg/rnsid)
- [Twitter](https://twitter.com/rnsid)
