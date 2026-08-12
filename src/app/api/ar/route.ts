import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, serverError } from "@/lib/api";
import { refreshOverdueStatuses } from "@/services/finance";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  try {
    await refreshOverdueStatuses();
    const ars = await db.accountsReceivable.findMany({
      include: { customer: true, invoice: true },
      orderBy: { dueDate: "asc" },
    });
    return ok(ars);
  } catch (e) {
    return serverError(e);
  }
}
