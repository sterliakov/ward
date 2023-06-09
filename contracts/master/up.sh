#! /usr/bin/env bash

set -euo pipefail

if [ -z "${HOST_CODE_ID+x}" ]; then
	echo "Missing HOST_CODE_ID" >&2
	exit 1
fi
if [ -z "${SLAVE_CODE_ID+x}" ]; then
	echo "Missing SLAVE_CODE_ID" >&2
	exit 1
fi
cargo run-script optimize
CHAIN_ID=foo-1
TXFLAG="--chain-id $CHAIN_ID --gas-prices 0.025stake --gas auto --gas-adjustment 1.3"
wasmd tx wasm store artifacts/master.wasm --from main $TXFLAG -y --output json -b block
CODE_ID=$(wasmd query wasm list-code --output json | jq -r '.code_infos[-1].code_id')
wasmd tx wasm instantiate $CODE_ID '{"host_code_id": '"$HOST_CODE_ID"', "slave_code_ids": {"'"$CHAIN_ID"'": '"$SLAVE_CODE_ID"'},"host_chain": "'"$CHAIN_ID"'"}' --from main --chain-id $CHAIN_ID --label 'Test' --admin main
sleep 5
CONTRACT=$(wasmd query wasm list-contract-by-code $CODE_ID --output json | jq -r '.contracts[-1]')
echo "Contract" $CONTRACT
echo "Code ID" $CODE_ID
