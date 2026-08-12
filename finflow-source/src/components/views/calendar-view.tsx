"use client";

import * as React from "react";
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  RefreshCw,
  Receipt,
  FileText,
  Repeat,
  Target,
  AlertTriangle,
  Clock,
  CalendarCheck,
  CircleDot,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCalendar } from "@/hooks/use-finance";
import { useUI } from "@/hooks/use-ui";
import { useCurrency } from "@/hooks/use-currency";
import { formatMoney } from "@/lib/currency";
import { monthKey, cn } from "@/lib/utils";
import { CountdownBadge } from "@/components/views/countdown-badge";
import type { ViewKey } from "@/components/app/sidebar";
import type {
  CalendarEvent,
  CalendarEventEntity,
  CalendarEventType,
  CalendarEventStatus,
} from "@/types";

// ---------------------------------------------------------------------------
// Static metadata for event types
// ---------------------------------------------------------------------------

interface TypeMeta {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}

const TYPE_META: Record<CalendarEventType, TypeMeta> = {
  bill_due: { label: "Bill Due", icon: Receipt, color: "#f43f5e" },
  bill_overdue: { label: "Bill Overdue", icon: AlertTriangle, color: "#f43f5e" },
  invoice_due: { label: "Invoice Due", icon: FileText, color: "#8b5cf6" },
  invoice_overdue: {
    label: "Invoice Overdue",
    icon: AlertTriangle,
    color: "#8b5cf6",
  },
  recurring: { label: "Recurring", icon: Repeat, color: "#06b6d4" },
  goal_deadline: { label: "Goal Deadline", icon: Target, color: "#10b981" },
};

const LEGEND: { type: CalendarEventType; label: string }[] = [
  { type: "bill_due", label: "Bills" },
  { type: "invoice_due", label: "Invoices" },
  { type: "recurring", label: "Recurring" },
  { type: "goal_deadline", label: "Goals" },
];

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Navigation target for each entity type.
const ENTITY_VIEW: Record<CalendarEventEntity, ViewKey> = {
  ap: "payables",
  ar: "receivables",
  recurring: "recurring",
  goal: "goals",
  invoice: "invoices",
};

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function longMonthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  if (!y || !m) return key;
  return new Date(y, m - 1, 1).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });
}

function shiftMonth(key: string, delta: number): string {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return monthKey(d);
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function isWeekend(d: Date): boolean {
  const day = d.getDay();
  return day === 0 || day === 6;
}

// Build the 6-row (42-cell) calendar grid for a given month key.
function buildGrid(month: string): Date[] {
  const [y, m] = month.split("-").map(Number);
  const firstOfMonth = new Date(y, m - 1, 1);
  const startWeekday = firstOfMonth.getDay(); // 0 = Sunday
  const gridStart = new Date(y, m - 1, 1 - startWeekday);
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    return d;
  });
}

function statusBadgeClass(status: CalendarEventStatus): string {
  switch (status) {
    case "overdue":
      return "bg-rose-500/15 text-rose-700 dark:text-rose-300";
    case "due_today":
      return "bg-amber-500/15 text-amber-700 dark:text-amber-300";
    default:
      return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  }
}

function statusLabel(status: CalendarEventStatus): string {
  switch (status) {
    case "overdue":
      return "Overdue";
    case "due_today":
      return "Due today";
    default:
      return "Upcoming";
  }
}

// ---------------------------------------------------------------------------
// Main view
// ---------------------------------------------------------------------------

export function CalendarView() {
  const today = React.useMemo(() => new Date(), []);
  const [month, setMonth] = React.useState<string>(() => monthKey(today));
  const { data: events, isLoading, refetch, isFetching } = useCalendar(month);
  const { setView } = useUI();
  const { currency } = useCurrency();
  const [selectedDate, setSelectedDate] = React.useState<string | null>(null);

  const grid = React.useMemo(() => buildGrid(month), [month]);
  const [y, m] = month.split("-").map(Number);
  const monthStartIso = toISODate(new Date(y, m - 1, 1));

  // Index events by ISO date.
  const byDate = React.useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const ev of events ?? []) {
      const list = map.get(ev.date) ?? [];
      list.push(ev);
      map.set(ev.date, list);
    }
    return map;
  }, [events]);

  // Summary aggregates.
  const summary = React.useMemo(() => {
    const list = events ?? [];
    const bills = list.filter(
      (e) => e.type === "bill_due" || e.type === "bill_overdue",
    );
    const invoices = list.filter(
      (e) => e.type === "invoice_due" || e.type === "invoice_overdue",
    );
    const recurring = list.filter((e) => e.type === "recurring");
    const overdue = list.filter(
      (e) => e.status === "overdue" || e.type === "bill_overdue" || e.type === "invoice_overdue",
    );
    return {
      billsTotal: bills.reduce((s, e) => s + e.amount, 0),
      billsCount: bills.length,
      invoicesTotal: invoices.reduce((s, e) => s + e.amount, 0),
      invoicesCount: invoices.length,
      recurringTotal: recurring.reduce((s, e) => s + e.amount, 0),
      recurringCount: recurring.length,
      overdueCount: overdue.length,
    };
  }, [events]);

  // Upcoming events (next 5 chronologically from today).
  const upcoming = React.useMemo(() => {
    const todayIso = toISODate(today);
    return (events ?? [])
      .filter((e) => e.date >= todayIso)
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
      .slice(0, 5);
  }, [events, today]);

  const selectedEvents = selectedDate ? byDate.get(selectedDate) ?? [] : [];

  const navigateToEntity = (entity: CalendarEventEntity) => {
    const target = ENTITY_VIEW[entity];
    if (target) setView(target);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9"
            onClick={() => setMonth((m) => shiftMonth(m, -1))}
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9"
            onClick={() => setMonth((m) => shiftMonth(m, 1))}
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2 px-1">
            <CalendarDays className="h-4 w-4 text-emerald-500" />
            <h2 className="text-base font-semibold">{longMonthLabel(month)}</h2>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="ml-1 gap-1.5"
            onClick={() => setMonth(monthKey(new Date()))}
          >
            <CalendarCheck className="h-3.5 w-3.5" /> Today
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Legend */}
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            {LEGEND.map((l) => {
              const meta = TYPE_META[l.type];
              return (
                <span key={l.type} className="inline-flex items-center gap-1.5">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: meta.color }}
                  />
                  {l.label}
                </span>
              );
            })}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw
              className={cn("h-3.5 w-3.5", isFetching && "animate-spin")}
            />
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary strip */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          label="Bills Due"
          icon={Receipt}
          color="#f43f5e"
          count={summary.billsCount}
          total={summary.billsTotal}
          currency={currency}
        />
        <SummaryCard
          label="Invoices Due"
          icon={FileText}
          color="#8b5cf6"
          count={summary.invoicesCount}
          total={summary.invoicesTotal}
          currency={currency}
        />
        <SummaryCard
          label="Recurring"
          icon={Repeat}
          color="#06b6d4"
          count={summary.recurringCount}
          total={summary.recurringTotal}
          currency={currency}
        />
        <SummaryCard
          label="Overdue"
          icon={AlertTriangle}
          color="#f59e0b"
          count={summary.overdueCount}
          total={null}
          currency={currency}
        />
      </div>

      {/* Main grid: calendar + side panel */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Calendar grid */}
        <Card className="lg:col-span-2">
          <CardContent className="p-3 sm:p-4">
            {isLoading ? (
              <CalendarSkeleton />
            ) : (
              <div>
                {/* Weekday header */}
                <div className="grid grid-cols-7 gap-1">
                  {WEEKDAYS.map((w) => (
                    <div
                      key={w}
                      className="py-2 text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
                    >
                      {w}
                    </div>
                  ))}
                </div>
                {/* Day cells */}
                <div className="grid grid-cols-7 gap-1">
                  {grid.map((d) => {
                    const iso = toISODate(d);
                    const inMonth = d.getMonth() === m - 1 && d.getFullYear() === y;
                    const isToday = isSameDay(d, today);
                    const weekend = isWeekend(d);
                    const dayEvents = byDate.get(iso) ?? [];
                    const visible = dayEvents.slice(0, 3);
                    const overflow = dayEvents.length - visible.length;
                    return (
                      <button
                        key={iso}
                        type="button"
                        onClick={() => setSelectedDate(iso)}
                        className={cn(
                          "group relative flex min-h-[88px] flex-col gap-1 rounded-lg border p-1.5 text-left transition-colors",
                          "hover:border-primary/40 hover:bg-accent/40",
                          inMonth
                            ? "border-border bg-card"
                            : "border-transparent bg-muted/30 text-muted-foreground",
                          weekend && inMonth && "bg-muted/20",
                          isToday && "ring-2 ring-emerald-500/60 ring-offset-1 ring-offset-background",
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <span
                            className={cn(
                              "inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold tabular",
                              isToday
                                ? "bg-emerald-500 text-white"
                                : inMonth
                                  ? "text-foreground"
                                  : "text-muted-foreground/60",
                            )}
                          >
                            {d.getDate()}
                          </span>
                          {dayEvents.length > 0 && (
                            <span className="text-[9px] font-medium text-muted-foreground">
                              {dayEvents.length}
                            </span>
                          )}
                        </div>

                        <div className="flex flex-col gap-0.5">
                          {visible.map((ev) => {
                            const meta = TYPE_META[ev.type];
                            const isOverdueType = ev.type === "bill_overdue" || ev.type === "invoice_overdue" || ev.status === "overdue";
                            return (
                              <span
                                key={ev.id}
                                className={cn(
                                  "flex items-center gap-1 truncate rounded px-1 py-0.5 text-[10px] font-medium leading-tight",
                                  isOverdueType && "ring-1 ring-rose-500/30",
                                )}
                                style={{
                                  backgroundColor: isOverdueType
                                    ? `${meta.color}26`
                                    : `${meta.color}1a`,
                                  color: meta.color,
                                }}
                                title={`${ev.title} · ${formatMoney(ev.amount, currency)}`}
                              >
                                <meta.icon className="h-2.5 w-2.5 shrink-0" />
                                <span className="truncate">{ev.title}</span>
                              </span>
                            );
                          })}
                          {overflow > 0 && (
                            <span className="px-1 text-[10px] font-medium text-muted-foreground">
                              +{overflow} more
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Side panel — upcoming events */}
        <Card>
          <CardContent className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="flex items-center gap-2 text-sm font-semibold">
                  <Clock className="h-4 w-4 text-emerald-500" />
                  Upcoming Events
                </h3>
                <p className="text-xs text-muted-foreground">
                  Next 5 chronological events
                </p>
              </div>
            </div>

            {upcoming.length > 0 ? (
              <ul className="space-y-2">
                {upcoming.map((ev) => (
                  <UpcomingItem
                    key={ev.id}
                    event={ev}
                    currency={currency}
                    onClick={() => navigateToEntity(ev.entity)}
                  />
                ))}
              </ul>
            ) : (
              <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500">
                  <CalendarCheck className="h-6 w-6" />
                </div>
                <p className="text-sm font-semibold">Nothing on the horizon</p>
                <p className="text-xs text-muted-foreground">
                  No upcoming events for the rest of this month.
                </p>
              </div>
            )}

            {events && events.length > 0 && (
              <div className="mt-4 border-t border-border pt-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {monthStartIso === toISODate(today)
                    ? "This month"
                    : longMonthLabel(month)}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">
                    {events.length}
                  </span>{" "}
                  total events ·{" "}
                  <span className="font-semibold text-rose-600 dark:text-rose-400">
                    {summary.overdueCount}
                  </span>{" "}
                  overdue
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Day detail dialog */}
      <Dialog
        open={Boolean(selectedDate)}
        onOpenChange={(o) => !o && setSelectedDate(null)}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CircleDot className="h-4 w-4 text-emerald-500" />
              {selectedDate
                ? new Date(selectedDate).toLocaleDateString("en-IN", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })
                : ""}
            </DialogTitle>
            <DialogDescription>
              {selectedEvents.length === 0
                ? "No events on this day."
                : `${selectedEvents.length} event${selectedEvents.length === 1 ? "" : "s"} scheduled.`}
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
            {selectedEvents.map((ev) => {
              const meta = TYPE_META[ev.type];
              return (
                <div
                  key={ev.id}
                  className="flex items-start gap-3 rounded-lg border border-border bg-card p-3"
                >
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                    style={{ backgroundColor: `${meta.color}1a`, color: meta.color }}
                  >
                    <meta.icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{ev.title}</p>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          {meta.label}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                          statusBadgeClass(ev.status),
                        )}
                      >
                        {statusLabel(ev.status)}
                      </span>
                    </div>
                    {ev.description && (
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        {ev.description}
                      </p>
                    )}
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold tabular">
                        {formatMoney(ev.amount, currency)}
                      </span>
                      <CountdownBadge dueDate={ev.date} status={ev.status} className="text-[10px]" />
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-2 h-7 w-full gap-1 text-[11px]"
                      onClick={() => {
                        navigateToEntity(ev.entity);
                        setSelectedDate(null);
                      }}
                    >
                      View Details
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SummaryCard({
  label,
  icon: Icon,
  color,
  count,
  total,
  currency,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  count: number;
  total: number | null;
  currency: import("@/lib/currency").CurrencyCode;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-lg"
              style={{ backgroundColor: `${color}1a`, color }}
            >
              <Icon className="h-4 w-4" />
            </div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {label}
            </p>
          </div>
          <span className="text-xs font-semibold tabular text-foreground">
            {count}
          </span>
        </div>
        <div className="mt-2">
          {total !== null ? (
            <p className="text-xl font-semibold tabular">{formatMoney(total, currency)}</p>
          ) : (
            <p className="text-xl font-semibold tabular text-rose-600 dark:text-rose-400">
              {count}
            </p>
          )}
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {total !== null
              ? `${count} item${count === 1 ? "" : "s"} this month`
              : `need${count === 1 ? "s" : ""} attention`}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function UpcomingItem({
  event,
  onClick,
  currency,
}: {
  event: CalendarEvent;
  onClick: () => void;
  currency: import("@/lib/currency").CurrencyCode;
}) {
  const meta = TYPE_META[event.type];
  const date = new Date(event.date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round(
    (date.getTime() - today.getTime()) / 86_400_000,
  );
  const relative =
    diffDays === 0
      ? "Today"
      : diffDays === 1
        ? "Tomorrow"
        : diffDays < 7
          ? `In ${diffDays} days`
          : date.toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short",
            });

  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-start gap-3 rounded-lg border border-border bg-card p-2.5 text-left transition-colors hover:border-primary/40 hover:bg-accent/40"
      >
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
          style={{ backgroundColor: `${meta.color}1a`, color: meta.color }}
        >
          <meta.icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="truncate text-sm font-semibold">{event.title}</p>
            <span
              className={cn(
                "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                statusBadgeClass(event.status),
              )}
            >
              {statusLabel(event.status)}
            </span>
          </div>
          <div className="mt-1 flex items-center justify-between gap-2">
            <span className="text-[11px] text-muted-foreground">{relative}</span>
            <span className="text-xs font-semibold tabular">
              {formatMoney(event.amount, currency)}
            </span>
          </div>
          <CountdownBadge dueDate={event.date} status={event.status} className="mt-1.5" />
        </div>
      </button>
    </li>
  );
}

function CalendarSkeleton() {
  return (
    <div>
      <div className="grid grid-cols-7 gap-1">
        {WEEKDAYS.map((w) => (
          <div
            key={w}
            className="py-2 text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
          >
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: 42 }).map((_, i) => (
          <Skeleton key={i} className="h-[88px] rounded-lg" />
        ))}
      </div>
    </div>
  );
}
