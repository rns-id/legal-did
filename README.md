# Legal DID - Solana Smart Contract

A decentralized identity (DID) NFT contract built on Solana Token-2022, supporting non-transferable Soulbound Tokens.

## Features

- **Token-2022 Standard**: Uses SPL Token Extensions
- **NonTransferable**: Soulbound NFT that cannot be transferred
- **PermanentDelegate**: Permanent delegation for admin revoke/burn operations
- **MetadataPointer**: On-chain metadata pointer to external JSON

## Deployment

| Network | Program ID |
|---------|------------|
| Devnet | `BCkys1re7iw8NhM7nu6xLChGpgg9iCC8mZity2maL9en` |

## Project Structure

```plaintext
.
├── programs/rnsdid-core/
│   ├── src/
│   │   ├── lib.rs              # Contract entry point
│   │   ├── instructions/       # Instruction implementations
│   │   │   ├── initialize.rs   # Initialize project
│   │   │   ├── authorize_mint.rs # Authorize minting
│   │   │   ├── airdrop.rs      # Airdrop/mint NFT
│   │   │   ├── burn.rs         # Burn NFT
│   │   │   └── revoke.rs       # Revoke NFT
│   │   ├── state/              # Account state definitions
│   │   └── error.rs            # Error definitions
├── scripts/                    # Deployment and test scripts
├── tests/                      # Integration tests
└── target/idl/                 # Generated IDL
```

## Requirements

- Rust 1.82.0+
- Solana CLI 2.3.8+
- Anchor 0.30.1+
- Node.js 18+

## Quick Start

### Installation

```sh
git clone git@github.com:rns-id/legal-did-solana.git
cd legal-did-solana
yarn install
anchor build
```

### Testing

```sh
anchor test
```

### Deploy to Devnet

```sh
./deploy-devnet.sh
```

## Usage

### 1. Initialize Project

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

### 2. Authorize Mint

```typescript
await program.methods
  .authorizeMint(rnsId, targetWallet)
  .accounts({...})
  .rpc()
```

### 3. Airdrop NFT

```typescript
await program.methods
  .airdrop(rnsId, targetWallet, merkleRoot, tokenIndex)
  .accounts({...})
  .rpc()
```

### 4. Revoke / Burn

```typescript
// Revoke (keep NFT, mark as invalid)
await program.methods.revoke(rnsId).accounts({...}).rpc()

// Burn (completely remove NFT)
await program.methods.burn(rnsId).accounts({...}).rpc()
```

## Cost Estimation (SOL = $140)

| Operation | SOL | USD |
|-----------|-----|-----|
| authorize_mint | 0.00163 | $0.23 |
| airdrop | 0.00628 | $0.88 |
| **Total per mint** | **0.00791** | **$1.11** |

## On-chain Data

### DID Status PDA (106 bytes)
- rns_id hash
- wallet address
- merkle_root
- status flags

### NFT Mint (471 bytes)
- Token-2022 extensions
- Metadata pointer

## Scripts

| Script | Description |
|--------|-------------|
| `scripts/init-devnet.ts` | Initialize Devnet project |
| `scripts/mint-to-wallet.ts` | Mint NFT to specified wallet |
| `scripts/mint-with-real-metadata.ts` | Mint with real metadata |

## License

MIT License
