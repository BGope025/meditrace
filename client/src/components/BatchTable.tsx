'use client';

import { useMemo, useState } from 'react';
import { Search, ChevronRight, AlertCircle, Inbox } from 'lucide-react';
import type { Batch } from '../lib/api';
import StatusBadge, { type BatchState } from './StatusBadge';

interface BatchTableProps {
  batches: Batch[];
  loading: boolean;
  selectedBatch: Batch | null;
  onSelectBatch: (batch: Batch) => void;
}

type Filter = 'all' | 'active' | 'attention' | 'delivered';

export default function BatchTable({
  batches,
  loading,
  selectedBatch,
  onSelectBatch,
}: BatchTableProps) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const filteredBatches = useMemo(() => {
    return batches.filter((batch) => {
      const q = query.toLowerCase();
      const matchesSearch =
        batch.batch_id.toLowerCase().includes(q) ||
        batch.drug_name.toLowerCase().includes(q) ||
        batch.manufacturer.toLowerCase().includes(q);

      if (!matchesSearch) return false;
      if (filter === 'active') return batch.state === 0 || batch.state === 2;
      if (filter === 'attention') return batch.state === 1;
      if (filter === 'delivered') return batch.state === 3;
      return true;
    });
  }, [batches, query, filter]);

  const filterTabs: { id: Filter; label: string; count?: number }[] = [
    { id: 'all', label: 'All lots', count: batches.length },
    {
      id: 'active',
      label: 'In motion',
      count: batches.filter((b) => b.state === 0 || b.state === 2).length,
    },
    {
      id: 'attention',
      label: 'Exceptions',
      count: batches.filter((b) => b.state === 1).length,
    },
    {
      id: 'delivered',
      label: 'Delivered',
      count: batches.filter((b) => b.state === 3).length,
    },
  ];

  return (
    <div className="surface overflow-hidden">
      <div className="border-b border-brand-border p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-brand-ink">Monitored Inventory</h2>
            <span className="rounded-md bg-brand-subtle px-2 py-0.5 text-xs font-medium text-brand-muted">
              <span className="font-mono">{filteredBatches.length}</span> of <span className="font-mono">{batches.length}</span>
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[200px] flex-1 sm:w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-faint" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search batch ID, drug, or address…"
                className="w-full rounded-lg border border-brand-border bg-brand-paper py-1.5 pl-9 pr-3 text-xs text-brand-ink placeholder:text-brand-faint focus-ring"
              />
            </div>
          </div>
        </div>

        <div className="mt-4 flex gap-1 border-t border-brand-border/60 pt-3 overflow-x-auto" role="tablist">
          {filterTabs.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={filter === tab.id}
              onClick={() => setFilter(tab.id)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                filter === tab.id
                  ? 'bg-brand-navy text-white'
                  : 'text-brand-muted hover:bg-brand-subtle hover:text-brand-ink'
              }`}
            >
              {tab.label}
              {typeof tab.count === 'number' && (
                <span
                  className={`rounded-full px-1.5 text-[11px] font-mono ${
                    filter === tab.id ? 'bg-white/20 text-white' : 'bg-brand-subtle text-brand-faint'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-xs">
          <thead>
            <tr className="border-b border-brand-border bg-brand-subtle/50 text-brand-muted font-medium">
              <th scope="col" className="py-3 px-4 font-medium">Batch ID & Drug</th>
              <th scope="col" className="py-3 px-4 font-medium">Current Custodian</th>
              <th scope="col" className="py-3 px-4 font-medium">Status</th>
              <th scope="col" className="py-3 px-4 font-medium">Registered</th>
              <th scope="col" className="py-3 px-4 font-medium text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-border">
            {loading ? (
              Array.from({ length: 4 }).map((_, idx) => (
                <tr key={idx} className="animate-pulse">
                  <td colSpan={5} className="py-4 px-4">
                    <div className="h-4 w-full rounded bg-brand-subtle" />
                  </td>
                </tr>
              ))
            ) : filteredBatches.length > 0 ? (
              filteredBatches.map((batch) => {
                const isSelected = selectedBatch?.batch_id === batch.batch_id;
                return (
                  <tr
                    key={batch.batch_id}
                    onClick={() => onSelectBatch(batch)}
                    className={`cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-brand-teal-subtle/60'
                        : 'hover:bg-brand-subtle/40'
                    }`}
                  >
                    <td className="py-3.5 px-4">
                      <div className="font-mono text-xs font-semibold text-brand-teal">
                        {batch.batch_id}
                      </div>
                      <div className="font-semibold text-brand-ink mt-0.5">
                        {batch.drug_name}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-brand-muted">
                      {batch.manufacturer.length > 18
                        ? `${batch.manufacturer.slice(0, 10)}…${batch.manufacturer.slice(-4)}`
                        : batch.manufacturer}
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusBadge state={batch.state as BatchState} />
                    </td>
                    <td className="py-3.5 px-4 text-brand-muted font-mono">
                      {new Date(batch.created_at).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectBatch(batch);
                        }}
                        className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold text-brand-teal hover:bg-brand-teal-subtle focus-ring"
                      >
                        Inspect
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={5} className="py-12 px-4 text-center">
                  <div className="mx-auto flex max-w-sm flex-col items-center justify-center text-center">
                    <Inbox className="h-8 w-8 text-brand-faint mb-2" />
                    <p className="text-sm font-semibold text-brand-ink">No batches match this view</p>
                    <p className="mt-1 text-xs text-brand-muted">
                      Try clearing your search query or registering a new monitored batch.
                    </p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
