use anchor_lang::prelude::*;
use sha2::{Digest, Sha256};

// ============================================
// Constants
// ============================================
pub const NON_TRANSFERABLE_PROJECT_PREFIX: &str = "nt-proj-v3";
pub const NON_TRANSFERABLE_PROJECT_MINT_PREFIX: &str = "nt-project-mint-v3";
pub const NON_TRANSFERABLE_NFT_MINT_PREFIX: &str = "nt-nft-mint-v3";

// 优化后的单一状态账户前缀
pub const DID_STATUS_PREFIX: &str = "did-status-v3";

// Project账户大小
pub const NON_TRANSFERABLE_PROJECT_SIZE: usize = 8 +   // discriminator
    32 +    // authority
    8 +     // mint_price
    32 +    // fee_recipient
    1 +     // bump
    1 +     // mint_bump
    100 +   // name
    100 +   // symbol
    200 +   // base_uri
    1650 +  // is_blocked_address (Vec<BlockedAddress>)
    1650;   // is_blocked_rns_id (Vec<BlockedRnsID>)

// 优化后的DID状态账户大小
pub const DID_STATUS_SIZE: usize = 8 +    // discriminator
    32 +    // wallet
    32 +    // mint
    32 +    // merkle_root (改为[u8;32])
    1 +     // status (0=未授权, 1=已授权, 2=已铸造, 3=已撤销)
    1;      // bump
// 总计: 106 bytes → ~$0.15

// Token-2022 Mint 空间 (带 NonTransferable + PermanentDelegate 扩展)
// 基础 Mint: 82 bytes
// NonTransferable: 1 byte
// PermanentDelegate: 33 bytes (1 + 32)
// 扩展头: 每个扩展 2 bytes
// 账户类型: 1 byte
pub const TOKEN2022_MINT_SIZE: usize = 234;

// ============================================
// Structs
// ============================================
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Default)]
pub struct BlockedAddress {
    pub key: Pubkey,
    pub value: bool,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Default)]
pub struct BlockedRnsID {
    pub key: String,
    pub value: bool,
}

// ============================================
// DID Status 枚举
// ============================================
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Default)]
#[repr(u8)]
pub enum DIDStatus {
    #[default]
    Unauthorized = 0,   // 未授权
    Authorized = 1,     // 已授权，待铸造
    Minted = 2,         // 已铸造
    Revoked = 3,        // 已撤销
}

impl From<u8> for DIDStatus {
    fn from(value: u8) -> Self {
        match value {
            0 => DIDStatus::Unauthorized,
            1 => DIDStatus::Authorized,
            2 => DIDStatus::Minted,
            3 => DIDStatus::Revoked,
            _ => DIDStatus::Unauthorized,
        }
    }
}

// ============================================
// Accounts
// ============================================

/// 项目配置账户
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
    pub is_blocked_address: Vec<BlockedAddress>,
    pub is_blocked_rns_id: Vec<BlockedRnsID>,
}

impl ProjectAccount {
    pub fn is_blocked_address(&self, address: Pubkey) -> bool {
        self.is_blocked_address
            .iter()
            .any(|pair| pair.key == address && pair.value)
    }

    pub fn is_blocked_rns_id(&self, rns_id: &str) -> bool {
        self.is_blocked_rns_id
            .iter()
            .any(|pair| pair.key == rns_id && pair.value)
    }
}

/// 优化后的DID状态账户 - 合并了原来的3个账户
/// Seeds: [DID_STATUS_PREFIX, hash(rns_id), wallet]
#[account]
#[derive(Default)]
pub struct DIDStatusAccount {
    pub wallet: Pubkey,           // 32 bytes - 持有者钱包
    pub mint: Pubkey,             // 32 bytes - NFT mint地址
    pub merkle_root: [u8; 32],    // 32 bytes - merkle root hash
    pub status: u8,               // 1 byte - DID状态
    pub bump: u8,                 // 1 byte
}

impl DIDStatusAccount {
    pub fn get_status(&self) -> DIDStatus {
        DIDStatus::from(self.status)
    }

    pub fn set_status(&mut self, status: DIDStatus) {
        self.status = status as u8;
    }

    pub fn is_authorized(&self) -> bool {
        self.status == DIDStatus::Authorized as u8
    }

    pub fn is_minted(&self) -> bool {
        self.status == DIDStatus::Minted as u8
    }

    pub fn is_revoked(&self) -> bool {
        self.status == DIDStatus::Revoked as u8
    }
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
pub struct SetIsBlockedAddress<'info> {
    #[account(mut, has_one = authority)]
    pub non_transferable_project: Box<Account<'info, ProjectAccount>>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct SetIsBlockedRnsID<'info> {
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
