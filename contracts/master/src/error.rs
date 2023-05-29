use cosmwasm_std::StdError;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum ContractError {
    #[error("{0}")]
    Std(#[from] StdError),

    #[error("{0}")]
    NotImplemented(String),

    #[error("Unknown reply ID: {0}")]
    UnknownReplyID(u64),

    #[error("Unauthorized")]
    Unauthorized {},

    #[error("{0}")]
    Generic(String),
}
