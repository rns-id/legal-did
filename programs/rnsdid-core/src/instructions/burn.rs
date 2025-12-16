use anchor_lang::prelude::*;
use anchor_lang::solana_program::program::invoke;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token_interface::{TokenAccount, TokenInterface};

use crate::error::ErrorCode;
use crate::state::*;

#[event]
pub struct BurnEvent {
    pub rns_id: String,
    pub wallet: Pubkey,
    pub token_id: String,
}

#[derive(Accounts)]
#[instruction(rns_id: String, wallet: Pubkey)]
pub struct BurnNonTransferableNft<'info> {
    #[account(mut)]
    pub nft_owner: Signer<'info>,

    /// CHECK: Admin account to receive rent
    #[account(
        mut,
        constraint = authority.key() == non_transferable_project.authority @ ErrorCode::Unauthorized
    )]
    pub authority: UncheckedAccount<'info>,

    #[account(
        seeds = [NON_TRANSFERABLE_PROJECT_PREFIX.as_bytes()],
        bump = non_transferable_project.bump
    )]
    pub non_transferable_project: Box<Account<'info, ProjectAccount>>,

    #[account(
        mut,
        constraint = user_token_account.owner == nft_owner.key(),
        constraint = user_token_account.amount == 1
    )]
    pub user_token_account: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        close = authority,
        constraint = did_status.wallet == wallet,
        constraint = did_status.status == DIDStatus::Minted as u8 @ ErrorCode::Unauthorized,
        seeds = [
            DID_STATUS_PREFIX.as_bytes(),
            &hash_seed(&rns_id)[..32],
            wallet.key().as_ref()
        ],
        bump = did_status.bump
    )]
    pub did_status: Box<Account<'info, DIDStatusAccount>>,

    /// CHECK: NFT Mint
    #[account(mut)]
    pub non_transferable_nft_mint: UncheckedAccount<'info>,

    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<BurnNonTransferableNft>, rns_id: String, wallet: Pubkey) -> Result<()> {
    msg!("=== BURN HANDLER START ===");
    msg!("RNS ID: {}", rns_id);

    require!(ctx.accounts.nft_owner.key() == wallet, ErrorCode::Unauthorized);

    // Burn token (用户自己burn)
    let burn_ix = spl_token_2022::instruction::burn(
        &ctx.accounts.token_program.key(),
        &ctx.accounts.user_token_account.key(),
        &ctx.accounts.non_transferable_nft_mint.key(),
        &ctx.accounts.nft_owner.key(),
        &[],
        1,
    )?;

    invoke(
        &burn_ix,
        &[
            ctx.accounts.user_token_account.to_account_info(),
            ctx.accounts.non_transferable_nft_mint.to_account_info(),
            ctx.accounts.nft_owner.to_account_info(),
        ],
    )?;

    // Close token account
    let close_ix = spl_token_2022::instruction::close_account(
        &ctx.accounts.token_program.key(),
        &ctx.accounts.user_token_account.key(),
        &ctx.accounts.nft_owner.key(),
        &ctx.accounts.nft_owner.key(),
        &[],
    )?;

    invoke(
        &close_ix,
        &[
            ctx.accounts.user_token_account.to_account_info(),
            ctx.accounts.nft_owner.to_account_info(),
            ctx.accounts.nft_owner.to_account_info(),
        ],
    )?;

    msg!("RNSBurnID:_rnsId:{};_wallet:{};_tokenId:{}", rns_id, wallet, ctx.accounts.non_transferable_nft_mint.key());

    emit!(BurnEvent {
        rns_id,
        wallet,
        token_id: ctx.accounts.non_transferable_nft_mint.key().to_string(),
    });

    Ok(())
}
