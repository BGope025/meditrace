# MediTrace Algorand API

These routes provide the transaction lifecycle for the Algorand TestNet migration. They require `ALGORAND_APP_ID` to point to a deployed MediTrace Algorand application.

## Configuration

```env
ALGORAND_NETWORK=testnet
ALGOD_SERVER=https://testnet-api.algonode.cloud
ALGOD_TOKEN=
INDEXER_SERVER=https://testnet-idx.algonode.cloud
INDEXER_TOKEN=
ALGORAND_APP_ID=123456789
```

The current service uses the TestNet chain ID `416002`. No provider API key is required when using the public Algonode endpoints, although `ALGOD_TOKEN` and `INDEXER_TOKEN` are supported for managed providers.

## Routes

### `GET /api/algorand/config`

Returns the configured network, app ID, algod endpoint, indexer endpoint, and chain ID. It never returns private keys.

### `GET /api/algorand/account/:address`

Reads the TestNet ALGO amount and minimum balance for a valid Algorand address.

### `POST /api/algorand/app-call/prepare`

Creates an unsigned ARC-4 application no-op transaction for the deployed BatchRegistry app. The `method` value is mapped to the generated ARC-56 interface and encoded with its method selector and typed arguments. Example:

```json
{
  "sender": "PUBLIC_ALGORAND_ADDRESS",
  "method": "transferBatch",
  "args": [1, "NEW_CUSTODIAN_ADDRESS"],
  "boxes": ["batch:batch_001"]
}
```

Supported deployed methods include `createBatch`, `transferBatch`, `confirmDelivery`, `recordTemperature`, `flagBreach`, the role methods, and the generated view methods. The service returns a base64 unsigned transaction with the correct ARC-4 selector and ABI encoding.

### `POST /api/algorand/transactions/submit`

Accepts Pera-signed transaction bytes:

```json
{
  "signedTxn": "BASE64_SIGNED_TRANSACTION"
}
```

It submits through `algod` and returns a transaction ID with `submitted` status.

### `POST /api/algorand/transactions/submit-and-confirm`

Submits through `algod`, waits for confirmation, and returns the transaction ID, confirmed round, pool error, and application index.

### `GET /api/algorand/transactions/:txId/confirm`

Waits for confirmation with a bounded round timeout.

### `GET /api/algorand/transactions/:txId`

Reads the confirmed transaction through Indexer.

### `POST /api/algorand/batches/record`

Creates or updates the PostgreSQL read-model row after a confirmed `createBatch` transaction. It stores the Algorand app ID, numeric on-chain batch ID when known, transaction ID, and confirmed round.

### `POST /api/algorand/batches/sync`

Synchronizes the lifecycle state and confirmation metadata for an existing local batch after `transferBatch`, `confirmDelivery`, or `flagBreach`.

## Security requirements before production use

The generic prepare route must be placed behind application authentication and role validation before it is exposed publicly. The Algorand application remains the final authorization layer, but the backend should also verify that the requested sender is the connected wallet and that the action is allowed for that role.

The service does not store Pera private keys. Pera signs in the user’s wallet. Server-side admin/oracle operations require separate backend-controlled Algorand accounts stored in a secret manager.
