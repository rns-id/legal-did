use anchor_lang::prelude::*;

use crate::state::*;
use anchor_lang::solana_program::sysvar::rent::Rent;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, Mint, ThawAccount, Token, TokenAccount};
use crate::utils::MplTokenMetadata;

#[derive(Accounts)]
#[instruction(rns_id: String, wallet: Pubkey)]
pub struct BurnNonTransferableNft<'info> {
  /// NFT owner account - must sign, can burn their own NFT
  #[account(mut)]
  pub nft_owner: Signer<'info>,

  /// Admin account - no signature required, only used to receive rent
  /// CHECK: Read from project, used to receive rent from User Status and NFT Status accounts
  #[account(
    mut,
    constraint = authority.key() == non_transferable_project.authority @ crate::error::ErrorCode::Unauthorized
  )]
  pub authority: AccountInfo<'info>,

  /// NFT owner's Token account
  #[account(
    mut,
    constraint = user_token_account.owner == nft_owner.key(),
    constraint = user_token_account.amount == 1
  )]
  pub user_token_account: Box<Account<'info, TokenAccount>>,

  /// User status account - close and return rent to admin
  #[account(
    mut,
    close = authority,
    seeds = [
      NON_TRANSFERABLE_NFT_USERSTATUS_PREFIX.as_bytes(),
      &hash_seed(&rns_id.clone())[..32],
      wallet.key().as_ref()
    ],
    bump = non_transferable_user_status.bump
  )]
  pub non_transferable_user_status: Box<Account<'info, UserStatusAccount>>,

  /// RNS ID status account - close and return rent to admin if num reaches 0
  #[account(
    mut,
    seeds = [
        NON_TRANSFERABLE_NFT_RNSID_PREFIX.as_bytes(),
        &hash_seed(&rns_id)[..32],
    ],
    bump
  )]
  pub non_transferable_rns_id_status: Box<Account<'info, RnsIdStatusAccount>>,

  /// NFT status account - close and return rent to admin
  #[account(
    mut,
    close = authority,
    seeds = [
      NON_TRANSFERABLE_NFT_STATUS_PREFIX.as_bytes(),
      non_transferable_nft_mint.key().as_ref()
    ],
    bump
  )]
  pub non_transferable_nft_status: Box<Account<'info, NftStatusAccount>>,

  #[account(
    mut,
    seeds = [NON_TRANSFERABLE_PROJECT_PREFIX.as_bytes()],
    bump
  )]
  pub non_transferable_project: Box<Account<'info, ProjectAccount>>,

  /// CHECK: Used in CPI So no Harm
  #[account()]
  pub non_transferable_project_mint: UncheckedAccount<'info>,

  /// CHECK: Used in CPI So no Harm
  #[account(
    mut,
    seeds = [
      "metadata".as_bytes(),
      token_metadata_program.key().as_ref(),
      non_transferable_project_mint.key().as_ref()
    ],
    seeds::program = token_metadata_program.key(),
    bump,
  )]
  pub non_transferable_project_metadata: AccountInfo<'info>,

  #[account(mut)]
  pub non_transferable_nft_mint: Box<Account<'info, Mint>>,

  /// CHECK: Used in CPI
  #[account(
    mut,
    seeds = [
      "metadata".as_bytes(),
      token_metadata_program.key().as_ref(),
      non_transferable_nft_mint.key().as_ref()
    ],
    seeds::program = token_metadata_program.key(),
    bump,
  )]
  pub non_transferable_nft_metadata: AccountInfo<'info>,

  /// CHECK: Used in CPI
  #[account(
    mut,
    seeds = [
      "metadata".as_bytes(),
      token_metadata_program.key().as_ref(),
      non_transferable_nft_mint.key().as_ref(),
      "edition".as_bytes()
    ],
    seeds::program = token_metadata_program.key(),
    bump,
  )]
  pub non_transferable_nft_master_edition: AccountInfo<'info>,

  pub token_metadata_program: Program<'info, MplTokenMetadata>,
  pub associated_token_program: Program<'info, AssociatedToken>,
  pub token_program: Program<'info, Token>,
  pub system_program: Program<'info, System>,
  pub rent: Sysvar<'info, Rent>,
  /// CHECK: Sysvar Instructions
  #[account(address = anchor_lang::solana_program::sysvar::instructions::ID)]
  pub sysvar_instructions: AccountInfo<'info>,
}

pub fn handler(ctx: Context<BurnNonTransferableNft>, rns_id: String, _wallet: Pubkey) -> Result<()> {
    msg!("=== BURN HANDLER START ===");
    msg!("RNS ID: {}", rns_id);
    msg!("start burn ..");

    let signer_seeds: &[&[u8]] = &[
        NON_TRANSFERABLE_PROJECT_PREFIX.as_bytes(),
        &[ctx.accounts.non_transferable_project.bump],
    ];

    // 1. Thaw token account
    msg!("thaw_account");
    let cpi_accounts = ThawAccount {
        account: ctx.accounts.user_token_account.to_account_info(),
        mint: ctx.accounts.non_transferable_nft_mint.to_account_info(),
        authority: ctx.accounts.non_transferable_project.to_account_info(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
    token::thaw_account(cpi_ctx.with_signer(&[&signer_seeds[..]]))?;

    msg!("burn with metaplex");
    use mpl_token_metadata::instructions::BurnCpiBuilder;
    use mpl_token_metadata::types::BurnArgs;
    
    BurnCpiBuilder::new(&ctx.accounts.token_metadata_program.to_account_info())
        .authority(&ctx.accounts.nft_owner.to_account_info())
        .collection_metadata(Some(&ctx.accounts.non_transferable_project_metadata.to_account_info()))
        .metadata(&ctx.accounts.non_transferable_nft_metadata.to_account_info())
        .edition(None)
        .mint(&ctx.accounts.non_transferable_nft_mint.to_account_info())
        .token(&ctx.accounts.user_token_account.to_account_info())
        .system_program(&ctx.accounts.system_program.to_account_info())
        .sysvar_instructions(&ctx.accounts.sysvar_instructions.to_account_info())
        .spl_token_program(&ctx.accounts.token_program.to_account_info())
        .burn_args(BurnArgs::V1 { amount: 1 })
        .invoke()?;

    msg!("Token burned, token account closed, and metadata closed by Metaplex");

    // 2. Decrease RNS ID NFT count
    let current_num = ctx.accounts.non_transferable_rns_id_status.num;
    let new_num = current_num.checked_sub(1).ok_or(crate::error::ErrorCode::Unauthorized)?;
    
    msg!("RNS ID status num: {} -> {}", current_num, new_num);
    
    // If num reaches 0, close account and return rent to admin
    if new_num == 0 {
        msg!("Closing RnsIdStatus account (num reached 0)");
        
        // Transfer account lamports to authority
        let rns_id_status_lamports = ctx.accounts.non_transferable_rns_id_status.to_account_info().lamports();
        **ctx.accounts.non_transferable_rns_id_status.to_account_info().try_borrow_mut_lamports()? = 0;
        **ctx.accounts.authority.try_borrow_mut_lamports()? += rns_id_status_lamports;
        
        // Clear account data
        ctx.accounts.non_transferable_rns_id_status.to_account_info().assign(&anchor_lang::system_program::ID);
        ctx.accounts.non_transferable_rns_id_status.to_account_info().realloc(0, false)?;
    } else {
        // Only update num
        ctx.accounts.non_transferable_rns_id_status.num = new_num;
    }
    
    msg!(
        "RNSBurnID:_rnsId:{};_wallet:{};_tokenId:{}",
        rns_id,
        ctx.accounts.authority.key(),
        ctx.accounts.non_transferable_nft_mint.key()
    );

    emit!(BurnEvent {
        rns_id: rns_id.clone(),
        wallet: ctx.accounts.authority.key(),
        token_id: ctx.accounts.non_transferable_nft_mint.key().to_string()
    });

    Ok(())
}

#[event]
pub struct BurnEvent {
  pub rns_id: String,
  pub wallet: Pubkey,
  pub token_id: String,
}
