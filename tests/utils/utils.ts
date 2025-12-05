import { web3, workspace, Program, AnchorProvider, setProvider, getProvider } from '@coral-xyz/anchor'
const crypto = require('crypto');
import {
  SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID,
  TOKEN_METADATA_PROGRAM_ID,
  RNSDID_PROGRAM_ID,
} from './constants'
import { AccountLayout, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAccount, MintLayout } from '@solana/spl-token'

import { PublicKey, Connection } from '@solana/web3.js';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { fetchAllDigitalAssetByOwner, mplTokenMetadata } from '@metaplex-foundation/mpl-token-metadata'

const connection = getProvider().connection as unknown as Connection;

export const createAssociatedTokenAccountInstruction = (
  associatedTokenAddress: web3.PublicKey,
  payer: web3.PublicKey,
  walletAddress: web3.PublicKey,
  splTokenMintAddress: web3.PublicKey,
) => {

  const keys = [
    { pubkey: payer, isSigner: true, isWritable: true },
    { pubkey: associatedTokenAddress, isSigner: false, isWritable: true },
    { pubkey: walletAddress, isSigner: false, isWritable: false },
    { pubkey: splTokenMintAddress, isSigner: false, isWritable: false },
    {
      pubkey: web3.SystemProgram.programId,
      isSigner: false,
      isWritable: false,
    },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    {
      pubkey: web3.SYSVAR_RENT_PUBKEY,
      isSigner: false,
      isWritable: false,
    },
  ]
  return new web3.TransactionInstruction({
    keys,
    programId: SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID,
    data: Buffer.from([]),
  })
}


export const findNonTransferableNftStatus = async (mint: web3.PublicKey): Promise<web3.PublicKey> => {

  const seeds = [
    Buffer.from("nt-nft-status"),
    mint.toBuffer(),
  ];

  const [key, bump] = web3.PublicKey.findProgramAddressSync(seeds, RNSDID_PROGRAM_ID)
  return key
}

export const findNonTransferableRnsIdtatus = async (rns_id: String): Promise<web3.PublicKey> => {

  const hashedRnsId = crypto.createHash('sha256').update(rns_id).digest().slice(0, 32);

  const seeds = [
    Buffer.from("nt-nft-rnsid-status"),
    Buffer.from(hashedRnsId),
  ];
  const [key, bump] = web3.PublicKey.findProgramAddressSync(
    seeds,
    RNSDID_PROGRAM_ID,
  );
  return key;
}


export const getCollectionMetadataAddress = async (mint: web3.PublicKey): Promise<web3.PublicKey> => {

  const seeds = [
    Buffer.from('metadata'),
    TOKEN_METADATA_PROGRAM_ID.toBuffer(),
    mint.toBuffer(),
  ];

  return (
    web3.PublicKey.findProgramAddressSync(
      seeds,
      TOKEN_METADATA_PROGRAM_ID,
    )
  )[0]
}

export const getCollectionMasterEditionAddress = async (
  mint: web3.PublicKey,
): Promise<web3.PublicKey> => {

  const seeds = [
    Buffer.from('metadata'),
    TOKEN_METADATA_PROGRAM_ID.toBuffer(),
    mint.toBuffer(),
    Buffer.from('edition'),
  ];

  return (
    web3.PublicKey.findProgramAddressSync(
      seeds,
      TOKEN_METADATA_PROGRAM_ID,
    )
  )[0]
}

// /* The wallet that will execute most of the activities */
// export const ADMIN_WALLET = web3.Keypair.fromSecretKey(
//   new Uint8Array(
//     JSON.parse(
//       fs.readFileSync(__dirname + '/keypairs/admin-wallet.json').toString(),
//     ),
//   ),
// )

// /* A receiver wallet for everywthing that needs a second wallet involved */
// export const USER_WALLET = web3.Keypair.fromSecretKey(
//   new Uint8Array(
//     JSON.parse(
//       fs.readFileSync(__dirname + '/keypairs/user-wallet.json').toString(),
//     ),
//   ),
// )

// export const USER_WALLET = Keypair.fromSecretKey(
//   bs58.decode("5tNwYQUBXH4YgNqiAhkJT7nuEWjr7v2UMT5Di5W8wrWCPi35qpoKsxPkB2NtjWKC1ALSutgdTLSMzK5DKcWeWsCg")
// );

/* Find the associated token account between mint*/
export const getTokenWallet = async (
  wallet: web3.PublicKey,
  mint: web3.PublicKey,
) => {
  return (
    web3.PublicKey.findProgramAddressSync(
      [
        wallet.toBuffer(),
        TOKEN_PROGRAM_ID.toBuffer(),
        mint.toBuffer()
      ],
      SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID,
    )
  )[0]
}


/* Find the associated token account between mint*/
export const getTokenSeedAccount = async (
  wallet: web3.PublicKey,
  mint: web3.PublicKey,
) => {
  return (
    web3.PublicKey.findProgramAddressSync(
      [
        wallet.toBuffer(),
        TOKEN_PROGRAM_ID.toBuffer(),
        mint.toBuffer()
      ],
      SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID,
    )
  )[0]
}


export const findNonTransferableProject = () => {
  const seeds = [Buffer.from("nt-proj-v2")];
  return (web3.PublicKey.findProgramAddressSync(seeds, RNSDID_PROGRAM_ID))[0]
}


export const getCollectionMintAddress = async () => {
  const seeds = [Buffer.from("nt-project-mint")];
  return (web3.PublicKey.findProgramAddressSync(seeds, RNSDID_PROGRAM_ID))[0]
}

// collection_mint_bump
export const getCollectionMintBump = async () => {
  const seeds = [Buffer.from("nt-project-mint")];
  return (web3.PublicKey.findProgramAddressSync(seeds, RNSDID_PROGRAM_ID))[1]
}

export const getCollectionVaultAddress = async () => {
  const seeds = [Buffer.from("nt-project-mint-vault")];
  return (web3.PublicKey.findProgramAddressSync(seeds, RNSDID_PROGRAM_ID))[0]
}

export const getCollectionVaultAccount = async () => {
  const seeds = [Buffer.from("nt-project-mint-vault")];
  return web3.PublicKey.findProgramAddressSync(seeds, RNSDID_PROGRAM_ID)
}

export const getOwnershipAccountAddress = async () => {
  const seeds = [Buffer.from("ownership")];
  return (web3.PublicKey.findProgramAddressSync(seeds, RNSDID_PROGRAM_ID))[0];
};

export const getOwnershipAccountBump = async () => {
  const seeds = [Buffer.from("ownership")];
  return (web3.PublicKey.findProgramAddressSync(seeds, RNSDID_PROGRAM_ID))[1];
};

// export const getCollectionAccount = async () => {
//   const seeds = [Buffer.from("rns_did_collection")];
//   return (web3.PublicKey.findProgramAddressSync(seeds, RNSDID_PROGRAM_ID))[0];
// };

/* Find the associated token account between mint*/

export const getUserAssociatedTokenAccount = async (
  wallet: web3.PublicKey,
  mint: web3.PublicKey,
) => {

  const seeds = [
    wallet.toBuffer(),
    TOKEN_PROGRAM_ID.toBuffer(),
    mint.toBuffer()
  ];

  return (
    web3.PublicKey.findProgramAddressSync(
      seeds,
      SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID,
    )
  )[0]
}

export const findProgramAddressFromSeeds = (seeds) => {

  return (web3.PublicKey.findProgramAddressSync(seeds, RNSDID_PROGRAM_ID));
};

export const findNonTransferableUserStatus = (rns_id: string, wallet: PublicKey) => {

  const hashedRnsId = crypto.createHash('sha256').update(rns_id).digest().slice(0, 32);

  const seeds = [
    Buffer.from("nt-nft-user-status"),
    Buffer.from(hashedRnsId),
    wallet.toBuffer(),
  ];

  return (
    web3.PublicKey.findProgramAddressSync(
      seeds,
      RNSDID_PROGRAM_ID,
    )
  )[0]
}

export const getNonTransferableNftMintAddress = (rns_id: string, index: String) => {
  const seeds = [
    Buffer.from("nt-nft-mint"),
    Buffer.from(index),
  ];
  return web3.PublicKey.findProgramAddressSync(seeds, RNSDID_PROGRAM_ID)[0];
};

export const getTokenAccountBalance = async (tokenAccountPubkey: web3.PublicKey) => {
  const tokenAccountInfo = await connection.getAccountInfo(tokenAccountPubkey);

  if (tokenAccountInfo === null) {
    throw new Error('Failed to find token account');
  }

  // Parse account info
  const accountData = AccountLayout.decode(new Uint8Array(tokenAccountInfo.data));
  const balance = accountData.amount;

  return balance;
}



export async function getTokenAccountDetails(tokenAccountPubkey: web3.PublicKey) {
  try {
    // Get token account info
    const tokenAccount = await getAccount(connection, tokenAccountPubkey);

    // // Output token account details
    // console.log('Token Account Info:', tokenAccount);
    // console.log(`Mint: ${tokenAccount.mint.toBase58()}`);
    // console.log(`Owner: ${tokenAccount.owner.toBase58()}`);
    // console.log(`Amount: ${tokenAccount.amount}`);
    // console.log(`Delegate: ${tokenAccount.delegate ? tokenAccount.delegate.toBase58() : 'None'}`);
    // // console.log(`State: ${tokenAccount.state}`);
    // console.log(`Is Native: ${tokenAccount.isNative ? tokenAccount.isNative : 'No'}`);
    // console.log(`Delegated Amount: ${tokenAccount.delegatedAmount}`);
    // console.log(`Close Authority: ${tokenAccount.closeAuthority ? tokenAccount.closeAuthority.toBase58() : 'None'}`);

    return tokenAccount;
  } catch (error) {
    // console.error('Failed to get token account details:', error);
  }
}

export async function findFreezeAuthority(mintPublicKey) {

  // Get the account info
  const mintInfo = await connection.getAccountInfo(mintPublicKey);

  if (mintInfo === null) {
    console.log('Mint not found');
    return;
  }

  // Decode the account info
  const mintData = MintLayout.decode(new Uint8Array(mintInfo.data));

  // console.log('mintData:', mintData)
  return new PublicKey(mintData.freezeAuthority);
}

// https://developers.metaplex.com/token-metadata/fetch#fetch-all-by-owner
export async function getAccountNFTs(owner, collectionMintKey) {
  try {

    const umi = createUmi(connection.rpcEndpoint).use(mplTokenMetadata())
    const assets = await fetchAllDigitalAssetByOwner(umi, owner)
    console.log('assets:', assets)

    let nfts = []
    for (let i = 0; i < assets.length; i++) {
      let collection = (assets[i].metadata.collection as any).value
      if(collection.key == collectionMintKey) {
        nfts.push(assets[i])
      }
    }
    return nfts;
  } catch (error) {
    console.error('Error fetching NFTs:', error);
    return [];
  }
}

