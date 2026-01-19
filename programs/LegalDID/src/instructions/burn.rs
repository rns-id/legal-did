use anchor_lang::prelude::*;
use anchor_lang::solana_program::program::{invoke, invoke_signed};
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token_interface::TokenInterface;

use crate::state::*;

#[event]
pub struct BurnV4 {
    pub wallet: Pubkey,
    pub mint: Pubkey,
}

#[derive(Accounts)]
pub struct BurnNonTransferableNft<'info> {
    #[account(mut)]
    pub nft_owner: Signer<'info>,

    /// Authority account to receive Mint rent - must be project authority
    #[account(
        mut,
        constraint = authority.key() == non_transferable_project.authority @ crate::error::ErrorCode::Unauthorized
    )]
    pub authority: SystemAccount<'info>,

    #[account(
        mut,
        seeds = [NON_TRANSFERABLE_PROJECT_PREFIX.as_bytes()],
        bump = non_transferable_project.bump
    )]
    pub non_transferable_project: Box<Account<'info, ProjectAccount>>,

    /// CHECK: User's Token Account - validated by token program
    #[account(mut)]
    pub user_token_account: UncheckedAccount<'info>,

    /// CHECK: NFT Mint - passed directly, no PDA derivation needed
    #[account(mut)]
    pub non_transferable_nft_mint: UncheckedAccount<'info>,

    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<BurnNonTransferableNft>) -> Result<()> {
    msg!("=== BURN HANDLER START ===");
    msg!("Mint: {}", ctx.accounts.non_transferable_nft_mint.key());

    let token_account_info = ctx.accounts.user_token_account.to_account_info();

    if !token_account_info.data_is_empty() {
        // Read balance
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

        // Close Token Account - refund rent to user
        msg!("Closing token account, rent to user...");
        let close_ata_ix = spl_token_2022::instruction::close_account(
            &ctx.accounts.token_program.key(),
            &ctx.accounts.user_token_account.key(),
            &ctx.accounts.nft_owner.key(),
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

    // Close Mint account, recover rent to admin (requires MintCloseAuthority extension)
    let project_signer_seeds: &[&[u8]] = &[
        NON_TRANSFERABLE_PROJECT_PREFIX.as_bytes(),
        &[ctx.accounts.non_transferable_project.bump],
    ];

    msg!("Closing mint account to recover rent");
    let close_mint_ix = spl_token_2022::instruction::close_account(
        &ctx.accounts.token_program.key(),
        &ctx.accounts.non_transferable_nft_mint.key(),
        &ctx.accounts.authority.key(),
        &ctx.accounts.non_transferable_project.key(),
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
    
    // 输出格式化的事件日志，方便后端解析
    msg!(
        "BurnV4:wallet:{};mint:{};",
        ctx.accounts.nft_owner.key(),
        ctx.accounts.non_transferable_nft_mint.key()
    );

    emit!(BurnV4 {
        wallet: ctx.accounts.nft_owner.key(),
        mint: ctx.accounts.non_transferable_nft_mint.key(),
    });

    Ok(())
}
