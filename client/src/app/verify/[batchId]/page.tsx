'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  ArrowLeft,
  Calendar,
  Building2,
  Cpu,
  Layers,
} from 'lucide-react';
import Navbar from '../../../components/Navbar';
import TelemetryChart from '../../../components/TelemetryChart';
import Timeline from '../../../components/Timeline';
import StatusBadge, { type BatchState } from '../../../components/StatusBadge';
import { batchAPI, telemetryAPI, type BatchDetails, type TelemetryPoint } from '../../../lib/api';

export default function VerifyBatch() {
  const params = useParams();
  const batchId = params?.batchId as string;
  const [batch, setBatch] = useState<BatchDetails | null>(null);
  const [telemetry, setTelemetry] = useState<TelemetryPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    if (!batchId) return;
    try {
      const [batchRes, telemetryRes] = await Promise.all([
        batchAPI.get(batchId),
        telemetryAPI.history(batchId),
      ]);
      setBatch(batchRes.data.batch);
      setTelemetry(telemetryRes.data.telemetry || []);
      setError('');
    } catch (e: any) {
      setError(
        e?.response?.status === 404
          ? 'Certificate not found in registry. Please verify the batch ID printed on your package.'
          : 'The verification node is temporarily unreachable. Please try again in a few moments.'
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 12000);
    return () => clearInterval(interval);
  }, [batchId]);

  if (loading) {
    return (
      <div className="shell flex min-h-screen flex-col">
        <Navbar />
        <main className="flex-1 flex items-center justify-center p-6">
          <div className="text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-brand-border border-t-brand-teal" />
            <p className="mt-4 text-sm font-semibold text-brand-ink">
              Querying cryptographic provenance certificate…
            </p>
          </div>
        </main>
      </div>
    );
  }

  if (error || !batch) {
    return (
      <div className="shell flex min-h-screen flex-col">
        <Navbar />
        <main className="flex-1 flex items-center justify-center p-6">
          <div className="surface max-w-md p-8 text-center">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-brand-danger-subtle text-brand-danger mb-4">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <h1 className="text-lg font-bold text-brand-ink">Certificate Lookup Failed</h1>
            <p className="mt-2 text-xs leading-relaxed text-brand-muted">{error}</p>
            <Link
              href="/verify"
              className="mt-6 inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-brand-navy px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
            >
              <ArrowLeft className="h-4 w-4" />
              Return to QR Scanner
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const isBreached = batch.state === 1;

  return (
    <div className="shell flex min-h-screen flex-col">
      <Navbar />

      <main className="flex-1 py-8 sm:py-12">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 space-y-8">
          {/* Header Link */}
          <div>
            <Link
              href="/verify"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-muted hover:text-brand-ink transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to scanner
            </Link>
          </div>

          {/* Certificate Verdict Card */}
          <div
            className={`surface p-6 sm:p-8 border-2 ${
              isBreached
                ? 'border-brand-danger/40 bg-brand-danger-subtle/30'
                : 'border-brand-safe/40 bg-brand-safe-subtle/30'
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
              <div className="flex items-start gap-4">
                <div
                  className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${
                    isBreached
                      ? 'bg-brand-danger text-white'
                      : 'bg-brand-safe text-white'
                  }`}
                >
                  {isBreached ? (
                    <AlertTriangle className="h-7 w-7" />
                  ) : (
                    <ShieldCheck className="h-7 w-7" />
                  )}
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-brand-muted">
                      Batch <code className="font-mono">#{batch.batchId}</code>
                    </span>
                    <StatusBadge state={batch.state as BatchState} />
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-brand-ink mt-1">
                    {batch.drugName}
                  </h1>
                  <p className="mt-1 text-xs sm:text-sm text-brand-muted">
                    {isBreached
                      ? 'WARNING: Temperature excursion recorded during transit. Do not administer without pharmacist inspection.'
                      : 'Verified authentic. Stored and transported within the mandatory 2°C – 8°C cold chain limits.'}
                  </p>
                </div>
              </div>

              <div className="sm:text-right shrink-0 border-t sm:border-t-0 pt-4 sm:pt-0 border-brand-border">
                <div className="text-xs text-brand-muted">Inspection status</div>
                <div
                  className={`text-base font-bold font-mono mt-0.5 ${
                    isBreached ? 'text-brand-danger-text' : 'text-brand-safe-text'
                  }`}
                >
                  {isBreached ? 'COMPROMISED' : 'SAFE TO DISPENSE'}
                </div>
              </div>
            </div>
          </div>

          {/* Metadata & Timeline Grid */}
          <div className="grid gap-6 lg:grid-cols-12 lg:items-start">
            <div className="lg:col-span-7">
              <Timeline batch={batch} />
            </div>

            <div className="lg:col-span-5 surface p-5 sm:p-6 space-y-4">
              <h2 className="text-base font-semibold text-brand-ink border-b border-brand-border pb-3">
                Lot Certificate Details
              </h2>

              <dl className="space-y-3.5 text-xs">
                <div>
                  <dt className="text-brand-muted">Batch Identifier</dt>
                  <dd className="font-mono font-semibold text-brand-ink mt-0.5">
                    {batch.batchId}
                  </dd>
                </div>

                <div>
                  <dt className="text-brand-muted">Manufacturer Address</dt>
                  <dd className="font-mono text-brand-ink mt-0.5 break-all">
                    {batch.manufacturer}
                  </dd>
                </div>

                <div>
                  <dt className="text-brand-muted">Manufacturing Date</dt>
                  <dd className="font-mono text-brand-ink mt-0.5">
                    {new Date(batch.createdAt).toLocaleString()}
                  </dd>
                </div>

                <div>
                  <dt className="text-brand-muted">Hardware Verification</dt>
                  <dd className="text-brand-ink mt-0.5 font-medium">
                    Continuous IoT probe with ECDSA signature
                  </dd>
                </div>
              </dl>
            </div>
          </div>

          {/* Telemetry Chart Section */}
          <div className="surface p-5 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-brand-border pb-4 gap-2">
              <div>
                <h2 className="text-base font-semibold text-brand-ink">
                  Temperature Sensor Log
                </h2>
                <p className="text-xs text-brand-muted mt-0.5">
                  Complete environmental trace recorded by on-package probe
                </p>
              </div>
              <span className="text-xs text-brand-muted">
                <span className="font-mono">{telemetry.length}</span> readings verified
              </span>
            </div>

            <div className="mt-6">
              <TelemetryChart data={telemetry} />
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-brand-border bg-brand-surface py-6 text-center text-xs text-brand-muted">
        Public read-only pharmaceutical certificate · Cryptographically anchored
      </footer>
    </div>
  );
}
