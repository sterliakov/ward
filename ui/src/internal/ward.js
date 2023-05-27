import {encodeSecp256k1Signature} from '@cosmjs/amino';
import {CosmWasmClient} from '@cosmjs/cosmwasm-stargate';
import {Secp256k1, sha256} from '@cosmjs/crypto';
import {DirectSecp256k1HdWallet, makeSignBytes} from '@cosmjs/proto-signing';

const HOST_CHAIN = {
  rpc: 'http://localhost:26657/',
  chainId: 'foo-1',
  prefix: 'wasm',
};
const SLAVE_CHAINS = {
  'foo-1': {
    rpc: 'http://localhost:26657/',
    prefix: 'wasm',
    name: 'testnet',
    denoms: ['stake'],
  },
};
const HOST_CONTRACT_ADDRESS =
  'wasm14hj2tavq8fpesdwxxcu44rty3hh90vhujrvcmstl4zr3txmfvw9s0phg4d';
const SLAVE_ADDRESSES = {
  'foo-1': 'wasm1nc5tatafv6eyq7llkr2gv50ff9e22mnf70qgjlv737ktmt4eswrqr5j2ht',
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
      throw new Error('Password does not match.');
    }
  }

  async getBalance(chainId, denom) {
    const chain = SLAVE_CHAINS[chainId];
    if (typeof chain === 'undefined') {
      throw new Error('Unknown chain.');
    }
    const addr = SLAVE_ADDRESSES[chainId];
    const client = await CosmWasmClient.connect(chain.rpc);
    const balance = await client.getBalance(addr, denom);
    await client.disconnect();
    console.log(chainId, denom, addr, balance);
    return balance;
  }

  async getAllBalances() {
    return Promise.all(
      Object.entries(SLAVE_CHAINS).map(
        async ([chainId, {rpc, name, denoms}]) => ({
          chainId,
          name,
          balances: await Promise.all(
            denoms.map(async (denom) => this.getBalance(chainId, denom)),
          ),
        }),
      ),
    );
  }

  async sign(signerAddress, password, signDoc, mode) {
    if (mode === 'direct') {
      return this.signDirect(signerAddress, password, signDoc);
    }
    else throw new Error('Unknown sign mode.');
  }

  async signDirect(signerAddress, password, signDoc) {
    if (!password) {
      const response = await request(
        {
          type: 'sign',
          tx: signDoc,
          signMode: 'direct',
          signer: signerAddress,
        },
        'sign',
      );
      const {signature, signed} = response.request;
      return {signature, signed};
    }
    // FIXME: this shouldn't use passed signerAddress.
    const account = await this.getAccountWithPrivkey(password, signerAddress);
    if (account === undefined) {
      throw new Error(`Address ${signerAddress} not found in wallet`);
    }
    const {privkey, pubkey} = account;
    const signBytes = makeSignBytes(signDoc);
    const hashedMessage = sha256(signBytes);
    const signature = await Secp256k1.createSignature(hashedMessage, privkey);
    const signatureBytes = new Uint8Array([
      ...signature.r(32),
      ...signature.s(32),
    ]);
    const stdSignature = encodeSecp256k1Signature(pubkey, signatureBytes);
    return {
      signed: signDoc,
      signature: stdSignature,
    };
  }
}
