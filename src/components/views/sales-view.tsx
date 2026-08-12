"use client";

import * as React from "react";
import {
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  MoreHorizontal,
  TrendingUp,
  ShoppingCart,
  Banknote,
  CreditCard,
  Smartphone,
  Wallet,
  Download,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Money } from "@/components/money";
import { StatusBadge } from "@/components/status-badge";
import { FormDialog, type Field } from "@/components/forms/form-dialog";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  useSales,
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
  relativeTime,
  initials,
} from "@/lib/utils";
import { exportToCSV } from "@/lib/export";
import type { Sale, PaymentMethod, TransactionStatus } from "@/types";

const PAYMENT_METHODS: PaymentMethod[] = ["CASH", "BANK", "UPI", "CARD", "WALLET"];
const SALE_STATUSES: TransactionStatus[] = ["COMPLETED", "PENDING", "REFUNDED"];

function saleStatusVariant(s: string) {
  switch (s) {
    case "COMPLETED":
      return "success" as const;
    case "PENDING":
      return "warning" as const;
    case "REFUNDED":
      return "danger" as const;
    default:
      return "neutral" as const;
  }
}

const METHOD_ICONS: Record<PaymentMethod, React.ComponentType<{ className?: string }>> = {
  CASH: Banknote,
  BANK: Wallet,
  UPI: Smartphone,
  CARD: CreditCard,
  WALLET: Smartphone,
};

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function SalesView() {
  const { data: sales, isLoading, refetch } = useSales();
  const { data: customers } = useCustomers();
  const { data: accounts } = useAccounts();
  const { pendingForm, consumeForm } = useUI();
  const { currency } = useCurrency();
  const fmt = (amount: number, opts?: { compact?: boolean; sign?: boolean }) =>
    formatMoney(amount, currency, opts ?? {});
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Sale | null>(null);
  const [values, setValues] = React.useState<Record<string, unknown>>({});

  const create = useCreate("/api/sales", [qk.sales, qk.dashboard]);
  const update = useUpdate((id) => `/api/sales/${id}`, [qk.sales, qk.dashboard]);
  const remove = useDelete((id) => `/api/sales/${id}`, [qk.sales, qk.dashboard]);

  React.useEffect(() => {
    const f = consumeForm();
    if (f === "sale") openNew();
  }, [pendingForm]);

  const fields: Field[] = React.useMemo(() => {
    const customerOptions = (customers ?? []).map((c) => ({
      label: c.company ? `${c.name} · ${c.company}` : c.name,
      value: c.id,
    }));
    const accountOptions = (accounts ?? [])
      .filter((a) => a.status === "ACTIVE")
      .map((a) => ({ label: `${a.name} · ${a.currency}`, value: a.id }));
    return [
      {
        name: "customerId",
        label: "Customer",
        type: "select",
        required: true,
        options: customerOptions,
      },
      {
        name: "accountId",
        label: "Deposit to",
        type: "select",
        required: true,
        options: accountOptions,
      },
      { name: "date", label: "Date", type: "date", required: true },
      {
        name: "amount",
        label: "Amount",
        type: "number",
        required: true,
        min: 0,
        step: 0.01,
        placeholder: "0.00",
      },
      {
        name: "tax",
        label: "Tax",
        type: "number",
        defaultValue: 0,
        min: 0,
        step: 0.01,
        placeholder: "0.00",
      },
      {
        name: "discount",
        label: "Discount",
        type: "number",
        defaultValue: 0,
        min: 0,
        step: 0.01,
        placeholder: "0.00",
      },
      {
        name: "paymentMethod",
        label: "Method",
        type: "select",
        defaultValue: "CASH",
        options: PAYMENT_METHODS.map((m) => ({ label: m, value: m })),
      },
      {
        name: "status",
        label: "Status",
        type: "select",
        defaultValue: "COMPLETED",
        options: SALE_STATUSES.map((s) => ({ label: s, value: s })),
      },
      { name: "notes", label: "Notes", type: "textarea", colSpan: 2, placeholder: "Optional notes" },
    ];
  }, [customers, accounts]);

  const statusField: Field[] = React.useMemo(
    () => [
      {
        name: "status",
        label: "Status",
        type: "select",
        required: true,
        options: SALE_STATUSES.map((s) => ({ label: s, value: s })),
        colSpan: 2,
        hint: "Completed sales credit the deposit account. Refunding reverses the credit.",
      },
    ],
    [],
  );

  const openNew = () => {
    setEditing(null);
    setValues({
      date: todayISO(),
      amount: 0,
      tax: 0,
      discount: 0,
      paymentMethod: "CASH",
      status: "COMPLETED",
    });
    setOpen(true);
  };

  const openEdit = (s: Sale) => {
    setEditing(s);
    setValues({ status: s.status });
    setOpen(true);
  };

  const handleSubmit = async () => {
    if (editing) {
      const status = (values.status as TransactionStatus) ?? editing.status;
      if (status === editing.status) {
        setOpen(false);
        return;
      }
      await update.mutateAsync({ id: editing.id, body: { status } });
      toast.success(`Sale marked ${status}`);
      setOpen(false);
      return;
    }
    if (!values.customerId) return toast.error("Customer is required");
    if (!values.accountId) return toast.error("Deposit account is required");
    const amount = Number(values.amount) || 0;
    if (amount <= 0) return toast.error("Amount must be greater than 0");
    if (!values.date) return toast.error("Date is required");

    await create.mutateAsync({
      customerId: values.customerId,
      accountId: values.accountId,
      date: values.date,
      amount,
      tax: Number(values.tax) || 0,
      discount: Number(values.discount) || 0,
      paymentMethod: (values.paymentMethod as PaymentMethod) ?? null,
      status: (values.status as TransactionStatus) ?? "COMPLETED",
      notes: (values.notes as string) ?? null,
    });
    toast.success("Sale recorded");
    setOpen(false);
  };

  const handleDelete = async (s: Sale) => {
    if (
      !confirm(
        `Delete sale of ${fmt(s.total)} to ${s.customer?.name ?? "customer"}? This cannot be undone.`,
      )
    )
      return;
    await remove.mutateAsync(s.id);
    toast.success("Sale deleted");
  };

  const handleExport = () => {
    if (!sales || sales.length === 0) return;
    exportToCSV(`finflow-sales-${new Date().toISOString().slice(0, 10)}.csv`, sales, [
      { key: "date", label: "Date", format: (v) => formatDate(v as string) },
      { key: "customerId", label: "Customer", format: (v) => customers?.find((c) => c.id === (v as string))?.name ?? "" },
      { key: "accountId", label: "Account", format: (v) => accounts?.find((a) => a.id === (v as string))?.name ?? "" },
      { key: "amount", label: "Amount", format: (v) => fmt(v as number) },
      { key: "tax", label: "Tax", format: (v) => fmt(v as number) },
      { key: "discount", label: "Discount", format: (v) => fmt(v as number) },
      { key: "total", label: "Total", format: (v) => fmt(v as number) },
      { key: "paymentMethod", label: "Method", format: (v) => (v as string) ?? "" },
      { key: "status", label: "Status", format: (v) => String(v ?? "") },
      { key: "notes", label: "Notes", format: (v) => (v as string) ?? "" },
    ]);
    toast.success(`Exported ${sales.length} sales to CSV`);
  };

  // KPIs
  const valid = (sales ?? []).filter((s) => s.status !== "REFUNDED");
  const totalSales = valid.reduce((s, x) => s + x.total, 0);
  const now = new Date();
  const thisMonthSales = valid.filter((s) => {
    const d = new Date(s.date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const thisMonthTotal = thisMonthSales.reduce((s, x) => s + x.total, 0);
  const avgSale = valid.length ? totalSales / valid.length : 0;

  if (isLoading) return <SalesSkeleton />;

  return (
    <div className="space-y-4">
      {/* Summary strip */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Total Sales
            </p>
            <p className="mt-1 text-2xl font-semibold tabular text-emerald-600 dark:text-emerald-400">
              {fmt(totalSales)}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">{sales?.length ?? 0} transactions</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              This Month
            </p>
            <p className="mt-1 text-2xl font-semibold tabular text-emerald-600 dark:text-emerald-400">
              {fmt(thisMonthTotal)}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">{thisMonthSales.length} sales this month</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Avg Sale
            </p>
            <p className="mt-1 text-2xl font-semibold tabular">{fmt(avgSale)}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">excluding refunds</p>
          </CardContent>
        </Card>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <TrendingUp className="h-4 w-4 text-emerald-500" /> Sales
          </h2>
          <p className="text-xs text-muted-foreground">Track revenue from customers</p>
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
            disabled={!sales || sales.length === 0}
          >
            <Download className="h-3.5 w-3.5" /> Export
          </Button>
          <Button size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700" onClick={openNew}>
            <Plus className="h-3.5 w-3.5" /> New Sale
          </Button>
        </div>
      </div>

      {/* Table */}
      {sales && sales.length > 0 ? (
        <div className="rounded-xl border">
          <div className="max-h-[600px] overflow-auto scrollbar-thin">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="pl-3">Date</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Tax</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-10 pr-3"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sales.map((s) => {
                  const Icon = s.paymentMethod ? METHOD_ICONS[s.paymentMethod] : null;
                  return (
                    <TableRow key={s.id}>
                      <TableCell className="pl-3">
                        <p className="text-xs font-medium">{formatDate(s.date)}</p>
                        <p className="text-[10px] text-muted-foreground">{relativeTime(s.date)}</p>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                            {initials(s.customer?.name ?? "—")}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{s.customer?.name ?? "—"}</p>
                            <p className="truncate text-[10px] text-muted-foreground">
                              {s.customer?.company ?? "—"}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="text-xs font-medium">{s.account?.name ?? "—"}</p>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          {s.account?.type}
                        </p>
                      </TableCell>
                      <TableCell className="text-right">
                        <Money amount={s.amount} className="text-sm" />
                      </TableCell>
                      <TableCell className="text-right text-xs tabular text-muted-foreground">
                        {fmt(s.tax)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Money amount={s.total} className="text-sm font-semibold" />
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1.5 text-xs">
                          {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground" />}
                          {s.paymentMethod ?? "—"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <StatusBadge variant={saleStatusVariant(s.status)}>{s.status}</StatusBadge>
                      </TableCell>
                      <TableCell className="pr-3">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7">
                              <MoreHorizontal className="h-3.5 w-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEdit(s)}>
                              <Pencil className="mr-2 h-3.5 w-3.5" /> Change status
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(s)}>
                              <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500">
            <ShoppingCart className="h-7 w-7" />
          </div>
          <div>
            <p className="text-sm font-semibold">No sales yet</p>
            <p className="text-xs text-muted-foreground">Record your first sale to start tracking revenue.</p>
          </div>
          <Button size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700" onClick={openNew}>
            <Plus className="h-3.5 w-3.5" /> New Sale
          </Button>
        </div>
      )}

      <FormDialog
        open={open}
        onOpenChange={setOpen}
        title={editing ? "Change sale status" : "New Sale"}
        description={
          editing
            ? `Update status for sale of ${fmt(editing.total)} to ${editing.customer?.name ?? "customer"}.`
            : "Record a new sale from a customer."
        }
        fields={editing ? statusField : fields}
        values={values}
        onValuesChange={setValues}
        onSubmit={handleSubmit}
        isPending={create.isPending || update.isPending}
        submitLabel={editing ? "Update status" : "Record sale"}
        size={editing ? "sm" : "md"}
      />
    </div>
  );
}

function SalesSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-10 w-full rounded-lg" />
      <Skeleton className="h-[400px] w-full rounded-xl" />
    </div>
  );
}
