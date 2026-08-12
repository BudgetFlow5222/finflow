"use client";

import * as React from "react";
import { Clock, AlertCircle } from "lucide-react";
import { daysUntil, cn } from "@/lib/utils";

type Tone = "danger" | "warning" | "info" | "neutral";

const toneClasses: Record<Tone, string> = {
  danger:
    "bg-red-500/15 text-red-700 dark:text-red-300 ring-1 ring-inset ring-red-500/30",
  warning:
    "bg-amber-500/15 text-amber-700 dark:text-amber-300 ring-1 ring-inset ring-amber-500/30",
  info: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 ring-1 ring-inset ring-cyan-500/30",
  neutral:
    "bg-muted text-muted-foreground ring-1 ring-inset ring-border",
};

/**
 * Compact countdown pill that visualises how soon an AR/AP item is due.
 *
 * Color coding:
 *  - Overdue (days < 0):    red — "Overdue Nd"
 *  - Due today (days === 0): red — "Due today"
 *  - Due in 1-3 days:        red — "Due in Nd"
 *  - Due in 4-7 days:        amber — "Due in Nd"
 *  - Due in 8-30 days:       cyan — "Nd left"
 *  - Due in 31+ days:        muted — "Nd left"
 *  - PAID:                   returns null (no badge needed)
 */
export function CountdownBadge({
  dueDate,
  status,
  className,
}: {
  dueDate: string;
  status: string;
  className?: string;
}) {
  if (status === "PAID") return null;

  const days = daysUntil(dueDate);
  const isOverdue = days < 0;

  let tone: Tone;
  let label: string;
  let Icon: React.ComponentType<{ className?: string }>;

  if (isOverdue) {
    const absDays = Math.abs(days);
    tone = "danger";
    label = `Overdue ${absDays}d`;
    Icon = Clock;
  } else if (days === 0) {
    tone = "danger";
    label = "Due today";
    Icon = AlertCircle;
  } else if (days <= 3) {
    tone = "danger";
    label = `Due in ${days}d`;
    Icon = Clock;
  } else if (days <= 7) {
    tone = "warning";
    label = `Due in ${days}d`;
    Icon = Clock;
  } else if (days <= 30) {
    tone = "info";
    label = `${days}d left`;
    Icon = Clock;
  } else {
    tone = "neutral";
    label = `${days}d left`;
    Icon = Clock;
  }

  return (
    <span
      title={label}
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-medium tabular-nums",
        toneClasses[tone],
        className,
      )}
    >
      <Icon className="h-2.5 w-2.5 shrink-0" />
      {label}
    </span>
  );
}
