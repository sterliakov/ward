#[cfg(not(feature = "library"))]
use cosmwasm_std::{
    entry_point, to_binary, Addr, Binary, CosmosMsg, Deps, DepsMut, Env,
    MessageInfo, Response, StdResult, SubMsg, WasmMsg,
};
use cw2::set_contract_version;
use itertools::Itertools;

use crate::error::ContractError;
use crate::msg::{ExecuteMsg, GetCountResponse, InstantiateMsg, QueryMsg};
use crate::state::{State, SLAVES, STATE};

// version info for migration info
const CONTRACT_NAME: &str = "crates.io:host";
const CONTRACT_VERSION: &str = env!("CARGO_PKG_VERSION");

#[repr(u8)]
enum ReplyKind {
    ReplySamechainTransaction = 1,
}

#[cfg_attr(not(feature = "library"), entry_point)]
pub fn instantiate(
    deps: DepsMut,
    _env: Env,
    info: MessageInfo,
    msg: InstantiateMsg,
) -> Result<Response, ContractError> {
    let state = State {
        count: msg.count,
        owner: info.sender.clone(),
        nonce: 0,
        recovery_pool: msg.recovery_pool.clone(),
        approval_pool: msg.approval_pool.clone(),
    };
    set_contract_version(deps.storage, CONTRACT_NAME, CONTRACT_VERSION)?;
    STATE.save(deps.storage, &state)?;

    Ok(Response::new()
        .add_attribute("method", "instantiate")
        .add_attribute("owner", info.sender)
        .add_attribute("count", msg.count.to_string())
        .add_attribute("nonce", "0")
        .add_attribute(
            "recovery_pool",
            format!(
                "[\"{}\"]",
                &msg.recovery_pool
                    .iter()
                    .map(|x| x.to_string())
                    .join("\",\"")
            ),
        )
        .add_attribute(
            "approval_pool",
            format!(
                "[\"{}\"]",
                &msg.approval_pool
                    .iter()
                    .map(|x| x.to_string())
                    .join("\",\"")
            ),
        ))
}

macro_rules! check_nonce {
    ($deps:ident, $nonce:ident, $action:expr) => {
        if let Err(err) = STATE.update(
            $deps.storage,
            |mut state| -> Result<_, ContractError> {
                if $nonce <= state.nonce {
                    Err(ContractError::NonceAlreadyUsed {})
                } else {
                    state.nonce = $nonce;
                    Ok(state)
                }
            },
        ) {
            Err(err)
        } else {
            $action
        }
    };
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
    msg: ExecuteMsg,
) -> Result<Response, ContractError> {
    match msg {
        ExecuteMsg::Increment { nonce } => {
            check_nonce!(deps, nonce, execute::increment(deps))
        }
        ExecuteMsg::Reset { count, nonce } => {
            check_nonce!(deps, nonce, execute::reset(deps, info, count))
        }
        ExecuteMsg::AddRecoveryMember { member, nonce } => {
            check_nonce!(
                deps,
                nonce,
                execute::add_recovery_member(deps, info, member)
            )
        }
        ExecuteMsg::AddApprovalMember { member, nonce } => {
            check_nonce!(
                deps,
                nonce,
                execute::add_approval_member(deps, info, member)
            )
        }
        ExecuteMsg::RemoveRecoveryMember { member, nonce } => {
            check_nonce!(
                deps,
                nonce,
                execute::remove_recovery_member(deps, info, member)
            )
        }
        ExecuteMsg::RemoveApprovalMember { member, nonce } => {
            check_nonce!(
                deps,
                nonce,
                execute::remove_approval_member(deps, info, member)
            )
        }
        ExecuteMsg::RegisterSlave { chain, addr, nonce } => {
            check_nonce!(
                deps,
                nonce,
                execute::register_slave(deps, chain, addr)
            )
        }
        ExecuteMsg::ExecuteSameChain { body_proxy, nonce } => {
            check_nonce!(
                deps,
                nonce,
                execute::execute_samechain_transaction(
                    deps, info, body_proxy
                )
            )
        }
    }
}

mod execute {
    use super::*;

    pub fn increment(deps: DepsMut) -> Result<Response, ContractError> {
        STATE.update(
            deps.storage,
            |mut state| -> Result<_, ContractError> {
                state.count += 1;
                Ok(state)
            },
        )?;

        Ok(Response::new().add_attribute("action", "increment"))
    }

    pub fn reset(
        deps: DepsMut,
        info: MessageInfo,
        count: i32,
    ) -> Result<Response, ContractError> {
        STATE.update(
            deps.storage,
            |mut state| -> Result<_, ContractError> {
                if info.sender != state.owner {
                    return Err(ContractError::Unauthorized {});
                }
                state.count = count;
                Ok(state)
            },
        )?;
        Ok(Response::new().add_attribute("action", "reset"))
    }

    pub fn add_recovery_member(
        deps: DepsMut,
        info: MessageInfo,
        member: Addr,
    ) -> Result<Response, ContractError> {
        STATE.update(
            deps.storage,
            |mut state| -> Result<_, ContractError> {
                require_owner!(info, state);
                if state.recovery_pool.contains(&member) {
                    return Err(ContractError::MemberAlreadyAdded {});
                }
                state.recovery_pool.push(member);
                Ok(state)
            },
        )?;
        Ok(Response::new().add_attribute("action", "add_recovery_member"))
    }
    pub fn add_approval_member(
        deps: DepsMut,
        info: MessageInfo,
        member: Addr,
    ) -> Result<Response, ContractError> {
        STATE.update(
            deps.storage,
            |mut state| -> Result<_, ContractError> {
                require_owner!(info, state);
                if state.approval_pool.contains(&member) {
                    return Err(ContractError::MemberAlreadyAdded {});
                }
                state.approval_pool.push(member);
                Ok(state)
            },
        )?;
        Ok(Response::new().add_attribute("action", "add_approval_member"))
    }

    pub fn remove_recovery_member(
        deps: DepsMut,
        info: MessageInfo,
        member: Addr,
    ) -> Result<Response, ContractError> {
        STATE.update(
            deps.storage,
            |mut state| -> Result<_, ContractError> {
                require_owner!(info, state);
                if !state.recovery_pool.contains(&member) {
                    return Err(ContractError::MemberNotFound {});
                }
                state.recovery_pool.retain(|x| x != member);
                Ok(state)
            },
        )?;
        Ok(Response::new().add_attribute("action", "remove_recovery_member"))
    }
    pub fn remove_approval_member(
        deps: DepsMut,
        info: MessageInfo,
        member: Addr,
    ) -> Result<Response, ContractError> {
        STATE.update(
            deps.storage,
            |mut state| -> Result<_, ContractError> {
                require_owner!(info, state);
                if !state.approval_pool.contains(&member) {
                    return Err(ContractError::MemberNotFound {});
                }
                state.approval_pool.retain(|x| x != member);
                Ok(state)
            },
        )?;
        Ok(Response::new().add_attribute("action", "remove_approval_member"))
    }

    pub fn register_slave(
        deps: DepsMut,
        chain: String,
        addr: Addr,
    ) -> Result<Response, ContractError> {
        SLAVES.save(
            deps.storage,
            chain,
            &deps.api.addr_validate(&addr.to_string())?,
        )?;
        Ok(Response::new().add_attribute("action", "remove_approval_member"))
    }

    pub fn execute_samechain_transaction(
        deps: DepsMut,
        info: MessageInfo,
        proxy_msg: CosmosMsg,
    ) -> Result<Response, ContractError> {
        if let Ok(slave_contract) =
            SLAVES.load(deps.storage, "samechain".to_string())
        {
            let action = CosmosMsg::Wasm(WasmMsg::Execute {
                contract_addr: slave_contract.to_string(),
                msg: to_binary(&proxy_msg)?,
                funds: info.funds,
            });
            // let sub_msg = SubMsg::reply_on_success(
            //     action,
            //     ReplyKind::ReplySamechainTransaction as u64,
            // );
            Ok(Response::new()
                .add_attribute("contract", "host")
                .add_attribute("method", "execute_samechain_transaction")
                // .add_submessage(sub_msg)
                .add_message(action))
        } else {
            Err(ContractError::ChainNotRegistered {})
        }
    }
}

#[cfg_attr(not(feature = "library"), entry_point)]
pub fn query(deps: Deps, _env: Env, msg: QueryMsg) -> StdResult<Binary> {
    match msg {
        QueryMsg::GetCount {} => to_binary(&query::count(deps)?),
    }
}

pub mod query {
    use super::*;

    pub fn count(deps: Deps) -> StdResult<GetCountResponse> {
        let state = STATE.load(deps.storage)?;
        Ok(GetCountResponse { count: state.count })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use cosmwasm_std::testing::{mock_dependencies, mock_env, mock_info};
    use cosmwasm_std::{coins, from_binary};

    #[test]
    fn proper_initialization() {
        let mut deps = mock_dependencies();

        let msg = InstantiateMsg {
            count: 17,
            recovery_pool: vec![],
            approval_pool: vec![],
        };
        let info = mock_info("creator", &coins(1000, "earth"));

        // we can just call .unwrap() to assert this was a success
        let res = instantiate(deps.as_mut(), mock_env(), info, msg).unwrap();
        assert_eq!(0, res.messages.len());

        // it worked, let's query the state
        let res =
            query(deps.as_ref(), mock_env(), QueryMsg::GetCount {}).unwrap();
        let value: GetCountResponse = from_binary(&res).unwrap();
        assert_eq!(17, value.count);
    }

    #[test]
    fn increment() {
        let mut deps = mock_dependencies();

        let msg = InstantiateMsg {
            count: 17,
            recovery_pool: vec![],
            approval_pool: vec![],
        };
        let info = mock_info("creator", &coins(2, "token"));
        let _res = instantiate(deps.as_mut(), mock_env(), info, msg).unwrap();

        // beneficiary can release it
        let info = mock_info("anyone", &coins(2, "token"));
        let msg = ExecuteMsg::Increment { nonce: 1 };
        let _res = execute(deps.as_mut(), mock_env(), info, msg).unwrap();

        // should increase counter by 1
        let res =
            query(deps.as_ref(), mock_env(), QueryMsg::GetCount {}).unwrap();
        let value: GetCountResponse = from_binary(&res).unwrap();
        assert_eq!(18, value.count);

        let info = mock_info("anyone", &coins(2, "token"));
        let msg = ExecuteMsg::Increment { nonce: 1 };
        let Err(_res) = execute(deps.as_mut(), mock_env(), info, msg) else {panic!("Should be error")};
        let res =
            query(deps.as_ref(), mock_env(), QueryMsg::GetCount {}).unwrap();
        let value: GetCountResponse = from_binary(&res).unwrap();
        assert_eq!(18, value.count);
    }

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
