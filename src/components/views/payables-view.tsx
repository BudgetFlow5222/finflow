"use client";

import * as React from "react";
import {
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  MoreHorizontal,
  Receipt,
  Banknote,
  Clock,
  AlertTriangle,
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
import { FormDialog, type Field } from "@/components/forms/form-dialog";
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
import {
  useAP,
  useVendors,
  useAccounts,
  useCreate,
  useUpdate,
  useDelete,
  qk,
} from "@/hooks/use-finance";
import { useCurrency } from "@/hooks/use-currency";
import { formatMoney } from "@/lib/currency";
import { toast } from "sonner";
import {
  formatDate,
  daysUntil,
  initials,
  cn,
} from "@/lib/utils";
import type { AccountsPayable, Account, Vendor } from "@/types";
import { CountdownBadge } from "@/components/views/countdown-badge";

const FILTERS = [
  { value: "ALL", label: "All" },
  { value: "OUTSTANDING", label: "Outstanding" },
  { value: "PARTIALLY_PAID", label: "Partial" },
  { value: "OVERDUE", label: "Overdue" },
  { value: "PAID", label: "Paid" },
];

const BILL_FIELDS: Field[] = [
  {
    name: "vendorId",
    label: "Vendor",
    type: "select",
    required: true,
    options: [], // populated dynamically below — we instead use a custom select in onValuesChange handler
    hint: "Choose the vendor you owe",
  },
  { name: "billNumber", label: "Bill number", type: "text", placeholder: "Optional vendor bill #", colSpan: 1 },
  { name: "amount", label: "Amount", type: "number", required: true, min: 0, step: 0.01, placeholder: "0.00", colSpan: 1 },
  { name: "paidAmount", label: "Already paid", type: "number", min: 0, step: 0.01, defaultValue: 0, placeholder: "0.00", colSpan: 1 },
  { name: "issueDate", label: "Issue date", type: "date", required: true, colSpan: 1 },
  { name: "dueDate", label: "Due date", type: "date", required: true, colSpan: 1 },
  { name: "notes", label: "Notes", type: "textarea", colSpan: 2, placeholder: "Optional notes" },
];

const todayStr = () => new Date().toISOString().slice(0, 10);
const plusDaysStr = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

export function PayablesView() {
  const { data: ap, isLoading, refetch } = useAP();
  const { data: vendors } = useVendors();
  const { data: accounts } = useAccounts();
  const qc = useQueryClient();
  const { currency } = useCurrency();
  const fmt = (amount: number, opts?: { compact?: boolean; sign?: boolean }) =>
    formatMoney(amount, currency, opts ?? {});

  const [filter, setFilter] = React.useState("ALL");
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<AccountsPayable | null>(null);
  const [values, setValues] = React.useState<Record<string, unknown>>({});

  // Payment dialog state
  const [payOpen, setPayOpen] = React.useState(false);
  const [payTarget, setPayTarget] = React.useState<AccountsPayable | null>(null);
  const [payAmount, setPayAmount] = React.useState(0);
  const [payAccountId, setPayAccountId] = React.useState("");
  const [payDate, setPayDate] = React.useState(todayStr());

  const create = useCreate<Record<string, unknown>, AccountsPayable>(
    "/api/ap",
    [qk.ap, qk.dashboard],
  );
  const update = useUpdate<Record<string, unknown>, AccountsPayable>(
    (id) => `/api/ap/${id}`,
    [qk.ap, qk.dashboard],
  );
  const remove = useDelete((id) => `/api/ap/${id}`, [qk.ap, qk.dashboard]);

  const payMutation = useMutation({
    mutationFn: async ({ id, body }: { id: string; body: Record<string, unknown> }) => {
      const res = await fetch(`/api/ap/${id}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string })?.error ?? `Payment failed (${res.status})`);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.ap });
      qc.invalidateQueries({ queryKey: qk.dashboard });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openNew = () => {
    setEditing(null);
    setValues({
      vendorId: vendors?.[0]?.id ?? "",
      billNumber: "",
      amount: 0,
      paidAmount: 0,
      issueDate: todayStr(),
      dueDate: plusDaysStr(30),
      notes: "",
    });
    setOpen(true);
  };

  const openEdit = (b: AccountsPayable) => {
    setEditing(b);
    setValues({
      vendorId: b.vendorId,
      billNumber: b.billNumber ?? "",
      amount: b.amount,
      paidAmount: b.paidAmount,
      issueDate: b.issueDate.slice(0, 10),
      dueDate: b.dueDate.slice(0, 10),
      notes: b.notes ?? "",
    });
    setOpen(true);
  };

  const openPay = (b: AccountsPayable) => {
    setPayTarget(b);
    setPayAmount(Math.max(0, b.amount - b.paidAmount));
    setPayAccountId(accounts?.find((a) => a.status === "ACTIVE")?.id ?? "");
    setPayDate(todayStr());
    setPayOpen(true);
  };

  const handleSubmit = async () => {
    if (!values.vendorId) return toast.error("Select a vendor");
    if (!(Number(values.amount) > 0)) return toast.error("Amount must be positive");
    const body = {
      vendorId: values.vendorId as string,
      billNumber: (values.billNumber as string) || null,
      amount: Number(values.amount),
      paidAmount: Number(values.paidAmount) || 0,
      issueDate: values.issueDate as string,
      dueDate: values.dueDate as string,
      notes: (values.notes as string) || null,
    };
    try {
      if (editing) {
        await update.mutateAsync({ id: editing.id, body });
        toast.success("Bill updated");
      } else {
        await create.mutateAsync(body);
        toast.success("Bill created");
      }
      setOpen(false);
    } catch {
      /* handled by hook */
    }
  };

  const handlePay = async () => {
    if (!payTarget) return;
    if (!payAccountId) return toast.error("Select a payment account");
    if (!(payAmount > 0)) return toast.error("Amount must be positive");
    try {
      await payMutation.mutateAsync({
        id: payTarget.id,
        body: { amount: Number(payAmount), accountId: payAccountId, date: payDate },
      });
      toast.success("Payment recorded");
      setPayOpen(false);
    } catch {
      /* handled */
    }
  };

  const handleDelete = async (b: AccountsPayable) => {
    if (!confirm(`Delete bill${b.billNumber ? ` “${b.billNumber}”` : ""}? This cannot be undone.`)) return;
    await remove.mutateAsync(b.id);
    toast.success("Bill deleted");
  };

  // Computed KPIs
  const totalOutstanding = ap?.filter((r) => r.status !== "PAID")
    .reduce((s, r) => s + (r.amount - r.paidAmount), 0) ?? 0;
  const overdueAmount = ap?.filter((r) => r.status === "OVERDUE")
    .reduce((s, r) => s + (r.amount - r.paidAmount), 0) ?? 0;
  const now = new Date();
  const weekFromNow = new Date(now.getTime() + 7 * 86400000);
  const dueThisWeek = ap?.filter(
    (r) => r.status !== "PAID" && r.status !== "OVERDUE" &&
      new Date(r.dueDate) >= now && new Date(r.dueDate) <= weekFromNow,
  ).length ?? 0;

  const filtered = React.useMemo(() => {
    if (!ap) return [];
    if (filter === "ALL") return ap;
    return ap.filter((r) => r.status === filter);
  }, [ap, filter]);

  if (isLoading) return <PayablesSkeleton />;

  // We render the FormDialog fields ourselves except for the vendorId select — but FormDialog
  // uses static options. So we inject vendor options dynamically into the field definition.
  const fields: Field[] = BILL_FIELDS.map((f) =>
    f.name === "vendorId"
      ? {
          ...f,
          options: (vendors ?? []).map((v: Vendor) => ({
            label: v.name + (v.company ? ` · ${v.company}` : ""),
            value: v.id,
          })),
        }
      : f,
  );

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
              <Clock className="h-3.5 w-3.5 text-amber-500" />
            </div>
            <p className="mt-1 text-2xl font-semibold tabular text-amber-600 dark:text-amber-400">
              {fmt(totalOutstanding)}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">awaiting vendor payment</p>
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
              <Receipt className="h-3.5 w-3.5 text-amber-500" />
            </div>
            <p className="mt-1 text-2xl font-semibold tabular">{dueThisWeek}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">bills due within 7 days</p>
          </CardContent>
        </Card>
      </div>

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">Accounts Payable</h2>
          <p className="text-xs text-muted-foreground">Track bills owed to vendors and suppliers</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => refetch()}>
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
          <Button size="sm" className="gap-1.5 bg-amber-600 hover:bg-amber-700" onClick={openNew}>
            <Plus className="h-3.5 w-3.5" /> New Bill
          </Button>
        </div>
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
      {ap && ap.length > 0 ? (
        <div className="rounded-lg border bg-card">
          <div className="max-h-[600px] overflow-auto scrollbar-thin">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-card">
                <TableRow>
                  <TableHead className="pl-3">Bill #</TableHead>
                  <TableHead>Vendor</TableHead>
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
                      No bills match this filter.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((b) => {
                    const balance = b.amount - b.paidAmount;
                    const dueIn = daysUntil(b.dueDate);
                    const isOverdue = b.status === "OVERDUE" || (balance > 0 && dueIn < 0);
                    return (
                      <TableRow
                        key={b.id}
                        className={cn(
                          "group transition-colors",
                          isOverdue && "bg-red-500/5 hover:bg-red-500/10",
                          b.status === "PAID" && "opacity-60 hover:opacity-100",
                        )}
                      >
                        <TableCell className="pl-3 font-mono text-xs font-medium">
                          {b.billNumber || "—"}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Avatar className="h-6 w-6">
                              <AvatarFallback className="bg-amber-500/10 text-[10px] font-semibold text-amber-600 dark:text-amber-300">
                                {initials(b.vendor?.name ?? "?")}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="truncate text-xs font-medium">
                                {b.vendor?.name ?? "Unknown"}
                              </p>
                              {b.vendor?.company && (
                                <p className="truncate text-[10px] text-muted-foreground">
                                  {b.vendor.company}
                                </p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatDate(b.issueDate)}
                        </TableCell>
                        <TableCell className="text-xs">
                          <div className="flex flex-col gap-0.5">
                            <span className={cn(isOverdue && "text-destructive font-medium")}>
                              {formatDate(b.dueDate)}
                            </span>
                            <CountdownBadge dueDate={b.dueDate} status={b.status} />
                          </div>
                        </TableCell>
                        <TableCell className="text-right text-xs tabular">
                          {fmt(b.amount)}
                        </TableCell>
                        <TableCell className="text-right text-xs tabular text-emerald-600 dark:text-emerald-400">
                          {fmt(b.paidAmount)}
                        </TableCell>
                        <TableCell className="text-right text-xs tabular font-medium">
                          {balance > 0 ? <Money amount={balance} /> : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell>
                          <StatusBadge variant={arApStatusVariant(b.status)}>
                            {b.status.replace(/_/g, " ")}
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
                              {b.status !== "PAID" && (
                                <DropdownMenuItem onClick={() => openPay(b)}>
                                  <Banknote className="mr-2 h-3.5 w-3.5" /> Record Payment
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem onClick={() => openEdit(b)}>
                                <Pencil className="mr-2 h-3.5 w-3.5" /> Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => handleDelete(b)}
                              >
                                <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
                              </DropdownMenuItem>
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
          icon={Receipt}
          title="No bills yet"
          description="Add bills owed to your vendors to keep track of upcoming payments and due dates."
          actionLabel="New Bill"
          onAction={openNew}
        />
      )}

      {/* Create/Edit Bill Dialog (uses FormDialog) */}
      <FormDialog
        open={open}
        onOpenChange={setOpen}
        title={editing ? "Edit Bill" : "New Bill"}
        description={
          editing
            ? "Update the bill details. Status is derived from amount, paid and due date."
            : "Record a bill owed to a vendor. Status (outstanding / partial / overdue) is derived automatically."
        }
        fields={fields}
        values={values}
        onValuesChange={setValues}
        onSubmit={handleSubmit}
        isPending={create.isPending || update.isPending}
        submitLabel={editing ? "Save changes" : "Create bill"}
        size="lg"
      />

      {/* Payment Dialog */}
      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Banknote className="h-4 w-4 text-amber-500" />
              Record Payment{payTarget?.billNumber ? ` — ${payTarget.billNumber}` : ""}
            </DialogTitle>
            <DialogDescription>
              {payTarget
                ? `Balance due: ${fmt(payTarget.amount - payTarget.paidAmount)} to ${payTarget.vendor?.name ?? "vendor"}`
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
              className="gap-1.5 bg-amber-600 hover:bg-amber-700"
            >
              {payMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Record Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PayablesSkeleton() {
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
