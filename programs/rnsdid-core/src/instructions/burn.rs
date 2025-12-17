use anchor_lang::prelude::*;
use anchor_lang::solana_program::program::{invoke, invoke_signed};
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token_interface::TokenInterface;

use crate::state::*;

#[event]
pub struct BurnEvent {
    pub rns_id: String,
    pub wallet: Pubkey,
    pub mint: Pubkey,
}

#[derive(Accounts)]
#[instruction(rns_id: String, index: String)]
pub struct BurnNonTransferableNft<'info> {
    #[account(mut)]
    pub nft_owner: Signer<'info>,

    /// CHECK: Admin account to receive ATA rent (optional)
    #[account(mut)]
    pub authority: UncheckedAccount<'info>,

    #[account(
        mut,
        seeds = [NON_TRANSFERABLE_PROJECT_PREFIX.as_bytes()],
        bump = non_transferable_project.bump
    )]
    pub non_transferable_project: Box<Account<'info, ProjectAccount>>,

    /// CHECK: 用户的 Token Account
    #[account(mut)]
    pub user_token_account: UncheckedAccount<'info>,

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

pub fn handler(ctx: Context<BurnNonTransferableNft>, rns_id: String, _index: String) -> Result<()> {
    msg!("=== BURN HANDLER START ===");
    msg!("RNS ID: {}", rns_id);

    let token_account_info = ctx.accounts.user_token_account.to_account_info();

    if !token_account_info.data_is_empty() {
        // 读取余额
        let amount = {
            let token_account_data = token_account_info.try_borrow_data()?;
            if token_account_data.len() >= 72 {
                u64::from_le_bytes(token_account_data[64..72].try_into().unwrap())
            } else {
                0
            }
        };

        if amount > 0 {
            msg!("Token balance: {}, burning...", amount);

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
        } else {
            msg!("Token already burned, skipping burn");
        }

        // 关闭 Token Account - 租金退给用户
        msg!("Closing token account, rent to user...");
        let close_ata_ix = spl_token_2022::instruction::close_account(
            &ctx.accounts.token_program.key(),
            &ctx.accounts.user_token_account.key(),
            &ctx.accounts.nft_owner.key(), // 租金退给用户
            &ctx.accounts.nft_owner.key(),
            &[],
        )?;

        invoke(
            &close_ata_ix,
            &[
                ctx.accounts.user_token_account.to_account_info(),
                ctx.accounts.nft_owner.to_account_info(),
            ],
        )?;
    } else {
        msg!("Token account already closed");
    }

    // 关闭 Mint 账户，回收租金给管理员 (需要 MintCloseAuthority 扩展)
    let project_signer_seeds: &[&[u8]] = &[
        NON_TRANSFERABLE_PROJECT_PREFIX.as_bytes(),
        &[ctx.accounts.non_transferable_project.bump],
    ];

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

    msg!(
        "RNSBurnID:_rnsId:{};_wallet:{};_mint:{}",
        rns_id,
        ctx.accounts.nft_owner.key(),
        ctx.accounts.non_transferable_nft_mint.key()
    );

    emit!(BurnEvent {
        rns_id,
        wallet: ctx.accounts.nft_owner.key(),
        mint: ctx.accounts.non_transferable_nft_mint.key(),
    });

    Ok(())
}
