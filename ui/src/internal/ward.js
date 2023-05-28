import {encodeSecp256k1Signature, serializeSignDoc} from '@cosmjs/amino';
import {CosmWasmClient, toBinary} from '@cosmjs/cosmwasm-stargate';
import {Secp256k1, sha256} from '@cosmjs/crypto';
import {DirectSecp256k1HdWallet, Registry} from '@cosmjs/proto-signing';
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

const executeMsgTypeUrl = '/cosmwasm.wasm.v1.MsgExecuteContract';

const HOST_CHAIN = {
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
const SLAVE_CHAINS = {
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
const HOST_CONTRACT_ADDRESS =
  'wasm1ctnjk7an90lz5wjfvr3cf6x984a8cjnv8dpmztmlpcq4xteaa2xsfr3xd0';
const SLAVE_ADDRESSES = {
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

  prepareAminoSignDoc(signDoc, chainId, localAddr) {
    console.log('Preparing', signDoc, chainId, localAddr);
    if (chainId === HOST_CHAIN.chainId) {
      if (signDoc.msgs.length !== 1) {
        throw new Error('Single message only allowed.');
      }

      return {
        ...signDoc,
        msgs: [
          {
            typeUrl: executeMsgTypeUrl,
            value: {
              sender: localAddr,
              contract: HOST_CONTRACT_ADDRESS,
              msg: {
                execute_same_chain: {
                  nonce: 1,
                  body_proxy: signDoc.msgs[0],
                },
              },
              funds: [],
            },
          },
        ],
      };
    }
    else {
      throw new Error('IBC call not supported yet.');
    }
  }

  async createFromMnemonic(mnemonic, ourPassword, opts = {}) {
    return Ward.createFromMnemonic(mnemonic, ourPassword, opts);
  }

  async getAccountWithPrivkey(password, address) {
    if (!address) address = await getKey('__WARD_default_address');

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
    if (!address) address = await getKey('__WARD_default_address');

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
    if (typeof chain === 'undefined') {
      throw new Error('Unknown chain.');
    }
    return CosmWasmClient.connect(chain.rpc);
  }

  async getSequence(chainId, address) {
    if (!address) address = await getKey('__WARD_default_address');

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

  async broadcast(chainId, tx) {
    const client = await this.getClient(chainId);
    const response = await client.broadcastTx(
      Uint8Array.from(TxRaw.encode(tx).finish()),
    );
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

  async signSimple(chainId, msg, fee, memo, password) {
    const wallet = await this.getWallet(password);
    const account = (await wallet.getAccountsWithPrivkeys())[0];

    const offline = await SigningStargateClient.offline(
      wallet,
      {
        aminoTypes: new AminoTypes({
          ...createDefaultAminoConverters(),
          [executeMsgTypeUrl]: {
            aminoType: 'cosmwasm/MsgExecuteContract',
            toAmino: (o) => o,
            fromAmino: (o) => o,
          },
        }),
        registry: new Registry([
          ...defaultRegistryTypes,
          [executeMsgTypeUrl, MsgExecuteContract],
        ]),
      },
    );

    let innerMsg;
    if (chainId === HOST_CHAIN.chainId) {
      innerMsg = {
        execute_same_chain: {
          body_proxy: msg,
        },
      };
    }
    else {
      throw new Error('IBC not supported yet.');
    }
    const wrappedMsg = {
      typeUrl: executeMsgTypeUrl,
      value: {
        sender: account.address,
        contract: HOST_CONTRACT_ADDRESS,
        msg: toBinary(innerMsg),
        funds: [],
      },
    };

    const {accountNumber, sequence} = await this.getSequence(
      chainId,
      account.address,
    );
    const signerInfo = {accountNumber, sequence, chainId};
    return offline.signDirect(
      account.address,
      [wrappedMsg],
      fee,
      memo,
      signerInfo,
    );
  }

  async sign(signerAddress, chainId, password, signDoc, mode = 'direct') {
    if (mode === 'direct') {
      return this.signDirect(signerAddress, chainId, password, signDoc);
    }
    else if (mode === 'amino') {
      return this.signAmino(signerAddress, chainId, password, signDoc);
    }
    else {
      throw new Error('Unknown sign mode.');
    }
  }

  async signAmino(signerAddress, chainId, password, signDoc) {
    if (!signerAddress) signerAddress = await getKey('__WARD_default_address');

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
      const {signature, signed} = response.request;
      return {signature, signed};
    }
    // FIXME: signerAddress should be remote (slave), not local
    const account = await this.getAccountWithPrivkey(password, signerAddress);
    if (account === undefined) {
      throw new Error(`Address ${signerAddress} not found in wallet`);
    }
    signDoc = this.prepareAminoSignDoc(signDoc, chainId, signerAddress);
    const {privkey, pubkey} = account;
    const message = sha256(serializeSignDoc(signDoc));
    const signature = await Secp256k1.createSignature(message, privkey);
    const signatureBytes = new Uint8Array([
      ...signature.r(32),
      ...signature.s(32),
    ]);
    return {
      signed: signDoc,
      signature: encodeSecp256k1Signature(pubkey, signatureBytes),
    };
  }

  async signDirect(signerAddress, chainId, password, signDoc) {
    throw new Error('Direct signing not supported yet.');

    // if (!signerAddress) signerAddress = await getKey('__WARD_default_address');

    // if (!password) {
    //   const response = await request(
    //     {
    //       type: 'sign',
    //       tx: signDoc,
    //       signMode: 'direct',
    //       signer: signerAddress,
    //     },
    //     'sign',
    //   );
    //   const {signature, signed} = response.request;
    //   return {signature, signed};
    // }
    // // FIXME: this shouldn't use passed signerAddress.
    // const account = await this.getAccountWithPrivkey(password, signerAddress);
    // if (account === undefined) {
    //   throw new Error(`Address ${signerAddress} not found in wallet`);
    // }
    // const {privkey, pubkey} = account;
    // const signBytes = makeSignBytes(signDoc);
    // const hashedMessage = sha256(signBytes);
    // const signature = await Secp256k1.createSignature(hashedMessage, privkey);
    // const signatureBytes = new Uint8Array([
    //   ...signature.r(32),
    //   ...signature.s(32),
    // ]);
    // const stdSignature = encodeSecp256k1Signature(pubkey, signatureBytes);
    // return {
    //   signed: signDoc,
    //   signature: stdSignature,
    // };
  }
}
