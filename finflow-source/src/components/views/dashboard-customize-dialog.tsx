"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  HeartPulse,
  Bell,
  Wallet,
  TrendingUp,
  BarChart3,
  PieChart,
  CreditCard,
  FileText,
  Receipt,
  ArrowDownRight,
  ArrowUpRight,
  Target,
  RotateCcw,
  Eye,
  EyeOff,
} from "lucide-react";
import { useDashboardSettings, type WidgetKey } from "@/hooks/use-dashboard-settings";
import { cn } from "@/lib/utils";

const WIDGET_GROUPS: { group: string; widgets: { key: WidgetKey; label: string; description: string; icon: React.ComponentType<{ className?: string }> }[] }[] = [
  {
    group: "Overview",
    widgets: [
      { key: "healthScore", label: "Financial Health Score", description: "Composite score with grade and recommendations", icon: HeartPulse },
      { key: "budgetAlerts", label: "Budget Alerts", description: "Real-time threshold and overdue alerts", icon: Bell },
      { key: "kpiCards", label: "KPI Cards", description: "Balance, income, expenses, net cash flow", icon: Wallet },
      { key: "secondaryKpis", label: "Secondary KPIs", description: "AR/AP, budget used, net worth", icon: TrendingUp },
    ],
  },
  {
    group: "Charts",
    widgets: [
      { key: "cashFlowChart", label: "Cash Flow Chart", description: "6-month income vs expense area chart", icon: BarChart3 },
      { key: "budgetDonut", label: "50/30/20 Budget Donut", description: "Budget allocation donut chart", icon: PieChart },
      { key: "expenseBreakdown", label: "Expense Breakdown", description: "Spending by category bar chart", icon: BarChart3 },
      { key: "incomeTrend", label: "Income Trend", description: "Monthly income bar chart", icon: TrendingUp },
    ],
  },
  {
    group: "Lists & Widgets",
    widgets: [
      { key: "accountBalances", label: "Account Balances", description: "Active account balance cards", icon: CreditCard },
      { key: "recentInvoices", label: "Recent Invoices", description: "Latest issued invoices list", icon: FileText },
      { key: "recentExpenses", label: "Recent Expenses", description: "Latest recorded spending", icon: Receipt },
      { key: "arApWidgets", label: "Receivables & Payables", description: "Outstanding AR and AP widgets", icon: ArrowDownRight },
      { key: "savingsGoals", label: "Savings Goals", description: "Goal progress bars", icon: Target },
    ],
  },
];

export function DashboardCustomizeDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { visibility, toggleWidget, setAll, reset } = useDashboardSettings();

  const visibleCount = Object.values(visibility).filter(Boolean).length;
  const totalCount = Object.keys(visibility).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto scrollbar-thin">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Eye className="h-5 w-5 text-primary" />
            Customize Dashboard
          </DialogTitle>
          <DialogDescription>
            Toggle widgets on or off. Your preferences are saved automatically.
          </DialogDescription>
        </DialogHeader>

        {/* Summary bar */}
        <div className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2 text-xs">
          <span className="text-muted-foreground">
            {visibleCount} of {totalCount} widgets visible
          </span>
          <div className="flex gap-1.5">
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setAll(true)}>
              <Eye className="mr-1 h-3 w-3" /> Show all
            </Button>
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setAll(false)}>
              <EyeOff className="mr-1 h-3 w-3" /> Hide all
            </Button>
          </div>
        </div>

        {/* Widget groups */}
        <div className="space-y-4 py-2">
          {WIDGET_GROUPS.map((group) => (
            <div key={group.group}>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {group.group}
              </p>
              <div className="space-y-1">
                {group.widgets.map((widget) => {
                  const isVisible = visibility[widget.key];
                  return (
                    <div
                      key={widget.key}
                      className={cn(
                        "flex items-center gap-3 rounded-lg border border-border p-3 transition-colors",
                        isVisible ? "bg-card" : "bg-muted/20 opacity-60",
                      )}
                    >
                      <div className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                        isVisible ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
                      )}>
                        <widget.icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium leading-tight">{widget.label}</p>
                        <p className="text-[11px] text-muted-foreground leading-tight">{widget.description}</p>
                      </div>
                      <Switch
                        checked={isVisible}
                        onCheckedChange={() => toggleWidget(widget.key)}
                        aria-label={`Toggle ${widget.label}`}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <Separator />

        <DialogFooter>
          <Button variant="ghost" size="sm" className="gap-1.5" onClick={reset}>
            <RotateCcw className="h-3.5 w-3.5" /> Reset to defaults
          </Button>
          <Button onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
