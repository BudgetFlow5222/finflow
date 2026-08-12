"use client";

import * as React from "react";
import { Sparkles, Bell, Menu, PiggyBank } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSeed, useDashboard } from "@/hooks/use-finance";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { NAV, Sidebar, type ViewKey } from "@/components/app/sidebar";
import { CurrencySelector } from "@/components/currency-selector";
import { cn } from "@/lib/utils";

const VIEW_TITLES: Record<ViewKey, { title: string; subtitle: string }> = {
  dashboard: { title: "Dashboard", subtitle: "Your financial overview at a glance" },
  search: { title: "Search Transactions", subtitle: "Find any transaction across all of FinFlow" },
  accounts: { title: "Accounts", subtitle: "Cash, bank, wallet & UPI balances" },
  transfers: { title: "Transfers", subtitle: "Move money between accounts" },
  sales: { title: "Sales", subtitle: "Record income from customers" },
  expenses: { title: "Expenses", subtitle: "Track spending across categories" },
  invoices: { title: "Invoices", subtitle: "Create, send and track invoices" },
  recurring: { title: "Recurring Transactions", subtitle: "Automate repeating income & expenses" },
  receivables: { title: "Accounts Receivable", subtitle: "Outstanding customer invoices" },
  payables: { title: "Accounts Payable", subtitle: "Outstanding vendor bills" },
  budget: { title: "Monthly Budget", subtitle: "50/30/20 rule allocations" },
  goals: { title: "Savings Goals", subtitle: "Track progress toward your financial milestones" },
  customers: { title: "Customers", subtitle: "Manage your client directory" },
  vendors: { title: "Vendors", subtitle: "Manage your supplier directory" },
  reports: { title: "Reports", subtitle: "Financial insights & analytics" },
  calendar: { title: "Calendar", subtitle: "Visual timeline of bills, due dates and schedules" },
  tax: { title: "Tax Preparation", subtitle: "GST/VAT summary and tax liability report" },
  data: { title: "Data Manager", subtitle: "Backup, restore, and bulk-import your financial data" },
};

export function Topbar({
  view,
  active,
  onChange,
  onCustomizeDashboard,
}: {
  view: ViewKey;
  active: ViewKey;
  onChange: (v: ViewKey) => void;
  onCustomizeDashboard?: () => void;
}) {
  const seed = useSeed();
  const { data: dash } = useDashboard();
  const arCount = dash?.arList?.length ?? 0;
  const apCount = dash?.apList?.length ?? 0;
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);

  const navRef = React.useRef<HTMLDivElement>(null);

  const handleMobileNav = (v: ViewKey) => {
    onChange(v);
    setMobileNavOpen(false);
  };

  const currentTitle = VIEW_TITLES[active]?.title ?? "FinFlow";

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-xl">
      {/* Mobile row: hamburger + brand + title + actions */}
      <div className="flex h-14 items-center gap-2 px-4 md:hidden">
        <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0 rounded-lg"
              aria-label="Open navigation menu"
            >
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0">
            <SheetHeader className="sr-only">
              <SheetTitle>Navigation</SheetTitle>
            </SheetHeader>
            <Sidebar active={active} onChange={handleMobileNav} onNavigate={() => setMobileNavOpen(false)} />
          </SheetContent>
        </Sheet>

        {/* Mobile brand + current view title */}
        <div className="flex flex-1 items-center gap-2 overflow-hidden">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow">
            <PiggyBank className="h-4 w-4" />
          </div>
          <div className="flex min-w-0 flex-col leading-tight">
            <span className="truncate text-sm font-semibold tracking-tight">{currentTitle}</span>
            <span className="truncate text-[10px] uppercase tracking-wider text-muted-foreground">
              FinFlow · Finance OS
            </span>
          </div>
        </div>

        {/* Mobile right actions */}
        <div className="flex shrink-0 items-center gap-1">
          {dash?.kpis.totalBalance === 0 && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 rounded-full"
              onClick={() => seed.mutate()}
              disabled={seed.isPending}
            >
              <Sparkles className="h-3.5 w-3.5" />
            </Button>
          )}
          {/* Compact currency selector for mobile */}
          <CurrencySelector compact />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="relative h-9 w-9 rounded-lg">
                <Bell className="h-4 w-4" />
                {dash?.alerts && dash.alerts.length > 0 && (
                  <span className="absolute right-1.5 top-1.5 flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <DropdownMenuLabel>Notifications</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {dash?.alerts && dash.alerts.length > 0 ? (
                dash.alerts.map((a, i) => (
                  <DropdownMenuItem key={i} className="flex flex-col items-start py-2">
                    <span
                      className={
                        a.severity === "danger"
                          ? "text-xs font-medium text-red-600 dark:text-red-400"
                          : a.severity === "warning"
                            ? "text-xs font-medium text-amber-600 dark:text-amber-400"
                            : "text-xs font-medium text-cyan-600 dark:text-cyan-400"
                      }
                    >
                      {a.type}
                    </span>
                    <span className="text-xs text-muted-foreground">{a.message}</span>
                  </DropdownMenuItem>
                ))
              ) : (
                <div className="px-2 py-6 text-center text-xs text-muted-foreground">
                  No alerts. You&apos;re all caught up!
                </div>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <Avatar className="h-8 w-8 border border-border">
            <AvatarFallback className="bg-gradient-to-br from-emerald-500 to-teal-600 text-[10px] font-semibold text-white">
              FN
            </AvatarFallback>
          </Avatar>
        </div>
      </div>

      {/* Desktop row: Nav pills + right-aligned actions */}
      <div
        ref={navRef}
        className="hidden h-14 items-center gap-1 overflow-x-auto scrollbar-thin px-4 py-1 md:flex md:px-6"
      >
        {NAV.map((item) => {
          const isActive = active === item.key;
          const badge =
            item.badge === "AR" ? arCount : item.badge === "AP" ? apCount : 0;
          return (
            <button
              key={item.key}
              onClick={() => onChange(item.key)}
              className={cn(
                "group relative flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all",
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )}
            >
              <item.icon className="h-3.5 w-3.5 shrink-0" />
              <span className="whitespace-nowrap">{item.label}</span>
              {badge > 0 && (
                <span
                  className={cn(
                    "min-w-4 rounded-full px-1 py-0.5 text-center text-[9px] font-semibold tabular leading-none",
                    isActive
                      ? "bg-primary-foreground/20 text-primary-foreground"
                      : item.badge === "AR"
                        ? "bg-cyan-500/15 text-cyan-600 dark:text-cyan-300"
                        : "bg-amber-500/15 text-amber-600 dark:text-amber-300",
                  )}
                >
                  {badge}
                </span>
              )}
            </button>
          );
        })}

        {/* Right-aligned actions on the nav line */}
        <div className="ml-auto flex shrink-0 items-center gap-2 pl-2">
          {/* Seed / demo (shown when empty) */}
          {dash?.kpis.totalBalance === 0 && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 rounded-full"
              onClick={() => seed.mutate()}
              disabled={seed.isPending}
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{seed.isPending ? "Loading…" : "Load Demo"}</span>
            </Button>
          )}

          {/* Notifications */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="relative h-8 w-8 rounded-full">
                <Bell className="h-4 w-4" />
                {dash?.alerts && dash.alerts.length > 0 && (
                  <span className="absolute right-1 top-1 flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <DropdownMenuLabel>Notifications</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {dash?.alerts && dash.alerts.length > 0 ? (
                dash.alerts.map((a, i) => (
                  <DropdownMenuItem key={i} className="flex flex-col items-start py-2">
                    <span
                      className={
                        a.severity === "danger"
                          ? "text-xs font-medium text-red-600 dark:text-red-400"
                          : a.severity === "warning"
                            ? "text-xs font-medium text-amber-600 dark:text-amber-400"
                            : "text-xs font-medium text-cyan-600 dark:text-cyan-400"
                      }
                    >
                      {a.type}
                    </span>
                    <span className="text-xs text-muted-foreground">{a.message}</span>
                  </DropdownMenuItem>
                ))
              ) : (
                <div className="px-2 py-6 text-center text-xs text-muted-foreground">
                  No alerts. You&apos;re all caught up!
                </div>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <Avatar className="h-8 w-8 border border-border">
            <AvatarFallback className="bg-gradient-to-br from-emerald-500 to-teal-600 text-[10px] font-semibold text-white">
              FN
            </AvatarFallback>
          </Avatar>
        </div>
      </div>
    </header>
  );
}
