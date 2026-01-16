use anchor_lang::prelude::*;

pub mod error;
pub mod instructions;
pub mod state;
pub mod utils;

use instructions::*;
use state::*;

// Current devnet program ID - will be replaced with new mainnet ID during deployment
declare_id!("BE6yuzEjzapwBEQ9RoAFzG72XZzb17JuWWqhecFHdEQa");

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
    /// @deprecated Use set_destination instead
    pub fn set_fee_recipient(ctx: Context<SetFeeRecipient>, fee_recipient: Pubkey) -> Result<()> {
        let state = &mut ctx.accounts.non_transferable_project;
        state.destination = fee_recipient;
        Ok(())
    }

    /// Set fund destination address (admin only)
    pub fn set_fund_destination(ctx: Context<SetFundDestination>, destination: Pubkey) -> Result<()> {
        let state = &mut ctx.accounts.non_transferable_project;
        state.destination = destination;
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
        order_id: String,
    ) -> Result<()> {
        authorize_mint::handler(ctx, order_id)
    }

    pub fn airdrop(
        ctx: Context<MintNonTransferableNft>,
        order_id: String,
        wallet: Pubkey,
        merkle_root: String,
    ) -> Result<()> {
        airdrop::handler(ctx, order_id, wallet, merkle_root)
    }

    /// User voluntarily burns their own DID
    /// Uses mint address directly - no order_id needed since mint is already known
    pub fn burn(ctx: Context<BurnNonTransferableNft>) -> Result<()> {
        burn::handler(ctx)
    }

    /// Withdraw accumulated fees to fee_recipient (admin only)
    pub fn withdraw(ctx: Context<Withdraw>) -> Result<()> {
        withdraw::handler(ctx)
    }

    /// Transfer authority to new admin (current admin only)
    pub fn transfer_authority(ctx: Context<TransferAuthority>, new_authority: Pubkey) -> Result<()> {
        let project = &mut ctx.accounts.non_transferable_project;
        let old_authority = project.authority;
        project.authority = new_authority;
        
        msg!("Authority transferred from {} to {}", old_authority, new_authority);
        Ok(())
    }

}
