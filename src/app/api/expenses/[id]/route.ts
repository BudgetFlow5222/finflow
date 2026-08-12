import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, serverError } from "@/lib/api";
import { adjustAccountBalance } from "@/services/finance";

export const dynamic = "force-dynamic";

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    await db.$transaction(async (tx) => {
      const expense = await tx.expense.findUnique({ where: { id } });
      if (!expense) throw new Error("Expense not found");
      if (expense.status === "COMPLETED") {
        await adjustAccountBalance(tx, expense.accountId, expense.total);
      }
      await tx.expense.delete({ where: { id } });
    });
    return ok({ deleted: true });
  } catch (e) {
    return serverError(e);
  }
}
