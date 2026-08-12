"use client";

import * as React from "react";
import {
  Plus,
  Trash2,
  RefreshCw,
  MoreHorizontal,
  Receipt,
  TrendingDown,
  Banknote,
  CreditCard,
  Smartphone,
  Wallet,
  Download,
  Split,
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  useExpenses,
  useVendors,
  useCategories,
  useAccounts,
  useCreate,
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
} from "@/lib/utils";
import { exportToCSV } from "@/lib/export";
import { ExpenseSplitDialog } from "@/components/views/expense-split-dialog";
import type {
  Expense,
  PaymentMethod,
  BudgetType,
  TransactionStatus,
  Category,
} from "@/types";

const PAYMENT_METHODS: PaymentMethod[] = ["CASH", "BANK", "UPI", "CARD", "WALLET"];
const EXPENSE_STATUSES: TransactionStatus[] = ["COMPLETED", "PENDING", "REFUNDED"];
const BUDGET_TYPES: BudgetType[] = ["NEED", "WANT", "SAVINGS"];

function expenseStatusVariant(s: string) {
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

function budgetTypeVariant(b: BudgetType) {
  switch (b) {
    case "NEED":
      return "info" as const;
    case "WANT":
      return "warning" as const;
    case "SAVINGS":
      return "success" as const;
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

function CategoryDot({ category }: { category?: Category | null }) {
  return (
    <span
      className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
      style={{ backgroundColor: category?.color ?? "#94a3b8" }}
    />
  );
}

export function ExpensesView() {
  const { data: expenses, isLoading, refetch } = useExpenses();
  const { data: vendors } = useVendors();
  const { data: categories } = useCategories();
  const { data: accounts } = useAccounts();
  const { pendingForm, consumeForm } = useUI();
  const { currency } = useCurrency();
  const fmt = (amount: number, opts?: { compact?: boolean; sign?: boolean }) =>
    formatMoney(amount, currency, opts ?? {});
  const [open, setOpen] = React.useState(false);
  const [values, setValues] = React.useState<Record<string, unknown>>({});
  const [splitOpen, setSplitOpen] = React.useState(false);
  const [splitTarget, setSplitTarget] = React.useState<Expense | null>(null);

  const create = useCreate("/api/expenses", [qk.expenses, qk.dashboard]);
  const remove = useDelete((id) => `/api/expenses/${id}`, [qk.expenses, qk.dashboard]);

  React.useEffect(() => {
    const f = consumeForm();
    if (f === "expense") openNew();
  }, [pendingForm]);

  const fields: Field[] = React.useMemo(() => {
    const vendorOptions = [
      { label: "— No vendor —", value: "" },
      ...(vendors ?? []).map((v) => ({
        label: v.company ? `${v.name} · ${v.company}` : v.name,
        value: v.id,
      })),
    ];
    const expenseCategories = (categories ?? []).filter((c) => c.type === "EXPENSE");
    const categoryOptions = [
      { label: "— Uncategorized —", value: "" },
      ...expenseCategories.map((c) => ({ label: c.name, value: c.id })),
    ];
    const accountOptions = (accounts ?? [])
      .filter((a) => a.status === "ACTIVE")
      .map((a) => ({ label: `${a.name} · ${a.currency}`, value: a.id }));
    return [
      {
        name: "vendorId",
        label: "Vendor",
        type: "select",
        options: vendorOptions,
      },
      {
        name: "categoryId",
        label: "Category",
        type: "select",
        options: categoryOptions,
        hint: "Used for budget (50/30/20) analysis.",
      },
      {
        name: "accountId",
        label: "Pay from",
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
        name: "budgetType",
        label: "Budget type",
        type: "select",
        options: [
          { label: "— None —", value: "" },
          ...BUDGET_TYPES.map((b) => ({ label: b, value: b })),
        ],
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
        options: EXPENSE_STATUSES.map((s) => ({ label: s, value: s })),
      },
      { name: "notes", label: "Notes", type: "textarea", colSpan: 2, placeholder: "Optional notes" },
    ];
  }, [vendors, categories, accounts]);

  const openNew = () => {
    setValues({
      date: todayISO(),
      amount: 0,
      tax: 0,
      vendorId: "",
      categoryId: "",
      budgetType: "",
      paymentMethod: "CASH",
      status: "COMPLETED",
    });
    setOpen(true);
  };

  const handleSubmit = async () => {
    if (!values.accountId) return toast.error("Pay-from account is required");
    const amount = Number(values.amount) || 0;
    if (amount <= 0) return toast.error("Amount must be greater than 0");
    if (!values.date) return toast.error("Date is required");

    await create.mutateAsync({
      vendorId: (values.vendorId as string) || null,
      categoryId: (values.categoryId as string) || null,
      accountId: values.accountId,
      date: values.date,
      amount,
      tax: Number(values.tax) || 0,
      budgetType: (values.budgetType as BudgetType | "") || null,
      paymentMethod: (values.paymentMethod as PaymentMethod) ?? null,
      status: (values.status as TransactionStatus) ?? "COMPLETED",
      notes: (values.notes as string) ?? null,
    });
    toast.success("Expense recorded");
    setOpen(false);
  };

  const handleSplit = (e: Expense) => {
    setSplitTarget(e);
    setSplitOpen(true);
  };

  const handleDelete = async (e: Expense) => {
    if (
      !confirm(
        `Delete expense of ${fmt(e.total)}${e.vendor ? ` to ${e.vendor.name}` : ""}? This cannot be undone.`,
      )
    )
      return;
    await remove.mutateAsync(e.id);
    toast.success("Expense deleted");
  };

  const handleExport = () => {
    if (!expenses || expenses.length === 0) return;
    exportToCSV(`finflow-expenses-${new Date().toISOString().slice(0, 10)}.csv`, expenses, [
      { key: "date", label: "Date", format: (v) => formatDate(v as string) },
      { key: "vendorId", label: "Vendor", format: (v) => vendors?.find((x) => x.id === (v as string))?.name ?? "" },
      { key: "categoryId", label: "Category", format: (v) => categories?.find((x) => x.id === (v as string))?.name ?? "" },
      { key: "budgetType", label: "Budget Type", format: (v) => (v as string) ?? "" },
      { key: "accountId", label: "Account", format: (v) => accounts?.find((a) => a.id === (v as string))?.name ?? "" },
      { key: "amount", label: "Amount", format: (v) => fmt(v as number) },
      { key: "tax", label: "Tax", format: (v) => fmt(v as number) },
      { key: "total", label: "Total", format: (v) => fmt(v as number) },
      { key: "paymentMethod", label: "Method", format: (v) => (v as string) ?? "" },
      { key: "status", label: "Status", format: (v) => String(v ?? "") },
      { key: "notes", label: "Notes", format: (v) => (v as string) ?? "" },
    ]);
    toast.success(`Exported ${expenses.length} expenses to CSV`);
  };

  // KPIs — this month
  const now = new Date();
  const thisMonthExpenses = (expenses ?? []).filter((e) => {
    const d = new Date(e.date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const thisMonthTotal = thisMonthExpenses
    .filter((e) => e.status !== "REFUNDED")
    .reduce((s, x) => s + x.total, 0);

  // Top category by spend this month
  const categoryMap = new Map<string, { name: string; color?: string | null; total: number }>();
  for (const e of thisMonthExpenses) {
    if (e.status === "REFUNDED") continue;
    const key = e.categoryId ?? "—";
    const existing = categoryMap.get(key);
    if (existing) {
      existing.total += e.total;
    } else {
      categoryMap.set(key, {
        name: e.category?.name ?? "Uncategorized",
        color: e.category?.color,
        total: e.total,
      });
    }
  }
  const topCategory = [...categoryMap.values()].sort((a, b) => b.total - a.total)[0] ?? null;

  if (isLoading) return <ExpensesSkeleton />;

  return (
    <div className="space-y-4">
      {/* Summary strip */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Spent This Month
            </p>
            <p className="mt-1 text-2xl font-semibold tabular text-rose-600 dark:text-rose-400">
              {fmt(thisMonthTotal)}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">{thisMonthExpenses.length} expenses this month</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Total Expenses
            </p>
            <p className="mt-1 text-2xl font-semibold tabular">
              {expenses?.filter((e) => e.status !== "REFUNDED").length ?? 0}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">all time, excluding refunds</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Top Category
            </p>
            <p className="mt-1 flex items-center gap-1.5 text-base font-semibold">
              {topCategory ? (
                <>
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: topCategory.color ?? "#94a3b8" }}
                  />
                  <span className="truncate">{topCategory.name}</span>
                </>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {topCategory ? `${fmt(topCategory.total)} this month` : "no spend yet"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <TrendingDown className="h-4 w-4 text-rose-500" /> Expenses
          </h2>
          <p className="text-xs text-muted-foreground">Track spending by vendor, category and budget type</p>
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
            disabled={!expenses || expenses.length === 0}
          >
            <Download className="h-3.5 w-3.5" /> Export
          </Button>
          <Button size="sm" className="gap-1.5 bg-rose-600 hover:bg-rose-700" onClick={openNew}>
            <Plus className="h-3.5 w-3.5" /> New Expense
          </Button>
        </div>
      </div>

      {/* Table */}
      {expenses && expenses.length > 0 ? (
        <div className="rounded-xl border">
          <div className="max-h-[600px] overflow-auto scrollbar-thin">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="pl-3">Date</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Budget</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Tax</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="w-10 pr-3"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenses.map((e) => {
                  const Icon = e.paymentMethod ? METHOD_ICONS[e.paymentMethod] : null;
                  return (
                    <TableRow key={e.id}>
                      <TableCell className="pl-3">
                        <p className="text-xs font-medium">{formatDate(e.date)}</p>
                        <p className="text-[10px] text-muted-foreground">{relativeTime(e.date)}</p>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-rose-500/10 text-rose-500">
                            <Receipt className="h-3.5 w-3.5" />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{e.vendor?.name ?? "—"}</p>
                            <p className="truncate text-[10px] text-muted-foreground">
                              {e.vendor?.company ?? "Direct expense"}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1.5 text-xs">
                          <CategoryDot category={e.category} />
                          <span className="truncate">{e.category?.name ?? "Uncategorized"}</span>
                        </span>
                      </TableCell>
                      <TableCell>
                        {e.budgetType ? (
                          <StatusBadge variant={budgetTypeVariant(e.budgetType)} dot={false}>
                            {e.budgetType}
                          </StatusBadge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <p className="text-xs font-medium">{e.account?.name ?? "—"}</p>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          {e.account?.type}
                          {Icon && <Icon className="ml-1 inline h-3 w-3" />}
                        </p>
                      </TableCell>
                      <TableCell className="text-right">
                        <Money amount={e.amount} className="text-sm" />
                      </TableCell>
                      <TableCell className="text-right text-xs tabular text-muted-foreground">
                        {fmt(e.tax)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Money amount={-e.total} className="text-sm font-semibold" />
                      </TableCell>
                      <TableCell className="pr-3">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7">
                              <MoreHorizontal className="h-3.5 w-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleSplit(e)}>
                              <Split className="mr-2 h-3.5 w-3.5" /> Split
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(e)}>
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
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-rose-500/10 text-rose-500">
            <Receipt className="h-7 w-7" />
          </div>
          <div>
            <p className="text-sm font-semibold">No expenses yet</p>
            <p className="text-xs text-muted-foreground">Record your first expense to start tracking spending.</p>
          </div>
          <Button size="sm" className="gap-1.5 bg-rose-600 hover:bg-rose-700" onClick={openNew}>
            <Plus className="h-3.5 w-3.5" /> New Expense
          </Button>
        </div>
      )}

      <FormDialog
        open={open}
        onOpenChange={setOpen}
        title="New Expense"
        description="Record a new expense. Completed expenses debit the selected account immediately."
        fields={fields}
        values={values}
        onValuesChange={setValues}
        onSubmit={handleSubmit}
        isPending={create.isPending}
        submitLabel="Record expense"
      />

      <ExpenseSplitDialog
        open={splitOpen}
        onOpenChange={setSplitOpen}
        expense={splitTarget}
      />
    </div>
  );
}

function ExpensesSkeleton() {
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
