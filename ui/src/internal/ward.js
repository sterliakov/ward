import {encodeSecp256k1Signature, serializeSignDoc} from '@cosmjs/amino';
import {CosmWasmClient, toBinary} from '@cosmjs/cosmwasm-stargate';
import {Secp256k1, sha256} from '@cosmjs/crypto';
// test
// ================
import {fromBase64} from '@cosmjs/encoding';
import {
  DirectSecp256k1HdWallet,
  Registry,
  makeSignBytes,
} from '@cosmjs/proto-signing';
import {makeAuthInfoBytes, makeSignDoc} from '@cosmjs/proto-signing';
import {
  AminoTypes,
  SigningStargateClient,
  coins,
  createDefaultAminoConverters,
  defaultRegistryTypes,
} from '@cosmjs/stargate';
import {MsgSend} from 'cosmjs-types/cosmos/bank/v1beta1/tx.js';
import {TxRaw} from 'cosmjs-types/cosmos/tx/v1beta1/tx.js';
import {MsgExecuteContract} from 'cosmjs-types/cosmwasm/wasm/v1/tx.js';

// ================

export const EXECUTE_MSG_TYPE_URL = '/cosmwasm.wasm.v1.MsgExecuteContract';

export const HOST_CHAIN = {
  rpc: 'http://localhost:26657/',
  chainId: 'foo-1',
  prefix: 'wasm',
  denoms: [
    {
      coinDenom: 'stake',
      coinMinimalDenom: 'ustake',
      coinDecimals: 6,
    },
  ],
};
export const SLAVE_CHAINS = {
  'foo-1': {
    rpc: 'http://localhost:26657/',
    prefix: 'wasm',
    name: 'testnet',
    denoms: [
      {
        coinDenom: 'stake',
        coinMinimalDenom: 'ustake',
        coinDecimals: 6,
      },
    ],
  },
};
export const FACTORY_CONTRACT_ADDRESS =
  'wasm17a7mlm84taqmd3enrpcxhrwzclj9pga8efz83vrswnnywr8tv26sapqg8f';

export const HOST_CONTRACT_ADDRESS =
  'wasm1ctnjk7an90lz5wjfvr3cf6x984a8cjnv8dpmztmlpcq4xteaa2xsfr3xd0';
export const SLAVE_ADDRESSES = {
  'foo-1': 'wasm14xc5dkz0rn8j99lxz69mkv3wzawmadg7xurkzy49m9yefmqx5c6sv5vy55',
};

export const DEBUG = true;
export function request(args, wait) {
  if (wait) {
    const eventName = `${wait}-result`;
    return new Promise((resolve, reject) => {
      const receiveResponse = (e) => {
        document.removeEventListener(eventName, receiveResponse);
        resolve(e.detail);
      };

      document.addEventListener(eventName, receiveResponse);
      document.dispatchEvent(new CustomEvent('bg-proxy', {detail: args}));
    });
  }
  else {
    document.dispatchEvent(new CustomEvent('bg-proxy', {detail: args}));
  }
}

// FIXME: DEBUG only
const a = 'wasm15afv8rty6epfxlhn7pjjl5hs8kff8evpk22ydm';
const TEMP_DATA = {
  __WARD_default_address: a,
  [`__WARD_${a}`]:
    '{"type":"directsecp256k1hdwallet-v1","kdf":{"algorithm":"argon2id","params":{"outputLength":32,"opsLimit":24,"memLimitKib":12288}},"encryption":{"algorithm":"xchacha20poly1305-ietf"},"data":"pIOGpgUDlexj0vjG2+q/D9KkW2OdQmcy+xXHeU8JArTNm1tOFa2+Zo6zhzdV1ouuCSug+3v6vuE++wACsZgcYHeqzZfX9HVwQyZ2U9ocQII/cMA6nnWGZw45dso7+qdxLu0geP+94+85npHQgqsCl1wZOqBsk5LbeN0uoNIpqms258FhE9jwt/CbM0gb+2/szMZTjTk592AVZWMXsNUMCGDttw9AGwXP9+IcbJCpae+Hde0JbxiuXh/w37DTFrx4MZYVEHfKfPfJ+ZZATzz+8gACpWy4l+86gsU9SJb18XGaST8IQC+yAUcvW+LCR3JlpWDZgXXtAL6Irvfi56MplsavaLCK8Txshvi6tV6Hdw=="}',
};

export async function getKey(key) {
  if (DEBUG) return TEMP_DATA[key];
  console.log(`Fetching value of key ${key}`);
  const response = await request({type: 'getKey', key}, 'getKey');
  return response.result[key];
}

export async function setKey(key, value) {
  if (DEBUG) {
    TEMP_DATA[key] = value;
    return;
  }
  console.log(`Setting value of key ${key} to ${value}`);
  return request({type: 'setKey', key, value}, 'setKey');
}

export default class Ward {
  static async validateMnemonic(mnemonic, opts = {}) {
    const wallet = await DirectSecp256k1HdWallet.fromMnemonic(mnemonic, opts);
    const {address} = (await wallet.getAccounts())[0];
    return address;
  }

  static async createFromMnemonic(mnemonic, ourPassword, opts = {}) {
    const wallet = await DirectSecp256k1HdWallet.fromMnemonic(mnemonic, opts);
    const stored = await wallet.serialize(ourPassword);
    const {address} = (await wallet.getAccounts())[0];
    await setKey('__WARD_default_address', address);
    await setKey(`__WARD_${address}`, stored);
  }

  static getFullDenom(denomName, chainId) {
    for (const d of SLAVE_CHAINS[chainId].denoms) {
      if (d.coinDenom === denomName) return d;
    }
  }

  async getLocalAddress() {
    return getKey('__WARD_default_address');
  }

  async createFromMnemonic(mnemonic, ourPassword, opts = {}) {
    return Ward.createFromMnemonic(mnemonic, ourPassword, opts);
  }

  async getAccountWithPrivkey(password, address) {
    if (!address) address = await this.getLocalAddress();

    const stored = await getKey(`__WARD_${address}`);
    if (!stored) throw new Error('Address not found.');
    try {
      const wallet = await DirectSecp256k1HdWallet.deserialize(
        stored,
        password,
      );
      return (await wallet.getAccountsWithPrivkeys())[0];
    }
    catch (ex) {
      console.error(ex);
      throw new Error('Password does not match.');
    }
  }

  async getWallet(password, address) {
    if (!address) address = await this.getLocalAddress();

    const stored = await getKey(`__WARD_${address}`);
    if (!stored) throw new Error('Address not found.');
    try {
      return await DirectSecp256k1HdWallet.deserialize(stored, password);
    }
    catch (ex) {
      console.error(ex);
      throw new Error('Password does not match.');
    }
  }

  async getClient(chainId) {
    const chain = SLAVE_CHAINS[chainId];
    if (typeof chain === 'undefined') throw new Error('Unknown chain.');

    return CosmWasmClient.connect(chain.rpc);
  }

  async getSequence(chainId, address) {
    if (!address) address = await this.getLocalAddress();

    const client = await this.getClient(chainId);
    const sequence = await client.getSequence(address);
    await client.disconnect();
    return sequence;
  }

  async getBalance(chainId, denom) {
    const client = await this.getClient(chainId);
    const addr = SLAVE_ADDRESSES[chainId];
    const balance = await client.getBalance(addr, denom);
    await client.disconnect();
    console.log(chainId, denom, addr, balance);
    return balance;
  }

  async broadcastRaw(chainId, tx) {
    console.log(tx);
    const client = await this.getClient(chainId);
    const response = await client.broadcastTx(
      Uint8Array.from(TxRaw.encode(tx).finish()),
    );
    await client.disconnect();
    return response;
  }

  async broadcast(chainId, txBytes) {
    const client = await this.getClient(chainId);
    const response = await client.broadcastTx(txBytes);
    await client.disconnect();
    return response;
  }

  async getAllBalances() {
    return Promise.all(
      Object.entries(SLAVE_CHAINS).map(
        async ([chainId, {rpc, name, denoms}]) => ({
          chainId,
          name,
          balances: await Promise.all(
            denoms.map(async (denom) =>
              this.getBalance(chainId, denom.coinDenom),
            ),
          ),
        }),
      ),
    );
  }

  async getFromAddress(chainId, address) {
    if (address) {
      throw new Error('Not implemented: only single account allowed now.');
    }

    return SLAVE_ADDRESSES[chainId];
  }

  async makeOfflineClient(password) {
    const wallet = await this.getWallet(password);

    return SigningStargateClient.offline(
      wallet,
      {
        aminoTypes: new AminoTypes({
          ...createDefaultAminoConverters(),
          [EXECUTE_MSG_TYPE_URL]: {
            aminoType: 'cosmwasm/MsgExecuteContract',
            toAmino: (o) => o,
            fromAmino: (o) => o,
          },
        }),
        registry: new Registry([
          ...defaultRegistryTypes,
          [EXECUTE_MSG_TYPE_URL, MsgExecuteContract],
        ]),
      },
    );
  }

  _wrapWithInner(chainId, msg) {
    if (chainId === HOST_CHAIN.chainId) {
      return {
        execute_same_chain: {
          body_proxy: msg,
        },
      };
    }
    else {
      throw new Error('IBC not supported yet.');
    }
  }

  _wrapWithOuter(innerMsg, signerAddress) {
    return {
      typeUrl: EXECUTE_MSG_TYPE_URL,
      value: {
        sender: signerAddress,
        contract: HOST_CONTRACT_ADDRESS,
        msg: innerMsg,
        funds: [],
      },
    };
  }

  async signSimpleAsSelf(chainId, msg, fee, memo, password) {
    const wallet = await this.getWallet(password);
    const account = (await wallet.getAccountsWithPrivkeys())[0];
    const offline = await this.makeOfflineClient(password);

    const {accountNumber, sequence} = await this.getSequence(
      chainId,
      account.address,
    );
    return offline.signDirect(
      account.address,
      [msg],
      fee,
      memo,
      {accountNumber, sequence, chainId},
    );
  }

  async signSimple(chainId, msg, fee, memo, password, accountData = null) {
    const wallet = await this.getWallet(password);
    const account = (await wallet.getAccountsWithPrivkeys())[0];
    const offline = await this.makeOfflineClient(password);

    const innerMsg = this._wrapWithInner(chainId, msg);
    const wrappedMsg = this._wrapWithOuter(toBinary(innerMsg), account.address);

    let accountNumber, sequence;
    if (accountData) {
      ({accountNumber, sequence} = accountData);
    }
    else {
      ({accountNumber, sequence} = await this.getSequence(
        chainId,
        account.address,
      ));
    }
    const signerInfo = {accountNumber, sequence, chainId};
    return offline.signDirect(
      account.address,
      [wrappedMsg],
      fee,
      memo,
      signerInfo,
    );
  }

  async sign(signerAddress, signDoc, mode = 'direct', password) {
    if (mode === 'direct') {
      return this.signDirect(signerAddress, signDoc, password);
    }
    else if (mode === 'amino') {
      return this.signAmino(signerAddress, signDoc, password);
    }
    else throw new Error('Unknown sign mode.');
  }

  addressToChainId(signerAddress) {
    for (const [chainId, addr] of Object.entries(SLAVE_ADDRESSES)) {
      if (addr === signerAddress) return chainId;
    }

    throw new Error(`Address ${signerAddress} not found in wallet`);
  }

  async signAmino(signerAddress, signDoc, password = null) {
    if (!password) {
      const response = await request(
        {
          type: 'sign',
          tx: signDoc,
          signMode: 'amino',
          signer: signerAddress,
        },
        'sign',
      );
      const {authInfoBytes, bodyBytes, signatures} = response.request;
      return {
        authInfoBytes: Uint8Array.from(
          Object.entries(authInfoBytes)
            .sort((a, b) => a[0] - b[0])
            .map((x) => x[1]),
        ),
        bodyBytes: Uint8Array.from(
          Object.entries(bodyBytes)
            .sort((a, b) => a[0] - b[0])
            .map((x) => x[1]),
        ),
        signatures: [
          Uint8Array.from(
            Object.entries(signatures[0])
              .sort((a, b) => a[0] - b[0])
              .map((x) => x[1]),
          ),
        ],
      };
    }

    if (signDoc.msgs.length !== 1) {
      throw new Error('Can submit strictly one message only.');
    }

    const chainId = this.addressToChainId(signerAddress);
    if (chainId !== signDoc.chain_id) {
      throw new Error('Chain ID in request does not match account address.');
    }

    return this.signSimple(
      chainId,
      signDoc.msgs[0],
      signDoc.fee,
      signDoc.memo,
      password,
      {
        sequence: signDoc.sequence,
        accountNumber: signDoc.account_number,
      },
    );
  }

  async signDirect(signerAddress, signDoc, password = null) {
    throw new Error('Direct signing not supported yet.');
  }
}
