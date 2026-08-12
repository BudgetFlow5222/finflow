import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, serverError } from "@/lib/api";
import { adjustAccountBalance } from "@/services/finance";

export const dynamic = "force-dynamic";

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    await db.$transaction(async (tx) => {
      const t = await tx.transfer.findUnique({ where: { id } });
      if (!t) throw new Error("Transfer not found");
      // Reverse the transfer
      await adjustAccountBalance(tx, t.toAccountId, -t.amount);
      await adjustAccountBalance(tx, t.fromAccountId, t.amount + t.fee);
      await tx.transfer.delete({ where: { id } });
    });
    return ok({ deleted: true });
  } catch (e) {
    return serverError(e);
  }
}
