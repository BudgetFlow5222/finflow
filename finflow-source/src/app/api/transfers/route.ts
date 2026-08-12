import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { transferSchema } from "@/schemas";
import { applyTransfer } from "@/services/finance";
import { created, handleZodError, ok, serverError } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const transfers = await db.transfer.findMany({
      include: { fromAccount: true, toAccount: true },
      orderBy: { date: "desc" },
    });
    return ok(transfers);
  } catch (e) {
    return serverError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = transferSchema.safeParse(body);
    if (!parsed.success) return handleZodError(parsed.error);
    const d = parsed.data;

    const transfer = await db.$transaction(async (tx) => {
      const t = await tx.transfer.create({
        data: {
          fromAccountId: d.fromAccountId,
          toAccountId: d.toAccountId,
          amount: Number(d.amount),
          date: d.date,
          notes: d.notes ?? null,
          fee: Number(d.fee) || 0,
        },
        include: { fromAccount: true, toAccount: true },
      });
      await applyTransfer(tx, t);
      return t;
    });
    return created(transfer);
  } catch (e) {
    return serverError(e);
  }
}
