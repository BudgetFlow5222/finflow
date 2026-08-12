"use client";

import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Pencil,
  Trash2,
  Repeat,
  RefreshCw,
  MoreHorizontal,
  CalendarDays,
  Wallet,
  PauseCircle,
  PlayCircle,
  Zap,
  Loader2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/status-badge";
import { FormDialog, type Field } from "@/components/forms/form-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  useRecurring,
  useAccounts,
  useCustomers,
  useVendors,
  useCategories,
  useCreate,
  useUpdate,
  useDelete,
  qk,
} from "@/hooks/use-finance";
import { useUI } from "@/hooks/use-ui";
import { toast } from "sonner";
import { formatCurrency, formatDate, relativeTime, cn } from "@/lib/utils";
import type { RecurringTransaction } from "@/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toInputDate(d: string | Date | null | undefined): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "";
  // Use local date components to avoid TZ shifts in the date input.
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function recurringStatusVariant(s: string) {
  switch (s) {
    case "ACTIVE":
      return "success" as const;
    case "PAUSED":
      return "warning" as const;
    case "COMPLETED":
      return "neutral" as const;
    default:
      return "neutral" as const;
  }
}

/** Human-readable frequency label, e.g. "Monthly", "Every 2 weeks", "Every 3 months". */
function frequencyLabel(frequency: string, interval: number): string {
  const unitMap: Record<string, { single: string; plural: string }> = {
    DAILY: { single: "day", plural: "days" },
    WEEKLY: { single: "week", plural: "weeks" },
    MONTHLY: { single: "month", plural: "months" },
    QUARTERLY: { single: "quarter", plural: "quarters" },
    YEARLY: { single: "year", plural: "years" },
  };
  const unit = unitMap[frequency] ?? { single: "cycle", plural: "cycles" };
  if (interval <= 1) {
    // "Monthly", "Weekly", etc.
    const cap = frequency.charAt(0) + frequency.slice(1).toLowerCase();
    return cap.replace("Daily", "Daily").replace("Weekly", "Weekly")
      .replace("Monthly", "Monthly").replace("Quarterly", "Quarterly")
      .replace("Yearly", "Yearly");
  }
  return `Every ${interval} ${unit.plural}`;
}

function daysUntil(date: string | Date): number {
  const d = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  return Math.ceil((d.getTime() - now.getTime()) / 86400000);
}

// ---------------------------------------------------------------------------
// Main view
// ---------------------------------------------------------------------------

export function RecurringView() {
  const { data: items, isLoading, refetch } = useRecurring();
  const { data: accounts } = useAccounts();
  const { data: customers } = useCustomers();
  const { data: vendors } = useVendors();
  const { data: categories } = useCategories();
  const { pendingForm, consumeForm } = useUI();
  const qc = useQueryClient();

  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<RecurringTransaction | null>(null);
  const [values, setValues] = React.useState<Record<string, unknown>>({});

  const create = useCreate("/api/recurring", [qk.recurring, qk.dashboard]);
  const update = useUpdate((id) => `/api/recurring/${id}`, [qk.recurring, qk.dashboard]);
  const remove = useDelete((id) => `/api/recurring/${id}`, [qk.recurring, qk.dashboard]);

  // Custom mutation for the "Post Now" action — posts the recurring template
  // and invalidates recurring + dashboard + sales + expenses so all derived
  // data (account balances, recent transactions, dashboard KPIs) refresh.
  const postNow = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/recurring/${id}/post`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }).then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) {
          throw new Error(
            (data as { error?: string })?.error ?? `Request failed (${r.status})`,
          );
        }
        return data as { amount: number; kind: "sale" | "expense" };
      }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: qk.recurring });
      qc.invalidateQueries({ queryKey: qk.dashboard });
      qc.invalidateQueries({ queryKey: qk.sales });
      qc.invalidateQueries({ queryKey: qk.expenses });
      toast.success(
        `Posted ${formatCurrency(data.amount)} as a new ${data.kind}`,
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });

  React.useEffect(() => {
    const f = consumeForm();
    if (f === "recurring") openNew();
  }, [pendingForm]);

  const openNew = () => {
    setEditing(null);
    setValues({
      type: "EXPENSE",
      frequency: "MONTHLY",
      interval: 1,
      status: "ACTIVE",
      nextDate: toInputDate(new Date()),
    });
    setOpen(true);
  };

  const openEdit = (r: RecurringTransaction) => {
    setEditing(r);
    setValues({
      name: r.name,
      type: r.type,
      amount: r.amount,
      categoryId: r.categoryId ?? "",
      accountId: r.accountId,
      vendorId: r.vendorId ?? "",
      customerId: r.customerId ?? "",
      frequency: r.frequency,
      interval: r.interval,
      nextDate: toInputDate(r.nextDate),
      endDate: toInputDate(r.endDate),
      paymentMethod: r.paymentMethod ?? "",
      budgetType: r.budgetType ?? "",
      status: r.status,
      notes: r.notes ?? "",
    });
    setOpen(true);
  };

  const handleSubmit = async () => {
    if (!values.name) return toast.error("Name is required");
    if (!values.accountId) return toast.error("Account is required");
    if (!values.nextDate) return toast.error("Next date is required");
    const amount = Number(values.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return toast.error("Amount must be a positive number");
    }

    const payload: Record<string, unknown> = { ...values };
    // Convert dates to ISO strings (or null).
    if (values.nextDate) {
      const d = new Date(String(values.nextDate));
      payload.nextDate = Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
    }
    if (values.endDate) {
      const d = new Date(String(values.endDate));
      payload.endDate = Number.isNaN(d.getTime()) ? null : d.toISOString();
    } else {
      payload.endDate = null;
    }
    // Normalize empty strings → null for optional FKs.
    payload.categoryId = values.categoryId || null;
    payload.vendorId = values.vendorId || null;
    payload.customerId = values.customerId || null;
    payload.paymentMethod = values.paymentMethod || null;
    // budgetType only relevant for EXPENSE — clear it for INCOME.
    if (values.type === "INCOME") {
      payload.budgetType = null;
    } else {
      payload.budgetType = values.budgetType || null;
    }
    // Ensure interval is a number.
    payload.interval = Number(values.interval) || 1;

    try {
      if (editing) {
        await update.mutateAsync({ id: editing.id, body: payload });
        toast.success("Recurring transaction updated");
      } else {
        await create.mutateAsync(payload);
        toast.success("Recurring transaction created");
      }
      setOpen(false);
    } catch {
      // toast handled by mutation onError
    }
  };

  const handleDelete = async (r: RecurringTransaction) => {
    if (!confirm(`Delete “${r.name}”? This stops the recurring schedule and cannot be undone.`)) return;
    await remove.mutateAsync(r.id);
    toast.success("Recurring transaction deleted");
  };

  const togglePause = async (r: RecurringTransaction) => {
    const nextStatus = r.status === "PAUSED" ? "ACTIVE" : "PAUSED";
    await update.mutateAsync({
      id: r.id,
      body: {
        name: r.name,
        type: r.type,
        amount: r.amount,
        categoryId: r.categoryId,
        accountId: r.accountId,
        vendorId: r.vendorId,
        customerId: r.customerId,
        frequency: r.frequency,
        interval: r.interval,
        nextDate: new Date(r.nextDate).toISOString(),
        endDate: r.endDate ? new Date(r.endDate).toISOString() : null,
        paymentMethod: r.paymentMethod,
        budgetType: r.budgetType,
        status: nextStatus,
        notes: r.notes,
      },
    });
    toast.success(nextStatus === "PAUSED" ? "Recurring paused" : "Recurring resumed");
  };

  const handlePostNow = async (r: RecurringTransaction) => {
    if (r.status === "PAUSED") {
      return toast.error("Resume this recurring transaction before posting.");
    }
    if (r.status === "COMPLETED") {
      return toast.error("This recurring schedule is completed.");
    }
    await postNow.mutateAsync(r.id);
  };

  // Aggregations
  const activeItems = items?.filter((r) => r.status === "ACTIVE") ?? [];
  const activeCount = activeItems.length;
  const monthlyTotal = activeItems
    .filter((r) => r.frequency === "MONTHLY")
    .reduce((s, r) => s + r.amount, 0);
  const upcoming = [...activeItems].sort(
    (a, b) => new Date(a.nextDate).getTime() - new Date(b.nextDate).getTime(),
  );
  const nextDue = upcoming[0];

  // Dynamically build form fields based on selected type.
  const fields: Field[] = React.useMemo(() => {
    const type = (values.type as string) ?? "EXPENSE";
    const accountOptions = (accounts ?? [])
      .filter((a) => a.status === "ACTIVE")
      .map((a) => ({ label: `${a.name} · ${a.currency}`, value: a.id }));
    const filteredCategories = (categories ?? []).filter((c) => c.type === type);
    const categoryOptions = [
      { label: "— Uncategorized —", value: "" },
      ...filteredCategories.map((c) => ({ label: c.name, value: c.id })),
    ];
    const vendorOptions = [
      { label: "— No vendor —", value: "" },
      ...(vendors ?? []).map((v) => ({
        label: v.company ? `${v.name} · ${v.company}` : v.name,
        value: v.id,
      })),
    ];
    const customerOptions = [
      { label: "— No customer —", value: "" },
      ...(customers ?? []).map((c) => ({
        label: c.company ? `${c.name} · ${c.company}` : c.name,
        value: c.id,
      })),
    ];

    const f: Field[] = [
      {
        name: "name",
        label: "Name",
        type: "text",
        placeholder: "e.g. Office Rent",
        required: true,
        colSpan: 2,
      },
      {
        name: "type",
        label: "Type",
        type: "select",
        required: true,
        options: [
          { label: "Income", value: "INCOME" },
          { label: "Expense", value: "EXPENSE" },
        ],
      },
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
        name: "accountId",
        label: "Account",
        type: "select",
        required: true,
        options: accountOptions,
      },
      {
        name: "categoryId",
        label: "Category",
        type: "select",
        options: categoryOptions,
        hint: type === "INCOME" ? "Income category." : "Used for budget (50/30/20) analysis.",
      },
      // Conditional counterparty: vendor for EXPENSE, customer for INCOME.
      ...(type === "EXPENSE"
        ? [
            {
              name: "vendorId",
              label: "Vendor",
              type: "select" as const,
              options: vendorOptions,
            },
          ]
        : [
            {
              name: "customerId",
              label: "Customer",
              type: "select" as const,
              required: true,
              options: customerOptions,
            },
          ]),
      {
        name: "frequency",
        label: "Frequency",
        type: "select",
        required: true,
        options: [
          { label: "Daily", value: "DAILY" },
          { label: "Weekly", value: "WEEKLY" },
          { label: "Monthly", value: "MONTHLY" },
          { label: "Quarterly", value: "QUARTERLY" },
          { label: "Yearly", value: "YEARLY" },
        ],
      },
      {
        name: "interval",
        label: "Every (interval)",
        type: "number",
        defaultValue: 1,
        min: 1,
        step: 1,
        hint: "e.g. 2 = every 2 months.",
      },
      { name: "nextDate", label: "Next date", type: "date", required: true },
      { name: "endDate", label: "End date (optional)", type: "date" },
      {
        name: "paymentMethod",
        label: "Payment method",
        type: "select",
        options: [
          { label: "— None —", value: "" },
          { label: "Cash", value: "CASH" },
          { label: "Bank", value: "BANK" },
          { label: "UPI", value: "UPI" },
          { label: "Card", value: "CARD" },
          { label: "Wallet", value: "WALLET" },
        ],
      },
      // budgetType only for expenses.
      ...(type === "EXPENSE"
        ? [
            {
              name: "budgetType",
              label: "Budget type",
              type: "select" as const,
              options: [
                { label: "— None —", value: "" },
                { label: "Need", value: "NEED" },
                { label: "Want", value: "WANT" },
                { label: "Savings", value: "SAVINGS" },
              ],
            },
          ]
        : []),
      {
        name: "status",
        label: "Status",
        type: "select",
        defaultValue: "ACTIVE",
        options: [
          { label: "Active", value: "ACTIVE" },
          { label: "Paused", value: "PAUSED" },
          { label: "Completed", value: "COMPLETED" },
        ],
      },
      {
        name: "notes",
        label: "Notes",
        type: "textarea",
        colSpan: 2,
        placeholder: "Optional notes",
      },
    ];
    return f;
  }, [values.type, accounts, categories, vendors, customers]);

  if (isLoading) return <RecurringSkeleton />;

  return (
    <div className="space-y-4">
      {/* Summary strip */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="relative overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-1 bg-emerald-500" />
          <CardContent className="p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Active Schedules
            </p>
            <p className="mt-1 text-2xl font-semibold tabular">{activeCount}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              of {items?.length ?? 0} total
            </p>
          </CardContent>
        </Card>
        <Card className="relative overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-1 bg-rose-500" />
          <CardContent className="p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Monthly Recurring
            </p>
            <p className="mt-1 text-2xl font-semibold tabular">
              {formatCurrency(monthlyTotal)}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              sum of active monthly schedules
            </p>
          </CardContent>
        </Card>
        <Card className="relative overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-1 bg-cyan-500" />
          <CardContent className="p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Next Due
            </p>
            {nextDue ? (
              <>
                <p className="mt-1 truncate text-2xl font-semibold tabular">
                  {nextDue.name}
                </p>
                <p
                  className={cn(
                    "mt-0.5 text-xs",
                    daysUntil(nextDue.nextDate) < 0
                      ? "text-rose-500"
                      : daysUntil(nextDue.nextDate) <= 3
                        ? "text-amber-600 dark:text-amber-400"
                        : "text-muted-foreground",
                  )}
                >
                  {relativeTime(nextDue.nextDate)} · {formatCurrency(nextDue.amount)}
                </p>
              </>
            ) : (
              <p className="mt-1 text-2xl font-semibold tabular text-muted-foreground">
                —
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">Recurring Transactions</h2>
          <p className="text-xs text-muted-foreground">
            Automate repeating income &amp; expenses — rent, payroll, subscriptions, retainers
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => refetch()}>
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
          <Button size="sm" className="gap-1.5" onClick={openNew}>
            <Plus className="h-3.5 w-3.5" /> New Recurring
          </Button>
        </div>
      </div>

      {/* Card grid */}
      {items && items.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((r) => {
            const isIncome = r.type === "INCOME";
            const accent = isIncome ? "#10b981" : "#f43f5e";
            const days = daysUntil(r.nextDate);
            const isPaused = r.status === "PAUSED";
            const isCompleted = r.status === "COMPLETED";
            const accountName =
              r.account?.name ??
              accounts?.find((a) => a.id === r.accountId)?.name ??
              "—";
            return (
              <Card
                key={r.id}
                className="group relative flex flex-col overflow-hidden transition-shadow hover:shadow-md"
              >
                <div
                  className="absolute inset-x-0 top-0 h-1"
                  style={{ backgroundColor: accent }}
                />
                <CardContent className="flex flex-1 flex-col p-4">
                  {/* Header row */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-11 w-11 items-center justify-center rounded-xl text-white shadow-sm"
                        style={{ backgroundColor: accent }}
                      >
                        <Repeat className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold leading-tight">
                          {r.name}
                        </p>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                          <StatusBadge
                            variant={isIncome ? "success" : "danger"}
                            dot={false}
                          >
                            {r.type}
                          </StatusBadge>
                          <StatusBadge variant={recurringStatusVariant(r.status)}>
                            {r.status}
                          </StatusBadge>
                        </div>
                      </div>
                    </div>
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
                        <DropdownMenuItem
                          onClick={() => handlePostNow(r)}
                          disabled={isPaused || isCompleted || postNow.isPending}
                        >
                          <Zap className="mr-2 h-3.5 w-3.5" /> Post now
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => togglePause(r)} disabled={isCompleted}>
                          {isPaused ? (
                            <>
                              <PlayCircle className="mr-2 h-3.5 w-3.5" /> Resume
                            </>
                          ) : (
                            <>
                              <PauseCircle className="mr-2 h-3.5 w-3.5" /> Pause
                            </>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openEdit(r)}>
                          <Pencil className="mr-2 h-3.5 w-3.5" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => handleDelete(r)}
                        >
                          <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {/* Amount + frequency */}
                  <div className="mt-4 flex items-end justify-between">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        Amount
                      </p>
                      <p
                        className={cn(
                          "text-2xl font-semibold tabular",
                          isIncome
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-rose-600 dark:text-rose-400",
                        )}
                      >
                        {isIncome ? "+" : "−"}
                        {formatCurrency(r.amount)}
                      </p>
                    </div>
                    <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                      {frequencyLabel(r.frequency, r.interval)}
                    </span>
                  </div>

                  {/* Next date + account */}
                  <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-3">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        Next date
                      </p>
                      <div className="mt-0.5 flex items-center gap-1 text-xs">
                        <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="font-medium tabular">
                          {formatDate(r.nextDate, "short")}
                        </span>
                      </div>
                      {!isCompleted && (
                        <p
                          className={cn(
                            "mt-0.5 text-[11px]",
                            isPaused
                              ? "text-amber-600 dark:text-amber-400"
                              : days < 0
                                ? "text-rose-500"
                                : days <= 3
                                  ? "text-amber-600 dark:text-amber-400"
                                  : "text-muted-foreground",
                          )}
                        >
                          {isPaused
                            ? "Paused"
                            : days < 0
                              ? `${Math.abs(days)}d overdue`
                              : days === 0
                                ? "Due today"
                                : `in ${days}d`}
                        </p>
                      )}
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        Account
                      </p>
                      <div className="mt-0.5 flex items-center gap-1 text-xs">
                        <Wallet className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="truncate font-medium">{accountName}</span>
                      </div>
                      {r.lastPosted && (
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          last posted {relativeTime(r.lastPosted)}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Footer: Post Now button */}
                  <div className="mt-4 flex items-center justify-between gap-2">
                    <span className="text-[11px] text-muted-foreground">
                      {r.category?.name ?? (isIncome ? "Income" : "Uncategorized")}
                      {r.budgetType ? ` · ${r.budgetType}` : ""}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 gap-1.5 px-2 text-[11px]"
                      onClick={() => handlePostNow(r)}
                      disabled={isPaused || isCompleted || postNow.isPending}
                    >
                      {postNow.isPending && postNow.variables === r.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Zap className="h-3 w-3" />
                      )}
                      Post Now
                    </Button>
                  </div>

                  {r.notes && (
                    <p className="mt-3 line-clamp-2 rounded-md bg-muted/50 px-2 py-1.5 text-[11px] text-muted-foreground">
                      {r.notes}
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}

          {/* Add new card */}
          <button
            onClick={openNew}
            className="flex min-h-[260px] flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-muted">
              <Plus className="h-5 w-5" />
            </div>
            <span className="text-sm font-medium">Add recurring</span>
            <span className="text-[10px]">Rent, payroll, subscriptions…</span>
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Repeat className="h-7 w-7" />
          </div>
          <div>
            <p className="text-sm font-semibold">No recurring transactions yet</p>
            <p className="text-xs text-muted-foreground">
              Automate repeating income &amp; expenses — rent, payroll, subscriptions and more.
              One click posts the next occurrence.
            </p>
          </div>
          <Button size="sm" className="gap-1.5" onClick={openNew}>
            <Plus className="h-3.5 w-3.5" /> New Recurring
          </Button>
        </div>
      )}

      <FormDialog
        open={open}
        onOpenChange={setOpen}
        title={editing ? "Edit Recurring Transaction" : "New Recurring Transaction"}
        description={
          editing
            ? "Update the schedule. Changes apply to future occurrences only."
            : "Define a template for recurring income or expenses. The system will track the next due date and let you post it in one click."
        }
        fields={fields}
        values={values}
        onValuesChange={setValues}
        onSubmit={handleSubmit}
        isPending={create.isPending || update.isPending}
        submitLabel={editing ? "Save changes" : "Create recurring"}
        size="lg"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function RecurringSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48 rounded-md" />
        <Skeleton className="h-8 w-32 rounded-md" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-72 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
