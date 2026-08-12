"use client";

import * as React from "react";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
  CommandSeparator,
} from "@/components/ui/command";
import {
  LayoutDashboard,
  Wallet,
  TrendingUp,
  TrendingDown,
  FileText,
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowLeftRight,
  PiggyBank,
  Target,
  Users,
  Truck,
  Sparkles,
  Repeat,
  Search,
  CornerDownLeft,
} from "lucide-react";
import type { ViewKey } from "@/components/app/sidebar";
import { useUI } from "@/hooks/use-ui";
import { useSales, useExpenses } from "@/hooks/use-finance";
import { formatCurrency, formatDate, cn } from "@/lib/utils";

type IconType = React.ComponentType<{ className?: string }>;

// Navigation views — same set & icons as sidebar.tsx, ordered per the spec.
const NAV_ITEMS: { key: ViewKey; label: string; icon: IconType }[] = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "search", label: "Search", icon: Search },
  { key: "accounts", label: "Accounts", icon: Wallet },
  { key: "sales", label: "Sales", icon: TrendingUp },
  { key: "expenses", label: "Expenses", icon: TrendingDown },
  { key: "invoices", label: "Invoices", icon: FileText },
  { key: "recurring", label: "Recurring", icon: Repeat },
  { key: "receivables", label: "Receivables", icon: ArrowDownToLine },
  { key: "payables", label: "Payables", icon: ArrowUpFromLine },
  { key: "transfers", label: "Transfers", icon: ArrowLeftRight },
  { key: "budget", label: "Budget", icon: PiggyBank },
  { key: "goals", label: "Goals", icon: Target },
  { key: "customers", label: "Customers", icon: Users },
  { key: "vendors", label: "Vendors", icon: Truck },
  { key: "reports", label: "Reports", icon: Sparkles },
];

// Quick-action → target-view mapping mirrors the one in app/page.tsx.
const QUICK_ACTIONS: {
  key: string;
  label: string;
  icon: IconType;
  view: ViewKey;
  shortcut: string;
}[] = [
  { key: "sale", label: "New Sale", icon: TrendingUp, view: "sales", shortcut: "S" },
  { key: "expense", label: "New Expense", icon: TrendingDown, view: "expenses", shortcut: "E" },
  { key: "invoice", label: "New Invoice", icon: FileText, view: "invoices", shortcut: "I" },
  { key: "transfer", label: "New Transfer", icon: ArrowLeftRight, view: "transfers", shortcut: "T" },
  { key: "account", label: "New Account", icon: Wallet, view: "accounts", shortcut: "A" },
  { key: "customer", label: "New Customer", icon: Users, view: "customers", shortcut: "C" },
  { key: "vendor", label: "New Vendor", icon: Truck, view: "vendors", shortcut: "V" },
  { key: "recurring", label: "New Recurring", icon: Repeat, view: "recurring", shortcut: "R" },
];

interface UnifiedTxn {
  id: string;
  kind: "sale" | "expense";
  amount: number;
  date: string;
  description: string;
  view: ViewKey;
}

/**
 * Global Command Palette (Cmd+K / Ctrl+K).
 *
 * Renders three sections — Navigation, Quick Actions, and Recent Transactions —
 * on top of shadcn's `CommandDialog` (cmdk). Built-in fuzzy filtering, arrow-key
 * navigation, Enter-to-select, and Escape-to-close all come from cmdk.
 */
export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { setView, openForm } = useUI();
  const { data: sales = [] } = useSales();
  const { data: expenses = [] } = useExpenses();

  // Combine sales + expenses into a unified, date-desc transaction list and
  // keep only the 8 most recent. cmdk then filters this shortlist by the query.
  const txns = React.useMemo<UnifiedTxn[]>(() => {
    const fromSales: UnifiedTxn[] = sales.map((s) => ({
      id: `sale-${s.id}`,
      kind: "sale" as const,
      amount: s.total,
      date: s.date,
      description: s.customer?.name ?? s.notes ?? "Sale",
      view: "sales" as ViewKey,
    }));
    const fromExpenses: UnifiedTxn[] = expenses.map((e) => ({
      id: `expense-${e.id}`,
      kind: "expense" as const,
      amount: e.total,
      date: e.date,
      description: e.vendor?.name ?? e.category?.name ?? e.notes ?? "Expense",
      view: "expenses" as ViewKey,
    }));
    return [...fromSales, ...fromExpenses]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 8);
  }, [sales, expenses]);

  const close = React.useCallback(() => onOpenChange(false), [onOpenChange]);

  const handleNav = React.useCallback(
    (v: ViewKey) => {
      setView(v);
      close();
    },
    [setView, close],
  );

  const handleAction = React.useCallback(
    (key: string, view: ViewKey) => {
      setView(view);
      openForm(key);
      close();
    },
    [setView, openForm, close],
  );

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="FinFlow Command"
      description="Search navigation, quick actions, and transactions"
      className="max-w-2xl"
    >
      {/* Visible header (the dialog's <DialogHeader> is sr-only for a11y). */}
      <div className="flex items-center gap-2 px-4 pt-4 pb-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold tracking-tight">FinFlow Command</span>
        <kbd className="ml-auto rounded border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
          ⌘K
        </kbd>
      </div>

      <CommandInput placeholder="Search navigation, actions, or transactions…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="Navigation">
          {NAV_ITEMS.map((item) => (
            <CommandItem
              key={item.key}
              value={`${item.label} go to view navigate`}
              onSelect={() => handleNav(item.key)}
            >
              <item.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="flex-1">{item.label}</span>
              <CommandShortcut>
                <CornerDownLeft className="h-3 w-3" />
              </CommandShortcut>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Quick Actions">
          <CommandItem
            key="search-txns"
            value="search transactions find filter look for"
            onSelect={() => handleNav("search")}
          >
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Search className="h-3.5 w-3.5" />
            </div>
            <span className="flex-1">Search Transactions</span>
            <CommandShortcut>
              <kbd className="rounded border bg-muted px-1 text-[10px] font-medium uppercase tracking-wide">
                /
              </kbd>
            </CommandShortcut>
          </CommandItem>
          {QUICK_ACTIONS.map((action) => (
            <CommandItem
              key={action.key}
              value={`${action.label} create new add ${action.key}`}
              onSelect={() => handleAction(action.key, action.view)}
            >
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                <action.icon className="h-3.5 w-3.5" />
              </div>
              <span className="flex-1">{action.label}</span>
              <CommandShortcut>
                <kbd className="rounded border bg-muted px-1 text-[10px] font-medium uppercase tracking-wide">
                  {action.shortcut}
                </kbd>
              </CommandShortcut>
            </CommandItem>
          ))}
        </CommandGroup>

        {txns.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Recent Transactions">
              {txns.map((t) => {
                const isSale = t.kind === "sale";
                const Icon = isSale ? TrendingUp : TrendingDown;
                return (
                  <CommandItem
                    key={t.id}
                    value={`${t.kind} ${t.description} ${formatCurrency(t.amount)} ${formatDate(t.date)} transaction`}
                    onSelect={() => handleNav(t.view)}
                  >
                    <Icon
                      className={cn(
                        "h-4 w-4 shrink-0",
                        isSale
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-rose-600 dark:text-rose-400",
                      )}
                    />
                    <span className="min-w-0 flex-1 truncate">{t.description}</span>
                    <span
                      className={cn(
                        "shrink-0 text-xs font-medium tabular-nums",
                        isSale
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-rose-600 dark:text-rose-400",
                      )}
                    >
                      {isSale ? "+" : "−"}
                      {formatCurrency(t.amount)}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                      {formatDate(t.date)}
                    </span>
                    <CommandShortcut>
                      <CornerDownLeft className="h-3 w-3" />
                    </CommandShortcut>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
