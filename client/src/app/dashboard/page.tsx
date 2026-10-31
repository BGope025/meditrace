'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Plus,
  AlertTriangle,
  Activity,
  Layers,
  FileCheck,
  X,
  Radio,
  ExternalLink,
} from 'lucide-react';
import Navbar from '../../components/Navbar';
import BatchTable from '../../components/BatchTable';
import StatusBadge, { type BatchState } from '../../components/StatusBadge';
import TelemetryChart from '../../components/TelemetryChart';
import { algorandAPI, batchAPI, telemetryAPI, type Batch, type TelemetryPoint } from '../../lib/api';
import { connectAlgorandWallet, signAndSubmitAlgorandAppCall } from '../../lib/algorand';

const demoBatches: Batch[] = [
  {
    batch_id: 'MT-24091',
    drug_name: 'Vaxigen ColdShield',
    manufacturer: '0x7A23...91c2',
    state: 0,
    created_at: new Date().toISOString(),
  },
  {
    batch_id: 'MT-24088',
    drug_name: 'Insulin Glargine 100u/mL',
    manufacturer: '0x42B1...b8f1',
    state: 2,
    created_at: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    batch_id: 'MT-24073',
    drug_name: 'Monoclonal Antibody 40mg',
    manufacturer: '0x91F4...0ad4',
    state: 1,
    created_at: new Date(Date.now() - 172800000).toISOString(),
  },
];

export default function Dashboard() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [selected, setSelected] = useState<Batch | null>(null);
  const [telemetry, setTelemetry] = useState<TelemetryPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [wallet, setWallet] = useState('');
  const [notice, setNotice] = useState<{ message: string; type: 'info' | 'error' | 'success' } | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [drugName, setDrugName] = useState('');
  const [creating, setCreating] = useState(false);

  async function loadBatches() {
    try {
      const response = await batchAPI.list();
      setBatches(response.data.batches || []);
      setError('');
    } catch {
      setBatches((current) => (current.length ? current : demoBatches));
      setError('Live API unavailable. Displaying local demo records until connection is restored.');
    } finally {
      setLoading(false);
    }
  }

  async function openBatch(batch: Batch) {
    setSelected(batch);
    setTelemetry([]);
    setNotice(null);
    try {
      const response = await telemetryAPI.history(batch.batch_id);
      setTelemetry(response.data.telemetry || []);
    } catch {
      setNotice({
        message: 'Telemetry history unavailable for this batch.',
        type: 'info',
      });
    }
  }

  useEffect(() => {
    loadBatches();
    const interval = setInterval(loadBatches, 15000);
    return () => clearInterval(interval);
  }, []);

  const totalLots = batches.length;
  const inMotionLots = batches.filter((b) => b.state === 0 || b.state === 2).length;
  const exceptionLots = batches.filter((b) => b.state === 1).length;
  const deliveredLots = batches.filter((b) => b.state === 3).length;

  async function handleCustody() {
    if (!selected) return;
    try {
      const account = wallet || (await connectAlgorandWallet());
      if (!account) throw new Error('Connect Pera Wallet before signing custody transfer.');
      if (!wallet) setWallet(account);
      const numericBatchId = Number.parseInt(String(selected.batch_id).replace(/\D/g, ''), 10) || 1;
      const transaction = await signAndSubmitAlgorandAppCall({
        sender: account,
        method: 'transferBatch',
        args: [numericBatchId, account],
      });
      await algorandAPI.syncBatch({
        batchId: selected.batch_id,
        txId: transaction.txId,
        confirmedRound: transaction.confirmedRound,
        state: 2,
      });
      setNotice({
        message: `Algorand custody transfer confirmed in round ${transaction.confirmedRound}.`,
        type: 'success',
      });
      await loadBatches();
    } catch (e: any) {
      setNotice({
        message: e?.response?.data?.error || e?.message || 'Custody transfer failed.',
        type: 'error',
      });
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!drugName.trim()) return;
    setCreating(true);
    setNotice(null);
    try {
      const account = wallet || (await connectAlgorandWallet());
      if (!account) throw new Error('Connect Pera Wallet before registering a batch.');
      if (!wallet) setWallet(account);
      const transaction = await signAndSubmitAlgorandAppCall({
        sender: account,
        method: 'createBatch',
        args: [drugName.trim()],
      });
      await algorandAPI.recordBatch({
        drugName: drugName.trim(),
        manufacturer: account,
        txId: transaction.txId,
        confirmedRound: transaction.confirmedRound,
        state: 0,
      });
      setDrugName('');
      setShowCreate(false);
      setNotice({
        message: `Algorand batch registered in round ${transaction.confirmedRound}.`,
        type: 'success',
      });
      await loadBatches();
    } catch (e: any) {
      setNotice({
        message: e?.response?.data?.error || 'Failed to register batch.',
        type: 'error',
      });
    } finally {
      setCreating(false);
    }
  }

  async function handleBreach() {
    if (!selected || selected.state === 1) return;
    try {
      const account = wallet || (await connectAlgorandWallet());
      if (!account) throw new Error('Connect Pera Wallet before reporting an excursion.');
      if (!wallet) setWallet(account);
      const numericBatchId = Number.parseInt(String(selected.batch_id).replace(/\D/g, ''), 10) || 1;
      const transaction = await signAndSubmitAlgorandAppCall({
        sender: account,
        method: 'flagBreach',
        args: [numericBatchId],
      });
      await algorandAPI.syncBatch({
        batchId: selected.batch_id,
        txId: transaction.txId,
        confirmedRound: transaction.confirmedRound,
        state: 1,
      });
      setNotice({
        message: `Temperature excursion anchored on Algorand in round ${transaction.confirmedRound}.`,
        type: 'error',
      });
      setSelected({ ...selected, state: 1 });
      await loadBatches();
    } catch (e: any) {
      setNotice({
        message: e?.response?.data?.error || 'Could not flag excursion.',
        type: 'error',
      });
    }
  }

  async function handleDelivery() {
    if (!selected || selected.state !== 2) return;
    try {
      const account = wallet || (await connectAlgorandWallet());
      if (!account) throw new Error('Connect Pera Wallet before confirming delivery.');
      if (!wallet) setWallet(account);
      const numericBatchId = Number.parseInt(String(selected.batch_id).replace(/\D/g, ''), 10) || 1;
      const transaction = await signAndSubmitAlgorandAppCall({
        sender: account,
        method: 'confirmDelivery',
        args: [numericBatchId],
      });
      await algorandAPI.syncBatch({
        batchId: selected.batch_id,
        txId: transaction.txId,
        confirmedRound: transaction.confirmedRound,
        state: 3,
      });
      setSelected({ ...selected, state: 3 });
      setNotice({
        message: `Delivery confirmation recorded in Algorand round ${transaction.confirmedRound}.`,
        type: 'success',
      });
      await loadBatches();
    } catch (e: any) {
      setNotice({
        message: e?.response?.data?.error || e?.message || 'Could not confirm delivery.',
        type: 'error',
      });
    }
  }

  return (
    <div className="shell flex min-h-screen flex-col">
      <Navbar walletAddress={wallet} onWalletConnected={setWallet} />

      <main className="flex-1 py-8 sm:py-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-6">
          {/* Header */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-brand-ink sm:text-3xl">
                Cold-Chain Operator Console
              </h1>
              <p className="mt-1 text-xs text-brand-muted sm:text-sm">
                Real-time pharmaceutical lot custody, sensor health, and automated threshold alerts.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowCreate(true)}
                className="inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-brand-navy px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800 focus-ring"
              >
                <Plus className="h-4 w-4 text-brand-teal-light" />
                Register Monitored Lot
              </button>
            </div>
          </div>

          {/* Feedback Banners */}
          {error && (
            <div className="flex items-center justify-between rounded-lg border border-brand-amber/30 bg-brand-amber-subtle p-3 text-xs text-brand-amber-text">
              <div className="flex items-center gap-2">
                <Radio className="h-4 w-4 text-brand-amber shrink-0" />
                <span>{error}</span>
              </div>
              <button
                type="button"
                onClick={loadBatches}
                className="font-semibold underline hover:no-underline ml-4"
              >
                Retry
              </button>
            </div>
          )}

          {notice && (
            <div
              className={`flex items-center justify-between rounded-lg border p-3 text-xs ${
                notice.type === 'error'
                  ? 'border-brand-danger/30 bg-brand-danger-subtle text-brand-danger-text'
                  : notice.type === 'success'
                  ? 'border-brand-safe/30 bg-brand-safe-subtle text-brand-safe-text'
                  : 'border-brand-teal/30 bg-brand-teal-subtle text-brand-teal'
              }`}
            >
              <span>{notice.message}</span>
              <button
                type="button"
                onClick={() => setNotice(null)}
                className="ml-4 font-semibold text-brand-ink hover:opacity-75"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Real Operational Metrics */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <div className="surface p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-brand-muted">Total Lots</span>
                <Layers className="h-4 w-4 text-brand-faint" />
              </div>
              <div className="mt-2 text-2xl font-bold font-mono text-brand-ink">{totalLots}</div>
              <div className="mt-1 text-[11px] text-brand-muted">Monitored in registry</div>
            </div>

            <div className="surface p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-brand-muted">In Transit</span>
                <Activity className="h-4 w-4 text-brand-teal" />
              </div>
              <div className="mt-2 text-2xl font-bold font-mono text-brand-teal">{inMotionLots}</div>
              <div className="mt-1 text-[11px] text-brand-muted">Active temperature probe</div>
            </div>

            <div className="surface p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-brand-muted">Excursions</span>
                <AlertTriangle className="h-4 w-4 text-brand-danger" />
              </div>
              <div className="mt-2 text-2xl font-bold font-mono text-brand-danger">{exceptionLots}</div>
              <div className="mt-1 text-[11px] text-brand-muted">Breached 2°C to 8°C limits</div>
            </div>

            <div className="surface p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-brand-muted">Delivered</span>
                <FileCheck className="h-4 w-4 text-brand-safe" />
              </div>
              <div className="mt-2 text-2xl font-bold font-mono text-brand-safe">{deliveredLots}</div>
              <div className="mt-1 text-[11px] text-brand-muted">Accepted by pharmacy</div>
            </div>
          </div>

          {/* Inventory Table */}
          <BatchTable
            batches={batches}
            loading={loading}
            selectedBatch={selected}
            onSelectBatch={openBatch}
          />

          {/* Detailed Batch Inspection Drawer */}
          {selected && (
            <div className="surface overflow-hidden border-brand-teal/40">
              <div className="border-b border-brand-border bg-brand-subtle/50 p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-brand-teal">
                      {selected.batch_id}
                    </span>
                    <StatusBadge state={selected.state as BatchState} />
                  </div>
                  <h2 className="text-lg font-bold text-brand-ink mt-1">
                    {selected.drug_name}
                  </h2>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleBreach}
                    disabled={selected.state === 1}
                    className="rounded-lg border border-brand-danger/30 bg-brand-danger-subtle px-3 py-1.5 text-xs font-semibold text-brand-danger-text hover:bg-brand-danger/10 transition-colors focus-ring min-h-[36px]"
                  >
                    {selected.state === 1 ? 'Excursion Flagged' : 'Report Excursion'}
                  </button>

                  <button
                    type="button"
                    onClick={handleCustody}
                    className="rounded-lg bg-brand-navy px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 transition-colors focus-ring min-h-[36px]"
                  >
                    Sign Algorand Custody Transfer
                  </button>

                  {selected.state === 2 && (
                    <button
                      type="button"
                      onClick={handleDelivery}
                      className="rounded-lg border border-brand-safe/30 bg-brand-safe-subtle px-3 py-1.5 text-xs font-semibold text-brand-safe-text hover:bg-brand-safe/10 transition-colors focus-ring min-h-[36px]"
                    >
                      Confirm Delivery
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setSelected(null)}
                    aria-label="Close inspector"
                    className="grid h-8 w-8 place-items-center rounded-lg border border-brand-border text-brand-muted hover:bg-brand-subtle focus-ring"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="p-5 sm:p-6 grid gap-6 lg:grid-cols-12">
                <div className="lg:col-span-8">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-xs font-semibold text-brand-ink">
                      Real-time Temperature Trace
                    </h3>
                    <span className="text-[11px] text-brand-muted">
                      Safe Limit: 2°C to 8°C
                    </span>
                  </div>
                  <TelemetryChart data={telemetry} />
                </div>

                <div className="lg:col-span-4 rounded-lg bg-brand-paper p-4 border border-brand-border text-xs space-y-3">
                  <h3 className="font-semibold text-brand-ink">Lot Metadata</h3>
                  <div className="space-y-2">
                    <div>
                      <div className="text-brand-muted">Manufacturer Address</div>
                      <div className="font-mono text-brand-ink mt-0.5 break-all">
                        {selected.manufacturer}
                      </div>
                    </div>
                    <div>
                      <div className="text-brand-muted">Registration Date</div>
                      <div className="font-mono text-brand-ink mt-0.5">
                        {new Date(selected.created_at).toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <div className="text-brand-muted">Readings Logged</div>
                      <div className="text-brand-ink mt-0.5">
                        <span className="font-mono font-semibold">{telemetry.length}</span> data points
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Registration Modal */}
      {showCreate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-brand-navy/60 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
        >
          <div className="surface w-full max-w-md p-6 shadow-xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-brand-border pb-3">
              <h2 className="text-base font-bold text-brand-ink">Register Pharmaceutical Lot</h2>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="rounded-md p-1 text-brand-muted hover:bg-brand-subtle"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="mt-4 space-y-4">
              <div>
                <label htmlFor="drugName" className="block text-xs font-semibold text-brand-ink">
                  Medication Name & Strength
                </label>
                <input
                  id="drugName"
                  type="text"
                  autoFocus
                  required
                  value={drugName}
                  onChange={(e) => setDrugName(e.target.value)}
                  placeholder="e.g. Insulin Glargine 100u/mL"
                  className="mt-1 w-full rounded-lg border border-brand-border bg-brand-paper p-2.5 text-xs text-brand-ink placeholder:text-brand-faint focus-ring min-h-[42px]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="rounded-lg border border-brand-border px-4 py-2 text-xs font-semibold text-brand-ink hover:bg-brand-subtle min-h-[40px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || !drugName.trim()}
                  className="rounded-lg bg-brand-navy px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50 min-h-[40px]"
                >
                  {creating ? 'Registering…' : 'Register Batch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
