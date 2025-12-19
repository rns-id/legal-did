use anchor_lang::prelude::*;
use solana_attestation_service_client::{
    instructions::CreateCredentialCpiBuilder,
    programs::SOLANA_ATTESTATION_SERVICE_ID,
};
use crate::state::*;
use crate::error::ErrorCode;

#[derive(Accounts)]
#[instruction(name: String)]
pub struct CreateCredential<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [ATTESTATION_CONFIG_PREFIX.as_bytes()],
        bump = config.bump,
        constraint = config.authority == authority.key() @ ErrorCode::Unauthorized
    )]
    pub config: Account<'info, AttestationConfig>,

    /// CHECK: SAS Credential account - will be created by SAS program
    #[account(mut)]
    pub credential: UncheckedAccount<'info>,

    /// CHECK: SAS Program
    #[account(
        constraint = sas_program.key() == SOLANA_ATTESTATION_SERVICE_ID @ ErrorCode::InvalidSasProgram
    )]
    pub sas_program: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<CreateCredential>,
    name: String,
    signers: Vec<Pubkey>,
) -> Result<()> {
    require!(!name.is_empty(), ErrorCode::EmptySchemaName);

    // Get account infos with proper lifetimes
    let sas_program_info = ctx.accounts.sas_program.to_account_info();
    let authority_info = ctx.accounts.authority.to_account_info();
    let credential_info = ctx.accounts.credential.to_account_info();
    let system_program_info = ctx.accounts.system_program.to_account_info();

    // CPI call to SAS to create credential
    CreateCredentialCpiBuilder::new(&sas_program_info)
        .payer(&authority_info)
        .credential(&credential_info)
        .authority(&authority_info)
        .system_program(&system_program_info)
        .name(name.clone())
        .signers(signers)
        .invoke()
        .map_err(|_| ErrorCode::SasCpiFailed)?;

    emit!(CredentialCreated {
        credential: ctx.accounts.credential.key(),
        name: name.clone(),
    });

    msg!(
        "Credential created via SAS: name={}, credential={}",
        name,
        ctx.accounts.credential.key()
    );

    Ok(())
}
