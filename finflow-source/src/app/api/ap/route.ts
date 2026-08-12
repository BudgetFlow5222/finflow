import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apSchema } from "@/schemas";
import { deriveArApStatus } from "@/services/finance";
import { created, handleZodError, ok, serverError } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const aps = await db.accountsPayable.findMany({
      include: { vendor: true },
      orderBy: { dueDate: "asc" },
    });
    return ok(aps);
  } catch (e) {
    return serverError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = apSchema.safeParse(body);
    if (!parsed.success) return handleZodError(parsed.error);
    const d = parsed.data;
    const amount = Number(d.amount);
    const paidAmount = Number(d.paidAmount) || 0;
    const status = deriveArApStatus(amount, paidAmount, new Date(d.dueDate));
    const ap = await db.accountsPayable.create({
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
      include: { vendor: true },
    });
    return created(ap);
  } catch (e) {
    return serverError(e);
  }
}
