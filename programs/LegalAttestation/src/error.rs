use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("Only admin can perform this action")]
    Unauthorized,

    #[msg("Program is already initialized")]
    AlreadyInitialized,

    #[msg("Maximum number of operators reached")]
    MaxOperatorsReached,

    #[msg("Operator already exists")]
    OperatorAlreadyExists,

    #[msg("Operator not found")]
    OperatorNotFound,

    #[msg("Schema name cannot be empty")]
    EmptySchemaName,

    #[msg("Schema is not active")]
    SchemaInactive,

    #[msg("Invalid SAS program")]
    InvalidSasProgram,

    #[msg("CPI call to SAS failed")]
    SasCpiFailed,

    #[msg("Attestation is already revoked")]
    AlreadyRevoked,

    #[msg("Expiration time must be in the future")]
    ExpirationInPast,

    #[msg("Invalid attestation data")]
    InvalidData,

    #[msg("Invalid fee recipient")]
    InvalidFeeRecipient,
}
