import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { categorySchema } from "@/schemas";
import { created, handleZodError, ok, serverError } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const categories = await db.category.findMany({ orderBy: { name: "asc" } });
    return ok(categories);
  } catch (e) {
    return serverError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = categorySchema.safeParse(body);
    if (!parsed.success) return handleZodError(parsed.error);
    const d = parsed.data;
    const category = await db.category.create({
      data: {
        name: d.name,
        type: d.type,
        budgetType: d.budgetType ?? null,
        color: d.color ?? null,
        icon: d.icon ?? null,
      },
    });
    return created(category);
  } catch (e) {
    return serverError(e);
  }
}
