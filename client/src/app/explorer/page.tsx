'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Database,
  Search,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ExternalLink,
  Layers,
  Blocks,
  FileText,
} from 'lucide-react';
import Navbar from '../../components/Navbar';
import StatusBadge, { type BatchState } from '../../components/StatusBadge';
import {
  blockExplorerBaseUrl,
  explorerNetwork,
  readBatchProvenance,
  registryAddress,
  type ExplorerEvent,
} from '../../lib/web3';
import { ALGORAND_APP_ID, getAlgorandExplorerAppUrl } from '../../lib/algorand';

type Provenance = Awaited<ReturnType<typeof readBatchProvenance>>;
const stateNames = ['In transit', 'Excursion detected', 'Custody transferred', 'Delivered'];

const demoProvenance: Provenance = {
  batch: {
    drugName: 'Vaxigen ColdShield (Demo Specimen)',
    manufacturer: '0x7A3b5c9D2E1f00000000000000000000000091c2',
    currentCustodian: '0x42B8F1000000000000000000000000000000b8f1',
    state: 1,
    timestamp: '1793188800',
    lastUpdatedAt: '1793192400',
  },
  custody: [
    {
      from: '0x7A3b5c9D2E1f00000000000000000000000091c2',
      to: '0x42B8F1000000000000000000000000000000b8f1',
      actor: '0x7A3b5c9D2E1f00000000000000000000000091c2',
      timestamp: '1793190000',
    },
    {
      from: '0x42B8F1000000000000000000000000000000b8f1',
      to: '0x91A0D40000000000000000000000000000000ad4',
      actor: '0x42B8F1000000000000000000000000000000b8f1',
      timestamp: '1793191800',
    },
  ],
  breaches: [
    {
      temperatureCenti: '1210',
      observedAt: '1793192200',
      recordedAt: '1793192400',
      sensor: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
      evidenceHash: '0x9f5e4b9a8cf1d5a5c82d29169d1ce0d8a2f3c4b5a697887766554433221100aa',
    },
  ],
  events: [
    {
      type: 'BatchCreated',
      blockNumber: '18420001',
      transactionHash: '0x1111111111111111111111111111111111111111111111111111111111111111',
      logIndex: '0',
      args: {
        batchId: '1',
        drugName: 'Vaxigen ColdShield',
        manufacturer: '0x7A3b5c9D2E1f00000000000000000000000091c2',
        timestamp: '1793188800',
      },
    },
    {
      type: 'CustodyTransferred',
      blockNumber: '18420012',
      transactionHash: '0x2222222222222222222222222222222222222222222222222222222222222222',
      logIndex: '0',
      args: {
        batchId: '1',
        from: '0x7A3b5c9D2E1f00000000000000000000000091c2',
        to: '0x42B8F1000000000000000000000000000000b8f1',
      },
    },
    {
      type: 'TemperatureBreachRecorded',
      blockNumber: '18420048',
      transactionHash: '0x3333333333333333333333333333333333333333333333333333333333333333',
      logIndex: '1',
      args: {
        batchId: '1',
        temperatureCenti: '1210',
        sensor: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
        evidenceHash: '0x9f5e4b9a8cf1d5a5c82d29169d1ce0d8a2f3c4b5a697887766554433221100aa',
      },
    },
  ],
  latestBlock: '18420048',
};

function truncateHash(hash: string) {
  return hash.length > 18 ? `${hash.slice(0, 10)}…${hash.slice(-6)}` : hash;
}

function dateFromSeconds(val: string) {
  const date = new Date(Number(val) * 1000);
  return Number.isNaN(date.getTime()) ? 'Unknown timestamp' : date.toLocaleString();
}

function tempFromCenti(val: string) {
  return `${(Number(val) / 100).toFixed(2)}°C`;
}

function txLink(hash: string) {
  return blockExplorerBaseUrl ? `${blockExplorerBaseUrl.replace(/\/$/, '')}/tx/${hash}` : '';
}

export default function ExplorerPage() {
  const [batchId, setBatchId] = useState('1');
  const [data, setData] = useState<Provenance | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isDemo, setIsDemo] = useState(false);

  async function handleInspect(e: React.FormEvent) {
    e.preventDefault();
    const id = Number(batchId);
    if (!Number.isInteger(id) || id < 1) {
      setError('Please provide a positive integer for the on-chain batch ID.');
      return;
    }
    setLoading(true);
    setError('');
    setData(null);
    setIsDemo(false);
    try {
      setData(await readBatchProvenance(BigInt(id)));
    } catch (caught: any) {
      setError(
        caught?.shortMessage ||
          caught?.message ||
          'Failed to query on-chain provenance. Verify contract address and network RPC.'
      );
    } finally {
      setLoading(false);
    }
  }

  function loadDemoRecord() {
    setBatchId('1');
    setError('');
    setIsDemo(true);
    setData(demoProvenance);
  }

  return (
    <div className="shell flex min-h-screen flex-col">
      <Navbar />

      <main className="flex-1 py-8 sm:py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-brand-ink sm:text-3xl">
                On-Chain Batch Explorer
              </h1>
              <p className="mt-1 text-xs text-brand-muted sm:text-sm">
                Query immutable contract state, emitted events, and cryptographic excursion evidence directly from {explorerNetwork}.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="rounded-lg bg-brand-subtle px-3 py-1.5 text-xs font-medium text-brand-muted border border-brand-border">
                RPC: <span className="font-mono">{explorerNetwork}</span>
              </span>
            </div>
          </div>

          <div className="surface flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-teal">Algorand TestNet registry</div>
              <div className="mt-1 font-mono text-sm text-brand-ink">App ID: {ALGORAND_APP_ID || 'Not configured'}</div>
            </div>
            {getAlgorandExplorerAppUrl() && (
              <a
                href={getAlgorandExplorerAppUrl() as string}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 text-xs font-semibold text-brand-teal hover:underline"
              >
                View Algorand app <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </div>

          {!registryAddress && (
            <div className="rounded-lg border border-brand-amber/30 bg-brand-amber-subtle p-4 text-xs text-brand-amber-text flex items-center justify-between">
              <span>BatchRegistry address is not configured in client environment.</span>
              <button
                type="button"
                onClick={loadDemoRecord}
                className="font-semibold underline hover:no-underline ml-4"
              >
                Inspect sample data
              </button>
            </div>
          )}

          {/* Lookup Card */}
          <div className="surface p-5 sm:p-6">
            <h2 className="text-base font-semibold text-brand-ink">Query BatchRegistry</h2>
            <p className="mt-1 text-xs text-brand-muted">
              Reads smart contract state using viem public RPC connection.
            </p>

            <form onSubmit={handleInspect} className="mt-4 flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <input
                  type="text"
                  inputMode="numeric"
                  value={batchId}
                  onChange={(e) => setBatchId(e.target.value)}
                  placeholder="On-chain batch ID (e.g. 1)"
                  className="w-full rounded-lg border border-brand-border bg-brand-paper px-3 py-2 text-xs font-mono text-brand-ink placeholder:text-brand-faint focus-ring min-h-[42px]"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={loading || !registryAddress}
                  className="flex items-center justify-center gap-2 rounded-lg bg-brand-navy px-5 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50 transition-colors focus-ring min-h-[42px]"
                >
                  <Search className="h-4 w-4" />
                  {loading ? 'Reading Chain…' : 'Inspect Provenance'}
                </button>

                <button
                  type="button"
                  onClick={loadDemoRecord}
                  className="rounded-lg border border-brand-border bg-brand-surface px-4 py-2 text-xs font-semibold text-brand-ink hover:bg-brand-subtle transition-colors focus-ring min-h-[42px]"
                >
                  Load Demo Record
                </button>
              </div>
            </form>

            <div className="mt-3 text-[11px] text-brand-muted">
              Active Registry: <code className="font-mono">{registryAddress || 'Not set in NEXT_PUBLIC_BATCH_REGISTRY_ADDRESS'}</code>
            </div>
          </div>

          {error && (
            <div className="rounded-lg border border-brand-danger/30 bg-brand-danger-subtle p-3 text-xs text-brand-danger-text flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 text-brand-danger" />
                <span>{error}</span>
              </div>
              <button
                type="button"
                onClick={() => setError('')}
                className="font-semibold underline hover:no-underline ml-4"
              >
                Dismiss
              </button>
            </div>
          )}

          {data && (
            <div className="space-y-6">
              {isDemo && (
                <div className="rounded-lg border border-brand-teal/30 bg-brand-teal-subtle p-3 text-xs text-brand-teal">
                  Viewing simulated on-chain record for demonstration.
                </div>
              )}

              {/* Summary Metrics */}
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <div className="surface p-4">
                  <div className="text-xs text-brand-muted">On-Chain State</div>
                  <div className="mt-1">
                    <StatusBadge state={data.batch.state as BatchState} />
                  </div>
                </div>

                <div className="surface p-4">
                  <div className="text-xs text-brand-muted">Custody Handoffs</div>
                  <div className="mt-1 text-2xl font-bold font-mono text-brand-ink">
                    {data.custody.length}
                  </div>
                </div>

                <div className="surface p-4">
                  <div className="text-xs text-brand-muted">Flagged Excursions</div>
                  <div
                    className={`mt-1 text-2xl font-bold font-mono ${
                      data.breaches.length ? 'text-brand-danger' : 'text-brand-safe'
                    }`}
                  >
                    {data.breaches.length}
                  </div>
                </div>

                <div className="surface p-4">
                  <div className="text-xs text-brand-muted">Latest Block Read</div>
                  <div className="mt-1 text-2xl font-bold font-mono text-brand-ink">
                    {data.latestBlock}
                  </div>
                </div>
              </div>

              {/* Custody Table */}
              <div className="surface overflow-hidden">
                <div className="border-b border-brand-border p-4 sm:p-5">
                  <h3 className="text-sm font-semibold text-brand-ink">Custody Handoff Provenance</h3>
                  <p className="text-xs text-brand-muted mt-0.5">
                    Immutable transfer records registered by sender and recipient
                  </p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs min-w-[540px]">
                    <thead className="border-b border-brand-border bg-brand-subtle/50 text-brand-muted">
                      <tr>
                        <th className="py-2.5 px-4 font-medium">From Address</th>
                        <th className="py-2.5 px-4 font-medium">To Address</th>
                        <th className="py-2.5 px-4 font-medium">Signer / Actor</th>
                        <th className="py-2.5 px-4 font-medium">Timestamp</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-brand-border">
                      {data.custody.length > 0 ? (
                        data.custody.map((record, index) => (
                          <tr key={index} className="hover:bg-brand-subtle/30 font-mono">
                            <td className="py-3 px-4 text-brand-muted">{truncateHash(record.from)}</td>
                            <td className="py-3 px-4 text-brand-muted">{truncateHash(record.to)}</td>
                            <td className="py-3 px-4 text-brand-ink">{truncateHash(record.actor)}</td>
                            <td className="py-3 px-4 text-brand-muted">{dateFromSeconds(record.timestamp)}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={4} className="py-6 text-center text-brand-muted">
                            No custody handoffs recorded for this batch.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Breaches Table */}
              <div className="surface overflow-hidden">
                <div className="border-b border-brand-border p-4 sm:p-5">
                  <h3 className="text-sm font-semibold text-brand-ink">Excursion Evidence Log</h3>
                  <p className="text-xs text-brand-muted mt-0.5">
                    Hardware evidence hashes and telemetry readings recorded on ledger
                  </p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs min-w-[540px]">
                    <thead className="border-b border-brand-border bg-brand-subtle/50 text-brand-muted">
                      <tr>
                        <th className="py-2.5 px-4 font-medium">Recorded Temp</th>
                        <th className="py-2.5 px-4 font-medium">Sensor Probe</th>
                        <th className="py-2.5 px-4 font-medium">Observed Time</th>
                        <th className="py-2.5 px-4 font-medium">Cryptographic Evidence Hash</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-brand-border">
                      {data.breaches.length > 0 ? (
                        data.breaches.map((record, index) => (
                          <tr key={index} className="hover:bg-brand-subtle/30 font-mono">
                            <td className="py-3 px-4 font-semibold text-brand-danger">
                              {tempFromCenti(record.temperatureCenti)}
                            </td>
                            <td className="py-3 px-4 text-brand-muted">{truncateHash(record.sensor)}</td>
                            <td className="py-3 px-4 text-brand-muted">{dateFromSeconds(record.observedAt)}</td>
                            <td className="py-3 px-4 text-brand-teal break-all">
                              {truncateHash(record.evidenceHash)}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={4} className="py-6 text-center text-brand-muted">
                            No temperature breaches recorded on-chain.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Contract Events */}
              <div className="surface overflow-hidden">
                <div className="border-b border-brand-border p-4 sm:p-5">
                  <h3 className="text-sm font-semibold text-brand-ink">Emitted Contract Events</h3>
                  <p className="text-xs text-brand-muted mt-0.5">
                    Raw EVM log topics and transaction hashes
                  </p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs min-w-[540px]">
                    <thead className="border-b border-brand-border bg-brand-subtle/50 text-brand-muted">
                      <tr>
                        <th className="py-2.5 px-4 font-medium">Event Name</th>
                        <th className="py-2.5 px-4 font-medium">Block Number</th>
                        <th className="py-2.5 px-4 font-medium">Transaction Hash</th>
                        <th className="py-2.5 px-4 font-medium">Decoded Arguments</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-brand-border">
                      {data.events.length > 0 ? (
                        data.events.map((event, index) => {
                          const href = txLink(event.transactionHash);
                          const formattedArgs = Object.entries(event.args)
                            .map(([k, v]) => `${k}: ${truncateHash(v)}`)
                            .join(', ');

                          return (
                            <tr key={index} className="hover:bg-brand-subtle/30 font-mono">
                              <td className="py-3 px-4 font-semibold text-brand-navy">
                                {event.type}
                              </td>
                              <td className="py-3 px-4 text-brand-muted">{event.blockNumber}</td>
                              <td className="py-3 px-4">
                                {href ? (
                                  <a
                                    href={href}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-brand-teal hover:underline inline-flex items-center gap-1"
                                  >
                                    {truncateHash(event.transactionHash)}
                                    <ExternalLink className="h-3 w-3" />
                                  </a>
                                ) : (
                                  <span className="text-brand-muted">
                                    {truncateHash(event.transactionHash)}
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-4 text-brand-muted">{formattedArgs}</td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={4} className="py-6 text-center text-brand-muted">
                            No event logs found for this batch.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      <footer className="border-t border-brand-border bg-brand-surface py-6 text-center text-xs text-brand-muted">
        MediTrace Smart Contract Explorer · Direct RPC integration
      </footer>
    </div>
  );
}
