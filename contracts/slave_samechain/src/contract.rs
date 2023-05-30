#[cfg(not(feature = "library"))]
use cosmwasm_std::{
    entry_point, to_binary, CosmosMsg, DepsMut, Env, MessageInfo, Response,
    WasmMsg,
};
use cw2::set_contract_version;

use crate::error::ContractError;
use crate::msg::{HostRegisterSlaveMsg, InstantiateMsg};
use crate::state::{State, STATE};

// version info for migration info
const CONTRACT_NAME: &str = "crates.io:slave_samechain";
const CONTRACT_VERSION: &str = env!("CARGO_PKG_VERSION");

#[cfg_attr(not(feature = "library"), entry_point)]
pub fn instantiate(
    deps: DepsMut,
    env: Env,
    _info: MessageInfo,
    msg: InstantiateMsg,
) -> Result<Response, ContractError> {
    let state = State { owner: msg.owner.clone() };
    set_contract_version(deps.storage, CONTRACT_NAME, CONTRACT_VERSION)?;
    STATE.save(deps.storage, &state)?;

    Ok(Response::new()
        .add_attribute("method", "instantiate")
        .add_attribute("slave_address", env.contract.address.clone())
        .add_attribute("owner", msg.owner.clone())
        .add_message(WasmMsg::Execute {
            contract_addr: msg.owner.to_string(),
            msg: to_binary(&HostRegisterSlaveMsg::RegisterSlave {
                chain: msg.chain,
                addr: env.contract.address.clone(),
            })?,
            funds: vec![],
        }))
}

macro_rules! require_owner {
    ($info:ident, $state:ident) => {
        if $info.sender != $state.owner {
            return Err(ContractError::Unauthorized {});
        }
    };
}

#[cfg_attr(not(feature = "library"), entry_point)]
pub fn execute(
    deps: DepsMut,
    _env: Env,
    info: MessageInfo,
    msg: CosmosMsg,
) -> Result<Response, ContractError> {
    let state = STATE.load(deps.storage)?;
    require_owner!(info, state);

    if let CosmosMsg::Custom(_) = msg {
        return Err(ContractError::NotImplemented(
            "Custom messages not supported yet.".to_string(),
        ));
    }

    Ok(Response::new()
        .add_attribute("contract", "host")
        .add_attribute("method", "execute_samechain_transaction")
        .add_message(msg))
}
