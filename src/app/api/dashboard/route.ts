import { db } from "@/lib/db";
import { ok, serverError } from "@/lib/api";
import { refreshOverdueStatuses } from "@/services/finance";
import { monthKey, monthLabel, lastNMonthKeys, round2, FINANCE_PALETTE } from "@/lib/utils";
import type { DashboardData } from "@/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await refreshOverdueStatuses();

    const now = new Date();
    const curMonth = monthKey(now);
    const monthKeys = lastNMonthKeys(6, now);

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const [accounts, sales, expenses, invoices, ars, aps, budget, goalsResult] = await Promise.all([
      db.account.findMany({ orderBy: { createdAt: "asc" } }),
      db.sale.findMany({ where: { status: "COMPLETED" }, include: { customer: true } }),
      db.expense.findMany({
        where: { status: "COMPLETED" },
        include: { category: true, vendor: true },
      }),
      db.invoice.findMany({
        include: { customer: true, items: true },
        orderBy: { issueDate: "desc" },
        take: 8,
      }),
      db.accountsReceivable.findMany({
        include: { customer: true, invoice: true },
      }),
      db.accountsPayable.findMany({ include: { vendor: true } }),
      db.budget.findUnique({ where: { month: curMonth } }),
      db.savingsGoal.findMany({ orderBy: { createdAt: "asc" } }),
    ]);

    const totalBalance = round2(
      accounts
        .filter((a) => a.status === "ACTIVE")
        .reduce((s, a) => s + a.currentBalance, 0),
    );

    const monthlyIncome = round2(
      sales
        .filter((s) => s.date >= monthStart && s.date < monthEnd)
        .reduce((sum, s) => sum + s.total, 0),
    );

    const monthlyExpenses = round2(
      expenses
        .filter((e) => e.date >= monthStart && e.date < monthEnd)
        .reduce((sum, e) => sum + e.total, 0),
    );

    const netCashFlow = round2(monthlyIncome - monthlyExpenses);

    const outstandingAR = round2(
      ars
        .filter((ar) => ar.status !== "PAID")
        .reduce((s, ar) => s + (ar.amount - ar.paidAmount), 0),
    );

    const outstandingAP = round2(
      aps
        .filter((ap) => ap.status !== "PAID")
        .reduce((s, ap) => s + (ap.amount - ap.paidAmount), 0),
    );

    // Cash flow chart — last 6 months
    const cashFlow = monthKeys.map((k) => {
      const [y, m] = k.split("-").map(Number);
      const start = new Date(y, m - 1, 1);
      const end = new Date(y, m, 1);
      const income = round2(
        sales.filter((s) => s.date >= start && s.date < end).reduce((a, s) => a + s.total, 0),
      );
      const expense = round2(
        expenses.filter((e) => e.date >= start && e.date < end).reduce((a, e) => a + e.total, 0),
      );
      return { month: monthLabel(k), income, expense, net: round2(income - expense) };
    });

    // Budget split (50/30/20 allocations)
    const income = budget?.income ?? monthlyIncome;
    const needsPct = budget?.needsPct ?? 50;
    const wantsPct = budget?.wantsPct ?? 30;
    const savingsPct = budget?.savingsPct ?? 20;
    const needsBudget = round2((income * needsPct) / 100);
    const wantsBudget = round2((income * wantsPct) / 100);
    const savingsBudget = round2((income * savingsPct) / 100);

    // Monthly spent by budget type
    const monthlyExpensesWithBudget = expenses.filter(
      (e) => e.date >= monthStart && e.date < monthEnd,
    );
    const needsSpent = round2(
      monthlyExpensesWithBudget
        .filter((e) => (e.budgetType ?? (e.category?.budgetType ?? "NEED")) === "NEED")
        .reduce((s, e) => s + e.total, 0),
    );
    const wantsSpent = round2(
      monthlyExpensesWithBudget
        .filter((e) => (e.budgetType ?? e.category?.budgetType) === "WANT")
        .reduce((s, e) => s + e.total, 0),
    );
    const savingsSpent = round2(
      monthlyExpensesWithBudget
        .filter((e) => (e.budgetType ?? e.category?.budgetType) === "SAVINGS")
        .reduce((s, e) => s + e.total, 0),
    );
    const monthlySpent = {
      needs: needsSpent,
      wants: wantsSpent,
      savings: savingsSpent,
      total: round2(needsSpent + wantsSpent + savingsSpent),
    };

    const budgetSplit = [
      { name: "NEED" as const, value: needsBudget, pct: needsPct, spent: needsSpent },
      { name: "WANT" as const, value: wantsBudget, pct: wantsPct, spent: wantsSpent },
      { name: "SAVINGS" as const, value: savingsBudget, pct: savingsPct, spent: savingsSpent },
    ];

    const budgetUsedPct = needsBudget + wantsBudget + savingsBudget > 0
      ? round2((monthlySpent.total / (needsBudget + wantsBudget + savingsBudget)) * 100)
      : 0;

    // Expense breakdown by category (this month)
    const catMap = new Map<string, number>();
    for (const e of monthlyExpensesWithBudget) {
      const name = e.category?.name ?? "Uncategorized";
      catMap.set(name, (catMap.get(name) ?? 0) + e.total);
    }
    const expenseByCategory = Array.from(catMap.entries())
      .map(([name, value], i) => ({
        name,
        value: round2(value),
        color: FINANCE_PALETTE[i % FINANCE_PALETTE.length],
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);

    // Income by month (last 6)
    const incomeByMonth = monthKeys.map((k) => {
      const [y, m] = k.split("-").map(Number);
      const start = new Date(y, m - 1, 1);
      const end = new Date(y, m, 1);
      const value = round2(
        sales.filter((s) => s.date >= start && s.date < end).reduce((a, s) => a + s.total, 0),
      );
      return { month: monthLabel(k), value };
    });

    // Alerts
    const alerts: DashboardData["alerts"] = [];
    const overdueARs = ars.filter((ar) => ar.status === "OVERDUE");
    const overdueAPs = aps.filter((ap) => ap.status === "OVERDUE");
    for (const ar of overdueARs.slice(0, 3)) {
      alerts.push({
        type: "OVERDUE",
        message: `Invoice ${ar.invoice?.number ?? "—"} from ${ar.customer?.name ?? "customer"} is overdue`,
        severity: "danger",
      });
    }
    for (const ap of overdueAPs.slice(0, 3)) {
      alerts.push({
        type: "OVERDUE",
        message: `Bill from ${ap.vendor?.name ?? "vendor"} is overdue`,
        severity: "danger",
      });
    }
    if (budgetUsedPct > 90) {
      alerts.push({
        type: "BUDGET",
        message: `Budget ${budgetUsedPct.toFixed(0)}% used this month`,
        severity: "warning",
      });
    }
    if (outstandingAR > 0) {
      alerts.push({
        type: "AR",
        message: `${outstandingAR.toLocaleString("en-IN", { style: "currency", currency: "INR" })} receivable outstanding`,
        severity: "info",
      });
    }

    const data: DashboardData = {
      kpis: {
        totalBalance,
        monthlyIncome,
        monthlyExpenses,
        netCashFlow,
        outstandingAR,
        outstandingAP,
        budgetUsedPct,
      },
      accounts,
      cashFlow,
      budgetSplit,
      expenseByCategory,
      incomeByMonth,
      recentInvoices: invoices,
      recentExpenses: expenses
        .slice()
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 8),
      arList: ars
        .filter((ar) => ar.status !== "PAID")
        .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
        .slice(0, 6),
      apList: aps
        .filter((ap) => ap.status !== "PAID")
        .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
        .slice(0, 6),
      monthlyBudget: budget,
      monthlySpent,
      savingsGoals: goalsResult,
      alerts,
    };

    return ok(data);
  } catch (e) {
    return serverError(e);
  }
}
