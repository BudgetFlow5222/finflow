import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { saleSchema } from "@/schemas";
import { applySale } from "@/services/finance";
import { created, handleZodError, ok, serverError } from "@/lib/api";
import { round2 } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const limit = Number(url.searchParams.get("limit") ?? "50");
    const sales = await db.sale.findMany({
      include: { customer: true, account: true, invoice: true },
      orderBy: { date: "desc" },
      take: limit,
    });
    return ok(sales);
  } catch (e) {
    return serverError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = saleSchema.safeParse(body);
    if (!parsed.success) return handleZodError(parsed.error);
    const d = parsed.data;
    const amount = Number(d.amount) || 0;
    const tax = Number(d.tax) || 0;
    const discount = Number(d.discount) || 0;
    const total = round2(Math.max(0, amount - discount) + tax);

    const sale = await db.$transaction(async (tx) => {
      const s = await tx.sale.create({
        data: {
          customerId: d.customerId,
          accountId: d.accountId,
          invoiceId: d.invoiceId ?? null,
          date: d.date,
          amount,
          tax,
          discount,
          total,
          paymentMethod: d.paymentMethod ?? null,
          status: d.status,
          notes: d.notes ?? null,
        },
        include: { customer: true, account: true },
      });
      if (s.status === "COMPLETED") {
        await applySale(tx, s);
      }
      return s;
    });
    return created(sale);
  } catch (e) {
    return serverError(e);
  }
}
