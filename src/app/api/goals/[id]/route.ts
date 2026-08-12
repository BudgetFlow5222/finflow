import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { savingsGoalSchema } from "@/schemas";
import { handleZodError, notFound, ok, serverError } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const goal = await db.savingsGoal.findUnique({ where: { id } });
    if (!goal) return notFound();
    return ok(goal);
  } catch (e) {
    return serverError(e);
  }
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const body = await req.json();
    const parsed = savingsGoalSchema.safeParse(body);
    if (!parsed.success) return handleZodError(parsed.error);
    const d = parsed.data;

    const existing = await db.savingsGoal.findUnique({ where: { id } });
    if (!existing) return notFound();

    const target = Number(d.targetAmount) || 0;
    const saved = Number(d.savedAmount) ?? existing.savedAmount;

    // Auto-flip status based on saved vs target unless the user explicitly paused.
    let status = d.status;
    if (status === "ACTIVE" && target > 0 && saved >= target) {
      status = "COMPLETED";
    }
    if (status === "COMPLETED" && target > 0 && saved < target) {
      status = "ACTIVE";
    }

    const updated = await db.savingsGoal.update({
      where: { id },
      data: {
        name: d.name,
        targetAmount: target,
        savedAmount: saved,
        targetDate: d.targetDate ?? null,
        color: d.color ?? null,
        icon: d.icon ?? null,
        status,
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
    const existing = await db.savingsGoal.findUnique({ where: { id } });
    if (!existing) return notFound();
    await db.savingsGoal.delete({ where: { id } });
    return ok({ deleted: true });
  } catch (e) {
    return serverError(e);
  }
}
