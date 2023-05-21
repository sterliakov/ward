use cosmwasm_std::StdError;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum ContractError {
    #[error("{0}")]
    Std(#[from] StdError),

    #[error("Unauthorized")]
    Unauthorized {},

    #[error("Member not found")]
    MemberNotFound {},

    #[error("Member already added")]
    MemberAlreadyAdded {},

    #[error("Nonce expired")]
    NonceAlreadyUsed {},

    #[error("No slave controller present on requested chain.")]
    ChainNotRegistered {},
}
