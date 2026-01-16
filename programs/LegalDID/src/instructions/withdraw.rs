use anchor_lang::prelude::*;

use crate::state::*;

#[event]
pub struct WithdrawV4 {
    pub recipient: Pubkey,
    pub amount: u64,
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    /// Admin only
    #[account(mut)]
    pub authority: Signer<'info>,

    /// Project account (holds funds)
    #[account(
        mut,
        seeds = [NON_TRANSFERABLE_PROJECT_PREFIX.as_bytes()],
        bump = non_transferable_project.bump,
        constraint = non_transferable_project.authority == authority.key() @ crate::error::ErrorCode::Unauthorized
    )]
    pub non_transferable_project: Box<Account<'info, ProjectAccount>>,

    /// Destination address (renamed from fee_recipient)
    /// CHECK: Validated from project account
    #[account(
        mut,
        constraint = destination.key() == non_transferable_project.destination @ crate::error::ErrorCode::InvalidFeeRecipient
    )]
    pub destination: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<Withdraw>) -> Result<()> {
    let project_account_info = ctx.accounts.non_transferable_project.to_account_info();
    
    // Calculate withdrawable amount (total balance - rent exempt minimum)
    let rent = Rent::get()?;
    let min_balance = rent.minimum_balance(project_account_info.data_len());
    let current_balance = project_account_info.lamports();
    
    let withdrawable = current_balance.saturating_sub(min_balance);
    
    require!(withdrawable > 0, crate::error::ErrorCode::InsufficientBalance);

    // Transfer from project account to destination
    **project_account_info.try_borrow_mut_lamports()? -= withdrawable;
    **ctx.accounts.destination.try_borrow_mut_lamports()? += withdrawable;

    msg!("Withdrawn {} lamports to {}", withdrawable, ctx.accounts.destination.key());

    emit!(WithdrawV4 {
        recipient: ctx.accounts.destination.key(),
        amount: withdrawable,
    });

    Ok(())
}
