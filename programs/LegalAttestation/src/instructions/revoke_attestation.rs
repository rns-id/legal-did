use anchor_lang::prelude::*;
use solana_attestation_service_client::{
    instructions::CloseAttestationCpiBuilder,
    programs::SOLANA_ATTESTATION_SERVICE_ID,
};
use crate::state::*;
use crate::error::ErrorCode;

#[derive(Accounts)]
pub struct RevokeAttestation<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        seeds = [ATTESTATION_CONFIG_PREFIX.as_bytes()],
        bump = config.bump,
        constraint = config.is_admin_or_operator(&authority.key()) @ ErrorCode::Unauthorized
    )]
    pub config: Account<'info, AttestationConfig>,

    /// CHECK: SAS Credential account
    pub credential: UncheckedAccount<'info>,

    /// CHECK: SAS Attestation account to close/revoke
    #[account(mut)]
    pub attestation: UncheckedAccount<'info>,

    /// CHECK: Event authority for SAS events
    pub event_authority: UncheckedAccount<'info>,

    /// CHECK: SAS Program
    #[account(
        constraint = sas_program.key() == SOLANA_ATTESTATION_SERVICE_ID @ ErrorCode::InvalidSasProgram
    )]
    pub sas_program: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<RevokeAttestation>) -> Result<()> {
    // Get account infos with proper lifetimes
    let sas_program_info = ctx.accounts.sas_program.to_account_info();
    let authority_info = ctx.accounts.authority.to_account_info();
    let credential_info = ctx.accounts.credential.to_account_info();
    let attestation_info = ctx.accounts.attestation.to_account_info();
    let event_authority_info = ctx.accounts.event_authority.to_account_info();
    let system_program_info = ctx.accounts.system_program.to_account_info();

    // CPI call to SAS to close/revoke attestation
    CloseAttestationCpiBuilder::new(&sas_program_info)
        .payer(&authority_info)
        .authority(&authority_info)
        .credential(&credential_info)
        .attestation(&attestation_info)
        .event_authority(&event_authority_info)
        .system_program(&system_program_info)
        .attestation_program(&sas_program_info)
        .invoke()
        .map_err(|_| ErrorCode::SasCpiFailed)?;

    emit!(AttestationRevoked {
        attestation: ctx.accounts.attestation.key(),
    });

    msg!(
        "Attestation revoked/closed via SAS: attestation={}",
        ctx.accounts.attestation.key()
    );

    Ok(())
}
