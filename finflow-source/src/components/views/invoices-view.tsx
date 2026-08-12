"use client";

import * as React from "react";
import {
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  MoreHorizontal,
  FileText,
  Banknote,
  Clock,
  CheckCircle2,
  Download,
} from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Money } from "@/components/money";
import { StatusBadge, invoiceStatusVariant } from "@/components/status-badge";
import { EmptyState } from "@/components/app/empty-state";
import { LineItemsEditor, Loader2, type LineItem } from "@/components/forms/line-items-editor";
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
  useInvoices,
  useCustomers,
  useAccounts,
  useCreate,
  useUpdate,
  useDelete,
  qk,
} from "@/hooks/use-finance";
import { useUI } from "@/hooks/use-ui";
import { useCurrency } from "@/hooks/use-currency";
import { formatMoney } from "@/lib/currency";
import { toast } from "sonner";
import {
  formatDate,
  daysUntil,
  initials,
  generateInvoiceNumber,
  cn,
} from "@/lib/utils";
import { exportToCSV } from "@/lib/export";
import type { Invoice, InvoiceStatus, Customer, Account } from "@/types";
import { InvoicePreviewDialog } from "@/components/views/invoice-preview-dialog";
import { Eye } from "lucide-react";

// Status filter tabs
const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "DRAFT", label: "Draft" },
  { value: "SENT", label: "Sent" },
  { value: "PAID", label: "Paid" },
  { value: "PARTIALLY_PAID", label: "Partial" },
  { value: "OVERDUE", label: "Overdue" },
];

const STATUS_OPTIONS: { label: string; value: InvoiceStatus }[] = [
  { label: "Draft", value: "DRAFT" },
  { label: "Sent", value: "SENT" },
  { label: "Paid", value: "PAID" },
  { label: "Partially Paid", value: "PARTIALLY_PAID" },
  { label: "Overdue", value: "OVERDUE" },
  { label: "Cancelled", value: "CANCELLED" },
];

const todayStr = () => new Date().toISOString().slice(0, 10);
const plusDaysStr = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

function emptyItem(): LineItem {
  return { id: crypto.randomUUID(), description: "", quantity: 1, rate: 0 };
}

export function InvoicesView() {
  const { data: invoices, isLoading, refetch } = useInvoices();
  const { data: customers } = useCustomers();
  const { data: accounts } = useAccounts();
  const { pendingForm, consumeForm } = useUI();
  const qc = useQueryClient();
  const { currency } = useCurrency();
  const fmt = (amount: number, opts?: { compact?: boolean; sign?: boolean }) =>
    formatMoney(amount, currency, opts ?? {});

  const [filter, setFilter] = React.useState("ALL");
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Invoice | null>(null);

  // Form state
  const [number, setNumber] = React.useState("");
  const [customerId, setCustomerId] = React.useState("");
  const [issueDate, setIssueDate] = React.useState(todayStr());
  const [dueDate, setDueDate] = React.useState(plusDaysStr(14));
  const [taxRate, setTaxRate] = React.useState(18);
  const [discount, setDiscount] = React.useState(0);
  const [status, setStatus] = React.useState<InvoiceStatus>("DRAFT");
  const [notes, setNotes] = React.useState("");
  const [items, setItems] = React.useState<LineItem[]>([emptyItem()]);

  // Payment dialog state
  const [payOpen, setPayOpen] = React.useState(false);
  const [payTarget, setPayTarget] = React.useState<Invoice | null>(null);
  const [payAmount, setPayAmount] = React.useState(0);
  const [payAccountId, setPayAccountId] = React.useState("");
  const [payDate, setPayDate] = React.useState(todayStr());

  // Preview dialog state
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [previewTarget, setPreviewTarget] = React.useState<Invoice | null>(null);

  const openPreview = (inv: Invoice) => {
    setPreviewTarget(inv);
    setPreviewOpen(true);
  };

  const create = useCreate<Record<string, unknown>, Invoice>(
    "/api/invoices",
    [qk.invoices, qk.dashboard, qk.ar],
  );
  const update = useUpdate<Record<string, unknown>, Invoice>(
    (id) => `/api/invoices/${id}`,
    [qk.invoices, qk.dashboard, qk.ar],
  );
  const remove = useDelete((id) => `/api/invoices/${id}`, [
    qk.invoices,
    qk.dashboard,
    qk.ar,
  ]);

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
      qc.invalidateQueries({ queryKey: qk.invoices });
      qc.invalidateQueries({ queryKey: qk.dashboard });
      qc.invalidateQueries({ queryKey: qk.ar });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  React.useEffect(() => {
    const f = consumeForm();
    if (f === "invoice") openNew();
  }, [pendingForm]);

  const openNew = () => {
    setEditing(null);
    setNumber(generateInvoiceNumber(invoices?.length ?? 0));
    setCustomerId(customers?.[0]?.id ?? "");
    setIssueDate(todayStr());
    setDueDate(plusDaysStr(14));
    setTaxRate(18);
    setDiscount(0);
    setStatus("DRAFT");
    setNotes("");
    setItems([emptyItem()]);
    setOpen(true);
  };

  const openEdit = (inv: Invoice) => {
    setEditing(inv);
    setNumber(inv.number);
    setCustomerId(inv.customerId);
    setIssueDate(inv.issueDate.slice(0, 10));
    setDueDate(inv.dueDate.slice(0, 10));
    setTaxRate(inv.taxRate);
    setDiscount(inv.discount);
    setStatus(inv.status);
    setNotes(inv.notes ?? "");
    setItems(
      (inv.items ?? []).length > 0
        ? (inv.items ?? []).map((it) => ({
            id: it.id,
            description: it.description,
            quantity: it.quantity,
            rate: it.rate,
          }))
        : [emptyItem()],
    );
    setOpen(true);
  };

  const openPay = (inv: Invoice) => {
    setPayTarget(inv);
    setPayAmount(Math.max(0, inv.total - inv.paidAmount));
    setPayAccountId(accounts?.find((a) => a.status === "ACTIVE")?.id ?? "");
    setPayDate(todayStr());
    setPayOpen(true);
  };

  const handleSubmit = async () => {
    if (!customerId) return toast.error("Select a customer");
    const cleanItems = items
      .filter((it) => it.description.trim() !== "" || it.quantity > 0 || it.rate > 0)
      .map((it) => ({
        description: it.description.trim() || "Untitled",
        quantity: Number(it.quantity) || 0,
        rate: Number(it.rate) || 0,
      }));
    if (cleanItems.length === 0) return toast.error("Add at least one line item");
    const body = {
      number: number.trim(),
      customerId,
      issueDate,
      dueDate,
      taxRate: Number(taxRate) || 0,
      discount: Number(discount) || 0,
      status,
      notes: notes.trim() || null,
      items: cleanItems,
    };
    try {
      if (editing) {
        await update.mutateAsync({ id: editing.id, body });
        toast.success("Invoice updated");
      } else {
        await create.mutateAsync(body);
        toast.success("Invoice created");
      }
      setOpen(false);
    } catch {
      /* error toast handled by hook */
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

  const handleDelete = async (inv: Invoice) => {
    if (!confirm(`Delete invoice “${inv.number}”? This cannot be undone.`)) return;
    await remove.mutateAsync(inv.id);
    toast.success("Invoice deleted");
  };

  const handleExport = () => {
    if (!invoices || invoices.length === 0) return;
    // Add a derived `balance` column = total − paidAmount so the format
    // function (which only receives the cell value, not the row) can render it.
    const rows = invoices.map((inv) => ({ ...inv, balance: inv.total - inv.paidAmount }));
    exportToCSV(`finflow-invoices-${new Date().toISOString().slice(0, 10)}.csv`, rows, [
      { key: "number", label: "Number" },
      { key: "customerId", label: "Customer", format: (v) => customers?.find((c) => c.id === (v as string))?.name ?? "" },
      { key: "issueDate", label: "Issue Date", format: (v) => formatDate(v as string) },
      { key: "dueDate", label: "Due Date", format: (v) => formatDate(v as string) },
      { key: "subtotal", label: "Subtotal", format: (v) => fmt(v as number) },
      { key: "taxRate", label: "Tax Rate", format: (v) => `${v as number}%` },
      { key: "tax", label: "Tax", format: (v) => fmt(v as number) },
      { key: "discount", label: "Discount", format: (v) => fmt(v as number) },
      { key: "total", label: "Total", format: (v) => fmt(v as number) },
      { key: "paidAmount", label: "Paid", format: (v) => fmt(v as number) },
      { key: "balance", label: "Balance", format: (v) => fmt(v as number) },
      { key: "status", label: "Status" },
      { key: "notes", label: "Notes" },
    ]);
    toast.success(`Exported ${invoices.length} invoices to CSV`);
  };

  // Computed KPIs
  const totalOutstanding =
    invoices?.filter((i) => i.status !== "PAID" && i.status !== "CANCELLED")
      .reduce((s, i) => s + (i.total - i.paidAmount), 0) ?? 0;
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const totalPaidThisMonth =
    invoices?.filter((i) => i.status === "PAID" && new Date(i.issueDate) >= startOfMonth)
      .reduce((s, i) => s + i.paidAmount, 0) ?? 0;
  const overdueCount = invoices?.filter((i) => i.status === "OVERDUE").length ?? 0;

  const filtered = React.useMemo(() => {
    if (!invoices) return [];
    if (filter === "ALL") return invoices;
    return invoices.filter((i) => i.status === filter);
  }, [invoices, filter]);

  if (isLoading) return <InvoicesSkeleton />;

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
              <Clock className="h-3.5 w-3.5 text-violet-500" />
            </div>
            <p className="mt-1 text-2xl font-semibold tabular text-violet-600 dark:text-violet-400">
              {fmt(totalOutstanding)}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">across all open invoices</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Paid This Month
              </p>
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
            </div>
            <p className="mt-1 text-2xl font-semibold tabular text-emerald-600 dark:text-emerald-400">
              {fmt(totalPaidThisMonth)}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">received this month</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Overdue Invoices
              </p>
              <FileText className="h-3.5 w-3.5 text-rose-500" />
            </div>
            <p className="mt-1 text-2xl font-semibold tabular">{overdueCount}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">needs immediate attention</p>
          </CardContent>
        </Card>
      </div>

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">Invoices</h2>
          <p className="text-xs text-muted-foreground">Bill customers and track payments</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => refetch()}>
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={handleExport}
            disabled={!invoices || invoices.length === 0}
          >
            <Download className="h-3.5 w-3.5" /> Export
          </Button>
          <Button size="sm" className="gap-1.5 bg-violet-600 hover:bg-violet-700" onClick={openNew}>
            <Plus className="h-3.5 w-3.5" /> New Invoice
          </Button>
        </div>
      </div>

      {/* Filter tabs */}
      <Tabs value={filter} onValueChange={setFilter}>
        <TabsList className="h-8 w-fit">
          {STATUS_FILTERS.map((f) => (
            <TabsTrigger key={f.value} value={f.value} className="px-2 py-0.5 text-xs">
              {f.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Table */}
      {invoices && invoices.length > 0 ? (
        <div className="rounded-lg border bg-card">
          <div className="max-h-[600px] overflow-auto scrollbar-thin">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-card">
                <TableRow>
                  <TableHead className="pl-3">Number</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Issued</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead className="text-right">Total</TableHead>
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
                      No invoices match this filter.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((inv) => {
                    const balance = inv.total - inv.paidAmount;
                    const dueIn = daysUntil(inv.dueDate);
                    const isOverdue = inv.status === "OVERDUE" || (balance > 0 && dueIn < 0);
                    return (
                      <TableRow
                        key={inv.id}
                        className={cn(
                          "group transition-colors",
                          isOverdue && "bg-red-500/5 hover:bg-red-500/10",
                          inv.status === "PAID" && "opacity-60 hover:opacity-100",
                        )}
                      >
                        <TableCell className="pl-3 font-mono text-xs font-medium">
                          <button
                            onClick={() => openPreview(inv)}
                            className="text-violet-600 hover:text-violet-700 hover:underline dark:text-violet-400 dark:hover:text-violet-300 transition-colors"
                            title="View invoice"
                          >
                            {inv.number}
                          </button>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Avatar className="h-6 w-6">
                              <AvatarFallback className="bg-violet-500/10 text-[10px] font-semibold text-violet-600 dark:text-violet-300">
                                {initials(inv.customer?.name ?? "?")}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="truncate text-xs font-medium">
                                {inv.customer?.name ?? "Unknown"}
                              </p>
                              {inv.customer?.company && (
                                <p className="truncate text-[10px] text-muted-foreground">
                                  {inv.customer.company}
                                </p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatDate(inv.issueDate)}
                        </TableCell>
                        <TableCell className="text-xs">
                          <span className={cn(isOverdue && "text-destructive font-medium")}>
                            {formatDate(inv.dueDate)}
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
                          {fmt(inv.total)}
                        </TableCell>
                        <TableCell className="text-right text-xs tabular text-emerald-600 dark:text-emerald-400">
                          {fmt(inv.paidAmount)}
                        </TableCell>
                        <TableCell className="text-right text-xs tabular font-medium">
                          {balance > 0 ? (
                            <Money amount={balance} />
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <StatusBadge variant={invoiceStatusVariant(inv.status)}>
                            {inv.status.replace(/_/g, " ")}
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
                              <DropdownMenuItem onClick={() => openPreview(inv)}>
                                <Eye className="mr-2 h-3.5 w-3.5" /> View / Preview
                              </DropdownMenuItem>
                              {inv.status !== "PAID" && inv.status !== "CANCELLED" && (
                                <DropdownMenuItem onClick={() => openPay(inv)}>
                                  <Banknote className="mr-2 h-3.5 w-3.5" /> Record Payment
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem onClick={() => openEdit(inv)}>
                                <Pencil className="mr-2 h-3.5 w-3.5" /> Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => handleDelete(inv)}
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
          icon={FileText}
          title="No invoices yet"
          description="Create your first invoice to bill customers and track receivables automatically."
          actionLabel="New Invoice"
          onAction={openNew}
        />
      )}

      {/* New/Edit Invoice Dialog (custom — uses LineItemsEditor) */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto scrollbar-thin">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4 text-violet-500" />
              {editing ? "Edit Invoice" : "New Invoice"}
            </DialogTitle>
            <DialogDescription>
              {editing
                ? "Update invoice details, line items will be replaced."
                : "Create a new invoice for a customer. AR is synced automatically."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3 py-1">
            <div className="col-span-2 sm:col-span-1">
              <Label className="mb-1 block text-xs font-medium">Invoice Number</Label>
              <Input
                className="h-9 font-mono text-sm"
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                placeholder="INV-YYYY-XXXX (auto if blank)"
              />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <Label className="mb-1 block text-xs font-medium">
                Customer<span className="ml-0.5 text-destructive">*</span>
              </Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
              >
                <option value="">— Select customer —</option>
                {customers?.map((c: Customer) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.company ? ` · ${c.company}` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-span-1">
              <Label className="mb-1 block text-xs font-medium">Issue Date</Label>
              <Input
                type="date"
                className="h-9 text-sm"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
              />
            </div>
            <div className="col-span-1">
              <Label className="mb-1 block text-xs font-medium">Due Date</Label>
              <Input
                type="date"
                className="h-9 text-sm"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
            <div className="col-span-1">
              <Label className="mb-1 block text-xs font-medium">Tax Rate (%)</Label>
              <Input
                type="number"
                className="h-9 text-sm tabular"
                value={taxRate}
                min={0}
                max={100}
                step={0.5}
                onChange={(e) => setTaxRate(Number(e.target.value))}
              />
            </div>
            <div className="col-span-1">
              <Label className="mb-1 block text-xs font-medium">Discount</Label>
              <Input
                type="number"
                className="h-9 text-sm tabular"
                value={discount}
                min={0}
                step={0.01}
                onChange={(e) => setDiscount(Number(e.target.value))}
              />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <Label className="mb-1 block text-xs font-medium">Status</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={status}
                onChange={(e) => setStatus(e.target.value as InvoiceStatus)}
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              <Label className="mb-1 block text-xs font-medium">Notes</Label>
              <textarea
                className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="Optional notes for the customer"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
            <div className="col-span-2">
              <LineItemsEditor
                items={items}
                onChange={setItems}
                taxRate={Number(taxRate) || 0}
                discount={Number(discount) || 0}
              />
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={create.isPending || update.isPending}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={create.isPending || update.isPending}
              className="gap-1.5 bg-violet-600 hover:bg-violet-700"
            >
              {(create.isPending || update.isPending) && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {editing ? "Save changes" : "Create invoice"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment Dialog */}
      <PaymentDialog
        open={payOpen}
        onOpenChange={setPayOpen}
        title={`Record Payment — ${payTarget?.number ?? ""}`}
        description={
          payTarget
            ? `Balance due: ${fmt(payTarget.total - payTarget.paidAmount)}`
            : ""
        }
        accounts={accounts ?? []}
        amount={payAmount}
        onAmountChange={setPayAmount}
        accountId={payAccountId}
        onAccountChange={setPayAccountId}
        date={payDate}
        onDateChange={setPayDate}
        onSubmit={handlePay}
        isPending={payMutation.isPending}
      />

      {/* Invoice Preview / Print Dialog */}
      <InvoicePreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        invoice={previewTarget}
        onRecordPayment={(inv) => openPay(inv)}
        onEdit={(inv) => openEdit(inv)}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Reusable Payment Dialog (used by invoices & AR views)
// ---------------------------------------------------------------------------

export interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description?: string;
  accounts: Account[];
  amount: number;
  onAmountChange: (n: number) => void;
  accountId: string;
  onAccountChange: (v: string) => void;
  date: string;
  onDateChange: (v: string) => void;
  onSubmit: () => void;
  isPending?: boolean;
}

export function PaymentDialog({
  open,
  onOpenChange,
  title,
  description,
  accounts,
  amount,
  onAmountChange,
  accountId,
  onAccountChange,
  date,
  onDateChange,
  onSubmit,
  isPending,
}: PaymentDialogProps) {
  const { currency } = useCurrency();
  const fmt = (amount: number, opts?: { compact?: boolean; sign?: boolean }) =>
    formatMoney(amount, currency, opts ?? {});
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Banknote className="h-4 w-4 text-violet-500" />
            {title}
          </DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 py-1">
          <div className="col-span-2">
            <Label className="mb-1 block text-xs font-medium">
              Amount<span className="ml-0.5 text-destructive">*</span>
            </Label>
            <Input
              type="number"
              className="h-9 tabular"
              value={amount}
              min={0}
              step={0.01}
              onChange={(e) => onAmountChange(Number(e.target.value))}
            />
          </div>
          <div className="col-span-2">
            <Label className="mb-1 block text-xs font-medium">
              Payment Account<span className="ml-0.5 text-destructive">*</span>
            </Label>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={accountId}
              onChange={(e) => onAccountChange(e.target.value)}
            >
              <option value="">— Select account —</option>
              {accounts.map((a) => (
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
              value={date}
              onChange={(e) => onDateChange(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter className="pt-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={onSubmit} disabled={isPending} className="gap-1.5 bg-violet-600 hover:bg-violet-700">
            {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Record Payment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function InvoicesSkeleton() {
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
