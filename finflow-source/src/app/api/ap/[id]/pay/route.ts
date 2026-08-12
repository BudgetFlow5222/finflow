import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { paymentSchema } from "@/schemas";
import { recordApPayment } from "@/services/finance";
import { handleZodError, notFound, ok, serverError } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const body = await req.json();
    const parsed = paymentSchema.safeParse(body);
    if (!parsed.success) return handleZodError(parsed.error);
    const ap = await db.accountsPayable.findUnique({ where: { id } });
    if (!ap) return notFound("Bill not found");
    const result = await recordApPayment(
      id,
      Number(parsed.data.amount),
      parsed.data.accountId,
    );
    return ok(result);
  } catch (e) {
    return serverError(e);
  }
}
