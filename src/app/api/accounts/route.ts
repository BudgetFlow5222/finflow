import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { accountSchema } from "@/schemas";
import { badRequest, created, handleZodError, ok, serverError } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const accounts = await db.account.findMany({
      orderBy: { createdAt: "asc" },
    });
    return ok(accounts);
  } catch (e) {
    return serverError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = accountSchema.safeParse(body);
    if (!parsed.success) return handleZodError(parsed.error);
    const d = parsed.data;
    const opening = Number(d.openingBalance) || 0;
    const account = await db.account.create({
      data: {
        name: d.name,
        type: d.type,
        openingBalance: opening,
        currentBalance: opening,
        currency: d.currency,
        status: d.status,
        color: d.color ?? null,
        notes: d.notes ?? null,
      },
    });
    return created(account);
  } catch (e) {
    return serverError(e);
  }
}
