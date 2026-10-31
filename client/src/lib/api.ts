import axios from 'axios';

export type BatchState = 0 | 1 | 2 | 3;

export interface Batch {
  batch_id: string;
  drug_name: string;
  manufacturer: string;
  state: BatchState;
  created_at: string;
  updated_at?: string;
  chain?: 'evm' | 'algorand';
  algorand_app_id?: number | string | null;
  algorand_batch_id?: number | string | null;
  algorand_tx_id?: string | null;
  algorand_confirmed_round?: number | string | null;
}

export interface TelemetryPoint {
  id: number;
  batch_id: string;
  sensor_id: string;
  temperature: number;
  humidity?: number;
  timestamp: string;
  is_safe: boolean;
}

export interface BatchDetails {
  batchId: string;
  drugName: string;
  manufacturer: string;
  state: BatchState;
  createdAt: string;
  updatedAt?: string;
  blockchainVerified?: {
    drugName: string;
    manufacturer: string;
    state: string;
    timestamp: string;
  } | null;
}

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_BACKEND_URL || '/api',
  headers: { 'Content-Type': 'application/json' },
  timeout: 8000,
});

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = window.localStorage.getItem('access_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const batchAPI = {
  list: () => api.get<{ batches: Batch[] }>('/batch/list'),
  get: (batchId: string) => api.get<{ batch: BatchDetails }>(`/batch/${encodeURIComponent(batchId)}`),
  create: (drugName: string) => api.post('/batch/create', { drugName }),
  flagBreach: (batchId: string) => api.post(`/batch/${encodeURIComponent(batchId)}/flag-breach`),
  transfer: (batchId: string, newCustodian: string, signature: string) =>
    api.post('/batch/transfer', { batchId, newCustodian, signature }),
};

export const telemetryAPI = {
  ingest: (data: Record<string, unknown>) => api.post('/telemetry/ingest', data),
  history: (batchId: string, limit = 100) =>
    api.get<{ telemetry: TelemetryPoint[] }>(`/telemetry/${encodeURIComponent(batchId)}/history`, { params: { limit } }),
};

export const algorandAPI = {
  recordBatch: (data: {
    batchId?: string;
    drugName?: string;
    manufacturer: string;
    algorandBatchId?: number;
    txId: string;
    confirmedRound?: number;
    state?: BatchState;
  }) => api.post('/algorand/batches/record', data),
  syncBatch: (data: { batchId: string; txId: string; confirmedRound?: number; state?: BatchState }) =>
    api.post('/algorand/batches/sync', data),
  oracleRecordTemperature: (data: {
    batchId: number | string;
    temperatureCenti: number;
    observedAt?: number;
    sensorAddress?: string;
    evidenceHash?: string;
  }) => api.post('/algorand/oracle/record-temperature', data),
  oracleFlagBreach: (data: { batchId: number | string }) =>
    api.post('/algorand/oracle/flag-breach', data),
};

export default api;
