use anchor_lang::prelude::*;
use sha2::{Digest, Sha256};

// ============================================
// Constants
// ============================================
pub const NON_TRANSFERABLE_PROJECT_PREFIX: &str = "nt-proj-v5";
pub const NON_TRANSFERABLE_PROJECT_MINT_PREFIX: &str = "nt-project-mint-v5";
pub const NON_TRANSFERABLE_NFT_MINT_PREFIX: &str = "nt-nft-mint-v5";

// Project账户大小 (优化后)
pub const NON_TRANSFERABLE_PROJECT_SIZE: usize = 8 +   // discriminator
    32 +    // authority
    8 +     // mint_price
    32 +    // fee_recipient
    1 +     // bump
    1 +     // mint_bump
    100 +   // name
    100 +   // symbol
    200;    // base_uri

// Token-2022 Mint 空间 (带 NonTransferable + PermanentDelegate 扩展)
// 基础 Mint: 82 bytes
// NonTransferable: 1 byte
// PermanentDelegate: 33 bytes (1 + 32)
// 扩展头: 每个扩展 2 bytes
// 账户类型: 1 byte
pub const TOKEN2022_MINT_SIZE: usize = 234;





// ============================================
// Accounts
// ============================================

/// 项目配置账户 (移除黑名单功能)
#[account]
#[derive(Default)]
pub struct ProjectAccount {
    pub authority: Pubkey,
    pub mint_price: u64,
    pub fee_recipient: Pubkey,
    pub bump: u8,
    pub mint_bump: u8,
    pub name: String,
    pub symbol: String,
    pub base_uri: String,
}



// ============================================
// Instruction Contexts (保留兼容性)
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
pub struct SetMintPriceContext<'info> {
    #[account()]
    pub authority: Signer<'info>,
    #[account(mut, has_one = authority)]
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
