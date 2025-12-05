use anchor_lang::{prelude::*, solana_program};
use mpl_token_metadata::{
  instructions::{
    CreateMasterEditionV3InstructionArgs, 
    CreateMetadataAccountV3InstructionArgs,
  },
  types::{CollectionDetails, DataV2},
  ID,
};

#[derive(Accounts)]
pub struct CreateMetadataAccountsV3<'info> {
  /// CHECK: Used in CPI So no Harm
  pub metadata: AccountInfo<'info>,
  /// CHECK: Used in CPI So no Harm
  pub mint: AccountInfo<'info>,
  /// CHECK: Used in CPI So no Harm
  pub mint_authority: AccountInfo<'info>,
  /// CHECK: Used in CPI So no Harm
  pub payer: AccountInfo<'info>,
  /// CHECK: Used in CPI So no Harm
  pub update_authority: AccountInfo<'info>,
  /// CHECK: Used in CPI So no Harm
  pub system_program: AccountInfo<'info>,
  /// CHECK: Used in CPI So no Harm
  pub rent: AccountInfo<'info>,
}

pub fn create_metadata_accounts_v3<'info>(
  ctx: CpiContext<'_, '_, '_, 'info, CreateMetadataAccountsV3<'info>>,
  data: DataV2,
  is_mutable: bool,
  _update_authority_is_signer: bool,
  details: Option<CollectionDetails>,
) -> Result<()> {
  let ix = mpl_token_metadata::instructions::CreateMetadataAccountV3 {
    metadata: *ctx.accounts.metadata.key,
    mint: *ctx.accounts.mint.key,
    mint_authority: *ctx.accounts.mint_authority.key,
    payer: *ctx.accounts.payer.key,
    update_authority: (*ctx.accounts.update_authority.key, true),
    system_program: *ctx.accounts.system_program.key,
    rent: Some(*ctx.accounts.rent.key),
  }
  .instruction(CreateMetadataAccountV3InstructionArgs {
    data,
    is_mutable,
    collection_details: details,
  });

  solana_program::program::invoke_signed(
    &ix,
    &ToAccountInfos::to_account_infos(&ctx),
    ctx.signer_seeds,
  )
  .map_err(Into::into)
}

#[derive(Clone)]
pub struct Metadata;

impl anchor_lang::Id for Metadata {
  fn id() -> Pubkey {
    ID
  }
}

/// MplTokenMetadata program wrapper for Anchor
#[derive(Clone)]
pub struct MplTokenMetadata;

impl anchor_lang::Id for MplTokenMetadata {
  fn id() -> Pubkey {
    ID
  }
}

#[derive(Accounts)]
pub struct CreateMasterEditionV3<'info> {
  /// CHECK: Used in CPI So no Harm
  pub edition: AccountInfo<'info>,
  /// CHECK: Used in CPI So no Harm
  pub mint: AccountInfo<'info>,
  /// CHECK: Used in CPI So no Harm
  pub update_authority: AccountInfo<'info>,
  /// CHECK: Used in CPI So no Harm
  pub mint_authority: AccountInfo<'info>,
  /// CHECK: Used in CPI So no Harm
  pub payer: AccountInfo<'info>,
  /// CHECK: Used in CPI So no Harm
  pub metadata: AccountInfo<'info>,
  /// CHECK: Used in CPI So no Harm
  pub token_program: AccountInfo<'info>,
  /// CHECK: Used in CPI So no Harm
  pub system_program: AccountInfo<'info>,
  /// CHECK: Used in CPI So no Harm
  pub rent: AccountInfo<'info>,
}

pub fn create_master_edition_v3<'info>(
  ctx: CpiContext<'_, '_, '_, 'info, CreateMasterEditionV3<'info>>,
  max_supply: Option<u64>,
) -> Result<()> {
  let ix = mpl_token_metadata::instructions::CreateMasterEditionV3 {
    edition: *ctx.accounts.edition.key,
    mint: *ctx.accounts.mint.key,
    update_authority: *ctx.accounts.update_authority.key,
    mint_authority: *ctx.accounts.mint_authority.key,
    metadata: *ctx.accounts.metadata.key,
    payer: *ctx.accounts.payer.key,
    token_program: *ctx.accounts.token_program.key,
    system_program: *ctx.accounts.system_program.key,
    rent: Some(*ctx.accounts.rent.key),
  }
  .instruction(CreateMasterEditionV3InstructionArgs { max_supply });

  solana_program::program::invoke_signed(
    &ix,
    &ToAccountInfos::to_account_infos(&ctx),
    ctx.signer_seeds,
  )
  .map_err(Into::into)
}

#[derive(Accounts)]
pub struct VerifyCollection<'info> {
  /// CHECK: Used in CPI So no Harm
  pub payer: AccountInfo<'info>,
  /// CHECK: Used in CPI So no Harm
  pub metadata: AccountInfo<'info>,
  /// CHECK: Used in CPI So no Harm
  pub collection_authority: AccountInfo<'info>,
  /// CHECK: Used in CPI So no Harm
  pub collection_mint: AccountInfo<'info>,
  /// CHECK: Used in CPI So no Harm
  pub collection_metadata: AccountInfo<'info>,
  /// CHECK: Used in CPI So no Harm
  pub collection_master_edition: AccountInfo<'info>,
  /// CHECK: Used in CPI So no Harm
  pub system_program: AccountInfo<'info>,
  /// CHECK: Used in CPI So no Harm
  pub sysvar_instructions: AccountInfo<'info>,
}

pub fn verify_collection<'info>(
  ctx: CpiContext<'_, '_, '_, 'info, VerifyCollection<'info>>,
  _collection_authority_record: Option<Pubkey>,
) -> Result<()> {
  use mpl_token_metadata::instructions::VerifyCollectionV1CpiBuilder;

  VerifyCollectionV1CpiBuilder::new(&ctx.program)
    .authority(&ctx.accounts.collection_authority)
    .metadata(&ctx.accounts.metadata)
    .collection_mint(&ctx.accounts.collection_mint)
    .collection_metadata(Some(&ctx.accounts.collection_metadata))
    .collection_master_edition(Some(&ctx.accounts.collection_master_edition))
    .system_program(&ctx.accounts.system_program)
    .sysvar_instructions(&ctx.accounts.sysvar_instructions)
    .invoke_signed(ctx.signer_seeds)?;

  Ok(())
}
