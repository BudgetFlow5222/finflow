import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { vendorSchema } from "@/schemas";
import { created, handleZodError, ok, serverError } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const vendors = await db.vendor.findMany({ orderBy: { createdAt: "desc" } });
    return ok(vendors);
  } catch (e) {
    return serverError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = vendorSchema.safeParse(body);
    if (!parsed.success) return handleZodError(parsed.error);
    const d = parsed.data;
    const vendor = await db.vendor.create({
      data: {
        name: d.name,
        email: d.email || null,
        phone: d.phone || null,
        company: d.company || null,
        notes: d.notes || null,
        status: d.status,
      },
    });
    return created(vendor);
  } catch (e) {
    return serverError(e);
  }
}
