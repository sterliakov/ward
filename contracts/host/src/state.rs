use cosmwasm_std::{Addr, StdError, StdResult, Storage};
use cw_storage_plus::{Deque, Item};
use schemars::JsonSchema;
use serde::{de::DeserializeOwned, Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq, JsonSchema)]
pub struct State {
    pub owner: Addr,
    pub master: Addr,
    pub potential_owner: Option<Addr>, // Used during ownership transfer
    pub recovery_method: Option<String>, // Used during ownership transfer
    pub recovery_pool: Vec<Addr>,
    pub approval_pool: Vec<Addr>,
    pub recovery_approvals_needed: u32,
    pub transfer_ownership_approvals_needed: u32,
    pub chain: String,
}

pub const STATE: Item<State> = Item::new("state");
pub const SLAVES: Deque<(String, Addr)> = Deque::new("slaves");
pub const ACTIVE_RECOVERY: Deque<Addr> = Deque::new("ar");

pub fn get_key<'a, K, V>(
    deque: &Deque<(K, V)>,
    store: &dyn Storage,
    key: &K,
) -> StdResult<V>
where
    (K, V): Serialize + DeserializeOwned,
    K: Eq,
{
    deque
        .iter(store)?
        .filter_map(|el| el.ok())
        .filter(|(k, _)| k == key)
        .next()
        .map_or(
            Err(StdError::NotFound { kind: "Key not found".to_string() }),
            |p| Ok(p.1),
        )
}

pub fn set_key<'a, K, V>(
    deque: &Deque<(K, V)>,
    store: &mut dyn Storage,
    key: K,
    value: V,
    validate_unique: bool,
) -> StdResult<()>
where
    (K, V): Serialize + DeserializeOwned,
    K: Eq,
{
    if validate_unique {
        if let Ok(_) = get_key(deque, store, &key) {
            return Err(StdError::GenericErr {
                msg: "Key already set.".to_string(),
            });
        }
    }
    deque.push_back(store, &(key, value))?;
    Ok(())
}
