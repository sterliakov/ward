use cosmwasm_schema::cw_serde;
use cosmwasm_std::Addr;

#[cw_serde]
pub struct InstantiateMsg {
    pub owner: Addr,
    pub chain: String,
}

#[cw_serde]
pub struct HostRegisterSlaveMsg {
    pub chain: String,
    pub addr: Addr,
}
