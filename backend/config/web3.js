const { ethers, Network } = require('ethers');
require('dotenv').config();

// Local-only demo network. The backend never falls back to a public testnet.
const rpcUrl = process.env.RPC_URL || 'http://127.0.0.1:8545';
const networkConfig = { chainId: 1337, name: 'hardhat' };

// Pass staticNetwork so ethers does not enter an infinite 1s polling retry loop when the local EVM node is offline
const staticNet = Network.from(networkConfig);
const provider = new ethers.JsonRpcProvider(
  rpcUrl,
  staticNet,
  { staticNetwork: staticNet }
);

// Wallet from private key (if available)
let wallet;
if (process.env.PRIVATE_KEY) {
  wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
} else {
  wallet = null; // For read-only operations
}

// Contract ABI (simplified - in practice, load from artifacts)
const batchRegistryABI = [
  "event BatchCreated(uint256 indexed batchId, string drugName, address indexed manufacturer, uint256 timestamp)",
  "event StateChanged(uint256 indexed batchId, uint8 oldState, uint8 newState, uint256 timestamp)",
  "function createBatch(string memory _drugName) external returns (uint256)",
  "function flagBreach(uint256 batchId) external",
  "function recordTemperature(uint256 batchId, int256 temperatureCenti, uint256 observedAt, address sensor, bytes32 evidenceHash) external returns (bool isSafe)",
  "function transferBatch(uint256 batchId, address newCustodian) external",
  "function confirmDelivery(uint256 batchId) external",
  "function getBatch(uint256 batchId) external view returns (string memory drugName, address manufacturer, uint8 state, uint256 timestamp)",
  "function getBreachHistory(uint256 batchId) external view returns (tuple(int256 temperatureCenti, uint256 observedAt, uint256 recordedAt, address sensor, bytes32 evidenceHash)[])",
  "function grantManufacturerRole(address account) external",
  "function grantDistributorRole(address account) external",
  "function grantPharmacyRole(address account) external"
];

const accessManagerABI = [
  "function grantRole(bytes32 role, address account) external",
  "function revokeRole(bytes32 role, address account) external",
  "function hasRole(bytes32 role, address account) public view returns (bool)"
];

// Contract addresses (should be set via environment variables after deployment)
const BATCH_REGISTRY_ADDRESS = process.env.BATCH_REGISTRY_ADDRESS || '';
const ACCESS_MANAGER_ADDRESS = process.env.ACCESS_MANAGER_ADDRESS || '';

// Contract instances
let batchRegistryContract = null;
let accessManagerContract = null;

if (BATCH_REGISTRY_ADDRESS && wallet) {
  batchRegistryContract = new ethers.Contract(BATCH_REGISTRY_ADDRESS, batchRegistryABI, wallet);
}

if (ACCESS_MANAGER_ADDRESS && wallet) {
  accessManagerContract = new ethers.Contract(ACCESS_MANAGER_ADDRESS, accessManagerABI, wallet);
}

function initializeWeb3() {
  // This function can be called to re-initialize if needed
  // For now, we just return the provider and contracts
  return {
    provider,
    wallet,
    batchRegistryContract,
    accessManagerContract
  };
}

module.exports = {
  initializeWeb3,
  provider,
  wallet,
  batchRegistryContract,
  accessManagerContract
};
