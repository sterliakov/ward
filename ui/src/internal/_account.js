'use strict';
var __importDefault =
  (this && this.__importDefault)
  || function (mod) {
    return mod && mod.__esModule ? mod : {default: mod};
  };
Object.defineProperty(exports, '__esModule', {value: true});
exports.EthAccount = void 0;
/* eslint-disable */
const minimal_1 = __importDefault(require('protobufjs/minimal'));
const auth_1 = require('cosmjs-types/cosmos/auth/v1beta1/auth');
function createBaseEthAccount() {
  return {baseAccount: undefined, codeHash: new Uint8Array()};
}
exports.EthAccount = {
  encode(message, writer = minimal_1.default.Writer.create()) {
    if (message.baseAccount !== undefined) {
      auth_1.BaseAccount
        .encode(message.baseAccount, writer.uint32(10).fork())
        .ldelim();
    }
    if (message.codeHash.length !== 0) {
      writer.uint32(18).bytes(message.codeHash);
    }
    return writer;
  },
  decode(input, length) {
    const reader =
      input instanceof minimal_1.default.Reader
        ? input
        : minimal_1.default.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseEthAccount();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
      case 1:
        if (tag !== 10) {
          break;
        }
        message.baseAccount = auth_1.BaseAccount.decode(
          reader,
          reader.uint32(),
        );
        continue;
      case 2:
        if (tag !== 18) {
          break;
        }
        message.codeHash = reader.bytes();
        continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },
  fromJSON(object) {
    return {
      baseAccount: isSet(object.baseAccount)
        ? auth_1.BaseAccount.fromJSON(object.baseAccount)
        : undefined,
      codeHash: isSet(object.codeHash)
        ? bytesFromBase64(object.codeHash)
        : new Uint8Array(),
    };
  },
  toJSON(message) {
    const obj = {};
    message.baseAccount !== undefined
      && (obj.baseAccount = message.baseAccount
        ? auth_1.BaseAccount.toJSON(message.baseAccount)
        : undefined);
    message.codeHash !== undefined
      && (obj.codeHash = base64FromBytes(
        message.codeHash !== undefined ? message.codeHash : new Uint8Array(),
      ));
    return obj;
  },
  create(base) {
    return exports.EthAccount.fromPartial(
      base !== null && base !== void 0 ? base : {},
    );
  },
  fromPartial(object) {
    var _a;
    const message = createBaseEthAccount();
    message.baseAccount =
      object.baseAccount !== undefined && object.baseAccount !== null
        ? auth_1.BaseAccount.fromPartial(object.baseAccount)
        : undefined;
    message.codeHash =
      (_a = object.codeHash) !== null && _a !== void 0 ? _a : new Uint8Array();
    return message;
  },
};
var tsProtoGlobalThis = (() => {
  if (typeof globalThis !== 'undefined') {
    return globalThis;
  }
  if (typeof self !== 'undefined') {
    return self;
  }
  if (typeof window !== 'undefined') {
    return window;
  }
  if (typeof global !== 'undefined') {
    return global;
  }
  throw 'Unable to locate global object';
})();
function bytesFromBase64(b64) {
  if (tsProtoGlobalThis.Buffer) {
    return Uint8Array.from(tsProtoGlobalThis.Buffer.from(b64, 'base64'));
  }
  else {
    const bin = tsProtoGlobalThis.atob(b64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; ++i) {
      arr[i] = bin.charCodeAt(i);
    }
    return arr;
  }
}
function base64FromBytes(arr) {
  if (tsProtoGlobalThis.Buffer) {
    return tsProtoGlobalThis.Buffer.from(arr).toString('base64');
  }
  else {
    const bin = [];
    arr.forEach((byte) => {
      bin.push(String.fromCharCode(byte));
    });
    return tsProtoGlobalThis.btoa(bin.join(''));
  }
}
function isSet(value) {
  return value !== null && value !== undefined;
}
