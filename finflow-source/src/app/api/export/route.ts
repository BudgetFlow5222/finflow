import { db } from "@/lib/db";
import { serverError } from "@/lib/api";

export const dynamic = "force-dynamic";

// GET /api/export — Download a complete JSON backup of all financial data.
// The response is a downloadable .json file with metadata (version, exportDate, counts)
// and a `data` object containing every model. Invoices include their line items.
export async function GET() {
  try {
    const [
      accounts,
      customers,
      vendors,
      categories,
      sales,
      expenses,
      transfers,
      invoices,
      accountsReceivable,
      accountsPayable,
      budgets,
      savingsGoals,
      recurringTransactions,
      reconciliations,
    ] = await Promise.all([
      db.account.findMany({ orderBy: { createdAt: "asc" } }),
      db.customer.findMany({ orderBy: { createdAt: "asc" } }),
      db.vendor.findMany({ orderBy: { createdAt: "asc" } }),
      db.category.findMany({ orderBy: { createdAt: "asc" } }),
      db.sale.findMany({ orderBy: { date: "desc" } }),
      db.expense.findMany({ orderBy: { date: "desc" } }),
      db.transfer.findMany({ orderBy: { date: "desc" } }),
      db.invoice.findMany({ include: { items: true }, orderBy: { issueDate: "desc" } }),
      db.accountsReceivable.findMany({ orderBy: { dueDate: "asc" } }),
      db.accountsPayable.findMany({ orderBy: { dueDate: "asc" } }),
      db.budget.findMany({ orderBy: { month: "desc" } }),
      db.savingsGoal.findMany({ orderBy: { createdAt: "asc" } }),
      db.recurringTransaction.findMany({ orderBy: { nextDate: "asc" } }),
      db.reconciliation.findMany({ orderBy: { statementDate: "desc" } }),
    ]);

    const counts = {
      accounts: accounts.length,
      customers: customers.length,
      vendors: vendors.length,
      categories: categories.length,
      sales: sales.length,
      expenses: expenses.length,
      transfers: transfers.length,
      invoices: invoices.length,
      accountsReceivable: accountsReceivable.length,
      accountsPayable: accountsPayable.length,
      budgets: budgets.length,
      savingsGoals: savingsGoals.length,
      recurringTransactions: recurringTransactions.length,
      reconciliations: reconciliations.length,
    };

    const payload = {
      metadata: {
        version: "1.0",
        exportDate: new Date().toISOString(),
        app: "FinFlow",
        counts,
      },
      data: {
        accounts,
        customers,
        vendors,
        categories,
        sales,
        expenses,
        transfers,
        invoices,
        accountsReceivable,
        accountsPayable,
        budgets,
        savingsGoals,
        recurringTransactions,
        reconciliations,
      },
    };

    const json = JSON.stringify(payload, null, 2);
    const date = new Date().toISOString().slice(0, 10);
    const filename = `finflow-backup-${date}.json`;

    return new Response(json, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return serverError(e);
  }
}
