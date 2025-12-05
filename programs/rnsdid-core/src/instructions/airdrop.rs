use anchor_lang::prelude::*;
use anchor_lang::solana_program::sysvar::rent::Rent;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, Mint, MintTo, Token, TokenAccount};
use crate::utils::MplTokenMetadata;

use crate::error::ErrorCode;
use crate::state::*;

#[event]
pub struct AirdropEvent {
  pub rns_id: String,
  pub wallet: Pubkey,
  pub token_id: String,
}

#[derive(Accounts)]
#[instruction(rns_id: String, wallet: Pubkey, merkle_root: String, index: String)]
pub struct MintNonTransferableNft<'info> {
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
}

impl<'info> MintNonTransferableNft<'info> {
  fn airdrop_ctx(&self) -> CpiContext<'_, '_, '_, 'info, MintTo<'info>> {
    let cpi_accounts = MintTo {
      mint: self.non_transferable_nft_mint.to_account_info(),
      to: self.user_token_account.to_account_info(),
      authority: self.non_transferable_project.to_account_info(),
    };
    CpiContext::new(self.token_program.to_account_info(), cpi_accounts)
  }
}

pub fn handler(ctx: Context<MintNonTransferableNft>, rns_id: String, wallet: Pubkey, _merkle_root: String, _index: String) -> Result<()> {

  let project_signer_seeds = [
    NON_TRANSFERABLE_PROJECT_PREFIX.as_bytes(),
    &[ctx.accounts.non_transferable_project.bump],
  ];

  msg!("mint_to start!");
  token::mint_to(
    ctx
      .accounts
      .airdrop_ctx()
      .with_signer(&[&project_signer_seeds[..]]),
    1,
  )?;
  msg!("mint_to done!");

  // Check if the wallet is blacklisted
  let state = &ctx.accounts.non_transferable_project;

  // Check if the wallet is blacklisted
  require!(
    !state.is_blocked_address(wallet),
    ErrorCode::WalletBlacklisted
  );
  // Check if the LDID is blacklisted
  require!(!state.is_blocked_rns_id(rns_id.clone()), ErrorCode::LdidBlacklisted);


  msg!("freeze_account start");

  let cpi_accounts = token::FreezeAccount {
    account: ctx.accounts.user_token_account.to_account_info(),
    mint: ctx.accounts.non_transferable_nft_mint.to_account_info(),
    authority: ctx.accounts.non_transferable_project.to_account_info(),
  };
  let cpi_program = ctx.accounts.token_program.to_account_info();
  let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
  token::freeze_account(cpi_ctx.with_signer(&[&project_signer_seeds[..]]))?;

  msg!("freeze_account done");

  // Increase RNS ID NFT count
  ctx.accounts.non_transferable_rns_id_status.num = ctx.accounts.non_transferable_rns_id_status.num
      .checked_add(1)
      .ok_or(ErrorCode::Unauthorized)?;
  
  msg!("RNS ID status num increased to: {}", ctx.accounts.non_transferable_rns_id_status.num);

  emit!(AirdropEvent {
    rns_id: rns_id.clone(),
    wallet: ctx.accounts.authority.key(),
    token_id: rns_id.clone()
  });

  msg!(
    "RNSNewID:_rnsId:{};_wallet:{};_tokenId:{}",
    rns_id.clone(),
    ctx.accounts.user_account.key(),
    ctx.accounts.non_transferable_nft_mint.key().to_string()
  );

  Ok(())
}
