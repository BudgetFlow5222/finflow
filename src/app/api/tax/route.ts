import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, serverError, badRequest } from "@/lib/api";
import { round2, monthKey } from "@/lib/utils";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Types — exported so the TaxView can import & share the contract.
// ---------------------------------------------------------------------------

export interface TaxRateBreakdown {
  rate: number;
  taxableAmount: number;
  taxAmount: number;
  transactionCount: number;
}

export interface OutputTaxTransaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  taxRate: number;
  taxAmount: number;
  type: "sale" | "invoice";
}

export interface InputTaxTransaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  taxRate: number;
  taxAmount: number;
  category?: string;
}

export interface TaxByCategory {
  category: string;
  taxAmount: number;
  expenseAmount: number;
  transactionCount: number;
}

export interface TaxSummary {
  period: string;
  periodLabel: string;
  outputTax: {
    totalTaxableAmount: number;
    totalTax: number;
    byRate: TaxRateBreakdown[];
    transactions: OutputTaxTransaction[];
  };
  inputTax: {
    totalTaxableAmount: number;
    totalTax: number;
    byRate: TaxRateBreakdown[];
    transactions: InputTaxTransaction[];
  };
  netTaxLiability: number;
  taxByCategory: TaxByCategory[];
  totalRevenue: number;
  totalExpenses: number;
  netIncome: number;
  effectiveTaxRate: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Invoices that represent a taxable supply (output tax should be accounted
// for). DRAFT and CANCELLED invoices are excluded — they are not yet binding.
const TAXABLE_INVOICE_STATUSES = new Set(["SENT", "PAID", "PARTIALLY_PAID", "OVERDUE"]);

function computeRate(tax: number, base: number): number {
  if (base <= 0) return 0;
  return Math.round((tax / base) * 100);
}

function longMonthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  if (!y || !m) return key;
  return new Date(y, m - 1, 1).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });
}

function groupByRate<T extends { taxRate: number; amount: number; taxAmount: number }>(
  txns: T[],
): TaxRateBreakdown[] {
  const map = new Map<number, { taxableAmount: number; taxAmount: number; transactionCount: number }>();
  for (const t of txns) {
    const cur = map.get(t.taxRate) ?? { taxableAmount: 0, taxAmount: 0, transactionCount: 0 };
    cur.taxableAmount += t.amount;
    cur.taxAmount += t.taxAmount;
    cur.transactionCount += 1;
    map.set(t.taxRate, cur);
  }
  return Array.from(map.entries())
    .map(([rate, v]) => ({
      rate,
      taxableAmount: round2(v.taxableAmount),
      taxAmount: round2(v.taxAmount),
      transactionCount: v.transactionCount,
    }))
    .sort((a, b) => a.rate - b.rate);
}

// ---------------------------------------------------------------------------
// GET /api/tax?period=YYYY-MM | ?year=YYYY
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const periodParam = url.searchParams.get("period");
    const yearParam = url.searchParams.get("year");
    const now = new Date();

    let start: Date;
    let end: Date;
    let period: string;
    let periodLabel: string;

    if (yearParam) {
      const y = Number(yearParam);
      if (!Number.isFinite(y) || y < 1900 || y > 9999) {
        return badRequest("Invalid year (expected YYYY)");
      }
      start = new Date(y, 0, 1);
      end = new Date(y + 1, 0, 1);
      period = String(y);
      periodLabel = `Financial Year ${y}`;
    } else {
      const key =
        periodParam && /^\d{4}-\d{2}$/.test(periodParam) ? periodParam : monthKey(now);
      const [y, m] = key.split("-").map(Number);
      start = new Date(y, m - 1, 1);
      end = new Date(y, m, 1);
      period = key;
      periodLabel = longMonthLabel(key);
    }

    const [sales, expenses, invoices] = await Promise.all([
      db.sale.findMany({
        where: { status: "COMPLETED", date: { gte: start, lt: end } },
        include: { customer: true, invoice: true },
      }),
      db.expense.findMany({
        where: { status: "COMPLETED", date: { gte: start, lt: end } },
        include: { category: true, vendor: true },
      }),
      db.invoice.findMany({
        where: { issueDate: { gte: start, lt: end } },
        include: { customer: true },
      }),
    ]);

    // Output tax transactions come from completed sales PLUS taxable invoices
    // (SENT / PAID / PARTIALLY_PAID / OVERDUE). When a sale is already linked
    // to an invoice, the sale is the realised taxable event — we don't double
    // count the invoice. Invoices that have NOT yet produced a sale still
    // represent an accrued output-tax liability, so they are included.
    const invoiceIdsLinkedToSales = new Set(
      sales.map((s) => s.invoiceId).filter(Boolean) as string[],
    );

    const outputTxns: OutputTaxTransaction[] = [];
    for (const s of sales) {
      const base = s.amount > 0 ? s.amount : 0;
      const rate = computeRate(s.tax, base);
      outputTxns.push({
        id: s.id,
        date: s.date.toISOString(),
        description: s.customer?.name
          ? `Sale — ${s.customer.name}`
          : s.invoice?.number
            ? `Sale — Invoice ${s.invoice.number}`
            : "Sale",
        amount: round2(s.amount),
        taxRate: rate,
        taxAmount: round2(s.tax),
        type: "sale",
      });
    }

    for (const inv of invoices) {
      if (!TAXABLE_INVOICE_STATUSES.has(inv.status)) continue;
      if (invoiceIdsLinkedToSales.has(inv.id)) continue;
      const base = inv.subtotal > 0 ? inv.subtotal : 0;
      const rate =
        inv.taxRate > 0 ? Math.round(inv.taxRate) : computeRate(inv.tax, base);
      outputTxns.push({
        id: inv.id,
        date: inv.issueDate.toISOString(),
        description: inv.customer?.name
          ? `Invoice ${inv.number} — ${inv.customer.name}`
          : `Invoice ${inv.number}`,
        amount: round2(base),
        taxRate: rate,
        taxAmount: round2(inv.tax),
        type: "invoice",
      });
    }

    // Input tax transactions come from completed expenses, grouped by category
    // for the "GST paid by category" breakdown.
    const inputTxns: InputTaxTransaction[] = [];
    const categoryAgg = new Map<string, { tax: number; expense: number; count: number }>();
    for (const e of expenses) {
      const base = e.amount > 0 ? e.amount : 0;
      const rate = computeRate(e.tax, base);
      const category = e.category?.name ?? "Uncategorized";
      inputTxns.push({
        id: e.id,
        date: e.date.toISOString(),
        description: e.vendor?.name
          ? `Expense — ${e.vendor.name}`
          : e.notes
            ? e.notes
            : "Expense",
        amount: round2(e.amount),
        taxRate: rate,
        taxAmount: round2(e.tax),
        category,
      });
      const cur = categoryAgg.get(category) ?? { tax: 0, expense: 0, count: 0 };
      cur.tax += e.tax;
      cur.expense += e.amount;
      cur.count += 1;
      categoryAgg.set(category, cur);
    }

    const outputByRate = groupByRate(outputTxns);
    const inputByRate = groupByRate(inputTxns);

    const outputTaxable = round2(outputTxns.reduce((s, t) => s + t.amount, 0));
    const outputTaxTotal = round2(outputTxns.reduce((s, t) => s + t.taxAmount, 0));
    const inputTaxable = round2(inputTxns.reduce((s, t) => s + t.amount, 0));
    const inputTaxTotal = round2(inputTxns.reduce((s, t) => s + t.taxAmount, 0));

    // Total revenue (with tax) — sum of completed sales totals plus taxable
    // invoice totals that are not already represented by a linked sale.
    const standaloneInvoiceRevenue = invoices
      .filter(
        (i) =>
          TAXABLE_INVOICE_STATUSES.has(i.status) &&
          !invoiceIdsLinkedToSales.has(i.id),
      )
      .reduce((s, i) => s + i.total, 0);

    const totalRevenue = round2(
      sales.reduce((s, x) => s + x.total, 0) + standaloneInvoiceRevenue,
    );
    const totalExpenses = round2(expenses.reduce((s, x) => s + x.total, 0));
    const netIncome = round2(totalRevenue - totalExpenses);
    const netTaxLiability = round2(outputTaxTotal - inputTaxTotal);
    const effectiveTaxRate =
      totalRevenue > 0 ? round2((outputTaxTotal / totalRevenue) * 100) : 0;

    const taxByCategory: TaxByCategory[] = Array.from(categoryAgg.entries())
      .map(([category, v]) => ({
        category,
        taxAmount: round2(v.tax),
        expenseAmount: round2(v.expense),
        transactionCount: v.count,
      }))
      .sort((a, b) => b.taxAmount - a.taxAmount);

    // Sort transactions newest-first for display.
    outputTxns.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    inputTxns.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const summary: TaxSummary = {
      period,
      periodLabel,
      outputTax: {
        totalTaxableAmount: outputTaxable,
        totalTax: outputTaxTotal,
        byRate: outputByRate,
        transactions: outputTxns,
      },
      inputTax: {
        totalTaxableAmount: inputTaxable,
        totalTax: inputTaxTotal,
        byRate: inputByRate,
        transactions: inputTxns,
      },
      netTaxLiability,
      taxByCategory,
      totalRevenue,
      totalExpenses,
      netIncome,
      effectiveTaxRate,
    };

    return ok(summary);
  } catch (e) {
    return serverError(e);
  }
}
