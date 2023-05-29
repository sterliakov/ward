use cosmwasm_std::Addr;
use cw_storage_plus::{Deque, Item, Map};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq, JsonSchema)]
pub struct State {
    pub owner: Addr,
    pub master: Addr,
    pub potential_owner: Option<Addr>, // Used during ownership transfer
    pub recovery_pool: Vec<Addr>,
    pub approval_pool: Vec<Addr>,
    pub recovery_approvals_needed: u32,
    pub transfer_ownership_approvals_needed: u32,
}

pub const STATE: Item<State> = Item::new("state");
pub const SLAVES: Map<String, Addr> = Map::new("slaves");
pub const ACTIVE_RECOVERY: Deque<Addr> = Deque::new("ar");
