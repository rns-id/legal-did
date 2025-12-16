use anchor_lang::prelude::*;

pub mod error;
pub mod instructions;
pub mod state;
pub mod utils;

use instructions::*;
use state::*;
declare_id!("3WaA2C9VRHczjqcdVgWw8Ug2VfoCVbCzEp9bwPPG6Qj6");

#[program]
pub mod rnsdid_core {

  use super::*;

  pub fn initialize(
    ctx: Context<Initialize>,
    args: InitializeArgs,
  ) -> Result<()> {
    initialize::handler(ctx, args)
  }

  pub fn set_mint_price(ctx: Context<SetMintPriceContext>, mint_price: u64) -> Result<()> {
    let non_transferable_project = &mut ctx.accounts.non_transferable_project;

    non_transferable_project.mint_price = mint_price;

    msg!(
      "SetMintPrice:collectionId:{}, price:{}",
      non_transferable_project.to_account_info().key,
      non_transferable_project.mint_price.to_string()
    );

    Ok(())
  }

  pub fn set_base_uri(ctx: Context<SetBaseURI>, uri: String) -> Result<()> {
    let state = &mut ctx.accounts.non_transferable_project;
    state.base_uri = uri;
    Ok(())
  }

  pub fn set_fee_recipient(ctx: Context<SetFeeRecipient>, fee_recipient: Pubkey) -> Result<()> {
    let state = &mut ctx.accounts.non_transferable_project;
    state.fee_recipient = fee_recipient;
    Ok(())
  }

  pub fn set_is_blocked_address(
    ctx: Context<SetIsBlockedAddress>,
    wallet: Pubkey,
    is_blocked: bool,
  ) -> Result<()> {
    let state = &mut ctx.accounts.non_transferable_project;

    let mut found = false;
    for blocked_address in state.is_blocked_address.iter_mut() {
      if blocked_address.key == wallet {
        blocked_address.value = is_blocked;
        found = true;
        break;
      }
    }
    if !found {
      state.is_blocked_address.push(BlockedAddress {
        key: wallet,
        value: is_blocked,
      });
    }
    Ok(())
  }

  pub fn set_is_blocked_rns_id(
    ctx: Context<SetIsBlockedRnsID>,
    rns_id: String,
    is_blocked: bool,
  ) -> Result<()> {
    let state = &mut ctx.accounts.non_transferable_project;

    let mut found = false;
    for blocked_rns_id in state.is_blocked_rns_id.iter_mut() {
      if blocked_rns_id.key == rns_id {
        blocked_rns_id.value = is_blocked;
        found = true;
        break;
      }
    }

    if !found {
      state.is_blocked_rns_id.push(BlockedRnsID {key: rns_id, value: is_blocked});
    }

    Ok(())
  }

  pub fn set_merkle_root(ctx: Context<SetMerkleRoot>, rns_id: String, merkle_root: String) -> Result<()> {
    let status = &mut ctx.accounts.non_transferable_nft_status;
     require!(rns_id == status.rns_id, error::ErrorCode::RnsIsNotMatch);
    status.merkle_root = merkle_root;

    Ok(())
  }

  pub fn authorize_mint(ctx: Context<AuthorizeMintContext>, rns_id: String, wallet: Pubkey) -> Result<()> {
    authorize_mint::handler(ctx, rns_id, wallet)
  }

  pub fn airdrop(ctx: Context<MintNonTransferableNft>, rns_id: String, wallet: Pubkey, merkle_root: String, index: String) -> Result<()> {
    airdrop::handler(ctx, rns_id, wallet, merkle_root, index)
  }



  pub fn burn(ctx: Context<BurnNonTransferableNft>, rns_id: String, wallet: Pubkey) -> Result<()> {
    burn::handler(ctx, rns_id, wallet)
  }

  pub fn revoke(ctx: Context<RevokeNonTransferableNft>, rns_id: String, wallet: Pubkey) -> Result<()> {
    revoke::handler(ctx, rns_id, wallet)
  }

  pub fn cleanup(ctx: Context<CleanupRevokedNft>, rns_id: String, wallet: Pubkey) -> Result<()> {
    cleanup::handler(ctx, rns_id, wallet)
  }

}
