"use client";

import * as React from "react";
import Link from "next/link";
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  ArrowLeftRight,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Receipt,
  FileText,
  PiggyBank,
  Sparkles,
  ChevronRight,
  Clock,
  Target,
  Banknote,
  Eye,
  Zap,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Money } from "@/components/money";
import { StatusBadge, invoiceStatusVariant, arApStatusVariant } from "@/components/status-badge";
import { EmptyState } from "@/components/app/empty-state";
import {
  CashFlowChart,
  BudgetDonut,
  ExpenseBreakdownChart,
  IncomeTrendChart,
} from "@/components/charts";
import { useDashboard, useSeed } from "@/hooks/use-finance";
import { useUI } from "@/hooks/use-ui";
import { useCurrency } from "@/hooks/use-currency";
import { formatMoney } from "@/lib/currency";
import { formatDate, relativeTime, daysUntil, initials, cn } from "@/lib/utils";
import type { DashboardData } from "@/types";
import { HealthScoreWidget } from "@/components/views/health-score-widget";
import { BudgetAlertsWidget } from "@/components/views/budget-alerts-widget";
import { AIInsightsWidget } from "@/components/views/ai-insights-widget";
import { ForecastWidget } from "@/components/views/forecast-widget";
import { CollapsibleCard } from "@/components/views/collapsible-card";
import { useDashboardSettings } from "@/hooks/use-dashboard-settings";

export function DashboardView() {
  const { data, isLoading, isError, refetch } = useDashboard();
  const seed = useSeed();

  if (isError) {
    return (
      <EmptyState
        variant="error"
        icon={AlertTriangle}
        title="Couldn't load dashboard"
        description="There was an error fetching your financial data. Try again."
        actionLabel="Retry"
        onAction={() => refetch()}
      />
    );
  }

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (!data || data.accounts.length === 0) {
    return (
      <EmptyState
        icon={Sparkles}
        title="Welcome to FinFlow"
        description="Your dashboard is empty. Load a realistic demo dataset to explore the full experience — accounts, transactions, invoices, AR/AP, and budgeting."
        actionLabel="Load demo data"
        onAction={() => seed.mutate()}
      />
    );
  }

  return <DashboardContent data={data} />;
}

function DashboardContent({ data }: { data: DashboardData }) {
  const k = data.kpis;
  const { visibility } = useDashboardSettings();
  const setView = useUI((s) => s.setView);
  const { currency } = useCurrency();
  // Bound formatter: converts INR base amounts to the active display currency.
  const fmt = (amount: number, opts?: { compact?: boolean; sign?: boolean }) =>
    formatMoney(amount, currency, opts ?? {});
  return (
    <div className="space-y-5">
      {/* Budget Alerts */}
      {visibility.budgetAlerts && <BudgetAlertsWidget />}

      {/* Alerts strip */}
      {data.alerts.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {data.alerts.slice(0, 3).map((a, i) => (
            <div
              key={i}
              className={cn(
                "flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs",
                a.severity === "danger"
                  ? "border-red-500/20 bg-red-500/5 text-red-700 dark:text-red-300"
                  : a.severity === "warning"
                    ? "border-amber-500/20 bg-amber-500/5 text-amber-700 dark:text-amber-300"
                    : "border-cyan-500/20 bg-cyan-500/5 text-cyan-700 dark:text-cyan-300",
              )}
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              <span>{a.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* AI Insights + Health Score */}
      <div className="grid gap-4 lg:grid-cols-2">
        <AIInsightsWidget />
        {visibility.healthScore && <HealthScoreWidget />}
      </div>

      {/* KPI cards */}
      {visibility.kpiCards && (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <KpiCard
            label="Total Balance"
            value={k.totalBalance}
            icon={Wallet}
            accent="emerald"
            subtitle={`${data.accounts.filter((a) => a.status === "ACTIVE").length} active accounts`}
          />
          <KpiCard
            label="Income (this month)"
            value={k.monthlyIncome}
            icon={TrendingUp}
            accent="cyan"
            trend={{ dir: "up", text: "vs last month" }}
          />
          <KpiCard
            label="Expenses (this month)"
            value={k.monthlyExpenses}
            icon={TrendingDown}
            accent="rose"
            trend={{ dir: "down", text: "vs last month" }}
          />
          <KpiCard
            label="Net Cash Flow"
            value={k.netCashFlow}
            icon={ArrowLeftRight}
            accent={k.netCashFlow >= 0 ? "emerald" : "rose"}
            subtitle={k.netCashFlow >= 0 ? "Positive" : "Negative"}
          />
        </div>
      )}

      {/* Secondary KPIs */}
      {visibility.secondaryKpis && (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <MiniStat
            label="Receivables (AR)"
            value={k.outstandingAR}
            icon={ArrowDownRight}
            tone="cyan"
            subtitle={`${data.arList.length} outstanding`}
          />
          <MiniStat
            label="Payables (AP)"
            value={k.outstandingAP}
            icon={ArrowUpRight}
            tone="amber"
            subtitle={`${data.apList.length} outstanding`}
          />
          <MiniStat
            label="Budget Used"
            value={k.budgetUsedPct}
            icon={PiggyBank}
            tone={k.budgetUsedPct > 90 ? "rose" : "emerald"}
            isPercent
            subtitle="of monthly allocation"
          />
          <MiniStat
            label="Net Worth"
            value={k.totalBalance + k.outstandingAR - k.outstandingAP}
            icon={Receipt}
            tone="violet"
            subtitle="Balance + AR − AP"
          />
        </div>
      )}

      {/* Charts row */}
      <div className="grid gap-4 lg:grid-cols-3">
        {visibility.cashFlowChart && (
          <CollapsibleCard
            sectionKey="dash-cash-flow"
            className="lg:col-span-2"
            title="Cash Flow"
            description="Income vs expense, last 6 months"
            actions={
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" /> Income
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-rose-500" /> Expense
                </span>
              </div>
            }
          >
            <CashFlowChart data={data.cashFlow} />
          </CollapsibleCard>
        )}

        {visibility.budgetDonut && (
          <CollapsibleCard
            sectionKey="dash-budget-donut"
            title={
              <span className="flex items-center gap-2">
                <PiggyBank className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                50/30/20 Budget
              </span>
            }
            description={data.monthlyBudget ? `Income ${fmt(data.monthlyBudget.income)}` : "No budget set"}
          >
            <BudgetDonut data={data.budgetSplit} />
            <div className="mt-2 space-y-1.5">
              {data.budgetSplit.map((b) => {
                const used = b.value > 0 ? Math.min(100, (b.spent / b.value) * 100) : 0;
                return (
                  <div key={b.name} className="flex items-center gap-2">
                    <span className="w-16 text-xs text-muted-foreground capitalize">{b.name.toLowerCase()}</span>
                    <Progress value={used} className="h-1.5 flex-1" />
                    <span className="w-16 text-right text-[10px] tabular text-muted-foreground">
                      {fmt(b.spent, { compact: true })}/{fmt(b.value, { compact: true })}
                    </span>
                  </div>
                );
              })}
            </div>
          </CollapsibleCard>
        )}
      </div>

      {/* Accounts + expense breakdown */}
      <div className="grid gap-4 lg:grid-cols-3">
        {visibility.accountBalances && (
          <CollapsibleCard
            sectionKey="dash-accounts"
            className="lg:col-span-2"
            title="Account Balances"
            description={`${data.accounts.length} accounts tracked`}
          >
            <div className="grid gap-2 sm:grid-cols-2">
              {data.accounts.slice(0, 4).map((a) => {
                const isOverdraft = a.currentBalance < 0;
                return (
                  <div
                    key={a.id}
                    className="group flex items-center gap-3 rounded-xl border border-border bg-card p-3 transition-all hover:bg-accent/40 hover:shadow-sm"
                  >
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white shadow-sm"
                      style={{ backgroundColor: a.color ?? "var(--primary)" }}
                    >
                      <Wallet className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium leading-tight">{a.name}</p>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        {a.type}
                        <span className={cn(
                          "h-1 w-1 rounded-full",
                          a.status === "ACTIVE" ? "bg-emerald-500" : a.status === "FROZEN" ? "bg-amber-500" : "bg-muted-foreground"
                        )} />
                        {a.status}
                      </p>
                    </div>
                    <div className="flex items-center justify-end gap-1.5 shrink-0">
                      <div className="text-right">
                        {isOverdraft && (
                          <Badge
                            variant="destructive"
                            className="mb-0.5 h-4 px-1 text-[9px] font-semibold uppercase tracking-wide"
                          >
                            Overdraft
                          </Badge>
                        )}
                        <Money
                          amount={a.currentBalance}
                          className={cn(
                            "text-sm",
                            isOverdraft && "text-rose-600 dark:text-rose-400 font-semibold",
                          )}
                        />
                      </div>
                      {isOverdraft && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setView("transfers")}
                          className="h-6 w-6 shrink-0 text-rose-600 hover:bg-rose-500/10 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300"
                          title="Fix overdraft — open transfers"
                          aria-label="Fix overdraft"
                        >
                          <Zap className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CollapsibleCard>
        )}

        {visibility.expenseBreakdown && (
          <CollapsibleCard
            sectionKey="dash-expense-breakdown"
            title="Expense Breakdown"
            description="This month, by category"
          >
            {data.expenseByCategory.length > 0 ? (
              <ExpenseBreakdownChart data={data.expenseByCategory} />
            ) : (
              <div className="flex h-32 items-center justify-center text-xs text-muted-foreground">
                No expenses this month
              </div>
            )}
          </CollapsibleCard>
        )}
      </div>

      {/* Recent invoices + recent expenses */}
      <div className="grid gap-4 lg:grid-cols-2">
        {visibility.recentInvoices && (
          <CollapsibleCard
            sectionKey="dash-recent-invoices"
            title={
              <span className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                Recent Invoices
              </span>
            }
            description="Latest issued invoices"
            actions={
              <Button variant="ghost" size="sm" className="h-7 text-xs" asChild>
                <Link href="#" onClick={(e) => e.preventDefault()}>
                  View all <ChevronRight className="h-3 w-3" />
                </Link>
              </Button>
            }
          >
            <div className="space-y-1">
              {data.recentInvoices.slice(0, 5).map((inv) => (
                <div key={inv.id} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-accent/50">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/10 text-xs font-semibold text-violet-600 dark:text-violet-400">
                    {initials(inv.customer?.name ?? "—")}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{inv.customer?.name ?? "—"}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {inv.number} · {formatDate(inv.issueDate)}
                    </p>
                  </div>
                  <div className="text-right">
                    <Money amount={inv.total} className="text-sm" />
                    <StatusBadge variant={invoiceStatusVariant(inv.status)} className="mt-0.5">
                      {inv.status.replace("_", " ")}
                    </StatusBadge>
                  </div>
                </div>
              ))}
            </div>
          </CollapsibleCard>
        )}

        {visibility.recentExpenses && (
          <CollapsibleCard
            sectionKey="dash-recent-expenses"
            title={
              <span className="flex items-center gap-2">
                <Receipt className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                Recent Expenses
              </span>
            }
            description="Latest recorded spending"
          >
            <div className="space-y-1">
              {data.recentExpenses.slice(0, 5).map((e) => (
                <div key={e.id} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-accent/50">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-500/10 text-xs font-semibold text-rose-600 dark:text-rose-400">
                    {(e.vendor?.name ?? e.category?.name ?? "—").charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{e.vendor?.name ?? e.category?.name ?? "Uncategorized"}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {e.category?.name ?? "Uncategorized"} · {relativeTime(e.date)}
                    </p>
                  </div>
                  <Money amount={-e.total} className="text-sm" sign />
                </div>
              ))}
            </div>
          </CollapsibleCard>
        )}
      </div>

      {/* AR + AP widgets */}
      {visibility.arApWidgets && (
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <ArrowDownRight className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                Outstanding Receivables
              </CardTitle>
              <CardDescription className="text-xs">
                {fmt(data.kpis.outstandingAR)} across {data.arList.length} invoices
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="max-h-64 space-y-1 overflow-y-auto scrollbar-thin pr-1">
              {data.arList.length === 0 ? (
                <div className="flex h-24 items-center justify-center text-xs text-muted-foreground">
                  No outstanding receivables
                </div>
              ) : (
                data.arList.map((ar) => {
                  const due = daysUntil(ar.dueDate);
                  return (
                    <div
                      key={ar.id}
                      className="group flex items-center gap-3 rounded-lg border border-border px-3 py-2 transition-colors hover:bg-accent/40"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{ar.customer?.name ?? "—"}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {ar.invoice?.number ?? "—"} · due {formatDate(ar.dueDate)}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setView("receivables")}
                          className="h-6 gap-1 px-2 text-[10px] text-cyan-600 hover:bg-cyan-500/10 hover:text-cyan-700 dark:text-cyan-400 dark:hover:text-cyan-300"
                          title="Record payment"
                        >
                          <Banknote className="h-3 w-3" />
                          <span className="hidden lg:inline">Record Payment</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setView("receivables")}
                          className="h-6 w-6 text-muted-foreground hover:bg-accent hover:text-foreground"
                          aria-label="View receivable"
                          title="View"
                        >
                          <Eye className="h-3 w-3" />
                        </Button>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <Money amount={ar.amount - ar.paidAmount} className="text-sm" />
                        <StatusBadge variant={arApStatusVariant(ar.status)} dot={false}>
                          {ar.status === "OVERDUE" ? `Overdue ${Math.abs(due)}d` : ar.status.replace("_", " ")}
                        </StatusBadge>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <ArrowUpRight className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              Outstanding Payables
            </CardTitle>
            <CardDescription className="text-xs">
              {fmt(data.kpis.outstandingAP)} across {data.apList.length} bills
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="max-h-64 space-y-1 overflow-y-auto scrollbar-thin pr-1">
              {data.apList.length === 0 ? (
                <div className="flex h-24 items-center justify-center text-xs text-muted-foreground">
                  No outstanding payables
                </div>
              ) : (
                data.apList.map((ap) => {
                  const due = daysUntil(ap.dueDate);
                  return (
                    <div
                      key={ap.id}
                      className="group flex items-center gap-3 rounded-lg border border-border px-3 py-2 transition-colors hover:bg-accent/40"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{ap.vendor?.name ?? "—"}</p>
                        <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Clock className="h-2.5 w-2.5" />
                          {ap.billNumber ?? "—"} · due {formatDate(ap.dueDate)}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setView("payables")}
                          className="h-6 gap-1 px-2 text-[10px] text-amber-600 hover:bg-amber-500/10 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300"
                          title="Pay bill"
                        >
                          <Banknote className="h-3 w-3" />
                          <span className="hidden lg:inline">Pay</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setView("payables")}
                          className="h-6 w-6 text-muted-foreground hover:bg-accent hover:text-foreground"
                          aria-label="View payable"
                          title="View"
                        >
                          <Eye className="h-3 w-3" />
                        </Button>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <Money amount={ap.amount - ap.paidAmount} className="text-sm" />
                        <StatusBadge variant={arApStatusVariant(ap.status)} dot={false}>
                          {ap.status === "OVERDUE" ? `Overdue ${Math.abs(due)}d` : ap.status.replace("_", " ")}
                        </StatusBadge>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      )}

      {/* Savings Goals + Income trend */}
      <div className="grid gap-4 lg:grid-cols-2">
        {visibility.savingsGoals && data.savingsGoals && data.savingsGoals.length > 0 && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Target className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                  Savings Goals
                </CardTitle>
                <CardDescription className="text-xs">
                  {fmt(data.savingsGoals.reduce((s, g) => s + g.savedAmount, 0))} saved of {fmt(data.savingsGoals.reduce((s, g) => s + g.targetAmount, 0))}
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="pt-2">
              <div className="space-y-3">
                {data.savingsGoals.slice(0, 4).map((g) => {
                  const pct = Math.min(100, (g.savedAmount / g.targetAmount) * 100);
                  return (
                    <div key={g.id}>
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span className="font-medium truncate">{g.name}</span>
                        <span className="tabular text-muted-foreground shrink-0 ml-2">{pct.toFixed(0)}%</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${pct}%`, backgroundColor: g.color ?? "var(--primary)" }}
                          />
                        </div>
                        <span className="text-[10px] tabular text-muted-foreground shrink-0">
                          {fmt(g.savedAmount, { compact: true })}/{fmt(g.targetAmount, { compact: true })}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {visibility.incomeTrend && (
        <Card className={data.savingsGoals && data.savingsGoals.length > 0 ? "" : "lg:col-span-2"}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Income Trend</CardTitle>
            <CardDescription className="text-xs">Monthly income, last 6 months</CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <IncomeTrendChart data={data.incomeByMonth} />
          </CardContent>
        </Card>
        )}
      </div>

      {/* Cash Flow Forecast */}
      <ForecastWidget />
    </div>
  );
}

// ---------------------------------------------------------------------------
// KPI card
// ---------------------------------------------------------------------------

function KpiCard({
  label,
  value,
  icon: Icon,
  accent,
  subtitle,
  trend,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  accent: "emerald" | "cyan" | "rose" | "violet";
  subtitle?: string;
  trend?: { dir: "up" | "down"; text: string };
}) {
  const { currency } = useCurrency();
  const accentMap = {
    emerald: "from-emerald-500/15 to-emerald-500/0 text-emerald-600 dark:text-emerald-400",
    cyan: "from-cyan-500/15 to-cyan-500/0 text-cyan-600 dark:text-cyan-400",
    rose: "from-rose-500/15 to-rose-500/0 text-rose-600 dark:text-rose-400",
    violet: "from-violet-500/15 to-violet-500/0 text-violet-600 dark:text-violet-400",
  };
  return (
    <Card className="relative overflow-hidden">
      <div className={cn("pointer-events-none absolute inset-0 bg-gradient-to-br opacity-60", accentMap[accent])} />
      <CardContent className="relative p-4 sm:p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {label}
            </p>
            <p className="mt-1 text-lg font-semibold tabular tracking-tight sm:text-xl lg:text-2xl whitespace-nowrap">
              <span className="break-words">{formatMoney(value, currency, { compact: value > 99999 })}</span>
            </p>
            {subtitle && <p className="mt-0.5 text-[11px] text-muted-foreground truncate">{subtitle}</p>}
            {trend && (
              <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                {trend.dir === "up" ? (
                  <ArrowUpRight className="h-3 w-3 text-emerald-500" />
                ) : (
                  <ArrowDownRight className="h-3 w-3 text-rose-500" />
                )}
                {trend.text}
              </p>
            )}
          </div>
          <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-card shadow-sm ring-1 ring-border sm:h-10 sm:w-10", accentMap[accent].split(" ").slice(-2).join(" "))}>
            <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function MiniStat({
  label,
  value,
  icon: Icon,
  tone,
  subtitle,
  isPercent = false,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  tone: "emerald" | "cyan" | "amber" | "rose" | "violet";
  subtitle?: string;
  isPercent?: boolean;
}) {
  const { currency } = useCurrency();
  const toneMap = {
    emerald: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10",
    cyan: "text-cyan-600 dark:text-cyan-400 bg-cyan-500/10",
    amber: "text-amber-600 dark:text-amber-400 bg-amber-500/10",
    rose: "text-rose-600 dark:text-rose-400 bg-rose-500/10",
    violet: "text-violet-600 dark:text-violet-400 bg-violet-500/10",
  };
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-3 sm:p-4">
        <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", toneMap[tone])}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="text-sm font-semibold tabular sm:text-base">
            {isPercent ? `${value.toFixed(0)}%` : formatMoney(value, currency, { compact: value > 999999 })}
          </p>
          {subtitle && <p className="text-[10px] text-muted-foreground">{subtitle}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function DashboardSkeleton() {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-80 rounded-xl lg:col-span-2" />
        <Skeleton className="h-80 rounded-xl" />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-64 rounded-xl lg:col-span-2" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-72 rounded-xl" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
    </div>
  );
}
