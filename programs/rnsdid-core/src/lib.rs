use anchor_lang::prelude::*;

pub mod error;
pub mod instructions;
pub mod state;
pub mod utils;

use instructions::*;
use state::*;

declare_id!("JCo8dShYwHu74UpBTmwUcoEcGgWZQWnoTCvFaqjGJ6fc");

#[program]
pub mod rnsdid_core {
    use super::*;

    /// 初始化项目
    pub fn initialize(ctx: Context<Initialize>, args: InitializeArgs) -> Result<()> {
        initialize::handler(ctx, args)
    }

    /// 设置铸造价格
    pub fn set_mint_price(ctx: Context<SetMintPriceContext>, mint_price: u64) -> Result<()> {
        let project = &mut ctx.accounts.non_transferable_project;
        project.mint_price = mint_price;
        msg!(
            "SetMintPrice:collectionId:{}, price:{}",
            project.key(),
            project.mint_price
        );
        Ok(())
    }

    /// 设置Base URI
    pub fn set_base_uri(ctx: Context<SetBaseURI>, uri: String) -> Result<()> {
        let state = &mut ctx.accounts.non_transferable_project;
        state.base_uri = uri;
        Ok(())
    }

    /// 设置费用接收地址
    pub fn set_fee_recipient(ctx: Context<SetFeeRecipient>, fee_recipient: Pubkey) -> Result<()> {
        let state = &mut ctx.accounts.non_transferable_project;
        state.fee_recipient = fee_recipient;
        Ok(())
    }

    /// 空投/铸造 DID NFT (一步完成，merkle_root 存入元数据)
    pub fn airdrop(
        ctx: Context<MintNonTransferableNft>,
        rns_id: String,
        wallet: Pubkey,
        merkle_root: String,
        index: String,
    ) -> Result<()> {
        airdrop::handler(ctx, rns_id, wallet, merkle_root, index)
    }

    /// 用户主动销毁自己的DID
    pub fn burn(
        ctx: Context<BurnNonTransferableNft>,
        rns_id: String,
        index: String,
    ) -> Result<()> {
        burn::handler(ctx, rns_id, index)
    }

    /// 管理员撤销用户的DID
    pub fn revoke(
        ctx: Context<RevokeNonTransferableNft>,
        rns_id: String,
        wallet: Pubkey,
        index: String,
    ) -> Result<()> {
        revoke::handler(ctx, rns_id, wallet, index)
    }
}
