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
    pub mint: Pubkey,
    pub revoked_by: Pubkey,
}

#[derive(Accounts)]
#[instruction(rns_id: String, wallet: Pubkey, index: String)]
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

    /// CHECK: NFT Mint
    #[account(
        mut,
        seeds = [
            NON_TRANSFERABLE_NFT_MINT_PREFIX.as_bytes(),
            index.as_bytes()
        ],
        bump,
    )]
    pub non_transferable_nft_mint: UncheckedAccount<'info>,

    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<RevokeNonTransferableNft>,
    rns_id: String,
    wallet: Pubkey,
    _index: String,
) -> Result<()> {
    msg!("=== REVOKE HANDLER START ===");
    msg!("RNS ID: {}", rns_id);
    msg!("Revoked by: {}", ctx.accounts.authority.key());

    let project_signer_seeds: &[&[u8]] = &[
        NON_TRANSFERABLE_PROJECT_PREFIX.as_bytes(),
        &[ctx.accounts.non_transferable_project.bump],
    ];

    // 使用 PermanentDelegate 权限直接 burn 用户的 NFT
    msg!("Burning token using PermanentDelegate");
    let burn_ix = spl_token_2022::instruction::burn(
        &ctx.accounts.token_program.key(),
        &ctx.accounts.user_token_account.key(),
        &ctx.accounts.non_transferable_nft_mint.key(),
        &ctx.accounts.non_transferable_project.key(),
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

    // 关闭 Mint 账户，回收租金给管理员 (需要 MintCloseAuthority 扩展)
    msg!("Closing mint account to recover rent");
    let close_mint_ix = spl_token_2022::instruction::close_account(
        &ctx.accounts.token_program.key(),
        &ctx.accounts.non_transferable_nft_mint.key(),
        &ctx.accounts.authority.key(), // 租金接收者
        &ctx.accounts.non_transferable_project.key(), // close authority
        &[],
    )?;

    invoke_signed(
        &close_mint_ix,
        &[
            ctx.accounts.non_transferable_nft_mint.to_account_info(),
            ctx.accounts.authority.to_account_info(),
            ctx.accounts.non_transferable_project.to_account_info(),
        ],
        &[project_signer_seeds],
    )?;

    msg!("Mint account closed, rent recovered");

    // 注意: PermanentDelegate 可以 burn 但不能 close ATA
    // ATA 留给用户，用户可以自行关闭回收租金

    msg!(
        "RNSRevokeID:_rnsId:{};_wallet:{};_mint:{};_revokedBy:{}",
        rns_id,
        wallet,
        ctx.accounts.non_transferable_nft_mint.key(),
        ctx.accounts.authority.key()
    );

    emit!(RevokeEvent {
        rns_id,
        wallet,
        mint: ctx.accounts.non_transferable_nft_mint.key(),
        revoked_by: ctx.accounts.authority.key(),
    });

    Ok(())
}
