"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import { PiggyBank, LayoutGrid, Plus } from "lucide-react";
import { Topbar } from "@/components/app/topbar";
import { QuickAddDialog } from "@/components/app/quick-add-dialog";
import { CommandPalette } from "@/components/app/command-palette";
import { DashboardCustomizeDialog } from "@/components/views/dashboard-customize-dialog";
import { DashboardSettingsProvider } from "@/hooks/use-dashboard-settings";
import { QueryProvider } from "@/components/query-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { CurrencySelector } from "@/components/currency-selector";
import { useUI } from "@/hooks/use-ui";
import type { ViewKey } from "@/components/app/sidebar";

// Lazy-load each view so the initial bundle stays small.
const DashboardView = dynamic(() => import("@/components/views/dashboard-view").then((m) => m.DashboardView), { ssr: false });
const SearchView = dynamic(() => import("@/components/views/search-view").then((m) => m.SearchView), { ssr: false });
const AccountsView = dynamic(() => import("@/components/views/accounts-view").then((m) => m.AccountsView), { ssr: false });
const SalesView = dynamic(() => import("@/components/views/sales-view").then((m) => m.SalesView), { ssr: false });
const ExpensesView = dynamic(() => import("@/components/views/expenses-view").then((m) => m.ExpensesView), { ssr: false });
const InvoicesView = dynamic(() => import("@/components/views/invoices-view").then((m) => m.InvoicesView), { ssr: false });
const RecurringView = dynamic(() => import("@/components/views/recurring-view").then((m) => m.RecurringView), { ssr: false });
const ReceivablesView = dynamic(() => import("@/components/views/receivables-view").then((m) => m.ReceivablesView), { ssr: false });
const PayablesView = dynamic(() => import("@/components/views/payables-view").then((m) => m.PayablesView), { ssr: false });
const TransfersView = dynamic(() => import("@/components/views/transfers-view").then((m) => m.TransfersView), { ssr: false });
const BudgetView = dynamic(() => import("@/components/views/budget-view").then((m) => m.BudgetView), { ssr: false });
const CustomersView = dynamic(() => import("@/components/views/customers-view").then((m) => m.CustomersView), { ssr: false });
const VendorsView = dynamic(() => import("@/components/views/vendors-view").then((m) => m.VendorsView), { ssr: false });
const ReportsView = dynamic(() => import("@/components/views/reports-view").then((m) => m.ReportsView), { ssr: false });
const CalendarView = dynamic(() => import("@/components/views/calendar-view").then((m) => m.CalendarView), { ssr: false });
const GoalsView = dynamic(() => import("@/components/views/goals-view").then((m) => m.GoalsView), { ssr: false });
const TaxView = dynamic(() => import("@/components/views/tax-view").then((m) => m.TaxView), { ssr: false });
const DataManagerView = dynamic(() => import("@/components/views/data-manager-view").then((m) => m.DataManagerView), { ssr: false });

const VIEWS: Record<ViewKey, React.ComponentType> = {
  dashboard: DashboardView,
  search: SearchView,
  accounts: AccountsView,
  sales: SalesView,
  expenses: ExpensesView,
  invoices: InvoicesView,
  recurring: RecurringView,
  receivables: ReceivablesView,
  payables: PayablesView,
  transfers: TransfersView,
  budget: BudgetView,
  goals: GoalsView,
  customers: CustomersView,
  vendors: VendorsView,
  reports: ReportsView,
  calendar: CalendarView,
  tax: TaxView,
  data: DataManagerView,
};

const VIEW_TITLES: Partial<Record<ViewKey, { title: string; subtitle: string }>> = {
  dashboard: { title: "Dashboard", subtitle: "Your financial overview at a glance" },
};

function Shell() {
  const { view, setView, openForm } = useUI();
  const [quickAdd, setQuickAdd] = React.useState(false);
  const [commandOpen, setCommandOpen] = React.useState(false);
  const [customizeOpen, setCustomizeOpen] = React.useState(false);

  // Global Cmd+K (macOS) / Ctrl+K (others) shortcut to open the Command Palette.
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const View = VIEWS[view] ?? DashboardView;

  const handleQuickSelect = (key: string) => {
    const viewMap: Record<string, ViewKey> = {
      sale: "sales",
      expense: "expenses",
      invoice: "invoices",
      transfer: "transfers",
      account: "accounts",
      customer: "customers",
      vendor: "vendors",
      goal: "goals",
      recurring: "recurring",
    };
    const target = viewMap[key];
    if (target) {
      setView(target);
      openForm(key);
    }
  };

  return (
    <div className="flex min-h-screen w-full flex-col bg-background">
      <Topbar
        view={view}
        active={view}
        onChange={setView}
        onCustomizeDashboard={() => setCustomizeOpen(true)}
      />
      <main className="flex-1 px-4 py-5 md:px-6 md:py-6">
        <div className="mx-auto w-full max-w-7xl">
          <AnimatePresence mode="wait">
            <motion.div
              key={view}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              <View />
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
      <footer className="mt-auto border-t border-border bg-background/60 px-4 py-4 md:px-6">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Left: Brand + view title */}
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/20">
              <PiggyBank className="h-5 w-5" />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-semibold tracking-tight">FinFlow</span>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {VIEW_TITLES[view]?.title ?? "Finance OS"} — {VIEW_TITLES[view]?.subtitle ?? "Financial Management Dashboard"}
              </span>
            </div>
          </div>

          {/* Right: Customize + currency + theme toggle + meta */}
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="hidden text-xs text-muted-foreground lg:inline">
              Built with Next.js · Prisma · shadcn/ui
            </span>
            {view === "dashboard" && (
              <button
                onClick={() => setCustomizeOpen(true)}
                className="flex h-8 items-center gap-1.5 rounded-full border border-border px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                title="Customize dashboard widgets"
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Customize</span>
              </button>
            )}
            <CurrencySelector />
            <ThemeToggle />
            <span className="hidden text-xs text-muted-foreground sm:inline">© {new Date().getFullYear()}</span>
          </div>
        </div>
      </footer>

      {/* Floating Quick Add FAB */}
      <button
        onClick={() => setQuickAdd(true)}
        className="group fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/30 transition-all hover:scale-110 hover:shadow-xl hover:shadow-emerald-500/40 active:scale-95"
        aria-label="Quick Add"
        title="Quick Add"
      >
        <Plus className="h-6 w-6 transition-transform group-hover:rotate-90" />
        <span className="pointer-events-none absolute right-full mr-3 hidden whitespace-nowrap rounded-md bg-foreground px-2.5 py-1 text-xs font-medium text-background opacity-0 shadow-md transition-opacity group-hover:opacity-100 sm:block">
          Quick Add
        </span>
        <span className="absolute -top-1 -right-1 flex h-3 w-3">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-75" />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-400" />
        </span>
      </button>

      <QuickAddDialog open={quickAdd} onOpenChange={setQuickAdd} onSelect={handleQuickSelect} />
      <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />
      <DashboardCustomizeDialog open={customizeOpen} onOpenChange={setCustomizeOpen} />
    </div>
  );
}

export default function Home() {
  return (
    <QueryProvider>
      <DashboardSettingsProvider>
        <Shell />
      </DashboardSettingsProvider>
    </QueryProvider>
  );
}
