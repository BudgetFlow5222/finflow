import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { vendorSchema } from "@/schemas";
import { handleZodError, ok, serverError } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const body = await req.json();
    const parsed = vendorSchema.safeParse(body);
    if (!parsed.success) return handleZodError(parsed.error);
    const d = parsed.data;
    const updated = await db.vendor.update({
      where: { id },
      data: {
        name: d.name,
        email: d.email || null,
        phone: d.phone || null,
        company: d.company || null,
        notes: d.notes || null,
        status: d.status,
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
    await db.vendor.delete({ where: { id } });
    return ok({ deleted: true });
  } catch (e) {
    return serverError(e);
  }
}
