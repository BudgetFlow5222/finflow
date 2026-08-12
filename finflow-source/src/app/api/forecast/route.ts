import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { round2 } from "@/lib/utils";

export const dynamic = "force-dynamic";

// GET /api/forecast — generate a 90-day cash flow forecast
// Predicts future liquidity based on:
// 1. Current account balances
// 2. Upcoming receivables (AR with due dates in the next 90 days)
// 3. Upcoming payables (AP with due dates in the next 90 days)
// 4. Recurring transactions (projected occurrences in the next 90 days)
// 5. Historical spending patterns (average daily expense)

export async function GET() {
  try {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const dayMs = 24 * 60 * 60 * 1000;
    const forecastDays = 90;

    const [accounts, ars, aps, recurring, sales, expenses] = await Promise.all([
      db.account.findMany({ where: { status: "ACTIVE" } }),
      db.accountsReceivable.findMany({
        where: { status: { in: ["OUTSTANDING", "PARTIALLY_PAID", "OVERDUE"] } },
        include: { customer: true, invoice: true },
      }),
      db.accountsPayable.findMany({
        where: { status: { in: ["OUTSTANDING", "PARTIALLY_PAID", "OVERDUE"] } },
        include: { vendor: true },
      }),
      db.recurringTransaction.findMany({ where: { status: "ACTIVE" } }),
      db.sale.findMany({
        where: { status: "COMPLETED", date: { gte: new Date(now.getTime() - 30 * dayMs) } },
      }),
      db.expense.findMany({
        where: { status: "COMPLETED", date: { gte: new Date(now.getTime() - 30 * dayMs) } },
      }),
    ]);

    const currentBalance = accounts.reduce((s, a) => s + a.currentBalance, 0);

    // Calculate average daily income and expenses from last 30 days
    const last30Income = sales.reduce((s, sale) => s + sale.total, 0);
    const last30Expenses = expenses.reduce((s, e) => s + e.total, 0);
    const avgDailyIncome = last30Income / 30;
    const avgDailyExpense = last30Expenses / 30;
    const avgDailyNet = avgDailyIncome - avgDailyExpense;

    // Build daily forecast array
    const forecast: {
      day: number;
      date: string;
      dateLabel: string;
      projectedBalance: number;
      inflow: number;
      outflow: number;
      net: number;
      events: { type: string; description: string; amount: number }[];
    }[] = [];

    // Collect scheduled events for each day
    const eventsByDay = new Map<number, { type: string; description: string; amount: number }[]>();

    // Helper to add an event to a specific day
    const addEvent = (dayOffset: number, type: string, description: string, amount: number) => {
      if (dayOffset < 0 || dayOffset > forecastDays) return;
      if (!eventsByDay.has(dayOffset)) eventsByDay.set(dayOffset, []);
      eventsByDay.get(dayOffset)!.push({ type, description, amount });
    };

    // Add AR due dates (inflow)
    for (const ar of ars) {
      const dueDate = new Date(ar.dueDate);
      dueDate.setHours(0, 0, 0, 0);
      const dayOffset = Math.round((dueDate.getTime() - now.getTime()) / dayMs);
      const remaining = ar.amount - ar.paidAmount;
      if (remaining > 0) {
        addEvent(
          Math.max(0, dayOffset),
          "receivable",
          `Payment from ${ar.customer?.name ?? "customer"} (${ar.invoice?.number ?? "—"})`,
          remaining,
        );
      }
    }

    // Add AP due dates (outflow)
    for (const ap of aps) {
      const dueDate = new Date(ap.dueDate);
      dueDate.setHours(0, 0, 0, 0);
      const dayOffset = Math.round((dueDate.getTime() - now.getTime()) / dayMs);
      const remaining = ap.amount - ap.paidAmount;
      if (remaining > 0) {
        addEvent(
          Math.max(0, dayOffset),
          "payable",
          `Payment to ${ap.vendor?.name ?? "vendor"}${ap.billNumber ? ` (${ap.billNumber})` : ""}`,
          -remaining,
        );
      }
    }

    // Add recurring transaction occurrences
    for (const rt of recurring) {
      let nextDate = new Date(rt.nextDate);
      nextDate.setHours(0, 0, 0, 0);
      const endDate = rt.endDate ? new Date(rt.endDate) : new Date(now.getTime() + forecastDays * dayMs);

      // Fast-forward if nextDate is in the past
      while (nextDate < now && nextDate < endDate) {
        nextDate = addInterval(nextDate, rt.frequency, rt.interval);
      }

      // Add occurrences within forecast window
      let count = 0;
      while (nextDate <= new Date(now.getTime() + forecastDays * dayMs) && nextDate <= endDate && count < 100) {
        const dayOffset = Math.round((nextDate.getTime() - now.getTime()) / dayMs);
        if (dayOffset >= 0 && dayOffset <= forecastDays) {
          addEvent(
            dayOffset,
            "recurring",
            `${rt.name} (recurring ${rt.type.toLowerCase()})`,
            rt.type === "INCOME" ? rt.amount : -rt.amount,
          );
        }
        nextDate = addInterval(nextDate, rt.frequency, rt.interval);
        count++;
      }
    }

    // Build the daily forecast
    let runningBalance = currentBalance;
    for (let d = 0; d <= forecastDays; d++) {
      const date = new Date(now.getTime() + d * dayMs);
      const dayEvents = eventsByDay.get(d) || [];

      let dayInflow = 0;
      let dayOutflow = 0;

      for (const event of dayEvents) {
        if (event.amount > 0) dayInflow += event.amount;
        else dayOutflow += Math.abs(event.amount);
      }

      // Add average daily net (historical pattern) as baseline
      // Only for days without scheduled events, use the average
      const hasScheduledEvents = dayEvents.length > 0;
      const baselineNet = hasScheduledEvents ? avgDailyNet * 0.5 : avgDailyNet; // reduce baseline if events exist

      const scheduledNet = dayInflow - dayOutflow;
      const dayNet = scheduledNet + baselineNet;
      runningBalance += dayNet;

      forecast.push({
        day: d,
        date: date.toISOString(),
        dateLabel: date.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
        projectedBalance: round2(runningBalance),
        inflow: round2(dayInflow + (baselineNet > 0 ? baselineNet : 0)),
        outflow: round2(dayOutflow + (baselineNet < 0 ? Math.abs(baselineNet) : 0)),
        net: round2(dayNet),
        events: dayEvents,
      });
    }

    // Compute key metrics
    const balance30 = forecast[30]?.projectedBalance ?? currentBalance;
    const balance60 = forecast[60]?.projectedBalance ?? currentBalance;
    const balance90 = forecast[90]?.projectedBalance ?? currentBalance;

    // Find the minimum projected balance (cash crunch detection)
    let minBalance = currentBalance;
    let minBalanceDay = 0;
    let minBalanceDate = now.toISOString();
    for (const f of forecast) {
      if (f.projectedBalance < minBalance) {
        minBalance = f.projectedBalance;
        minBalanceDay = f.day;
        minBalanceDate = f.date;
      }
    }

    // Find when balance hits zero (if ever)
    let zeroDay: number | null = null;
    for (const f of forecast) {
      if (f.projectedBalance < 0) {
        zeroDay = f.day;
        break;
      }
    }

    // Upcoming events (next 14 days)
    const upcomingEvents = forecast
      .filter((f) => f.day <= 14 && f.events.length > 0)
      .flatMap((f) =>
        f.events.map((e) => ({
          ...e,
          day: f.day,
          date: f.date,
          dateLabel: f.dateLabel,
        })),
      )
      .sort((a, b) => a.day - b.day);

    const result = {
      currentBalance: round2(currentBalance),
      avgDailyIncome: round2(avgDailyIncome),
      avgDailyExpense: round2(avgDailyExpense),
      avgDailyNet: round2(avgDailyNet),
      projections: {
        day30: round2(balance30),
        day60: round2(balance60),
        day90: round2(balance90),
      },
      minBalance: round2(minBalance),
      minBalanceDay,
      minBalanceDate,
      zeroDay, // null if never hits zero
      runwayDays: zeroDay ?? (avgDailyExpense > 0 ? Math.round(currentBalance / avgDailyExpense) : 999),
      forecast: forecast.filter((_, i) => i % 3 === 0 || i === forecastDays), // sample every 3 days for chart
      upcomingEvents,
      summary: {
        status:
          minBalance < 0
            ? "danger"
            : minBalance < currentBalance * 0.2
              ? "warning"
              : "healthy",
        message:
          minBalance < 0
            ? `Cash crunch predicted on day ${minBalanceDay} — balance goes negative`
            : minBalance < currentBalance * 0.2
              ? `Low point of ${round2(minBalance).toLocaleString("en-IN", { style: "currency", currency: "INR" })} on day ${minBalanceDay}`
              : "Healthy cash flow projected for the next 90 days",
      },
    };

    return NextResponse.json(result);
  } catch (e) {
    console.error("[FORECAST ERROR]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 },
    );
  }
}

function addInterval(date: Date, frequency: string, interval: number): Date {
  const d = new Date(date);
  switch (frequency) {
    case "DAILY":
      d.setDate(d.getDate() + interval);
      break;
    case "WEEKLY":
      d.setDate(d.getDate() + 7 * interval);
      break;
    case "MONTHLY":
      d.setMonth(d.getMonth() + interval);
      break;
    case "QUARTERLY":
      d.setMonth(d.getMonth() + 3 * interval);
      break;
    case "YEARLY":
      d.setFullYear(d.getFullYear() + interval);
      break;
  }
  return d;
}
