import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { budgetSchema } from "@/schemas";
import { created, handleZodError, ok, serverError } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const budgets = await db.budget.findMany({ orderBy: { month: "desc" } });
    return ok(budgets);
  } catch (e) {
    return serverError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = budgetSchema.safeParse(body);
    if (!parsed.success) return handleZodError(parsed.error);
    const d = parsed.data;
    const budget = await db.budget.upsert({
      where: { month: d.month },
      create: {
        month: d.month,
        income: Number(d.income),
        needsPct: Number(d.needsPct),
        wantsPct: Number(d.wantsPct),
        savingsPct: Number(d.savingsPct),
        notes: d.notes ?? null,
      },
      update: {
        income: Number(d.income),
        needsPct: Number(d.needsPct),
        wantsPct: Number(d.wantsPct),
        savingsPct: Number(d.savingsPct),
        notes: d.notes ?? null,
      },
    });
    return created(budget);
  } catch (e) {
    return serverError(e);
  }
}
