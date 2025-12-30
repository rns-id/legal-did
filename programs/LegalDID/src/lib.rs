use anchor_lang::prelude::*;

pub mod error;
pub mod instructions;
pub mod state;
pub mod utils;

use instructions::*;
use state::*;

declare_id!("JCo8dShYwHu74UpBTmwUcoEcGgWZQWnoTCvFaqjGJ6fc");

#[program]
pub mod legaldid {
    use super::*;

    /// Initialize project
    pub fn initialize(ctx: Context<Initialize>, args: InitializeArgs) -> Result<()> {
        initialize::handler(ctx, args)
    }

    /// Set mint price
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

    /// Set Base URI
    pub fn set_base_uri(ctx: Context<SetBaseURI>, uri: String) -> Result<()> {
        let state = &mut ctx.accounts.non_transferable_project;
        state.base_uri = uri;
        Ok(())
    }

    /// Set fee recipient (admin only)
    pub fn set_fee_recipient(ctx: Context<SetFeeRecipient>, fee_recipient: Pubkey) -> Result<()> {
        let state = &mut ctx.accounts.non_transferable_project;
        state.fee_recipient = fee_recipient;
        Ok(())
    }

    /// Add operator (admin only)
    pub fn add_operator(ctx: Context<ManageOperator>, operator: Pubkey) -> Result<()> {
        let project = &mut ctx.accounts.non_transferable_project;
        require!(
            project.operators.len() < MAX_OPERATORS,
            error::ErrorCode::MaxOperatorsReached
        );
        require!(
            !project.operators.contains(&operator),
            error::ErrorCode::OperatorAlreadyExists
        );
        project.operators.push(operator);
        msg!("Operator added: {}", operator);
        Ok(())
    }

    /// Remove operator (admin only)
    pub fn remove_operator(ctx: Context<ManageOperator>, operator: Pubkey) -> Result<()> {
        let project = &mut ctx.accounts.non_transferable_project;
        let index = project
            .operators
            .iter()
            .position(|x| *x == operator)
            .ok_or(error::ErrorCode::OperatorNotFound)?;
        project.operators.remove(index);
        msg!("Operator removed: {}", operator);
        Ok(())
    }

    /// User pays to request DID mint (emits event, backend reviews and mints)
    pub fn authorize_mint(
        ctx: Context<AuthorizeMint>,
        rns_id: String,
        index: String,
    ) -> Result<()> {
        authorize_mint::handler(ctx, rns_id, index)
    }

    pub fn airdrop(
        ctx: Context<MintNonTransferableNft>,
        rns_id: String,
        wallet: Pubkey,
        merkle_root: String,
        index: String,
    ) -> Result<()> {
        airdrop::handler(ctx, rns_id, wallet, merkle_root, index)
    }

    /// User voluntarily burns their own DID
    pub fn burn(
        ctx: Context<BurnNonTransferableNft>,
        rns_id: String,
        index: String,
    ) -> Result<()> {
        burn::handler(ctx, rns_id, index)
    }

}
