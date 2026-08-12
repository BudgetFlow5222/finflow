"use client";

import * as React from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Store,
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
import { useVendors, useCreate, useUpdate, useDelete, qk } from "@/hooks/use-finance";
import { useUI } from "@/hooks/use-ui";
import { toast } from "sonner";
import { initials, cn } from "@/lib/utils";
import type { Vendor } from "@/types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const VENDOR_FIELDS: Field[] = [
  {
    name: "name",
    label: "Name",
    type: "text",
    placeholder: "e.g. Acme Supplies",
    required: true,
    colSpan: 2,
  },
  { name: "company", label: "Company", type: "text", placeholder: "Optional", colSpan: 2 },
  { name: "email", label: "Email", type: "text", placeholder: "billing@acme.com" },
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
  "from-slate-500 to-gray-600",
  "from-slate-400 to-slate-600",
  "from-gray-500 to-slate-700",
  "from-zinc-500 to-slate-600",
  "from-slate-600 to-zinc-700",
];

function gradientFor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return GRADIENTS[h % GRADIENTS.length];
}

export function VendorsView() {
  const { data: vendors, isLoading, refetch } = useVendors();
  const { pendingForm, consumeForm } = useUI();
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Vendor | null>(null);
  const [values, setValues] = React.useState<Record<string, unknown>>({});

  const create = useCreate("/api/vendors", [qk.vendors, qk.dashboard]);
  const update = useUpdate((id) => `/api/vendors/${id}`, [qk.vendors, qk.dashboard]);
  const remove = useDelete((id) => `/api/vendors/${id}`, [qk.vendors, qk.dashboard]);

  React.useEffect(() => {
    const f = consumeForm();
    if (f === "vendor") openNew();
  }, [pendingForm]);

  const openNew = () => {
    setEditing(null);
    setValues({ status: "ACTIVE" });
    setOpen(true);
  };

  const openEdit = (v: Vendor) => {
    setEditing(v);
    setValues({
      name: v.name,
      company: v.company ?? "",
      email: v.email ?? "",
      phone: v.phone ?? "",
      status: v.status ?? "ACTIVE",
      notes: v.notes ?? "",
    });
    setOpen(true);
  };

  const handleSubmit = async () => {
    if (!values.name) return toast.error("Name is required");
    if (editing) {
      await update.mutateAsync({ id: editing.id, body: values });
      toast.success("Vendor updated");
    } else {
      await create.mutateAsync(values);
      toast.success("Vendor created");
    }
    setOpen(false);
  };

  const handleDelete = async (v: Vendor) => {
    if (!confirm(`Delete vendor “${v.name}”? This cannot be undone.`)) return;
    await remove.mutateAsync(v.id);
    toast.success("Vendor deleted");
  };

  if (isLoading) return <VendorsSkeleton />;

  const total = vendors?.length ?? 0;
  const activeCount =
    vendors?.filter((v) => (v.status ?? "ACTIVE") === "ACTIVE").length ?? 0;
  const withEmailCount = vendors?.filter((v) => v.email).length ?? 0;

  return (
    <div className="space-y-4">
      {/* Summary strip */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Total Vendors
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
            <p className="mt-1 text-2xl font-semibold tabular text-slate-600 dark:text-slate-300">
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
          <h2 className="text-sm font-semibold">All Vendors</h2>
          <p className="text-xs text-muted-foreground">Suppliers and service providers you pay</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => refetch()}>
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
          <Button size="sm" className="gap-1.5" onClick={openNew}>
            <Plus className="h-3.5 w-3.5" /> New Vendor
          </Button>
        </div>
      </div>

      {/* Vendor grid */}
      {vendors && vendors.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {vendors.map((v) => {
            const grad = gradientFor(v.name);
            const active = (v.status ?? "ACTIVE") === "ACTIVE";
            return (
              <Card key={v.id} className="group relative overflow-hidden transition-shadow hover:shadow-md">
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
                        <span className="text-sm font-semibold">{initials(v.name) || "?"}</span>
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold leading-tight">{v.name}</p>
                        <p className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                          <Building2 className="h-3 w-3" />
                          {v.company || "No company"}
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
                        <DropdownMenuItem onClick={() => openEdit(v)}>
                          <Pencil className="mr-2 h-3.5 w-3.5" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(v)}>
                          <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="mt-3 space-y-1.5 text-xs">
                    {v.email && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Mail className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{v.email}</span>
                      </div>
                    )}
                    {v.phone && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Phone className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{v.phone}</span>
                      </div>
                    )}
                    {!v.email && !v.phone && (
                      <p className="text-[11px] italic text-muted-foreground">No contact details</p>
                    )}
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    <StatusBadge variant={active ? "success" : "neutral"}>
                      {v.status ?? "ACTIVE"}
                    </StatusBadge>
                    <span className="text-[10px] text-muted-foreground">
                      Added {new Date(v.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {/* Add new card */}
          <button
            onClick={openNew}
            className="flex min-h-[180px] flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border text-muted-foreground transition-colors hover:border-slate-400/40 hover:text-slate-600 dark:hover:text-slate-300"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-muted">
              <UserPlus className="h-5 w-5" />
            </div>
            <span className="text-sm font-medium">Add vendor</span>
            <span className="text-[10px]">Suppliers and bills…</span>
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-500/10 text-slate-500 dark:text-slate-400">
            <Store className="h-7 w-7" />
          </div>
          <div>
            <p className="text-sm font-semibold">No vendors yet</p>
            <p className="text-xs text-muted-foreground">
              Add suppliers or service providers you pay to track expenses and bills.
            </p>
          </div>
          <Button size="sm" className="gap-1.5" onClick={openNew}>
            <Plus className="h-3.5 w-3.5" /> New Vendor
          </Button>
        </div>
      )}

      <FormDialog
        open={open}
        onOpenChange={setOpen}
        title={editing ? "Edit Vendor" : "New Vendor"}
        description={editing ? "Update vendor details." : "Add a new vendor to your directory."}
        fields={VENDOR_FIELDS}
        values={values}
        onValuesChange={setValues}
        onSubmit={handleSubmit}
        isPending={create.isPending || update.isPending}
        submitLabel={editing ? "Save changes" : "Create vendor"}
      />
    </div>
  );
}

function VendorsSkeleton() {
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
