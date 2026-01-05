use anchor_lang::prelude::*;
use anchor_lang::solana_program::program::invoke_signed;
use anchor_spl::token_interface::TokenInterface;
use spl_token_2022::extension::group_pointer::instruction::initialize as init_group_pointer;
use spl_token_2022::extension::metadata_pointer::instruction::initialize as init_metadata_pointer;
use spl_token_2022::extension::ExtensionType;
use spl_token_2022::state::Mint as MintState;
use spl_token_group_interface::instruction::initialize_group;
use spl_token_metadata_interface::instruction::initialize as init_token_metadata;

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

    /// CHECK: Token-2022 Mint account, requires manual extension initialization
    #[account(
        mut,
        seeds = [NON_TRANSFERABLE_PROJECT_MINT_PREFIX.as_bytes()],
        bump,
    )]
    pub non_transferable_project_mint: UncheckedAccount<'info>,

    /// Token-2022 program
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn handler(ctx: Context<Initialize>, args: InitializeArgs) -> Result<()> {
    let non_transferable_project = &mut ctx.accounts.non_transferable_project;

    non_transferable_project.mint_price = 100;
    non_transferable_project.authority = ctx.accounts.authority.key();
    non_transferable_project.destination = ctx.accounts.authority.key(); // Default to authority
    non_transferable_project.bump = ctx.bumps.non_transferable_project;
    non_transferable_project.mint_bump = ctx.bumps.non_transferable_project_mint;
    non_transferable_project.last_token_id = 0; // Initialize to 0, first token will be 1

    non_transferable_project.name = args.name.clone();
    non_transferable_project.symbol = args.symbol.clone();
    non_transferable_project.base_uri = args.base_uri.clone();
    non_transferable_project.operators = vec![]; // Initialize empty operator list

    // Calculate Token-2022 Mint required space (with extensions)
    // Add GroupPointer + MetadataPointer extensions for Collection functionality
    let extensions = [
        ExtensionType::NonTransferable,
        ExtensionType::PermanentDelegate,
        ExtensionType::GroupPointer,
        ExtensionType::MetadataPointer,
    ];
    let base_space = ExtensionType::try_calculate_account_len::<MintState>(&extensions).unwrap();
    
    // Group data space (TokenGroup TLV)
    // Type(2) + Length(2) + update_authority(32) + mint(32) + size(8) + max_size(8) = 84
    let group_space = 84;
    
    // Collection Metadata space calculation
    // Fixed part: update_authority(33) + mint(32) + name_len(4) + symbol_len(4) + uri_len(4) = 77
    // Dynamic part: name + symbol + uri
    let metadata_space = 77 + args.name.len() + args.symbol.len() + args.base_uri.len() + 4; // +4 for TLV header
    
    let mint_space = base_space + group_space + metadata_space;

    let rent = Rent::get()?;
    let mint_rent = rent.minimum_balance(mint_space);
    
    msg!("Collection Mint space: base={}, group={}, total={}", base_space, group_space, mint_space);

    let mint_signer_seeds: &[&[u8]] = &[
        NON_TRANSFERABLE_PROJECT_MINT_PREFIX.as_bytes(),
        &[non_transferable_project.mint_bump],
    ];

    let project_signer_seeds: &[&[u8]] = &[
        NON_TRANSFERABLE_PROJECT_PREFIX.as_bytes(),
        &[non_transferable_project.bump],
    ];

    // 1. Create Mint account (use base_space first, metadata and group will auto realloc)
    // But need to prepay full rent
    let create_account_ix = anchor_lang::solana_program::system_instruction::create_account(
        &ctx.accounts.authority.key(),
        &ctx.accounts.non_transferable_project_mint.key(),
        mint_rent,
        base_space as u64,
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

    // 2. Initialize NonTransferable extension
    let init_non_transferable_ix = spl_token_2022::instruction::initialize_non_transferable_mint(
        &ctx.accounts.token_program.key(),
        &ctx.accounts.non_transferable_project_mint.key(),
    )?;

    invoke_signed(
        &init_non_transferable_ix,
        &[ctx.accounts.non_transferable_project_mint.to_account_info()],
        &[mint_signer_seeds],
    )?;

    // 3. Initialize PermanentDelegate extension (project account as permanent delegate)
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

    // 4. Initialize GroupPointer extension (points to self as Group)
    invoke_signed(
        &init_group_pointer(
            &ctx.accounts.token_program.key(),
            &ctx.accounts.non_transferable_project_mint.key(),
            Some(ctx.accounts.non_transferable_project.key()),
            Some(ctx.accounts.non_transferable_project_mint.key()),
        )?,
        &[ctx.accounts.non_transferable_project_mint.to_account_info()],
        &[mint_signer_seeds],
    )?;

    // 5. Initialize MetadataPointer extension (points to self for metadata storage)
    invoke_signed(
        &init_metadata_pointer(
            &ctx.accounts.token_program.key(),
            &ctx.accounts.non_transferable_project_mint.key(),
            Some(ctx.accounts.non_transferable_project.key()),
            Some(ctx.accounts.non_transferable_project_mint.key()),
        )?,
        &[ctx.accounts.non_transferable_project_mint.to_account_info()],
        &[mint_signer_seeds],
    )?;

    // 6. Initialize Mint
    let init_mint_ix = spl_token_2022::instruction::initialize_mint2(
        &ctx.accounts.token_program.key(),
        &ctx.accounts.non_transferable_project_mint.key(),
        &ctx.accounts.non_transferable_project.key(), // mint_authority
        None,                                          // freeze_authority - not needed for NonTransferable
        0,                                             // decimals
    )?;

    invoke_signed(
        &init_mint_ix,
        &[ctx.accounts.non_transferable_project_mint.to_account_info()],
        &[mint_signer_seeds],
    )?;

    // 6.5 Transfer extra rent for metadata and group realloc
    let extra_rent = rent.minimum_balance(mint_space) - rent.minimum_balance(base_space);
    if extra_rent > 0 {
        let transfer_ix = anchor_lang::solana_program::system_instruction::transfer(
            &ctx.accounts.authority.key(),
            &ctx.accounts.non_transferable_project_mint.key(),
            extra_rent,
        );
        anchor_lang::solana_program::program::invoke(
            &transfer_ix,
            &[
                ctx.accounts.authority.to_account_info(),
                ctx.accounts.non_transferable_project_mint.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
        )?;
    }

    // 7. Initialize Collection Metadata
    invoke_signed(
        &init_token_metadata(
            &ctx.accounts.token_program.key(),
            &ctx.accounts.non_transferable_project_mint.key(),
            &ctx.accounts.non_transferable_project.key(),
            &ctx.accounts.non_transferable_project_mint.key(),
            &ctx.accounts.non_transferable_project.key(),
            args.name.clone(),
            args.symbol.clone(),
            args.base_uri.clone(),
        ),
        &[
            ctx.accounts.non_transferable_project_mint.to_account_info(),
            ctx.accounts.non_transferable_project.to_account_info(),
        ],
        &[project_signer_seeds],
    )?;

    // 8. Initialize Group (Collection)
    invoke_signed(
        &initialize_group(
            &ctx.accounts.token_program.key(),
            &ctx.accounts.non_transferable_project_mint.key(),
            &ctx.accounts.non_transferable_project_mint.key(),
            &ctx.accounts.non_transferable_project.key(),
            Some(ctx.accounts.non_transferable_project.key()),
            u64::MAX, // max_size - unlimited
        ),
        &[
            ctx.accounts.non_transferable_project_mint.to_account_info(),
            ctx.accounts.non_transferable_project.to_account_info(),
        ],
        &[project_signer_seeds],
    )?;

    msg!("Project initialized with Token-2022");
    msg!("Name: {}", args.name);
    msg!("Symbol: {}", args.symbol);
    msg!("Base URI: {}", args.base_uri);
    msg!("Collection Mint: {}", ctx.accounts.non_transferable_project_mint.key());
    msg!("Extensions: NonTransferable, PermanentDelegate, GroupPointer, MetadataPointer");

    Ok(())
}
