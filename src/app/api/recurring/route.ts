import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { recurringSchema } from "@/schemas";
import { created, handleZodError, ok, serverError } from "@/lib/api";

export const dynamic = "force-dynamic";

// GET /api/recurring — list all recurring transactions (with relations).
export async function GET() {
  try {
    const items = await db.recurringTransaction.findMany({
      include: {
        account: true,
        category: true,
        vendor: true,
        customer: true,
      },
      orderBy: [{ status: "asc" }, { nextDate: "asc" }],
    });
    return ok(items);
  } catch (e) {
    return serverError(e);
  }
}

// POST /api/recurring — create a new recurring transaction.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = recurringSchema.safeParse(body);
    if (!parsed.success) return handleZodError(parsed.error);
    const d = parsed.data;

    const created_tx = await db.recurringTransaction.create({
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
    return created(created_tx);
  } catch (e) {
    return serverError(e);
  }
}
