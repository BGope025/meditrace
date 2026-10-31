'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ShieldCheck,
  LayoutDashboard,
  QrCode,
  Database,
  Wallet,
  Menu,
  X,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import {
  connectAlgorandWallet,
  disconnectAlgorandWallet,
  getAlgorandBalance,
  reconnectAlgorandWallet,
} from '../lib/algorand';

interface NavbarProps {
  onWalletConnected?: (account: string) => void;
  walletAddress?: string;
}

export default function Navbar({ onWalletConnected, walletAddress }: NavbarProps) {
  const pathname = usePathname();
  const [currentAccount, setCurrentAccount] = useState<string>(walletAddress || '');
  const [currentBalance, setCurrentBalance] = useState<string>('');
  const [connecting, setConnecting] = useState(false);
  const [walletError, setWalletError] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (walletAddress) setCurrentAccount(walletAddress);
  }, [walletAddress]);

  useEffect(() => {
    let cancelled = false;

    reconnectAlgorandWallet()
      .then(async (account) => {
        if (!account || cancelled) return;
        setCurrentAccount(account);
        onWalletConnected?.(account);
        const balance = await getAlgorandBalance(account);
        if (!cancelled) setCurrentBalance(balance.formatted);
      })
      .catch(() => {
        // No active Pera session is a normal first-visit state.
      });

    return () => {
      cancelled = true;
    };
  }, [onWalletConnected]);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  async function handleConnect() {
    setConnecting(true);
    setWalletError('');
    try {
      const account = await connectAlgorandWallet();
      if (!account) return;
      setCurrentAccount(account);
      onWalletConnected?.(account);
      const balance = await getAlgorandBalance(account);
      setCurrentBalance(balance.formatted);
    } catch (err: any) {
      const message = err?.message || 'Unable to connect to Pera Wallet.';
      setWalletError(message);
      console.warn('Pera Wallet connection note:', message);
    } finally {
      setConnecting(false);
    }
  }

  async function handleDisconnect() {
    await disconnectAlgorandWallet();
    setCurrentAccount('');
    setCurrentBalance('');
    setWalletError('');
  }

  const navLinks = [
    { href: '/dashboard', label: 'Operator Console', icon: LayoutDashboard },
    { href: '/verify', label: 'Verify Batch', icon: QrCode },
    { href: '/explorer', label: 'Chain Explorer', icon: Database },
  ];

  return (
    <header className="border-b border-brand-border bg-brand-surface sticky top-0 z-30">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2.5 text-brand-ink transition hover:opacity-90">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-brand-navy text-white">
              <ShieldCheck className="h-5 w-5 text-brand-teal-light" />
            </div>
            <span className="font-bold tracking-tight text-brand-ink text-base">
              MediTrace
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-1" aria-label="Main Navigation">
            {navLinks.map(({ href, label, icon: Icon }) => {
              const isActive = pathname === href || (href !== '/' && pathname.startsWith(href));
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-brand-subtle text-brand-ink'
                      : 'text-brand-muted hover:bg-brand-subtle hover:text-brand-ink'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            {currentAccount && currentBalance && (
              <span className="hidden lg:inline text-[11px] font-medium text-brand-muted" title="Algorand TestNet balance">
                {currentBalance}
              </span>
            )}
            <button
              type="button"
              onClick={currentAccount ? handleDisconnect : handleConnect}
              disabled={connecting}
              title={walletError || 'Algorand TestNet · Pera Wallet'}
              className="flex items-center gap-2 rounded-lg border border-brand-border bg-brand-surface px-3 py-1.5 text-xs font-semibold text-brand-ink transition-colors hover:bg-brand-subtle focus-ring min-h-[40px]"
            >
              <Wallet className="h-4 w-4 text-brand-teal" />
              {connecting
                ? 'Connecting…'
                : currentAccount
                ? `Pera · ${currentAccount.slice(0, 5)}…${currentAccount.slice(-4)}`
                : 'Connect Pera'}
            </button>
          </div>

          {/* Mobile menu button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden grid h-10 w-10 place-items-center rounded-lg border border-brand-border text-brand-muted hover:bg-brand-subtle focus-ring"
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-brand-border bg-brand-surface px-4 py-3 space-y-1 animate-in fade-in slide-in-from-top-2 duration-150">
          {navLinks.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href || (href !== '/' && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium min-h-[44px] transition-colors ${
                  isActive
                    ? 'bg-brand-subtle text-brand-ink font-semibold'
                    : 'text-brand-muted hover:bg-brand-subtle hover:text-brand-ink'
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            );
          })}
        </div>
      )}
    </header>
  );
}
