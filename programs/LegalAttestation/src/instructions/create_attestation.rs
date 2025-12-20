use anchor_lang::prelude::*;
use solana_attestation_service_client::{
    instructions::CreateAttestationCpiBuilder,
    programs::SOLANA_ATTESTATION_SERVICE_ID,
};
use crate::state::*;
use crate::error::ErrorCode;

#[derive(Accounts)]
pub struct CreateAttestation<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        seeds = [ATTESTATION_CONFIG_PREFIX.as_bytes()],
        bump = config.bump,
        constraint = config.is_admin_or_operator(&authority.key()) @ ErrorCode::Unauthorized
    )]
    pub config: Account<'info, AttestationConfig>,

    /// CHECK: SAS Credential account - required for creating attestations
    pub credential: UncheckedAccount<'info>,

    /// CHECK: SAS Schema account
    pub schema: UncheckedAccount<'info>,

    /// CHECK: SAS Attestation account - will be created by SAS program
    #[account(mut)]
    pub attestation: UncheckedAccount<'info>,

    /// CHECK: SAS Program
    #[account(
        constraint = sas_program.key() == SOLANA_ATTESTATION_SERVICE_ID @ ErrorCode::InvalidSasProgram
    )]
    pub sas_program: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<CreateAttestation>,
    nonce: Pubkey,
    data: Vec<u8>,
    expiry: Option<i64>,
) -> Result<()> {
    // Validate expiration time if provided
    if let Some(exp) = expiry {
        let clock = Clock::get()?;
        require!(exp > clock.unix_timestamp, ErrorCode::ExpirationInPast);
    }

    // Get account infos with proper lifetimes
    let sas_program_info = ctx.accounts.sas_program.to_account_info();
    let authority_info = ctx.accounts.authority.to_account_info();
    let credential_info = ctx.accounts.credential.to_account_info();
    let schema_info = ctx.accounts.schema.to_account_info();
    let attestation_info = ctx.accounts.attestation.to_account_info();
    let system_program_info = ctx.accounts.system_program.to_account_info();

    // CPI call to SAS to create attestation
    let mut builder = CreateAttestationCpiBuilder::new(&sas_program_info);
    
    builder
        .payer(&authority_info)
        .authority(&authority_info)
        .credential(&credential_info)
        .schema(&schema_info)
        .attestation(&attestation_info)
        .system_program(&system_program_info)
        .nonce(nonce)
        .data(data);

    // Only set expiry if provided
    if let Some(exp) = expiry {
        builder.expiry(exp);
    }

    builder.invoke().map_err(|_| ErrorCode::SasCpiFailed)?;

    emit!(AttestationCreated {
        attestation: ctx.accounts.attestation.key(),
        schema: ctx.accounts.schema.key(),
        subject: nonce, // nonce is typically the subject/recipient
        attester: ctx.accounts.authority.key(),
    });

    msg!(
        "Attestation created via SAS: schema={}, attestation={}, attester={}",
        ctx.accounts.schema.key(),
        ctx.accounts.attestation.key(),
        ctx.accounts.authority.key()
    );

    Ok(())
}
