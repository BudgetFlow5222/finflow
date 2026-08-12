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
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie,
  Legend,
  LineChart,
  Line,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Sector,
} from "recharts";
import { BarChart3, PieChart as PieChartIcon } from "lucide-react";
import { cn } from "@/lib/utils";
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

interface CashFlowPoint {
  month: string;
  income: number;
  expense: number;
  net: number;
}

export function CashFlowChart({ data }: { data: CashFlowPoint[] }) {
  const { currency } = useCurrency();
  const fmt = (amount: number, opts?: { compact?: boolean; sign?: boolean }) =>
    formatMoney(amount, currency, opts ?? {});
  if (!data || data.length === 0 || data.every((d) => d.income === 0 && d.expense === 0)) {
    return (
      <div className="flex h-[260px] flex-col items-center justify-center gap-2 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <BarChart3 className="h-6 w-6" />
        </div>
        <p className="text-xs font-medium text-muted-foreground">No cash flow data yet</p>
        <p className="text-[10px] text-muted-foreground/70">Record sales and expenses to see trends</p>
      </div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 10, right: 8, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.4} />
            <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--chart-5)" stopOpacity={0.35} />
            <stop offset="100%" stopColor="var(--chart-5)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis
          dataKey="month"
          stroke="var(--muted-foreground)"
          fontSize={11}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          stroke="var(--muted-foreground)"
          fontSize={11}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => fmt(v, { compact: true })}
          width={56}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(v: number, name: string) => [fmt(v), name === "income" ? "Income" : name === "expense" ? "Expense" : "Net"]}
        />
        <Area
          type="monotone"
          dataKey="income"
          stroke="var(--chart-1)"
          strokeWidth={2}
          fill="url(#incomeGrad)"
        />
        <Area
          type="monotone"
          dataKey="expense"
          stroke="var(--chart-5)"
          strokeWidth={2}
          fill="url(#expenseGrad)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ---------------------------------------------------------------------------
// Budget donut (50/30/20)
// ---------------------------------------------------------------------------

const BUDGET_COLORS: Record<string, string> = {
  NEED: "var(--chart-1)",
  WANT: "var(--chart-3)",
  SAVINGS: "var(--chart-2)",
};

export function BudgetDonut({
  data,
}: {
  data: { name: string; value: number; pct: number; spent: number }[];
}) {
  const { currency } = useCurrency();
  const fmt = (amount: number, opts?: { compact?: boolean; sign?: boolean }) =>
    formatMoney(amount, currency, opts ?? {});
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius={62}
            outerRadius={88}
            paddingAngle={3}
            stroke="none"
          >
            {data.map((d) => (
              <Cell key={d.name} fill={BUDGET_COLORS[d.name] ?? "var(--muted)"} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(v: number, _name: string, p: { payload?: { pct?: number; spent?: number } }) => [
              fmt(v),
              `Spent ${fmt(p.payload?.spent ?? 0)} (${p.payload?.pct ?? 0}% of income)`,
            ]}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Allocated
        </span>
        <span className="text-lg font-semibold tabular">
          {fmt(total, { compact: true })}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Expense breakdown — horizontal bars
// ---------------------------------------------------------------------------

export function ExpenseBreakdownChart({
  data,
}: {
  data: { name: string; value: number; color: string }[];
}) {
  const { currency } = useCurrency();
  const fmt = (amount: number, opts?: { compact?: boolean; sign?: boolean }) =>
    formatMoney(amount, currency, opts ?? {});
  return (
    <ResponsiveContainer width="100%" height={data.length * 36 + 16}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 12, bottom: 4, left: 8 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
        <XAxis
          type="number"
          stroke="var(--muted-foreground)"
          fontSize={10}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => fmt(v, { compact: true })}
        />
        <YAxis
          type="category"
          dataKey="name"
          stroke="var(--muted-foreground)"
          fontSize={11}
          tickLine={false}
          axisLine={false}
          width={90}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(v: number) => [fmt(v), "Amount"]}
          cursor={{ fill: "var(--accent)", opacity: 0.4 }}
        />
        <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={18}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ---------------------------------------------------------------------------
// Mini sparkline for KPI cards
// ---------------------------------------------------------------------------

export function MiniSparkline({ data, color = "var(--chart-1)" }: { data: number[]; color?: string }) {
  const chartData = data.map((v, i) => ({ i, v }));
  return (
    <ResponsiveContainer width="100%" height={36}>
      <LineChart data={chartData} margin={{ top: 2, right: 0, bottom: 2, left: 0 }}>
        <Line
          type="monotone"
          dataKey="v"
          stroke={color}
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ---------------------------------------------------------------------------
// Income trend (6 months bar)
// ---------------------------------------------------------------------------

export function IncomeTrendChart({ data }: { data: { month: string; value: number }[] }) {
  const { currency } = useCurrency();
  const fmt = (amount: number, opts?: { compact?: boolean; sign?: boolean }) =>
    formatMoney(amount, currency, opts ?? {});
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="month" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
        <YAxis
          stroke="var(--muted-foreground)"
          fontSize={10}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => fmt(v, { compact: true })}
          width={48}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(v: number) => [fmt(v), "Income"]}
          cursor={{ fill: "var(--accent)", opacity: 0.4 }}
        />
        <Bar dataKey="value" radius={[6, 6, 0, 0]} fill="var(--chart-1)" barSize={28} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ---------------------------------------------------------------------------
// Radar — category spending spider web
// ---------------------------------------------------------------------------

export function RadarCategoryChart({
  data,
}: {
  data: { category: string; amount: number }[];
}) {
  const { currency } = useCurrency();
  const fmt = (amount: number, opts?: { compact?: boolean; sign?: boolean }) =>
    formatMoney(amount, currency, opts ?? {});
  const isEmpty =
    !data || data.length === 0 || data.every((d) => !d.amount || d.amount === 0);

  if (isEmpty) {
    return (
      <div className="flex h-[280px] flex-col items-center justify-center gap-2 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <BarChart3 className="h-6 w-6" />
        </div>
        <p className="text-xs font-medium text-muted-foreground">
          No category spending data
        </p>
        <p className="text-[10px] text-muted-foreground/70">
          Record expenses by category to see the radar
        </p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <RadarChart data={data} outerRadius={108} margin={{ top: 8, right: 24, bottom: 8, left: 24 }}>
        <PolarGrid stroke="var(--border)" />
        <PolarAngleAxis
          dataKey="category"
          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
        />
        <PolarRadiusAxis
          tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
          tickFormatter={(v: number) => fmt(v, { compact: true })}
          axisLine={false}
          tickCount={5}
        />
        <Radar
          name="Spending"
          dataKey="amount"
          stroke="var(--chart-1)"
          fill="var(--chart-1)"
          fillOpacity={0.4}
          strokeWidth={2}
          dot={{ r: 3, fill: "var(--chart-1)", strokeWidth: 0 }}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(v: number) => [fmt(v), "Amount"]}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}

// ---------------------------------------------------------------------------
// Interactive expense donut — hoverable with side legend
// ---------------------------------------------------------------------------

export function InteractiveExpenseDonut({
  data,
}: {
  data: { name: string; value: number; color: string }[];
}) {
  const { currency } = useCurrency();
  const fmt = (amount: number, opts?: { compact?: boolean; sign?: boolean }) =>
    formatMoney(amount, currency, opts ?? {});
  const [activeIdx, setActiveIdx] = React.useState<number | null>(null);
  const total = data.reduce((s, d) => s + d.value, 0);
  const isEmpty = !data || data.length === 0 || total === 0;

  if (isEmpty) {
    return (
      <div className="flex h-[240px] flex-col items-center justify-center gap-2 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <PieChartIcon className="h-6 w-6" />
        </div>
        <p className="text-xs font-medium text-muted-foreground">No expense data</p>
        <p className="text-[10px] text-muted-foreground/70">
          Record expenses to see the breakdown
        </p>
      </div>
    );
  }

  const activeSlice = activeIdx !== null ? data[activeIdx] : null;
  const centerAmount = activeSlice ? activeSlice.value : total;
  const centerLabel = activeSlice ? activeSlice.name : "Total";
  const centerPct = activeSlice && total > 0 ? (activeSlice.value / total) * 100 : 100;

  return (
    <div className="flex flex-col items-stretch gap-4 sm:flex-row sm:items-center">
      <div className="relative mx-auto w-full max-w-[260px]">
        <ResponsiveContainer width="100%" height={240}>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={62}
              outerRadius={88}
              paddingAngle={2}
              stroke="none"
              activeIndex={activeIdx ?? -1}
              activeShape={(props) => (
                <Sector
                  {...props}
                  outerRadius={96}
                  stroke="var(--popover)"
                  strokeWidth={1.5}
                />
              )}
              onMouseEnter={(_data: unknown, idx: number) => setActiveIdx(idx)}
              onMouseLeave={() => setActiveIdx(null)}
            >
              {data.map((d, i) => (
                <Cell
                  key={d.name}
                  fill={d.color}
                  fillOpacity={activeIdx === null || activeIdx === i ? 1 : 0.45}
                />
              ))}
            </Pie>
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(v: number, name: string) => [fmt(v), name]}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="max-w-[140px] truncate text-[10px] uppercase tracking-wider text-muted-foreground">
            {centerLabel}
          </span>
          <span className="text-lg font-semibold tabular">
            {fmt(centerAmount, { compact: true })}
          </span>
          {activeSlice ? (
            <span className="text-[10px] font-medium text-muted-foreground">
              {centerPct.toFixed(1)}% of total
            </span>
          ) : (
            <span className="text-[10px] text-muted-foreground">{data.length} categories</span>
          )}
        </div>
      </div>

      <div className="flex-1 space-y-0.5">
        {data.map((d, i) => {
          const pct = total > 0 ? (d.value / total) * 100 : 0;
          const isActive = activeIdx === i;
          return (
            <div
              key={d.name}
              onMouseEnter={() => setActiveIdx(i)}
              onMouseLeave={() => setActiveIdx(null)}
              className={cn(
                "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors",
                isActive ? "bg-muted" : "hover:bg-muted/50",
              )}
            >
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-sm"
                style={{ backgroundColor: d.color }}
              />
              <span className="flex-1 truncate font-medium">{d.name}</span>
              <span className="tabular text-muted-foreground">
                {fmt(d.value, { compact: true })}
              </span>
              <span className="w-12 text-right tabular text-muted-foreground">
                {pct.toFixed(1)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
