import {CosmWasmClient as OrigCosmWasmClient} from '@cosmjs/cosmwasm-stargate';
import {Uint64} from '@cosmjs/math';
import {decodePubkey} from '@cosmjs/proto-signing';
import {accountFromAny} from '@cosmjs/stargate';
import {Tendermint34Client, Tendermint37Client} from '@cosmjs/tendermint-rpc';

import {EthAccount} from './_account';

export function uint64FromProto(input) {
  return Uint64.fromString(input.toString());
}

export function accountFromBaseAccount(input) {
  const {address, pubKey, accountNumber, sequence} = input;
  const pubkey = pubKey ? decodePubkey(pubKey) : null;
  return {
    address: address,
    pubkey: pubkey,
    accountNumber: uint64FromProto(accountNumber).toNumber(),
    sequence: uint64FromProto(sequence).toNumber(),
  };
}

export class CosmWasmClient extends OrigCosmWasmClient {
  async getAccount(searchAddress) {
    try {
      const account = await this.forceGetQueryClient().auth.account(
        searchAddress,
      );
      const {typeUrl, value} = account;
      if (typeUrl === '/injective.types.v1beta1.EthAccount') {
        const baseAcct = EthAccount.decode(value).baseAccount;
        return accountFromBaseAccount(baseAcct);
      }
      return account ? accountFromAny(account) : null;
    }
    catch (error) {
      if (/rpc error: code = NotFound/i.test(error.toString())) {
        return null;
      }
      throw error;
    }
  }

  static async connect(endpoint) {
    let tmClient;
    const tm37Client = await Tendermint37Client.connect(endpoint);
    const version = (await tm37Client.status()).nodeInfo.version;
    if (version.startsWith('0.37.')) {
      tmClient = tm37Client;
    }
    else {
      tm37Client.disconnect();
      tmClient = await Tendermint34Client.connect(endpoint);
    }

    return CosmWasmClient.create(tmClient);
  }

  static async create(tmClient) {
    return new CosmWasmClient(tmClient);
  }
}
