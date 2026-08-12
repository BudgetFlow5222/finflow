import { db } from "@/lib/db";
import { ok, serverError } from "@/lib/api";
import { round2, monthKey, lastNMonthKeys } from "@/lib/utils";
import type { HealthScore } from "@/types";

export const dynamic = "force-dynamic";

// GET /api/health — compute a composite Financial Health Score (0-100)
// Factors:
// 1. Savings Rate (30%) — % of income saved (net cash flow / income)
// 2. Budget Adherence (25%) — how well spending stays within budget allocations
// 3. Liquidity (20%) — available balance vs monthly expenses (emergency fund ratio)
// 4. Debt Management (15%) — AR vs AP ratio (collecting faster than paying)
// 5. Expense Trend (10%) — are expenses decreasing month-over-month?
export async function GET() {
  try {
    const now = new Date();
    const curMonth = monthKey(now);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = monthStart;

    const [accounts, sales, expenses, ars, aps, budget] = await Promise.all([
      db.account.findMany(),
      db.sale.findMany({ where: { status: "COMPLETED" } }),
      db.expense.findMany({ where: { status: "COMPLETED" } }),
      db.accountsReceivable.findMany(),
      db.accountsPayable.findMany(),
      db.budget.findUnique({ where: { month: curMonth } }),
    ]);

    // --- Factor 1: Savings Rate (30%) ---
    const monthlyIncome = sales
      .filter((s) => s.date >= monthStart && s.date < monthEnd)
      .reduce((sum, s) => sum + s.total, 0);
    const monthlyExpenses = expenses
      .filter((e) => e.date >= monthStart && e.date < monthEnd)
      .reduce((sum, e) => sum + e.total, 0);
    const netCashFlow = monthlyIncome - monthlyExpenses;
    const savingsRate = monthlyIncome > 0 ? (netCashFlow / monthlyIncome) * 100 : 0;
    // Score: 20%+ savings = 100, 10-20% = 75, 0-10% = 50, negative = 25
    const savingsScore = Math.max(0, Math.min(100,
      savingsRate >= 20 ? 100 :
      savingsRate >= 10 ? 75 :
      savingsRate >= 0 ? 50 : 25
    ));

    // --- Factor 2: Budget Adherence (25%) ---
    const totalBudget = budget ? budget.income : monthlyIncome;
    const budgetUsedPct = totalBudget > 0 ? (monthlyExpenses / totalBudget) * 100 : 0;
    // Score: under 70% = 100, 70-90% = 80, 90-100% = 60, 100-120% = 30, >120% = 10
    const budgetScore = Math.max(0, Math.min(100,
      budgetUsedPct <= 70 ? 100 :
      budgetUsedPct <= 90 ? 80 :
      budgetUsedPct <= 100 ? 60 :
      budgetUsedPct <= 120 ? 30 : 10
    ));

    // --- Factor 3: Liquidity / Emergency Fund (20%) ---
    const totalBalance = accounts
      .filter((a) => a.status === "ACTIVE")
      .reduce((s, a) => s + a.currentBalance, 0);
    // Emergency fund ratio = total balance / monthly expenses
    // 3+ months = 100, 2-3 months = 80, 1-2 months = 60, 0.5-1 month = 30, <0.5 = 10
    const emergencyRatio = monthlyExpenses > 0 ? totalBalance / monthlyExpenses : 99;
    const liquidityScore = Math.max(0, Math.min(100,
      emergencyRatio >= 3 ? 100 :
      emergencyRatio >= 2 ? 80 :
      emergencyRatio >= 1 ? 60 :
      emergencyRatio >= 0.5 ? 30 : 10
    ));

    // --- Factor 4: Debt Management / Cash Flow Health (15%) ---
    const outstandingAR = ars
      .filter((ar) => ar.status !== "PAID")
      .reduce((s, ar) => s + (ar.amount - ar.paidAmount), 0);
    const outstandingAP = aps
      .filter((ap) => ap.status !== "PAID")
      .reduce((s, ap) => s + (ap.amount - ap.paidAmount), 0);
    // AR/AP ratio: if AR > AP, you're collecting faster (good). If AP >> AR, you're over-leveraged.
    const arApRatio = outstandingAP > 0 ? outstandingAR / outstandingAP : (outstandingAR > 0 ? 2 : 1);
    // Score: ratio >= 1.5 = 100, 1-1.5 = 80, 0.5-1 = 60, 0.25-0.5 = 40, <0.25 = 20
    const debtScore = Math.max(0, Math.min(100,
      arApRatio >= 1.5 ? 100 :
      arApRatio >= 1 ? 80 :
      arApRatio >= 0.5 ? 60 :
      arApRatio >= 0.25 ? 40 : 20
    ));

    // --- Factor 5: Expense Trend (10%) ---
    const lastMonthExpenses = expenses
      .filter((e) => e.date >= lastMonthStart && e.date < lastMonthEnd)
      .reduce((sum, e) => sum + e.total, 0);
    // If expenses decreased vs last month = good, increased = bad
    let trendScore = 70; // neutral default (no last month data)
    if (lastMonthExpenses > 0) {
      const expenseChange = ((monthlyExpenses - lastMonthExpenses) / lastMonthExpenses) * 100;
      // Decreased >10% = 100, decreased 0-10% = 85, increased 0-10% = 60, increased 10-25% = 40, >25% = 20
      trendScore = Math.max(0, Math.min(100,
        expenseChange <= -10 ? 100 :
        expenseChange <= 0 ? 85 :
        expenseChange <= 10 ? 60 :
        expenseChange <= 25 ? 40 : 20
      ));
    }

    // --- Overall score (weighted) ---
    const overall = Math.round(
      savingsScore * 0.30 +
      budgetScore * 0.25 +
      liquidityScore * 0.20 +
      debtScore * 0.15 +
      trendScore * 0.10
    );

    const grade: HealthScore["grade"] =
      overall >= 90 ? "A" :
      overall >= 80 ? "B" :
      overall >= 70 ? "C" :
      overall >= 60 ? "D" : "F";

    const factors: HealthScore["factors"] = [
      {
        key: "savings",
        label: "Savings Rate",
        score: Math.round(savingsScore),
        weight: 30,
        value: `${savingsRate.toFixed(1)}%`,
        status: savingsScore >= 75 ? "good" : savingsScore >= 50 ? "fair" : "poor",
        description: `Saving ${savingsRate.toFixed(1)}% of monthly income`,
      },
      {
        key: "budget",
        label: "Budget Adherence",
        score: Math.round(budgetScore),
        weight: 25,
        value: `${budgetUsedPct.toFixed(0)}% used`,
        status: budgetScore >= 80 ? "good" : budgetScore >= 60 ? "fair" : "poor",
        description: `Spending at ${budgetUsedPct.toFixed(0)}% of budget`,
      },
      {
        key: "liquidity",
        label: "Emergency Fund",
        score: Math.round(liquidityScore),
        weight: 20,
        value: `${emergencyRatio.toFixed(1)}mo`,
        status: liquidityScore >= 80 ? "good" : liquidityScore >= 60 ? "fair" : "poor",
        description: `${emergencyRatio.toFixed(1)} months of expenses covered`,
      },
      {
        key: "debt",
        label: "Cash Flow Health",
        score: Math.round(debtScore),
        weight: 15,
        value: `AR/AP ${arApRatio.toFixed(2)}`,
        status: debtScore >= 80 ? "good" : debtScore >= 60 ? "fair" : "poor",
        description: `Receivables cover ${arApRatio.toFixed(2)}× of payables`,
      },
      {
        key: "trend",
        label: "Expense Trend",
        score: Math.round(trendScore),
        weight: 10,
        value: lastMonthExpenses > 0
          ? `${monthlyExpenses < lastMonthExpenses ? "↓" : "↑"} ${Math.abs(((monthlyExpenses - lastMonthExpenses) / lastMonthExpenses) * 100).toFixed(0)}%`
          : "stable",
        status: trendScore >= 80 ? "good" : trendScore >= 60 ? "fair" : "poor",
        description: lastMonthExpenses > 0
          ? `Expenses ${monthlyExpenses < lastMonthExpenses ? "decreased" : "increased"} vs last month`
          : "Insufficient history for trend",
      },
    ];

    // --- Recommendations ---
    const recommendations: HealthScore["recommendations"] = [];
    if (savingsScore < 75) {
      recommendations.push({
        title: "Increase your savings rate",
        description: `You're saving ${savingsRate.toFixed(1)}% of income. Aim for 20%+ by reducing discretionary spending.`,
        priority: "high",
      });
    }
    if (budgetScore < 80) {
      recommendations.push({
        title: "Stay within budget",
        description: `You've used ${budgetUsedPct.toFixed(0)}% of your budget. Review your WANT categories for cutbacks.`,
        priority: budgetScore < 60 ? "high" : "medium",
      });
    }
    if (liquidityScore < 80) {
      recommendations.push({
        title: "Build your emergency fund",
        description: `You have ${emergencyRatio.toFixed(1)} months of expenses saved. Target 3-6 months for financial security.`,
        priority: liquidityScore < 60 ? "high" : "medium",
      });
    }
    if (debtScore < 80) {
      recommendations.push({
        title: "Improve cash flow collection",
        description: `Your payables exceed receivables. Follow up on overdue invoices to improve liquidity.`,
        priority: "medium",
      });
    }
    if (trendScore < 70 && lastMonthExpenses > 0) {
      recommendations.push({
        title: "Control expense growth",
        description: `Expenses increased vs last month. Review recurring subscriptions and discretionary spending.`,
        priority: "medium",
      });
    }
    if (recommendations.length === 0) {
      recommendations.push({
        title: "Maintain your financial health",
        description: "Your finances are in excellent shape. Keep up the good work and consider increasing your savings goals.",
        priority: "low",
      });
    }

    const result: HealthScore = { overall, grade, factors, recommendations };
    return ok(result);
  } catch (e) {
    return serverError(e);
  }
}
