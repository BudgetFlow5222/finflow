import { db } from "@/lib/db";
import { ok, serverError, badRequest } from "@/lib/api";
import { refreshOverdueStatuses } from "@/services/finance";
import type {
  CalendarEvent,
  CalendarEventStatus,
} from "@/types";

export const dynamic = "force-dynamic";

// Color palette for event dots (matches spec).
const COLORS = {
  bill: "#f43f5e", // rose
  invoice: "#8b5cf6", // violet
  recurring: "#06b6d4", // cyan
  goal: "#10b981", // emerald
} as const;

const MONTH_RE = /^\d{4}-\d{2}$/;

// ---------------------------------------------------------------------------
// Date helpers (local-time, no TZ drift)
// ---------------------------------------------------------------------------

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addInterval(date: Date, frequency: string, interval: number): Date {
  const d = new Date(date);
  switch (frequency) {
    case "DAILY":
      d.setDate(d.getDate() + interval);
      break;
    case "WEEKLY":
      d.setDate(d.getDate() + interval * 7);
      break;
    case "MONTHLY":
      d.setMonth(d.getMonth() + interval);
      break;
    case "QUARTERLY":
      d.setMonth(d.getMonth() + interval * 3);
      break;
    case "YEARLY":
      d.setFullYear(d.getFullYear() + interval);
      break;
    default:
      break;
  }
  return d;
}

function computeStatus(dueDate: Date, today: Date): CalendarEventStatus {
  const due = startOfDay(dueDate).getTime();
  const tod = startOfDay(today).getTime();
  if (due < tod) return "overdue";
  if (due === tod) return "due_today";
  return "upcoming";
}

// Fast-forward a recurring cursor close to the target window for fixed-step
// frequencies (DAILY/WEEKLY) so we don't burn iterations on ancient nextDates.
function fastForward(
  cursor: Date,
  frequency: string,
  interval: number,
  target: Date,
): Date {
  if (cursor >= target) return cursor;
  if (frequency === "DAILY" || frequency === "WEEKLY") {
    const dayStep = frequency === "DAILY" ? interval : interval * 7;
    const msPerStep = dayStep * 86_400_000;
    const diffMs = target.getTime() - cursor.getTime();
    if (diffMs > msPerStep) {
      const stepsToSkip = Math.floor(diffMs / msPerStep);
      if (stepsToSkip > 0) {
        return new Date(cursor.getTime() + stepsToSkip * msPerStep);
      }
    }
  }
  return cursor;
}

// ---------------------------------------------------------------------------
// GET /api/calendar?month=YYYY-MM
// ---------------------------------------------------------------------------

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const month = searchParams.get("month");

    if (!month || !MONTH_RE.test(month)) {
      return badRequest("Invalid month. Expected format: YYYY-MM");
    }

    const [y, m] = month.split("-").map(Number);
    if (!y || !m || m < 1 || m > 12) {
      return badRequest("Invalid month value.");
    }

    // Make sure AP/AR statuses are fresh.
    await refreshOverdueStatuses();

    const monthStart = new Date(y, m - 1, 1);
    const monthEnd = new Date(y, m, 1);
    const today = new Date();
    const monthStartIso = toISODate(monthStart);

    const [aps, ars, recurring, goals] = await Promise.all([
      db.accountsPayable.findMany({ include: { vendor: true } }),
      db.accountsReceivable.findMany({
        include: { customer: true, invoice: true },
      }),
      db.recurringTransaction.findMany({
        where: { status: "ACTIVE" },
        include: { account: true, category: true, vendor: true, customer: true },
      }),
      db.savingsGoal.findMany(),
    ]);

    const events: CalendarEvent[] = [];

    // 1. AccountsPayable — bills due this month + overdue carry-overs
    for (const ap of aps) {
      if (ap.status === "PAID") continue;
      const due = new Date(ap.dueDate);
      const dueIso = toISODate(due);
      const isOverdue =
        ap.status === "OVERDUE" || (due < today && ap.status !== "PAID");
      const remaining = ap.amount - ap.paidAmount;
      const vendorName = ap.vendor?.name ?? "Vendor";
      const title = ap.billNumber
        ? `Bill ${ap.billNumber}`
        : `Bill — ${vendorName}`;
      const description = `Vendor: ${vendorName}${ap.notes ? ` · ${ap.notes}` : ""}`;

      if (due >= monthStart && due < monthEnd) {
        const status = computeStatus(due, today);
        events.push({
          id: `ap-${ap.id}`,
          date: dueIso,
          type: isOverdue && status === "overdue" ? "bill_overdue" : "bill_due",
          title,
          amount: remaining,
          status,
          entity: "ap",
          entityId: ap.id,
          description,
          color: COLORS.bill,
        });
      } else if (isOverdue && due < monthStart) {
        // Surface overdue carry-overs at the top of the selected month.
        events.push({
          id: `ap-overdue-${ap.id}`,
          date: monthStartIso,
          type: "bill_overdue",
          title: `Overdue — ${ap.billNumber ?? vendorName}`,
          amount: remaining,
          status: "overdue",
          entity: "ap",
          entityId: ap.id,
          description: `Originally due ${dueIso} · ${vendorName}`,
          color: COLORS.bill,
        });
      }
    }

    // 2. AccountsReceivable — invoices due this month + overdue carry-overs
    for (const ar of ars) {
      if (ar.status === "PAID") continue;
      const due = new Date(ar.dueDate);
      const dueIso = toISODate(due);
      const isOverdue =
        ar.status === "OVERDUE" || (due < today && ar.status !== "PAID");
      const remaining = ar.amount - ar.paidAmount;
      const invoiceNum = ar.invoice?.number ?? "—";
      const customerName = ar.customer?.name ?? "Customer";
      const description = `Customer: ${customerName}${
        ar.invoice?.notes ? ` · ${ar.invoice.notes}` : ""
      }`;

      if (due >= monthStart && due < monthEnd) {
        const status = computeStatus(due, today);
        events.push({
          id: `ar-${ar.id}`,
          date: dueIso,
          type:
            isOverdue && status === "overdue"
              ? "invoice_overdue"
              : "invoice_due",
          title: `Invoice ${invoiceNum}`,
          amount: remaining,
          status,
          entity: "ar",
          entityId: ar.id,
          description,
          color: COLORS.invoice,
        });
      } else if (isOverdue && due < monthStart) {
        events.push({
          id: `ar-overdue-${ar.id}`,
          date: monthStartIso,
          type: "invoice_overdue",
          title: `Overdue — Invoice ${invoiceNum}`,
          amount: remaining,
          status: "overdue",
          entity: "ar",
          entityId: ar.id,
          description: `Originally due ${dueIso} · ${customerName}`,
          color: COLORS.invoice,
        });
      }
    }

    // 3. Recurring transactions — occurrences within the selected month
    const MAX_ITER = 5000;
    for (const rt of recurring) {
      if (rt.status !== "ACTIVE") continue;
      const startDate = new Date(rt.nextDate);
      const endDate = rt.endDate ? new Date(rt.endDate) : null;
      let cursor = new Date(startDate);
      let iter = 0;

      // Fast-forward for fixed-step frequencies, then iterate to monthStart.
      cursor = fastForward(cursor, rt.frequency, rt.interval, monthStart);
      while (cursor < monthStart && iter < MAX_ITER) {
        if (endDate && cursor > endDate) break;
        cursor = addInterval(cursor, rt.frequency, rt.interval);
        iter++;
      }

      // Collect occurrences within [monthStart, monthEnd).
      while (cursor < monthEnd && iter < MAX_ITER) {
        if (endDate && cursor > endDate) break;
        const occIso = toISODate(cursor);
        const status = computeStatus(cursor, today);
        const sign = rt.type === "INCOME" ? "+" : "-";
        const unit = rt.frequency.toLowerCase().replace("ly", "");
        events.push({
          id: `recur-${rt.id}-${occIso}`,
          date: occIso,
          type: "recurring",
          title: rt.name,
          amount: rt.amount,
          status,
          entity: "recurring",
          entityId: rt.id,
          description: `${rt.type === "INCOME" ? "Income" : "Expense"} · every ${rt.interval} ${unit} · ${sign}${rt.amount.toFixed(2)}`,
          color: COLORS.recurring,
        });
        cursor = addInterval(cursor, rt.frequency, rt.interval);
        iter++;
      }
    }

    // 4. SavingsGoals — target date within the selected month
    for (const goal of goals) {
      if (!goal.targetDate) continue;
      if (goal.status === "COMPLETED") continue;
      const target = new Date(goal.targetDate);
      if (target >= monthStart && target < monthEnd) {
        const status = computeStatus(target, today);
        const remaining = goal.targetAmount - goal.savedAmount;
        events.push({
          id: `goal-${goal.id}`,
          date: toISODate(target),
          type: "goal_deadline",
          title: `Goal: ${goal.name}`,
          amount: remaining,
          status,
          entity: "goal",
          entityId: goal.id,
          description: `Target: ₹${goal.targetAmount.toFixed(2)} · Saved: ₹${goal.savedAmount.toFixed(2)}${goal.notes ? ` · ${goal.notes}` : ""}`,
          color: COLORS.goal,
        });
      }
    }

    // Sort by date ascending, then by type for stable ordering.
    events.sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1;
      return a.type.localeCompare(b.type);
    });

    return ok(events);
  } catch (e) {
    return serverError(e);
  }
}
