use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, Mint, ThawAccount, Token, TokenAccount};

use crate::error::ErrorCode;
use crate::state::*;

#[event]
pub struct CleanupEvent {
  pub rns_id: String,
  pub wallet: Pubkey,
  pub token_id: String,
}

#[derive(Accounts)]
#[instruction(rns_id: String, wallet: Pubkey)]
pub struct CleanupRevokedNft<'info> {
  /// User account - must sign to cleanup their own revoked NFT
  #[account(mut)]
  pub user: Signer<'info>,

  /// Admin account - receives user status rent
  /// CHECK: Read from project, used to receive rent from User Status account
  #[account(
    mut,
    constraint = authority.key() == non_transferable_project.authority @ ErrorCode::Unauthorized
  )]
  pub authority: AccountInfo<'info>,

  #[account(
    mut,
    seeds = [NON_TRANSFERABLE_PROJECT_PREFIX.as_bytes()],
    bump = non_transferable_project.bump
  )]
  pub non_transferable_project: Box<Account<'info, ProjectAccount>>,

  /// User's Token account (should be frozen)
  #[account(
    mut,
    constraint = user_token_account.owner == user.key(),
    constraint = user_token_account.amount == 1
  )]
  pub user_token_account: Box<Account<'info, TokenAccount>>,

  /// User status account - should be marked as revoked
  #[account(
    mut,
    constraint = non_transferable_user_status.authority == wallet,
    constraint = !non_transferable_user_status.is_authorized @ ErrorCode::Unauthorized, // revoked = not authorized
    seeds = [
      NON_TRANSFERABLE_NFT_USERSTATUS_PREFIX.as_bytes(),
      &hash_seed(&rns_id.clone())[..32],
      wallet.key().as_ref()
    ],
    bump = non_transferable_user_status.bump
  )]
  pub non_transferable_user_status: Box<Account<'info, UserStatusAccount>>,

  #[account(mut)]
  pub non_transferable_nft_mint: Box<Account<'info, Mint>>,

  pub associated_token_program: Program<'info, AssociatedToken>,
  pub token_program: Program<'info, Token>,
  pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<CleanupRevokedNft>, rns_id: String, wallet: Pubkey) -> Result<()> {
    msg!("=== CLEANUP HANDLER START ===");
    msg!("RNS ID: {}", rns_id);
    msg!("Wallet: {}", wallet);
    msg!("User: {}", ctx.accounts.user.key());

    // Verify user is cleaning up their own revoked NFT
    require!(
        ctx.accounts.user.key() == wallet,
        ErrorCode::Unauthorized
    );

    let signer_seeds: &[&[u8]] = &[
        NON_TRANSFERABLE_PROJECT_PREFIX.as_bytes(),
        &[ctx.accounts.non_transferable_project.bump],
    ];

    // 1. Thaw the token account (it should be frozen after revoke)
    msg!("Thawing token account");
    let cpi_accounts = ThawAccount {
        account: ctx.accounts.user_token_account.to_account_info(),
        mint: ctx.accounts.non_transferable_nft_mint.to_account_info(),
        authority: ctx.accounts.non_transferable_project.to_account_info(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
    token::thaw_account(cpi_ctx.with_signer(&[&signer_seeds[..]]))?;

    // 2. Burn the revoked token
    msg!("Burning revoked token");
    let cpi_accounts = token::Burn {
        mint: ctx.accounts.non_transferable_nft_mint.to_account_info(),
        from: ctx.accounts.user_token_account.to_account_info(),
        authority: ctx.accounts.user.to_account_info(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
    token::burn(cpi_ctx, 1)?;

    // 3. Close the token account - user gets the rent
    msg!("Closing token account - rent to user");
    let cpi_accounts = token::CloseAccount {
        account: ctx.accounts.user_token_account.to_account_info(),
        destination: ctx.accounts.user.to_account_info(), // User gets token account rent
        authority: ctx.accounts.user.to_account_info(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
    token::close_account(cpi_ctx)?;

    // 4. Close the user status account - admin gets the rent
    msg!("Closing user status account - rent to admin");
    let user_status_lamports = ctx.accounts.non_transferable_user_status.to_account_info().lamports();
    **ctx.accounts.non_transferable_user_status.to_account_info().try_borrow_mut_lamports()? = 0;
    **ctx.accounts.authority.try_borrow_mut_lamports()? += user_status_lamports;
    
    // Clear account data
    ctx.accounts.non_transferable_user_status.to_account_info().assign(&anchor_lang::system_program::ID);
    ctx.accounts.non_transferable_user_status.to_account_info().resize(0)?;

    msg!(
        "RNSCleanupID:_rnsId:{};_wallet:{};_tokenId:{}",
        rns_id,
        wallet,
        ctx.accounts.non_transferable_nft_mint.key()
    );

    emit!(CleanupEvent {
        rns_id: rns_id.clone(),
        wallet: wallet,
        token_id: ctx.accounts.non_transferable_nft_mint.key().to_string(),
    });

    msg!("=== CLEANUP HANDLER END ===");
    Ok(())
}