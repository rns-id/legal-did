use anchor_lang::prelude::*;
use sha2::{Digest, Sha256};

use anchor_spl::token::Mint;

pub const NON_TRANSFERABLE_PROJECT_PREFIX: &str = "nt-proj-v2";
pub const NON_TRANSFERABLE_PROJECT_MINT_PREFIX: &str = "nt-project-mint";
pub const NON_TRANSFERABLE_PROJECT_VAULT_PREFIX: &str = "nt-project-mint-vault";

pub const NON_TRANSFERABLE_NFT_MINT_PREFIX: &str = "nt-nft-mint";
pub const NON_TRANSFERABLE_NFT_USERSTATUS_PREFIX: &str = "nt-nft-user-status";  // rnsid + wallet

pub const NON_TRANSFERABLE_NFT_STATUS_PREFIX: &str = "nt-nft-status";
pub const NON_TRANSFERABLE_NFT_RNSID_PREFIX: &str = "nt-nft-rnsid-status";
pub const METADATA: &str = "metadata";

pub const NON_TRANSFERABLE_PROJECT_SIZE: usize = 8 +
  100 + // name
  100 + // symbol
  100 + // base_uri
  1650 + // is_blocked_address
  1650 + // is_blocked_rns_id

  32 + // admin
  8 +  // mint_price
  32 +  // fee_recipient
  1 + // mint_bump
  1; // bump

  #[derive(AnchorSerialize, AnchorDeserialize, Clone, Default)]
pub struct BlockedAddress {
    pub key: Pubkey,
    pub value: bool,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Default)]
pub struct BlockedRnsID {
    pub key: String,
    pub value: bool,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Default)]
pub struct TokenIdToMerkle {
    pub key: String,
    pub value: String,
}

#[account]
#[derive(Default)]
pub struct ProjectAccount {
  pub authority: Pubkey,
  pub mint_price: u64,
  pub fee_recipient: Pubkey,
  pub bump: u8,
  pub mint_bump: u8,
  pub name: String,
  pub symbol: String,
  pub base_uri: String,
  pub is_blocked_address: Vec<BlockedAddress>,
  pub is_blocked_rns_id: Vec<BlockedRnsID>,
}

impl ProjectAccount {
  pub fn is_blocked_address(&self, address: Pubkey) -> bool {
    self.is_blocked_address.iter().any(|pair| pair.key == address && pair.value)
  }
  pub fn is_blocked_rns_id(&self, rns_id: String) -> bool {
    self.is_blocked_rns_id.iter().any(|pair| pair.key == rns_id && pair.value == true )
  }
}

pub const NON_TRANSFERABLE_USER_PAY: &str = "nt-nft-user-pay";

#[account]
#[derive(Default)]
pub struct UserStatusAccount {
  pub authority: Pubkey,
  pub rns_id: String,

  pub is_minted: bool,
  pub is_authorized: bool,  // 复用此字段：false = 已撤销
  pub bump: u8,
}

#[account]
#[derive(Default)]
pub struct NftStatusAccount {
  pub authority: Pubkey,

  pub bump: u8,

  pub rns_id: String,
  pub merkle_root: String,
  pub mint: Pubkey,
}


#[account]
#[derive(Default)]
pub struct RnsIdStatusAccount {
  pub authority: Pubkey,
  pub num: u64,
}

#[derive(Accounts)]
pub struct SetBaseURI<'info> {
    #[account(mut, has_one = authority)]
    pub non_transferable_project: Box<Account<'info, ProjectAccount>>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct SetFeeRecipient<'info> {
    #[account(mut, has_one = authority)]
    pub non_transferable_project: Box<Account<'info, ProjectAccount>>,
    pub authority: Signer<'info>,
}


#[derive(Accounts)]
pub struct SetIsBlockedAddress<'info> {
    #[account(mut, has_one = authority)]
    pub non_transferable_project: Box<Account<'info, ProjectAccount>>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct SetIsBlockedRnsID<'info> {
    #[account(mut, has_one = authority)]
    pub non_transferable_project: Box<Account<'info, ProjectAccount>>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct SetMerkleRoot<'info> {

    pub authority: Signer<'info>,

    #[account(mut, has_one = authority)]
    pub non_transferable_project: Box<Account<'info, ProjectAccount>>,

    #[account(mut)]
    pub non_transferable_nft_mint: Box<Account<'info, Mint>>,

    #[account(
      mut,
      seeds = [
        NON_TRANSFERABLE_NFT_STATUS_PREFIX.as_bytes(),
        non_transferable_nft_mint.key().as_ref()
      ],
      bump
    )]
    pub non_transferable_nft_status: Box<Account<'info, NftStatusAccount>>,

}

#[derive(Accounts)]
pub struct SetTokenIdToMerkle<'info> {
    #[account(mut, has_one = authority)]
    pub non_transferable_project: Box<Account<'info, ProjectAccount>>,
    pub authority: Signer<'info>,
}


#[derive(Accounts)]
pub struct SetMintPriceContext<'info> {
  #[account()]
  pub authority: Signer<'info>,
  #[account(mut, has_one = authority)]
  pub non_transferable_project: Box<Account<'info, ProjectAccount>>,
}



pub fn hash_seed(seed: &str) -> Vec<u8> {
  let mut hasher = Sha256::new();
  hasher.update(seed.as_bytes());
  hasher.finalize().to_vec()
}