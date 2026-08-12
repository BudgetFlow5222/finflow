import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { invoiceSchema } from "@/schemas";
import { computeInvoiceTotals, syncARForInvoice } from "@/services/finance";
import { created, handleZodError, ok, serverError } from "@/lib/api";
import { generateInvoiceNumber } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const limit = Number(url.searchParams.get("limit") ?? "50");
    const invoices = await db.invoice.findMany({
      include: { customer: true, items: true, ar: true },
      orderBy: { issueDate: "desc" },
      take: limit,
    });
    return ok(invoices);
  } catch (e) {
    return serverError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = invoiceSchema.safeParse(body);
    if (!parsed.success) return handleZodError(parsed.error);
    const d = parsed.data;

    const { subtotal, tax, total } = computeInvoiceTotals(
      d.items,
      Number(d.taxRate),
      Number(d.discount),
    );

    const number = d.number && d.number.length > 0
      ? d.number
      : generateInvoiceNumber(await db.invoice.count());

    const invoice = await db.$transaction(async (tx) => {
      const inv = await tx.invoice.create({
        data: {
          number,
          customerId: d.customerId,
          issueDate: d.issueDate,
          dueDate: d.dueDate,
          subtotal,
          taxRate: Number(d.taxRate),
          tax,
          discount: Number(d.discount),
          total,
          paidAmount: 0,
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
      await syncARForInvoice(tx, inv.id);
      return inv;
    });
    return created(invoice);
  } catch (e) {
    return serverError(e);
  }
}
