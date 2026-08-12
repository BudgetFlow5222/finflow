import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { paymentSchema } from "@/schemas";
import { recordInvoicePayment } from "@/services/finance";
import { handleZodError, notFound, ok, serverError } from "@/lib/api";

export const dynamic = "force-dynamic";

// POST /api/invoices/[id]/pay  — record a payment against the invoice
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const body = await req.json();
    const parsed = paymentSchema.safeParse(body);
    if (!parsed.success) return handleZodError(parsed.error);
    const invoice = await db.invoice.findUnique({ where: { id } });
    if (!invoice) return notFound("Invoice not found");
    const result = await recordInvoicePayment(
      id,
      Number(parsed.data.amount),
      parsed.data.accountId,
    );
    return ok(result);
  } catch (e) {
    return serverError(e);
  }
}
