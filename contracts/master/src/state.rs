use cosmwasm_std::Addr;
use cw_storage_plus::{Item, Map};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

pub type CodeId = u64;

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq, JsonSchema)]
pub struct State {
    pub host_code_id: CodeId,
    pub host_chain: String,
}

pub const STATE: Item<State> = Item::new("state");
pub const SLAVES: Map<String, CodeId> = Map::new("slaves");

pub const WALLETS: Map<Addr, Addr> = Map::new("wallets");
