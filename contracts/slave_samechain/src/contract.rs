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
            msg: to_binary(&HostRegisterSlaveMsg {
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
