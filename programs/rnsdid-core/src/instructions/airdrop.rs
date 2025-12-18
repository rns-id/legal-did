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
pub struct AirdropEvent {
    pub rns_id: String,
    pub wallet: Pubkey,
    pub mint: Pubkey,
}

#[derive(Accounts)]
#[instruction(rns_id: String, wallet: Pubkey, merkle_root: String, index: String)]
pub struct MintNonTransferableNft<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        mut,
        constraint = non_transferable_project.authority == authority.key(),
        seeds = [NON_TRANSFERABLE_PROJECT_PREFIX.as_bytes()],
        bump = non_transferable_project.bump
    )]
    pub non_transferable_project: Box<Account<'info, ProjectAccount>>,

    /// CHECK: Token-2022 NFT Mint账户，需要手动初始化扩展
    #[account(
        mut,
        seeds = [
            NON_TRANSFERABLE_NFT_MINT_PREFIX.as_bytes(),
            index.as_bytes()
        ],
        bump,
    )]
    pub non_transferable_nft_mint: UncheckedAccount<'info>,

    /// CHECK: 用户账户
    #[account(mut)]
    pub user_account: UncheckedAccount<'info>,

    /// CHECK: 用户的 Token-2022 ATA
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
    rns_id: String,
    wallet: Pubkey,
    merkle_root: String,
    index: String,
) -> Result<()> {
    let project = &ctx.accounts.non_transferable_project;
    let project_bump = project.bump;
    let project_signer_seeds: &[&[u8]] = &[
        NON_TRANSFERABLE_PROJECT_PREFIX.as_bytes(),
        &[project_bump],
    ];

    let mint_bump = ctx.bumps.non_transferable_nft_mint;
    let mint_signer_seeds: &[&[u8]] = &[
        NON_TRANSFERABLE_NFT_MINT_PREFIX.as_bytes(),
        index.as_bytes(),
        &[mint_bump],
    ];

    let rent = Rent::get()?;

    // 元数据信息 - merkle_root 作为 URI 的一部分，不再单独存储
    let metadata_uri = format!("{}{}.json", project.base_uri, merkle_root);
    let name = format!("LDID #{}", &index[..8.min(index.len())]);
    let symbol = project.symbol.clone();

    // 1. 创建 Token-2022 NFT Mint (如果不存在)
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
    
    // GroupMember 数据空间
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

    // Step 1: 创建账户
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

    // Step 2: 按 discriminant 顺序初始化扩展
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

    // MintCloseAuthority - 允许关闭 Mint 账户回收租金
    invoke_signed(
        &initialize_mint_close_authority(
            &ctx.accounts.token_program.key(),
            &ctx.accounts.non_transferable_nft_mint.key(),
            Some(&ctx.accounts.non_transferable_project.key()),
        )?,
        &[ctx.accounts.non_transferable_nft_mint.to_account_info()],
        &[mint_signer_seeds],
    )?;

    // GroupMemberPointer - 指向自身作为 Member
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

    // Step 6: 初始化 GroupMember (加入 Collection)
    invoke_signed(
        &initialize_member(
            &ctx.accounts.token_program.key(),
            &ctx.accounts.non_transferable_nft_mint.key(),  // member mint
            &ctx.accounts.non_transferable_nft_mint.key(),  // member mint (指向自身)
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

    // 2. 创建用户的 Token-2022 ATA (如果不存在)
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

    // 3. Mint NFT 到用户账户
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

    emit!(AirdropEvent {
        rns_id: rns_id.clone(),
        wallet,
        mint: ctx.accounts.non_transferable_nft_mint.key(),
    });

    msg!(
        "RNSNewID:_rnsId:{};_wallet:{};_tokenId:{}",
        rns_id,
        wallet,
        ctx.accounts.non_transferable_nft_mint.key()
    );

    Ok(())
}
