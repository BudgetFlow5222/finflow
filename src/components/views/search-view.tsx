"use client";

import * as React from "react";
import {
  Search as SearchIcon,
  TrendingUp,
  TrendingDown,
  ArrowLeftRight,
  X,
  Inbox,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Money } from "@/components/money";
import { StatusBadge } from "@/components/status-badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import {
  useSales,
  useExpenses,
  useTransfers,
  useAccounts,
} from "@/hooks/use-finance";
import { useUI } from "@/hooks/use-ui";
import { formatCurrency, formatDate, relativeTime, cn } from "@/lib/utils";
import type { Sale, Expense, Transfer } from "@/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TxnKind = "sale" | "expense" | "transfer";
type TypeFilter = "all" | TxnKind;
type SortKey = "date" | "amount";
type SortDir = "asc" | "desc";

interface UnifiedTransaction {
  id: string;
  kind: TxnKind;
  date: string;
  description: string;
  amount: number; // signed: + for sales, − for expenses, neutral for transfers
  rawAmount: number; // always positive
  status: string;
  accountName: string;
  accountId?: string;
  categoryName?: string;
  customerName?: string;
  vendorName?: string;
  notes?: string;
}

const TYPE_OPTIONS: { value: TypeFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "sale", label: "Income" },
  { value: "expense", label: "Expenses" },
  { value: "transfer", label: "Transfers" },
];

const DATE_PRESETS = [
  { key: "today", label: "Today" },
  { key: "week", label: "This Week" },
  { key: "month", label: "This Month" },
  { key: "year", label: "This Year" },
  { key: "all", label: "All Time" },
] as const;

type DatePresetKey = (typeof DATE_PRESETS)[number]["key"];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Compute the [from, to] ISO date strings for a preset, or null for "All Time". */
function computePresetRange(key: DatePresetKey): { from: string; to: string } | null {
  const now = new Date();
  const today = startOfDay(now);
  if (key === "today") return { from: toISODate(today), to: toISODate(today) };
  if (key === "week") {
    // Week starts on Sunday.
    const day = today.getDay();
    const start = new Date(today);
    start.setDate(today.getDate() - day);
    return { from: toISODate(start), to: toISODate(today) };
  }
  if (key === "month") {
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    return { from: toISODate(start), to: toISODate(today) };
  }
  if (key === "year") {
    const start = new Date(today.getFullYear(), 0, 1);
    return { from: toISODate(start), to: toISODate(today) };
  }
  return null; // "all"
}

function statusVariantFor(kind: TxnKind, status: string) {
  if (kind === "transfer") return "info" as const;
  switch (status) {
    case "COMPLETED":
      return "success" as const;
    case "PENDING":
      return "warning" as const;
    case "REFUNDED":
      return "danger" as const;
    default:
      return "neutral" as const;
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SearchView() {
  const { data: sales, isLoading: salesLoading } = useSales();
  const { data: expenses, isLoading: expensesLoading } = useExpenses();
  const { data: transfers, isLoading: transfersLoading } = useTransfers();
  const { data: accounts } = useAccounts();
  const { setView } = useUI();

  const [query, setQuery] = React.useState("");
  const [type, setType] = React.useState<TypeFilter>("all");
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");
  const [activePreset, setActivePreset] = React.useState<DatePresetKey | null>("all");
  const [minAmount, setMinAmount] = React.useState("");
  const [maxAmount, setMaxAmount] = React.useState("");
  const [accountId, setAccountId] = React.useState<string>("all");
  const [sortKey, setSortKey] = React.useState<SortKey>("date");
  const [sortDir, setSortDir] = React.useState<SortDir>("desc");

  const searchInputRef = React.useRef<HTMLInputElement>(null);

  // Auto-focus the search input on mount — the view is reached intentionally,
  // so the user should be able to start typing immediately.
  React.useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  const isLoading = salesLoading || expensesLoading || transfersLoading;

  // Combine sales + expenses + transfers into a single unified list.
  const all: UnifiedTransaction[] = React.useMemo(() => {
    const fromSales: UnifiedTransaction[] = (sales ?? []).map((s: Sale) => ({
      id: `sale-${s.id}`,
      kind: "sale",
      date: s.date,
      description: s.customer?.name ?? "Sale",
      amount: s.total,
      rawAmount: s.total,
      status: s.status,
      accountName: s.account?.name ?? "—",
      accountId: s.accountId,
      customerName: s.customer?.name,
      notes: s.notes ?? undefined,
    }));
    const fromExpenses: UnifiedTransaction[] = (expenses ?? []).map((e: Expense) => ({
      id: `expense-${e.id}`,
      kind: "expense",
      date: e.date,
      description: e.vendor?.name ?? e.category?.name ?? "Expense",
      amount: -Math.abs(e.total),
      rawAmount: e.total,
      status: e.status,
      accountName: e.account?.name ?? "—",
      accountId: e.accountId,
      categoryName: e.category?.name,
      vendorName: e.vendor?.name,
      notes: e.notes ?? undefined,
    }));
    const fromTransfers: UnifiedTransaction[] = (transfers ?? []).map(
      (t: Transfer) => ({
        id: `transfer-${t.id}`,
        kind: "transfer",
        date: t.date,
        description: `${t.fromAccount?.name ?? "Account"} → ${t.toAccount?.name ?? "Account"}`,
        amount: t.amount, // neutral display
        rawAmount: t.amount,
        status: "COMPLETED",
        accountName: t.fromAccount?.name ?? "—",
        accountId: t.fromAccountId,
        notes: t.notes ?? undefined,
      }),
    );
    return [...fromSales, ...fromExpenses, ...fromTransfers];
  }, [sales, expenses, transfers]);

  // Apply text search + filters + sort.
  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const min = minAmount ? Number(minAmount) : null;
    const max = maxAmount ? Number(maxAmount) : null;

    const result = all.filter((t) => {
      // Type filter
      if (type !== "all" && t.kind !== type) return false;

      // Account filter (matches the source/owner account)
      if (accountId !== "all" && t.accountId !== accountId) return false;

      // Date range (compare ISO yyyy-mm-dd slices)
      const d = t.date.slice(0, 10);
      if (from && d < from) return false;
      if (to && d > to) return false;

      // Amount range (uses the absolute raw amount)
      if (min !== null && t.rawAmount < min) return false;
      if (max !== null && t.rawAmount > max) return false;

      // Text search across description, notes, customer/vendor/category/account
      if (q) {
        const haystack = [
          t.description,
          t.notes ?? "",
          t.customerName ?? "",
          t.vendorName ?? "",
          t.categoryName ?? "",
          t.accountName ?? "",
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });

    return result.sort((a, b) => {
      const cmp =
        sortKey === "date"
          ? new Date(a.date).getTime() - new Date(b.date).getTime()
          : a.rawAmount - b.rawAmount;
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [all, query, type, from, to, minAmount, maxAmount, accountId, sortKey, sortDir]);

  // Summary stats — computed over the filtered list.
  const stats = React.useMemo(() => {
    let income = 0;
    let expenseTotal = 0;
    let saleCount = 0;
    let expenseCount = 0;
    for (const t of filtered) {
      if (t.kind === "sale") {
        income += t.rawAmount;
        saleCount += 1;
      } else if (t.kind === "expense") {
        expenseTotal += t.rawAmount;
        expenseCount += 1;
      }
    }
    return {
      income,
      expenses: expenseTotal,
      net: income - expenseTotal,
      saleCount,
      expenseCount,
      total: filtered.length,
    };
  }, [filtered]);

  const totalTransactions = all.length;

  const applyPreset = (key: DatePresetKey) => {
    setActivePreset(key);
    if (key === "all") {
      setFrom("");
      setTo("");
      return;
    }
    const range = computePresetRange(key);
    if (range) {
      setFrom(range.from);
      setTo(range.to);
    }
  };

  const handleDateManualChange = (which: "from" | "to", value: string) => {
    // Manually-typed dates deselect any active preset.
    setActivePreset(null);
    if (which === "from") setFrom(value);
    else setTo(value);
  };

  const clearFilters = () => {
    setQuery("");
    setType("all");
    setFrom("");
    setTo("");
    setActivePreset("all");
    setMinAmount("");
    setMaxAmount("");
    setAccountId("all");
    setSortKey("date");
    setSortDir("desc");
    searchInputRef.current?.focus();
  };

  const hasActiveFilters =
    query.trim() !== "" ||
    type !== "all" ||
    from !== "" ||
    to !== "" ||
    minAmount !== "" ||
    maxAmount !== "" ||
    accountId !== "all";

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir(key === "date" ? "desc" : "asc");
    }
  };

  const handleRowClick = (t: UnifiedTransaction) => {
    if (t.kind === "sale") setView("sales");
    else if (t.kind === "expense") setView("expenses");
    else setView("transfers");
  };

  if (isLoading) return <SearchSkeleton />;

  return (
    <div className="space-y-4">
      {/* Search bar */}
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={searchInputRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search transactions, customers, vendors, notes…"
          className="h-12 rounded-xl pl-10 pr-10 text-base shadow-sm"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="space-y-3">
            {/* Row 1: type filter + date presets */}
            <div className="flex flex-wrap items-center gap-3">
              <ToggleGroup
                type="single"
                value={type}
                onValueChange={(v) => {
                  if (v) setType(v as TypeFilter);
                }}
                variant="outline"
                size="sm"
              >
                {TYPE_OPTIONS.map((opt) => (
                  <ToggleGroupItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>

              <div className="ml-auto flex flex-wrap items-center gap-1">
                {DATE_PRESETS.map((p) => (
                  <Button
                    key={p.key}
                    type="button"
                    variant={activePreset === p.key ? "default" : "outline"}
                    size="sm"
                    className="h-8"
                    onClick={() => applyPreset(p.key)}
                  >
                    {p.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Row 2: date range + amount range */}
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  From date
                </label>
                <Input
                  type="date"
                  value={from}
                  onChange={(e) => handleDateManualChange("from", e.target.value)}
                  className="h-9"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  To date
                </label>
                <Input
                  type="date"
                  value={to}
                  onChange={(e) => handleDateManualChange("to", e.target.value)}
                  className="h-9"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Min amount
                </label>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={minAmount}
                  onChange={(e) => setMinAmount(e.target.value)}
                  placeholder="0.00"
                  className="h-9"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Max amount
                </label>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={maxAmount}
                  onChange={(e) => setMaxAmount(e.target.value)}
                  placeholder="∞"
                  className="h-9"
                />
              </div>
            </div>

            {/* Row 3: account select + clear filters */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Account
                </label>
                <Select value={accountId} onValueChange={setAccountId}>
                  <SelectTrigger size="sm" className="h-8 w-[220px]">
                    <SelectValue placeholder="All accounts" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All accounts</SelectItem>
                    {(accounts ?? []).map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name} · {a.currency}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {hasActiveFilters && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="ml-auto gap-1.5 text-muted-foreground"
                  onClick={clearFilters}
                >
                  <X className="h-3.5 w-3.5" /> Clear filters
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary stats */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Total Income
            </p>
            <p className="mt-1 text-2xl font-semibold tabular text-emerald-600 dark:text-emerald-400">
              {formatCurrency(stats.income)}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">{stats.saleCount} sales</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Total Expenses
            </p>
            <p className="mt-1 text-2xl font-semibold tabular text-rose-600 dark:text-rose-400">
              {formatCurrency(stats.expenses)}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {stats.expenseCount} expenses
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Net
            </p>
            <p className="mt-1 text-2xl font-semibold tabular">
              <Money amount={stats.net} sign />
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">income − expenses</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Transactions
            </p>
            <p className="mt-1 text-2xl font-semibold tabular">{stats.total}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              of {totalTransactions} total
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Result count */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Showing <span className="font-semibold text-foreground">{filtered.length}</span> of{" "}
          {totalTransactions} transactions
        </p>
        {(sortKey !== "date" || sortDir !== "desc") && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 text-[11px] text-muted-foreground"
            onClick={() => {
              setSortKey("date");
              setSortDir("desc");
            }}
          >
            Reset sort
          </Button>
        )}
      </div>

      {/* Results table */}
      {filtered.length > 0 ? (
        <div className="rounded-xl border">
          <div className="max-h-[600px] overflow-auto scrollbar-thin">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="w-12 pl-3">Type</TableHead>
                  <TableHead className="w-32">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 text-left font-medium hover:text-foreground"
                      onClick={() => toggleSort("date")}
                    >
                      Date
                      <span className="text-[10px] text-muted-foreground">
                        {sortKey === "date" ? (sortDir === "asc" ? "↑" : "↓") : "↕"}
                      </span>
                    </button>
                  </TableHead>
                  <TableHead className="min-w-[220px]">Description</TableHead>
                  <TableHead className="min-w-[160px]">Category / Account</TableHead>
                  <TableHead className="w-32 text-right">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 text-right font-medium hover:text-foreground"
                      onClick={() => toggleSort("amount")}
                    >
                      Amount
                      <span className="text-[10px] text-muted-foreground">
                        {sortKey === "amount" ? (sortDir === "asc" ? "↑" : "↓") : "↕"}
                      </span>
                    </button>
                  </TableHead>
                  <TableHead className="w-28 pr-3">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((t) => {
                  const Icon =
                    t.kind === "sale" ? TrendingUp : t.kind === "expense" ? TrendingDown : ArrowLeftRight;
                  const iconColor =
                    t.kind === "sale"
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      : t.kind === "expense"
                        ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                        : "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400";
                  // For expenses → show category; for sales → deposit account;
                  // for transfers → destination account (description already shows flow).
                  const secondary =
                    t.kind === "expense"
                      ? (t.categoryName ?? "Uncategorized")
                      : t.kind === "sale"
                        ? t.accountName
                        : "Transfer";
                  return (
                    <TableRow
                      key={t.id}
                      className="cursor-pointer transition-colors hover:bg-accent/50"
                      onClick={() => handleRowClick(t)}
                    >
                      <TableCell className="pl-3">
                        <div
                          className={cn(
                            "flex h-7 w-7 items-center justify-center rounded-full",
                            iconColor,
                          )}
                        >
                          <Icon className="h-3.5 w-3.5" />
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="text-xs font-medium">{formatDate(t.date)}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {relativeTime(t.date)}
                        </p>
                      </TableCell>
                      <TableCell>
                        <p className="truncate text-sm font-medium">{t.description}</p>
                        {t.notes && (
                          <p className="truncate text-[10px] text-muted-foreground">
                            {t.notes}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        <p className="truncate text-xs">{secondary}</p>
                      </TableCell>
                      <TableCell className="text-right">
                        {t.kind === "transfer" ? (
                          <span className="text-sm tabular text-muted-foreground">
                            {formatCurrency(t.rawAmount)}
                          </span>
                        ) : (
                          <Money amount={t.amount} sign className="text-sm font-semibold" />
                        )}
                      </TableCell>
                      <TableCell className="pr-3">
                        <StatusBadge variant={statusVariantFor(t.kind, t.status)}>
                          {t.kind === "transfer" ? "TRANSFER" : t.status}
                        </StatusBadge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Inbox className="h-7 w-7" />
          </div>
          <div>
            <p className="text-sm font-semibold">No transactions match your filters</p>
            <p className="text-xs text-muted-foreground">
              Try clearing filters or adjusting your search query.
            </p>
          </div>
          {hasActiveFilters && (
            <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={clearFilters}>
              <X className="h-3.5 w-3.5" /> Clear filters
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function SearchSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-12 w-full rounded-xl" />
      <Skeleton className="h-32 w-full rounded-xl" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-[400px] w-full rounded-xl" />
    </div>
  );
}
