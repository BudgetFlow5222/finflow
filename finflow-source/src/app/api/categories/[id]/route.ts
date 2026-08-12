import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { categorySchema } from "@/schemas";
import { handleZodError, ok, serverError } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const body = await req.json();
    const parsed = categorySchema.safeParse(body);
    if (!parsed.success) return handleZodError(parsed.error);
    const d = parsed.data;
    const updated = await db.category.update({
      where: { id },
      data: {
        name: d.name,
        type: d.type,
        budgetType: d.budgetType ?? null,
        color: d.color ?? null,
        icon: d.icon ?? null,
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
    await db.category.delete({ where: { id } });
    return ok({ deleted: true });
  } catch (e) {
    return serverError(e);
  }
}
