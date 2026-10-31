# MediTrace Algorand TestNet plan

## Decision

For an Algorand version of MediTrace, use Pera Wallet with `@perawallet/connect`, `algosdk`, an Algorand application, and Algorand TestNet. MetaMask cannot be the signing wallet for native Algorand transactions. Pera Connect supports dApp connection and transaction signing, and its TestNet chain ID is `416002`.

The current Solidity `.sol` contracts cannot run on Algorand. The batch registry must be reimplemented as an Algorand application using Algorand TypeScript/PuyaTS or PyTeal. AlgoKit is the recommended deployment and testing workflow.

## Recommended architecture

```text
Pera Wallet
  -> signs user role transactions
Algorand TestNet
  -> app call transactions and ALGO fees
Algorand application
  -> batch state, roles, custody, breach evidence
algod client
  -> suggested params, submit, confirmation
Indexer client
  -> historical transactions and explorer queries
MediTrace backend
  -> verifies sensor signatures, creates unsigned app calls, indexes records
MediTrace client
  -> connects Pera, displays balance and realtime transaction state
```

Use an Algorand application with box storage for per-batch provenance and breach records. Boxes support dynamic key/value storage up to 32 KB per box, but the application account must carry the minimum balance required for the boxes. Keep large telemetry history in PostgreSQL and anchor only the signed reading hash, breach state, timestamps, and key provenance fields on-chain.

## Role mapping

- Admin: application creator/admin address; grants and revokes role addresses.
- Manufacturer: creates a batch.
- Distributor: accepts or transfers custody.
- Pharmacy: confirms delivery.
- Telemetry oracle: backend signer that anchors verified sensor evidence.
- Sensor: separate Algorand account or off-chain Ed25519 identity whose signed payload hash is anchored by the oracle.

The app must validate sender roles on every state-changing application call. The frontend should hide or disable actions based on roles, but the Algorand application must remain the final authorization layer.

## Realtime transaction flow

1. Client asks backend for a prepared unsigned application-call transaction containing the batch ID, action, nonce, and app arguments.
2. Backend returns the unsigned transaction and an action ID.
3. Pera signs the transaction through `signTransaction`.
4. Client sends the signed bytes to the backend.
5. Backend submits through `algod.sendRawTransaction`.
6. Backend immediately returns the transaction ID and `pending` status.
7. Backend or client polls `algod.pendingTransactionInformation(txid)` until the confirmed round is non-zero or a pool error appears. Use a bounded timeout and surface `confirmed`, `failed`, or `timeout`.
8. After confirmation, query Indexer for the transaction/application logs and update the API/database record.
9. The UI displays transaction ID, confirmed round, app ID, and an Algorand TestNet explorer link.

Do not treat a transaction ID as confirmed merely because it was accepted by algod. Confirmation requires a confirmed round and no pool error.

## TestNet setup

1. Install Pera Wallet from the official Pera Wallet site and enable TestNet/developer mode.
2. Create a development-only account. Never use a mainnet account or real ALGO.
3. Copy the Algorand address from Pera.
4. Fund the address through the Algorand TestNet faucet/dispenser. The official funding guide states that TestNet faucet funding provides test ALGO; it also documents the optional dispenser API.
5. Deploy the Algorand application with AlgoKit to TestNet.
6. Fund the application address for minimum balance and box storage.
7. Put the app ID and network endpoints into the backend/client environment.

## Configuration inventory

### Browser-safe client values

```env
NEXT_PUBLIC_ALGORAND_NETWORK=testnet
NEXT_PUBLIC_ALGORAND_CHAIN_ID=416002
NEXT_PUBLIC_ALGOD_SERVER=https://testnet-api.algonode.cloud
NEXT_PUBLIC_ALGOD_PORT=
NEXT_PUBLIC_INDEXER_SERVER=https://testnet-idx.algonode.cloud
NEXT_PUBLIC_INDEXER_PORT=
NEXT_PUBLIC_ALGORAND_APP_ID=
NEXT_PUBLIC_ALGORAND_EXPLORER_URL=https://lora.algokit.io/testnet
```

These are endpoints and IDs, not private credentials. If a managed provider is used instead of public Algonode endpoints, provider tokens must not be exposed in `NEXT_PUBLIC_` variables unless the provider explicitly supports browser exposure.

### Backend values

```env
ALGORAND_NETWORK=testnet
ALGOD_SERVER=https://testnet-api.algonode.cloud
ALGOD_PORT=
ALGOD_TOKEN=
INDEXER_SERVER=https://testnet-idx.algonode.cloud
INDEXER_PORT=
INDEXER_TOKEN=
ALGORAND_APP_ID=
ALGORAND_ADMIN_MNEMONIC=
ALGORAND_ORACLE_MNEMONIC=
ALGORAND_SENSOR_PUBLIC_KEY=
```

The admin and oracle secrets must remain server-side. Prefer a secure secret store in deployment. Never put them in `NEXT_PUBLIC_` variables or commit them.

### Optional deployment/faucet value

```env
ALGOKIT_DISPENSER_ACCESS_TOKEN=
```

This is only needed for automated TestNet dispenser API funding/CI. It is not required when funding the Pera account manually through the faucet.

## What is not needed

- No MetaMask for Algorand signing.
- No Ethereum RPC URL.
- No Ethereum private key for Pera users.
- No custom payment token.
- No ALGO payment from patients/pharmacists to verify medicine.
- No Etherscan API key.

ALGO is needed only for TestNet transaction fees and Algorand minimum-balance requirements. The test ALGO has no real-world value.

## Sources

- Pera Connect: https://docs.perawallet.app/references/pera-connect/
- Algorand account funding and TestNet dispenser: https://dev.algorand.co/concepts/accounts/funding/
- Official JavaScript SDK: https://github.com/algorand/js-algorand-sdk
- Algorand box storage: https://dev.algorand.co/concepts/smart-contracts/storage/box/
- Algorand TypeScript contracts: https://dev.algorand.co/concepts/smart-contracts/languages/typescript/
