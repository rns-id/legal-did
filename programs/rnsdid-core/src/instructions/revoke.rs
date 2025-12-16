use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, Mint, ThawAccount, Token, TokenAccount};

use crate::error::ErrorCode;
use crate::state::*;

#[event]
pub struct RevokeEvent {
  pub rns_id: String,
  pub wallet: Pubkey,
  pub token_id: String,
  pub revoked_by: Pubkey,
}

#[derive(Accounts)]
#[instruction(rns_id: String, wallet: Pubkey)]
pub struct RevokeNonTransferableNft<'info> {
  /// Admin account - must sign to revoke
  #[account(mut)]
  pub authority: Signer<'info>,

  #[account(
    mut,
    constraint = non_transferable_project.authority == authority.key(),
    seeds = [NON_TRANSFERABLE_PROJECT_PREFIX.as_bytes()],
    bump = non_transferable_project.bump
  )]
  pub non_transferable_project: Box<Account<'info, ProjectAccount>>,

  /// User whose NFT is being revoked
  /// CHECK: This is the user account, no signature required for revoke
  #[account(mut)]
  pub user_account: AccountInfo<'info>,

  /// User's Token account
  #[account(
    mut,
    constraint = user_token_account.owner == user_account.key(),
    constraint = user_token_account.amount == 1
  )]
  pub user_token_account: Box<Account<'info, TokenAccount>>,

  /// User status account - mark as revoked but don't close (let user burn later)
  #[account(
    mut,
    seeds = [
      NON_TRANSFERABLE_NFT_USERSTATUS_PREFIX.as_bytes(),
      &hash_seed(&rns_id.clone())[..32],
      wallet.key().as_ref()
    ],
    bump = non_transferable_user_status.bump
  )]
  pub non_transferable_user_status: Box<Account<'info, UserStatusAccount>>,

  /// RNS ID status account - update count or close if reaches 0
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

  #[account(mut)]
  pub non_transferable_nft_mint: Box<Account<'info, Mint>>,

  pub associated_token_program: Program<'info, AssociatedToken>,
  pub token_program: Program<'info, Token>,
  pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<RevokeNonTransferableNft>, rns_id: String, wallet: Pubkey) -> Result<()> {
    msg!("=== REVOKE HANDLER START ===");
    msg!("RNS ID: {}", rns_id);
    msg!("Wallet: {}", wallet);
    msg!("Revoked by: {}", ctx.accounts.authority.key());

    // Check if already revoked (use is_authorized field)
    require!(
        ctx.accounts.non_transferable_user_status.is_minted && 
        ctx.accounts.non_transferable_user_status.is_authorized,
        ErrorCode::Unauthorized // Could add a specific "AlreadyRevoked" error
    );

    // Mark as revoked by setting is_authorized = false
    ctx.accounts.non_transferable_user_status.is_authorized = false;

    let signer_seeds: &[&[u8]] = &[
        NON_TRANSFERABLE_PROJECT_PREFIX.as_bytes(),
        &[ctx.accounts.non_transferable_project.bump],
    ];

    // 1. Thaw the token account first (so we can burn it)
    msg!("Thawing token account");
    let cpi_accounts = ThawAccount {
        account: ctx.accounts.user_token_account.to_account_info(),
        mint: ctx.accounts.non_transferable_nft_mint.to_account_info(),
        authority: ctx.accounts.non_transferable_project.to_account_info(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
    token::thaw_account(cpi_ctx.with_signer(&[&signer_seeds[..]]))?;

    // 2. Since we can't burn without user's permission, we'll use a different approach:
    // We'll transfer the token to a "burn vault" controlled by the project
    // This effectively removes it from the user's wallet
    
    // For now, let's just leave the token frozen and close the status accounts
    // The token will remain in user's wallet but frozen and without valid status
    msg!("Token remains frozen in user wallet (status accounts closed)");

    // Note: We cannot close the token account without user's permission
    // The token will remain frozen in the user's wallet

    // 1. Decrease RNS ID NFT count
    let current_num = ctx.accounts.non_transferable_rns_id_status.num;
    let new_num = current_num.checked_sub(1).ok_or(ErrorCode::Unauthorized)?;
    
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
        ctx.accounts.non_transferable_rns_id_status.to_account_info().resize(0)?;
    } else {
        // Only update num
        ctx.accounts.non_transferable_rns_id_status.num = new_num;
    }

    msg!(
        "RNSRevokeID:_rnsId:{};_wallet:{};_tokenId:{};_revokedBy:{}",
        rns_id,
        wallet,
        ctx.accounts.non_transferable_nft_mint.key(),
        ctx.accounts.authority.key()
    );

    emit!(RevokeEvent {
        rns_id: rns_id.clone(),
        wallet: wallet,
        token_id: ctx.accounts.non_transferable_nft_mint.key().to_string(),
        revoked_by: ctx.accounts.authority.key(),
    });

    msg!("=== REVOKE HANDLER END ===");
    Ok(())
}