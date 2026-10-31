/**
 * MediTrace — Algorand Testnet Deployment Script
 *
 * Deploys the BatchRegistry contract (which embeds AccessManager)
 * to the configured Algorand network and grants initial roles.
 *
 * Usage:
 *   npx tsx scripts/deploy.ts
 *
 * Environment:
 *   See .env.algorand for required variables.
 */

import dotenv from 'dotenv';
import algosdk from 'algosdk';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env first, then fallback to .env.algorand
dotenv.config();
if (existsSync(resolve(__dirname, '../.env.algorand'))) {
  dotenv.config({ path: resolve(__dirname, '../.env.algorand') });
}

// ── Role bit constants (must match contract) ──────────────────
const ADMIN_BIT = 1n;
const MANUFACTURER_BIT = 2n;
const DISTRIBUTOR_BIT = 4n;
const PHARMACY_BIT = 8n;
const ORACLE_BIT = 16n;

async function main() {
  // ── 1. Configure Algorand client ────────────────────────────
  const network = process.env.NETWORK || 'testnet';
  const algodServer =
    process.env.ALGOD_SERVER || 'https://testnet-api.algonode.cloud';
  const algodPort = process.env.ALGOD_PORT || '443';
  const algodToken = process.env.ALGOD_TOKEN || '';

  const algodClient = new algosdk.Algodv2(algodToken, algodServer, algodPort);

  console.log(`\n🔗 Deploying MediTrace to Algorand ${network}...`);
  console.log(`   Algod: ${algodServer}:${algodPort}\n`);

  // ── 2. Load deployer account ────────────────────────────────
  const mnemonic = process.env.DEPLOYER_MNEMONIC;
  if (!mnemonic || mnemonic.includes('your 25-word')) {
    console.error(
      '❌ Set DEPLOYER_MNEMONIC in .env.algorand to a funded testnet account.'
    );
    console.error(
      '   Fund it at: https://bank.testnet.algorand.network/'
    );
    process.exit(1);
  }

  const deployer = algosdk.mnemonicToSecretKey(mnemonic);
  const deployerAddr = deployer.addr.toString();
  console.log(`👤 Deployer: ${deployerAddr}`);

  // ── 3. Check deployer balance ───────────────────────────────
  const accountInfo = await algodClient.accountInformation(deployer.addr).do();
  const balance = Number(accountInfo.amount) / 1e6;
  console.log(`💰 Balance:  ${balance.toFixed(6)} ALGO`);

  if (balance < 1) {
    console.error(
      '❌ Deployer needs at least 1 ALGO. Fund at: https://bank.testnet.algorand.network/'
    );
    process.exit(1);
  }

  // ── 4. Load compiled TEAL from artifacts ────────────────────
  const artifactsDir = resolve(__dirname, '..', 'artifacts');

  let approvalProgram: string;
  let clearProgram: string;

  try {
    approvalProgram = readFileSync(
      resolve(artifactsDir, 'BatchRegistry.approval.teal'),
      'utf-8'
    );
    clearProgram = readFileSync(
      resolve(artifactsDir, 'BatchRegistry.clear.teal'),
      'utf-8'
    );
  } catch {
    console.error('❌ Artifacts not found. Run `npm run build` first.');
    process.exit(1);
  }

  // ── 5. Compile TEAL to bytecode ─────────────────────────────
  const compiledApproval = await algodClient.compile(approvalProgram).do();
  const compiledClear = await algodClient.compile(clearProgram).do();

  const approvalBytes = new Uint8Array(
    Buffer.from(compiledApproval.result, 'base64')
  );
  const clearBytes = new Uint8Array(
    Buffer.from(compiledClear.result, 'base64')
  );

  // ── 6. Deploy the application ───────────────────────────────
  const suggestedParams = await algodClient.getTransactionParams().do();

  // Schema from ARC-32: 1 global byte slice (admin) + 1 global uint (nextBatchId)
  const numGlobalByteSlices = 1;
  const numGlobalInts = 1;
  const numLocalByteSlices = 0;
  const numLocalInts = 0;
  const extraPages = Math.floor(approvalBytes.length / 2048);

  const createMethod = algosdk.ABIMethod.fromSignature('createApplication()void');

  const txn = algosdk.makeApplicationCreateTxnFromObject({
    sender: deployerAddr,
    approvalProgram: approvalBytes,
    clearProgram: clearBytes,
    numGlobalByteSlices,
    numGlobalInts,
    numLocalByteSlices,
    numLocalInts,
    extraPages,
    appArgs: [createMethod.getSelector()],
    suggestedParams,
    onComplete: algosdk.OnApplicationComplete.NoOpOC,
  });

  const signedTxn = txn.signTxn(deployer.sk);
  const txId = txn.txID();
  await algodClient.sendRawTransaction(signedTxn).do();
  const result = await algosdk.waitForConfirmation(algodClient, txId, 4);

  const appId = Number(result.applicationIndex ?? (result as any)['application-index']);
  const appAddress = algosdk.getApplicationAddress(appId).toString();

  console.log(`\n✅ BatchRegistry deployed!`);
  console.log(`   App ID:      ${appId}`);
  console.log(`   App Address: ${appAddress}`);
  console.log(`   Tx ID:       ${txId}`);
  console.log(`   Network:     ${network}`);

  // ── 7. Fund the app address for box MBR ─────────────────────
  const fundParams = await algodClient.getTransactionParams().do();
  const fundTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    sender: deployerAddr,
    receiver: appAddress,
    amount: 500_000, // 0.5 ALGO for box storage MBR
    suggestedParams: fundParams,
  });

  const signedFundTxn = fundTxn.signTxn(deployer.sk);
  const fundTxId = fundTxn.txID();
  await algodClient.sendRawTransaction(signedFundTxn).do();
  await algosdk.waitForConfirmation(algodClient, fundTxId, 4);
  console.log(`\n💸 Funded app with 0.5 ALGO for box storage MBR (Tx: ${fundTxId})`);

  // ── 8. Grant initial roles ──────────────────────────────────
  const roleAddresses = {
    manufacturer: process.env.MANUFACTURER_ADDRESS || deployerAddr,
    distributor: process.env.DISTRIBUTOR_ADDRESS || deployerAddr,
    pharmacy: process.env.PHARMACY_ADDRESS || deployerAddr,
    oracle: process.env.TELEMETRY_ORACLE_ADDRESS || deployerAddr,
  };

  console.log(`\n🔑 Granting roles...`);

  // Helper to call grantRole(roleBit, account) via ABI
  async function grantRoleCall(roleBit: bigint, account: string, label: string) {
    const params = await algodClient.getTransactionParams().do();
    const args = algosdk.ABIMethod.fromSignature('grantRole(uint64,address)void');
    const encodedArgs = [
      algosdk.encodeUint64(Number(roleBit)),
      algosdk.decodeAddress(account).publicKey,
    ];

    const roleBoxName = new Uint8Array([
      0x72, // 'r' prefix for role BoxMap
      ...algosdk.decodeAddress(account).publicKey,
    ]);

    const callTxn = algosdk.makeApplicationCallTxnFromObject({
      sender: deployerAddr,
      appIndex: appId,
      appArgs: [args.getSelector(), ...encodedArgs],
      suggestedParams: params,
      onComplete: algosdk.OnApplicationComplete.NoOpOC,
      boxes: [{ appIndex: appId, name: roleBoxName }],
    });

    const signedCallTxn = callTxn.signTxn(deployer.sk);
    const callTxId = callTxn.txID();
    await algodClient.sendRawTransaction(signedCallTxn).do();
    await algosdk.waitForConfirmation(algodClient, callTxId, 4);
    console.log(`   ✅ ${label}: ${account}`);
  }

  await grantRoleCall(MANUFACTURER_BIT, roleAddresses.manufacturer, 'Manufacturer');
  await grantRoleCall(DISTRIBUTOR_BIT, roleAddresses.distributor, 'Distributor');
  await grantRoleCall(PHARMACY_BIT, roleAddresses.pharmacy, 'Pharmacy');
  await grantRoleCall(ORACLE_BIT, roleAddresses.oracle, 'Telemetry Oracle');

  // ── 9. Summary ──────────────────────────────────────────────
  const summary = {
    network,
    appId,
    appAddress,
    deployer: deployerAddr,
    roles: roleAddresses,
    explorer:
      network === 'testnet'
        ? `https://testnet.explorer.perawallet.app/application/${appId}`
        : network === 'mainnet'
          ? `https://explorer.perawallet.app/application/${appId}`
          : `http://localhost:8980/v2/applications/${appId}`,
  };

  console.log(`\n📋 Deployment Summary:`);
  console.log(JSON.stringify(summary, null, 2));

  console.log(`\n🌐 View on explorer: ${summary.explorer}`);
  console.log(`\n💡 Set these in your backend .env:`);
  console.log(`   ALGORAND_APP_ID=${appId}`);
  console.log(`   ALGOD_SERVER=${algodServer}`);
  console.log(
    `   TELEMETRY_ORACLE_ADDRESS=${roleAddresses.oracle}`
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Deployment failed:', err);
    process.exit(1);
  });
