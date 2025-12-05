use crate::utils::{
  create_metadata_accounts_v3, verify_collection, CreateMetadataAccountsV3, VerifyCollection,
};
use anchor_lang::prelude::*;
use anchor_lang::solana_program::sysvar::rent::Rent;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{Mint, Token, TokenAccount};
use mpl_token_metadata::types::{Collection, Creator, DataV2};

use crate::utils::MplTokenMetadata;

use crate::error::ErrorCode;
use crate::state::*;

#[derive(Accounts)]
#[instruction(rns_id: String, wallet: Pubkey, merkle_root: String, index: String)]
pub struct VerifyContext<'info> {
  #[account(mut)]
  pub authority: Signer<'info>,

  #[account(
    mut,
    constraint = non_transferable_project.authority == authority.key(),
    seeds = [NON_TRANSFERABLE_PROJECT_PREFIX.as_bytes()],
    bump = non_transferable_project.bump
  )]
  pub non_transferable_project: Box<Account<'info, ProjectAccount>>,

  #[account(
    mut,
    seeds = [NON_TRANSFERABLE_PROJECT_MINT_PREFIX.as_bytes()],
    bump = non_transferable_project.mint_bump,
  )]
  pub non_transferable_project_mint: Box<Account<'info, Mint>>,

  /// CHECK: Used in CPI So no Harm
  #[account(mut)]
  pub non_transferable_project_metadata: AccountInfo<'info>,

  /// CHECK: Used in CPI So no Harm
  #[account(mut)]
  pub non_transferable_project_master_edition: AccountInfo<'info>,

  #[account(
    init_if_needed,
    payer = authority,
    seeds = [
      NON_TRANSFERABLE_NFT_MINT_PREFIX.as_bytes(),
      index.as_bytes()
    ],
    bump,
    mint::decimals = 0,
    mint::authority = non_transferable_project,
    mint::freeze_authority = non_transferable_project
  )]
  pub non_transferable_nft_mint: Box<Account<'info, Mint>>,

  /// CHECK:
  #[account(mut)]
  pub user_account: AccountInfo<'info>,

  #[account(
    init_if_needed,
    payer = authority,
    associated_token::mint = non_transferable_nft_mint,
    associated_token::authority = user_account,
  )]
  pub user_token_account: Box<Account<'info, TokenAccount>>,

  #[account(
      init_if_needed,
      payer = authority,
      space = 8 +
      32 +        // authority
      50 +        // rns_id
      1 +         // is_minted
      1 +         // is_authorized
      1,          // bump
      seeds = [
          NON_TRANSFERABLE_NFT_USERSTATUS_PREFIX.as_bytes(),
          &hash_seed(&rns_id)[..32],
          wallet.key().as_ref()
      ],
      bump
  )]
  pub non_transferable_user_status: Box<Account<'info, UserStatusAccount>>,

  #[account(
    init_if_needed,
    payer = authority,
    space = 8 +
    8 +
    32,
    seeds = [
        NON_TRANSFERABLE_NFT_RNSID_PREFIX.as_bytes(),
        &hash_seed(&rns_id)[..32],
    ],
    bump
  )]
  pub non_transferable_rns_id_status: Box<Account<'info, RnsIdStatusAccount>>,

  #[account(
    init_if_needed,
    payer = authority,
    space = 8 +
    72 +   // merkle_root (64 hex chars + 4 bytes length prefix)
    72 +   // rns_id
    32 +   // authority
    32 +   // mint
    1,     // bump
    seeds = [
        NON_TRANSFERABLE_NFT_STATUS_PREFIX.as_bytes(),
        non_transferable_nft_mint.key().as_ref()
    ],
    bump
  )]
  pub non_transferable_nft_status: Box<Account<'info, NftStatusAccount>>,

  /// CHECK: Used in CPI
  #[account(mut)]
  pub non_transferable_nft_metadata: UncheckedAccount<'info>,
  /// CHECK: Used in CPI
  #[account(mut)]
  pub non_transferable_nft_master_edition: UncheckedAccount<'info>,

  pub token_metadata_program: Program<'info, MplTokenMetadata>,
  pub associated_token_program: Program<'info, AssociatedToken>,
  pub token_program: Program<'info, Token>,
  pub system_program: Program<'info, System>,
  pub rent: Sysvar<'info, Rent>,
  /// CHECK: Sysvar Instructions
  #[account(address = anchor_lang::solana_program::sysvar::instructions::ID)]
  pub sysvar_instructions: AccountInfo<'info>,
}

impl<'info> VerifyContext<'info> {
  fn create_metadata_accounts_ctx(
    &self,
  ) -> CpiContext<'_, '_, '_, 'info, CreateMetadataAccountsV3<'info>> {
    let cpi_accounts = CreateMetadataAccountsV3 {
      metadata: self.non_transferable_nft_metadata.to_account_info().clone(),
      mint: self.non_transferable_nft_mint.to_account_info().clone(),
      mint_authority: self.non_transferable_project.to_account_info().clone(),
      update_authority: self.non_transferable_project.to_account_info().clone(),
      payer: self.authority.to_account_info().clone(),
      system_program: self.system_program.to_account_info().clone(),
      rent: self.rent.to_account_info().clone(),
    };
    CpiContext::new(self.token_metadata_program.to_account_info(), cpi_accounts)
  }

  fn verify_collection_ctx(&self) -> CpiContext<'_, '_, '_, 'info, VerifyCollection<'info>> {
    let cpi_accounts = VerifyCollection {
      payer: self.authority.to_account_info().clone(),
      metadata: self.non_transferable_nft_metadata.to_account_info().clone(),
      collection_authority: self.non_transferable_project.to_account_info(),
      collection_mint: self.non_transferable_project_mint.to_account_info(),
      collection_metadata: self.non_transferable_project_metadata.to_account_info(),
      collection_master_edition: self
        .non_transferable_project_master_edition
        .to_account_info(),
      system_program: self.system_program.to_account_info(),
      sysvar_instructions: self.sysvar_instructions.to_account_info(),
    };
    CpiContext::new(
      self.token_metadata_program.to_account_info().clone(),
      cpi_accounts,
    )
  }
}

pub fn handler(
  ctx: Context<VerifyContext>,
  rns_id: String,
  _wallet: Pubkey,
  merkle_root: String,
  _index: String,
) -> Result<()> {
  let project_signer_seeds = [
    NON_TRANSFERABLE_PROJECT_PREFIX.as_bytes(),
    &[ctx.accounts.non_transferable_project.bump],
  ];

  // Check if the wallet is blacklisted
  let state = &ctx.accounts.non_transferable_project;

  let creators = vec![
    Creator {
      address: ctx
        .accounts
        .non_transferable_project
        .to_account_info()
        .key(),
      verified: true,
      share: 0,
    },
    Creator {
      address: ctx.accounts.authority.to_account_info().key(),
      verified: false,
      share: 100,
    },
  ];

  let name = state.name.clone();
  let symbol = state.symbol.clone();
  let uri = state.base_uri.to_string() + &rns_id.to_string() + ".json";

  let data = DataV2 {
    name,
    symbol,
    uri,
    seller_fee_basis_points: 0,
    creators: Some(creators),
    collection: Some(Collection {
      verified: false,
      key: ctx.accounts.non_transferable_project_mint.key(),
    }),
    uses: None,
  };

  create_metadata_accounts_v3(
    ctx
      .accounts
      .create_metadata_accounts_ctx()
      .with_signer(&[&project_signer_seeds[..]]),
    data,
    true,
    true,
    None,
  )?;

  msg!("verify_collection");

  verify_collection(
    ctx
      .accounts
      .verify_collection_ctx()
      .with_signer(&[&project_signer_seeds[..]]),
    None,
  )?;

  let user_status = &mut ctx.accounts.non_transferable_user_status;
  require!(!user_status.is_minted, ErrorCode::LDIDHasMinted);

  user_status.is_minted = true;
  user_status.authority = ctx.accounts.user_account.key();
  user_status.rns_id = rns_id.clone();

  let nft_status = &mut ctx.accounts.non_transferable_nft_status;
  nft_status.authority = ctx.accounts.user_account.key();
  nft_status.merkle_root = merkle_root.clone();
  nft_status.rns_id = rns_id.clone();
  nft_status.mint = ctx.accounts.non_transferable_nft_mint.key();

  let rns_id_status = &mut ctx.accounts.non_transferable_rns_id_status;
  rns_id_status.authority = ctx.accounts.authority.key();
  // num only increases during airdrop, not during verify

  Ok(())
}

