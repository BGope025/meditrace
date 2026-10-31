'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ChevronRight, ShieldCheck, QrCode } from 'lucide-react';
import Navbar from '../../components/Navbar';
import QrScanner from '../../components/QrScanner';
import StatusBadge, { type BatchState } from '../../components/StatusBadge';
import { batchAPI, type Batch } from '../../lib/api';

export default function VerifyIndex() {
  const [batches, setBatches] = useState<Batch[]>([]);

  useEffect(() => {
    batchAPI
      .list()
      .then((res) => setBatches(res.data.batches || []))
      .catch(() => undefined);
  }, []);

  return (
    <div className="shell flex min-h-screen flex-col">
      <Navbar />

      <main className="flex-1 py-10 sm:py-14">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <h1 className="text-3xl font-extrabold tracking-tight text-brand-ink sm:text-5xl">
              Inspect your medication’s cold chain.
            </h1>
            <p className="mt-3 text-sm text-brand-muted sm:text-base leading-relaxed">
              Verify that vaccines, insulin, and sensitive therapeutics were maintained strictly within 2°C to 8°C throughout their journey from factory to pharmacy.
            </p>
          </div>

          <div className="mt-10 grid gap-8 lg:grid-cols-12 lg:items-start">
            <div className="lg:col-span-6">
              <QrScanner />
            </div>

            <div className="lg:col-span-6 surface p-5 sm:p-6">
              <div className="flex items-center justify-between border-b border-brand-border pb-4">
                <div>
                  <h2 className="text-base font-semibold text-brand-ink">
                    Recent Public Certificates
                  </h2>
                  <p className="text-xs text-brand-muted mt-0.5">
                    Browse monitored lots currently on the decentralized registry
                  </p>
                </div>
              </div>

              <div className="mt-4 divide-y divide-brand-border">
                {batches.length > 0 ? (
                  batches.slice(0, 6).map((batch) => (
                    <Link
                      key={batch.batch_id}
                      href={`/verify/${encodeURIComponent(batch.batch_id)}`}
                      className="group flex items-center justify-between py-3.5 transition-colors hover:bg-brand-subtle/50 px-2 rounded-lg -mx-2"
                    >
                      <div className="min-w-0 pr-4">
                        <div className="font-mono text-xs font-semibold text-brand-teal">
                          {batch.batch_id}
                        </div>
                        <div className="font-semibold text-brand-ink text-sm truncate mt-0.5">
                          {batch.drug_name}
                        </div>
                        <div className="text-xs text-brand-muted mt-0.5">
                          Registered <span className="font-mono">{new Date(batch.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <StatusBadge state={batch.state as BatchState} />
                        <ChevronRight className="h-4 w-4 text-brand-faint group-hover:text-brand-ink transition-colors" />
                      </div>
                    </Link>
                  ))
                ) : (
                  <div className="py-8 text-center text-xs text-brand-muted">
                    No public batch certificates available.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-brand-border bg-brand-surface py-6 text-center text-xs text-brand-muted">
        MediTrace Public Verification Portal · Cryptographically anchored telemetry records
      </footer>
    </div>
  );
}
