import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { expenseSchema } from "@/schemas";
import { applyExpense } from "@/services/finance";
import { created, handleZodError, ok, serverError } from "@/lib/api";
import { round2 } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const limit = Number(url.searchParams.get("limit") ?? "50");
    const expenses = await db.expense.findMany({
      include: { vendor: true, category: true, account: true },
      orderBy: { date: "desc" },
      take: limit,
    });
    return ok(expenses);
  } catch (e) {
    return serverError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = expenseSchema.safeParse(body);
    if (!parsed.success) return handleZodError(parsed.error);
    const d = parsed.data;
    const amount = Number(d.amount) || 0;
    const tax = Number(d.tax) || 0;
    const total = round2(amount + tax);

    const expense = await db.$transaction(async (tx) => {
      const e = await tx.expense.create({
        data: {
          vendorId: d.vendorId || null,
          categoryId: d.categoryId || null,
          accountId: d.accountId,
          date: d.date,
          amount,
          tax,
          total,
          paymentMethod: d.paymentMethod ?? null,
          budgetType: d.budgetType ?? null,
          status: d.status,
          notes: d.notes ?? null,
        },
        include: { vendor: true, category: true, account: true },
      });
      if (e.status === "COMPLETED") {
        await applyExpense(tx, e);
      }
      return e;
    });
    return created(expense);
  } catch (e) {
    return serverError(e);
  }
}
