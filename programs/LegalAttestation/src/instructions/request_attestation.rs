use anchor_lang::prelude::*;
use crate::state::*;
use crate::error::ErrorCode;

#[derive(Accounts)]
#[instruction(schema: Pubkey, request_id: String)]
pub struct RequestAttestation<'info> {
    /// User requesting the attestation (pays fee)
    #[account(mut)]
    pub user: Signer<'info>,

    /// Attestation config (reads fee and fee_recipient)
    #[account(
        seeds = [ATTESTATION_CONFIG_PREFIX.as_bytes()],
        bump = config.bump
    )]
    pub config: Account<'info, AttestationConfig>,

    /// Fee recipient address
    /// CHECK: Validated from config account
    #[account(
        mut,
        constraint = fee_recipient.key() == config.fee_recipient @ ErrorCode::InvalidFeeRecipient
    )]
    pub fee_recipient: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<RequestAttestation>,
    schema: Pubkey,
    request_id: String,
) -> Result<()> {
    let config = &ctx.accounts.config;
    let attestation_fee = config.attestation_fee;

    // Transfer fee to fee_recipient
    if attestation_fee > 0 {
        let transfer_ix = anchor_lang::solana_program::system_instruction::transfer(
            &ctx.accounts.user.key(),
            &ctx.accounts.fee_recipient.key(),
            attestation_fee,
        );
        anchor_lang::solana_program::program::invoke(
            &transfer_ix,
            &[
                ctx.accounts.user.to_account_info(),
                ctx.accounts.fee_recipient.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
        )?;
    }

    msg!("Attestation requested (payment received)");
    msg!("User: {}", ctx.accounts.user.key());
    msg!("Schema: {}", schema);
    msg!("Request ID: {}", request_id);
    msg!("Amount: {} lamports", attestation_fee);

    emit!(AttestationRequested {
        user: ctx.accounts.user.key(),
        schema,
        request_id: request_id.clone(),
        amount: attestation_fee,
    });

    msg!(
        "AttestationRequest:_user:{};_schema:{};_requestId:{};_amount:{}",
        ctx.accounts.user.key(),
        schema,
        request_id,
        attestation_fee
    );

    Ok(())
}
