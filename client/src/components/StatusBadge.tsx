export type BatchState = 0 | 1 | 2 | 3;

interface StatusBadgeProps {
  state: BatchState;
  className?: string;
}

const statusConfig: Record<BatchState, { label: string; badgeClass: string; dotClass: string }> = {
  0: {
    label: 'In transit',
    badgeClass: 'bg-brand-teal-subtle text-brand-teal border-brand-teal/20',
    dotClass: 'bg-brand-teal',
  },
  1: {
    label: 'Excursion detected',
    badgeClass: 'bg-brand-danger-subtle text-brand-danger-text border-brand-danger/25',
    dotClass: 'bg-brand-danger',
  },
  2: {
    label: 'Custody transferred',
    badgeClass: 'bg-brand-safe-subtle text-brand-safe-text border-brand-safe/25',
    dotClass: 'bg-brand-safe',
  },
  3: {
    label: 'Delivered',
    badgeClass: 'bg-brand-subtle text-brand-muted border-brand-border',
    dotClass: 'bg-brand-faint',
  },
};

export default function StatusBadge({ state, className = '' }: StatusBadgeProps) {
  const config = statusConfig[state] || statusConfig[0];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${config.badgeClass} ${className}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${config.dotClass}`} aria-hidden="true" />
      {config.label}
    </span>
  );
}
