use anchor_lang::{
    prelude::*,
    solana_program::{program::invoke, system_instruction},
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
        bump = non_transferable_project.bump
    )]
    pub non_transferable_project: Box<Account<'info, ProjectAccount>>,

    /// 优化后的DID状态账户
    #[account(
        init_if_needed,
        payer = authority,
        space = DID_STATUS_SIZE,
        seeds = [
            DID_STATUS_PREFIX.as_bytes(),
            &hash_seed(&rns_id)[..32],
            wallet.key().as_ref()
        ],
        bump
    )]
    pub did_status: Box<Account<'info, DIDStatusAccount>>,

    /// CHECK: Fee recipient account
    #[account(mut)]
    pub fee_recipient: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn handler(ctx: Context<AuthorizeMintContext>, rns_id: String, wallet: Pubkey) -> Result<()> {
    let amount = ctx.accounts.non_transferable_project.mint_price;
    let fee_recipient = ctx.accounts.non_transferable_project.fee_recipient;

    // 检查fee_recipient是否正确
    if !ctx.accounts.fee_recipient.key().eq(&fee_recipient) {
        return err!(ErrorCode::InvalidFeeRecipient);
    }

    // 检查payer是否有足够的SOL
    if ctx.accounts.authority.lamports() < amount {
        return err!(ErrorCode::InsufficientBalance);
    }

    // 转账mint费用
    invoke(
        &system_instruction::transfer(
            &ctx.accounts.authority.key(),
            &ctx.accounts.fee_recipient.key(),
            amount,
        ),
        &[
            ctx.accounts.authority.to_account_info(),
            ctx.accounts.fee_recipient.clone(),
            ctx.accounts.system_program.to_account_info(),
        ],
    )?;

    let did_status = &mut ctx.accounts.did_status;

    // 检查是否已授权或已铸造
    require!(
        did_status.status == DIDStatus::Unauthorized as u8,
        ErrorCode::LDIDHasAuthorized
    );

    // 设置状态为已授权
    did_status.wallet = wallet;
    did_status.bump = ctx.bumps.did_status;
    did_status.set_status(DIDStatus::Authorized);

    emit!(AuthorizeMintEvent {
        rns_id: rns_id.clone(),
        wallet: wallet,
    });

    msg!(
        "RNSAddressAuthorized:_rnsId:{};_wallet:{};",
        rns_id,
        wallet
    );

    Ok(())
}
