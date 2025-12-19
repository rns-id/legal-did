use anchor_lang::prelude::*;
use crate::state::*;
use crate::error::ErrorCode;

#[derive(Accounts)]
pub struct ManageOperator<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [ATTESTATION_CONFIG_PREFIX.as_bytes()],
        bump = config.bump,
        constraint = config.authority == authority.key() @ ErrorCode::Unauthorized
    )]
    pub config: Account<'info, AttestationConfig>,
}

pub fn add_handler(ctx: Context<ManageOperator>, operator: Pubkey) -> Result<()> {
    let config = &mut ctx.accounts.config;

    require!(
        config.operators.len() < MAX_OPERATORS,
        ErrorCode::MaxOperatorsReached
    );

    require!(
        !config.operators.contains(&operator),
        ErrorCode::OperatorAlreadyExists
    );

    config.operators.push(operator);

    emit!(OperatorAdded { operator });

    msg!("Operator added: {}", operator);

    Ok(())
}

pub fn remove_handler(ctx: Context<ManageOperator>, operator: Pubkey) -> Result<()> {
    let config = &mut ctx.accounts.config;

    let index = config
        .operators
        .iter()
        .position(|x| *x == operator)
        .ok_or(ErrorCode::OperatorNotFound)?;

    config.operators.remove(index);

    emit!(OperatorRemoved { operator });

    msg!("Operator removed: {}", operator);

    Ok(())
}
