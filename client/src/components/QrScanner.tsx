'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Camera, CameraOff, QrCode, Search, AlertCircle } from 'lucide-react';

export default function QrScanner() {
  const [active, setActive] = useState(false);
  const [manualId, setManualId] = useState('');
  const [error, setError] = useState('');
  const scannerRef = useRef<any>(null);
  const router = useRouter();

  useEffect(() => {
    return () => {
      scannerRef.current?.stop?.().catch(() => undefined);
    };
  }, []);

  async function startScanner() {
    setError('');
    setActive(true);
    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      const scanner = new Html5Qrcode('meditrace-qr-reader');
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        async (decoded: string) => {
          const batchId = decoded.split('/').filter(Boolean).pop() || decoded;
          await scanner.stop();
          setActive(false);
          router.push(`/verify/${encodeURIComponent(batchId)}`);
        },
        () => undefined
      );
    } catch (e: any) {
      setActive(false);
      setError(e?.message || 'Camera access was unavailable or denied. Please enter the batch ID manually below.');
    }
  }

  async function stopScanner() {
    await scannerRef.current?.stop?.().catch(() => undefined);
    setActive(false);
  }

  function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = manualId.trim();
    if (trimmed) {
      router.push(`/verify/${encodeURIComponent(trimmed)}`);
    }
  }

  return (
    <div className="surface overflow-hidden">
      <div className="border-b border-brand-border p-5 sm:p-6">
        <h2 className="text-base font-semibold text-brand-ink">Verify Medication Carton</h2>
        <p className="mt-1 text-xs text-brand-muted">
          Scan the cryptographic QR code printed on the physical package.
        </p>
      </div>

      <div className="p-5 sm:p-6">
        <div
          id="meditrace-qr-reader"
          className={`relative min-h-[260px] overflow-hidden rounded-lg border transition-colors ${
            active
              ? 'border-brand-teal bg-brand-navy'
              : 'border-dashed border-brand-border-strong bg-brand-subtle/50'
          }`}
        >
          {!active && (
            <div className="flex min-h-[260px] flex-col items-center justify-center p-6 text-center">
              <div className="grid h-12 w-12 place-items-center rounded-xl bg-brand-teal-subtle text-brand-teal">
                <QrCode className="h-6 w-6" />
              </div>
              <p className="mt-3 text-sm font-semibold text-brand-ink">Camera scanner standby</p>
              <p className="mt-1 max-w-xs text-xs text-brand-muted">
                Runs entirely in your browser without uploading your camera feed to any external server.
              </p>
            </div>
          )}
        </div>

        {error && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-brand-danger/20 bg-brand-danger-subtle p-3 text-xs text-brand-danger-text">
            <AlertCircle className="h-4 w-4 shrink-0 text-brand-danger mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="mt-4">
          {active ? (
            <button
              type="button"
              onClick={stopScanner}
              className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg bg-brand-danger px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700 focus-ring"
            >
              <CameraOff className="h-4 w-4" />
              Stop camera
            </button>
          ) : (
            <button
              type="button"
              onClick={startScanner}
              className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg bg-brand-navy px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-800 focus-ring"
            >
              <Camera className="h-4 w-4 text-brand-teal-light" />
              Start camera scan
            </button>
          )}
        </div>

        <div className="my-5 flex items-center gap-3">
          <div className="h-px flex-1 bg-brand-border" />
          <span className="text-xs font-medium text-brand-muted">Or search by batch identifier</span>
          <div className="h-px flex-1 bg-brand-border" />
        </div>

        <form onSubmit={handleManualSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={manualId}
              onChange={(e) => setManualId(e.target.value)}
              placeholder="e.g. MT-24091 or 1"
              className="w-full rounded-lg border border-brand-border bg-brand-paper py-2 pl-3 pr-3 text-xs font-mono text-brand-ink placeholder:text-brand-faint focus-ring min-h-[40px]"
            />
          </div>
          <button
            type="submit"
            className="flex items-center gap-1.5 rounded-lg border border-brand-border bg-brand-surface px-4 py-2 text-xs font-semibold text-brand-ink transition-colors hover:bg-brand-subtle focus-ring min-h-[40px]"
          >
            <Search className="h-3.5 w-3.5 text-brand-muted" />
            Lookup
          </button>
        </form>
      </div>
    </div>
  );
}
