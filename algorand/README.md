# MediTrace Algorand contract workspace

This directory defines the contract boundary for the Algorand migration. The Algorand TEALScript contract is implemented in `contracts/contracts/BatchRegistry.ts`, compiled artifacts are in `contracts/artifacts/`, and the deployed TestNet application is `775273559`. The current Solidity contracts remain in `contracts/` as the legacy EVM implementation.

## Required application methods

The Algorand application must accept the following first application argument values:

- `create_batch`
- `transfer_custody`
- `confirm_delivery`
- `record_temperature`
- `flag_breach`
- `grant_role`
- `revoke_role`

The backend transaction service in `backend/services/algorand.service.js` encodes the ARC-4 method selector and typed arguments using the deployed `BatchRegistry.arc56.json` interface.

## Required state

The application must maintain or expose:

- role membership for admin, manufacturer, distributor, pharmacy, and telemetry oracle addresses;
- batch drug name, manufacturer, current custodian, lifecycle state, and timestamps;
- custody transfer records;
- breach evidence hash, sensor address, temperature, and observation time;
- safe temperature bounds and a breached terminal state.

Detailed telemetry should remain in PostgreSQL. The app should anchor the signed payload hash and the state transition on-chain.

## Recommended implementation

Implement this workspace with AlgoKit and Algorand TypeScript/PuyaTS. Generate an ARC-56 or ARC-32 application specification and use it to create a typed client. Deploy to Algorand TestNet using the funded Pera/TestNet deployment account, then set:

```env
NEXT_PUBLIC_ALGORAND_APP_ID=<deployed app id>
ALGORAND_APP_ID=<deployed app id>
```

The current TestNet App ID is `775273559`. Do not reuse the EVM contract address as an Algorand App ID.
