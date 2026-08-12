import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ---------------------------------------------------------------------------
// Currency & number formatting
// ---------------------------------------------------------------------------

export function formatCurrency(
  amount: number,
  currency = "INR",
  opts: { compact?: boolean; sign?: boolean } = {},
): string {
  const { compact = false, sign = false } = opts;
  const formatter = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: compact ? 1 : 2,
    minimumFractionDigits: compact ? 0 : 2,
  });
  const formatted = formatter.format(Math.abs(amount));
  if (sign) {
    if (amount < 0) return `-${formatted}`;
    if (amount > 0) return `+${formatted}`;
  }
  return formatted;
}

export function formatNumber(n: number, opts: { compact?: boolean } = {}): string {
  return new Intl.NumberFormat("en-IN", {
    notation: opts.compact ? "compact" : "standard",
    maximumFractionDigits: 2,
  }).format(n);
}

export function formatPercent(value: number, digits = 1): string {
  return `${value >= 0 ? "" : ""}${value.toFixed(digits)}%`;
}

// ---------------------------------------------------------------------------
// Date formatting
// ---------------------------------------------------------------------------

export function formatDate(date: string | Date, fmt: "short" | "long" | "datetime" = "short"): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (fmt === "datetime") {
    return d.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
  }
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: fmt === "long" ? "long" : "short",
    year: "numeric",
  });
}

export function relativeTime(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const diff = d.getTime() - now.getTime();
  const abs = Math.abs(diff);
  const day = 86400000;
  if (abs < day) {
    const hours = Math.round(abs / 3600000);
    return diff < 0 ? `${hours}h ago` : `in ${hours}h`;
  }
  const days = Math.round(abs / day);
  if (days < 30) return diff < 0 ? `${days}d ago` : `in ${days}d`;
  const months = Math.round(days / 30);
  return diff < 0 ? `${months}mo ago` : `in ${months}mo`;
}

export function daysUntil(date: string | Date): number {
  const d = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  return Math.ceil((d.getTime() - now.getTime()) / 86400000);
}

export function monthKey(date: Date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
}

export function lastNMonthKeys(n: number, ref: Date = new Date()): string[] {
  const keys: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(ref.getFullYear(), ref.getMonth() - i, 1);
    keys.push(monthKey(d));
  }
  return keys;
}

// ---------------------------------------------------------------------------
// Misc
// ---------------------------------------------------------------------------

export function generateInvoiceNumber(existing: number = 0): string {
  const year = new Date().getFullYear();
  const seq = String(existing + 1).padStart(4, "0");
  return `INV-${year}-${seq}`;
}

export function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

// Stable color palette for charts (emerald-based finance palette).
export const FINANCE_PALETTE = [
  "#10b981", // emerald-500
  "#14b8a6", // teal-500
  "#06b6d4", // cyan-500
  "#84cc16", // lime-500
  "#eab308", // yellow-500
  "#f97316", // orange-500
  "#ef4444", // red-500
  "#ec4899", // pink-500
  "#8b5cf6", // violet-500
  "#6366f1", // indigo-500 (kept for variety, not used as primary)
];

export function colorForIndex(i: number): string {
  return FINANCE_PALETTE[i % FINANCE_PALETTE.length];
}
