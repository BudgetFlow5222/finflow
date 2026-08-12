import * as React from "react";
import { cn } from "@/lib/utils";

type Variant = "neutral" | "success" | "warning" | "danger" | "info" | "primary";

const variants: Record<Variant, string> = {
  neutral: "bg-muted text-muted-foreground border-border",
  success: "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200 border-emerald-500/30",
  warning: "bg-amber-500/15 text-amber-800 dark:text-amber-200 border-amber-500/30",
  danger: "bg-red-500/15 text-red-800 dark:text-red-200 border-red-500/30",
  info: "bg-cyan-500/15 text-cyan-800 dark:text-cyan-200 border-cyan-500/30",
  primary: "bg-primary/15 text-primary border-primary/30",
};

export function StatusBadge({
  variant = "neutral",
  children,
  className,
  dot = true,
}: {
  variant?: Variant;
  children: React.ReactNode;
  className?: string;
  dot?: boolean;
}) {
  const dotColors: Record<Variant, string> = {
    neutral: "bg-muted-foreground",
    success: "bg-emerald-500",
    warning: "bg-amber-500",
    danger: "bg-red-500",
    info: "bg-cyan-500",
    primary: "bg-primary",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        variants[variant],
        className,
      )}
    >
      {dot && <span className={cn("h-1.5 w-1.5 rounded-full", dotColors[variant])} />}
      {children}
    </span>
  );
}

// Helpers for invoice / AR-AP statuses
export function invoiceStatusVariant(s: string): Variant {
  switch (s) {
    case "PAID":
      return "success";
    case "PARTIALLY_PAID":
      return "warning";
    case "OVERDUE":
      return "danger";
    case "SENT":
      return "info";
    case "CANCELLED":
      return "neutral";
    default:
      return "neutral"; // DRAFT
  }
}

export function arApStatusVariant(s: string): Variant {
  switch (s) {
    case "PAID":
      return "success";
    case "PARTIALLY_PAID":
      return "warning";
    case "OVERDUE":
      return "danger";
    default:
      return "info"; // OUTSTANDING
  }
}

export function accountStatusVariant(s: string): Variant {
  switch (s) {
    case "ACTIVE":
      return "success";
    case "FROZEN":
      return "warning";
    default:
      return "neutral"; // CLOSED
  }
}
