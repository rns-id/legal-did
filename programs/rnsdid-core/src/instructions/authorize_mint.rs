use anchor_lang::{
    prelude::*,
    solana_program::{
        program::invoke,
        system_instruction,
    }
};

use crate::error::ErrorCode;
use crate::state::*;


#[event]
pub struct AuthorizeMintEvent {
    pub rns_id: String,
    pub wallet: Pubkey,
}

#[derive(Accounts)]
#[instruction(rns_id: String, wallet: Pubkey)]
pub struct AuthorizeMintContext<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [NON_TRANSFERABLE_PROJECT_PREFIX.as_bytes()],
        bump=non_transferable_project.bump
    )]
    pub non_transferable_project: Box<Account<'info, ProjectAccount>>,


    #[account(
        init_if_needed,
        payer = authority,
        space = 8 +
        32 +        // authority
        50 +        // rns_id
        1 +         // is_minted
        1 +         // is_authorized
        1,          // bump
        seeds = [
            NON_TRANSFERABLE_NFT_USERSTATUS_PREFIX.as_bytes(),
            &hash_seed(&rns_id)[..32],
            wallet.key().as_ref()
        ],
        bump
    )]
    pub non_transferable_user_status: Box<Account<'info, UserStatusAccount>>,

    /// CHECK: This is not dangerous because we don't read or write from this account
    #[account(mut)]
    pub fee_recipient: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn handler(
    ctx: Context<AuthorizeMintContext>,
    rns_id: String,
    _wallet: Pubkey
) -> Result<()> {

    let amount = ctx.accounts.non_transferable_project.mint_price;
    let fee_recipient = ctx.accounts.non_transferable_project.fee_recipient;

    /* check if the fee_recipient is correct */
    if !ctx.accounts.fee_recipient.to_account_info().key.eq(&fee_recipient) {
        return err!(ErrorCode::InvalidFeeRecipient);
    }

    /* check if the payer (authority) has enough SOL to pay the mint cost */
    if ctx.accounts.authority.lamports() < amount {
        return err!(ErrorCode::InsufficientBalance);
    }

    invoke(
        &system_instruction::transfer(
            &ctx.accounts.authority.key,
            &ctx.accounts.fee_recipient.key,
            amount,
        ),
        &[
            ctx.accounts.authority.to_account_info(),
            ctx.accounts.fee_recipient.clone(),
            ctx.accounts.system_program.to_account_info()
        ],
    )?;


    let status = &mut ctx.accounts.non_transferable_user_status;
    require!(!status.is_authorized, ErrorCode::LDIDHasAuthorized);

    status.authority = *ctx.accounts.authority.key;
    status.bump = ctx.bumps.non_transferable_user_status;
    status.is_authorized = true;

    emit!(AuthorizeMintEvent {
        rns_id: rns_id.clone(),
        wallet: ctx.accounts.authority.key()
    });

    msg!("RNSAddressAuthorized:_rnsId:{};_wallet:{};", rns_id.clone(), ctx.accounts.authority.key() );

    Ok(())
}
