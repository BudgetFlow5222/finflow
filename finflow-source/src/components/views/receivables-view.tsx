"use client";

import * as React from "react";
import {
  RefreshCw,
  Banknote,
  MoreHorizontal,
  Clock,
  FileText,
  AlertTriangle,
  Eye,
  Loader2,
} from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Money } from "@/components/money";
import { StatusBadge, arApStatusVariant } from "@/components/status-badge";
import { EmptyState } from "@/components/app/empty-state";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAR, useAccounts, qk } from "@/hooks/use-finance";
import { useCurrency } from "@/hooks/use-currency";
import { formatMoney } from "@/lib/currency";
import { toast } from "sonner";
import {
  formatDate,
  daysUntil,
  initials,
  cn,
} from "@/lib/utils";
import type { AccountsReceivable, Account, Invoice, Customer } from "@/types";
import { InvoicePreviewDialog } from "@/components/views/invoice-preview-dialog";

const FILTERS = [
  { value: "ALL", label: "All" },
  { value: "OUTSTANDING", label: "Outstanding" },
  { value: "PARTIALLY_PAID", label: "Partial" },
  { value: "OVERDUE", label: "Overdue" },
];

const todayStr = () => new Date().toISOString().slice(0, 10);

export function ReceivablesView() {
  const { data: ar, isLoading, refetch } = useAR();
  const { data: accounts } = useAccounts();
  const qc = useQueryClient();
  const { currency } = useCurrency();
  const fmt = (amount: number, opts?: { compact?: boolean; sign?: boolean }) =>
    formatMoney(amount, currency, opts ?? {});

  const [filter, setFilter] = React.useState("ALL");
  const [payOpen, setPayOpen] = React.useState(false);
  const [payTarget, setPayTarget] = React.useState<AccountsReceivable | null>(null);
  const [payAmount, setPayAmount] = React.useState(0);
  const [payAccountId, setPayAccountId] = React.useState("");
  const [payDate, setPayDate] = React.useState(todayStr());

  // Preview dialog state
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [previewTarget, setPreviewTarget] = React.useState<(Invoice & { customer?: Customer }) | null>(null);

  const openPreview = (r: AccountsReceivable) => {
    if (!r.invoice) return;
    setPreviewTarget({ ...r.invoice, customer: r.customer });
    setPreviewOpen(true);
  };

  const payMutation = useMutation({
    mutationFn: async ({ id, body }: { id: string; body: Record<string, unknown> }) => {
      const res = await fetch(`/api/invoices/${id}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string })?.error ?? `Payment failed (${res.status})`);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.ar });
      qc.invalidateQueries({ queryKey: qk.dashboard });
      qc.invalidateQueries({ queryKey: qk.invoices });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openPay = (r: AccountsReceivable) => {
    setPayTarget(r);
    setPayAmount(Math.max(0, r.amount - r.paidAmount));
    setPayAccountId(accounts?.find((a) => a.status === "ACTIVE")?.id ?? "");
    setPayDate(todayStr());
    setPayOpen(true);
  };

  const handlePay = async () => {
    if (!payTarget) return;
    if (!payAccountId) return toast.error("Select a payment account");
    if (!(payAmount > 0)) return toast.error("Amount must be positive");
    try {
      await payMutation.mutateAsync({
        id: payTarget.invoiceId,
        body: { amount: Number(payAmount), accountId: payAccountId, date: payDate },
      });
      toast.success("Payment recorded");
      setPayOpen(false);
    } catch {
      /* handled */
    }
  };

  // Computed KPIs
  const totalOutstanding = ar?.filter((r) => r.status !== "PAID")
    .reduce((s, r) => s + (r.amount - r.paidAmount), 0) ?? 0;
  const overdueAmount = ar?.filter((r) => r.status === "OVERDUE")
    .reduce((s, r) => s + (r.amount - r.paidAmount), 0) ?? 0;
  const now = new Date();
  const weekFromNow = new Date(now.getTime() + 7 * 86400000);
  const dueThisWeek = ar?.filter(
    (r) => r.status !== "PAID" && r.status !== "OVERDUE" &&
      new Date(r.dueDate) >= now && new Date(r.dueDate) <= weekFromNow,
  ).length ?? 0;

  const filtered = React.useMemo(() => {
    if (!ar) return [];
    if (filter === "ALL") return ar;
    return ar.filter((r) => r.status === filter);
  }, [ar, filter]);

  if (isLoading) return <ReceivablesSkeleton />;

  return (
    <div className="space-y-4">
      {/* Summary strip */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Total Outstanding
              </p>
              <Clock className="h-3.5 w-3.5 text-cyan-500" />
            </div>
            <p className="mt-1 text-2xl font-semibold tabular text-cyan-600 dark:text-cyan-400">
              {fmt(totalOutstanding)}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">awaiting customer payment</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Overdue Amount
              </p>
              <AlertTriangle className="h-3.5 w-3.5 text-rose-500" />
            </div>
            <p className="mt-1 text-2xl font-semibold tabular text-rose-600 dark:text-rose-400">
              {fmt(overdueAmount)}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">past their due date</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Due This Week
              </p>
              <FileText className="h-3.5 w-3.5 text-cyan-500" />
            </div>
            <p className="mt-1 text-2xl font-semibold tabular">{dueThisWeek}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">invoices due within 7 days</p>
          </CardContent>
        </Card>
      </div>

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">Accounts Receivable</h2>
          <p className="text-xs text-muted-foreground">
            Auto-generated from invoices — record payments to clear balances
          </p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => refetch()}>
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </Button>
      </div>

      {/* Filter tabs */}
      <Tabs value={filter} onValueChange={setFilter}>
        <TabsList className="h-8 w-fit">
          {FILTERS.map((f) => (
            <TabsTrigger key={f.value} value={f.value} className="px-2 py-0.5 text-xs">
              {f.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Table */}
      {ar && ar.length > 0 ? (
        <div className="rounded-lg border bg-card">
          <div className="max-h-[600px] overflow-auto scrollbar-thin">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-card">
                <TableRow>
                  <TableHead className="pl-3">Invoice #</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Issued</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="py-8 text-center text-xs text-muted-foreground">
                      No receivables match this filter.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((r) => {
                    const balance = r.amount - r.paidAmount;
                    const dueIn = daysUntil(r.dueDate);
                    const isOverdue = r.status === "OVERDUE" || (balance > 0 && dueIn < 0);
                    return (
                      <TableRow
                        key={r.id}
                        className={cn(
                          "group transition-colors",
                          isOverdue && "bg-red-500/5 hover:bg-red-500/10",
                          r.status === "PAID" && "opacity-60 hover:opacity-100",
                        )}
                      >
                        <TableCell className="pl-3 font-mono text-xs font-medium">
                          {r.invoice?.number ?? "—"}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Avatar className="h-6 w-6">
                              <AvatarFallback className="bg-cyan-500/10 text-[10px] font-semibold text-cyan-600 dark:text-cyan-300">
                                {initials(r.customer?.name ?? "?")}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="truncate text-xs font-medium">
                                {r.customer?.name ?? "Unknown"}
                              </p>
                              {r.customer?.company && (
                                <p className="truncate text-[10px] text-muted-foreground">
                                  {r.customer.company}
                                </p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {r.invoice ? formatDate(r.invoice.issueDate) : "—"}
                        </TableCell>
                        <TableCell className="text-xs">
                          <span className={cn(isOverdue && "text-destructive font-medium")}>
                            {formatDate(r.dueDate)}
                          </span>
                          <span
                            className={cn(
                              "ml-1 text-[10px]",
                              isOverdue ? "text-destructive" : "text-muted-foreground",
                            )}
                          >
                            ({dueIn >= 0 ? `${dueIn}d` : `${Math.abs(dueIn)}d ago`})
                          </span>
                        </TableCell>
                        <TableCell className="text-right text-xs tabular">
                          {fmt(r.amount)}
                        </TableCell>
                        <TableCell className="text-right text-xs tabular text-emerald-600 dark:text-emerald-400">
                          {fmt(r.paidAmount)}
                        </TableCell>
                        <TableCell className="text-right text-xs tabular font-medium">
                          {balance > 0 ? <Money amount={balance} /> : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell>
                          <StatusBadge variant={arApStatusVariant(r.status)}>
                            {r.status.replace(/_/g, " ")}
                          </StatusBadge>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100"
                              >
                                <MoreHorizontal className="h-3.5 w-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {r.invoice && (
                                <DropdownMenuItem onClick={() => openPreview(r)}>
                                  <Eye className="mr-2 h-3.5 w-3.5" /> View Invoice
                                </DropdownMenuItem>
                              )}
                              {r.status !== "PAID" && (
                                <DropdownMenuItem onClick={() => openPay(r)}>
                                  <Banknote className="mr-2 h-3.5 w-3.5" /> Record Payment
                                </DropdownMenuItem>
                              )}
                              {r.status === "PAID" && (
                                <span className="px-2 py-1.5 text-xs text-muted-foreground">
                                  Fully paid — no actions
                                </span>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      ) : (
        <EmptyState
          icon={Clock}
          title="No receivables"
          description="Receivables are created automatically when you issue an invoice. Create an invoice to get started."
        />
      )}

      {/* Payment Dialog */}
      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Banknote className="h-4 w-4 text-cyan-500" />
              Record Payment — {payTarget?.invoice?.number ?? ""}
            </DialogTitle>
            <DialogDescription>
              {payTarget
                ? `Balance due: ${fmt(payTarget.amount - payTarget.paidAmount)}`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-1">
            <div className="col-span-2">
              <Label className="mb-1 block text-xs font-medium">
                Amount<span className="ml-0.5 text-destructive">*</span>
              </Label>
              <Input
                type="number"
                className="h-9 tabular"
                value={payAmount}
                min={0}
                step={0.01}
                onChange={(e) => setPayAmount(Number(e.target.value))}
              />
            </div>
            <div className="col-span-2">
              <Label className="mb-1 block text-xs font-medium">
                Payment Account<span className="ml-0.5 text-destructive">*</span>
              </Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={payAccountId}
                onChange={(e) => setPayAccountId(e.target.value)}
              >
                <option value="">— Select account —</option>
                {(accounts ?? []).map((a: Account) => (
                  <option key={a.id} value={a.id}>
                    {a.name} · {a.type} ({fmt(a.currentBalance)})
                  </option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              <Label className="mb-1 block text-xs font-medium">Date</Label>
              <Input
                type="date"
                className="h-9"
                value={payDate}
                onChange={(e) => setPayDate(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="pt-2">
            <Button variant="ghost" onClick={() => setPayOpen(false)} disabled={payMutation.isPending}>
              Cancel
            </Button>
            <Button
              onClick={handlePay}
              disabled={payMutation.isPending}
              className="gap-1.5 bg-cyan-600 hover:bg-cyan-700"
            >
              {payMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Record Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invoice Preview Dialog */}
      <InvoicePreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        invoice={previewTarget}
        onRecordPayment={(inv) => {
          const r = ar?.find((x) => x.invoiceId === inv.id);
          if (r) openPay(r);
        }}
      />
    </div>
  );
}

function ReceivablesSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-9 w-72 rounded-lg" />
      <Skeleton className="h-10 w-full rounded-lg" />
      <Skeleton className="h-[400px] w-full rounded-lg" />
    </div>
  );
}
