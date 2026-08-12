import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { badRequest, notFound, ok, serverError } from "@/lib/api";
import { adjustAccountBalance } from "@/services/finance";
import { round2 } from "@/lib/utils";

export const dynamic = "force-dynamic";

// Advances a Date by `interval` units of `frequency`.
// Mutates a fresh Date to avoid touching the input.
function advanceDate(current: Date, frequency: string, interval: number): Date {
  const next = new Date(current.getTime());
  switch (frequency) {
    case "DAILY":
      next.setDate(next.getDate() + interval);
      break;
    case "WEEKLY":
      next.setDate(next.getDate() + 7 * interval);
      break;
    case "MONTHLY":
      next.setMonth(next.getMonth() + interval);
      break;
    case "QUARTERLY":
      next.setMonth(next.getMonth() + 3 * interval);
      break;
    case "YEARLY":
      next.setFullYear(next.getFullYear() + interval);
      break;
    default:
      // No-op — leave date unchanged if frequency is unrecognized.
      break;
  }
  return next;
}

// POST /api/recurring/[id]/post
// "Posts" a recurring transaction — creates a real Sale (INCOME) or Expense
// (EXPENSE) from the template, sets lastPosted = now, advances nextDate by
// frequency × interval, and adjusts the linked account's balance. Atomic.
export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;

    const tpl = await db.recurringTransaction.findUnique({
      where: { id },
      include: { category: true },
    });
    if (!tpl) return notFound("Recurring transaction not found");

    if (tpl.status === "PAUSED") {
      return badRequest("This recurring transaction is paused. Resume it before posting.");
    }
    if (tpl.status === "COMPLETED") {
      return badRequest("This recurring transaction is completed.");
    }

    const amount = round2(Number(tpl.amount) || 0);
    if (amount <= 0) {
      return badRequest("Recurring amount must be positive");
    }

    const now = new Date();
    const postDate = new Date(tpl.nextDate); // use scheduled next date as the transaction date

    // Validate account is active and (for income) customer exists.
    const account = await db.account.findUnique({ where: { id: tpl.accountId } });
    if (!account) return badRequest("Linked account no longer exists");
    if (account.status !== "ACTIVE") {
      return badRequest(`Account “${account.name}” is not active`);
    }

    if (tpl.type === "INCOME" && !tpl.customerId) {
      return badRequest(
        "Income recurring transactions require a customer. Edit the template and pick a customer.",
      );
    }

    const result = await db.$transaction(async (tx) => {
      if (tpl.type === "INCOME") {
        const sale = await tx.sale.create({
          data: {
            customerId: tpl.customerId!,
            accountId: tpl.accountId,
            date: postDate,
            amount,
            tax: 0,
            discount: 0,
            total: amount,
            paymentMethod: tpl.paymentMethod ?? null,
            status: "COMPLETED",
            notes: `Posted from recurring “${tpl.name}”`,
          },
        });
        await adjustAccountBalance(tx, tpl.accountId, amount);
        return { kind: "sale" as const, record: sale };
      } else {
        const expense = await tx.expense.create({
          data: {
            vendorId: tpl.vendorId ?? null,
            categoryId: tpl.categoryId ?? null,
            accountId: tpl.accountId,
            date: postDate,
            amount,
            tax: 0,
            total: amount,
            paymentMethod: tpl.paymentMethod ?? null,
            budgetType: tpl.budgetType ?? tpl.category?.budgetType ?? null,
            status: "COMPLETED",
            notes: `Posted from recurring “${tpl.name}”`,
          },
        });
        await adjustAccountBalance(tx, tpl.accountId, -amount);
        return { kind: "expense" as const, record: expense };
      }
    });

    // Advance the next date. If an endDate exists and the next date is past it,
    // mark the recurring transaction as COMPLETED.
    const nextScheduled = advanceDate(postDate, tpl.frequency, tpl.interval || 1);
    const isComplete = tpl.endDate ? nextScheduled > new Date(tpl.endDate) : false;

    const updated = await db.recurringTransaction.update({
      where: { id },
      data: {
        lastPosted: now,
        nextDate: isComplete ? tpl.nextDate : nextScheduled,
        status: isComplete ? "COMPLETED" : tpl.status,
      },
      include: {
        account: true,
        category: true,
        vendor: true,
        customer: true,
      },
    });

    return ok({
      posted: result.record,
      kind: result.kind,
      recurring: updated,
      amount,
    });
  } catch (e) {
    return serverError(e);
  }
}
