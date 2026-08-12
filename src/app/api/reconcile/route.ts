import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { handleZodError, notFound, ok, serverError } from "@/lib/api";
import { z } from "zod";
import { round2 } from "@/lib/utils";

export const dynamic = "force-dynamic";

const reconcileSchema = z.object({
  accountId: z.string().min(1),
  statementDate: z.coerce.date(),
  statementBalance: z.coerce.number(),
  notes: z.string().max(500).optional().nullable(),
  adjust: z.boolean().default(false),
});

// GET /api/reconcile?accountId=xxx — list reconciliations for an account
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const accountId = url.searchParams.get("accountId");
    const where = accountId ? { accountId } : {};
    const reconciliations = await db.reconciliation.findMany({
      where,
      include: { account: true },
      orderBy: { statementDate: "desc" },
      take: 50,
    });
    return ok(reconciliations);
  } catch (e) {
    return serverError(e);
  }
}

// POST /api/reconcile — create a reconciliation record
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = reconcileSchema.safeParse(body);
    if (!parsed.success) return handleZodError(parsed.error);
    const d = parsed.data;

    const account = await db.account.findUnique({ where: { id: d.accountId } });
    if (!account) return notFound("Account not found");

    const systemBalance = round2(account.currentBalance);
    const statementBalance = round2(d.statementBalance);
    const difference = round2(statementBalance - systemBalance);

    let status: "MATCHED" | "DISCREPANCY" | "ADJUSTED" = "MATCHED";
    if (Math.abs(difference) > 0.01) {
      status = d.adjust ? "ADJUSTED" : "DISCREPANCY";
    }

    const result = await db.$transaction(async (tx) => {
      // If adjusting and there's a difference, create an adjustment expense/income
      if (d.adjust && Math.abs(difference) > 0.01) {
        if (difference > 0) {
          // Statement has MORE than system — create an income (unrecorded deposit)
          await tx.sale.create({
            data: {
              accountId: account.id,
              customerId: "adjustment",
              date: d.statementDate,
              amount: difference,
              total: difference,
              paymentMethod: "BANK",
              status: "COMPLETED",
              notes: `Reconciliation adjustment — unrecorded income (${d.statementDate.toISOString().slice(0, 10)})`,
            },
          });
          await tx.account.update({
            where: { id: account.id },
            data: { currentBalance: round2(account.currentBalance + difference) },
          });
        } else {
          // Statement has LESS than system — create an expense (unrecorded withdrawal)
          await tx.expense.create({
            data: {
              accountId: account.id,
              date: d.statementDate,
              amount: Math.abs(difference),
              total: Math.abs(difference),
              paymentMethod: "BANK",
              budgetType: "NEED",
              status: "COMPLETED",
              notes: `Reconciliation adjustment — unrecorded withdrawal (${d.statementDate.toISOString().slice(0, 10)})`,
            },
          });
          await tx.account.update({
            where: { id: account.id },
            data: { currentBalance: round2(account.currentBalance + difference) },
          });
        }
      }

      const reconciliation = await tx.reconciliation.create({
        data: {
          accountId: account.id,
          statementDate: d.statementDate,
          statementBalance,
          systemBalance,
          difference: d.adjust ? 0 : difference,
          status,
          notes: d.notes ?? null,
        },
        include: { account: true },
      });

      // Update account's last reconciled info
      await tx.account.update({
        where: { id: account.id },
        data: {
          lastReconciledAt: d.statementDate,
          lastReconciledBalance: d.adjust ? statementBalance : systemBalance,
        },
      });

      return reconciliation;
    });

    return ok(result);
  } catch (e) {
    return serverError(e);
  }
}
