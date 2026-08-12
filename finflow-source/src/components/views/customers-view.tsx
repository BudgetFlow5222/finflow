"use client";

import * as React from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Users,
  RefreshCw,
  Mail,
  Phone,
  Building2,
  MoreHorizontal,
  UserPlus,
  CheckCircle2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/status-badge";
import { FormDialog, type Field } from "@/components/forms/form-dialog";
import { useCustomers, useCreate, useUpdate, useDelete, qk } from "@/hooks/use-finance";
import { useUI } from "@/hooks/use-ui";
import { toast } from "sonner";
import { initials, cn } from "@/lib/utils";
import type { Customer } from "@/types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const CUSTOMER_FIELDS: Field[] = [
  {
    name: "name",
    label: "Name",
    type: "text",
    placeholder: "e.g. Anita Rao",
    required: true,
    colSpan: 2,
  },
  { name: "company", label: "Company", type: "text", placeholder: "Optional", colSpan: 2 },
  { name: "email", label: "Email", type: "text", placeholder: "anita@example.com" },
  { name: "phone", label: "Phone", type: "text", placeholder: "+91 98765 43210" },
  {
    name: "status",
    label: "Status",
    type: "select",
    defaultValue: "ACTIVE",
    options: [
      { label: "Active", value: "ACTIVE" },
      { label: "Inactive", value: "INACTIVE" },
    ],
  },
  { name: "notes", label: "Notes", type: "textarea", colSpan: 2, placeholder: "Optional notes" },
];

const GRADIENTS = [
  "from-rose-400 to-pink-500",
  "from-pink-400 to-fuchsia-500",
  "from-fuchsia-400 to-purple-500",
  "from-rose-500 to-orange-400",
  "from-pink-500 to-rose-600",
];

function gradientFor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return GRADIENTS[h % GRADIENTS.length];
}

export function CustomersView() {
  const { data: customers, isLoading, refetch } = useCustomers();
  const { pendingForm, consumeForm } = useUI();
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Customer | null>(null);
  const [values, setValues] = React.useState<Record<string, unknown>>({});

  const create = useCreate("/api/customers", [qk.customers, qk.dashboard]);
  const update = useUpdate((id) => `/api/customers/${id}`, [qk.customers, qk.dashboard]);
  const remove = useDelete((id) => `/api/customers/${id}`, [qk.customers, qk.dashboard]);

  React.useEffect(() => {
    const f = consumeForm();
    if (f === "customer") openNew();
  }, [pendingForm]);

  const openNew = () => {
    setEditing(null);
    setValues({ status: "ACTIVE" });
    setOpen(true);
  };

  const openEdit = (c: Customer) => {
    setEditing(c);
    setValues({
      name: c.name,
      company: c.company ?? "",
      email: c.email ?? "",
      phone: c.phone ?? "",
      status: c.status ?? "ACTIVE",
      notes: c.notes ?? "",
    });
    setOpen(true);
  };

  const handleSubmit = async () => {
    if (!values.name) return toast.error("Name is required");
    if (editing) {
      await update.mutateAsync({ id: editing.id, body: values });
      toast.success("Customer updated");
    } else {
      await create.mutateAsync(values);
      toast.success("Customer created");
    }
    setOpen(false);
  };

  const handleDelete = async (c: Customer) => {
    if (!confirm(`Delete customer “${c.name}”? This cannot be undone.`)) return;
    await remove.mutateAsync(c.id);
    toast.success("Customer deleted");
  };

  if (isLoading) return <CustomersSkeleton />;

  const total = customers?.length ?? 0;
  const activeCount =
    customers?.filter((c) => (c.status ?? "ACTIVE") === "ACTIVE").length ?? 0;
  const withEmailCount = customers?.filter((c) => c.email).length ?? 0;

  return (
    <div className="space-y-4">
      {/* Summary strip */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Total Customers
            </p>
            <p className="mt-1 text-2xl font-semibold tabular">{total}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">in your directory</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Active
            </p>
            <p className="mt-1 text-2xl font-semibold tabular text-rose-600 dark:text-rose-400">
              {activeCount}
            </p>
            <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
              <CheckCircle2 className="h-3 w-3" />
              {total - activeCount} inactive
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              With Email
            </p>
            <p className="mt-1 text-2xl font-semibold tabular">{withEmailCount}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">contactable</p>
          </CardContent>
        </Card>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">All Customers</h2>
          <p className="text-xs text-muted-foreground">People and businesses you bill</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => refetch()}>
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
          <Button
            size="sm"
            className="gap-1.5 bg-rose-500 text-white hover:bg-rose-600"
            onClick={openNew}
          >
            <Plus className="h-3.5 w-3.5" /> New Customer
          </Button>
        </div>
      </div>

      {/* Customer grid */}
      {customers && customers.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {customers.map((c) => {
            const grad = gradientFor(c.name);
            const active = (c.status ?? "ACTIVE") === "ACTIVE";
            return (
              <Card key={c.id} className="group relative overflow-hidden transition-shadow hover:shadow-md">
                <div className={cn("absolute inset-x-0 top-0 h-1 bg-gradient-to-r", grad)} />
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-sm",
                          grad,
                        )}
                      >
                        <span className="text-sm font-semibold">{initials(c.name) || "?"}</span>
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold leading-tight">{c.name}</p>
                        <p className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                          <Building2 className="h-3 w-3" />
                          {c.company || "No company"}
                        </p>
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
                        <DropdownMenuItem onClick={() => openEdit(c)}>
                          <Pencil className="mr-2 h-3.5 w-3.5" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(c)}>
                          <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="mt-3 space-y-1.5 text-xs">
                    {c.email && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Mail className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{c.email}</span>
                      </div>
                    )}
                    {c.phone && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Phone className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{c.phone}</span>
                      </div>
                    )}
                    {!c.email && !c.phone && (
                      <p className="text-[11px] italic text-muted-foreground">No contact details</p>
                    )}
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    <StatusBadge variant={active ? "success" : "neutral"}>
                      {c.status ?? "ACTIVE"}
                    </StatusBadge>
                    <span className="text-[10px] text-muted-foreground">
                      Added {new Date(c.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {/* Add new card */}
          <button
            onClick={openNew}
            className="flex min-h-[180px] flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border text-muted-foreground transition-colors hover:border-rose-400/40 hover:text-rose-500"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-muted">
              <UserPlus className="h-5 w-5" />
            </div>
            <span className="text-sm font-medium">Add customer</span>
            <span className="text-[10px]">People and businesses…</span>
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-rose-500/10 text-rose-500">
            <Users className="h-7 w-7" />
          </div>
          <div>
            <p className="text-sm font-semibold">No customers yet</p>
            <p className="text-xs text-muted-foreground">
              Add people or businesses you bill to track sales and invoices.
            </p>
          </div>
          <Button
            size="sm"
            className="gap-1.5 bg-rose-500 text-white hover:bg-rose-600"
            onClick={openNew}
          >
            <Plus className="h-3.5 w-3.5" /> New Customer
          </Button>
        </div>
      )}

      <FormDialog
        open={open}
        onOpenChange={setOpen}
        title={editing ? "Edit Customer" : "New Customer"}
        description={editing ? "Update customer details." : "Add a new customer to your directory."}
        fields={CUSTOMER_FIELDS}
        values={values}
        onValuesChange={setValues}
        onSubmit={handleSubmit}
        isPending={create.isPending || update.isPending}
        submitLabel={editing ? "Save changes" : "Create customer"}
      />
    </div>
  );
}

function CustomersSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-52 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
