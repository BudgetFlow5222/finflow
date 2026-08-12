// FinFlow — finance business-logic service.
// Centralised operations that keep balances, invoices, AR/AP, and budgets
// consistent. Uses Prisma transactions for atomicity with rollback on failure.

import { db } from "@/lib/db";
import { round2 } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Account balance helpers
// ---------------------------------------------------------------------------

export async function adjustAccountBalance(
  tx: Parameters<Parameters<typeof db["$transaction"]>[0]>[0],
  accountId: string,
  delta: number,
): Promise<void> {
  const acc = await tx.account.findUnique({ where: { id: accountId } });
  if (!acc) throw new Error(`Account ${accountId} not found`);
  if (acc.status !== "ACTIVE") {
    throw new Error(`Account ${acc.name} is not active`);
  }
  const newBalance = round2(acc.currentBalance + delta);
  await tx.account.update({
    where: { id: accountId },
    data: { currentBalance: newBalance },
  });
}

// ---------------------------------------------------------------------------
// Sale → account credit + invoice link
// ---------------------------------------------------------------------------

export async function applySale(
  tx: Parameters<Parameters<typeof db["$transaction"]>[0]>[0],
  sale: { id: string; accountId: string; total: number; invoiceId?: string | null },
): Promise<void> {
  await adjustAccountBalance(tx, sale.accountId, sale.total);
}

// ---------------------------------------------------------------------------
// Expense → account debit
// ---------------------------------------------------------------------------

export async function applyExpense(
  tx: Parameters<Parameters<typeof db["$transaction"]>[0]>[0],
  expense: { id: string; accountId: string; total: number },
): Promise<void> {
  await adjustAccountBalance(tx, expense.accountId, -expense.total);
}

// ---------------------------------------------------------------------------
// Transfer → move money between two accounts (total preserved)
// ---------------------------------------------------------------------------

export async function applyTransfer(
  tx: Parameters<Parameters<typeof db["$transaction"]>[0]>[0],
  transfer: { fromAccountId: string; toAccountId: string; amount: number; fee: number },
): Promise<void> {
  await adjustAccountBalance(tx, transfer.fromAccountId, -(transfer.amount + transfer.fee));
  await adjustAccountBalance(tx, transfer.toAccountId, transfer.amount);
}

// ---------------------------------------------------------------------------
// Invoice → AR sync + status recompute
// ---------------------------------------------------------------------------

export function computeInvoiceTotals(
  items: { quantity: number; rate: number }[],
  taxRate: number,
  discount: number,
): { subtotal: number; tax: number; total: number } {
  const subtotal = round2(
    items.reduce((s, it) => s + (Number(it.quantity) || 0) * (Number(it.rate) || 0), 0),
  );
  const taxable = Math.max(0, subtotal - discount);
  const tax = round2((taxable * (Number(taxRate) || 0)) / 100);
  const total = round2(taxable + tax);
  return { subtotal, tax, total };
}

export function deriveInvoiceStatus(
  total: number,
  paidAmount: number,
  status: string,
  dueDate: Date,
): string {
  if (status === "CANCELLED" || status === "DRAFT") return status;
  const paid = round2(paidAmount);
  if (paid >= total && total > 0) return "PAID";
  if (paid > 0 && paid < total) {
    return isOverdue(dueDate) ? "OVERDUE" : "PARTIALLY_PAID";
  }
  if (status === "SENT" && isOverdue(dueDate)) return "OVERDUE";
  return status;
}

export function isOverdue(dueDate: Date): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(dueDate) < today;
}

export function deriveArApStatus(
  amount: number,
  paidAmount: number,
  dueDate: Date,
): "OUTSTANDING" | "PARTIALLY_PAID" | "PAID" | "OVERDUE" {
  const paid = round2(paidAmount);
  if (paid >= amount && amount > 0) return "PAID";
  if (paid > 0 && paid < amount) return "PARTIALLY_PAID";
  return isOverdue(dueDate) ? "OVERDUE" : "OUTSTANDING";
}

// ---------------------------------------------------------------------------
// Recompute AR record from an invoice
// ---------------------------------------------------------------------------

export async function syncARForInvoice(
  tx: Parameters<Parameters<typeof db["$transaction"]>[0]>[0],
  invoiceId: string,
): Promise<void> {
  const invoice = await tx.invoice.findUnique({
    where: { id: invoiceId },
    include: { items: true },
  });
  if (!invoice) return;

  const status = deriveInvoiceStatus(
    invoice.total,
    invoice.paidAmount,
    invoice.status,
    new Date(invoice.dueDate),
  );

  await tx.invoice.update({
    where: { id: invoiceId },
    data: { status },
  });

  const arStatus = deriveArApStatus(invoice.total, invoice.paidAmount, new Date(invoice.dueDate));
  const existing = await tx.accountsReceivable.findUnique({
    where: { invoiceId },
  });
  if (existing) {
    await tx.accountsReceivable.update({
      where: { id: existing.id },
      data: {
        amount: invoice.total,
        paidAmount: invoice.paidAmount,
        status: arStatus,
        dueDate: invoice.dueDate,
      },
    });
  } else {
    await tx.accountsReceivable.create({
      data: {
        invoiceId,
        customerId: invoice.customerId,
        amount: invoice.total,
        paidAmount: invoice.paidAmount,
        dueDate: invoice.dueDate,
        status: arStatus,
      },
    });
  }
}

// ---------------------------------------------------------------------------
// Record a payment against an invoice (AR)
// ---------------------------------------------------------------------------

export async function recordInvoicePayment(
  invoiceId: string,
  amount: number,
  accountId: string,
) {
  return db.$transaction(async (tx) => {
    const invoice = await tx.invoice.findUnique({ where: { id: invoiceId } });
    if (!invoice) throw new Error("Invoice not found");
    const newPaid = round2(invoice.paidAmount + amount);
    await tx.invoice.update({
      where: { id: invoiceId },
      data: { paidAmount: newPaid },
    });
    // Credit the receiving account
    await adjustAccountBalance(tx, accountId, amount);
    // Create a linked Sale record for the payment
    await tx.sale.create({
      data: {
        customerId: invoice.customerId,
        accountId,
        invoiceId,
        amount,
        total: amount,
        paymentMethod: "BANK",
        status: "COMPLETED",
        notes: `Payment for invoice ${invoice.number}`,
      },
    });
    await syncARForInvoice(tx, invoiceId);
    return { newPaid };
  });
}

// ---------------------------------------------------------------------------
// Record a payment against an AP bill
// ---------------------------------------------------------------------------

export async function recordApPayment(
  apId: string,
  amount: number,
  accountId: string,
) {
  return db.$transaction(async (tx) => {
    const ap = await tx.accountsPayable.findUnique({ where: { id: apId } });
    if (!ap) throw new Error("Bill not found");
    const newPaid = round2(ap.paidAmount + amount);
    await tx.accountsPayable.update({
      where: { id: apId },
      data: { paidAmount: newPaid },
    });
    await adjustAccountBalance(tx, accountId, -amount);
    // Linked expense
    await tx.expense.create({
      data: {
        vendorId: ap.vendorId,
        accountId,
        amount,
        total: amount,
        paymentMethod: "BANK",
        budgetType: "NEED",
        status: "COMPLETED",
        notes: `Payment for bill ${ap.billNumber ?? ap.id}`,
      },
    });
    const status = deriveArApStatus(ap.amount, newPaid, new Date(ap.dueDate));
    await tx.accountsPayable.update({
      where: { id: apId },
      data: { status },
    });
    return { newPaid };
  });
}

// ---------------------------------------------------------------------------
// Dashboard refresh helper — recomputes overdue flags across invoices/AP/AR
// ---------------------------------------------------------------------------

export async function refreshOverdueStatuses(): Promise<void> {
  await db.$transaction(async (tx) => {
    const invoices = await tx.invoice.findMany({
      where: { status: { in: ["SENT", "PARTIALLY_PAID"] } },
    });
    for (const inv of invoices) {
      const newStatus = deriveInvoiceStatus(
        inv.total,
        inv.paidAmount,
        inv.status,
        new Date(inv.dueDate),
      );
      if (newStatus !== inv.status) {
        await tx.invoice.update({ where: { id: inv.id }, data: { status: newStatus } });
      }
    }

    const ars = await tx.accountsReceivable.findMany({
      where: { status: { in: ["OUTSTANDING", "PARTIALLY_PAID"] } },
    });
    for (const ar of ars) {
      const newStatus = deriveArApStatus(ar.amount, ar.paidAmount, new Date(ar.dueDate));
      if (newStatus !== ar.status) {
        await tx.accountsReceivable.update({ where: { id: ar.id }, data: { status: newStatus } });
      }
    }

    const aps = await tx.accountsPayable.findMany({
      where: { status: { in: ["OUTSTANDING", "PARTIALLY_PAID"] } },
    });
    for (const ap of aps) {
      const newStatus = deriveArApStatus(ap.amount, ap.paidAmount, new Date(ap.dueDate));
      if (newStatus !== ap.status) {
        await tx.accountsPayable.update({ where: { id: ap.id }, data: { status: newStatus } });
      }
    }
  });
}
