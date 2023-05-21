use cosmwasm_schema::{cw_serde, QueryResponses};
use cosmwasm_std::{Addr, CosmosMsg};

#[cw_serde]
pub struct InstantiateMsg {
    pub count: i32,
    pub recovery_pool: Vec<Addr>,
    pub approval_pool: Vec<Addr>,
}

#[cw_serde]
pub enum ExecuteMsg {
    Increment { nonce: i32 },
    Reset { nonce: i32, count: i32 },
    AddRecoveryMember { nonce: i32, member: Addr },
    AddApprovalMember { nonce: i32, member: Addr },
    RemoveRecoveryMember { nonce: i32, member: Addr },
    RemoveApprovalMember { nonce: i32, member: Addr },
    RegisterSlave { nonce: i32, chain: String, addr: Addr },
    ExecuteSameChain { nonce: i32, body_proxy: CosmosMsg },
}

#[cw_serde]
#[derive(QueryResponses)]
pub enum QueryMsg {
    // GetCount returns the current count as a json-encoded number
    #[returns(GetCountResponse)]
    GetCount {},
}

// We define a custom struct for each query response
#[cw_serde]
pub struct GetCountResponse {
    pub count: i32,
}
