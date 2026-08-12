import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { recurringSchema } from "@/schemas";
import { handleZodError, notFound, ok, serverError } from "@/lib/api";

export const dynamic = "force-dynamic";

// GET /api/recurring/[id] — fetch a single recurring transaction.
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const item = await db.recurringTransaction.findUnique({
      where: { id },
      include: {
        account: true,
        category: true,
        vendor: true,
        customer: true,
      },
    });
    if (!item) return notFound();
    return ok(item);
  } catch (e) {
    return serverError(e);
  }
}

// PATCH /api/recurring/[id] — update a recurring transaction.
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const body = await req.json();
    const parsed = recurringSchema.safeParse(body);
    if (!parsed.success) return handleZodError(parsed.error);
    const d = parsed.data;

    const existing = await db.recurringTransaction.findUnique({ where: { id } });
    if (!existing) return notFound();

    const updated = await db.recurringTransaction.update({
      where: { id },
      data: {
        name: d.name,
        type: d.type,
        amount: Number(d.amount),
        categoryId: d.categoryId || null,
        accountId: d.accountId,
        vendorId: d.vendorId || null,
        customerId: d.customerId || null,
        frequency: d.frequency,
        interval: Number(d.interval) || 1,
        nextDate: new Date(d.nextDate),
        endDate: d.endDate ? new Date(d.endDate) : null,
        paymentMethod: d.paymentMethod ?? null,
        budgetType: d.budgetType ?? null,
        status: d.status,
        notes: d.notes ?? null,
      },
      include: {
        account: true,
        category: true,
        vendor: true,
        customer: true,
      },
    });
    return ok(updated);
  } catch (e) {
    return serverError(e);
  }
}

// DELETE /api/recurring/[id] — delete a recurring transaction.
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const existing = await db.recurringTransaction.findUnique({ where: { id } });
    if (!existing) return notFound();
    await db.recurringTransaction.delete({ where: { id } });
    return ok({ deleted: true });
  } catch (e) {
    return serverError(e);
  }
}
