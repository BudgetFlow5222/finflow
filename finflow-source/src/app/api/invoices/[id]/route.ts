import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { invoiceSchema } from "@/schemas";
import { computeInvoiceTotals, syncARForInvoice } from "@/services/finance";
import { handleZodError, notFound, ok, serverError } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const invoice = await db.invoice.findUnique({
      where: { id },
      include: { customer: true, items: true, ar: true, sale: true },
    });
    if (!invoice) return notFound();
    return ok(invoice);
  } catch (e) {
    return serverError(e);
  }
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const body = await req.json();
    const parsed = invoiceSchema.safeParse(body);
    if (!parsed.success) return handleZodError(parsed.error);
    const d = parsed.data;

    const { subtotal, tax, total } = computeInvoiceTotals(
      d.items,
      Number(d.taxRate),
      Number(d.discount),
    );

    const updated = await db.$transaction(async (tx) => {
      const existing = await tx.invoice.findUnique({ where: { id } });
      if (!existing) throw new Error("Invoice not found");
      // Replace items
      await tx.invoiceItem.deleteMany({ where: { invoiceId: id } });
      const inv = await tx.invoice.update({
        where: { id },
        data: {
          number: d.number,
          customerId: d.customerId,
          issueDate: d.issueDate,
          dueDate: d.dueDate,
          subtotal,
          taxRate: Number(d.taxRate),
          tax,
          discount: Number(d.discount),
          total,
          status: d.status,
          notes: d.notes ?? null,
          items: {
            create: d.items.map((it) => ({
              description: it.description,
              quantity: Number(it.quantity),
              rate: Number(it.rate),
              amount: Number(it.quantity) * Number(it.rate),
            })),
          },
        },
        include: { items: true, customer: true },
      });
      await syncARForInvoice(tx, id);
      return inv;
    });
    return ok(updated);
  } catch (e) {
    return serverError(e);
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    await db.$transaction(async (tx) => {
      await tx.accountsReceivable.deleteMany({ where: { invoiceId: id } });
      await tx.invoiceItem.deleteMany({ where: { invoiceId: id } });
      await tx.invoice.delete({ where: { id } });
    });
    return ok({ deleted: true });
  } catch (e) {
    return serverError(e);
  }
}
