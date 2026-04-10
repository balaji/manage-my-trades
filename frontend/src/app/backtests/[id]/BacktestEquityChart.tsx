'use client';

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

interface BacktestEquityPoint {
  date: string;
  value: number;
}

export function BacktestEquityChart({ equityData }: { equityData: BacktestEquityPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={equityData}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis
          dataKey="date"
          tickFormatter={(value) =>
            new Date(value).toLocaleDateString(undefined, {
              month: 'short',
              year: '2-digit',
            })
          }
          tick={{ fontSize: 11 }}
          interval={Math.ceil(equityData.length / 8)}
        />
        <YAxis
          tickFormatter={(value) => `$${(value as number).toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
          tick={{ fontSize: 11 }}
          width={80}
        />
        <Tooltip
          formatter={(value) => [
            `$${(value as number).toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
            'Portfolio Value',
          ]}
          labelFormatter={(value) => new Date(value as string).toLocaleDateString()}
        />
        <Line type="monotone" dataKey="value" stroke="#2563eb" dot={false} strokeWidth={2} />
      </LineChart>
    </ResponsiveContainer>
  );
}
