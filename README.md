This repository is a home of Ward wallet - a crypto wallet for Cosmos-compatible chains,
currently deployed on Injective testnet.

*Ward - bigger inside than it appears.*

## Building the contracts

In every sub-crate under [contracts](./contracts/), run `cargo run-script optimize` to
build desired code in `artifacts` folder. See `up.sh` script for reference, it works
with local `wasmd` chains.

## Building the extension (frontend)

In [ui](./ui/) folder, execute `npm install` and `npm run build` to build the code.

Resulting `ui/build` folder can be used as a ready-to-use Chrome extension (installable in
developer mode). It can also be packed into `.crx` archive in Chrome for easier sharing.

In case of any failures, pre-built `.crx` for Injective testnet is attached to the latest release.

We rely on `patch-package` to fix broken dependencies, but I cannot say for sure that
all necessary patches are kept there - development was too rapid due to extremely tough
deadlines.
