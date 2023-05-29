use cosmwasm_schema::{cw_serde, QueryResponses};
use cosmwasm_std::{Addr, CosmosMsg};

#[cw_serde]
pub struct InstantiateMsg {
    pub recovery_pool: Vec<Addr>,
    pub approval_pool: Vec<Addr>,
    pub recovery_approvals_needed: u32,
    pub transfer_ownership_approvals_needed: u32,
    pub owner: Addr,
}

#[cw_serde]
pub enum ExecuteMsg {
    AddRecoveryMember { member: Addr },
    AddApprovalMember { member: Addr },
    RemoveRecoveryMember { member: Addr },
    RemoveApprovalMember { member: Addr },
    RegisterSlave { chain: String, addr: Addr },
    ExecuteSameChain { body_proxy: CosmosMsg },
    BeginSocialRecovery { target_addr: Addr },
    ApproveSocialRecovery {},
    BeginTransferOwnership { target_addr: Addr },
    ApproveTransferOwnership {},
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
