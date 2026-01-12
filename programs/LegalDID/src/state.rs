use anchor_lang::prelude::*;
use sha2::{Digest, Sha256};

// ============================================
// Constants
// ============================================
pub const NON_TRANSFERABLE_PROJECT_PREFIX: &str = "nt-proj-v5";
pub const NON_TRANSFERABLE_PROJECT_MINT_PREFIX: &str = "nt-project-mint-v5";
pub const NON_TRANSFERABLE_NFT_MINT_PREFIX: &str = "nt-nft-mint-v5";

// Maximum number of operators
pub const MAX_OPERATORS: usize = 5;

// Project account size (optimized)
pub const NON_TRANSFERABLE_PROJECT_SIZE: usize = 8 +   // discriminator
    32 +    // authority (admin)
    8 +     // mint_price
    32 +    // destination (renamed from fee_recipient)
    1 +     // bump
    1 +     // mint_bump
    8 +     // last_token_id (like EVM lastTokenId)
    100 +   // name
    100 +   // symbol
    200 +   // base_uri
    4 + (32 * MAX_OPERATORS); // operators vec (4 bytes len + 5 * 32 bytes)

// Token-2022 Mint space (with NonTransferable + PermanentDelegate extensions)
// Base Mint: 82 bytes
// NonTransferable: 1 byte
// PermanentDelegate: 33 bytes (1 + 32)
// Extension header: 2 bytes per extension
// Account type: 1 byte
pub const TOKEN2022_MINT_SIZE: usize = 234;





// ============================================
// Accounts
// ============================================

/// Project configuration account
#[account]
#[derive(Default)]
pub struct ProjectAccount {
    pub authority: Pubkey,      // Super admin (DEFAULT_ADMIN_ROLE)
    pub mint_price: u64,
    pub destination: Pubkey,    // Fee destination (renamed from fee_recipient)
    pub bump: u8,
    pub mint_bump: u8,
    pub last_token_id: u64,     // Auto-increment token ID (like EVM lastTokenId)
    pub name: String,
    pub symbol: String,
    pub base_uri: String,
    pub operators: Vec<Pubkey>, // Operator list (SECONDARY_ADMIN_ROLE)
}

impl ProjectAccount {
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
// Instruction Contexts (kept for compatibility)
// ============================================

#[derive(Accounts)]
pub struct SetBaseURI<'info> {
    #[account(mut, has_one = authority)]
    pub non_transferable_project: Box<Account<'info, ProjectAccount>>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct SetFeeRecipient<'info> {
    #[account(mut, has_one = authority)]
    pub non_transferable_project: Box<Account<'info, ProjectAccount>>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct SetFundDestination<'info> {
    #[account(mut, has_one = authority)]
    pub non_transferable_project: Box<Account<'info, ProjectAccount>>,
    pub authority: Signer<'info>,
}



/// Admin only operation
#[derive(Accounts)]
pub struct SetMintPriceContext<'info> {
    #[account()]
    pub authority: Signer<'info>,
    #[account(mut, has_one = authority)]
    pub non_transferable_project: Box<Account<'info, ProjectAccount>>,
}

/// Add/remove operator (admin only)
#[derive(Accounts)]
pub struct ManageOperator<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        mut,
        constraint = non_transferable_project.authority == authority.key() @ crate::error::ErrorCode::Unauthorized
    )]
    pub non_transferable_project: Box<Account<'info, ProjectAccount>>,
}

/// Transfer authority (current admin only)
#[derive(Accounts)]
pub struct TransferAuthority<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        mut,
        constraint = non_transferable_project.authority == authority.key() @ crate::error::ErrorCode::Unauthorized
    )]
    pub non_transferable_project: Box<Account<'info, ProjectAccount>>,
}

/// Admin or Operator can perform this action
#[derive(Accounts)]
pub struct AdminOrOperatorAction<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        mut,
        constraint = non_transferable_project.is_admin_or_operator(&authority.key()) @ crate::error::ErrorCode::Unauthorized
    )]
    pub non_transferable_project: Box<Account<'info, ProjectAccount>>,
}

// ============================================
// Helper Functions
// ============================================

pub fn hash_seed(seed: &str) -> Vec<u8> {
    let mut hasher = Sha256::new();
    hasher.update(seed.as_bytes());
    hasher.finalize().to_vec()
}
