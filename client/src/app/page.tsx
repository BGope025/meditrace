import Link from 'next/link';
import { ShieldCheck, QrCode, ArrowRight, Activity, AlertCircle, Lock, CheckCircle2 } from 'lucide-react';
import Navbar from '../components/Navbar';

export default function Home() {
  return (
    <div className="shell flex min-h-screen flex-col">
      <Navbar />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="border-b border-brand-border bg-brand-surface py-16 sm:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid gap-12 lg:grid-cols-12 lg:items-center">
              <div className="lg:col-span-7">
                <h1 className="text-4xl font-extrabold tracking-tight text-brand-ink sm:text-6xl sm:leading-[1.1]">
                  Verified cold-chain pharmaceutical provenance.
                </h1>
                <p className="mt-5 max-w-2xl text-base leading-relaxed text-brand-muted sm:text-lg">
                  MediTrace bridges IoT temperature sensors and smart contracts to ensure medicines, vaccines, and biologics remain within strict environmental boundaries throughout transit.
                </p>

                <div className="mt-8 flex flex-wrap items-center gap-3">
                  <Link
                    href="/dashboard"
                    className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-brand-navy px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 focus-ring"
                  >
                    Open Operator Console
                    <ArrowRight className="h-4 w-4 text-brand-teal-light" />
                  </Link>

                  <Link
                    href="/verify"
                    className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-brand-border bg-brand-surface px-5 py-2.5 text-sm font-semibold text-brand-ink transition hover:bg-brand-subtle focus-ring"
                  >
                    <QrCode className="h-4 w-4 text-brand-teal" />
                    Verify a Carton
                  </Link>
                </div>
              </div>

              {/* Authentic Product Specimen Card */}
              <div className="lg:col-span-5">
                <div className="surface overflow-hidden border-brand-border-strong shadow-lg">
                  <div className="border-b border-brand-border bg-brand-subtle/50 px-5 py-3.5 flex items-center justify-between">
                    <span className="text-xs font-semibold text-brand-teal">
                      Specimen <code className="font-mono">MT-24091</code>
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-safe-subtle px-2.5 py-0.5 text-xs font-semibold text-brand-safe-text border border-brand-safe/25">
                      <span className="h-1.5 w-1.5 rounded-full bg-brand-safe" />
                      Cold-chain verified
                    </span>
                  </div>

                  <div className="p-5 space-y-4 text-xs">
                    <div>
                      <div className="text-brand-muted font-medium">Pharmaceutical Product</div>
                      <div className="text-sm font-bold text-brand-ink mt-0.5">Vaxigen ColdShield (10x 0.5mL)</div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-2 border-t border-brand-border">
                      <div>
                        <div className="text-brand-muted">Target Boundary</div>
                        <div className="font-semibold text-brand-ink mt-0.5">2°C to 8°C</div>
                      </div>
                      <div>
                        <div className="text-brand-muted">Observed Range</div>
                        <div className="font-semibold text-brand-safe mt-0.5">3.8°C to 4.2°C</div>
                      </div>
                    </div>

                    <div className="rounded-lg bg-brand-paper p-3 border border-brand-border text-[11px] space-y-1">
                      <div className="text-brand-muted flex justify-between">
                        <span>Ledger anchor</span>
                        <span className="text-brand-ink font-medium">Sepolia EVM</span>
                      </div>
                      <div className="text-brand-muted flex justify-between">
                        <span>Latest checkpoint</span>
                        <span className="text-brand-teal font-semibold">Accepted by Courier</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Core Pillars */}
        <section className="py-16 sm:py-20 bg-brand-paper">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl">
              <h2 className="text-2xl font-bold tracking-tight text-brand-ink sm:text-3xl">
                Engineered for pharmaceutical compliance and patient safety.
              </h2>
              <p className="mt-3 text-sm text-brand-muted leading-relaxed">
                Replaces paper waybills and unverifiable logs with real-time hardware telemetry and decentralized custody tracking.
              </p>
            </div>

            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              <div className="surface p-6">
                <div className="grid h-10 w-10 place-items-center rounded-lg bg-brand-teal-subtle text-brand-teal mb-4">
                  <Activity className="h-5 w-5" />
                </div>
                <h3 className="text-base font-semibold text-brand-ink">Edge-Signed Telemetry</h3>
                <p className="mt-2 text-xs leading-relaxed text-brand-muted">
                  IoT temperature probes cryptographically sign readings before transmission, eliminating post-hoc data tampering.
                </p>
              </div>

              <div className="surface p-6">
                <div className="grid h-10 w-10 place-items-center rounded-lg bg-brand-danger-subtle text-brand-danger mb-4">
                  <AlertCircle className="h-5 w-5" />
                </div>
                <h3 className="text-base font-semibold text-brand-ink">Automated Excursion Flagging</h3>
                <p className="mt-2 text-xs leading-relaxed text-brand-muted">
                  If readings breach the 2°C to 8°C safety window, smart contracts permanently mark the lot as compromised.
                </p>
              </div>

              <div className="surface p-6">
                <div className="grid h-10 w-10 place-items-center rounded-lg bg-brand-safe-subtle text-brand-safe mb-4">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <h3 className="text-base font-semibold text-brand-ink">Open Consumer Verification</h3>
                <p className="mt-2 text-xs leading-relaxed text-brand-muted">
                  Pharmacists and patients scan the QR code printed on the box to view the uninterrupted temperature certificate.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-brand-border bg-brand-surface py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-brand-muted">
          <div>MediTrace Systems</div>
          <div>Pharmaceutical provenance and cold-chain integrity.</div>
        </div>
      </footer>
    </div>
  );
}
