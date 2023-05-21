#! /usr/bin/env bash

set -euo pipefail

if [ -z "$HOST" ]; then
	echo "Missing HOST" >&2
	exit 1
fi
cargo run-script optimize
CHAIN_ID=injective-1
TXFLAG="--chain-id $CHAIN_ID --gas-prices 0.025stake --gas auto --gas-adjustment 1.3"
wasmd tx wasm store artifacts/slave_samechain.wasm --from main $TXFLAG -y --output json -b block
CODE_ID=$(wasmd query wasm list-code --output json | jq -r '.code_infos[-1].code_id')
wasmd tx wasm instantiate $CODE_ID '{"owner": "'"$HOST"'"}' --from main --chain-id $CHAIN_ID --label 'Test' --no-admin
sleep 5
CONTRACT=$(wasmd query wasm list-contract-by-code $CODE_ID --output json | jq -r '.contracts[-1]')
echo $CONTRACT