use anchor_lang::prelude::*;
use anchor_lang::solana_program::program::invoke_signed;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token_interface::TokenInterface;
use spl_token_2022::extension::ExtensionType;
use spl_token_2022::extension::metadata_pointer::instruction::initialize as init_metadata_pointer;
use spl_token_metadata_interface::instruction::initialize as init_token_metadata;
use spl_token_metadata_interface::state::TokenMetadata;

use crate::error::ErrorCode;
use crate::state::*;
use crate::utils::hex_to_bytes32;

#[event]
pub struct AirdropEvent {
    pub rns_id: String,
    pub wallet: Pubkey,
    pub token_id: String,
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

    pub associated_token_program: Program<'info, AssociatedToken>,
    /// Token-2022 程序
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
    // 检查黑名单
    require!(
        !ctx.accounts
            .non_transferable_project
            .is_blocked_address(wallet),
        ErrorCode::WalletBlacklisted
    );
    require!(
        !ctx.accounts
            .non_transferable_project
            .is_blocked_rns_id(&rns_id),
        ErrorCode::LdidBlacklisted
    );

    // 检查是否已铸造
    require!(
        ctx.accounts.did_status.status != DIDStatus::Minted as u8,
        ErrorCode::LDIDHasMinted
    );

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

    // 元数据信息
    let metadata_uri = format!("{}{}.json", project.base_uri, rns_id);
    let name = format!("LDID #{}", &index[..8.min(index.len())]);
    let symbol = project.symbol.clone();

    // 1. 创建 Token-2022 NFT Mint (如果不存在)
    if ctx.accounts.non_transferable_nft_mint.data_is_empty() {
        msg!("Creating Token-2022 NFT Mint with NonTransferable + PermanentDelegate + MetadataPointer");

        // 计算 TokenMetadata 空间
        let metadata = TokenMetadata {
            update_authority: Some(ctx.accounts.non_transferable_project.key()).try_into().unwrap(),
            mint: ctx.accounts.non_transferable_nft_mint.key(),
            name: name.clone(),
            symbol: symbol.clone(),
            uri: metadata_uri.clone(),
            additional_metadata: vec![],
        };
        let metadata_space = metadata.tlv_size_of().map_err(|_| ErrorCode::InvalidAccountData)?;

        // 使用 ExtensionType 计算基础空间
        // JS: getMintLen([NonTransferable, PermanentDelegate, MetadataPointer]) = 274
        let extension_types = &[
            ExtensionType::NonTransferable,
            ExtensionType::PermanentDelegate,
            ExtensionType::MetadataPointer,
        ];
        
        let base_space = ExtensionType::try_calculate_account_len::<spl_token_2022::state::Mint>(extension_types)
            .map_err(|_| ErrorCode::InvalidAccountData)?;
        
        // 总空间 = 基础空间 + 元数据空间
        let total_space = base_space + metadata_space;

        msg!("Space: base={}, metadata={}, total={}", base_space, metadata_space, total_space);

        // Step 1: 创建账户 (只分配 base_space)
        // InitializeMint 会验证: account_len == try_calculate_account_len(extensions)
        // 但预付 total_rent，TokenMetadata 初始化时会自动 realloc
        let total_rent = rent.minimum_balance(total_space);
        
        invoke_signed(
            &anchor_lang::solana_program::system_instruction::create_account(
                &ctx.accounts.authority.key(),
                &ctx.accounts.non_transferable_nft_mint.key(),
                total_rent, // 预付足够的 rent，TokenMetadata 初始化时会 realloc
                base_space as u64, // 但只分配 base_space
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
        // NonTransferable(9) → PermanentDelegate(12) → MetadataPointer(18)
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

        // Step 3: InitializeMint2 (账户大小 = base_space，验证会通过)
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

        // Step 4: 初始化 TokenMetadata
        // Token-2022 的 token_metadata::initialize 会自动 realloc 账户
        // 我们已经预付了足够的 rent (total_rent)
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

        msg!("NFT Mint created with metadata: {}", metadata_uri);
    }

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

    msg!("NFT minted successfully with metadata (NonTransferable)");

    // 4. 更新DID状态
    let did_status = &mut ctx.accounts.did_status;
    did_status.wallet = wallet;
    did_status.mint = ctx.accounts.non_transferable_nft_mint.key();
    did_status.merkle_root = hex_to_bytes32(&merkle_root);
    did_status.set_status(DIDStatus::Minted);
    did_status.bump = ctx.bumps.did_status;

    emit!(AirdropEvent {
        rns_id: rns_id.clone(),
        wallet,
        token_id: ctx.accounts.non_transferable_nft_mint.key().to_string(),
    });

    msg!(
        "RNSNewID:_rnsId:{};_wallet:{};_tokenId:{}",
        rns_id,
        wallet,
        ctx.accounts.non_transferable_nft_mint.key()
    );

    Ok(())
}
