import {toBinary} from '@cosmjs/cosmwasm-stargate';
import {stringToPath} from '@cosmjs/crypto';
import {DirectSecp256k1HdWallet, Registry} from '@cosmjs/proto-signing';
import {
  AminoTypes,
  SigningStargateClient,
  createDefaultAminoConverters,
  defaultRegistryTypes,
} from '@cosmjs/stargate';
import {TxRaw} from 'cosmjs-types/cosmos/tx/v1beta1/tx.js';
import {MsgExecuteContract} from 'cosmjs-types/cosmwasm/wasm/v1/tx.js';

import {
  EXECUTE_MSG_TYPE_URL,
  FACTORY_CONTRACT_ADDRESS,
  HOST_CHAIN,
  SLAVE_CHAINS,
} from './chains';
import {CosmWasmClient} from './injectiveCompat';

export {
  EXECUTE_MSG_TYPE_URL,
  HOST_CHAIN,
  SLAVE_CHAINS,
  FACTORY_CONTRACT_ADDRESS,
  BASE_FEE,
} from './chains';

export function request(args, wait) {
  if (wait) {
    const eventName = `${wait}-result`;
    return new Promise((resolve) => {
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

export async function getKey(key) {
  const response = await request({type: 'getKey', key}, 'getKey');
  return response.result[key];
}

export async function setKey(key, value) {
  return request({type: 'setKey', key, value}, 'setKey');
}

export default class Ward {
  constructor() {
    this._address = null;
    this._hostContract = null;
    this._slaveContracts = null;
  }

  static async validateMnemonic(mnemonic, opts = {}) {
    const baseOpts = {
      hdPaths: [stringToPath("m/44'/60'/0'/0")],
    };
    const wallet = await DirectSecp256k1HdWallet.fromMnemonic(
      mnemonic,
      {...baseOpts, ...opts},
    );
    const {address} = (await wallet.getAccounts())[0];
    return address;
  }

  static async createFromMnemonic(mnemonic, ourPassword, opts = {}) {
    const baseOpts = {
      hdPaths: [stringToPath("m/44'/60'/0'/0")],
    };
    const wallet = await DirectSecp256k1HdWallet.fromMnemonic(
      mnemonic,
      {...baseOpts, ...opts},
    );
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

  static async hasAccount() {
    const addr = await Ward.getLocalAddress();
    return addr != null && new Ward().getHostContract();
  }

  static async getLocalAddress() {
    return getKey('__WARD_default_address');
  }

  async getLocalAddress() {
    if (!this._address) {
      this._address = await getKey('__WARD_default_address');
    }
    return this._address;
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

  static async getClient(chainId) {
    const chain =
      chainId === HOST_CHAIN.chainId ? HOST_CHAIN : SLAVE_CHAINS[chainId];
    if (typeof chain === 'undefined') throw new Error('Unknown chain.');

    return CosmWasmClient.connect(chain.rpc);
  }
  async getClient(chainId) {
    return Ward.getClient(chainId);
  }

  async getRecoveryState() {
    const host = await this.getHostContract();
    const client = await this.getClient(HOST_CHAIN.chainId);
    return client.queryContractSmart(host, {get_recovery_pool: {}});
  }

  async getHostContract() {
    if (!this._hostContract) {
      const client = await this.getClient(HOST_CHAIN.chainId);
      const response = await client.queryContractSmart(
        FACTORY_CONTRACT_ADDRESS,
        {get_host_contract: {owner: await this.getLocalAddress()}},
      );
      this._hostContract = response.host;
    }
    return this._hostContract;
  }

  async getSlaveContracts() {
    const host = await this.getHostContract();
    if (!this._slaveContracts) {
      const client = await this.getClient(HOST_CHAIN.chainId);
      const response = await client.queryContractSmart(host, {get_slaves: {}});
      this._slaveContracts = response.slaves;
    }
    return this._slaveContracts;
  }

  static async getHostContract(owner) {
    const client = await Ward.getClient(HOST_CHAIN.chainId);
    const response = await client.queryContractSmart(
      FACTORY_CONTRACT_ADDRESS,
      {get_host_contract: {owner}},
    );
    return response.host;
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
    const addr = (await this.getSlaveContracts())[chainId];
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
    const slaves = await this.getSlaveContracts();
    return Promise.all(
      Object.entries(SLAVE_CHAINS).map(async ([chainId, {name, denoms}]) => ({
        chainId,
        name,
        address: slaves[chainId],
        balances: await Promise.all(
          denoms.map(async (denom) =>
            this.getBalance(chainId, denom.coinDenom),
          ),
        ),
      })),
    );
  }

  async getFromAddress(chainId, address) {
    if (address) {
      throw new Error('Not implemented: only single account allowed now.');
    }

    return (await this.getSlaveContracts())[chainId];
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

  async _wrapWithOuter(innerMsg, signerAddress) {
    return {
      typeUrl: EXECUTE_MSG_TYPE_URL,
      value: {
        sender: signerAddress,
        contract: await this.getHostContract(),
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
    const wrappedMsg = await this._wrapWithOuter(
      toBinary(innerMsg),
      account.address,
    );

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

  async addressToChainId(signerAddress) {
    for (const [chainId, addr] of Object.entries(
      await this.getSlaveContracts(),
    )) {
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

    const chainId = await this.addressToChainId(signerAddress);
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

  async signDirect(signerAddress, signDoc, _password = null) {
    throw new Error('Direct signing not supported yet.');
  }
}
