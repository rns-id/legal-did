use crate::utils::{
  create_master_edition_v3,
  create_metadata_accounts_v3,
  CreateMasterEditionV3,
  CreateMetadataAccountsV3,
};
use anchor_lang::prelude::*;
use anchor_lang::solana_program::sysvar::rent::Rent;
use anchor_spl::token::{self, Mint, MintTo, Token, TokenAccount};
use mpl_token_metadata::types::DataV2;

use crate::utils::MplTokenMetadata;

use crate::state::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Default)]
pub struct InitializeArgs {
  pub name: String,
  pub symbol: String,
  pub base_uri: String,
  pub uri: String,
}

#[derive(Accounts)]
#[instruction(args: InitializeArgs)]
pub struct Initialize<'info> {
  #[account(mut)]
  pub authority: Signer<'info>,

  #[account(
      init,
      payer = authority,
      space = NON_TRANSFERABLE_PROJECT_SIZE,
      seeds = [NON_TRANSFERABLE_PROJECT_PREFIX.as_bytes()],
      bump
  )]
  pub non_transferable_project: Box<Account<'info, ProjectAccount>>,

  #[account(
      init,
      payer = authority,
      seeds = [NON_TRANSFERABLE_PROJECT_MINT_PREFIX.as_bytes()],
      bump,
      mint::decimals = 0,
      mint::authority = non_transferable_project,
      mint::freeze_authority = non_transferable_project
  )]
  pub non_transferable_project_mint: Box<Account<'info, Mint>>,

  #[account(
      init,
      payer = authority,
      seeds = [NON_TRANSFERABLE_PROJECT_VAULT_PREFIX.as_bytes()],
      bump,
      token::mint = non_transferable_project_mint,
      token::authority = non_transferable_project,
  )]
  pub non_transferable_project_vault: Box<Account<'info, TokenAccount>>,

  /// CHECK: Used in CPI So no Harm
  #[account(mut)]
  pub non_transferable_project_metadata: AccountInfo<'info>,

  /// CHECK: Used in CPI So no Harm
  #[account(mut)]
  pub non_transferable_project_master_edition: AccountInfo<'info>,

  pub token_metadata_program: Program<'info, MplTokenMetadata>,
  pub token_program: Program<'info, Token>,
  pub system_program: Program<'info, System>,
  pub rent: Sysvar<'info, Rent>,
}

impl<'info> Initialize<'info> {
  fn create_metadata_accounts_ctx(
    &self,
  ) -> CpiContext<'_, '_, '_, 'info, CreateMetadataAccountsV3<'info>> {
    let cpi_accounts = CreateMetadataAccountsV3 {
      metadata: self.non_transferable_project_metadata.to_account_info(),
      mint: self.non_transferable_project_mint.to_account_info(),
      mint_authority: self.non_transferable_project.to_account_info(),
      payer: self.authority.to_account_info(),
      update_authority: self.non_transferable_project.to_account_info(),
      system_program: self.system_program.to_account_info(),
      rent: self.rent.to_account_info(),
    };
    CpiContext::new(self.token_metadata_program.to_account_info(), cpi_accounts)
  }

  fn create_master_edition_ctx(
    &self,
  ) -> CpiContext<'_, '_, '_, 'info, CreateMasterEditionV3<'info>> {
    let cpi_accounts = CreateMasterEditionV3 {
      metadata: self.non_transferable_project_metadata.to_account_info(),
      edition: self
        .non_transferable_project_master_edition
        .to_account_info(),
      mint: self.non_transferable_project_mint.to_account_info(),
      mint_authority: self.non_transferable_project.to_account_info(),
      payer: self.authority.to_account_info(),
      update_authority: self.non_transferable_project.to_account_info(),
      system_program: self.system_program.to_account_info(),
      rent: self.rent.to_account_info(),
      token_program: self.token_program.to_account_info(),
    };
    CpiContext::new(self.token_metadata_program.to_account_info(), cpi_accounts)
  }

  fn mint_to_ctx(&self) -> CpiContext<'_, '_, '_, 'info, MintTo<'info>> {
    let cpi_accounts = MintTo {
      mint: self.non_transferable_project_mint.to_account_info(),
      to: self.non_transferable_project_vault.to_account_info(),
      authority: self.non_transferable_project.to_account_info(),
    };
    CpiContext::new(self.token_program.to_account_info(), cpi_accounts)
  }
}

pub fn handler(ctx: Context<Initialize>, args: InitializeArgs) -> Result<()> {
  let non_transferable_project = &mut ctx.accounts.non_transferable_project;

  non_transferable_project.mint_price = 100;
  non_transferable_project.authority = ctx.accounts.authority.to_account_info().key();
  non_transferable_project.bump = ctx.bumps.non_transferable_project;
  non_transferable_project.mint_bump = ctx.bumps.non_transferable_project_mint;

  non_transferable_project.name = args.name.clone();
  non_transferable_project.symbol = args.symbol.clone();
  non_transferable_project.base_uri = args.base_uri.clone();

  non_transferable_project.is_blocked_address = Vec::new();
  non_transferable_project.is_blocked_rns_id = Vec::new();
  // non_transferable_project.token_id_to_merkle = Vec::new();

  let project_signer_seeds = [
    NON_TRANSFERABLE_PROJECT_PREFIX.as_bytes(),
    &[non_transferable_project.bump],
  ];

  token::mint_to(
    ctx
      .accounts
      .mint_to_ctx()
      .with_signer(&[&project_signer_seeds[..]]),
    1,
  )?;

  let data = DataV2 {
    name: args.name,
    symbol: args.symbol,
    uri: args.uri,
    seller_fee_basis_points: 0,
    creators: None,
    collection: None,
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

  create_master_edition_v3(
    ctx
      .accounts
      .create_master_edition_ctx()
      .with_signer(&[&project_signer_seeds[..]]),
    Some(0),
  )?;

  Ok(())
}
