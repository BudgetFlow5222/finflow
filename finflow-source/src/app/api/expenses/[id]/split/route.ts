import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { badRequest, handleZodError, notFound, ok, serverError } from "@/lib/api";
import { adjustAccountBalance } from "@/services/finance";
import { round2 } from "@/lib/utils";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const splitItemSchema = z.object({
  categoryId: z.string().min(1).optional().nullable(),
  amount: z.coerce.number().min(0.01, "Split amount must be greater than 0"),
  budgetType: z.enum(["NEED", "WANT", "SAVINGS"]).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
});

const splitBodySchema = z.object({
  splits: z.array(splitItemSchema).min(1, "At least one split is required"),
});

// ---------------------------------------------------------------------------
// POST /api/expenses/[id]/split
// Atomically replaces an expense with N new expenses (one per split item).
// The sum of split amounts must equal the original expense total (₹0.01 tol).
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;

    const body = await req.json().catch(() => ({}));
    const parsed = splitBodySchema.safeParse(body);
    if (!parsed.success) return handleZodError(parsed.error);

    // 1. Verify the original expense exists
    const original = await db.expense.findUnique({
      where: { id },
      include: { vendor: true, category: true, account: true },
    });
    if (!original) return notFound("Expense not found");

    // 2. Validate sum of split amounts equals original total
    const splits = parsed.data.splits;
    const sum = round2(splits.reduce((s, x) => s + (Number(x.amount) || 0), 0));
    if (Math.abs(sum - original.total) > 0.01) {
      return badRequest(
        `Split amounts sum (${sum.toFixed(2)}) must equal original expense total (${original.total.toFixed(
          2,
        )}). Difference: ${(sum - original.total).toFixed(2)}`,
      );
    }

    // 3. Atomic transaction: delete original + create N new expenses
    const created = await db.$transaction(async (tx) => {
      // Reverse the original expense's account balance change before deleting.
      // adjustAccountBalance uses +delta to add to the balance, so passing the
      // original total credits it back.
      if (original.status === "COMPLETED") {
        await adjustAccountBalance(tx, original.accountId, original.total);
      }
      await tx.expense.delete({ where: { id: original.id } });

      const splitSuffix = `(split from ${original.id})`;
      const baseNotes = original.notes
        ? `${original.notes} ${splitSuffix}`
        : splitSuffix;

      const newExpenses: Awaited<
        ReturnType<typeof tx.expense.create>
      >[] = [];
      for (const split of splits) {
        const amount = round2(Number(split.amount) || 0);
        const tax = 0;
        const total = round2(amount + tax);

        // Compose notes: original notes + suffix + optional split notes
        const finalNotes = split.notes
          ? `${baseNotes} — ${split.notes}`
          : baseNotes;

        const e = await tx.expense.create({
          data: {
            vendorId: original.vendorId,
            categoryId: split.categoryId || null,
            accountId: original.accountId,
            date: original.date,
            amount,
            tax,
            total,
            paymentMethod: original.paymentMethod,
            budgetType: split.budgetType ?? null,
            status: original.status,
            notes: finalNotes,
          },
          include: { vendor: true, category: true, account: true },
        });

        // Apply the new expense's debit to the account
        if (e.status === "COMPLETED") {
          await adjustAccountBalance(tx, e.accountId, -e.total);
        }
        newExpenses.push(e);
      }

      return newExpenses;
    });

    return ok({ created, deletedId: id });
  } catch (e) {
    return serverError(e);
  }
}
