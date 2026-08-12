import { db } from "@/lib/db";
import { ok, serverError } from "@/lib/api";
import { refreshOverdueStatuses } from "@/services/finance";
import { monthKey, round2 } from "@/lib/utils";
import type {
  BudgetAlert,
  BudgetAlertSeverity,
  BudgetType,
} from "@/types";

export const dynamic = "force-dynamic";

// Severity ordering used to sort the final alert list (danger first).
const SEVERITY_RANK: Record<BudgetAlertSeverity, number> = {
  danger: 0,
  warning: 1,
  info: 2,
  success: 3,
};

interface BudgetCategoryCalc {
  type: BudgetType;
  label: string;
  budgetAmount: number;
  spent: number;
  percentage: number; // spent / budget * 100
}

// GET /api/alerts — compute real-time budget & financial alerts.
// Checks budget thresholds (80% / 100% / 120%), account overdrafts,
// overdue invoices/bills, savings goals behind schedule, and a positive
// savings-rate alert. Returns alerts sorted by severity (danger → success).
export async function GET() {
  try {
    await refreshOverdueStatuses();

    const now = new Date();
    const curMonth = monthKey(now);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const [accounts, sales, expenses, ars, aps, budget, goals] = await Promise.all([
      db.account.findMany({ orderBy: { createdAt: "asc" } }),
      db.sale.findMany({ where: { status: "COMPLETED" } }),
      db.expense.findMany({
        where: { status: "COMPLETED" },
        include: { category: true },
      }),
      db.accountsReceivable.findMany({ include: { customer: true, invoice: true } }),
      db.accountsPayable.findMany({ include: { vendor: true } }),
      db.budget.findUnique({ where: { month: curMonth } }),
      db.savingsGoal.findMany({ orderBy: { createdAt: "asc" } }),
    ]);

    const alerts: BudgetAlert[] = [];

    // ---------------------------------------------------------------------
    // 1. Budget threshold alerts (Needs / Wants / Savings)
    // ---------------------------------------------------------------------
    const monthlyIncome = round2(
      sales
        .filter((s) => s.date >= monthStart && s.date < monthEnd)
        .reduce((sum, s) => sum + s.total, 0),
    );

    const income = budget?.income ?? monthlyIncome;
    const needsPct = budget?.needsPct ?? 50;
    const wantsPct = budget?.wantsPct ?? 30;
    const savingsPct = budget?.savingsPct ?? 20;

    const needsBudget = round2((income * needsPct) / 100);
    const wantsBudget = round2((income * wantsPct) / 100);
    const savingsBudget = round2((income * savingsPct) / 100);

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

    const budgetCategories: BudgetCategoryCalc[] = [
      {
        type: "NEED",
        label: "Needs",
        budgetAmount: needsBudget,
        spent: needsSpent,
        percentage: needsBudget > 0 ? round2((needsSpent / needsBudget) * 100) : 0,
      },
      {
        type: "WANT",
        label: "Wants",
        budgetAmount: wantsBudget,
        spent: wantsSpent,
        percentage: wantsBudget > 0 ? round2((wantsSpent / wantsBudget) * 100) : 0,
      },
      {
        type: "SAVINGS",
        label: "Savings",
        budgetAmount: savingsBudget,
        spent: savingsSpent,
        percentage: savingsBudget > 0 ? round2((savingsSpent / savingsBudget) * 100) : 0,
      },
    ];

    for (const cat of budgetCategories) {
      // Skip categories with no budget allocation — nothing to alert against.
      if (cat.budgetAmount <= 0) continue;

      if (cat.percentage >= 120) {
        alerts.push({
          id: `budget-${cat.type}-over`,
          type: "BUDGET_THRESHOLD",
          severity: "danger",
          title: `${cat.label}: Over budget`,
          message: `${cat.label} spending has reached ${cat.percentage.toFixed(0)}% of the allocated budget.`,
          category: cat.type,
          currentAmount: cat.spent,
          budgetAmount: cat.budgetAmount,
          percentage: cat.percentage,
          action: "Reduce discretionary spending in this category immediately.",
        });
      } else if (cat.percentage >= 100) {
        alerts.push({
          id: `budget-${cat.type}-limit`,
          type: "BUDGET_THRESHOLD",
          severity: "warning",
          title: `${cat.label}: Budget limit reached`,
          message: `${cat.label} spending has hit ${cat.percentage.toFixed(0)}% of the budget.`,
          category: cat.type,
          currentAmount: cat.spent,
          budgetAmount: cat.budgetAmount,
          percentage: cat.percentage,
          action: "Pause further spending in this category to avoid going over.",
        });
      } else if (cat.percentage >= 80) {
        alerts.push({
          id: `budget-${cat.type}-approaching`,
          type: "BUDGET_THRESHOLD",
          severity: "warning",
          title: `${cat.label}: Approaching budget limit`,
          message: `${cat.label} spending is at ${cat.percentage.toFixed(0)}% of the budget.`,
          category: cat.type,
          currentAmount: cat.spent,
          budgetAmount: cat.budgetAmount,
          percentage: cat.percentage,
          action: "Slow down spending in this category for the rest of the month.",
        });
      }
    }

    // ---------------------------------------------------------------------
    // 2. Overdraft alerts — any active account with negative balance
    // ---------------------------------------------------------------------
    for (const acc of accounts) {
      if (acc.status === "ACTIVE" && acc.currentBalance < 0) {
        alerts.push({
          id: `overdraft-${acc.id}`,
          type: "OVERDRAFT",
          severity: "danger",
          title: `Overdraft: ${acc.name}`,
          message: `Account "${acc.name}" has a negative balance of ${acc.currentBalance.toLocaleString("en-IN", { style: "currency", currency: acc.currency ?? "INR" })}.`,
          currentAmount: acc.currentBalance,
          action: "Transfer funds or record a deposit to clear the overdraft.",
        });
      }
    }

    // ---------------------------------------------------------------------
    // 3. Overdue invoice/bill alerts — count overdue AR + AP
    // ---------------------------------------------------------------------
    const overdueARs = ars.filter((ar) => ar.status === "OVERDUE");
    const overdueAPs = aps.filter((ap) => ap.status === "OVERDUE");
    const overdueTotal = overdueARs.length + overdueAPs.length;

    if (overdueTotal > 0) {
      const parts: string[] = [];
      if (overdueARs.length > 0) parts.push(`${overdueARs.length} invoice(s)`);
      if (overdueAPs.length > 0) parts.push(`${overdueAPs.length} bill(s)`);
      alerts.push({
        id: "overdue-ar-ap",
        type: "OVERDUE",
        severity: "danger",
        title: "Overdue invoices / bills",
        message: `You have ${parts.join(" and ")} overdue. Follow up to protect cash flow.`,
        action: "Review the AR & AP sections and chase overdue payments.",
      });
    }

    // ---------------------------------------------------------------------
    // 4. Savings goal behind schedule
    // Expected progress = elapsed time / total duration * 100 (clamped 0-100).
    // If actual progress < expected progress by more than 5pp, alert.
    // ---------------------------------------------------------------------
    for (const goal of goals) {
      if (goal.status !== "ACTIVE") continue;
      if (goal.targetAmount <= 0) continue;

      const actualPct = (goal.savedAmount / goal.targetAmount) * 100;

      let expectedPct: number | null = null;
      if (goal.targetDate) {
        const created = new Date(goal.createdAt);
        const target = new Date(goal.targetDate);
        const total = target.getTime() - created.getTime();
        const elapsed = now.getTime() - created.getTime();
        if (total > 0) {
          expectedPct = Math.max(0, Math.min(100, (elapsed / total) * 100));
        }
      }

      if (expectedPct !== null && actualPct < expectedPct - 5) {
        alerts.push({
          id: `goal-behind-${goal.id}`,
          type: "GOAL_BEHIND",
          severity: "warning",
          title: `Goal behind schedule: ${goal.name}`,
          message: `${goal.name} is at ${actualPct.toFixed(0)}% but should be at ${expectedPct.toFixed(0)}% by now.`,
          category: goal.name,
          currentAmount: goal.savedAmount,
          budgetAmount: goal.targetAmount,
          percentage: round2(actualPct),
          action: "Increase contributions to get back on track before the target date.",
        });
      }
    }

    // ---------------------------------------------------------------------
    // 5. Positive alert — savings rate above 20%
    // ---------------------------------------------------------------------
    const monthlyExpenses = round2(
      expenses
        .filter((e) => e.date >= monthStart && e.date < monthEnd)
        .reduce((sum, e) => sum + e.total, 0),
    );
    const netCashFlow = round2(monthlyIncome - monthlyExpenses);
    const savingsRate = monthlyIncome > 0 ? (netCashFlow / monthlyIncome) * 100 : 0;

    if (savingsRate > 20) {
      alerts.push({
        id: "savings-rate-positive",
        type: "INFO",
        severity: "success",
        title: "Great savings rate!",
        message: `You're saving ${savingsRate.toFixed(1)}% of your income this month — above the 20% target.`,
        percentage: round2(savingsRate),
        action: "Consider routing the surplus into a savings goal.",
      });
    }

    // ---------------------------------------------------------------------
    // Sort by severity (danger → warning → info → success), keep stable order
    // ---------------------------------------------------------------------
    alerts.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);

    return ok(alerts);
  } catch (e) {
    return serverError(e);
  }
}
