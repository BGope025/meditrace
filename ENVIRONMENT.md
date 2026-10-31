# MediTrace environment requirements

The repository already contains local `.env` files, but they should not be committed or copied into deployment logs. Values below are names only; private keys and tokens must be generated and supplied through the deployment environment.

| Workspace | Variable | Required | Purpose |
|---|---|---:|---|
| Backend | `DATABASE_URL` | Yes for PostgreSQL | PostgreSQL connection string. The backend falls back to an in-memory database when PostgreSQL is unavailable. |
| Backend | `PORT` | No | Express port; defaults to `3000`. |
| Backend | `NODE_ENV` | No | Runtime mode. |
| Backend | `ACCESS_TOKEN_SECRET` | Recommended | JWT signing secret if authenticated routes are enabled. |
| Backend | `RPC_URL` | Required for local chain writes | Local Hardhat JSON-RPC endpoint, normally `http://127.0.0.1:8545`. |
| Backend | `PRIVATE_KEY` | Optional for read-only mode; required for server-side chain writes | EVM signer used by the backend contract client. Never expose this to the browser. |
| Backend | `BATCH_REGISTRY_ADDRESS` | Required for live contract writes | Deployed `BatchRegistry` contract address. |
| Backend | `ACCESS_MANAGER_ADDRESS` | Optional | Deployed access-manager address; currently used for contract client initialization. |
| Contracts/Backend | `TELEMETRY_ORACLE_ADDRESS` | Recommended for live breach evidence | Wallet granted `TELEMETRY_ORACLE_ROLE`; normally the backend signer address. |
| Client | `NEXT_PUBLIC_BACKEND_URL` | Recommended | Backend API origin, for example `http://localhost:3000/api`; defaults to `/api`. |
| Client | `NEXT_PUBLIC_RPC_URL` | Required for local chain reads | Browser-safe local Hardhat RPC endpoint used by Viem. |
| Client | `NEXT_PUBLIC_BATCH_REGISTRY_ADDRESS` | Optional for public chain reads | Browser-safe deployed registry address. |
| Client | `NEXT_PUBLIC_NETWORK_NAME` | No | Display label; fixed to `Local Hardhat` in the local demo. |
| Simulator | `BACKEND_URL` | Required to send telemetry | Full telemetry ingest endpoint, normally ending in `/api/telemetry/ingest`. |
| Contracts | `RPC_URL` | No | Local Hardhat JSON-RPC endpoint; the deployment script uses the unlocked local node account. |
| Contracts | `PRIVATE_KEY` | No for `localhost` deployment | Optional signer for scripts that need an explicit wallet; never commit it. |
| Contracts | `HARDHAT_NETWORK` | Optional | Use `localhost` for the standalone local node. |

## Current local configuration audit

The local workflow uses Hardhat only. Start `npx hardhat node`, deploy with `npx hardhat run scripts/deploy.js --network localhost`, then copy the printed registry address into the backend and client environment files.

No third-party API key or testnet account is required for the current UI. QR scanning runs in the browser, telemetry uses the existing backend, and wallet signing is supplied by the user’s local EVM wallet. The local Hardhat node supplies free development ETH for transaction gas.

The deployed `BatchRegistry` must grant `TELEMETRY_ORACLE_ROLE` to the backend signer before unsafe telemetry can be anchored on-chain. The deployment script accepts `TELEMETRY_ORACLE_ADDRESS`; if omitted on local Hardhat, it grants the role to the fifth local signer.

## Security notes

Do not prefix private keys, database credentials, or signing secrets with `NEXT_PUBLIC_`. Do not commit any `.env` file. Rotate the local `ACCESS_TOKEN_SECRET` and any sample private key before sharing or deploying the project.
