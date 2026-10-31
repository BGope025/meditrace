const algosdk = require('algosdk');

const network = process.env.ALGORAND_NETWORK || 'testnet';
const algodServer = process.env.ALGOD_SERVER || 'https://testnet-api.algonode.cloud';
const algodPort = process.env.ALGOD_PORT || '';
const algodToken = process.env.ALGOD_TOKEN || '';
const indexerServer = process.env.INDEXER_SERVER || 'https://testnet-idx.algonode.cloud';
const indexerPort = process.env.INDEXER_PORT || '';
const indexerToken = process.env.INDEXER_TOKEN || '';
const appId = Number(process.env.ALGORAND_APP_ID || 0);
const oracleAddress = process.env.ALGORAND_ORACLE_ADDRESS || '';

const algod = new algosdk.Algodv2(algodToken, algodServer, algodPort);
const indexer = new algosdk.Indexer(indexerToken, indexerServer, indexerPort);

function requireAppId() {
  if (!Number.isInteger(appId) || appId <= 0) {
    const error = new Error('ALGORAND_APP_ID is not configured. Deploy the MediTrace Algorand application first.');
    error.statusCode = 503;
    throw error;
  }
  return appId;
}

function validateAddress(address, field = 'address') {
  if (typeof address !== 'string' || !algosdk.isValidAddress(address)) {
    const error = new Error(`${field} must be a valid Algorand address.`);
    error.statusCode = 400;
    throw error;
  }
  return address;
}

const METHOD_SIGNATURES = {
  createApplication: 'createApplication()void',
  grantRole: 'grantRole(uint64,address)void',
  revokeRole: 'revokeRole(uint64,address)void',
  grantManufacturerRole: 'grantManufacturerRole(address)void',
  grantDistributorRole: 'grantDistributorRole(address)void',
  grantPharmacyRole: 'grantPharmacyRole(address)void',
  grantTelemetryOracleRole: 'grantTelemetryOracleRole(address)void',
  revokeManufacturerRole: 'revokeManufacturerRole(address)void',
  revokeDistributorRole: 'revokeDistributorRole(address)void',
  revokePharmacyRole: 'revokePharmacyRole(address)void',
  revokeTelemetryOracleRole: 'revokeTelemetryOracleRole(address)void',
  hasRole: 'hasRole(uint64,address)bool',
  createBatch: 'createBatch(string)uint64',
  flagBreach: 'flagBreach(uint64)void',
  recordTemperature: 'recordTemperature(uint64,uint64,uint64,address,byte[32])bool',
  transferBatch: 'transferBatch(uint64,address)void',
  confirmDelivery: 'confirmDelivery(uint64)void',
  getBatch: 'getBatch(uint64)(byte[],address,uint64,uint64)',
  getBatchDetails: 'getBatchDetails(uint64)(byte[],address,address,uint64,uint64,uint64)',
  getCustodyRecord: 'getCustodyRecord(uint64,uint64)(address,address,address,uint64)',
  getBreachRecord: 'getBreachRecord(uint64,uint64)(uint64,uint64,uint64,address,byte[32])',
  getCustodyCount: 'getCustodyCount(uint64)uint64',
  getBreachCount: 'getBreachCount(uint64)uint64',
};

function resolveMethod(method) {
  const signature = METHOD_SIGNATURES[method] || method;
  if (!signature || !signature.includes('(')) {
    const error = new Error(`Unsupported Algorand application method: ${method}`);
    error.statusCode = 400;
    throw error;
  }
  try {
    return algosdk.ABIMethod.fromSignature(signature);
  } catch {
    const error = new Error(`Invalid Algorand ARC-4 method signature: ${signature}`);
    error.statusCode = 400;
    throw error;
  }
}

function normalizeAbiArg(type, value) {
  if (type.toString() === 'byte[32]' && typeof value === 'string' && /^0x[0-9a-fA-F]{64}$/.test(value)) {
    return new Uint8Array(Buffer.from(value.slice(2), 'hex'));
  }
  return value;
}

function uint64Box(prefix, value) {
  return Buffer.concat([Buffer.from(prefix, 'utf8'), Buffer.from(algosdk.encodeUint64(Number(value)))]);
}

function roleBox(address) {
  return Buffer.concat([Buffer.from('r', 'utf8'), Buffer.from(algosdk.decodeAddress(address).publicKey)]);
}

async function readBoxUint(boxName) {
  try {
    const result = await algod.getApplicationBoxByName(appId, boxName).do();
    const bytes = Buffer.from(Object.values(result.value || {}));
    return bytes.length >= 8 ? Number(algosdk.decodeUint64(bytes.slice(-8))) : 0;
  } catch (_) {
    return 0;
  }
}

async function readNextBatchId() {
  const result = await algod.getApplicationByID(appId).do();
  const state = result.params?.['global-state'] || result.params?.globalState || [];
  const entry = state.find((item) => Buffer.from(item.key, 'base64').toString('utf8') === 'nextId');
  return Number(entry?.value?.uint || 1);
}

async function deriveBoxNames(methodName, sender, args) {
  const batchId = Number(args[0] || 0);
  const names = [];

  if (methodName === 'createBatch') {
    const nextId = await readNextBatchId();
    // 8 box references max per transaction
    ['bn', 'bm', 'bc', 'bs', 'bt', 'bu', 'cc', 'xc'].forEach((prefix) => names.push(uint64Box(prefix, nextId)));
  } else if (methodName === 'transferBatch') {
    names.push(roleBox(sender));
    const index = await readBoxUint(uint64Box('cc', batchId));
    ['bc', 'bs', 'bu', 'cc', 'cf', 'ct', 'ca'].forEach((prefix) => names.push(uint64Box(prefix, ['cf', 'ct', 'ca'].includes(prefix) ? batchId * 1_000_000 + index : batchId)));
  } else if (methodName === 'recordTemperature') {
    names.push(roleBox(sender));
    const index = await readBoxUint(uint64Box('xc', batchId));
    ['bs', 'bu', 'xc', 'xt', 'xo', 'xr', 'xs'].forEach((prefix) => names.push(uint64Box(prefix, ['xt', 'xo', 'xr', 'xs'].includes(prefix) ? batchId * 1_000_000 + index : batchId)));
  } else if (methodName === 'flagBreach') {
    names.push(roleBox(sender));
    ['bs', 'bu'].forEach((prefix) => names.push(uint64Box(prefix, batchId)));
  } else if (methodName === 'confirmDelivery') {
    names.push(roleBox(sender));
    ['bc', 'bs', 'bu'].forEach((prefix) => names.push(uint64Box(prefix, batchId)));
  } else if (methodName === 'grantRole' || methodName === 'revokeRole' || methodName.endsWith('Role')) {
    names.push(roleBox(sender));
    const account = args[args.length - 1] || sender;
    validateAddress(account, 'role account');
    names.push(roleBox(account));
  } else if (methodName.startsWith('getBatch')) {
    ['bn', 'bm', 'bc', 'bs', 'bt', 'bu'].forEach((prefix) => names.push(uint64Box(prefix, batchId)));
  } else {
    names.push(roleBox(sender));
  }

  return names.slice(0, 8);
}

async function getAccount(address) {
  validateAddress(address);
  const account = await algod.accountInformation(address).do();
  return {
    address,
    amount: Number(account.amount || 0),
    algo: Number(account.amount || 0) / 1_000_000,
    minBalance: Number(account['min-balance'] || account.minBalance || 0),
    round: Number(account.round || 0),
  };
}

async function prepareAppCall({ sender, action, method, args = [], boxes = [] }) {
  const resolvedAppId = requireAppId();
  validateAddress(sender, 'sender');
  if (!Array.isArray(args) || args.length > 15) {
    const error = new Error('args must be an array with at most 15 values.');
    error.statusCode = 400;
    throw error;
  }
  if (!Array.isArray(boxes) || boxes.length > 8 || boxes.some((box) => typeof box !== 'string' || box.length > 64)) {
    const error = new Error('boxes must contain at most 8 short string names.');
    error.statusCode = 400;
    throw error;
  }

  const suggestedParams = await algod.getTransactionParams().do();
  const abiMethod = resolveMethod(method || action);
  if (abiMethod.args.length !== args.length) {
    const error = new Error(`${abiMethod.name} expects ${abiMethod.args.length} arguments, received ${args.length}.`);
    error.statusCode = 400;
    throw error;
  }
  const methodName = abiMethod.name;
  const boxNames = boxes.length ? boxes.map((name) => Buffer.from(name, 'utf8')) : await deriveBoxNames(methodName, sender, args);
  const txn = algosdk.makeApplicationNoOpTxnFromObject({
    sender,
    appIndex: resolvedAppId,
    appArgs: [abiMethod.getSelector(), ...args.map((value, index) => abiMethod.args[index].type.encode(normalizeAbiArg(abiMethod.args[index].type, value)))],
    boxes: boxNames.map((name) => ({ appIndex: 0, name })),
    suggestedParams,
  });

  return {
    network,
    appId: resolvedAppId,
    sender,
    method: abiMethod.name,
    signature: METHOD_SIGNATURES[method || action] || method || action,
    boxReferenceCount: boxNames.length,
    unsignedTxn: Buffer.from(algosdk.encodeUnsignedTransaction(txn)).toString('base64'),
    expiresAtRound: Number(suggestedParams.lastValid || suggestedParams.lastRound || suggestedParams['last-round'] || 0),
  };
}

async function submitSignedTransaction(signedTxnBase64) {
  if (typeof signedTxnBase64 !== 'string' || !signedTxnBase64.trim()) {
    const error = new Error('signedTxn must be a base64-encoded signed Algorand transaction.');
    error.statusCode = 400;
    throw error;
  }

  const signedBytes = Buffer.from(signedTxnBase64, 'base64');
  const sent = await algod.sendRawTransaction(signedBytes).do();
  const txId = sent.txid || sent.txId;
  if (!txId) throw new Error('Algod accepted the request but did not return a transaction ID.');

  return { txId, status: 'submitted' };
}

async function waitForConfirmation(txId, timeoutRounds = 20) {
  if (typeof txId !== 'string' || !txId.trim()) throw new Error('txId is required.');
  const confirmed = await algosdk.waitForConfirmation(algod, txId, timeoutRounds);
  return {
    txId,
    confirmedRound: Number(confirmed['confirmed-round'] || 0),
    poolError: confirmed['pool-error'] || '',
    applicationIndex: Number(confirmed['application-index'] || 0),
    assetIndex: Number(confirmed['asset-index'] || 0),
    status: confirmed['pool-error'] ? 'failed' : 'confirmed',
  };
}

async function lookupTransaction(txId) {
  const result = await indexer.lookupTransaction(txId).do();
  return result.transaction;
}

function getConfig() {
  return {
    network,
    appId: appId || null,
    algodServer,
    indexerServer,
    chainId: 416002,
    oracleAddress: oracleAddress || null,
  };
}

async function recordTemperatureWithOracle({ batchId, temperatureCenti, observedAt, sensorAddress, evidenceHash }) {
  const resolvedAppId = requireAppId();
  const oracleMnemonic = process.env.ALGORAND_ORACLE_MNEMONIC;
  if (!oracleMnemonic) throw new Error('ALGORAND_ORACLE_MNEMONIC is not configured.');

  const oracleAccount = algosdk.mnemonicToSecretKey(oracleMnemonic);
  const sender = oracleAccount.addr.toString();
  const suggestedParams = await algod.getTransactionParams().do();
  const abiMethod = resolveMethod('recordTemperature');

  const bId = Number(batchId) || 1;
  const tCenti = Number(temperatureCenti);
  const obsAt = Number(observedAt) || Math.floor(Date.now() / 1000);
  const sensor = sensorAddress && algosdk.isValidAddress(sensorAddress) ? sensorAddress : sender;

  let hashBytes;
  if (typeof evidenceHash === 'string' && /^0x[0-9a-fA-F]{64}$/.test(evidenceHash)) {
    hashBytes = new Uint8Array(Buffer.from(evidenceHash.slice(2), 'hex'));
  } else if (evidenceHash instanceof Uint8Array && evidenceHash.length === 32) {
    hashBytes = evidenceHash;
  } else {
    hashBytes = new Uint8Array(32);
    hashBytes.fill(0xee);
  }

  const boxNames = await deriveBoxNames('recordTemperature', sender, [bId]);
  const txn = algosdk.makeApplicationNoOpTxnFromObject({
    sender,
    appIndex: resolvedAppId,
    appArgs: [
      abiMethod.getSelector(),
      algosdk.encodeUint64(bId),
      algosdk.encodeUint64(tCenti),
      algosdk.encodeUint64(obsAt),
      algosdk.decodeAddress(sensor).publicKey,
      hashBytes,
    ],
    boxes: boxNames.slice(0, 8).map((name) => ({ appIndex: 0, name })),
    suggestedParams,
  });

  const signedTxn = txn.signTxn(oracleAccount.sk);
  const sent = await algod.sendRawTransaction(signedTxn).do();
  const txId = sent.txid || sent.txId;
  const confirmed = await algosdk.waitForConfirmation(algod, txId, 6);

  return {
    txId,
    confirmedRound: Number(confirmed['confirmed-round'] || 0),
    status: 'confirmed',
    sender,
    batchId: bId,
    temperatureCenti: tCenti,
  };
}

async function flagBreachWithOracle({ batchId }) {
  const resolvedAppId = requireAppId();
  const oracleMnemonic = process.env.ALGORAND_ORACLE_MNEMONIC;
  if (!oracleMnemonic) throw new Error('ALGORAND_ORACLE_MNEMONIC is not configured.');

  const oracleAccount = algosdk.mnemonicToSecretKey(oracleMnemonic);
  const sender = oracleAccount.addr.toString();
  const suggestedParams = await algod.getTransactionParams().do();
  const abiMethod = resolveMethod('flagBreach');
  const bId = Number(batchId) || 1;

  const boxNames = await deriveBoxNames('flagBreach', sender, [bId]);
  const txn = algosdk.makeApplicationNoOpTxnFromObject({
    sender,
    appIndex: resolvedAppId,
    appArgs: [abiMethod.getSelector(), algosdk.encodeUint64(bId)],
    boxes: boxNames.slice(0, 8).map((name) => ({ appIndex: 0, name })),
    suggestedParams,
  });

  const signedTxn = txn.signTxn(oracleAccount.sk);
  const sent = await algod.sendRawTransaction(signedTxn).do();
  const txId = sent.txid || sent.txId;
  const confirmed = await algosdk.waitForConfirmation(algod, txId, 6);

  return {
    txId,
    confirmedRound: Number(confirmed['confirmed-round'] || 0),
    status: 'confirmed',
    sender,
    batchId: bId,
  };
}

module.exports = {
  getConfig,
  getAccount,
  prepareAppCall,
  submitSignedTransaction,
  waitForConfirmation,
  lookupTransaction,
  recordTemperatureWithOracle,
  flagBreachWithOracle,
};
