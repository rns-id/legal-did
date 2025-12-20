use anchor_lang::prelude::*;

pub mod error;
pub mod instructions;
pub mod state;

use instructions::*;
use state::*;

declare_id!("4L4PvfugSGXuosyZSQxGxL5B9WqhUVqMEfwqMEUdUGiW");

#[program]
pub mod legal_attestation {
    use super::*;

    /// Initialize the attestation program
    pub fn initialize(ctx: Context<Initialize>, args: InitializeArgs) -> Result<()> {
        instructions::initialize::handler(ctx, args)
    }

    /// Set attestation fee (admin only)
    pub fn set_attestation_fee(ctx: Context<SetAttestationFee>, fee: u64) -> Result<()> {
        ctx.accounts.config.attestation_fee = fee;
        msg!("Attestation fee set to: {} lamports", fee);
        Ok(())
    }

    /// Set fee recipient (admin only)
    pub fn set_fee_recipient(ctx: Context<SetFeeRecipient>, recipient: Pubkey) -> Result<()> {
        ctx.accounts.config.fee_recipient = recipient;
        msg!("Fee recipient set to: {}", recipient);
        Ok(())
    }

    /// Add an operator (admin only)
    pub fn add_operator(ctx: Context<ManageOperator>, operator: Pubkey) -> Result<()> {
        instructions::manage_operator::add_handler(ctx, operator)
    }

    /// Remove an operator (admin only)
    pub fn remove_operator(ctx: Context<ManageOperator>, operator: Pubkey) -> Result<()> {
        instructions::manage_operator::remove_handler(ctx, operator)
    }

    /// Create a credential via SAS (admin only) - must be called first before creating schemas
    pub fn create_credential(
        ctx: Context<CreateCredential>,
        name: String,
        signers: Vec<Pubkey>,
    ) -> Result<()> {
        instructions::create_credential::handler(ctx, name, signers)
    }

    /// Create a schema via SAS (admin only)
    pub fn create_schema(
        ctx: Context<CreateSchema>,
        name: String,
        description: String,
        layout: Vec<u8>,
        field_names: Vec<String>,
    ) -> Result<()> {
        instructions::create_schema::handler(ctx, name, description, layout, field_names)
    }

    /// User requests an attestation (pays fee)
    /// Backend listens to events and approves via create_attestation
    pub fn request_attestation(
        ctx: Context<RequestAttestation>,
        schema: Pubkey,
        request_id: String,
    ) -> Result<()> {
        instructions::request_attestation::handler(ctx, schema, request_id)
    }

    /// Create an attestation via SAS (admin/operator) - called after approving request
    pub fn create_attestation(
        ctx: Context<CreateAttestation>,
        nonce: Pubkey,
        data: Vec<u8>,
        expiry: Option<i64>,
    ) -> Result<()> {
        instructions::create_attestation::handler(ctx, nonce, data, expiry)
    }

    /// Revoke an attestation via SAS (admin/operator)
    pub fn revoke_attestation(ctx: Context<RevokeAttestation>) -> Result<()> {
        instructions::revoke_attestation::handler(ctx)
    }
}
