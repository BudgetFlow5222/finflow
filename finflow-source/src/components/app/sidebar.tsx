"use client";

import * as React from "react";
import Link from "next/link";
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
  Users,
  Truck,
  Settings,
  Sparkles,
  Target,
  Repeat,
  Search,
  ChevronRight,
  Database,
  Receipt,
  Calendar,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useDashboard } from "@/hooks/use-finance";

export type ViewKey =
  | "dashboard"
  | "search"
  | "accounts"
  | "sales"
  | "expenses"
  | "invoices"
  | "recurring"
  | "receivables"
  | "payables"
  | "transfers"
  | "budget"
  | "goals"
  | "customers"
  | "vendors"
  | "reports"
  | "calendar"
  | "tax"
  | "data";

interface NavItem {
  key: ViewKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  group: string;
  badge?: "AR" | "AP" | null;
}

export const NAV: NavItem[] = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard, group: "Overview" },
  { key: "search", label: "Search", icon: Search, group: "Overview" },
  { key: "accounts", label: "Accounts", icon: Wallet, group: "Money" },
  { key: "transfers", label: "Transfers", icon: ArrowLeftRight, group: "Money" },
  { key: "sales", label: "Sales", icon: TrendingUp, group: "Transactions" },
  { key: "expenses", label: "Expenses", icon: TrendingDown, group: "Transactions" },
  { key: "invoices", label: "Invoices", icon: FileText, group: "Transactions" },
  { key: "recurring", label: "Recurring", icon: Repeat, group: "Transactions" },
  { key: "receivables", label: "Receivables", icon: ArrowDownToLine, group: "Bills", badge: "AR" },
  { key: "payables", label: "Payables", icon: ArrowUpFromLine, group: "Bills", badge: "AP" },
  { key: "budget", label: "Budget", icon: PiggyBank, group: "Planning" },
  { key: "goals", label: "Goals", icon: Target, group: "Planning" },
  { key: "reports", label: "Reports", icon: Sparkles, group: "Planning" },
  { key: "calendar", label: "Calendar", icon: Calendar, group: "Planning" },
  { key: "tax", label: "Tax", icon: Receipt, group: "Planning" },
  { key: "customers", label: "Customers", icon: Users, group: "Directory" },
  { key: "vendors", label: "Vendors", icon: Truck, group: "Directory" },
  { key: "data", label: "Data", icon: Database, group: "System" },
];

export function Sidebar({
  active,
  onChange,
  onNavigate,
}: {
  active: ViewKey;
  onChange: (v: ViewKey) => void;
  onNavigate?: () => void;
}) {
  const { data: dash } = useDashboard();
  const arCount = dash?.arList?.length ?? 0;
  const apCount = dash?.apList?.length ?? 0;

  const groups = React.useMemo(() => {
    const map = new Map<string, NavItem[]>();
    for (const item of NAV) {
      if (!map.has(item.group)) map.set(item.group, []);
      map.get(item.group)!.push(item);
    }
    return Array.from(map.entries());
  }, []);

  return (
    <aside className="flex h-full w-full flex-col bg-sidebar text-sidebar-foreground">
      {/* Brand */}
      <div className="flex h-16 items-center gap-2.5 px-5 border-b border-sidebar-border">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/20">
          <PiggyBank className="h-5 w-5" />
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-base font-semibold tracking-tight">FinFlow</span>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Finance OS
          </span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto scrollbar-thin px-3 py-4">
        {groups.map(([group, items]) => (
          <div key={group} className="mb-4">
            <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
              {group}
            </p>
            <ul className="space-y-0.5">
              {items.map((item) => {
                const isActive = active === item.key;
                const badge =
                  item.badge === "AR" ? arCount : item.badge === "AP" ? apCount : 0;
                return (
                  <li key={item.key}>
                    <button
                      onClick={() => {
                        onChange(item.key);
                        onNavigate?.();
                      }}
                      className={cn(
                        "group relative flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all",
                        isActive
                          ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                          : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                      )}
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      <span className="flex-1 text-left">{item.label}</span>
                      {badge > 0 && (
                        <span
                          className={cn(
                            "min-w-5 rounded-full px-1.5 py-0.5 text-center text-[10px] font-semibold tabular",
                            isActive
                              ? "bg-sidebar-primary-foreground/20 text-sidebar-primary-foreground"
                              : item.badge === "AR"
                                ? "bg-cyan-500/15 text-cyan-600 dark:text-cyan-300"
                                : "bg-amber-500/15 text-amber-600 dark:text-amber-300",
                          )}
                        >
                          {badge}
                        </span>
                      )}
                      {isActive && (
                        <ChevronRight className="h-3.5 w-3.5 opacity-80" />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer card */}
      <div className="border-t border-sidebar-border p-3">
        <div className="rounded-xl bg-gradient-to-br from-emerald-500/10 to-teal-500/5 p-3 ring-1 ring-emerald-500/10">
          <div className="flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
              50/30/20 Rule
            </p>
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
            Allocate take-home income: 50% needs, 30% wants, 20% savings.
          </p>
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="mt-2 h-7 w-full justify-start px-2 text-[11px] text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10"
          >
            <Link href="#" onClick={(e) => e.preventDefault()}>
              <Settings className="mr-1 h-3 w-3" /> Configure budget
            </Link>
          </Button>
        </div>
      </div>
    </aside>
  );
}
