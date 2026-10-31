/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          paper: '#f8fafc',
          surface: '#ffffff',
          subtle: '#f1f5f9',
          border: '#e2e8f0',
          'border-strong': '#cbd5e1',
          ink: '#0f172a',
          navy: '#0b1929',
          muted: '#475569',
          faint: '#64748b',
          teal: '#0891b2',
          'teal-light': '#06b6d4',
          'teal-subtle': '#ecfeff',
          safe: '#059669',
          'safe-subtle': '#ecfdf5',
          'safe-text': '#065f46',
          danger: '#dc2626',
          'danger-subtle': '#fef2f2',
          'danger-text': '#991b1b',
          amber: '#d97706',
          'amber-subtle': '#fffbeb',
          'amber-text': '#92400e',
        },
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          'Helvetica',
          'Arial',
          'sans-serif',
        ],
        mono: [
          '"JetBrains Mono"',
          '"SF Mono"',
          'Consolas',
          '"Liberation Mono"',
          'monospace',
        ],
      },
    },
  },
  plugins: [],
};