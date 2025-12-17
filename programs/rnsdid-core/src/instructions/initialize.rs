use anchor_lang::prelude::*;
use anchor_lang::solana_program::program::invoke_signed;
use anchor_spl::token_interface::TokenInterface;
use spl_token_2022::extension::ExtensionType;
use spl_token_2022::state::Mint as MintState;

use crate::state::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Default)]
pub struct InitializeArgs {
    pub name: String,
    pub symbol: String,
    pub base_uri: String,
}

#[derive(Accounts)]
#[instruction(args: InitializeArgs)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = NON_TRANSFERABLE_PROJECT_SIZE,
        seeds = [NON_TRANSFERABLE_PROJECT_PREFIX.as_bytes()],
        bump
    )]
    pub non_transferable_project: Box<Account<'info, ProjectAccount>>,

    /// CHECK: Token-2022 Mint账户，需要手动初始化扩展
    #[account(
        mut,
        seeds = [NON_TRANSFERABLE_PROJECT_MINT_PREFIX.as_bytes()],
        bump,
    )]
    pub non_transferable_project_mint: UncheckedAccount<'info>,

    /// Token-2022 程序
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn handler(ctx: Context<Initialize>, args: InitializeArgs) -> Result<()> {
    let non_transferable_project = &mut ctx.accounts.non_transferable_project;

    non_transferable_project.mint_price = 100;
    non_transferable_project.authority = ctx.accounts.authority.key();
    non_transferable_project.fee_recipient = ctx.accounts.authority.key(); // 默认设置为 authority
    non_transferable_project.bump = ctx.bumps.non_transferable_project;
    non_transferable_project.mint_bump = ctx.bumps.non_transferable_project_mint;

    non_transferable_project.name = args.name.clone();
    non_transferable_project.symbol = args.symbol.clone();
    non_transferable_project.base_uri = args.base_uri.clone();

    // 计算 Token-2022 Mint 所需空间（带扩展）
    let extensions = [
        ExtensionType::NonTransferable,
        ExtensionType::PermanentDelegate,
    ];
    let mint_space = ExtensionType::try_calculate_account_len::<MintState>(&extensions).unwrap();

    let rent = Rent::get()?;
    let mint_rent = rent.minimum_balance(mint_space);

    let mint_signer_seeds: &[&[u8]] = &[
        NON_TRANSFERABLE_PROJECT_MINT_PREFIX.as_bytes(),
        &[non_transferable_project.mint_bump],
    ];

    // 1. 创建 Mint 账户
    let create_account_ix = anchor_lang::solana_program::system_instruction::create_account(
        &ctx.accounts.authority.key(),
        &ctx.accounts.non_transferable_project_mint.key(),
        mint_rent,
        mint_space as u64,
        &ctx.accounts.token_program.key(),
    );

    invoke_signed(
        &create_account_ix,
        &[
            ctx.accounts.authority.to_account_info(),
            ctx.accounts.non_transferable_project_mint.to_account_info(),
            ctx.accounts.system_program.to_account_info(),
        ],
        &[mint_signer_seeds],
    )?;

    // 2. 初始化 NonTransferable 扩展
    let init_non_transferable_ix = spl_token_2022::instruction::initialize_non_transferable_mint(
        &ctx.accounts.token_program.key(),
        &ctx.accounts.non_transferable_project_mint.key(),
    )?;

    invoke_signed(
        &init_non_transferable_ix,
        &[ctx.accounts.non_transferable_project_mint.to_account_info()],
        &[mint_signer_seeds],
    )?;

    // 3. 初始化 PermanentDelegate 扩展（项目账户作为永久代理）
    let init_permanent_delegate_ix = spl_token_2022::instruction::initialize_permanent_delegate(
        &ctx.accounts.token_program.key(),
        &ctx.accounts.non_transferable_project_mint.key(),
        &ctx.accounts.non_transferable_project.key(),
    )?;

    invoke_signed(
        &init_permanent_delegate_ix,
        &[ctx.accounts.non_transferable_project_mint.to_account_info()],
        &[mint_signer_seeds],
    )?;

    // 4. 初始化 Mint
    let init_mint_ix = spl_token_2022::instruction::initialize_mint2(
        &ctx.accounts.token_program.key(),
        &ctx.accounts.non_transferable_project_mint.key(),
        &ctx.accounts.non_transferable_project.key(), // mint_authority
        None,                                          // freeze_authority - NonTransferable 不需要
        0,                                             // decimals
    )?;

    invoke_signed(
        &init_mint_ix,
        &[ctx.accounts.non_transferable_project_mint.to_account_info()],
        &[mint_signer_seeds],
    )?;

    msg!("Project initialized with Token-2022");
    msg!("Name: {}", args.name);
    msg!("Symbol: {}", args.symbol);
    msg!("Base URI: {}", args.base_uri);
    msg!("Extensions: NonTransferable, PermanentDelegate");

    Ok(())
}
