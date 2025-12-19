use anchor_lang::prelude::*;

// ============================================
// Constants
// ============================================

/// PDA seed for AttestationConfig
pub const ATTESTATION_CONFIG_PREFIX: &str = "attestation-config";

/// Maximum number of operators
pub const MAX_OPERATORS: usize = 5;

/// AttestationConfig account size
pub const ATTESTATION_CONFIG_SIZE: usize = 8 +   // discriminator
    32 +                                          // authority
    4 + (32 * MAX_OPERATORS) +                    // operators vec (4 bytes len + 5 * 32 bytes)
    8 +                                           // schema_count
    8 +                                           // attestation_fee
    32 +                                          // fee_recipient
    1;                                            // bump

// ============================================
// Accounts
// ============================================

/// Configuration account for the LegalAttestation program
#[account]
#[derive(Default)]
pub struct AttestationConfig {
    /// Super admin authority
    pub authority: Pubkey,
    /// List of operators who can create/revoke attestations
    pub operators: Vec<Pubkey>,
    /// Number of schemas created
    pub schema_count: u64,
    /// Fee for requesting attestation (in lamports)
    pub attestation_fee: u64,
    /// Fee recipient address
    pub fee_recipient: Pubkey,
    /// PDA bump seed
    pub bump: u8,
}

impl AttestationConfig {
    /// Check if the key is admin or operator
    pub fn is_admin_or_operator(&self, key: &Pubkey) -> bool {
        self.authority == *key || self.operators.contains(key)
    }

    /// Check if the key is super admin
    pub fn is_admin(&self, key: &Pubkey) -> bool {
        self.authority == *key
    }
}

// ============================================
// Events
// ============================================

#[event]
pub struct ConfigInitialized {
    pub authority: Pubkey,
}

#[event]
pub struct OperatorAdded {
    pub operator: Pubkey,
}

#[event]
pub struct OperatorRemoved {
    pub operator: Pubkey,
}

#[event]
pub struct SchemaCreated {
    pub schema: Pubkey,
    pub name: String,
}

#[event]
pub struct AttestationCreated {
    pub attestation: Pubkey,
    pub schema: Pubkey,
    pub subject: Pubkey,
    pub attester: Pubkey,
}

#[event]
pub struct AttestationRevoked {
    pub attestation: Pubkey,
}

#[event]
pub struct CredentialCreated {
    pub credential: Pubkey,
    pub name: String,
}

#[event]
pub struct AttestationRequested {
    pub user: Pubkey,
    pub schema: Pubkey,
    pub request_id: String,
    pub amount: u64,
}

// ============================================
// Instruction Contexts for Admin Settings
// ============================================

#[derive(Accounts)]
pub struct SetAttestationFee<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        mut,
        seeds = [ATTESTATION_CONFIG_PREFIX.as_bytes()],
        bump = config.bump,
        constraint = config.authority == authority.key() @ crate::error::ErrorCode::Unauthorized
    )]
    pub config: Account<'info, AttestationConfig>,
}

#[derive(Accounts)]
pub struct SetFeeRecipient<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        mut,
        seeds = [ATTESTATION_CONFIG_PREFIX.as_bytes()],
        bump = config.bump,
        constraint = config.authority == authority.key() @ crate::error::ErrorCode::Unauthorized
    )]
    pub config: Account<'info, AttestationConfig>,
}
