import { NextResponse } from "next/server";
import { ZodError } from "zod";

export function ok<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function created<T>(data: T) {
  return NextResponse.json(data, { status: 201 });
}

export function badRequest(message: string, details?: unknown) {
  return NextResponse.json({ error: message, details }, { status: 400 });
}

export function notFound(message = "Resource not found") {
  return NextResponse.json({ error: message }, { status: 404 });
}

export function conflict(message: string) {
  return NextResponse.json({ error: message }, { status: 409 });
}

export function serverError(err: unknown) {
  console.error("[API ERROR]", err);
  const message =
    err instanceof Error ? err.message : "Internal server error";
  return NextResponse.json({ error: message }, { status: 500 });
}

export function handleZodError(e: ZodError) {
  return NextResponse.json(
    {
      error: "Validation failed",
      details: e.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
      })),
    },
    { status: 400 },
  );
}

export function parseBody<T>(schema: { safeParse: (d: unknown) => { success: boolean; data?: T; error?: ZodError } }, data: unknown) {
  const r = schema.safeParse(data);
  return r;
}
