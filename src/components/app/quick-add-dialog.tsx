"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  FileText,
  ArrowLeftRight,
  Users,
  Truck,
  Target,
  Repeat,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface QuickAddOption {
  key: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}

const OPTIONS: QuickAddOption[] = [
  {
    key: "sale",
    label: "New Sale",
    description: "Record income from a customer",
    icon: TrendingUp,
    color: "from-emerald-500 to-teal-600",
  },
  {
    key: "expense",
    label: "New Expense",
    description: "Log a business expense",
    icon: TrendingDown,
    color: "from-red-500 to-rose-600",
  },
  {
    key: "invoice",
    label: "New Invoice",
    description: "Create and send an invoice",
    icon: FileText,
    color: "from-violet-500 to-purple-600",
  },
  {
    key: "transfer",
    label: "Transfer Money",
    description: "Move funds between accounts",
    icon: ArrowLeftRight,
    color: "from-cyan-500 to-blue-600",
  },
  {
    key: "account",
    label: "New Account",
    description: "Add a bank, cash or wallet",
    icon: Wallet,
    color: "from-amber-500 to-orange-600",
  },
  {
    key: "customer",
    label: "New Customer",
    description: "Add a client to your directory",
    icon: Users,
    color: "from-pink-500 to-rose-600",
  },
  {
    key: "vendor",
    label: "New Vendor",
    description: "Add a supplier to your directory",
    icon: Truck,
    color: "from-slate-500 to-gray-700",
  },
  {
    key: "goal",
    label: "New Savings Goal",
    description: "Set a financial target to save toward",
    icon: Target,
    color: "from-teal-500 to-emerald-600",
  },
  {
    key: "recurring",
    label: "New Recurring",
    description: "Set up a recurring transaction",
    icon: Repeat,
    color: "from-cyan-500 to-teal-600",
  },
];

export function QuickAddDialog({
  open,
  onOpenChange,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSelect: (key: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Plus className="h-4 w-4 text-primary" />
            Quick Add
          </DialogTitle>
          <DialogDescription>
            Choose what you&apos;d like to create. Everything is validated and saved instantly.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2 p-4 pt-2 sm:grid-cols-2">
          {OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => {
                onSelect(opt.key);
                onOpenChange(false);
              }}
              className="group flex items-start gap-3 rounded-xl border border-border bg-card p-3 text-left transition-all hover:border-primary/30 hover:bg-accent hover:shadow-sm"
            >
              <div
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-white shadow-sm",
                  opt.color,
                )}
              >
                <opt.icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium leading-tight">{opt.label}</p>
                <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                  {opt.description}
                </p>
              </div>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
