use anchor_lang::prelude::*;
use anchor_lang::solana_program::program::invoke_signed;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token_interface::{TokenAccount, TokenInterface};

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
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        mut,
        constraint = non_transferable_project.authority == authority.key() @ ErrorCode::Unauthorized,
        seeds = [NON_TRANSFERABLE_PROJECT_PREFIX.as_bytes()],
        bump = non_transferable_project.bump
    )]
    pub non_transferable_project: Box<Account<'info, ProjectAccount>>,

    /// CHECK: User account
    #[account(mut)]
    pub user_account: UncheckedAccount<'info>,

    #[account(
        mut,
        constraint = user_token_account.owner == user_account.key(),
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

pub fn handler(ctx: Context<RevokeNonTransferableNft>, rns_id: String, wallet: Pubkey) -> Result<()> {
    msg!("=== REVOKE HANDLER START ===");
    msg!("RNS ID: {}", rns_id);
    msg!("Revoked by: {}", ctx.accounts.authority.key());

    let project_signer_seeds: &[&[u8]] = &[
        NON_TRANSFERABLE_PROJECT_PREFIX.as_bytes(),
        &[ctx.accounts.non_transferable_project.bump],
    ];

    // 使用 PermanentDelegate 权限直接 burn 用户的 NFT
    // Token-2022 的 PermanentDelegate 允许管理员无需用户签名即可 burn
    msg!("Burning token using PermanentDelegate");
    let burn_ix = spl_token_2022::instruction::burn(
        &ctx.accounts.token_program.key(),
        &ctx.accounts.user_token_account.key(),
        &ctx.accounts.non_transferable_nft_mint.key(),
        &ctx.accounts.non_transferable_project.key(), // PermanentDelegate
        &[],
        1,
    )?;

    invoke_signed(
        &burn_ix,
        &[
            ctx.accounts.user_token_account.to_account_info(),
            ctx.accounts.non_transferable_nft_mint.to_account_info(),
            ctx.accounts.non_transferable_project.to_account_info(),
        ],
        &[project_signer_seeds],
    )?;

    // 关闭 Token 账户，租金返还给用户
    msg!("Closing token account - rent to user");
    let close_ix = spl_token_2022::instruction::close_account(
        &ctx.accounts.token_program.key(),
        &ctx.accounts.user_token_account.key(),
        &ctx.accounts.user_account.key(),
        &ctx.accounts.non_transferable_project.key(), // PermanentDelegate
        &[],
    )?;

    invoke_signed(
        &close_ix,
        &[
            ctx.accounts.user_token_account.to_account_info(),
            ctx.accounts.user_account.to_account_info(),
            ctx.accounts.non_transferable_project.to_account_info(),
        ],
        &[project_signer_seeds],
    )?;

    msg!(
        "RNSRevokeID:_rnsId:{};_wallet:{};_tokenId:{};_revokedBy:{}",
        rns_id,
        wallet,
        ctx.accounts.non_transferable_nft_mint.key(),
        ctx.accounts.authority.key()
    );

    emit!(RevokeEvent {
        rns_id,
        wallet,
        token_id: ctx.accounts.non_transferable_nft_mint.key().to_string(),
        revoked_by: ctx.accounts.authority.key(),
    });

    Ok(())
}
