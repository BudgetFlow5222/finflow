import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { customerSchema } from "@/schemas";
import { created, handleZodError, ok, serverError } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const customers = await db.customer.findMany({
      orderBy: { createdAt: "desc" },
    });
    return ok(customers);
  } catch (e) {
    return serverError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = customerSchema.safeParse(body);
    if (!parsed.success) return handleZodError(parsed.error);
    const d = parsed.data;
    const customer = await db.customer.create({
      data: {
        name: d.name,
        email: d.email || null,
        phone: d.phone || null,
        company: d.company || null,
        notes: d.notes || null,
        status: d.status,
      },
    });
    return created(customer);
  } catch (e) {
    return serverError(e);
  }
}
