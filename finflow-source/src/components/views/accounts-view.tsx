"use client";

import * as React from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Wallet,
  RefreshCw,
  Banknote,
  Smartphone,
  CreditCard,
  PiggyBank,
  MoreHorizontal,
  ShieldCheck,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Money } from "@/components/money";
import { StatusBadge, accountStatusVariant } from "@/components/status-badge";
import { FormDialog, type Field } from "@/components/forms/form-dialog";
import { ReconcileDialog } from "@/components/views/reconcile-dialog";
import { useAccounts, useCreate, useUpdate, useDelete, qk, useDashboard } from "@/hooks/use-finance";
import { useUI } from "@/hooks/use-ui";
import { toast } from "sonner";
import { useCurrency } from "@/hooks/use-currency";
import { formatMoney } from "@/lib/currency";
import { cn } from "@/lib/utils";
import type { Account, AccountType } from "@/types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const ACCOUNT_FIELDS: Field[] = [
  { name: "name", label: "Account name", type: "text", placeholder: "e.g. HDFC Business", required: true, colSpan: 2 },
  {
    name: "type",
    label: "Type",
    type: "select",
    required: true,
    options: [
      { label: "Cash", value: "CASH" },
      { label: "Bank", value: "BANK" },
      { label: "Wallet", value: "WALLET" },
      { label: "UPI", value: "UPI" },
      { label: "Card", value: "CARD" },
    ],
  },
  { name: "openingBalance", label: "Opening balance", type: "number", defaultValue: 0, placeholder: "0.00" },
  { name: "currency", label: "Currency", type: "text", defaultValue: "INR", placeholder: "INR" },
  {
    name: "status",
    label: "Status",
    type: "select",
    defaultValue: "ACTIVE",
    options: [
      { label: "Active", value: "ACTIVE" },
      { label: "Frozen", value: "FROZEN" },
      { label: "Closed", value: "CLOSED" },
    ],
  },
  { name: "color", label: "Color (hex)", type: "text", placeholder: "#10b981" },
  { name: "notes", label: "Notes", type: "textarea", colSpan: 2, placeholder: "Optional notes" },
];

const TYPE_ICONS: Record<AccountType, React.ComponentType<{ className?: string }>> = {
  CASH: Banknote,
  BANK: Wallet,
  WALLET: Smartphone,
  UPI: CreditCard,
  CARD: CreditCard,
};

export function AccountsView() {
  const { data: accounts, isLoading, refetch } = useAccounts();
  const { data: dash } = useDashboard();
  const { pendingForm, consumeForm, setView } = useUI();
  const { currency } = useCurrency();
  const fmt = (amount: number, opts?: { compact?: boolean; sign?: boolean }) =>
    formatMoney(amount, currency, opts ?? {});
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Account | null>(null);
  const [values, setValues] = React.useState<Record<string, unknown>>({});
  const [reconcileOpen, setReconcileOpen] = React.useState(false);
  const [reconcileTarget, setReconcileTarget] = React.useState<Account | null>(null);

  const openReconcile = (a: Account) => {
    setReconcileTarget(a);
    setReconcileOpen(true);
  };

  const create = useCreate("/api/accounts", [qk.accounts, qk.dashboard]);
  const update = useUpdate((id) => `/api/accounts/${id}`, [qk.accounts, qk.dashboard]);
  const remove = useDelete((id) => `/api/accounts/${id}`, [qk.accounts, qk.dashboard]);

  React.useEffect(() => {
    const f = consumeForm();
    if (f === "account") openNew();
  }, [pendingForm]);

  const openNew = () => {
    setEditing(null);
    setValues({ type: "BANK", currency: "INR", status: "ACTIVE", openingBalance: 0 });
    setOpen(true);
  };

  const openEdit = (a: Account) => {
    setEditing(a);
    setValues({
      name: a.name,
      type: a.type,
      openingBalance: a.openingBalance,
      currency: a.currency,
      status: a.status,
      color: a.color ?? "",
      notes: a.notes ?? "",
    });
    setOpen(true);
  };

  const handleSubmit = async () => {
    if (!values.name) return toast.error("Name is required");
    if (editing) {
      await update.mutateAsync({ id: editing.id, body: values });
      toast.success("Account updated");
    } else {
      await create.mutateAsync(values);
      toast.success("Account created");
    }
    setOpen(false);
  };

  const handleDelete = async (a: Account) => {
    if (!confirm(`Delete account “${a.name}”? This cannot be undone.`)) return;
    await remove.mutateAsync(a.id);
    toast.success("Account deleted");
  };

  const totalBalance = accounts?.filter((a) => a.status === "ACTIVE").reduce((s, a) => s + a.currentBalance, 0) ?? 0;
  const totalOpening = accounts?.reduce((s, a) => s + a.openingBalance, 0) ?? 0;
  const delta = totalOpening ? ((totalBalance - totalOpening) / Math.abs(totalOpening)) * 100 : 0;

  if (isLoading) return <AccountsSkeleton />;

  return (
    <div className="space-y-4">
      {/* Summary strip */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Total Available</p>
            <p className="mt-1 text-2xl font-semibold tabular">{fmt(totalBalance)}</p>
            <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
              <span className={delta >= 0 ? "text-emerald-500" : "text-rose-500"}>
                {delta >= 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(1)}%
              </span>
              since opening
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Active Accounts</p>
            <p className="mt-1 text-2xl font-semibold tabular">{accounts?.filter((a) => a.status === "ACTIVE").length ?? 0}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">across {accounts?.length ?? 0} total</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Net Cash Flow</p>
            <p className="mt-1 text-2xl font-semibold tabular">
              <Money amount={dash?.kpis.netCashFlow ?? 0} sign />
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">this month</p>
          </CardContent>
        </Card>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">All Accounts</h2>
          <p className="text-xs text-muted-foreground">Cash, bank, wallet and UPI balances</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => refetch()}>
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
          <Button size="sm" className="gap-1.5" onClick={openNew}>
            <Plus className="h-3.5 w-3.5" /> New Account
          </Button>
        </div>
      </div>

      {/* Account grid */}
      {accounts && accounts.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {accounts.map((a) => {
            const Icon = TYPE_ICONS[a.type] ?? Wallet;
            const balancePct = a.openingBalance ? Math.min(100, (a.currentBalance / Math.abs(a.openingBalance)) * 100) : 100;
            return (
              <Card key={a.id} className="group relative overflow-hidden transition-shadow hover:shadow-md">
                <div
                  className="absolute inset-x-0 top-0 h-1"
                  style={{ backgroundColor: a.color ?? "var(--primary)" }}
                />
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-11 w-11 items-center justify-center rounded-xl text-white shadow-sm"
                        style={{ backgroundColor: a.color ?? "var(--primary)" }}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold leading-tight">{a.name}</p>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{a.type} · {a.currency}</p>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100">
                          <MoreHorizontal className="h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openReconcile(a)}>
                          <ShieldCheck className="mr-2 h-3.5 w-3.5" /> Reconcile
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openEdit(a)}>
                          <Pencil className="mr-2 h-3.5 w-3.5" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(a)}>
                          <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="mt-3">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Current balance</p>
                    <Money amount={a.currentBalance} className="text-2xl font-semibold tabular" />
                  </div>

                  <div className="mt-3">
                    <div className="mb-1 flex justify-between text-[10px] text-muted-foreground">
                      <span>vs opening</span>
                      <span className="tabular">{fmt(a.openingBalance)}</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn("h-full rounded-full", balancePct >= 100 ? "bg-emerald-500" : "bg-amber-500")}
                        style={{ width: `${Math.min(100, balancePct)}%` }}
                      />
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <StatusBadge variant={accountStatusVariant(a.status)}>{a.status}</StatusBadge>
                      {a.lastReconciledAt && (
                        <span className="flex items-center gap-1 text-[10px] text-muted-foreground" title={`Last reconciled: ${new Date(a.lastReconciledAt).toLocaleDateString("en-IN")}`}>
                          <ShieldCheck className="h-3 w-3 text-emerald-500" />
                          {new Date(a.lastReconciledAt).toLocaleDateString("en-IN", { month: "short", day: "numeric" })}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => setView("transfers")}
                      className="text-[11px] font-medium text-primary hover:underline"
                    >
                      Transfer →
                    </button>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {/* Add new card */}
          <button
            onClick={openNew}
            className="flex min-h-[180px] flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-muted">
              <Plus className="h-5 w-5" />
            </div>
            <span className="text-sm font-medium">Add account</span>
            <span className="text-[10px]">Cash, bank, wallet, UPI…</span>
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <PiggyBank className="h-7 w-7" />
          </div>
          <div>
            <p className="text-sm font-semibold">No accounts yet</p>
            <p className="text-xs text-muted-foreground">Add your first bank, cash or wallet account to start tracking.</p>
          </div>
          <Button size="sm" className="gap-1.5" onClick={openNew}>
            <Plus className="h-3.5 w-3.5" /> New Account
          </Button>
        </div>
      )}

      <FormDialog
        open={open}
        onOpenChange={setOpen}
        title={editing ? "Edit Account" : "New Account"}
        description={editing ? "Update account details. Changing opening balance adjusts current balance." : "Add a new bank, cash, wallet or UPI account."}
        fields={ACCOUNT_FIELDS}
        values={values}
        onValuesChange={setValues}
        onSubmit={handleSubmit}
        isPending={create.isPending || update.isPending}
        submitLabel={editing ? "Save changes" : "Create account"}
      />

      <ReconcileDialog
        open={reconcileOpen}
        onOpenChange={setReconcileOpen}
        account={reconcileTarget}
      />
    </div>
  );
}

function AccountsSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-56 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
