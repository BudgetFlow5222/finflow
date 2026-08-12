import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, serverError } from "@/lib/api";
import { adjustAccountBalance } from "@/services/finance";
import { round2 } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    await db.$transaction(async (tx) => {
      const sale = await tx.sale.findUnique({ where: { id } });
      if (!sale) throw new Error("Sale not found");
      if (sale.status === "COMPLETED") {
        await adjustAccountBalance(tx, sale.accountId, -sale.total);
      }
      await tx.sale.delete({ where: { id } });
    });
    return ok({ deleted: true });
  } catch (e) {
    return serverError(e);
  }
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const body = await req.json();
    const { status } = body as { status?: string };
    const updated = await db.$transaction(async (tx) => {
      const sale = await tx.sale.findUnique({ where: { id } });
      if (!sale) throw new Error("Sale not found");
      if (sale.status === "COMPLETED" && status !== "COMPLETED") {
        await adjustAccountBalance(tx, sale.accountId, -sale.total);
      } else if (sale.status !== "COMPLETED" && status === "COMPLETED") {
        await adjustAccountBalance(tx, sale.accountId, sale.total);
      }
      return tx.sale.update({ where: { id }, data: { status: status ?? sale.status } });
    });
    return ok(updated);
  } catch (e) {
    return serverError(e);
  }
}

export { round2 };
