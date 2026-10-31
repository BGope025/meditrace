import { createPublicClient, defineChain, http, parseAbi, parseAbiItem } from 'viem';

const address = process.env.NEXT_PUBLIC_BATCH_REGISTRY_ADDRESS as `0x${string}` | undefined;
const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || 'http://127.0.0.1:8545';

export const localHardhat = defineChain({
  id: 1337,
  name: 'Local Hardhat',
  network: 'hardhat',
  nativeCurrency: { name: 'Local Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [rpcUrl] }, public: { http: [rpcUrl] } },
});

export const batchRegistryABI = parseAbi([
  'function getBatch(uint256 batchId) external view returns (string drugName, address manufacturer, uint8 state, uint256 timestamp)',
  'function getBatchDetails(uint256 batchId) external view returns (string drugName, address manufacturer, address currentCustodian, uint8 state, uint256 timestamp, uint256 lastUpdatedAt)',
  'function getCustodyHistory(uint256 batchId) external view returns ((address,address,address,uint256)[])',
  'function getBreachHistory(uint256 batchId) external view returns ((int256,uint256,uint256,address,bytes32)[])',
  'event BatchCreated(uint256 indexed batchId, string drugName, address indexed manufacturer, uint256 timestamp)',
  'event StateChanged(uint256 indexed batchId, uint8 oldState, uint8 newState, uint256 timestamp)',
  'event CustodyTransferred(uint256 indexed batchId, address indexed from, address indexed to, address actor, uint256 timestamp)',
  'event TemperatureRecorded(uint256 indexed batchId, int256 temperatureCenti, uint256 observedAt, address indexed sensor, bytes32 evidenceHash)',
  'event TemperatureBreachRecorded(uint256 indexed batchId, int256 temperatureCenti, uint256 observedAt, address indexed sensor, bytes32 evidenceHash)',
]);

export const blockchainClient = createPublicClient({
  chain: localHardhat,
  transport: http(rpcUrl),
});

export const registryAddress = address;
export const explorerNetwork = 'Local Hardhat';
export const blockExplorerBaseUrl = process.env.NEXT_PUBLIC_BLOCK_EXPLORER_URL || '';

export type ExplorerEvent = {
  type: string;
  blockNumber: string;
  transactionHash: string;
  logIndex: string;
  args: Record<string, string>;
};

function asString(value: unknown) {
  return typeof value === 'bigint' ? value.toString() : String(value);
}

function asAddress(value: unknown) {
  return String(value);
}

export async function getBatchFromBlockchain(batchId: bigint) {
  if (!address) throw new Error('Batch registry contract address is not configured.');
  const batch = await blockchainClient.readContract({ address, abi: batchRegistryABI, functionName: 'getBatch', args: [batchId] });
  return { drugName: batch[0], manufacturer: batch[1], state: Number(batch[2]), timestamp: batch[3] };
}

export async function readBatchProvenance(batchId: bigint) {
  if (!address) throw new Error('Batch registry contract address is not configured.');
  const [batch, custody, breaches, latestBlock] = await Promise.all([
    blockchainClient.readContract({ address, abi: batchRegistryABI, functionName: 'getBatchDetails', args: [batchId] }),
    blockchainClient.readContract({ address, abi: batchRegistryABI, functionName: 'getCustodyHistory', args: [batchId] }),
    blockchainClient.readContract({ address, abi: batchRegistryABI, functionName: 'getBreachHistory', args: [batchId] }),
    blockchainClient.getBlockNumber(),
  ]);

  const eventDefinitions = [
    ['BatchCreated', parseAbiItem('event BatchCreated(uint256 indexed batchId, string drugName, address indexed manufacturer, uint256 timestamp)')],
    ['StateChanged', parseAbiItem('event StateChanged(uint256 indexed batchId, uint8 oldState, uint8 newState, uint256 timestamp)')],
    ['CustodyTransferred', parseAbiItem('event CustodyTransferred(uint256 indexed batchId, address indexed from, address indexed to, address actor, uint256 timestamp)')],
    ['TemperatureRecorded', parseAbiItem('event TemperatureRecorded(uint256 indexed batchId, int256 temperatureCenti, uint256 observedAt, address indexed sensor, bytes32 evidenceHash)')],
    ['TemperatureBreachRecorded', parseAbiItem('event TemperatureBreachRecorded(uint256 indexed batchId, int256 temperatureCenti, uint256 observedAt, address indexed sensor, bytes32 evidenceHash)')],
  ] as const;

  const custodyRecords = custody as readonly [string, string, string, bigint][];
  const breachRecords = breaches as readonly [bigint, bigint, bigint, string, string][];

  const events = (await Promise.all(eventDefinitions.map(async ([type, event]) => {
    const logs = await blockchainClient.getLogs({ address, event, args: { batchId }, fromBlock: BigInt(0), toBlock: latestBlock });
    return logs.map((log) => ({
      type,
      blockNumber: asString(log.blockNumber),
      transactionHash: asString(log.transactionHash),
      logIndex: asString(log.logIndex),
      args: Object.fromEntries(Object.entries(log.args || {}).filter(([key]) => !/^\d+$/.test(key)).map(([key, value]) => [key, asString(value)])),
    }));
  }))).flat().sort((left, right) => Number(left.blockNumber) - Number(right.blockNumber) || Number(left.logIndex) - Number(right.logIndex));

  return {
    batch: {
      drugName: batch[0],
      manufacturer: asAddress(batch[1]),
      currentCustodian: asAddress(batch[2]),
      state: Number(batch[3]),
      timestamp: asString(batch[4]),
      lastUpdatedAt: asString(batch[5]),
    },
    custody: custodyRecords.map((record) => ({ from: asAddress(record[0]), to: asAddress(record[1]), actor: asAddress(record[2]), timestamp: asString(record[3]) })),
    breaches: breachRecords.map((record) => ({ temperatureCenti: asString(record[0]), observedAt: asString(record[1]), recordedAt: asString(record[2]), sensor: asAddress(record[3]), evidenceHash: asString(record[4]) })),
    events,
    latestBlock: latestBlock.toString(),
  };
}

export async function connectWallet() {
  if (typeof window === 'undefined' || !(window as any).ethereum) throw new Error('No browser wallet detected. Install MetaMask or another EVM wallet.');
  const accounts = await (window as any).ethereum.request({ method: 'eth_requestAccounts' });
  return accounts[0] as string;
}

export async function signCustodyAcceptance(batchId: string, addressToSign: string) {
  const ethereum = typeof window !== 'undefined' ? (window as any).ethereum : null;
  if (!ethereum) throw new Error('No browser wallet detected.');
  const message = `MediTrace custody acceptance\nBatch: ${batchId}\nCustodian: ${addressToSign}`;
  const signature = await ethereum.request({ method: 'personal_sign', params: [message, addressToSign] });
  return { message, signature };
}

export default { blockchainClient, getBatchFromBlockchain, readBatchProvenance, connectWallet, signCustodyAcceptance };
