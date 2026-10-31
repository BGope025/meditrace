'use client';

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  ReferenceArea,
  ReferenceLine,
} from 'recharts';
import type { TelemetryPoint } from '../lib/api';

interface TelemetryChartProps {
  data: TelemetryPoint[];
}

export default function TelemetryChart({ data }: TelemetryChartProps) {
  const chartData = [...data]
    .reverse()
    .map((point) => ({
      ...point,
      label: new Date(point.timestamp).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
    }));

  if (!chartData.length) {
    return (
      <div className="grid h-64 place-items-center rounded-lg border border-dashed border-brand-border bg-brand-subtle/50 text-xs text-brand-muted">
        No temperature telemetry has been logged for this batch yet.
      </div>
    );
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 16, right: 16, left: -20, bottom: 0 }}>
          <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
          {/* 2°C to 8°C Safe Cold Chain Band */}
          <ReferenceArea y1={2} y2={8} fill="#059669" fillOpacity={0.08} />
          <ReferenceLine
            y={2}
            stroke="#059669"
            strokeDasharray="4 4"
            label={{
              value: '2°C lower threshold',
              position: 'insideTopLeft',
              fill: '#065f46',
              fontSize: 11,
              fontWeight: 500,
            }}
          />
          <ReferenceLine
            y={8}
            stroke="#059669"
            strokeDasharray="4 4"
            label={{
              value: '8°C upper threshold',
              position: 'insideBottomLeft',
              fill: '#065f46',
              fontSize: 11,
              fontWeight: 500,
            }}
          />
          <XAxis
            dataKey="label"
            tick={{ fill: '#475569', fontSize: 11, fontFamily: 'monospace' }}
            tickLine={false}
            axisLine={{ stroke: '#cbd5e1' }}
            minTickGap={32}
          />
          <YAxis
            domain={['auto', 'auto']}
            tick={{ fill: '#475569', fontSize: 11, fontFamily: 'monospace' }}
            tickLine={false}
            axisLine={false}
            unit="°"
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'var(--color-surface)',
              borderRadius: '8px',
              border: '1px solid var(--color-border)',
              boxShadow: '0 4px 12px rgba(15, 23, 42, 0.08)',
              fontSize: '12px',
            }}
            formatter={(val: number) => [`${val}°C`, 'Temperature']}
          />
          <Line
            type="monotone"
            dataKey="temperature"
            stroke="var(--color-navy)"
            strokeWidth={2}
            dot={{ r: 3, fill: 'var(--color-teal)', strokeWidth: 1.5, stroke: 'var(--color-surface)' }}
            activeDot={{ r: 5, fill: 'var(--color-teal)' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
