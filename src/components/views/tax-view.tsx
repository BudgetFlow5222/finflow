"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Receipt,
  Download,
  TrendingUp,
  TrendingDown,
  Wallet,
  Scale,
  CalendarClock,
  Info,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCurrency } from "@/hooks/use-currency";
import { formatMoney } from "@/lib/currency";
import { formatDate, monthKey, lastNMonthKeys, cn } from "@/lib/utils";
import { exportToCSV } from "@/lib/export";
import type { TaxSummary } from "@/app/api/tax/route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const GST_SLABS = [0, 5, 12, 18, 28];

const BAR_COLORS = [
  "#10b981",
  "#14b8a6",
  "#06b6d4",
  "#8b5cf6",
  "#f59e0b",
  "#ec4899",
  "#ef4444",
  "#84cc16",
];

function fetchTax(period?: string, year?: string): Promise<TaxSummary> {
  const params = new URLSearchParams();
  if (year) params.set("year", year);
  else if (period) params.set("period", period);
  const qs = params.toString();
  return fetch(`/api/tax${qs ? `?${qs}` : ""}`).then(async (res) => {
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const message =
        (data as { error?: string })?.error ?? `Request failed (${res.status})`;
      throw new Error(message);
    }
    return data as TaxSummary;
  });
}

function longMonthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  if (!y || !m) return key;
  return new Date(y, m - 1, 1).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });
}

type SortKey = "date" | "taxAmount";

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

export function TaxView() {
  const now = React.useMemo(() => new Date(), []);
  const currentMonthKey = React.useMemo(() => monthKey(now), [now]);
  const monthOptions = React.useMemo(() => lastNMonthKeys(12, now), [now]);
  const { currency } = useCurrency();
  const fmt = (amount: number, opts?: { compact?: boolean; sign?: boolean }) =>
    formatMoney(amount, currency, opts ?? {});
  const yearOptions = React.useMemo(() => {
    const years: number[] = [];
    const cur = now.getFullYear();
    for (let y = cur; y >= cur - 3; y--) years.push(y);
    return years;
  }, [now]);

  // Period mode + selection
  const [mode, setMode] = React.useState<"month" | "year">("month");
  const [month, setMonth] = React.useState<string>(currentMonthKey);
  const [year, setYear] = React.useState<string>(String(now.getFullYear()));

  const queryKey = mode === "year" ? ["tax", "year", year] : ["tax", "month", month];
  const { data, isLoading, isError, error, refetch } = useQuery<TaxSummary>({
    queryKey,
    queryFn: () =>
      mode === "year" ? fetchTax(undefined, year) : fetchTax(month, undefined),
  });

  if (isLoading) return <TaxSkeleton />;
  if (isError || !data) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-500/10 text-rose-500">
          <Info className="h-6 w-6" />
        </div>
        <div>
          <p className="text-sm font-semibold">Unable to load tax summary</p>
          <p className="text-xs text-muted-foreground">
            {error instanceof Error ? error.message : "Please try again."}
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  const isCredit = data.netTaxLiability < 0; // negative => input > output => credit
  const isLiability = data.netTaxLiability > 0;

  const handleExport = () => {
    const out = data.outputTax.transactions.map((t) => ({
      Kind: "Output",
      Direction: "Collected",
      Type: t.type,
      Date: formatDate(t.date),
      Description: t.description,
      "Taxable Amount": t.amount,
      "Tax Rate %": t.taxRate,
      "Tax Amount": t.taxAmount,
      Category: "",
    }));
    const inp = data.inputTax.transactions.map((t) => ({
      Kind: "Input",
      Direction: "Paid",
      Type: "expense",
      Date: formatDate(t.date),
      Description: t.description,
      "Taxable Amount": t.amount,
      "Tax Rate %": t.taxRate,
      "Tax Amount": t.taxAmount,
      Category: t.category ?? "",
    }));
    const rows = [...out, ...inp];
    const date = new Date().toISOString().slice(0, 10);
    exportToCSV(`finflow-tax-${data.period}-${date}.csv`, rows, [
      { key: "Kind", label: "Kind" },
      { key: "Direction", label: "Direction" },
      { key: "Type", label: "Type" },
      { key: "Date", label: "Date" },
      { key: "Description", label: "Description" },
      { key: "Taxable Amount", label: "Taxable Amount" },
      { key: "Tax Rate %", label: "Tax Rate %" },
      { key: "Tax Amount", label: "Tax Amount" },
      { key: "Category", label: "Category" },
    ]);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Receipt className="h-5 w-5 text-emerald-500" />
            Tax Preparation
          </h2>
          <p className="text-xs text-muted-foreground">
            GST/VAT summary, tax liability and exportable tax report
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Tabs
            value={mode}
            onValueChange={(v) => setMode(v as "month" | "year")}
          >
            <TabsList className="h-8">
              <TabsTrigger value="month" className="px-3 text-xs">
                Month
              </TabsTrigger>
              <TabsTrigger value="year" className="px-3 text-xs">
                Year
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {mode === "month" ? (
            <Select value={month} onValueChange={setMonth}>
              <SelectTrigger size="sm" className="h-8 w-[180px] gap-1.5 text-xs">
                <CalendarClock className="h-3.5 w-3.5 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map((k) => (
                  <SelectItem key={k} value={k}>
                    {longMonthLabel(k)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Select value={year} onValueChange={setYear}>
              <SelectTrigger size="sm" className="h-8 w-[140px] gap-1.5 text-xs">
                <CalendarClock className="h-3.5 w-3.5 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {yearOptions.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Button size="sm" variant="outline" className="gap-1.5" onClick={handleExport}>
            <Download className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Export Tax Report</span>
            <span className="sm:hidden">Export</span>
          </Button>
        </div>
      </div>

      {/* Period context bar */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-emerald-500/15 bg-emerald-500/5 px-3 py-2 text-xs">
        <span className="font-medium text-emerald-700 dark:text-emerald-300">
          {data.periodLabel}
        </span>
        <span className="text-muted-foreground">·</span>
        <span className="text-muted-foreground">
          Effective tax rate:{" "}
          <span className="font-semibold tabular text-foreground">
            {data.effectiveTaxRate.toFixed(2)}%
          </span>
        </span>
        <span className="text-muted-foreground">·</span>
        <span className="text-muted-foreground">
          Net income:{" "}
          <span
            className={cn(
              "font-semibold tabular",
              data.netIncome >= 0
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-rose-600 dark:text-rose-400",
            )}
          >
            {fmt(data.netIncome, { sign: true })}
          </span>
        </span>
      </div>

      {/* Summary cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          label="Total Revenue"
          hint="incl. tax · sales + invoices"
          value={fmt(data.totalRevenue)}
          icon={TrendingUp}
          tone="emerald"
        />
        <SummaryCard
          label="Output Tax"
          hint="GST collected"
          value={fmt(data.outputTax.totalTax)}
          icon={ArrowUpRight}
          tone="violet"
        />
        <SummaryCard
          label="Input Tax"
          hint="GST paid on expenses"
          value={fmt(data.inputTax.totalTax)}
          icon={ArrowDownRight}
          tone="amber"
        />
        <SummaryCard
          label="Net Tax Liability"
          hint={
            isCredit
              ? "Credit carried forward"
              : isLiability
                ? "Tax payable"
                : "Balanced"
          }
          value={fmt(Math.abs(data.netTaxLiability))}
          icon={Scale}
          tone={isCredit ? "emerald" : isLiability ? "rose" : "violet"}
          emphasize
        />
      </div>

      {/* GST Summary by slab + Tax by category */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Scale className="h-4 w-4 text-emerald-500" />
              GST Summary by Slab
            </CardTitle>
            <CardDescription className="text-xs">
              Output vs Input tax across common GST rate slabs · {data.periodLabel}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <GstSlabTable data={data} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Wallet className="h-4 w-4 text-amber-500" />
              Tax Paid by Expense Category
            </CardTitle>
            <CardDescription className="text-xs">
              Input tax (GST paid) grouped by expense category
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TaxByCategoryList data={data} />
          </CardContent>
        </Card>
      </div>

      {/* Transaction details */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <Receipt className="h-4 w-4 text-violet-500" />
            Transaction Details
          </CardTitle>
          <CardDescription className="text-xs">
            Line-by-line taxable supplies and purchases · sortable
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="output">
            <TabsList className="h-9">
              <TabsTrigger value="output" className="gap-1.5 text-xs">
                <ArrowUpRight className="h-3.5 w-3.5" />
                Output Tax ({data.outputTax.transactions.length})
              </TabsTrigger>
              <TabsTrigger value="input" className="gap-1.5 text-xs">
                <ArrowDownRight className="h-3.5 w-3.5" />
                Input Tax ({data.inputTax.transactions.length})
              </TabsTrigger>
            </TabsList>
            <TabsContent value="output" className="mt-3">
              <TransactionTable
                rows={data.outputTax.transactions}
                kind="output"
              />
            </TabsContent>
            <TabsContent value="input" className="mt-3">
              <TransactionTable
                rows={data.inputTax.transactions}
                kind="input"
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Filing summary */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <Info className="h-4 w-4 text-cyan-500" />
            Tax Filing Summary
          </CardTitle>
          <CardDescription className="text-xs">
            Estimated summary for the selected period · consult a tax
            professional before filing
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <FilingStat
              label="Filing Period"
              value={data.periodLabel}
            />
            <FilingStat
              label="Total Taxable Supplies"
              value={fmt(data.outputTax.totalTaxableAmount)}
            />
            <FilingStat
              label="Total Tax Payable"
              value={fmt(Math.max(0, data.netTaxLiability))}
              tone={isLiability ? "rose" : "muted"}
            />
            <FilingStat
              label="Credit Carried Forward"
              value={fmt(Math.max(0, -data.netTaxLiability))}
              tone={isCredit ? "emerald" : "muted"}
            />
          </div>
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <p>
              This is an estimated tax summary based on recorded sales,
              invoices and expenses in FinFlow. Tax slabs are derived from
              recorded tax amounts. Consult a tax professional for official
              filing, slab applicability, and compliance with local GST/VAT
              regulations.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Summary card
// ---------------------------------------------------------------------------

type Tone = "emerald" | "rose" | "violet" | "amber";

const TONE_TEXT: Record<Tone, string> = {
  emerald: "text-emerald-600 dark:text-emerald-400",
  rose: "text-rose-600 dark:text-rose-400",
  violet: "text-violet-600 dark:text-violet-400",
  amber: "text-amber-600 dark:text-amber-400",
};

const TONE_ICON_BG: Record<Tone, string> = {
  emerald: "bg-emerald-500/10",
  rose: "bg-rose-500/10",
  violet: "bg-violet-500/10",
  amber: "bg-amber-500/10",
};

function SummaryCard({
  label,
  hint,
  value,
  icon: Icon,
  tone,
  emphasize,
}: {
  label: string;
  hint: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: Tone;
  emphasize?: boolean;
}) {
  return (
    <Card className={cn(emphasize && "ring-1 ring-emerald-500/15")}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          <div
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-md",
              TONE_ICON_BG[tone],
            )}
          >
            <Icon className={cn("h-3.5 w-3.5", TONE_TEXT[tone])} />
          </div>
        </div>
        <p
          className={cn(
            "mt-1.5 text-2xl font-semibold tabular",
            TONE_TEXT[tone],
          )}
        >
          {value}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// GST slab table — rows = slabs, columns = output / input / net
// ---------------------------------------------------------------------------

function GstSlabTable({ data }: { data: TaxSummary }) {
  const { currency } = useCurrency();
  const fmt = (amount: number, opts?: { compact?: boolean; sign?: boolean }) =>
    formatMoney(amount, currency, opts ?? {});
  const outMap = new Map(data.outputTax.byRate.map((r) => [r.rate, r]));
  const inMap = new Map(data.inputTax.byRate.map((r) => [r.rate, r]));

  const rows = GST_SLABS.map((rate) => {
    const o = outMap.get(rate);
    const i = inMap.get(rate);
    const output = o?.taxAmount ?? 0;
    const input = i?.taxAmount ?? 0;
    const net = output - input;
    return {
      rate,
      output,
      input,
      net,
      outputCount: o?.transactionCount ?? 0,
      inputCount: i?.transactionCount ?? 0,
    };
  });

  // Include any rates seen in the data that are NOT in the standard slab list
  // (e.g. a custom 3% or 1% rate). These append below the standard slabs.
  const extraRates = Array.from(
    new Set([
      ...data.outputTax.byRate.map((r) => r.rate),
      ...data.inputTax.byRate.map((r) => r.rate),
    ]),
  )
    .filter((r) => !GST_SLABS.includes(r))
    .sort((a, b) => a - b);

  for (const rate of extraRates) {
    const o = outMap.get(rate);
    const i = inMap.get(rate);
    const output = o?.taxAmount ?? 0;
    const input = i?.taxAmount ?? 0;
    rows.push({
      rate,
      output,
      input,
      net: output - input,
      outputCount: o?.transactionCount ?? 0,
      inputCount: i?.transactionCount ?? 0,
    });
  }

  const totalOutput = rows.reduce((s, r) => s + r.output, 0);
  const totalInput = rows.reduce((s, r) => s + r.input, 0);
  const totalNet = totalOutput - totalInput;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="text-xs">Rate</TableHead>
          <TableHead className="text-right text-xs">Output Tax</TableHead>
          <TableHead className="text-right text-xs">Input Tax</TableHead>
          <TableHead className="text-right text-xs">Net Tax</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => {
          const empty = r.output === 0 && r.input === 0;
          return (
            <TableRow key={r.rate} className={cn(empty && "text-muted-foreground")}>
              <TableCell className="text-xs font-medium">
                <span className="inline-flex items-center gap-1.5">
                  <span
                    className={cn(
                      "inline-flex h-5 min-w-8 items-center justify-center rounded px-1.5 text-[10px] font-semibold",
                      empty
                        ? "bg-muted text-muted-foreground"
                        : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
                    )}
                  >
                    {r.rate}%
                  </span>
                </span>
              </TableCell>
              <TableCell className="text-right text-xs tabular">
                {r.output > 0 ? fmt(r.output, { compact: true }) : "—"}
              </TableCell>
              <TableCell className="text-right text-xs tabular">
                {r.input > 0 ? fmt(r.input, { compact: true }) : "—"}
              </TableCell>
              <TableCell
                className={cn(
                  "text-right text-xs tabular font-semibold",
                  r.net > 0
                    ? "text-rose-600 dark:text-rose-400"
                    : r.net < 0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "",
                )}
              >
                {r.net !== 0
                  ? fmt(r.net, { compact: true, sign: true })
                  : "—"}
              </TableCell>
            </TableRow>
          );
        })}
        <TableRow className="border-t-2 font-semibold">
          <TableCell className="text-xs">Total</TableCell>
          <TableCell className="text-right text-xs tabular">
            {fmt(totalOutput, { compact: true })}
          </TableCell>
          <TableCell className="text-right text-xs tabular">
            {fmt(totalInput, { compact: true })}
          </TableCell>
          <TableCell
            className={cn(
              "text-right text-xs tabular font-semibold",
              totalNet > 0
                ? "text-rose-600 dark:text-rose-400"
                : totalNet < 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "",
            )}
          >
            {fmt(totalNet, { compact: true, sign: true })}
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );
}

// ---------------------------------------------------------------------------
// Tax by category — horizontal bars
// ---------------------------------------------------------------------------

function TaxByCategoryList({ data }: { data: TaxSummary }) {
  const { currency } = useCurrency();
  const fmt = (amount: number, opts?: { compact?: boolean; sign?: boolean }) =>
    formatMoney(amount, currency, opts ?? {});
  const cats = data.taxByCategory;
  if (cats.length === 0) {
    return (
      <div className="flex h-48 flex-col items-center justify-center gap-2 py-8 text-center">
        <Receipt className="h-8 w-8 text-muted-foreground" />
        <p className="text-xs text-muted-foreground">
          No input tax (GST paid) recorded in {data.periodLabel}.
        </p>
      </div>
    );
  }
  const maxTax = Math.max(...cats.map((c) => c.taxAmount), 1);
  return (
    <div className="space-y-3">
      {cats.slice(0, 8).map((c, i) => {
        const pct = (c.taxAmount / maxTax) * 100;
        const effRate =
          c.expenseAmount > 0 ? (c.taxAmount / c.expenseAmount) * 100 : 0;
        const color = BAR_COLORS[i % BAR_COLORS.length];
        return (
          <div key={c.category} className="space-y-1.5">
            <div className="flex items-center justify-between gap-2 text-xs">
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className="h-2 w-2 shrink-0 rounded-sm"
                  style={{ backgroundColor: color }}
                />
                <span className="truncate font-medium">{c.category}</span>
                <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] tabular text-muted-foreground">
                  {c.transactionCount} txn{c.transactionCount === 1 ? "" : "s"}
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span className="tabular text-muted-foreground">
                  {fmt(c.expenseAmount, { compact: true })}
                </span>
                <span className="tabular font-semibold">
                  {fmt(c.taxAmount, { compact: true })}
                </span>
                <span className="w-12 text-right tabular text-[10px] text-muted-foreground">
                  {effRate.toFixed(1)}%
                </span>
              </div>
            </div>
            <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="absolute inset-y-0 left-0 rounded-full transition-all"
                style={{ width: `${pct}%`, backgroundColor: color }}
              />
            </div>
          </div>
        );
      })}
      {cats.length > 8 && (
        <p className="pt-1 text-center text-[11px] text-muted-foreground">
          + {cats.length - 8} more categor{cats.length - 8 === 1 ? "y" : "ies"}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Transaction table — sortable by date / tax amount
// ---------------------------------------------------------------------------

interface OutputRow {
  id: string;
  date: string;
  description: string;
  amount: number;
  taxRate: number;
  taxAmount: number;
  type?: "sale" | "invoice";
  category?: string;
}
interface InputRow {
  id: string;
  date: string;
  description: string;
  amount: number;
  taxRate: number;
  taxAmount: number;
  type?: "sale" | "invoice";
  category?: string;
}

function SortHeader({
  label,
  k,
  align = "left",
  sortKey,
  sortDir,
  onToggle,
}: {
  label: string;
  k: SortKey;
  align?: "left" | "right";
  sortKey: SortKey;
  sortDir: "asc" | "desc";
  onToggle: (k: SortKey) => void;
}) {
  return (
    <TableHead
      className={cn(
        "cursor-pointer select-none text-xs",
        align === "right" && "text-right",
      )}
      onClick={() => onToggle(k)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <span className="text-[10px] text-muted-foreground">
          {sortKey === k ? (sortDir === "asc" ? "▲" : "▼") : "↕"}
        </span>
      </span>
    </TableHead>
  );
}

function TransactionTable<T extends OutputRow | InputRow>({
  rows,
  kind,
}: {
  rows: T[];
  kind: "output" | "input";
}) {
  const { currency } = useCurrency();
  const fmt = (amount: number, opts?: { compact?: boolean; sign?: boolean }) =>
    formatMoney(amount, currency, opts ?? {});
  const [sortKey, setSortKey] = React.useState<SortKey>("date");
  const [sortDir, setSortDir] = React.useState<"asc" | "desc">("desc");

  const sorted = React.useMemo(() => {
    const arr = [...rows];
    arr.sort((a, b) => {
      let cmp: number;
      if (sortKey === "date") {
        cmp = new Date(a.date).getTime() - new Date(b.date).getTime();
      } else {
        cmp = a.taxAmount - b.taxAmount;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [rows, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  if (rows.length === 0) {
    return (
      <div className="flex h-40 flex-col items-center justify-center gap-2 text-center">
        <Receipt className="h-7 w-7 text-muted-foreground" />
        <p className="text-xs text-muted-foreground">
          No {kind === "output" ? "sales or invoices" : "expenses"} in this
          period.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <SortHeader
              label="Date"
              k="date"
              sortKey={sortKey}
              sortDir={sortDir}
              onToggle={toggleSort}
            />
            <TableHead className="text-xs">Description</TableHead>
            {kind === "input" && (
              <TableHead className="text-xs">Category</TableHead>
            )}
            <TableHead className="text-right text-xs">Taxable</TableHead>
            <TableHead className="text-right text-xs">Rate</TableHead>
            <SortHeader
              label="Tax Amount"
              k="taxAmount"
              align="right"
              sortKey={sortKey}
              sortDir={sortDir}
              onToggle={toggleSort}
            />
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((r) => (
            <TableRow key={`${r.type ?? "row"}-${r.id}`}>
              <TableCell className="whitespace-nowrap text-xs tabular text-muted-foreground">
                {formatDate(r.date)}
              </TableCell>
              <TableCell className="text-xs">
                <div className="flex items-center gap-2">
                  {r.type && kind === "output" && (
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider",
                        r.type === "sale"
                          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                          : "bg-violet-500/10 text-violet-700 dark:text-violet-300",
                      )}
                    >
                      {r.type}
                    </span>
                  )}
                  <span className="truncate">{r.description}</span>
                </div>
              </TableCell>
              {kind === "input" && (
                <TableCell className="text-xs text-muted-foreground">
                  {r.category ?? "Uncategorized"}
                </TableCell>
              )}
              <TableCell className="text-right text-xs tabular">
                {fmt(r.amount, { compact: true })}
              </TableCell>
              <TableCell className="text-right text-xs tabular">
                {r.taxRate}%
              </TableCell>
              <TableCell
                className={cn(
                  "text-right text-xs tabular font-semibold",
                  kind === "output"
                    ? "text-violet-600 dark:text-violet-400"
                    : "text-amber-600 dark:text-amber-400",
                )}
              >
                {fmt(r.taxAmount)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Filing stat tile
// ---------------------------------------------------------------------------

function FilingStat({
  label,
  value,
  tone = "muted",
}: {
  label: string;
  value: string;
  tone?: "emerald" | "rose" | "muted";
}) {
  const toneCls =
    tone === "emerald"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "rose"
        ? "text-rose-600 dark:text-rose-400"
        : "text-foreground";
  return (
    <div className="rounded-lg border border-border bg-card/50 p-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className={cn("mt-1 text-sm font-semibold tabular", toneCls)}>
        {value}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function TaxSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-8 w-72" />
      </div>
      <Skeleton className="h-9 w-full" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-72 rounded-xl" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
      <Skeleton className="h-96 rounded-xl" />
      <Skeleton className="h-44 rounded-xl" />
    </div>
  );
}
