import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'MediTrace | Cold-chain intelligence',
  description: 'Verified pharmaceutical provenance and live cold-chain monitoring.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
