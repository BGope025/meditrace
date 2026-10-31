'use client';

import { PeraWalletConnect } from '@perawallet/connect';
import { Algodv2, decodeUnsignedTransaction } from 'algosdk';
import api from './api';

export const ALGORAND_TESTNET_CHAIN_ID = 416002;
export const ALGORAND_NETWORK_NAME = 'Algorand TestNet';
const configuredAppId = process.env.NEXT_PUBLIC_ALGORAND_APP_ID || '';
export const ALGORAND_APP_ID = configuredAppId ? Number(configuredAppId) : null;

const algodServer = process.env.NEXT_PUBLIC_ALGOD_SERVER || 'https://testnet-api.algonode.cloud';
const algodPort = process.env.NEXT_PUBLIC_ALGOD_PORT || '';
const algodToken = process.env.NEXT_PUBLIC_ALGOD_TOKEN || '';

let peraWallet: PeraWalletConnect | null = null;

function getPeraWallet() {
  if (typeof window === 'undefined') {
    throw new Error('Pera Wallet is available only in the browser.');
  }

  if (!peraWallet) {
    peraWallet = new PeraWalletConnect({
      chainId: ALGORAND_TESTNET_CHAIN_ID,
    });
  }

  return peraWallet;
}

function getAlgodClient() {
  return new Algodv2(algodToken, algodServer, algodPort);
}

function base64ToBytes(value: string) {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}

function bytesToBase64(value: Uint8Array) {
  let binary = '';
  value.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary);
}

export async function connectAlgorandWallet() {
  const wallet = getPeraWallet();
  const accounts = await wallet.connect();
  return accounts[0] || null;
}

export async function reconnectAlgorandWallet() {
  const wallet = getPeraWallet();
  const accounts = await wallet.reconnectSession();
  return accounts[0] || null;
}

export async function disconnectAlgorandWallet() {
  if (peraWallet?.isConnected) {
    await peraWallet.disconnect();
  }
}

export async function getAlgorandBalance(address: string) {
  const accountInfo = await getAlgodClient().accountInformation(address).do();
  const microAlgos = Number(accountInfo.amount || 0);
  return {
    microAlgos,
    algo: microAlgos / 1_000_000,
    formatted: `${(microAlgos / 1_000_000).toFixed(6)} ALGO`,
  };
}

export async function prepareAlgorandAppCall(input: {
  sender: string;
  method?: string;
  action?: string;
  args?: Array<string | number | boolean | Record<string, unknown>>;
  boxes?: string[];
}) {
  const response = await api.post<{ success: boolean; transaction: { unsignedTxn: string } }>('/algorand/app-call/prepare', input);
  return response.data.transaction;
}

export async function signAndSubmitAlgorandAppCall(input: {
  sender: string;
  method?: string;
  action?: string;
  args?: Array<string | number | boolean | Record<string, unknown>>;
  boxes?: string[];
  timeoutRounds?: number;
}) {
  const wallet = getPeraWallet();
  const prepared = await prepareAlgorandAppCall(input);
  const txn = decodeUnsignedTransaction(base64ToBytes(prepared.unsignedTxn));
  const signedGroup = await wallet.signTransaction([[{ txn }]]);
  const response = await api.post('/algorand/transactions/submit-and-confirm', {
    signedTxn: bytesToBase64(signedGroup[0]),
    timeoutRounds: input.timeoutRounds || 20,
  });
  return response.data.transaction;
}

export function getAlgorandExplorerAddressUrl(address: string) {
  return `https://lora.algokit.io/testnet/account/${address}`;
}

export function getAlgorandExplorerAppUrl() {
  if (!ALGORAND_APP_ID) return null;
  return `https://lora.algokit.io/testnet/application/${ALGORAND_APP_ID}`;
}

export function requireAlgorandAppId() {
  if (!ALGORAND_APP_ID || !Number.isInteger(ALGORAND_APP_ID) || ALGORAND_APP_ID <= 0) {
    throw new Error('Algorand application ID is not configured. Set NEXT_PUBLIC_ALGORAND_APP_ID.');
  }
  return ALGORAND_APP_ID;
}

export default {
  connectAlgorandWallet,
  reconnectAlgorandWallet,
  disconnectAlgorandWallet,
  getAlgorandBalance,
  prepareAlgorandAppCall,
  signAndSubmitAlgorandAppCall,
  getAlgorandExplorerAppUrl,
  requireAlgorandAppId,
};
