"use client";

import * as React from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import { useCurrency } from "@/hooks/use-currency";
import { formatMoney } from "@/lib/currency";

const tooltipStyle = {
  backgroundColor: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: "0.5rem",
  fontSize: "12px",
  color: "var(--popover-foreground)",
  boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
};

interface ForecastPoint {
  day: number;
  dateLabel: string;
  projectedBalance: number;
}

export function ForecastChart({
  data,
  currentBalance,
  minBalance,
  zeroDay,
}: {
  data: ForecastPoint[];
  currentBalance: number;
  minBalance: number;
  zeroDay: number | null;
}) {
  const { currency } = useCurrency();
  const fmt = (amount: number, opts?: { compact?: boolean; sign?: boolean }) =>
    formatMoney(amount, currency, opts ?? {});
  const hasNegative = data.some((d) => d.projectedBalance < 0);

  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={data} margin={{ top: 10, right: 8, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="forecastGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={hasNegative ? "#f43f5e" : "#10b981"} stopOpacity={0.3} />
            <stop offset="100%" stopColor={hasNegative ? "#f43f5e" : "#10b981"} stopOpacity={0} />
          </linearGradient>
          <linearGradient id="forecastGradNeg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.4} />
            <stop offset="100%" stopColor="#f43f5e" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis
          dataKey="dateLabel"
          stroke="var(--muted-foreground)"
          fontSize={10}
          tickLine={false}
          axisLine={false}
          interval={4}
        />
        <YAxis
          stroke="var(--muted-foreground)"
          fontSize={10}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => fmt(v, { compact: true })}
          width={52}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(v: number) => [fmt(v), "Projected Balance"]}
          labelFormatter={(label) => `Day ${label}`}
        />
        <ReferenceLine
          y={0}
          stroke="#f43f5e"
          strokeWidth={1}
          strokeDasharray="4 4"
          label={{ value: "Zero", position: "insideLeft", fill: "#f43f5e", fontSize: 10 }}
        />
        <ReferenceLine
          y={currentBalance}
          stroke="var(--muted-foreground)"
          strokeWidth={1}
          strokeDasharray="2 2"
          label={{ value: "Now", position: "insideRight", fill: "var(--muted-foreground)", fontSize: 10 }}
        />
        <Area
          type="monotone"
          dataKey="projectedBalance"
          stroke={hasNegative ? "#f43f5e" : "#10b981"}
          strokeWidth={2}
          fill="url(#forecastGrad)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
