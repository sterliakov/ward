import {encodeSecp256k1Signature} from '@cosmjs/amino';
import {Secp256k1, sha256} from '@cosmjs/crypto';
import {DirectSecp256k1HdWallet, makeSignBytes} from '@cosmjs/proto-signing';

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
export async function getKey(key) {
  console.log(`Fetching value of key ${key}`);
  const response = await request({type: 'getKey', key}, 'getKey');
  return response.result[key];
}
export async function setKey(key, value) {
  console.log(`Setting value of key ${key} to ${value}`);
  return request({type: 'setKey', key, value}, 'setKey');
}

export default class Ward {
  static async createFromMnemonic(mnemonic, ourPassword, opts = {}) {
    const wallet = await DirectSecp256k1HdWallet.fromMnemonic(mnemonic, opts);
    const stored = await wallet.serialize(ourPassword);
    const {address} = (await wallet.getAccounts())[0];
    await setKey(`__WARD_${address}`, stored);
  }

  async createFromMnemonic(mnemonic, ourPassword, opts = {}) {
    return Ward.createFromMnemonic(mnemonic, ourPassword, opts);
  }

  async getAccountWithPrivkey(address, password) {
    const stored = await getKey(`__WARD_${address}`);
    if (!stored) throw new Error('Address not found.');
    const wallet = await DirectSecp256k1HdWallet.deserialize(stored, password);
    return (await wallet.getAccountsWithPrivkeys())[0];
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
    const account = await this.getAccountWithPrivkey(signerAddress, password);
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
