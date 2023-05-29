#[cfg(not(feature = "library"))]
use cosmwasm_std::{
    entry_point, to_binary, DepsMut, Env, MessageInfo, Response, SubMsg,
    WasmMsg,
};
use cosmwasm_std::{Reply, SubMsgResult};
use cw2::set_contract_version;
use itertools::Itertools;

use crate::error::ContractError;
use crate::msg::{
    ExecuteMsg, HostInstantiateMsg, InstantiateMsg, SlaveInstantiateMsg,
};
use crate::state::{State, SLAVES, STATE, WALLETS};

// version info for migration info
const CONTRACT_NAME: &str = "crates.io:master";
const CONTRACT_VERSION: &str = env!("CARGO_PKG_VERSION");

#[repr(u8)]
enum ReplyKind {
    ReplyCreateHost = 1,
    ReplyCreateSlave = 2,
}

impl std::convert::TryFrom<u64> for ReplyKind {
    type Error = &'static str;

    fn try_from(value: u64) -> Result<Self, Self::Error> {
        match value {
            1 => Ok(Self::ReplyCreateHost),
            2 => Ok(Self::ReplyCreateSlave),
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
                    })?,
                    funds: vec![],
                    label: info.sender.to_string(),
                    // salt: info.sender.into(),
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
                let msg = WasmMsg::Instantiate2 {
                    admin: None,
                    code_id: SLAVES.load(deps.storage, slave_chain)?,
                    msg: to_binary(&SlaveInstantiateMsg {
                        host: host_address,
                    })?,
                    funds: vec![],
                    label: "".to_string(),
                    salt: b"".into(),
                };
                // let submsg = SubMsg::reply_on_success(msg, ReplyKind::ReplyCreateSlave as u64);
                Ok(Response::new()
                    .add_attribute("contract", "master")
                    .add_attribute("method", "add_slave")
                    .add_message(msg))
            } else {
                Err(ContractError::NotImplemented("No IBC yet".to_string()))
            }
        }
    }
}

// #[cfg_attr(not(feature = "library"), entry_point)]
// pub fn query(deps: Deps, _env: Env, msg: QueryMsg) -> StdResult<Binary> {
//     match msg {
//         QueryMsg::GetCount {} => to_binary(&query::count(deps)?),
//     }
// }

// pub mod query {
//     use super::*;

//     pub fn count(deps: Deps) -> StdResult<GetCountResponse> {
//         let state = STATE.load(deps.storage)?;
//         Ok(GetCountResponse { count: state.count })
//     }
// }

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
        _ => panic!("Should not happen"),
        // ReplyKind::ReplyCreateSlave => {
        // },
    }
}

#[cfg(test)]
mod tests {
    // use super::*;
    // use cosmwasm_std::testing::{mock_dependencies, mock_env, mock_info};
    // use cosmwasm_std::{coins, from_binary};

    // #[test]
    // fn proper_initialization() {
    //     let mut deps = mock_dependencies();

    //     let msg = InstantiateMsg {
    //         count: 17,
    //         recovery_pool: vec![],
    //         approval_pool: vec![],
    //     };
    //     let info = mock_info("creator", &coins(1000, "earth"));

    //     // we can just call .unwrap() to assert this was a success
    //     let res = instantiate(deps.as_mut(), mock_env(), info, msg).unwrap();
    //     assert_eq!(0, res.messages.len());

    //     // it worked, let's query the state
    //     let res =
    //         query(deps.as_ref(), mock_env(), QueryMsg::GetCount {}).unwrap();
    //     let value: GetCountResponse = from_binary(&res).unwrap();
    //     assert_eq!(17, value.count);
    // }

    // #[test]
    // fn increment() {
    //     let mut deps = mock_dependencies();

    //     let msg = InstantiateMsg {
    //         count: 17,
    //         recovery_pool: vec![],
    //         approval_pool: vec![],
    //     };
    //     let info = mock_info("creator", &coins(2, "token"));
    //     let _res = instantiate(deps.as_mut(), mock_env(), info, msg).unwrap();

    //     // beneficiary can release it
    //     let info = mock_info("anyone", &coins(2, "token"));
    //     let msg = ExecuteMsg::Increment { nonce: 1 };
    //     let _res = execute(deps.as_mut(), mock_env(), info, msg).unwrap();

    //     // should increase counter by 1
    //     let res =
    //         query(deps.as_ref(), mock_env(), QueryMsg::GetCount {}).unwrap();
    //     let value: GetCountResponse = from_binary(&res).unwrap();
    //     assert_eq!(18, value.count);

    //     let info = mock_info("anyone", &coins(2, "token"));
    //     let msg = ExecuteMsg::Increment { nonce: 1 };
    //     let Err(_res) = execute(deps.as_mut(), mock_env(), info, msg) else {panic!("Should be error")};
    //     let res =
    //         query(deps.as_ref(), mock_env(), QueryMsg::GetCount {}).unwrap();
    //     let value: GetCountResponse = from_binary(&res).unwrap();
    //     assert_eq!(18, value.count);
    // }

    // #[test]
    // fn reset() {
    //     let mut deps = mock_dependencies();

    //     let msg = InstantiateMsg { count: 17 };
    //     let info = mock_info("creator", &coins(2, "token"));
    //     let _res = instantiate(deps.as_mut(), mock_env(), info, msg).unwrap();

    //     // beneficiary can release it
    //     let unauth_info = mock_info("anyone", &coins(2, "token"));
    //     let msg = ExecuteMsg::Reset { count: 5 };
    //     let res = execute(deps.as_mut(), mock_env(), unauth_info, msg);
    //     match res {
    //         Err(ContractError::Unauthorized {}) => {}
    //         _ => panic!("Must return unauthorized error"),
    //     }

    //     // only the original creator can reset the counter
    //     let auth_info = mock_info("creator", &coins(2, "token"));
    //     let msg = ExecuteMsg::Reset { count: 5 };
    //     let _res =
    //         execute(deps.as_mut(), mock_env(), auth_info, msg).unwrap();

    //     // should now be 5
    //     let res =
    //         query(deps.as_ref(), mock_env(), QueryMsg::GetCount {}).unwrap();
    //     let value: GetCountResponse = from_binary(&res).unwrap();
    //     assert_eq!(5, value.count);
    // }
}
