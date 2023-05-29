use crate::state::CodeId;
use cosmwasm_schema::cw_serde;
use cosmwasm_std::Addr;
use std::collections::HashMap;

#[cw_serde]
pub struct InstantiateMsg {
    pub host_code_id: CodeId,
    pub host_chain: String,
    pub slave_code_ids: HashMap<String, CodeId>,
}

#[cw_serde]
pub enum ExecuteMsg {
    CreateHost {
        recovery_pool: Vec<Addr>,
        approval_pool: Vec<Addr>,
        recovery_approvals_needed: u32,
        transfer_ownership_approvals_needed: u32,
    },
    CreateSlave {
        host_address: Addr,
        slave_chain: String,
    },
}

#[cw_serde]
pub struct HostInstantiateMsg {
    pub recovery_pool: Vec<Addr>,
    pub approval_pool: Vec<Addr>,
    pub recovery_approvals_needed: u32,
    pub transfer_ownership_approvals_needed: u32,
    pub owner: Addr,
}

#[cw_serde]
pub struct SlaveInstantiateMsg {
    pub host: Addr,
}
