use anchor_lang::prelude::*;
use solana_attestation_service_client::{
    instructions::CreateSchemaCpiBuilder,
    programs::SOLANA_ATTESTATION_SERVICE_ID,
};
use crate::state::*;
use crate::error::ErrorCode;

#[derive(Accounts)]
#[instruction(name: String, description: String)]
pub struct CreateSchema<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [ATTESTATION_CONFIG_PREFIX.as_bytes()],
        bump = config.bump,
        constraint = config.authority == authority.key() @ ErrorCode::Unauthorized
    )]
    pub config: Account<'info, AttestationConfig>,

    /// CHECK: SAS Credential account - required for schema creation
    pub credential: UncheckedAccount<'info>,

    /// CHECK: SAS Schema account - will be created by SAS program
    #[account(mut)]
    pub schema: UncheckedAccount<'info>,

    /// CHECK: SAS Program
    #[account(
        constraint = sas_program.key() == SOLANA_ATTESTATION_SERVICE_ID @ ErrorCode::InvalidSasProgram
    )]
    pub sas_program: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<CreateSchema>,
    name: String,
    description: String,
    layout: Vec<u8>,
    field_names: Vec<String>,
) -> Result<()> {
    require!(!name.is_empty(), ErrorCode::EmptySchemaName);

    let config = &mut ctx.accounts.config;
    
    // Increment schema count
    config.schema_count = config.schema_count.checked_add(1).unwrap();

    // Get account infos with proper lifetimes
    let sas_program_info = ctx.accounts.sas_program.to_account_info();
    let authority_info = ctx.accounts.authority.to_account_info();
    let credential_info = ctx.accounts.credential.to_account_info();
    let schema_info = ctx.accounts.schema.to_account_info();
    let system_program_info = ctx.accounts.system_program.to_account_info();

    // CPI call to SAS to create schema
    CreateSchemaCpiBuilder::new(&sas_program_info)
        .payer(&authority_info)
        .authority(&authority_info)
        .credential(&credential_info)
        .schema(&schema_info)
        .system_program(&system_program_info)
        .name(name.clone())
        .description(description)
        .layout(layout)
        .field_names(field_names)
        .invoke()
        .map_err(|_| ErrorCode::SasCpiFailed)?;

    emit!(SchemaCreated {
        schema: ctx.accounts.schema.key(),
        name: name.clone(),
    });

    msg!(
        "Schema created via SAS: name={}, schema={}, schema_count={}",
        name,
        ctx.accounts.schema.key(),
        config.schema_count
    );

    Ok(())
}
