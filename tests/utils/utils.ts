import { web3, workspace, Program, AnchorProvider, setProvider, getProvider } from '@coral-xyz/anchor'
const crypto = require('crypto');
import {
  SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID,
  TOKEN_METADATA_PROGRAM_ID,
  RNSDID_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
} from './constants'
import { AccountLayout, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAccount, MintLayout } from '@solana/spl-token'

import { PublicKey, Connection } from '@solana/web3.js';

const connection = getProvider().connection as unknown as Connection;

// ============================================
// V3 版本 - Token-2022 + 优化账户结构
// ============================================

// 项目账户 PDA (v3)
export const findNonTransferableProject = () => {
  const seeds = [Buffer.from("nt-proj-v3")];
  return (web3.PublicKey.findProgramAddressSync(seeds, RNSDID_PROGRAM_ID))[0]
}

// 项目 Mint PDA (v3)
export const getCollectionMintAddress = async () => {
  const seeds = [Buffer.from("nt-project-mint-v3")];
  return (web3.PublicKey.findProgramAddressSync(seeds, RNSDID_PROGRAM_ID))[0]
}

// NFT Mint PDA (v3)
export const getNonTransferableNftMintAddress = (rns_id: string, index: String) => {
  const seeds = [
    Buffer.from("nt-nft-mint-v3"),
    Buffer.from(index),
  ];
  return web3.PublicKey.findProgramAddressSync(seeds, RNSDID_PROGRAM_ID)[0];
};

// DID 状态账户 PDA (v3) - 合并了原来的 3 个账户
export const findDIDStatus = (rns_id: string, wallet: PublicKey) => {
  const hashedRnsId = crypto.createHash('sha256').update(rns_id).digest().slice(0, 32);
  const seeds = [
    Buffer.from("did-status-v3"),
    Buffer.from(hashedRnsId),
    wallet.toBuffer(),
  ];
  return (web3.PublicKey.findProgramAddressSync(seeds, RNSDID_PROGRAM_ID))[0]
}

// Token-2022 ATA
export const getUserAssociatedTokenAccount = async (
  wallet: web3.PublicKey,
  mint: web3.PublicKey,
) => {
  const seeds = [
    wallet.toBuffer(),
    TOKEN_2022_PROGRAM_ID.toBuffer(),
    mint.toBuffer()
  ];
  return (web3.PublicKey.findProgramAddressSync(
    seeds,
    SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID,
  ))[0]
}

// ============================================
// 通用工具函数
// ============================================

export const getTokenAccountBalance = async (tokenAccountPubkey: web3.PublicKey) => {
  const tokenAccountInfo = await connection.getAccountInfo(tokenAccountPubkey);
  if (tokenAccountInfo === null) {
    throw new Error('Failed to find token account');
  }
  const accountData = AccountLayout.decode(new Uint8Array(tokenAccountInfo.data));
  return accountData.amount;
}

export async function getTokenAccountDetails(tokenAccountPubkey: web3.PublicKey) {
  try {
    const tokenAccount = await getAccount(connection, tokenAccountPubkey, 'confirmed', TOKEN_2022_PROGRAM_ID);
    return tokenAccount;
  } catch (error) {
    throw error;
  }
}

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
    { pubkey: web3.SystemProgram.programId, isSigner: false, isWritable: false },
    { pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: web3.SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
  ]
  return new web3.TransactionInstruction({
    keys,
    programId: SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID,
    data: Buffer.from([]),
  })
}

// ============================================
// 旧版本兼容 (v2) - 保留但标记为废弃
// ============================================

/** @deprecated 使用 findDIDStatus 替代 */
export const findNonTransferableUserStatus = (rns_id: string, wallet: PublicKey) => {
  return findDIDStatus(rns_id, wallet);
}

/** @deprecated v3 版本已移除 */
export const findNonTransferableNftStatus = async (mint: web3.PublicKey): Promise<web3.PublicKey> => {
  const seeds = [Buffer.from("nt-nft-status"), mint.toBuffer()];
  return web3.PublicKey.findProgramAddressSync(seeds, RNSDID_PROGRAM_ID)[0]
}

/** @deprecated v3 版本已移除 */
export const findNonTransferableRnsIdtatus = async (rns_id: String): Promise<web3.PublicKey> => {
  const hashedRnsId = crypto.createHash('sha256').update(rns_id).digest().slice(0, 32);
  const seeds = [Buffer.from("nt-nft-rnsid-status"), Buffer.from(hashedRnsId)];
  return web3.PublicKey.findProgramAddressSync(seeds, RNSDID_PROGRAM_ID)[0];
}

export const getCollectionMetadataAddress = async (mint: web3.PublicKey): Promise<web3.PublicKey> => {
  const seeds = [
    Buffer.from('metadata'),
    TOKEN_METADATA_PROGRAM_ID.toBuffer(),
    mint.toBuffer(),
  ];
  return (web3.PublicKey.findProgramAddressSync(seeds, TOKEN_METADATA_PROGRAM_ID))[0]
}

export const getCollectionMasterEditionAddress = async (mint: web3.PublicKey): Promise<web3.PublicKey> => {
  const seeds = [
    Buffer.from('metadata'),
    TOKEN_METADATA_PROGRAM_ID.toBuffer(),
    mint.toBuffer(),
    Buffer.from('edition'),
  ];
  return (web3.PublicKey.findProgramAddressSync(seeds, TOKEN_METADATA_PROGRAM_ID))[0]
}

export const getCollectionMintBump = async () => {
  const seeds = [Buffer.from("nt-project-mint-v3")];
  return (web3.PublicKey.findProgramAddressSync(seeds, RNSDID_PROGRAM_ID))[1]
}

export const getCollectionVaultAddress = async () => {
  const seeds = [Buffer.from("nt-project-vault-v3")];
  return (web3.PublicKey.findProgramAddressSync(seeds, RNSDID_PROGRAM_ID))[0]
}

export const getCollectionVaultAccount = async () => {
  const seeds = [Buffer.from("nt-project-vault-v3")];
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

export const getTokenWallet = async (wallet: web3.PublicKey, mint: web3.PublicKey) => {
  return (web3.PublicKey.findProgramAddressSync(
    [wallet.toBuffer(), TOKEN_2022_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID,
  ))[0]
}

export const findProgramAddressFromSeeds = (seeds) => {
  return (web3.PublicKey.findProgramAddressSync(seeds, RNSDID_PROGRAM_ID));
};

export async function findFreezeAuthority(mintPublicKey) {
  const mintInfo = await connection.getAccountInfo(mintPublicKey);
  if (mintInfo === null) {
    console.log('Mint not found');
    return;
  }
  const mintData = MintLayout.decode(new Uint8Array(mintInfo.data));
  return new PublicKey(mintData.freezeAuthority);
}
