export const EXECUTE_MSG_TYPE_URL = '/cosmwasm.wasm.v1.MsgExecuteContract';

export const HOST_CHAIN = {
  rpc: 'https://k8s.testnet.tm.injective.network/',
  chainId: 'injective-888',
  prefix: 'inj',
  denoms: [
    {
      coinDenom: 'inj',
      coinMinimalDenom: 'inj',
      coinDecimals: 18,
    },
  ],
};
export const SLAVE_CHAINS = {
  'injective-888': {
    rpc: 'https://k8s.testnet.tm.injective.network/',
    prefix: 'inj',
    name: 'Injective',
    denoms: [
      {
        coinDenom: 'inj',
        coinMinimalDenom: 'inj',
        coinDecimals: 18,
      },
    ],
  },
};
export const FACTORY_CONTRACT_ADDRESS =
  'inj1nlu6djpsq22rfees323r8yl8vt8cjwwufc8vks';
export const BASE_FEE = coins(1000000000000000, 'inj');