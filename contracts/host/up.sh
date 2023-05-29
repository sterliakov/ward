#! /usr/bin/env bash

set -euo pipefail

cargo run-script optimize
CHAIN_ID=foo-1
TXFLAG="--chain-id $CHAIN_ID --gas-prices 0.025stake --gas auto --gas-adjustment 1.3"
wasmd tx wasm store artifacts/host.wasm --from main $TXFLAG -y --output json -b block
CODE_ID=$(wasmd query wasm list-code --output json | jq -r '.code_infos[-1].code_id')
# wasmd tx wasm instantiate $CODE_ID '{"recovery_pool": [], "approval_pool": [], "recovery_approvals_needed": 1, "transfer_ownership_approvals_needed": 1}' --from main --chain-id $CHAIN_ID --label 'Test' --no-admin
# sleep 5
# CONTRACT=$(wasmd query wasm list-contract-by-code $CODE_ID --output json | jq -r '.contracts[-1]')
# echo "Contract" $CONTRACT
echo "Code ID" $CODE_ID
