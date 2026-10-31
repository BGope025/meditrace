# MediTrace Monorepo

A blockchain-based supply chain tracking system for pharmaceutical temperature monitoring.

## Architecture Overview

The MediTrace system consists of four main components:
1. **Smart Contract Layer** (Solidity/Hardhat) - On-chain batch registry and access control
2. **Backend API** (Node.js/Express) - Gateway for sensor data and blockchain interactions
3. **IoT Edge Simulator** (Node.js) - Simulates temperature sensors with cryptographic signing
4. **Frontend Dashboard** (Next.js/Tailwind) - User interface for logistics and consumers

## Setup Instructions

1. Install dependencies:
   ```bash
   npm run install-all
   ```

2. Set up environment variables:
   - Copy `.env.example` to `.env` in each workspace and fill in required values
   - Required variables include RPC URLs, private keys, and database connection strings

3. Start local services (PostgreSQL/Redis):
   ```bash
   docker-compose up -d
   ```

4. Deploy smart contracts (to local network or testnet):
   ```bash
   npm run deploy --workspace=contracts
   ```

5. Start development servers:
   ```bash
   npm run dev
   ```

## Failure Modes Addressed

This system addresses key failure modes in pharmaceutical supply chains:
- Gas bankruptcy via over-logging (exception-based on-chain writing)
- Race conditions and out-of-order execution (smart contract state locks)
- Oracle problem (event-driven indexing)
- IoT payload spoofing (cryptographic edge signatures)
- Connection dropouts (store-and-forward)
- RPC rate limiting (backend caching layer)

## Workspaces

- `contracts`: Hardhat-based smart contracts
- `backend`: Node.js/Express API gateway
- `simulator`: IoT edge simulation scripts
- `client`: Next.js frontend dashboard

## License

MIT