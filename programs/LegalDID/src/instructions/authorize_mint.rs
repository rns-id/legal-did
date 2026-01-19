use anchor_lang::prelude::*;

use crate::state::*;

#[event]
pub struct AuthorizeMintV4 {
    pub order_id: String,
    pub wallet: Pubkey,
    pub payer: Pubkey,
    pub amount: u64,
}

#[derive(Accounts)]
#[instruction(order_id: String)]
pub struct AuthorizeMint<'info> {
    /// Paying user (anyone can pay)
    #[account(mut)]
    pub payer: Signer<'info>,

    /// Project account (holds funds until withdraw)
    #[account(
        mut,
        seeds = [NON_TRANSFERABLE_PROJECT_PREFIX.as_bytes()],
        bump = non_transferable_project.bump
    )]
    pub non_transferable_project: Box<Account<'info, ProjectAccount>>,

    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<AuthorizeMint>,
    order_id: String,
) -> Result<()> {
    let project = &ctx.accounts.non_transferable_project;
    let mint_price = project.mint_price;

    // Transfer fee to project account (contract holds funds like EVM)
    if mint_price > 0 {
        let transfer_ix = anchor_lang::solana_program::system_instruction::transfer(
            &ctx.accounts.payer.key(),
            &ctx.accounts.non_transferable_project.key(),
            mint_price,
        );
        anchor_lang::solana_program::program::invoke(
            &transfer_ix,
            &[
                ctx.accounts.payer.to_account_info(),
                ctx.accounts.non_transferable_project.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
        )?;
    }

    msg!("DID mint requested (payment received)");
    msg!("Order ID: {}", order_id);
    msg!("Payer: {}", ctx.accounts.payer.key());
    msg!("Amount: {} lamports", mint_price);
    
    // 输出格式化的事件日志，方便后端解析
    msg!(
        "AuthorizeMintV4:orderId:{};wallet:{};payer:{};amount:{};",
        order_id,
        ctx.accounts.payer.key(),
        ctx.accounts.payer.key(),
        mint_price
    );

    emit!(AuthorizeMintV4 {
        order_id: order_id.clone(),
        wallet: ctx.accounts.payer.key(),
        payer: ctx.accounts.payer.key(),
        amount: mint_price,
    });

    Ok(())
}
