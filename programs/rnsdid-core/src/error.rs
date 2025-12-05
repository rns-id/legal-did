use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("SECP256K1 program or length doesn't match")]
    InvalidDataProvided,

    #[msg("The signature data provided to validate the metadata is incorrect")]
    SignatureVerificationFailed,

    #[msg("You don't have enough SOL to mint this NFT")]
    InsufficientBalance,

    #[msg("Invalid recipient address")]
    InvalidFeeRecipient,

    #[msg("There are no more NFTs to mint in this collection")]
    CandyMachineEmpty,

    #[msg("The authority provided is not valid")]
    InvalidAuthority,

    #[msg("The authMint provided is not valid")]
    InvalidAuthMint,

    // code = 6
    #[msg("One LDID can only mint once to the same wallet.")]
    AlreadyMinted,
    #[msg("The wallet is blacklisted.")]
    WalletBlacklisted,
    #[msg("The LDID is blacklisted.")]
    LdidBlacklisted,


    // code = 10
    #[msg("One LDID can only mint once to the same wallet.")]
    LDIDHasMinted,

    // 11
    #[msg("Authorization is in process, please wait.")]
    LDIDHasAuthorized,

    // 12
    #[msg("RnsIs doesn't matched.")]
    RnsIsNotMatch,

    // 13
    #[msg("Only admin can perform this action.")]
    Unauthorized,
}
