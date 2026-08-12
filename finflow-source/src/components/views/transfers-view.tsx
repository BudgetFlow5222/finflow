"use client";

import * as React from "react";
import {
  Plus,
  Trash2,
  RefreshCw,
  MoreHorizontal,
  ArrowRight,
  ArrowLeftRight,
  Send,
  Download,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Money } from "@/components/money";
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
  useTransfers,
  useAccounts,
  useCreate,
  useDelete,
  qk,
} from "@/hooks/use-finance";
import { useUI } from "@/hooks/use-ui";
import { toast } from "sonner";
import { formatCurrency, formatDate, relativeTime } from "@/lib/utils";
import { exportToCSV } from "@/lib/export";
import type { Transfer } from "@/types";

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function TransfersView() {
  const { data: transfers, isLoading, refetch } = useTransfers();
  const { data: accounts } = useAccounts();
  const { pendingForm, consumeForm } = useUI();
  const [open, setOpen] = React.useState(false);
  const [values, setValues] = React.useState<Record<string, unknown>>({});

  const create = useCreate("/api/transfers", [qk.transfers, qk.dashboard]);
  const remove = useDelete((id) => `/api/transfers/${id}`, [qk.transfers, qk.dashboard]);

  React.useEffect(() => {
    const f = consumeForm();
    if (f === "transfer") openNew();
  }, [pendingForm]);

  const accountOptions = React.useMemo(
    () =>
      (accounts ?? [])
        .filter((a) => a.status === "ACTIVE")
        .map((a) => ({ label: `${a.name} · ${a.currency}`, value: a.id })),
    [accounts],
  );

  const fields: Field[] = React.useMemo(
    () => [
      {
        name: "fromAccountId",
        label: "From account (source)",
        type: "select",
        required: true,
        options: accountOptions,
        hint: "↗ Money leaves this account",
      },
      {
        name: "toAccountId",
        label: "To account (destination)",
        type: "select",
        required: true,
        options: accountOptions,
        hint: "↙ Money arrives here — must differ from source",
      },
      { name: "date", label: "Date", type: "date", required: true },
      {
        name: "amount",
        label: "Amount",
        type: "number",
        required: true,
        min: 0.01,
        step: 0.01,
        placeholder: "0.00",
      },
      {
        name: "fee",
        label: "Transfer fee",
        type: "number",
        defaultValue: 0,
        min: 0,
        step: 0.01,
        placeholder: "0.00",
      },
      { name: "notes", label: "Notes", type: "textarea", colSpan: 2, placeholder: "Optional notes" },
    ],
    [accountOptions],
  );

  const openNew = () => {
    setValues({
      date: todayISO(),
      amount: 0,
      fee: 0,
      fromAccountId: "",
      toAccountId: "",
    });
    setOpen(true);
  };

  const handleSubmit = async () => {
    if (!values.fromAccountId) return toast.error("Select a source account");
    if (!values.toAccountId) return toast.error("Select a destination account");
    if (values.fromAccountId === values.toAccountId)
      return toast.error("Source and destination accounts must differ");
    const amount = Number(values.amount) || 0;
    if (amount <= 0) return toast.error("Amount must be greater than 0");
    if (!values.date) return toast.error("Date is required");

    await create.mutateAsync({
      fromAccountId: values.fromAccountId,
      toAccountId: values.toAccountId,
      amount,
      date: values.date,
      fee: Number(values.fee) || 0,
      notes: (values.notes as string) ?? null,
    });
    toast.success("Transfer completed");
    setOpen(false);
  };

  const handleDelete = async (t: Transfer) => {
    if (
      !confirm(
        `Delete transfer of ${formatCurrency(t.amount)} from ${t.fromAccount?.name ?? "—"} to ${t.toAccount?.name ?? "—"}? This cannot be undone.`,
      )
    )
      return;
    await remove.mutateAsync(t.id);
    toast.success("Transfer deleted");
  };

  const handleExport = () => {
    if (!transfers || transfers.length === 0) return;
    exportToCSV(`finflow-transfers-${new Date().toISOString().slice(0, 10)}.csv`, transfers, [
      { key: "date", label: "Date", format: (v) => formatDate(v as string) },
      { key: "fromAccountId", label: "From Account", format: (v) => accounts?.find((a) => a.id === (v as string))?.name ?? "" },
      { key: "toAccountId", label: "To Account", format: (v) => accounts?.find((a) => a.id === (v as string))?.name ?? "" },
      { key: "amount", label: "Amount", format: (v) => formatCurrency(v as number) },
      { key: "fee", label: "Fee", format: (v) => formatCurrency(v as number) },
      { key: "notes", label: "Notes", format: (v) => (v as string) ?? "" },
    ]);
    toast.success(`Exported ${transfers.length} transfers to CSV`);
  };

  // KPIs
  const totalTransferred = (transfers ?? []).reduce((s, t) => s + t.amount, 0);
  const now = new Date();
  const thisMonthTransfers = (transfers ?? []).filter((t) => {
    const d = new Date(t.date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const thisMonthCount = thisMonthTransfers.length;
  const avgTransfer = transfers?.length ? totalTransferred / transfers.length : 0;

  if (isLoading) return <TransfersSkeleton />;

  return (
    <div className="space-y-4">
      {/* Summary strip */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Total Transferred
            </p>
            <p className="mt-1 text-2xl font-semibold tabular text-cyan-600 dark:text-cyan-400">
              {formatCurrency(totalTransferred)}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">{transfers?.length ?? 0} transfers all time</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              This Month
            </p>
            <p className="mt-1 text-2xl font-semibold tabular text-cyan-600 dark:text-cyan-400">
              {thisMonthCount}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              totalling {formatCurrency(thisMonthTransfers.reduce((s, t) => s + t.amount, 0))}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Avg Transfer
            </p>
            <p className="mt-1 text-2xl font-semibold tabular">{formatCurrency(avgTransfer)}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">per transfer, all time</p>
          </CardContent>
        </Card>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <ArrowLeftRight className="h-4 w-4 text-cyan-500" /> Transfers
          </h2>
          <p className="text-xs text-muted-foreground">Move money between your accounts</p>
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
            disabled={!transfers || transfers.length === 0}
          >
            <Download className="h-3.5 w-3.5" /> Export
          </Button>
          <Button size="sm" className="gap-1.5 bg-cyan-600 hover:bg-cyan-700" onClick={openNew}>
            <Plus className="h-3.5 w-3.5" /> New Transfer
          </Button>
        </div>
      </div>

      {/* Table */}
      {transfers && transfers.length > 0 ? (
        <div className="rounded-xl border">
          <div className="max-h-[600px] overflow-auto scrollbar-thin">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="pl-3">Date</TableHead>
                  <TableHead>From</TableHead>
                  <TableHead className="w-10 text-center">→</TableHead>
                  <TableHead>To</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Fee</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="w-10 pr-3"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transfers.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="pl-3">
                      <p className="text-xs font-medium">{formatDate(t.date)}</p>
                      <p className="text-[10px] text-muted-foreground">{relativeTime(t.date)}</p>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-rose-500/10 text-rose-500">
                          <Send className="h-3 w-3 -scale-x-100" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{t.fromAccount?.name ?? "—"}</p>
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                            {t.fromAccount?.type}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <ArrowRight className="inline h-4 w-4 text-cyan-500" />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500">
                          <Send className="h-3 w-3" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{t.toAccount?.name ?? "—"}</p>
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                            {t.toAccount?.type}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Money amount={t.amount} className="text-sm font-semibold" />
                    </TableCell>
                    <TableCell className="text-right text-xs tabular text-muted-foreground">
                      {t.fee ? formatCurrency(t.fee) : "—"}
                    </TableCell>
                    <TableCell>
                      <p className="max-w-[200px] truncate text-xs text-muted-foreground">
                        {t.notes ?? "—"}
                      </p>
                    </TableCell>
                    <TableCell className="pr-3">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <MoreHorizontal className="h-3.5 w-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(t)}>
                            <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-cyan-500/10 text-cyan-500">
            <ArrowLeftRight className="h-7 w-7" />
          </div>
          <div>
            <p className="text-sm font-semibold">No transfers yet</p>
            <p className="text-xs text-muted-foreground">Move money between accounts to balance your cash flow.</p>
          </div>
          <Button size="sm" className="gap-1.5 bg-cyan-600 hover:bg-cyan-700" onClick={openNew}>
            <Plus className="h-3.5 w-3.5" /> New Transfer
          </Button>
        </div>
      )}

      <FormDialog
        open={open}
        onOpenChange={setOpen}
        title="New Transfer"
        description="Move money from one account to another. Source → Destination."
        fields={fields}
        values={values}
        onValuesChange={setValues}
        onSubmit={handleSubmit}
        isPending={create.isPending}
        submitLabel="Transfer money"
      />
    </div>
  );
}

function TransfersSkeleton() {
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
