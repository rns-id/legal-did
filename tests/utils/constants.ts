import { web3, workspace, Program, AnchorProvider, setProvider } from '@coral-xyz/anchor'
import { PublicKey } from '@solana/web3.js'
import { RnsdidCore } from '../../target/types/rnsdid_core'
import fs from 'fs'

export const SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID = new PublicKey(
  'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL',
)

/* metaplex program */
export const TOKEN_METADATA_PROGRAM_ID = new PublicKey(
  'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s',
)

/* SPL Token Program */
export const TOKEN_PROGRAM_ID = new PublicKey(
  'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
)

/* Token-2022 Program */
export const TOKEN_2022_PROGRAM_ID = new PublicKey(
  'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb',
)

/* A receiver wallet for everywthing that needs a second wallet involved */
export const USER_WALLET = web3.Keypair.fromSecretKey(
  new Uint8Array(
    JSON.parse(
      fs.readFileSync(__dirname + '/keypairs/user-wallet.json').toString(),
    ),
  ),
)

/* The wallet that will execute most of the activities */
export const ADMIN_WALLET = web3.Keypair.fromSecretKey(
  new Uint8Array(
    JSON.parse(
      fs.readFileSync(__dirname + '/keypairs/admin-wallet.json').toString(),
    ),
  ),
)

setProvider(AnchorProvider.env())
const soulboundProgram = workspace.RnsdidCore as Program<RnsdidCore>
export const RNSDID_PROGRAM_ID = soulboundProgram.programId
export const rnsId = 'f1235f17-f746-405e-b5f8-c91d70b72875'
export const tokenIndex = Date.now().toString()
export const merkleRoot = '2d852b3c21e923484a93d3a980a45b7571e89552d58875d40dd17c73216a49d7';
