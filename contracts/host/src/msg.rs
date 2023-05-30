use std::collections::HashMap;

use cosmwasm_schema::{cw_serde, QueryResponses};
use cosmwasm_std::{Addr, CosmosMsg};

#[cw_serde]
pub struct InstantiateMsg {
    pub recovery_pool: Vec<Addr>,
    pub approval_pool: Vec<Addr>,
    pub recovery_approvals_needed: u32,
    pub transfer_ownership_approvals_needed: u32,
    pub owner: Addr,
    pub chain: String,
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
    ApproveSocialRecovery { target_addr: Addr },
    BeginTransferOwnership { target_addr: Addr },
    ApproveTransferOwnership { target_addr: Addr },
}

#[cw_serde]
#[derive(QueryResponses)]
pub enum QueryMsg {
    #[returns(GetRecoveryPoolResponse)]
    GetRecoveryPool {},

    #[returns(GetSlavesResponse)]
    GetSlaves {},

    #[returns(GetSlaveResponse)]
    GetSlave { chain: String },
}

#[cw_serde]
pub struct GetRecoveryPoolResponse {
    pub members: Vec<Addr>,
    pub recovery_approvals_count: u32,
    pub transfer_approvals_count: u32,
    pub recovery_progress: u32,
    pub recovery_method: Option<String>,
    pub new_owner: Option<Addr>,
}
#[cw_serde]
pub struct GetSlavesResponse {
    pub slaves: HashMap<String, Addr>,
}
#[cw_serde]
pub struct GetSlaveResponse {
    pub slave: Option<Addr>,
}

#[cw_serde]
pub enum MasterMsg {
    UpdateOwner { old_owner: Addr, new_owner: Addr },
}
