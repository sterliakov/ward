#[cfg(not(feature = "library"))]
use cosmwasm_std::{
    entry_point, to_binary, Addr, Binary, Deps, DepsMut, Env, MessageInfo,
    Reply, Response, StdResult, SubMsg, SubMsgResult, WasmMsg,
};
use cw2::set_contract_version;
use itertools::Itertools;

use crate::error::ContractError;
use crate::msg::{
    ExecuteMsg, HostInstantiateMsg, InstantiateMsg, QueryMsg,
    SlaveInstantiateMsg,
};
use crate::state::{State, SLAVES, STATE, WALLETS};

// version info for migration info
const CONTRACT_NAME: &str = "crates.io:master";
const CONTRACT_VERSION: &str = env!("CARGO_PKG_VERSION");

#[repr(u8)]
enum ReplyKind {
    ReplyCreateHost = 1,
}

impl std::convert::TryFrom<u64> for ReplyKind {
    type Error = &'static str;

    fn try_from(value: u64) -> Result<Self, Self::Error> {
        match value {
            1 => Ok(Self::ReplyCreateHost),
            _ => Err("Unknown"),
        }
    }
}

#[cfg_attr(not(feature = "library"), entry_point)]
pub fn instantiate(
    deps: DepsMut,
    _env: Env,
    _info: MessageInfo,
    msg: InstantiateMsg,
) -> Result<Response, ContractError> {
    let state =
        State { host_code_id: msg.host_code_id, host_chain: msg.host_chain };
    set_contract_version(deps.storage, CONTRACT_NAME, CONTRACT_VERSION)?;
    STATE.save(deps.storage, &state)?;
    for (k, v) in msg.slave_code_ids.iter() {
        SLAVES.save(deps.storage, k.clone(), v)?;
    }

    let slaves_repr = msg
        .slave_code_ids
        .iter()
        .map(|(chain, code_id)| format!("\"{chain}\": \"{code_id}\""))
        .join(",");

    Ok(Response::new()
        .add_attribute("method", "instantiate")
        .add_attribute("host", msg.host_code_id.to_string())
        .add_attribute("slaves", format!("{{{}}}", slaves_repr)))
}

#[cfg_attr(not(feature = "library"), entry_point)]
pub fn execute(
    deps: DepsMut,
    _env: Env,
    info: MessageInfo,
    msg: ExecuteMsg,
) -> Result<Response, ContractError> {
    let state = STATE.load(deps.storage)?;

    match msg {
        ExecuteMsg::CreateHost {
            recovery_pool,
            approval_pool,
            recovery_approvals_needed,
            transfer_ownership_approvals_needed,
        } => {
            let submsg = SubMsg::reply_on_success(
                WasmMsg::Instantiate {
                    admin: None,
                    code_id: state.host_code_id,
                    msg: to_binary(&HostInstantiateMsg {
                        recovery_pool,
                        recovery_approvals_needed,
                        approval_pool,
                        transfer_ownership_approvals_needed,
                        owner: info.sender.clone(),
                        chain: state.host_chain,
                    })?,
                    funds: vec![],
                    label: info.sender.to_string(),
                },
                ReplyKind::ReplyCreateHost as u64,
            );
            Ok(Response::new()
                .add_attribute("contract", "master")
                .add_attribute("method", "create_host")
                .add_submessage(submsg))
        }
        ExecuteMsg::CreateSlave { host_address, slave_chain } => {
            if slave_chain == state.host_chain {
                let msg = WasmMsg::Instantiate {
                    admin: None,
                    code_id: SLAVES
                        .load(deps.storage, slave_chain.clone())?,
                    msg: to_binary(&SlaveInstantiateMsg {
                        owner: host_address,
                        chain: slave_chain,
                    })?,
                    funds: vec![],
                    label: info.sender.to_string(),
                };
                Ok(Response::new()
                    .add_attribute("contract", "master")
                    .add_attribute("method", "add_slave")
                    .add_message(msg))
            } else {
                Err(ContractError::NotImplemented("No IBC yet".to_string()))
            }
        }
        ExecuteMsg::UpdateOwner { old_owner, new_owner } => {
            let wallet = WALLETS.load(deps.storage, old_owner.clone())?;
            if wallet != info.sender {
                Err(ContractError::Unauthorized {})
            } else {
                WALLETS.remove(deps.storage, old_owner);
                WALLETS.save(deps.storage, new_owner, &wallet)?;
                Ok(Response::new()
                    .add_attribute("contract", "master")
                    .add_attribute("method", "update_owner"))
            }
        }
    }
}

#[cfg_attr(not(feature = "library"), entry_point)]
pub fn query(deps: Deps, _env: Env, msg: QueryMsg) -> StdResult<Binary> {
    match msg {
        QueryMsg::GetHostContract { owner } => {
            to_binary(&query::get_host(deps, owner)?)
        }
    }
}

pub mod query {
    use super::*;
    use crate::msg::GetHostResponse;

    pub fn get_host(deps: Deps, owner: Addr) -> StdResult<GetHostResponse> {
        let wallet = WALLETS.load(deps.storage, owner)?;
        Ok(GetHostResponse { host: wallet })
    }
}

#[cfg_attr(not(feature = "library"), entry_point)]
pub fn reply(
    deps: DepsMut,
    _env: Env,
    msg: Reply,
) -> Result<Response, ContractError> {
    let reply_kind = ReplyKind::try_from(msg.id);
    if reply_kind.is_err() {
        return Err(ContractError::UnknownReplyID(msg.id));
    }

    match reply_kind.unwrap() {
        ReplyKind::ReplyCreateHost => {
            if let SubMsgResult::Ok(result) = msg.result {
                let mut host_addr = None;
                let mut owner_addr = None;
                for ev in result.events {
                    for attr in ev.attributes {
                        if attr.key == "host_address" {
                            host_addr = Some(attr.value);
                        } else if attr.key == "owner" {
                            owner_addr = Some(attr.value);
                        }
                    }
                }
                if host_addr.is_none() {
                    return Err(ContractError::Generic(
                        "Host address not detected.".to_string(),
                    ));
                }
                if owner_addr.is_none() {
                    return Err(ContractError::Generic(
                        "Owner address not detected.".to_string(),
                    ));
                }
                let host_addr =
                    deps.api.addr_validate(host_addr.unwrap().as_str())?;
                let owner_addr =
                    deps.api.addr_validate(owner_addr.unwrap().as_str())?;
                WALLETS.save(deps.storage, owner_addr, &host_addr)?;
                Ok(Response::new()
                    .add_attribute("contract", "master")
                    .add_attribute("method", "reply_create_host"))
            } else {
                Err(ContractError::Generic("Failed".to_string()))
            }
        }
    }
}
