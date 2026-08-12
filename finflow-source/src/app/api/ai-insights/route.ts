import { NextResponse, NextRequest } from "next/server";
import { db } from "@/lib/db";
import { monthKey, round2 } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// In-memory cache for AI insights (TTL: 5 minutes)
// Key: month (YYYY-MM), Value: { data, timestamp }
const cache = new Map<string, { data: unknown; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// GET /api/ai-insights — generate AI financial insights using z-ai-web-dev-sdk
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const forceRefresh = url.searchParams.get("refresh") === "true";
    const now = new Date();
    const curMonth = monthKey(now);

    // Check cache first (unless force refresh)
    if (!forceRefresh) {
      const cached = cache.get(curMonth);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return NextResponse.json({
          ...cached.data,
          cached: true,
          cachedAt: new Date(cached.timestamp).toISOString(),
        });
      }
    }

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const [accounts, sales, expenses, ars, aps, budget, goals] = await Promise.all([
      db.account.findMany(),
      db.sale.findMany({ where: { status: "COMPLETED" }, include: { customer: true } }),
      db.expense.findMany({ where: { status: "COMPLETED" }, include: { category: true, vendor: true } }),
      db.accountsReceivable.findMany({ include: { customer: true } }),
      db.accountsPayable.findMany({ include: { vendor: true } }),
      db.budget.findUnique({ where: { month: curMonth } }),
      db.savingsGoal.findMany(),
    ]);

    // Compute key metrics
    const totalBalance = accounts.reduce((s, a) => s + a.currentBalance, 0);
    const monthlyIncome = sales
      .filter((s) => s.date >= monthStart && s.date < monthEnd)
      .reduce((sum, s) => sum + s.total, 0);
    const monthlyExpenses = expenses
      .filter((e) => e.date >= monthStart && e.date < monthEnd)
      .reduce((sum, e) => sum + e.total, 0);
    const netCashFlow = monthlyIncome - monthlyExpenses;
    const lastMonthExpenses = expenses
      .filter((e) => e.date >= lastMonthStart && e.date < monthStart)
      .reduce((sum, e) => sum + e.total, 0);
    const outstandingAR = ars
      .filter((ar) => ar.status !== "PAID")
      .reduce((s, ar) => s + (ar.amount - ar.paidAmount), 0);
    const outstandingAP = aps
      .filter((ap) => ap.status !== "PAID")
      .reduce((s, ap) => s + (ap.amount - ap.paidAmount), 0);
    const overdueCount = ars.filter((ar) => ar.status === "OVERDUE").length + aps.filter((ap) => ap.status === "OVERDUE").length;

    // Top expense categories this month
    const monthlyExpensesList = expenses.filter((e) => e.date >= monthStart && e.date < monthEnd);
    const catMap = new Map<string, number>();
    for (const e of monthlyExpensesList) {
      const name = e.category?.name ?? "Uncategorized";
      catMap.set(name, (catMap.get(name) ?? 0) + e.total);
    }
    const topCategories = Array.from(catMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, amount]) => ({ name, amount: round2(amount) }));

    // Build a concise financial summary for the LLM
    const summary = {
      period: curMonth,
      totalBalance: round2(totalBalance),
      monthlyIncome: round2(monthlyIncome),
      monthlyExpenses: round2(monthlyExpenses),
      netCashFlow: round2(netCashFlow),
      lastMonthExpenses: round2(lastMonthExpenses),
      expenseChange: lastMonthExpenses > 0 ? round2(((monthlyExpenses - lastMonthExpenses) / lastMonthExpenses) * 100) : 0,
      savingsRate: monthlyIncome > 0 ? round2((netCashFlow / monthlyIncome) * 100) : 0,
      outstandingAR: round2(outstandingAR),
      outstandingAP: round2(outstandingAP),
      overdueCount,
      budgetIncome: budget?.income ?? 0,
      budgetUsedPct: budget && budget.income > 0 ? round2((monthlyExpenses / budget.income) * 100) : 0,
      activeAccounts: accounts.filter((a) => a.status === "ACTIVE").length,
      savingsGoals: goals.map((g) => ({ name: g.name, target: g.targetAmount, saved: g.savedAmount, pct: g.targetAmount > 0 ? round2((g.savedAmount / g.targetAmount) * 100) : 0 })),
      topExpenseCategories: topCategories,
      recentSales: sales
        .filter((s) => s.date >= monthStart && s.date < monthEnd)
        .slice(0, 5)
        .map((s) => ({ customer: s.customer?.name ?? "—", amount: s.total })),
    };

    // Generate AI insights using z-ai-web-dev-sdk
    const ZAI = (await import("z-ai-web-dev-sdk")).default;
    const zai = await ZAI.create();

    const systemPrompt = `You are an expert financial advisor AI assistant for FinFlow, a financial management app. Analyze the user's financial data and provide actionable, specific insights in a friendly but professional tone. Format your response as JSON with this exact structure:

{
  "summary": "A 2-3 sentence overview of their financial health this month",
  "insights": [
    {
      "type": "positive" | "warning" | "tip",
      "title": "Short title (max 6 words)",
      "description": "1-2 sentence specific insight with actual numbers from the data",
      "targetView": "expenses" | "budget" | "goals" | "receivables" | "payables" | "accounts" | "transfers" | "reports" | "dashboard"
    }
  ],
  "recommendation": "One clear next-step recommendation"
}

Rules:
- Use actual numbers from the data (amounts, percentages, category names).
- Provide 3-4 insights mixing positive observations, warnings, and actionable tips.
- Be specific — reference actual categories, amounts, and trends.
- Keep each insight description under 2 sentences.
- For each insight, include a "targetView" field indicating which view the user should navigate to for more details.
- Use "expenses" for spending insights, "budget" for budget insights, "goals" for savings goals, "receivables" for overdue invoices, "payables" for overdue bills, "accounts" for balance issues, "transfers" for fund movement, "reports" for trend analysis, "dashboard" if no specific view applies.
- Respond with valid JSON only, no markdown or extra text.`;

    const completion = await zai.chat.completions.create({
      messages: [
        { role: "assistant", content: systemPrompt },
        { role: "user", content: `Here is my financial data for ${curMonth}:\n\n${JSON.stringify(summary, null, 2)}` },
      ],
      thinking: { type: "disabled" },
    });

    const response = completion.choices[0]?.message?.content;

    // Parse the JSON response
    let insights;
    try {
      const cleaned = response?.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      insights = JSON.parse(cleaned);
    } catch {
      insights = {
        summary: response ?? "Unable to generate insights at this time.",
        insights: [],
        recommendation: "Review your financial dashboard for details.",
      };
    }

    // Cache the result
    cache.set(curMonth, { data: insights, timestamp: Date.now() });

    return NextResponse.json({ ...insights, cached: false });
  } catch (e) {
    console.error("[AI INSIGHTS ERROR]", e);
    return NextResponse.json(
      {
        summary: "Unable to generate AI insights at this time.",
        insights: [],
        recommendation: "Please try again later.",
        error: e instanceof Error ? e.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
