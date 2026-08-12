import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { savingsGoalSchema } from "@/schemas";
import { created, handleZodError, ok, serverError } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const goals = await db.savingsGoal.findMany({
      orderBy: { createdAt: "asc" },
    });
    return ok(goals);
  } catch (e) {
    return serverError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = savingsGoalSchema.safeParse(body);
    if (!parsed.success) return handleZodError(parsed.error);
    const d = parsed.data;

    // Auto-mark COMPLETED if the saved amount already meets the target.
    const saved = Number(d.savedAmount) || 0;
    const target = Number(d.targetAmount) || 0;
    let status = d.status;
    if (status === "ACTIVE" && target > 0 && saved >= target) {
      status = "COMPLETED";
    }

    const goal = await db.savingsGoal.create({
      data: {
        name: d.name,
        targetAmount: target,
        savedAmount: saved,
        targetDate: d.targetDate ?? null,
        color: d.color ?? null,
        icon: d.icon ?? null,
        status,
        notes: d.notes ?? null,
      },
    });
    return created(goal);
  } catch (e) {
    return serverError(e);
  }
}
