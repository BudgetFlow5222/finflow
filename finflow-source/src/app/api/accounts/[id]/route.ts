import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { accountSchema } from "@/schemas";
import { badRequest, handleZodError, notFound, ok, serverError } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const account = await db.account.findUnique({ where: { id } });
    if (!account) return notFound();
    return ok(account);
  } catch (e) {
    return serverError(e);
  }
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const body = await req.json();
    const parsed = accountSchema.safeParse(body);
    if (!parsed.success) return handleZodError(parsed.error);
    const d = parsed.data;
    const existing = await db.account.findUnique({ where: { id } });
    if (!existing) return notFound();

    const openingDelta =
      (Number(d.openingBalance) || 0) - existing.openingBalance;

    const updated = await db.account.update({
      where: { id },
      data: {
        name: d.name,
        type: d.type,
        openingBalance: Number(d.openingBalance) || 0,
        currentBalance: existing.currentBalance + openingDelta,
        currency: d.currency,
        status: d.status,
        color: d.color ?? null,
        notes: d.notes ?? null,
      },
    });
    return ok(updated);
  } catch (e) {
    return serverError(e);
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const referenced =
      (await db.sale.count({ where: { accountId: id } })) > 0 ||
      (await db.expense.count({ where: { accountId: id } })) > 0 ||
      (await db.transfer.count({ where: { OR: [{ fromAccountId: id }, { toAccountId: id }] } })) > 0;
    if (referenced) {
      return badRequest("Cannot delete an account that has transactions. Close it instead.");
    }
    await db.account.delete({ where: { id } });
    return ok({ deleted: true });
  } catch (e) {
    return serverError(e);
  }
}
