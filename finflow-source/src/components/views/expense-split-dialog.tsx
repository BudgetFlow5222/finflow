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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Split,
  Plus,
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Receipt,
} from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { Expense, BudgetType } from "@/types";
import { useCategories, qk } from "@/hooks/use-finance";
import { formatCurrency, formatDate, cn, round2 } from "@/lib/utils";

interface SplitRow {
  categoryId: string; // "" = uncategorized (rendered via __none__ sentinel in Select)
  amount: string;
  budgetType: BudgetType | "";
  notes: string;
}

interface ExpenseSplitDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  expense: Expense | null;
}

const BUDGET_TYPES: BudgetType[] = ["NEED", "WANT", "SAVINGS"];
// Sentinel value because Radix Select does not support empty-string values.
const NONE_SENTINEL = "__none__";

function rowAmount(r: SplitRow): number {
  const n = Number(r.amount);
  return isNaN(n) ? 0 : n;
}

export function ExpenseSplitDialog({
  open,
  onOpenChange,
  expense,
}: ExpenseSplitDialogProps) {
  const qc = useQueryClient();
  const { data: categories } = useCategories();
  const expenseCategories = (categories ?? []).filter((c) => c.type === "EXPENSE");

  const [rows, setRows] = React.useState<SplitRow[]>([]);

  // Reset / pre-fill rows whenever the dialog opens with a new expense.
  React.useEffect(() => {
    if (!open || !expense) return;
    // Default: two rows pre-split 50/50, first keeps original category.
    const half = (expense.total / 2).toFixed(2);
    setRows([
      {
        categoryId: expense.categoryId ?? "",
        amount: half,
        budgetType: expense.budgetType ?? "",
        notes: "",
      },
      {
        categoryId: "",
        amount: "",
        budgetType: expense.budgetType ?? "",
        notes: "",
      },
    ]);
  }, [open, expense]);

  const updateRow = (idx: number, patch: Partial<SplitRow>) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };

  const addRow = () => {
    setRows((prev) => [
      ...prev,
      { categoryId: "", amount: "", budgetType: "", notes: "" },
    ]);
  };

  const removeRow = (idx: number) => {
    setRows((prev) => prev.filter((_, i) => i !== idx));
  };

  // ---- Compute validation state ----
  const originalTotal = expense?.total ?? 0;
  const allocated = round2(rows.reduce((s, r) => s + rowAmount(r), 0));
  const remaining = round2(originalTotal - allocated);
  const isMatched = Math.abs(remaining) < 0.01;
  const allRowsValid =
    rows.length >= 1 && rows.every((r) => rowAmount(r) > 0);

  const mutation = useMutation({
    mutationFn: async (body: {
      splits: {
        categoryId: string | null;
        amount: number;
        budgetType: BudgetType | null;
        notes: string | null;
      }[];
    }) => {
      const res = await fetch(`/api/expenses/${expense?.id}/split`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          (data as { error?: string })?.error ?? `Failed (${res.status})`,
        );
      }
      return data as { created: Expense[] };
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: qk.expenses });
      qc.invalidateQueries({ queryKey: qk.dashboard });
      qc.invalidateQueries({ queryKey: qk.accounts });
      toast.success(`Expense split into ${data.created.length} entries`);
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleSubmit = () => {
    if (!expense || !isMatched || !allRowsValid) return;
    const splits = rows.map((r) => ({
      categoryId: r.categoryId || null,
      amount: round2(rowAmount(r)),
      budgetType: (r.budgetType || null) as BudgetType | null,
      notes: r.notes.trim() || null,
    }));
    mutation.mutate({ splits });
  };

  if (!expense) return null;

  const canSubmit = isMatched && allRowsValid && !mutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto scrollbar-thin">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Split className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            Split Expense
          </DialogTitle>
          <DialogDescription>
            Split this expense across multiple categories or amounts. The original
            will be deleted and replaced with the new entries.
          </DialogDescription>
        </DialogHeader>

        {/* Original expense summary */}
        <div className="rounded-lg border bg-muted/30 p-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Original expense
              </p>
              <p className="flex items-center gap-1.5 text-sm font-semibold">
                <Receipt className="h-3.5 w-3.5 text-rose-500" />
                <span className="truncate">
                  {expense.vendor?.name ?? "Direct expense"}
                </span>
              </p>
              <p className="text-[11px] text-muted-foreground">
                {formatDate(expense.date)} ·{" "}
                {expense.category?.name ?? "Uncategorized"} ·{" "}
                {expense.account?.name ?? "—"}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Total to allocate
              </p>
              <p className="text-lg font-bold tabular">
                {formatCurrency(expense.total)}
              </p>
            </div>
          </div>
        </div>

        {/* Split rows */}
        <div className="space-y-2">
          {rows.map((r, idx) => {
            const amountValid = rowAmount(r) > 0;
            return (
              <div key={idx} className="rounded-md border p-2">
                <div className="grid grid-cols-12 gap-2">
                  {/* Category */}
                  <div className="col-span-12 sm:col-span-5">
                    <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Category
                    </Label>
                    <Select
                      value={r.categoryId || NONE_SENTINEL}
                      onValueChange={(v) =>
                        updateRow(idx, {
                          categoryId: v === NONE_SENTINEL ? "" : v,
                        })
                      }
                    >
                      <SelectTrigger className="h-8 w-full text-xs">
                        <SelectValue placeholder="Uncategorized" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE_SENTINEL}>
                          Uncategorized
                        </SelectItem>
                        {expenseCategories.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            <span className="inline-flex items-center gap-1.5">
                              <span
                                className="inline-block h-2 w-2 rounded-full"
                                style={{
                                  backgroundColor: c.color ?? "#94a3b8",
                                }}
                              />
                              {c.name}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Amount */}
                  <div className="col-span-6 sm:col-span-3">
                    <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Amount (₹)
                    </Label>
                    <Input
                      type="number"
                      min={0}
                      step={0.01}
                      className={cn(
                        "h-8 text-xs tabular",
                        !amountValid &&
                          "border-rose-500/50 focus-visible:ring-rose-500/30",
                      )}
                      value={r.amount}
                      onChange={(e) =>
                        updateRow(idx, { amount: e.target.value })
                      }
                      placeholder="0.00"
                    />
                  </div>

                  {/* Budget type */}
                  <div className="col-span-6 sm:col-span-3">
                    <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Budget
                    </Label>
                    <Select
                      value={r.budgetType || NONE_SENTINEL}
                      onValueChange={(v) =>
                        updateRow(idx, {
                          budgetType:
                            v === NONE_SENTINEL
                              ? ""
                              : (v as BudgetType),
                        })
                      }
                    >
                      <SelectTrigger className="h-8 w-full text-xs">
                        <SelectValue placeholder="None" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE_SENTINEL}>None</SelectItem>
                        {BUDGET_TYPES.map((b) => (
                          <SelectItem key={b} value={b}>
                            {b}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Remove */}
                  <div className="col-span-12 flex items-end justify-end sm:col-span-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => removeRow(idx)}
                      disabled={rows.length === 1}
                      title="Remove split row"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Notes */}
                <Input
                  className="mt-2 h-8 text-xs"
                  value={r.notes}
                  onChange={(e) => updateRow(idx, { notes: e.target.value })}
                  placeholder="Optional notes for this split"
                />
              </div>
            );
          })}
        </div>

        {/* Add row + total indicator */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={addRow}
            className="gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" /> Add Split
          </Button>
          <div
            className={cn(
              "flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs",
              isMatched
                ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300"
                : "border-rose-500/30 bg-rose-500/5 text-rose-700 dark:text-rose-300",
            )}
          >
            {isMatched ? (
              <CheckCircle2 className="h-3.5 w-3.5" />
            ) : (
              <AlertCircle className="h-3.5 w-3.5" />
            )}
            <span className="font-medium tabular">
              {formatCurrency(allocated)} of {formatCurrency(originalTotal)}{" "}
              allocated
            </span>
            {!isMatched && (
              <span className="text-[11px] opacity-80">
                {remaining > 0
                  ? `(${formatCurrency(remaining)} left)`
                  : `(${formatCurrency(Math.abs(remaining))} over)`}
              </span>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={mutation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"
          >
            {mutation.isPending && (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            )}
            <Split className="h-3.5 w-3.5" />
            Split Expense
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
