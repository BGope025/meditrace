import { Check, AlertTriangle, Clock, Factory, Truck, CheckCircle2 } from 'lucide-react';
import type { BatchDetails } from '../lib/api';

interface TimelineProps {
  batch: BatchDetails;
}

export default function Timeline({ batch }: TimelineProps) {
  const breached = batch.state === 1;

  const steps = [
    {
      title: 'Batch manufactured',
      detail: `${batch.drugName} registered by manufacturer ${batch.manufacturer.slice(0, 8)}…`,
      date: batch.createdAt,
      status: 'complete',
      icon: Factory,
    },
    {
      title: breached ? 'Temperature excursion detected' : 'In transit monitoring',
      detail: breached
        ? 'Sensor recorded a reading outside the 2°C – 8°C safety window. Immutable flag recorded.'
        : 'Continuous IoT telemetry active. Chain of custody maintained.',
      date: batch.updatedAt,
      status: breached ? 'breach' : batch.state >= 2 ? 'complete' : 'active',
      icon: breached ? AlertTriangle : Truck,
    },
    {
      title: 'Dispensing & destination handoff',
      detail:
        batch.state === 3
          ? 'Final custody transferred to pharmacy. Batch verified.'
          : 'Pending arrival and receiver verification.',
      date: batch.state === 3 ? batch.updatedAt : undefined,
      status: batch.state === 3 ? 'complete' : 'pending',
      icon: CheckCircle2,
    },
  ];

  return (
    <div className="surface p-5 sm:p-6">
      <div className="flex items-center justify-between border-b border-brand-border pb-4">
        <div>
          <h2 className="text-base font-semibold text-brand-ink">Provenance Timeline</h2>
          <p className="text-xs text-brand-muted mt-0.5">
            Immutable custody transitions and environmental checkpoint log
          </p>
        </div>
      </div>

      <div className="mt-6 space-y-6">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const isBreach = step.status === 'breach';
          const isComplete = step.status === 'complete';
          const isActive = step.status === 'active';

          return (
            <div key={step.title} className="relative flex gap-4">
              {index < steps.length - 1 && (
                <div
                  className="absolute left-4 top-8 -bottom-6 w-px bg-brand-border"
                  aria-hidden="true"
                />
              )}

              <div
                className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${
                  isBreach
                    ? 'border-brand-danger bg-brand-danger-subtle text-brand-danger'
                    : isComplete
                    ? 'border-brand-safe bg-brand-safe-subtle text-brand-safe'
                    : isActive
                    ? 'border-brand-teal bg-brand-teal-subtle text-brand-teal'
                    : 'border-brand-border bg-brand-subtle text-brand-faint'
                }`}
              >
                <Icon className="h-4 w-4" />
              </div>

              <div className="min-w-0 flex-1 pt-0.5">
                <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1">
                  <h3
                    className={`text-sm font-semibold ${
                      isBreach ? 'text-brand-danger-text' : 'text-brand-ink'
                    }`}
                  >
                    {step.title}
                  </h3>
                  {step.date && (
                    <span className="text-xs font-mono text-brand-muted">
                      {new Date(step.date).toLocaleString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-brand-muted leading-relaxed">
                  {step.detail}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
