import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apSchema } from "@/schemas";
import { deriveArApStatus } from "@/services/finance";
import { handleZodError, ok, serverError } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const body = await req.json();
    const parsed = apSchema.safeParse(body);
    if (!parsed.success) return handleZodError(parsed.error);
    const d = parsed.data;
    const amount = Number(d.amount);
    const paidAmount = Number(d.paidAmount) || 0;
    const status = deriveArApStatus(amount, paidAmount, new Date(d.dueDate));
    const updated = await db.accountsPayable.update({
      where: { id },
      data: {
        vendorId: d.vendorId,
        billNumber: d.billNumber || null,
        amount,
        paidAmount,
        dueDate: d.dueDate,
        issueDate: d.issueDate,
        notes: d.notes ?? null,
        status,
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
    await db.accountsPayable.delete({ where: { id } });
    return ok({ deleted: true });
  } catch (e) {
    return serverError(e);
  }
}
