import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, serverError } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ month: string }> }) {
  try {
    const { month } = await ctx.params;
    const budget = await db.budget.findUnique({ where: { month } });
    return ok(budget);
  } catch (e) {
    return serverError(e);
  }
}
