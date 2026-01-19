use anchor_lang::prelude::*;
use anchor_lang::solana_program::program::invoke_signed;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token_interface::TokenInterface;
use spl_token_2022::extension::group_member_pointer::instruction::initialize as init_group_member_pointer;
use spl_token_2022::extension::metadata_pointer::instruction::initialize as init_metadata_pointer;
use spl_token_2022::extension::ExtensionType;
use spl_token_2022::instruction::initialize_mint_close_authority;
use spl_token_group_interface::instruction::initialize_member;
use spl_token_metadata_interface::instruction::initialize as init_token_metadata;
use spl_token_metadata_interface::state::TokenMetadata;

use crate::state::*;

#[event]
pub struct AirdropV4 {
    pub order_id: String,       // Business tracking and PDA seed
    pub wallet: Pubkey,
    pub mint: Pubkey,
    pub merkle_root: String,
}

#[derive(Accounts)]
#[instruction(order_id: String, wallet: Pubkey, merkle_root: String)]
pub struct MintNonTransferableNft<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        mut,
        constraint = non_transferable_project.is_admin_or_operator(&authority.key()) @ crate::error::ErrorCode::Unauthorized,
        seeds = [NON_TRANSFERABLE_PROJECT_PREFIX.as_bytes()],
        bump = non_transferable_project.bump
    )]
    pub non_transferable_project: Box<Account<'info, ProjectAccount>>,

    /// CHECK: Token-2022 NFT Mint account, requires manual extension initialization
    /// Uses order_id as PDA seed
    #[account(mut)]
    pub non_transferable_nft_mint: UncheckedAccount<'info>,

    /// CHECK: User account
    #[account(mut)]
    pub user_account: UncheckedAccount<'info>,

    /// CHECK: User's Token-2022 ATA
    #[account(mut)]
    pub user_token_account: UncheckedAccount<'info>,

    /// CHECK: Collection Mint (Group)
    #[account(
        mut,
        seeds = [NON_TRANSFERABLE_PROJECT_MINT_PREFIX.as_bytes()],
        bump = non_transferable_project.mint_bump,
    )]
    pub collection_mint: UncheckedAccount<'info>,

    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn handler(
    ctx: Context<MintNonTransferableNft>,
    order_id: String,
    wallet: Pubkey,
    merkle_root: String,
) -> Result<()> {
    let project = &mut ctx.accounts.non_transferable_project;
    
    let project_bump = project.bump;
    let project_signer_seeds: &[&[u8]] = &[
        NON_TRANSFERABLE_PROJECT_PREFIX.as_bytes(),
        &[project_bump],
    ];

    // Use order_id hash as PDA seed (to support long order IDs like UUIDs)
    let order_id_hash = crate::state::hash_seed(&order_id);
    let (expected_mint, mint_bump) = Pubkey::find_program_address(
        &[NON_TRANSFERABLE_NFT_MINT_PREFIX.as_bytes(), &order_id_hash],
        ctx.program_id,
    );
    
    // Verify the provided mint account matches expected PDA
    require!(
        ctx.accounts.non_transferable_nft_mint.key() == expected_mint,
        crate::error::ErrorCode::InvalidMintAccount
    );
    
    let mint_signer_seeds: &[&[u8]] = &[
        NON_TRANSFERABLE_NFT_MINT_PREFIX.as_bytes(),
        &order_id_hash,
        &[mint_bump],
    ];

    let rent = Rent::get()?;

    // Metadata info - merkle_root as part of URI
    let metadata_uri = format!("{}{}.json", project.base_uri, merkle_root);
    let name = format!("LDID #{}", order_id);  // Use order_id in name
    let symbol = project.symbol.clone();

    // 1. Create Token-2022 NFT Mint (if not exists)
    require!(
        ctx.accounts.non_transferable_nft_mint.data_is_empty(),
        crate::error::ErrorCode::LDIDHasMinted
    );

    msg!("Creating Token-2022 NFT Mint with NonTransferable + PermanentDelegate + MetadataPointer + MintCloseAuthority");

    let metadata = TokenMetadata {
        update_authority: Some(ctx.accounts.non_transferable_project.key())
            .try_into()
            .unwrap(),
        mint: ctx.accounts.non_transferable_nft_mint.key(),
        name: name.clone(),
        symbol: symbol.clone(),
        uri: metadata_uri.clone(),
        additional_metadata: vec![],
    };
    let metadata_space = metadata
        .tlv_size_of()
        .map_err(|_| crate::error::ErrorCode::InvalidAccountData)?;

    let extension_types = &[
        ExtensionType::NonTransferable,
        ExtensionType::PermanentDelegate,
        ExtensionType::MetadataPointer,
        ExtensionType::MintCloseAuthority,
        ExtensionType::GroupMemberPointer,
    ];
    
    // GroupMember data space
    let group_member_space = 68; // mint(32) + group(32) + member_number(4)

    let base_space =
        ExtensionType::try_calculate_account_len::<spl_token_2022::state::Mint>(extension_types)
            .map_err(|_| crate::error::ErrorCode::InvalidAccountData)?;

    let total_space = base_space + metadata_space + group_member_space;
    let total_rent = rent.minimum_balance(total_space);

    msg!(
        "Space: base={}, metadata={}, total={}",
        base_space,
        metadata_space,
        total_space
    );

    // Step 1: Create account
    invoke_signed(
        &anchor_lang::solana_program::system_instruction::create_account(
            &ctx.accounts.authority.key(),
            &ctx.accounts.non_transferable_nft_mint.key(),
            total_rent,
            base_space as u64,
            &ctx.accounts.token_program.key(),
        ),
        &[
            ctx.accounts.authority.to_account_info(),
            ctx.accounts.non_transferable_nft_mint.to_account_info(),
            ctx.accounts.system_program.to_account_info(),
        ],
        &[mint_signer_seeds],
    )?;

    // Step 2: Initialize extensions in discriminant order
    invoke_signed(
        &spl_token_2022::instruction::initialize_non_transferable_mint(
            &ctx.accounts.token_program.key(),
            &ctx.accounts.non_transferable_nft_mint.key(),
        )?,
        &[ctx.accounts.non_transferable_nft_mint.to_account_info()],
        &[mint_signer_seeds],
    )?;

    invoke_signed(
        &spl_token_2022::instruction::initialize_permanent_delegate(
            &ctx.accounts.token_program.key(),
            &ctx.accounts.non_transferable_nft_mint.key(),
            &ctx.accounts.non_transferable_project.key(),
        )?,
        &[ctx.accounts.non_transferable_nft_mint.to_account_info()],
        &[mint_signer_seeds],
    )?;

    invoke_signed(
        &init_metadata_pointer(
            &ctx.accounts.token_program.key(),
            &ctx.accounts.non_transferable_nft_mint.key(),
            Some(ctx.accounts.non_transferable_project.key()),
            Some(ctx.accounts.non_transferable_nft_mint.key()),
        )?,
        &[ctx.accounts.non_transferable_nft_mint.to_account_info()],
        &[mint_signer_seeds],
    )?;

    // MintCloseAuthority - allows closing Mint account to recover rent
    invoke_signed(
        &initialize_mint_close_authority(
            &ctx.accounts.token_program.key(),
            &ctx.accounts.non_transferable_nft_mint.key(),
            Some(&ctx.accounts.non_transferable_project.key()),
        )?,
        &[ctx.accounts.non_transferable_nft_mint.to_account_info()],
        &[mint_signer_seeds],
    )?;

    // GroupMemberPointer - points to self as Member
    invoke_signed(
        &init_group_member_pointer(
            &ctx.accounts.token_program.key(),
            &ctx.accounts.non_transferable_nft_mint.key(),
            Some(ctx.accounts.non_transferable_project.key()),
            Some(ctx.accounts.non_transferable_nft_mint.key()),
        )?,
        &[ctx.accounts.non_transferable_nft_mint.to_account_info()],
        &[mint_signer_seeds],
    )?;

    // Step 3: InitializeMint2
    invoke_signed(
        &spl_token_2022::instruction::initialize_mint2(
            &ctx.accounts.token_program.key(),
            &ctx.accounts.non_transferable_nft_mint.key(),
            &ctx.accounts.non_transferable_project.key(),
            None,
            0,
        )?,
        &[ctx.accounts.non_transferable_nft_mint.to_account_info()],
        &[mint_signer_seeds],
    )?;

    invoke_signed(
        &init_token_metadata(
            &ctx.accounts.token_program.key(),
            &ctx.accounts.non_transferable_nft_mint.key(),
            &ctx.accounts.non_transferable_project.key(),
            &ctx.accounts.non_transferable_nft_mint.key(),
            &ctx.accounts.non_transferable_project.key(),
            name.clone(),
            symbol.clone(),
            metadata_uri.clone(),
        ),
        &[
            ctx.accounts.non_transferable_nft_mint.to_account_info(),
            ctx.accounts.non_transferable_project.to_account_info(),
        ],
        &[project_signer_seeds],
    )?;

    // Step 6: Initialize GroupMember (join Collection)
    invoke_signed(
        &initialize_member(
            &ctx.accounts.token_program.key(),
            &ctx.accounts.non_transferable_nft_mint.key(),  // member mint
            &ctx.accounts.non_transferable_nft_mint.key(),  // member mint (points to self)
            &ctx.accounts.non_transferable_project.key(),   // member mint authority
            &ctx.accounts.collection_mint.key(),            // group mint
            &ctx.accounts.non_transferable_project.key(),   // group update authority
        ),
        &[
            ctx.accounts.non_transferable_nft_mint.to_account_info(),
            ctx.accounts.collection_mint.to_account_info(),
            ctx.accounts.non_transferable_project.to_account_info(),
        ],
        &[project_signer_seeds],
    )?;

    msg!("NFT Mint created with merkle_root in metadata, joined Collection");

    // 2. Create user's Token-2022 ATA (if not exists)
    if ctx.accounts.user_token_account.data_is_empty() {
        msg!("Creating Token-2022 ATA for user");

        let create_ata_ix =
            spl_associated_token_account::instruction::create_associated_token_account(
                &ctx.accounts.authority.key(),
                &ctx.accounts.user_account.key(),
                &ctx.accounts.non_transferable_nft_mint.key(),
                &ctx.accounts.token_program.key(),
            );

        anchor_lang::solana_program::program::invoke(
            &create_ata_ix,
            &[
                ctx.accounts.authority.to_account_info(),
                ctx.accounts.user_token_account.to_account_info(),
                ctx.accounts.user_account.to_account_info(),
                ctx.accounts.non_transferable_nft_mint.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
                ctx.accounts.token_program.to_account_info(),
            ],
        )?;
    }

    // 3. Mint NFT to user account
    msg!("Minting Token-2022 NFT to user");
    let mint_to_ix = spl_token_2022::instruction::mint_to(
        &ctx.accounts.token_program.key(),
        &ctx.accounts.non_transferable_nft_mint.key(),
        &ctx.accounts.user_token_account.key(),
        &ctx.accounts.non_transferable_project.key(),
        &[],
        1,
    )?;

    invoke_signed(
        &mint_to_ix,
        &[
            ctx.accounts.non_transferable_nft_mint.to_account_info(),
            ctx.accounts.user_token_account.to_account_info(),
            ctx.accounts.non_transferable_project.to_account_info(),
        ],
        &[project_signer_seeds],
    )?;

    msg!("NFT minted successfully (NonTransferable, merkle_root in metadata)");
    msg!("Order ID: {}", order_id);
    
    // 输出格式化的事件日志，方便后端解析
    msg!(
        "AirdropV4:orderId:{};wallet:{};mint:{};merkleRoot:{};",
        order_id,
        wallet,
        ctx.accounts.non_transferable_nft_mint.key(),
        merkle_root
    );

    emit!(AirdropV4 {
        order_id: order_id.clone(),
        wallet,
        mint: ctx.accounts.non_transferable_nft_mint.key(),
        merkle_root: merkle_root.clone(),
    });

    Ok(())
}
