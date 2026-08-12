"use client";

import * as React from "react";
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  BarChart3,
  PieChart,
  Activity,
  Award,
  Receipt,
  Radar as RadarIcon,
  Trophy,
  Target,
  CalendarClock,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Money } from "@/components/money";
import {
  CashFlowChart,
  IncomeTrendChart,
  RadarCategoryChart,
  InteractiveExpenseDonut,
} from "@/components/charts";
import {
  useDashboard,
  useExpenses,
  useSales,
  useCategories,
} from "@/hooks/use-finance";
import { useCurrency } from "@/hooks/use-currency";
import { formatMoney } from "@/lib/currency";
import { cn, colorForIndex } from "@/lib/utils";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Category } from "@/types";

type Tone = "emerald" | "rose" | "violet" | "amber";

const TONE_TEXT: Record<Tone, string> = {
  emerald: "text-emerald-600 dark:text-emerald-400",
  rose: "text-rose-600 dark:text-rose-400",
  violet: "text-violet-600 dark:text-violet-400",
  amber: "text-amber-600 dark:text-amber-400",
};

type DateRangeKey = "this-month" | "last-3-months" | "last-6-months" | "this-year";

const DATE_RANGES: { value: DateRangeKey; label: string }[] = [
  { value: "this-month", label: "This Month" },
  { value: "last-3-months", label: "Last 3 Months" },
  { value: "last-6-months", label: "Last 6 Months" },
  { value: "this-year", label: "This Year" },
];

function rangeStart(range: DateRangeKey, ref: Date = new Date()): Date {
  switch (range) {
    case "this-month":
      return new Date(ref.getFullYear(), ref.getMonth(), 1);
    case "last-3-months":
      return new Date(ref.getFullYear(), ref.getMonth() - 2, 1);
    case "last-6-months":
      return new Date(ref.getFullYear(), ref.getMonth() - 5, 1);
    case "this-year":
      return new Date(ref.getFullYear(), 0, 1);
  }
}

function rangeMonths(range: DateRangeKey, ref: Date = new Date()): number {
  switch (range) {
    case "this-month":
      return 1;
    case "last-3-months":
      return 3;
    case "last-6-months":
      return 6;
    case "this-year":
      return ref.getMonth() + 1; // Jan through current month inclusive
  }
}

function rangeLabel(range: DateRangeKey): string {
  return DATE_RANGES.find((r) => r.value === range)?.label ?? "Selected Range";
}

const RANK_COLORS = ["#f59e0b", "#10b981", "#06b6d4", "#8b5cf6", "#ec4899"];

export function ReportsView() {
  const { data: dash, isLoading: dashLoading } = useDashboard();
  const { data: expenses, isLoading: expLoading } = useExpenses(500);
  const { data: sales, isLoading: salesLoading } = useSales(500);
  const { data: categories, isLoading: catLoading } = useCategories();
  const { currency } = useCurrency();
  const fmt = (amount: number, opts?: { compact?: boolean; sign?: boolean }) =>
    formatMoney(amount, currency, opts ?? {});

  const [range, setRange] = React.useState<DateRangeKey>("this-month");

  // Category lookup map for expense enrichment.
  const categoryMap = React.useMemo(() => {
    const map = new Map<string, Category>();
    (categories ?? []).forEach((c) => map.set(c.id, c));
    return map;
  }, [categories]);

  // Filter transactions by the selected date range.
  const filtered = React.useMemo(() => {
    const start = rangeStart(range).getTime();
    const end = Date.now();
    const filteredExpenses = (expenses ?? []).filter((e) => {
      const t = new Date(e.date).getTime();
      return t >= start && t <= end;
    });
    const filteredSales = (sales ?? []).filter((s) => {
      const t = new Date(s.date).getTime();
      return t >= start && t <= end;
    });
    return { expenses: filteredExpenses, sales: filteredSales };
  }, [expenses, sales, range]);

  // Aggregate expenses by category for the selected range.
  const expenseByCategory = React.useMemo(() => {
    const totals = new Map<string, number>();
    filtered.expenses.forEach((e) => {
      const catId = e.categoryId ?? "uncategorized";
      totals.set(catId, (totals.get(catId) ?? 0) + e.total);
    });
    const rows: { id: string; name: string; value: number; color: string }[] = [];
    let idx = 0;
    totals.forEach((value, id) => {
      const cat = categoryMap.get(id);
      const name =
        cat?.name ?? (id === "uncategorized" ? "Uncategorized" : "Unknown");
      const color = cat?.color ?? colorForIndex(idx);
      rows.push({ id, name, value, color });
      idx += 1;
    });
    rows.sort((a, b) => b.value - a.value);
    return rows;
  }, [filtered.expenses, categoryMap]);

  // Range-aware P&L totals.
  const totals = React.useMemo(() => {
    const income = filtered.sales.reduce((s, x) => s + x.total, 0);
    const expense = filtered.expenses.reduce((s, x) => s + x.total, 0);
    const net = income - expense;
    const months = rangeMonths(range);
    const avgNet = months > 0 ? net / months : 0;
    const savingsRate = income > 0 ? (net / income) * 100 : 0;
    const txns = filtered.sales.length + filtered.expenses.length;
    return { income, expense, net, avgNet, savingsRate, txns };
  }, [filtered, range]);

  const isLoading = dashLoading || expLoading || salesLoading || catLoading;
  if (isLoading) return <ReportsSkeleton />;

  const cashFlow = dash?.cashFlow ?? [];
  const incomeByMonth = dash?.incomeByMonth ?? [];

  const totalIncome6mo = cashFlow.reduce((s, p) => s + p.income, 0);
  const totalExpense6mo = cashFlow.reduce((s, p) => s + p.expense, 0);
  const net6mo = totalIncome6mo - totalExpense6mo;
  const avgNet6mo = cashFlow.length ? net6mo / cashFlow.length : 0;
  const bestMonth = cashFlow.length
    ? cashFlow.reduce((best, p) => (p.net > best.net ? p : best), cashFlow[0])
    : null;

  const bestIncomeMonth = incomeByMonth.length
    ? incomeByMonth.reduce((b, p) => (p.value > b.value ? p : b), incomeByMonth[0])
    : null;

  // Derived datasets for the new charts.
  const radarData = expenseByCategory.map((c) => ({
    category: c.name,
    amount: c.value,
  }));
  const totalCat = expenseByCategory.reduce((s, c) => s + c.value, 0);
  const top5 = expenseByCategory.slice(0, 5);
  const top5Max = top5.length > 0 ? top5[0].value : 0;

  return (
    <div className="space-y-4">
      {/* Header + Date range selector */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <BarChart3 className="h-5 w-5 text-violet-500" />
            Reports
          </h2>
          <p className="text-xs text-muted-foreground">
            Financial insights across your accounts
          </p>
        </div>
        <div className="flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-muted-foreground" />
          <Tabs value={range} onValueChange={(v) => setRange(v as DateRangeKey)}>
            <TabsList className="h-8 w-fit overflow-x-auto">
              {DATE_RANGES.map((r) => (
                <TabsTrigger
                  key={r.value}
                  value={r.value}
                  className="px-2.5 py-0.5 text-xs"
                >
                  {r.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Profit & Loss summary (range-aware) */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Income
              </p>
              <TrendingUp className="h-4 w-4 text-emerald-500" />
            </div>
            <p className="mt-1 text-2xl font-semibold tabular text-emerald-600 dark:text-emerald-400">
              {fmt(totals.income)}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">{rangeLabel(range)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Expense
              </p>
              <TrendingDown className="h-4 w-4 text-rose-500" />
            </div>
            <p className="mt-1 text-2xl font-semibold tabular text-rose-600 dark:text-rose-400">
              {fmt(totals.expense)}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">{rangeLabel(range)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Net
              </p>
              <Wallet className="h-4 w-4 text-violet-500" />
            </div>
            <p className="mt-1 text-2xl font-semibold tabular">
              <Money amount={totals.net} sign />
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {totals.net >= 0 ? "profit" : "loss"} · {rangeLabel(range)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Savings Rate
              </p>
              <Target className="h-4 w-4 text-violet-500" />
            </div>
            <p
              className={cn(
                "mt-1 text-2xl font-semibold tabular",
                totals.savingsRate >= 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-rose-600 dark:text-rose-400",
              )}
            >
              {totals.savingsRate.toFixed(1)}%
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {totals.txns} transactions · {rangeLabel(range)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Cash flow analysis (6-month historical view) */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <Activity className="h-4 w-4 text-violet-500" />
            Cash Flow Analysis
          </CardTitle>
          <CardDescription className="text-xs">
            Income vs expense over the last 6 months
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CashFlowChart data={cashFlow} />
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat
              label="Total Income (6mo)"
              value={fmt(totalIncome6mo)}
              icon={TrendingUp}
              tone="emerald"
            />
            <Stat
              label="Total Expense (6mo)"
              value={fmt(totalExpense6mo)}
              icon={TrendingDown}
              tone="rose"
            />
            <Stat
              label="Avg Monthly Net"
              value={fmt(avgNet6mo, { sign: true })}
              icon={Wallet}
              tone="violet"
            />
            <Stat
              label="Best Month"
              value={
                bestMonth
                  ? `${bestMonth.month} · ${fmt(bestMonth.net, { sign: true })}`
                  : "—"
              }
              icon={Award}
              tone="amber"
            />
          </div>
        </CardContent>
      </Card>

      {/* Category Analysis (Radar) + Expense Breakdown (Interactive Donut) */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Category Spending Analysis — Radar */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <RadarIcon className="h-4 w-4 text-violet-500" />
              Category Spending Analysis
            </CardTitle>
            <CardDescription className="text-xs">
              Expense distribution across categories (Radar view) · {rangeLabel(range)}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RadarCategoryChart data={radarData} />
            {expenseByCategory.length > 0 && (
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {expenseByCategory.map((c) => {
                  const pct = totalCat > 0 ? (c.value / totalCat) * 100 : 0;
                  return (
                    <div
                      key={c.id}
                      className="flex items-center justify-between gap-2 rounded-md border border-border/60 px-2.5 py-1.5"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <span
                          className="h-2 w-2 shrink-0 rounded-sm"
                          style={{ backgroundColor: c.color }}
                        />
                        <span className="truncate text-xs font-medium">{c.name}</span>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="tabular text-xs">
                          {fmt(c.value, { compact: true })}
                        </span>
                        <span className="w-12 text-right tabular text-[11px] text-muted-foreground">
                          {pct.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Expense Breakdown — Interactive Donut (replaces horizontal bars) */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <PieChart className="h-4 w-4 text-violet-500" />
              Expense Breakdown
            </CardTitle>
            <CardDescription className="text-xs">
              By category · {rangeLabel(range)} (hover to explore)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <InteractiveExpenseDonut data={expenseByCategory} />
          </CardContent>
        </Card>
      </div>

      {/* Top Categories leaderboard + Income trend */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Trophy className="h-4 w-4 text-amber-500" />
              Top Categories
            </CardTitle>
            <CardDescription className="text-xs">
              Leaderboard of top 5 expense categories · {rangeLabel(range)}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {top5.length > 0 ? (
              <div className="space-y-3">
                {top5.map((c, i) => {
                  const pct = totalCat > 0 ? (c.value / totalCat) * 100 : 0;
                  const barPct = top5Max > 0 ? (c.value / top5Max) * 100 : 0;
                  return (
                    <div key={c.id} className="flex items-center gap-3">
                      <div
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                        style={{ backgroundColor: RANK_COLORS[i] }}
                      >
                        {i + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-xs font-medium">{c.name}</span>
                          <span className="tabular text-xs text-muted-foreground">
                            {pct.toFixed(1)}%
                          </span>
                        </div>
                        <div className="mt-1 flex items-center gap-2">
                          <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-muted">
                            <div
                              className="absolute inset-y-0 left-0 rounded-full transition-all"
                              style={{
                                width: `${barPct}%`,
                                backgroundColor: c.color,
                              }}
                            />
                          </div>
                          <span className="w-20 shrink-0 text-right tabular text-xs font-semibold">
                            {fmt(c.value, { compact: true })}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex h-48 flex-col items-center justify-center gap-2 py-10 text-center">
                <Receipt className="h-8 w-8 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">
                  No expenses recorded in {rangeLabel(range)}.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Income trend (6-month historical view) */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <TrendingUp className="h-4 w-4 text-violet-500" />
              Income Trend
            </CardTitle>
            <CardDescription className="text-xs">
              Monthly income, last 6 months
            </CardDescription>
          </CardHeader>
          <CardContent>
            <IncomeTrendChart data={incomeByMonth} />
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-lg bg-muted/50 px-3 py-2">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Best month
                </p>
                <p className="text-xs font-semibold tabular">
                  {bestIncomeMonth ? bestIncomeMonth.month : "—"}
                </p>
              </div>
              <div className="rounded-lg bg-muted/50 px-3 py-2">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Avg / month
                </p>
                <p className="text-xs font-semibold tabular">
                  {incomeByMonth.length
                    ? fmt(
                        incomeByMonth.reduce((s, p) => s + p.value, 0) / incomeByMonth.length,
                      )
                    : "—"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: Tone;
}) {
  return (
    <div className="rounded-lg border border-border bg-card/50 p-3">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
        <Icon className={cn("h-3.5 w-3.5", TONE_TEXT[tone])} />
        {label}
      </div>
      <p className="mt-1 text-sm font-semibold tabular">{value}</p>
    </div>
  );
}

function ReportsSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-40" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-96 rounded-xl" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-96 rounded-xl" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-72 rounded-xl" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
    </div>
  );
}
