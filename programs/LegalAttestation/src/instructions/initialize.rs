use anchor_lang::prelude::*;
use crate::state::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct InitializeArgs {
    pub attestation_fee: u64,
    pub fee_recipient: Pubkey,
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = ATTESTATION_CONFIG_SIZE,
        seeds = [ATTESTATION_CONFIG_PREFIX.as_bytes()],
        bump
    )]
    pub config: Account<'info, AttestationConfig>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<Initialize>, args: InitializeArgs) -> Result<()> {
    let config = &mut ctx.accounts.config;
    
    config.authority = ctx.accounts.authority.key();
    config.operators = Vec::new();
    config.schema_count = 0;
    config.attestation_fee = args.attestation_fee;
    config.fee_recipient = args.fee_recipient;
    config.bump = ctx.bumps.config;

    emit!(ConfigInitialized {
        authority: config.authority,
    });

    msg!("LegalAttestation initialized with authority: {}", config.authority);
    msg!("Attestation fee: {} lamports", config.attestation_fee);
    msg!("Fee recipient: {}", config.fee_recipient);

    Ok(())
}
