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
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  CheckCircle2,
  AlertTriangle,
  Loader2,
  History,
  ShieldCheck,
} from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { Account, Reconciliation } from "@/types";
import { useReconciliations, qk } from "@/hooks/use-finance";
import { formatCurrency, formatDate, cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  account: Account | null;
}

export function ReconcileDialog({ open, onOpenChange, account }: Props) {
  const qc = useQueryClient();
  const { data: history } = useReconciliations(account?.id);

  const [statementBalance, setStatementBalance] = React.useState("");
  const [statementDate, setStatementDate] = React.useState(
    new Date().toISOString().slice(0, 10),
  );
  const [adjust, setAdjust] = React.useState(false);
  const [notes, setNotes] = React.useState("");

  React.useEffect(() => {
    if (open && account) {
      setStatementBalance(String(account.currentBalance));
      setStatementDate(new Date().toISOString().slice(0, 10));
      setAdjust(false);
      setNotes("");
    }
  }, [open, account]);

  const systemBalance = account?.currentBalance ?? 0;
  const statement = Number(statementBalance) || 0;
  const difference = Math.round((statement - systemBalance) * 100) / 100;
  const isMatched = Math.abs(difference) < 0.01;

  const mutation = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const res = await fetch("/api/reconcile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(
          (data as { error?: string })?.error ?? `Failed (${res.status})`,
        );
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.accounts });
      qc.invalidateQueries({ queryKey: qk.dashboard });
      qc.invalidateQueries({ queryKey: ["reconcile"] });
      qc.invalidateQueries({ queryKey: qk.sales });
      qc.invalidateQueries({ queryKey: qk.expenses });
      toast.success(
        isMatched
          ? "Account reconciled — balances match"
          : adjust
            ? "Account reconciled with adjustment"
            : "Reconciliation recorded (discrepancy)",
      );
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleSubmit = () => {
    if (!account) return;
    if (!statementBalance || isNaN(Number(statementBalance))) {
      toast.error("Enter a valid statement balance");
      return;
    }
    mutation.mutate({
      accountId: account.id,
      statementDate,
      statementBalance: Number(statementBalance),
      adjust,
      notes: notes || null,
    });
  };

  if (!account) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            Reconcile — {account.name}
          </DialogTitle>
          <DialogDescription>
            Match your system balance against your bank statement to verify accuracy.
          </DialogDescription>
        </DialogHeader>

        {/* Balance comparison */}
        <div className="space-y-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                System Balance
              </p>
              <p className="mt-1 text-lg font-semibold tabular">
                {formatCurrency(systemBalance)}
              </p>
              <p className="text-[10px] text-muted-foreground">From FinFlow records</p>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Statement Balance
              </p>
              <p className="mt-1 text-lg font-semibold tabular">
                {statement ? formatCurrency(statement) : "—"}
              </p>
              <p className="text-[10px] text-muted-foreground">From your bank statement</p>
            </div>
          </div>

          {/* Difference indicator */}
          <div
            className={cn(
              "flex items-center justify-between rounded-lg border p-3",
              isMatched
                ? "border-emerald-500/30 bg-emerald-500/5"
                : "border-amber-500/30 bg-amber-500/5",
            )}
          >
            <div className="flex items-center gap-2">
              {isMatched ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              )}
              <div>
                <p className="text-sm font-medium">
                  {isMatched ? "Balances Match" : "Discrepancy Detected"}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {isMatched
                    ? "Your records are in sync with the statement"
                    : `${difference > 0 ? "Statement is higher" : "Statement is lower"} by ${formatCurrency(Math.abs(difference))}`}
                </p>
              </div>
            </div>
            <p
              className={cn(
                "text-lg font-bold tabular",
                isMatched
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-amber-600 dark:text-amber-400",
              )}
            >
              {isMatched ? "✓" : formatCurrency(difference)}
            </p>
          </div>

          {/* Form fields */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-medium">Statement Balance (₹)</Label>
              <Input
                type="number"
                className="mt-1 h-9 tabular"
                value={statementBalance}
                onChange={(e) => setStatementBalance(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div>
              <Label className="text-xs font-medium">Statement Date</Label>
              <Input
                type="date"
                className="mt-1 h-9"
                value={statementDate}
                onChange={(e) => setStatementDate(e.target.value)}
              />
            </div>
          </div>

          {/* Auto-adjust toggle */}
          {!isMatched && (
            <div className="flex items-start gap-3 rounded-lg border border-border p-3">
              <Switch checked={adjust} onCheckedChange={setAdjust} id="adjust" />
              <div className="flex-1">
                <Label htmlFor="adjust" className="text-xs font-medium cursor-pointer">
                  Auto-adjust system balance
                </Label>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Creates an adjustment transaction to reconcile the difference ({formatCurrency(Math.abs(difference))}).
                  Use only if the difference represents an unrecorded transaction.
                </p>
              </div>
            </div>
          )}

          <div>
            <Label className="text-xs font-medium">Notes (optional)</Label>
            <Input
              className="mt-1 h-9"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Monthly statement reconciliation"
            />
          </div>

          {/* History */}
          {history && history.length > 0 && (
            <>
              <Separator className="my-2" />
              <div className="space-y-2">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                  <History className="h-3.5 w-3.5" /> Recent Reconciliations
                </p>
                <div className="max-h-32 space-y-1 overflow-y-auto scrollbar-thin">
                  {history.slice(0, 5).map((r: Reconciliation) => (
                    <div
                      key={r.id}
                      className="flex items-center justify-between rounded-md border border-border px-2.5 py-1.5 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        {r.status === "MATCHED" ? (
                          <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                        ) : (
                          <AlertTriangle className="h-3 w-3 text-amber-500" />
                        )}
                        <span className="text-muted-foreground">
                          {formatDate(r.statementDate)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="tabular text-muted-foreground">
                          {formatCurrency(r.statementBalance)}
                        </span>
                        <span
                          className={cn(
                            "rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase",
                            r.status === "MATCHED"
                              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                              : r.status === "ADJUSTED"
                                ? "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300"
                                : "bg-amber-500/15 text-amber-700 dark:text-amber-300",
                          )}
                        >
                          {r.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={mutation.isPending} className="gap-1.5">
            {mutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            <ShieldCheck className="h-3.5 w-3.5" />
            Reconcile
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
