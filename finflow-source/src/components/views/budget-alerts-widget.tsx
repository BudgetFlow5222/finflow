"use client";

import * as React from "react";
import {
  Bell,
  CheckCircle2,
  X,
  AlertTriangle,
  AlertOctagon,
  Info,
  Sparkles,
  PiggyBank,
  ArrowLeftRight,
  FileText,
  Receipt,
  Target,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useBudgetAlerts } from "@/hooks/use-finance";
import { useUI } from "@/hooks/use-ui";
import { cn, formatCurrency } from "@/lib/utils";
import type { ViewKey } from "@/components/app/sidebar";
import type { BudgetAlert, BudgetAlertSeverity } from "@/types";

const MAX_VISIBLE_BEFORE_SCROLL = 4;

export function BudgetAlertsWidget() {
  const { data: alerts, isLoading } = useBudgetAlerts();
  // Track locally dismissed alert ids — purely client-side, no API needed.
  const [dismissed, setDismissed] = React.useState<Set<string>>(new Set());

  // Reset dismissed state whenever the underlying alert set changes
  // meaningfully (e.g. new alerts appear after a refetch). We key off the
  // sorted list of ids so stale dismissals don't hide brand-new alerts.
  const alertIdKey = React.useMemo(
    () => (alerts ?? []).map((a) => a.id).join("|"),
    [alerts],
  );
  React.useEffect(() => {
    setDismissed(new Set());
  }, [alertIdKey]);

  const visible = React.useMemo(
    () => (alerts ?? []).filter((a) => !dismissed.has(a.id)),
    [alerts, dismissed],
  );

  const activeCount = visible.length;
  const dangerCount = visible.filter((a) => a.severity === "danger").length;

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-4">
          <Skeleton className="h-32 rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="relative overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10">
            <Bell className={cn("h-4 w-4", dangerCount > 0 ? "text-rose-600 dark:text-rose-400" : "text-primary")} />
          </div>
          <div>
            <CardTitle className="text-sm font-semibold">Budget Alerts</CardTitle>
            <CardDescription className="text-xs">
              {activeCount > 0
                ? `${activeCount} active · refreshed every 30s`
                : "Live monitoring · refreshed every 30s"}
            </CardDescription>
          </div>
        </div>
        {activeCount > 0 && (
          <Badge
            variant={dangerCount > 0 ? "destructive" : "secondary"}
            className="tabular"
          >
            {activeCount}
          </Badge>
        )}
      </CardHeader>

      <CardContent className="pt-1">
        {activeCount === 0 ? (
          <EmptyAlertsState />
        ) : (
          <div
            className={cn(
              "-mx-1 space-y-2 px-1",
              activeCount > MAX_VISIBLE_BEFORE_SCROLL && "max-h-80 overflow-y-auto pr-2 scrollbar-thin",
            )}
          >
            {visible.map((alert) => (
              <AlertRow
                key={alert.id}
                alert={alert}
                onDismiss={() =>
                  setDismissed((prev) => {
                    const next = new Set(prev);
                    next.add(alert.id);
                    return next;
                  })
                }
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function AlertRow({ alert, onDismiss }: { alert: BudgetAlert; onDismiss: () => void }) {
  const styles = getSeverityStyles(alert.severity);
  const Icon = styles.icon;
  const showProgress =
    alert.type === "BUDGET_THRESHOLD" &&
    typeof alert.percentage === "number" &&
    typeof alert.currentAmount === "number" &&
    typeof alert.budgetAmount === "number";

  return (
    <div
      className={cn(
        "group relative rounded-lg border-l-4 bg-muted/30 p-2.5 pr-9 transition-colors",
        styles.border,
        styles.bg,
      )}
    >
      <div className="flex items-start gap-2">
        <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", styles.iconColor)} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-xs font-semibold leading-tight">
              {alert.title}
            </p>
          </div>
          <p className="mt-0.5 text-[11px] leading-tight text-muted-foreground line-clamp-2">
            {alert.message}
          </p>

          {showProgress && (
            <div className="mt-2">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={cn("h-full rounded-full transition-all duration-700", styles.bar)}
                  style={{ width: `${Math.min(100, alert.percentage ?? 0)}%` }}
                />
              </div>
              <div className="mt-1 flex items-center justify-between text-[10px] tabular text-muted-foreground">
                <span>
                  {formatCurrency(alert.currentAmount ?? 0)}{" "}
                  <span className="text-muted-foreground/70">/ {formatCurrency(alert.budgetAmount ?? 0)}</span>
                </span>
                <span className={cn("font-semibold", styles.iconColor)}>
                  {(alert.percentage ?? 0).toFixed(0)}%
                </span>
              </div>
            </div>
          )}

          {alert.action && (
            <p className="mt-1.5 flex items-start gap-1 text-[10px] leading-tight text-muted-foreground">
              <Sparkles className="mt-px h-3 w-3 shrink-0 text-amber-500" />
              <span className="line-clamp-1">{alert.action}</span>
            </p>
          )}

          <AlertQuickActions alert={alert} />
        </div>
      </div>

      <Button
        variant="ghost"
        size="icon"
        className="absolute right-1 top-1 h-6 w-6 text-muted-foreground opacity-0 transition-opacity hover:bg-background/80 group-hover:opacity-100"
        onClick={onDismiss}
        aria-label="Dismiss alert"
        title="Dismiss"
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Quick action button — lets the user jump straight to the relevant view
// (budget, transfers, receivables, payables, goals) without leaving the
// dashboard. INFO/success alerts get no quick action.
// ---------------------------------------------------------------------------

interface AlertActionConfig {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  view: ViewKey;
  className: string;
}

function getAlertActions(alert: BudgetAlert): AlertActionConfig[] {
  // Shared color tokens per action category
  const emerald =
    "text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 hover:bg-emerald-500/10";
  const amber =
    "text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300 hover:bg-amber-500/10";
  const rose =
    "text-rose-600 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300 hover:bg-rose-500/10";
  const cyan =
    "text-cyan-600 hover:text-cyan-700 dark:text-cyan-400 dark:hover:text-cyan-300 hover:bg-cyan-500/10";

  switch (alert.type) {
    case "BUDGET_THRESHOLD":
      return [
        {
          label: "View Budget",
          icon: PiggyBank,
          view: "budget",
          className: emerald,
        },
      ];
    case "OVERDRAFT":
      return [
        {
          label: "Transfer",
          icon: ArrowLeftRight,
          view: "transfers",
          className: amber,
        },
      ];
    case "OVERDUE": {
      // The alert message lists both overdue invoices and bills — surface
      // a quick action for each kind that's actually mentioned.
      const msg = alert.message.toLowerCase();
      const actions: AlertActionConfig[] = [];
      if (msg.includes("invoice")) {
        actions.push({
          label: "View Invoices",
          icon: FileText,
          view: "receivables",
          className: rose,
        });
      }
      if (msg.includes("bill")) {
        actions.push({
          label: "View Bills",
          icon: Receipt,
          view: "payables",
          className: rose,
        });
      }
      // Fallback (shouldn't happen given the API contract) — default to AR.
      if (actions.length === 0) {
        actions.push({
          label: "View Invoices",
          icon: FileText,
          view: "receivables",
          className: rose,
        });
      }
      return actions;
    }
    case "GOAL_BEHIND":
      return [
        {
          label: "View Goals",
          icon: Target,
          view: "goals",
          className: cyan,
        },
      ];
    case "INFO":
    default:
      return [];
  }
}

function AlertQuickActions({ alert }: { alert: BudgetAlert }) {
  const setView = useUI((s) => s.setView);
  const actions = getAlertActions(alert);
  if (actions.length === 0) return null;
  return (
    <div className="mt-2 flex items-center justify-end gap-1">
      {actions.map((a, i) => {
        const Icon = a.icon;
        return (
          <Button
            key={i}
            variant="ghost"
            size="sm"
            onClick={() => setView(a.view)}
            className={cn("h-6 px-2 text-[10px] gap-1", a.className)}
            title={a.label}
          >
            <Icon className="h-3 w-3" />
            {a.label}
          </Button>
        );
      })}
    </div>
  );
}

function EmptyAlertsState() {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-6 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/15">
        <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
      </div>
      <div>
        <p className="text-sm font-medium">All budgets on track</p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          No threshold, overdraft, or overdue alerts right now.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Severity styling
// ---------------------------------------------------------------------------

interface SeverityStyle {
  border: string;
  bg: string;
  iconColor: string;
  bar: string;
  icon: React.ComponentType<{ className?: string }>;
}

function getSeverityStyles(severity: BudgetAlertSeverity): SeverityStyle {
  switch (severity) {
    case "danger":
      return {
        border: "border-rose-500",
        bg: "bg-rose-500/5",
        iconColor: "text-rose-600 dark:text-rose-400",
        bar: "bg-rose-500",
        icon: AlertOctagon,
      };
    case "warning":
      return {
        border: "border-amber-500",
        bg: "bg-amber-500/5",
        iconColor: "text-amber-600 dark:text-amber-400",
        bar: "bg-amber-500",
        icon: AlertTriangle,
      };
    case "info":
      return {
        border: "border-cyan-500",
        bg: "bg-cyan-500/5",
        iconColor: "text-cyan-600 dark:text-cyan-400",
        bar: "bg-cyan-500",
        icon: Info,
      };
    case "success":
      return {
        border: "border-emerald-500",
        bg: "bg-emerald-500/5",
        iconColor: "text-emerald-600 dark:text-emerald-400",
        bar: "bg-emerald-500",
        icon: CheckCircle2,
      };
  }
}
