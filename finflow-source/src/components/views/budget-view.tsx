"use client";

import * as React from "react";
import {
  Plus,
  Pencil,
  RefreshCw,
  CalendarDays,
  PiggyBank,
  Receipt,
  Sparkles,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Money } from "@/components/money";
import { BudgetDonut } from "@/components/charts";
import { FormDialog, type Field } from "@/components/forms/form-dialog";
import { useBudget, useCreate, qk, useDashboard } from "@/hooks/use-finance";
import { useUI } from "@/hooks/use-ui";
import { useCurrency } from "@/hooks/use-currency";
import { formatMoney } from "@/lib/currency";
import { toast } from "sonner";
import { monthKey, cn } from "@/lib/utils";
import type { BudgetType } from "@/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const BUDGET_FIELDS: Field[] = [
  {
    name: "month",
    label: "Month",
    type: "text",
    placeholder: "2025-11",
    required: true,
    hint: "Format: YYYY-MM",
    colSpan: 2,
  },
  {
    name: "income",
    label: "Take-home income",
    type: "number",
    required: true,
    placeholder: "0.00",
    colSpan: 2,
  },
  { name: "needsPct", label: "Needs %", type: "number", defaultValue: 50, min: 0, max: 100 },
  { name: "wantsPct", label: "Wants %", type: "number", defaultValue: 30, min: 0, max: 100 },
  {
    name: "savingsPct",
    label: "Savings %",
    type: "number",
    defaultValue: 20,
    min: 0,
    max: 100,
    hint: "Must sum to 100%",
    colSpan: 2,
  },
  { name: "notes", label: "Notes", type: "textarea", colSpan: 2, placeholder: "Optional notes" },
];

type AllocationKey = Extract<BudgetType, "NEED" | "WANT" | "SAVINGS">;

const ALLOCATION_META: Record<
  AllocationKey,
  { label: string; defaultPct: number; ring: string; bar: string; text: string; soft: string }
> = {
  NEED: {
    label: "Needs",
    defaultPct: 50,
    ring: "bg-emerald-500",
    bar: "bg-emerald-500",
    text: "text-emerald-600 dark:text-emerald-400",
    soft: "bg-emerald-500/10",
  },
  WANT: {
    label: "Wants",
    defaultPct: 30,
    ring: "bg-amber-500",
    bar: "bg-amber-500",
    text: "text-amber-600 dark:text-amber-400",
    soft: "bg-amber-500/10",
  },
  SAVINGS: {
    label: "Savings",
    defaultPct: 20,
    ring: "bg-cyan-500",
    bar: "bg-cyan-500",
    text: "text-cyan-600 dark:text-cyan-400",
    soft: "bg-cyan-500/10",
  },
};

function longMonthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  if (!y || !m) return key;
  return new Date(y, m - 1, 1).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });
}

export function BudgetView() {
  const { data: dash, isLoading: dashLoading } = useDashboard();
  const { data: budgets, isLoading: budgetsLoading, refetch } = useBudget();
  const { pendingForm, consumeForm } = useUI();
  const { currency } = useCurrency();
  const fmt = (amount: number, opts?: { compact?: boolean; sign?: boolean }) =>
    formatMoney(amount, currency, opts ?? {});
  const [open, setOpen] = React.useState(false);
  const [values, setValues] = React.useState<Record<string, unknown>>({});

  const create = useCreate("/api/budget", [qk.budget, qk.dashboard]);

  const currentMonth = monthKey(new Date());
  const currentBudget = dash?.monthlyBudget ?? null;
  const budgetSplit = dash?.budgetSplit ?? [];

  const openEditCurrent = React.useCallback(() => {
    setValues({
      month: currentBudget?.month ?? currentMonth,
      income: currentBudget?.income ?? dash?.kpis.monthlyIncome ?? 0,
      needsPct: currentBudget?.needsPct ?? 50,
      wantsPct: currentBudget?.wantsPct ?? 30,
      savingsPct: currentBudget?.savingsPct ?? 20,
      notes: currentBudget?.notes ?? "",
    });
    setOpen(true);
  }, [currentBudget, currentMonth, dash?.kpis.monthlyIncome]);

  React.useEffect(() => {
    const f = consumeForm();
    if (f === "budget") openEditCurrent();
  }, [pendingForm]);

  const handleSubmit = async () => {
    if (!values.month) return toast.error("Month is required");
    if (!/^\d{4}-\d{2}$/.test(String(values.month))) {
      return toast.error("Month must be in YYYY-MM format");
    }
    const sum =
      Number(values.needsPct ?? 0) +
      Number(values.wantsPct ?? 0) +
      Number(values.savingsPct ?? 0);
    if (Math.abs(sum - 100) > 0.01) {
      return toast.error("Needs + Wants + Savings must equal 100%");
    }
    await create.mutateAsync(values);
    toast.success("Budget saved");
    setOpen(false);
  };

  if (dashLoading || budgetsLoading) return <BudgetSkeleton />;

  const donutData = budgetSplit.map((b) => ({
    name: b.name,
    value: b.value,
    pct: b.pct,
    spent: b.spent,
  }));

  const recentBudgets = (budgets ?? []).slice(0, 6);

  const income = currentBudget?.income ?? dash?.kpis.monthlyIncome ?? 0;
  const totalAllocated = budgetSplit.reduce((s, b) => s + b.value, 0);
  const totalSpent = budgetSplit.reduce((s, b) => s + b.spent, 0);

  return (
    <div className="space-y-4">
      {/* Current month budget hero */}
      <Card className="relative overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500" />
        <CardContent className="p-5">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-emerald-500" />
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Current Month Budget
                </p>
              </div>
              <h2 className="mt-1 text-xl font-semibold">{longMonthLabel(currentMonth)}</h2>
              <p className="mt-1 text-xs text-muted-foreground">Take-home income</p>
              <p className="text-3xl font-semibold tabular text-emerald-600 dark:text-emerald-400">
                {fmt(income)}
              </p>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button size="sm" className="gap-1.5" onClick={openEditCurrent}>
                  <Pencil className="h-3.5 w-3.5" />
                  {currentBudget ? "Edit Budget" : "Set Budget"}
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => refetch()}>
                  <RefreshCw className="h-3.5 w-3.5" /> Refresh
                </Button>
                {currentBudget ? (
                  <span className="text-[11px] text-muted-foreground">
                    Split {currentBudget.needsPct}/{currentBudget.wantsPct}/{currentBudget.savingsPct}
                  </span>
                ) : (
                  <span className="text-[11px] text-amber-600 dark:text-amber-400">
                    Using defaults 50/30/20
                  </span>
                )}
              </div>
            </div>

            <div className="w-full max-w-[280px] shrink-0">
              <BudgetDonut data={donutData} />
              <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-md bg-emerald-500/10 px-2 py-1.5">
                  <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Alloc</p>
                  <p className="text-[11px] font-semibold tabular">
                    {fmt(totalAllocated, { compact: true })}
                  </p>
                </div>
                <div className="rounded-md bg-amber-500/10 px-2 py-1.5">
                  <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Spent</p>
                  <p className="text-[11px] font-semibold tabular">
                    {fmt(totalSpent, { compact: true })}
                  </p>
                </div>
                <div className="rounded-md bg-cyan-500/10 px-2 py-1.5">
                  <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Left</p>
                  <p className="text-[11px] font-semibold tabular">
                    {fmt(totalAllocated - totalSpent, { compact: true })}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Allocation cards */}
      <div className="grid gap-3 sm:grid-cols-3">
        {(["NEED", "WANT", "SAVINGS"] as AllocationKey[]).map((key) => {
          const meta = ALLOCATION_META[key];
          const split = budgetSplit.find((b) => b.name === key);
          const allocated = split?.value ?? 0;
          const spent = split?.spent ?? 0;
          const remaining = allocated - spent;
          const usedPct = allocated > 0 ? Math.min(100, (spent / allocated) * 100) : 0;
          const over = spent > allocated && allocated > 0;
          return (
            <Card key={key} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg", meta.soft)}>
                      <span className={cn("h-2.5 w-2.5 rounded-full", meta.ring)} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{meta.label}</p>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        {meta.defaultPct}% default
                      </p>
                    </div>
                  </div>
                  <p className={cn("text-xs font-semibold tabular", over ? "text-rose-500" : meta.text)}>
                    {usedPct.toFixed(0)}%
                  </p>
                </div>

                <div className="mt-3 space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Allocated</span>
                    <span className="tabular font-medium">{fmt(allocated)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Spent</span>
                    <span className="tabular font-medium">{fmt(spent)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Remaining</span>
                    <span
                      className={cn(
                        "tabular font-semibold",
                        remaining < 0 ? "text-rose-500" : meta.text,
                      )}
                    >
                      {fmt(remaining)}
                    </span>
                  </div>
                </div>

                <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn("h-full rounded-full transition-all", over ? "bg-rose-500" : meta.bar)}
                    style={{ width: `${Math.min(100, usedPct)}%` }}
                  />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Budget vs Actuals — last 6 months */}
      <Card>
        <CardContent className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <Receipt className="h-4 w-4 text-emerald-500" />
                Budget vs Actuals
              </h3>
              <p className="text-xs text-muted-foreground">
                Last {recentBudgets.length || "0"} budgeted month(s)
              </p>
            </div>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={openEditCurrent}>
              <Plus className="h-3.5 w-3.5" /> New Budget
            </Button>
          </div>

          {recentBudgets.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Month</TableHead>
                  <TableHead className="text-right">Income</TableHead>
                  <TableHead className="text-right">Needs %</TableHead>
                  <TableHead className="text-right">Wants %</TableHead>
                  <TableHead className="text-right">Savings %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentBudgets.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-medium">{longMonthLabel(b.month)}</TableCell>
                    <TableCell className="text-right tabular">{fmt(b.income)}</TableCell>
                    <TableCell className="text-right tabular text-emerald-600 dark:text-emerald-400">
                      {b.needsPct}%
                    </TableCell>
                    <TableCell className="text-right tabular text-amber-600 dark:text-amber-400">
                      {b.wantsPct}%
                    </TableCell>
                    <TableCell className="text-right tabular text-cyan-600 dark:text-cyan-400">
                      {b.savingsPct}%
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500">
                <PiggyBank className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-semibold">No budgets saved yet</p>
                <p className="text-xs text-muted-foreground">
                  Set your first monthly budget to start tracking the 50/30/20 rule.
                </p>
              </div>
              <Button size="sm" className="gap-1.5" onClick={openEditCurrent}>
                <Sparkles className="h-3.5 w-3.5" /> Set Current Month Budget
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <FormDialog
        open={open}
        onOpenChange={setOpen}
        title={currentBudget ? "Edit Budget" : "Set Budget"}
        description={
          currentBudget
            ? `Update ${longMonthLabel(currentBudget.month)} budget. Saving upserts the record for this month.`
            : "Define your monthly take-home income and the 50/30/20 split between Needs, Wants and Savings."
        }
        fields={BUDGET_FIELDS}
        values={values}
        onValuesChange={setValues}
        onSubmit={handleSubmit}
        isPending={create.isPending}
        submitLabel={currentBudget ? "Save changes" : "Save budget"}
        size="md"
      />
    </div>
  );
}

function BudgetSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-64 rounded-xl" />
      <div className="grid gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-52 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-72 rounded-xl" />
    </div>
  );
}
