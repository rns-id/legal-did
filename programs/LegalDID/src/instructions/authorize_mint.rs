use anchor_lang::prelude::*;

use crate::state::*;

#[event]
pub struct AuthorizeMintEvent {
    pub rns_id: String,
    pub wallet: Pubkey,
    pub index: String,
    pub payer: Pubkey,
    pub amount: u64,
}

#[derive(Accounts)]
#[instruction(rns_id: String, index: String)]
pub struct AuthorizeMint<'info> {
    /// Paying user (anyone can pay)
    #[account(mut)]
    pub payer: Signer<'info>,

    /// Project account (reads mint_price and fee_recipient)
    #[account(
        seeds = [NON_TRANSFERABLE_PROJECT_PREFIX.as_bytes()],
        bump = non_transferable_project.bump
    )]
    pub non_transferable_project: Box<Account<'info, ProjectAccount>>,

    /// Fee recipient address
    /// CHECK: Validated from project account
    #[account(
        mut,
        constraint = fee_recipient.key() == non_transferable_project.fee_recipient
    )]
    pub fee_recipient: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<AuthorizeMint>,
    rns_id: String,
    index: String,
) -> Result<()> {
    let project = &ctx.accounts.non_transferable_project;
    let mint_price = project.mint_price;

    // Transfer fee to fee_recipient
    if mint_price > 0 {
        let transfer_ix = anchor_lang::solana_program::system_instruction::transfer(
            &ctx.accounts.payer.key(),
            &ctx.accounts.fee_recipient.key(),
            mint_price,
        );
        anchor_lang::solana_program::program::invoke(
            &transfer_ix,
            &[
                ctx.accounts.payer.to_account_info(),
                ctx.accounts.fee_recipient.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
        )?;
    }

    msg!("DID mint requested (payment received)");
    msg!("RNS ID: {}", rns_id);
    msg!("Payer: {}", ctx.accounts.payer.key());
    msg!("Amount: {} lamports", mint_price);

    emit!(AuthorizeMintEvent {
        rns_id: rns_id.clone(),
        wallet: ctx.accounts.payer.key(),
        index: index.clone(),
        payer: ctx.accounts.payer.key(),
        amount: mint_price,
    });

    msg!(
        "RNSAuthorize:_rnsId:{};_wallet:{};_index:{};_amount:{}",
        rns_id,
        ctx.accounts.payer.key(),
        index,
        mint_price
    );

    Ok(())
}
