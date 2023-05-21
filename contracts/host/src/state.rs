use cosmwasm_std::Addr;
use cw_storage_plus::{Item, Map};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq, JsonSchema)]
pub struct State {
    pub count: i32, // TODO: this will be removed closer to MVP
    pub nonce: i32,
    pub owner: Addr,
    pub recovery_pool: Vec<Addr>,
    pub approval_pool: Vec<Addr>,
}

pub const STATE: Item<State> = Item::new("state");
pub const SLAVES: Map<String, Addr> = Map::new("slaves");
