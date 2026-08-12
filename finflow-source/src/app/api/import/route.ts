import { db } from "@/lib/db";
import { ok, badRequest, serverError } from "@/lib/api";
import { generateInvoiceNumber } from "@/lib/utils";

export const dynamic = "force-dynamic";

// POST /api/import
//
// Two modes (selected via ?format= query param):
//   • default        — JSON restore (body is the backup JSON object)
//   • ?format=csv    — CSV bulk transaction import (body is raw CSV text)
//
// Optional: ?mode=replace  — clear existing data before restoring (JSON only).
// Default mode is "merge" (add records alongside existing data, generating new IDs
// and remapping foreign keys so relationships are preserved).

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type AnyRecord = Record<string, unknown>;

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function asArray(v: unknown): AnyRecord[] {
  return Array.isArray(v) ? (v as AnyRecord[]) : [];
}

function str(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

function num(v: unknown): number | undefined {
  if (typeof v === "number") return v;
  if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) return Number(v);
  return undefined;
}

function date(v: unknown): Date | undefined {
  if (!v) return undefined;
  const d = typeof v === "string" || typeof v === "number" || v instanceof Date ? new Date(v) : null;
  if (!d) return undefined;
  return Number.isNaN(d.getTime()) ? undefined : d;
}

/** Drop the `id` key (and any timestamp keys Prisma manages automatically). */
function stripManaged(raw: AnyRecord): AnyRecord {
  const { id, createdAt, updatedAt, ...rest } = raw;
  void id;
  void createdAt;
  void updatedAt;
  return rest;
}

// ---------------------------------------------------------------------------
// JSON restore
// ---------------------------------------------------------------------------

async function restoreJson(
  payload: unknown,
  mode: "merge" | "replace",
): Promise<{ imported: Record<string, number>; errors: string[] }> {
  if (!isObject(payload) || !isObject(payload.data)) {
    throw new Error("Invalid backup payload: missing top-level `data` object.");
  }
  const data = payload.data as Record<string, unknown>;
  const errors: string[] = [];

  // Reverse-dependency order for clearing (dependents first).
  if (mode === "replace") {
    await db.$transaction(async (tx) => {
      await tx.reconciliation.deleteMany();
      await tx.recurringTransaction.deleteMany();
      await tx.accountsPayable.deleteMany();
      await tx.accountsReceivable.deleteMany();
      await tx.invoiceItem.deleteMany();
      await tx.invoice.deleteMany();
      await tx.transfer.deleteMany();
      await tx.sale.deleteMany();
      await tx.expense.deleteMany();
      await tx.savingsGoal.deleteMany();
      await tx.budget.deleteMany();
      await tx.vendor.deleteMany();
      await tx.customer.deleteMany();
      await tx.category.deleteMany();
      await tx.account.deleteMany();
    });
  }

  // ID maps (only used in merge mode — in replace mode we preserve original IDs).
  const idMap = {
    accounts: new Map<string, string>(),
    categories: new Map<string, string>(),
    customers: new Map<string, string>(),
    vendors: new Map<string, string>(),
    invoices: new Map<string, string>(),
  };

  const imported: Record<string, number> = {
    accounts: 0,
    customers: 0,
    vendors: 0,
    categories: 0,
    sales: 0,
    expenses: 0,
    transfers: 0,
    invoices: 0,
    invoiceItems: 0,
    accountsReceivable: 0,
    accountsPayable: 0,
    budgets: 0,
    savingsGoals: 0,
    recurringTransactions: 0,
    reconciliations: 0,
  };

  // Helper to run a single create, recording errors without aborting the import.
  async function tryCreate<T>(label: string, fn: () => Promise<T>): Promise<T | null> {
    try {
      return await fn();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`${label}: ${msg}`);
      return null;
    }
  }

  // 1. Accounts -----------------------------------------------------------------
  for (const raw of asArray(data.accounts)) {
    const originalId = str(raw.id);
    const clean = stripManaged(raw);
    const created = await tryCreate("account", () =>
      db.account.create({
        data: {
          name: str(clean.name) ?? "Unnamed",
          type: str(clean.type) ?? "BANK",
          openingBalance: num(clean.openingBalance) ?? 0,
          currentBalance: num(clean.currentBalance) ?? num(clean.openingBalance) ?? 0,
          currency: str(clean.currency) ?? "INR",
          status: str(clean.status) ?? "ACTIVE",
          color: str(clean.color) ?? null,
          notes: str(clean.notes) ?? null,
          lastReconciledAt: date(clean.lastReconciledAt) ?? null,
          lastReconciledBalance: num(clean.lastReconciledBalance) ?? null,
        },
      }),
    );
    if (created) {
      imported.accounts++;
      if (originalId) idMap.accounts.set(originalId, created.id);
    }
  }

  // 2. Categories ---------------------------------------------------------------
  for (const raw of asArray(data.categories)) {
    const originalId = str(raw.id);
    const clean = stripManaged(raw);
    const created = await tryCreate("category", () =>
      db.category.create({
        data: {
          name: str(clean.name) ?? "Uncategorized",
          type: str(clean.type) ?? "EXPENSE",
          budgetType: str(clean.budgetType) ?? null,
          color: str(clean.color) ?? null,
          icon: str(clean.icon) ?? null,
        },
      }),
    );
    if (created) {
      imported.categories++;
      if (originalId) idMap.categories.set(originalId, created.id);
    }
  }

  // 3. Customers ----------------------------------------------------------------
  for (const raw of asArray(data.customers)) {
    const originalId = str(raw.id);
    const clean = stripManaged(raw);
    const created = await tryCreate("customer", () =>
      db.customer.create({
        data: {
          name: str(clean.name) ?? "Unnamed",
          email: str(clean.email) ?? null,
          phone: str(clean.phone) ?? null,
          company: str(clean.company) ?? null,
          notes: str(clean.notes) ?? null,
          status: str(clean.status) ?? "ACTIVE",
        },
      }),
    );
    if (created) {
      imported.customers++;
      if (originalId) idMap.customers.set(originalId, created.id);
    }
  }

  // 4. Vendors ------------------------------------------------------------------
  for (const raw of asArray(data.vendors)) {
    const originalId = str(raw.id);
    const clean = stripManaged(raw);
    const created = await tryCreate("vendor", () =>
      db.vendor.create({
        data: {
          name: str(clean.name) ?? "Unnamed",
          email: str(clean.email) ?? null,
          phone: str(clean.phone) ?? null,
          company: str(clean.company) ?? null,
          notes: str(clean.notes) ?? null,
          status: str(clean.status) ?? "ACTIVE",
        },
      }),
    );
    if (created) {
      imported.vendors++;
      if (originalId) idMap.vendors.set(originalId, created.id);
    }
  }

  // 5. Budgets (independent) ----------------------------------------------------
  // Budget.month is @unique, so use upsert to handle merge-mode conflicts gracefully.
  for (const raw of asArray(data.budgets)) {
    const clean = stripManaged(raw);
    const month = str(clean.month) ?? new Date().toISOString().slice(0, 7);
    const created = await tryCreate("budget", () =>
      db.budget.upsert({
        where: { month },
        create: {
          month,
          income: num(clean.income) ?? 0,
          needsPct: num(clean.needsPct) ?? 50,
          wantsPct: num(clean.wantsPct) ?? 30,
          savingsPct: num(clean.savingsPct) ?? 20,
          notes: str(clean.notes) ?? null,
        },
        update: {
          income: num(clean.income) ?? 0,
          needsPct: num(clean.needsPct) ?? 50,
          wantsPct: num(clean.wantsPct) ?? 30,
          savingsPct: num(clean.savingsPct) ?? 20,
          notes: str(clean.notes) ?? null,
        },
      }),
    );
    if (created) imported.budgets++;
  }

  // 6. Savings goals (independent) ---------------------------------------------
  for (const raw of asArray(data.savingsGoals)) {
    const clean = stripManaged(raw);
    const created = await tryCreate("savingsGoal", () =>
      db.savingsGoal.create({
        data: {
          name: str(clean.name) ?? "Unnamed goal",
          targetAmount: num(clean.targetAmount) ?? 0,
          savedAmount: num(clean.savedAmount) ?? 0,
          targetDate: date(clean.targetDate) ?? null,
          color: str(clean.color) ?? null,
          icon: str(clean.icon) ?? null,
          status: str(clean.status) ?? "ACTIVE",
          notes: str(clean.notes) ?? null,
        },
      }),
    );
    if (created) imported.savingsGoals++;
  }

  // 7. Sales (depends on customers, accounts, optionally invoices) -------------
  for (const raw of asArray(data.sales)) {
    const clean = stripManaged(raw);
    const customerId =
      (idMap.customers.get(str(clean.customerId) ?? "")) ||
      str(clean.customerId) ||
      null;
    const accountId =
      (idMap.accounts.get(str(clean.accountId) ?? "")) ||
      str(clean.accountId) ||
      null;
    if (!customerId || !accountId) {
      errors.push(`sale skipped: missing customer or account reference`);
      continue;
    }
    const created = await tryCreate("sale", () =>
      db.sale.create({
        data: {
          customerId,
          accountId,
          date: date(clean.date) ?? new Date(),
          amount: num(clean.amount) ?? 0,
          tax: num(clean.tax) ?? 0,
          discount: num(clean.discount) ?? 0,
          total: num(clean.total) ?? num(clean.amount) ?? 0,
          paymentMethod: str(clean.paymentMethod) ?? null,
          status: str(clean.status) ?? "COMPLETED",
          notes: str(clean.notes) ?? null,
        },
      }),
    );
    if (created) imported.sales++;
  }

  // 8. Expenses (depends on vendors, categories, accounts) ---------------------
  for (const raw of asArray(data.expenses)) {
    const clean = stripManaged(raw);
    const vendorId =
      (idMap.vendors.get(str(clean.vendorId) ?? "")) ||
      str(clean.vendorId) ||
      null;
    const categoryId =
      (idMap.categories.get(str(clean.categoryId) ?? "")) ||
      str(clean.categoryId) ||
      null;
    const accountId =
      (idMap.accounts.get(str(clean.accountId) ?? "")) ||
      str(clean.accountId) ||
      null;
    if (!accountId) {
      errors.push(`expense skipped: missing account reference`);
      continue;
    }
    const created = await tryCreate("expense", () =>
      db.expense.create({
        data: {
          vendorId,
          categoryId,
          accountId,
          date: date(clean.date) ?? new Date(),
          amount: num(clean.amount) ?? 0,
          tax: num(clean.tax) ?? 0,
          total: num(clean.total) ?? num(clean.amount) ?? 0,
          paymentMethod: str(clean.paymentMethod) ?? null,
          budgetType: str(clean.budgetType) ?? null,
          status: str(clean.status) ?? "COMPLETED",
          notes: str(clean.notes) ?? null,
        },
      }),
    );
    if (created) imported.expenses++;
  }

  // 9. Transfers (depends on accounts) -----------------------------------------
  for (const raw of asArray(data.transfers)) {
    const clean = stripManaged(raw);
    const fromAccountId =
      (idMap.accounts.get(str(clean.fromAccountId) ?? "")) ||
      str(clean.fromAccountId) ||
      null;
    const toAccountId =
      (idMap.accounts.get(str(clean.toAccountId) ?? "")) ||
      str(clean.toAccountId) ||
      null;
    if (!fromAccountId || !toAccountId) {
      errors.push(`transfer skipped: missing account reference`);
      continue;
    }
    const created = await tryCreate("transfer", () =>
      db.transfer.create({
        data: {
          fromAccountId,
          toAccountId,
          amount: num(clean.amount) ?? 0,
          date: date(clean.date) ?? new Date(),
          notes: str(clean.notes) ?? null,
          fee: num(clean.fee) ?? 0,
        },
      }),
    );
    if (created) imported.transfers++;
  }

  // 10. Invoices + items (depends on customers) --------------------------------
  let invoiceSeq = await db.invoice.count();
  for (const raw of asArray(data.invoices)) {
    const originalId = str(raw.id);
    const itemsRaw = Array.isArray((raw as AnyRecord).items)
      ? ((raw as AnyRecord).items as AnyRecord[])
      : [];
    const clean = stripManaged(raw);
    const customerId =
      (idMap.customers.get(str(clean.customerId) ?? "")) ||
      str(clean.customerId) ||
      null;
    if (!customerId) {
      errors.push(`invoice skipped: missing customer reference`);
      continue;
    }
    // Generate a fresh, unique invoice number in merge mode to avoid conflicts.
    const number =
      mode === "merge"
        ? generateInvoiceNumber(invoiceSeq)
        : str(clean.number) ?? generateInvoiceNumber(invoiceSeq);
    invoiceSeq++;
    const created = await tryCreate("invoice", () =>
      db.invoice.create({
        data: {
          number,
          customerId,
          issueDate: date(clean.issueDate) ?? new Date(),
          dueDate: date(clean.dueDate) ?? new Date(),
          subtotal: num(clean.subtotal) ?? 0,
          taxRate: num(clean.taxRate) ?? 0,
          tax: num(clean.tax) ?? 0,
          discount: num(clean.discount) ?? 0,
          total: num(clean.total) ?? 0,
          paidAmount: num(clean.paidAmount) ?? 0,
          status: str(clean.status) ?? "DRAFT",
          notes: str(clean.notes) ?? null,
        },
      }),
    );
    if (!created) continue;
    imported.invoices++;
    if (originalId) idMap.invoices.set(originalId, created.id);

    for (const itemRaw of itemsRaw) {
      const itemClean = stripManaged(itemRaw);
      const item = await tryCreate("invoiceItem", () =>
        db.invoiceItem.create({
          data: {
            invoiceId: created.id,
            description: str(itemClean.description) ?? "",
            quantity: num(itemClean.quantity) ?? 1,
            rate: num(itemClean.rate) ?? 0,
            amount: num(itemClean.amount) ?? 0,
          },
        }),
      );
      if (item) imported.invoiceItems++;
    }
  }

  // 11. Accounts receivable (depends on invoices, customers) -------------------
  for (const raw of asArray(data.accountsReceivable)) {
    const clean = stripManaged(raw);
    const invoiceId =
      (idMap.invoices.get(str(clean.invoiceId) ?? "")) ||
      str(clean.invoiceId) ||
      null;
    const customerId =
      (idMap.customers.get(str(clean.customerId) ?? "")) ||
      str(clean.customerId) ||
      null;
    if (!invoiceId || !customerId) {
      errors.push(`AR skipped: missing invoice or customer reference`);
      continue;
    }
    const created = await tryCreate("AR", () =>
      db.accountsReceivable.create({
        data: {
          invoiceId,
          customerId,
          amount: num(clean.amount) ?? 0,
          paidAmount: num(clean.paidAmount) ?? 0,
          dueDate: date(clean.dueDate) ?? new Date(),
          status: str(clean.status) ?? "OUTSTANDING",
        },
      }),
    );
    if (created) imported.accountsReceivable++;
  }

  // 12. Accounts payable (depends on vendors) ----------------------------------
  for (const raw of asArray(data.accountsPayable)) {
    const clean = stripManaged(raw);
    const vendorId =
      (idMap.vendors.get(str(clean.vendorId) ?? "")) ||
      str(clean.vendorId) ||
      null;
    if (!vendorId) {
      errors.push(`AP skipped: missing vendor reference`);
      continue;
    }
    const created = await tryCreate("AP", () =>
      db.accountsPayable.create({
        data: {
          vendorId,
          billNumber: str(clean.billNumber) ?? null,
          amount: num(clean.amount) ?? 0,
          paidAmount: num(clean.paidAmount) ?? 0,
          dueDate: date(clean.dueDate) ?? new Date(),
          issueDate: date(clean.issueDate) ?? new Date(),
          status: str(clean.status) ?? "OUTSTANDING",
          notes: str(clean.notes) ?? null,
        },
      }),
    );
    if (created) imported.accountsPayable++;
  }

  // 13. Recurring transactions (depends on accounts, categories, vendors, customers)
  for (const raw of asArray(data.recurringTransactions)) {
    const clean = stripManaged(raw);
    const accountId =
      (idMap.accounts.get(str(clean.accountId) ?? "")) ||
      str(clean.accountId) ||
      null;
    if (!accountId) {
      errors.push(`recurring skipped: missing account reference`);
      continue;
    }
    const categoryId =
      (idMap.categories.get(str(clean.categoryId) ?? "")) ||
      str(clean.categoryId) ||
      null;
    const vendorId =
      (idMap.vendors.get(str(clean.vendorId) ?? "")) ||
      str(clean.vendorId) ||
      null;
    const customerId =
      (idMap.customers.get(str(clean.customerId) ?? "")) ||
      str(clean.customerId) ||
      null;
    const created = await tryCreate("recurring", () =>
      db.recurringTransaction.create({
        data: {
          name: str(clean.name) ?? "Unnamed recurring",
          type: str(clean.type) ?? "EXPENSE",
          amount: num(clean.amount) ?? 0,
          categoryId,
          accountId,
          vendorId,
          customerId,
          frequency: str(clean.frequency) ?? "MONTHLY",
          interval: num(clean.interval) ?? 1,
          nextDate: date(clean.nextDate) ?? new Date(),
          endDate: date(clean.endDate) ?? null,
          paymentMethod: str(clean.paymentMethod) ?? null,
          budgetType: str(clean.budgetType) ?? null,
          status: str(clean.status) ?? "ACTIVE",
          notes: str(clean.notes) ?? null,
          lastPosted: date(clean.lastPosted) ?? null,
        },
      }),
    );
    if (created) imported.recurringTransactions++;
  }

  // 14. Reconciliations (depends on accounts) ----------------------------------
  for (const raw of asArray(data.reconciliations)) {
    const clean = stripManaged(raw);
    const accountId =
      (idMap.accounts.get(str(clean.accountId) ?? "")) ||
      str(clean.accountId) ||
      null;
    if (!accountId) {
      errors.push(`reconciliation skipped: missing account reference`);
      continue;
    }
    const created = await tryCreate("reconciliation", () =>
      db.reconciliation.create({
        data: {
          accountId,
          statementDate: date(clean.statementDate) ?? new Date(),
          statementBalance: num(clean.statementBalance) ?? 0,
          systemBalance: num(clean.systemBalance) ?? 0,
          difference: num(clean.difference) ?? 0,
          status: str(clean.status) ?? "MATCHED",
          notes: str(clean.notes) ?? null,
        },
      }),
    );
    if (created) imported.reconciliations++;
  }

  return { imported, errors };
}

// ---------------------------------------------------------------------------
// CSV import
// ---------------------------------------------------------------------------

/**
 * Minimal RFC-4180-ish CSV parser. Handles quoted fields, doubled-quote escapes,
// and \r\n line endings. Returns an array of string arrays (one per row).
 */
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = "";
  let inQuotes = false;

  // Strip UTF-8 BOM if present.
  const src = text.startsWith("\uFEFF") ? text.slice(1) : text;

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        cur.push(field);
        field = "";
      } else if (ch === "\n") {
        cur.push(field);
        rows.push(cur);
        cur = [];
        field = "";
      } else if (ch === "\r") {
        // Skip — handled by \n
      } else {
        field += ch;
      }
    }
  }
  // Push the final field/row if there's leftover content.
  if (field.length > 0 || cur.length > 0) {
    cur.push(field);
    rows.push(cur);
  }
  return rows.filter((r) => r.length > 0 && !(r.length === 1 && r[0] === ""));
}

interface CsvRow {
  type: string;
  date: string;
  amount: string;
  description: string;
  category: string;
  account: string;
  party: string;
  notes: string;
}

async function importCsv(
  csvText: string,
): Promise<{ imported: number; skipped: number; errors: string[] }> {
  const rows = parseCSV(csvText);
  if (rows.length === 0) {
    throw new Error("CSV file is empty.");
  }

  const header = rows[0].map((h) => h.trim().toLowerCase());
  const colIndex: Record<string, number> = {};
  header.forEach((h, i) => {
    colIndex[h] = i;
  });

  const required = ["type", "date", "amount"];
  for (const c of required) {
    if (!(c in colIndex)) {
      throw new Error(
        `CSV header missing required column "${c}". Found columns: ${header.join(", ")}`,
      );
    }
  }

  const get = (row: string[], key: string, fallback: string[] = []): string => {
    const idx = colIndex[key];
    if (idx === undefined) return fallback[0] ?? "";
    return (row[idx] ?? "").trim();
  };

  const parseRow = (row: string[]): CsvRow => ({
    type: get(row, "type").toLowerCase(),
    date: get(row, "date"),
    amount: get(row, "amount"),
    description: get(row, "description"),
    category: get(row, "category"),
    account: get(row, "account"),
    party:
      get(row, "vendor") ||
      get(row, "customer") ||
      get(row, "vendor/customer") ||
      get(row, "party"),
    notes: get(row, "notes"),
  });

  // Cache lookups so we don't hit the DB for every row.
  const accountCache = new Map<string, string>();
  const categoryCache = new Map<string, string>();
  const customerCache = new Map<string, string>();
  const vendorCache = new Map<string, string>();

  const allAccounts = await db.account.findMany();
  for (const a of allAccounts) accountCache.set(a.name.toLowerCase(), a.id);
  const allCategories = await db.category.findMany();
  for (const c of allCategories) categoryCache.set(c.name.toLowerCase(), c.id);
  const allCustomers = await db.customer.findMany();
  for (const c of allCustomers) customerCache.set(c.name.toLowerCase(), c.id);
  const allVendors = await db.vendor.findMany();
  for (const v of allVendors) vendorCache.set(v.name.toLowerCase(), v.id);

  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (let r = 1; r < rows.length; r++) {
    const rowNum = r + 1;
    const parsed = parseRow(rows[r]);
    try {
      const type = parsed.type;
      if (type !== "sale" && type !== "expense") {
        skipped++;
        errors.push(`Row ${rowNum}: unknown type "${parsed.type}" (must be sale or expense)`);
        continue;
      }

      const amount = Number(parsed.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        skipped++;
        errors.push(`Row ${rowNum}: invalid amount "${parsed.amount}"`);
        continue;
      }

      const txnDate = new Date(parsed.date);
      if (Number.isNaN(txnDate.getTime())) {
        skipped++;
        errors.push(`Row ${rowNum}: invalid date "${parsed.date}"`);
        continue;
      }

      // Resolve or create account.
      let accountId = parsed.account ? accountCache.get(parsed.account.toLowerCase()) : undefined;
      if (!accountId && parsed.account) {
        try {
          const created = await db.account.create({
            data: {
              name: parsed.account,
              type: "BANK",
              openingBalance: 0,
              currentBalance: 0,
              currency: "INR",
              status: "ACTIVE",
            },
          });
          accountCache.set(parsed.account.toLowerCase(), created.id);
          accountId = created.id;
        } catch (e) {
          skipped++;
          errors.push(`Row ${rowNum}: failed to create account "${parsed.account}": ${e instanceof Error ? e.message : String(e)}`);
          continue;
        }
      }
      if (!accountId) {
        skipped++;
        errors.push(`Row ${rowNum}: no account specified`);
        continue;
      }

      // Resolve or create category.
      let categoryId: string | null = null;
      if (parsed.category) {
        categoryId = categoryCache.get(parsed.category.toLowerCase()) ?? null;
        if (!categoryId) {
          try {
            const created = await db.category.create({
              data: {
                name: parsed.category,
                type: type === "sale" ? "INCOME" : "EXPENSE",
                budgetType: type === "expense" ? "NEED" : null,
                color: "#10b981",
              },
            });
            categoryCache.set(parsed.category.toLowerCase(), created.id);
            categoryId = created.id;
          } catch (e) {
            errors.push(`Row ${rowNum}: failed to create category "${parsed.category}": ${e instanceof Error ? e.message : String(e)}`);
            // Continue without category — it's optional.
          }
        }
      }

      // Resolve or create customer/vendor.
      let customerId: string | null = null;
      let vendorId: string | null = null;
      if (parsed.party) {
        if (type === "sale") {
          customerId = customerCache.get(parsed.party.toLowerCase()) ?? null;
          if (!customerId) {
            try {
              const created = await db.customer.create({
                data: { name: parsed.party, status: "ACTIVE" },
              });
              customerCache.set(parsed.party.toLowerCase(), created.id);
              customerId = created.id;
            } catch (e) {
              errors.push(`Row ${rowNum}: failed to create customer "${parsed.party}": ${e instanceof Error ? e.message : String(e)}`);
            }
          }
        } else {
          vendorId = vendorCache.get(parsed.party.toLowerCase()) ?? null;
          if (!vendorId) {
            try {
              const created = await db.vendor.create({
                data: { name: parsed.party, status: "ACTIVE" },
              });
              vendorCache.set(parsed.party.toLowerCase(), created.id);
              vendorId = created.id;
            } catch (e) {
              errors.push(`Row ${rowNum}: failed to create vendor "${parsed.party}": ${e instanceof Error ? e.message : String(e)}`);
            }
          }
        }
      }

      const notes = [parsed.description, parsed.notes].filter(Boolean).join("\n").trim() || null;

      if (type === "sale") {
        await db.$transaction(async (tx) => {
          const created = await tx.sale.create({
            data: {
              customerId: customerId ?? "",
              accountId,
              date: txnDate,
              amount,
              tax: 0,
              discount: 0,
              total: amount,
              paymentMethod: null,
              status: "COMPLETED",
              notes,
            },
          });
          // If no customer was resolved, fall back to the first customer in the DB.
          if (!customerId) {
            const anyCustomer = await tx.customer.findFirst();
            if (anyCustomer) {
              await tx.sale.update({ where: { id: created.id }, data: { customerId: anyCustomer.id } });
            } else {
              throw new Error("no customers exist — create one before importing sales");
            }
          }
          const acc = await tx.account.findUnique({ where: { id: accountId } });
          if (acc) {
            await tx.account.update({
              where: { id: accountId },
              data: { currentBalance: acc.currentBalance + amount },
            });
          }
        });
      } else {
        await db.$transaction(async (tx) => {
          await tx.expense.create({
            data: {
              vendorId,
              categoryId,
              accountId,
              date: txnDate,
              amount,
              tax: 0,
              total: amount,
              paymentMethod: null,
              budgetType: "NEED",
              status: "COMPLETED",
              notes,
            },
          });
          const acc = await tx.account.findUnique({ where: { id: accountId } });
          if (acc) {
            await tx.account.update({
              where: { id: accountId },
              data: { currentBalance: acc.currentBalance - amount },
            });
          }
        });
      }
      imported++;
    } catch (e) {
      skipped++;
      errors.push(`Row ${rowNum}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return { imported, skipped, errors };
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(req: Request) {
  try {
    const url = new URL(req.url);
    const format = url.searchParams.get("format") ?? "json";
    const mode = url.searchParams.get("mode") === "replace" ? "replace" : "merge";

    if (format === "csv") {
      const text = await req.text();
      if (!text.trim()) {
        return badRequest("CSV body is empty.");
      }
      const result = await importCsv(text);
      return ok({
        format: "csv",
        mode,
        ...result,
      });
    }

    // Default: JSON restore.
    let payload: unknown;
    try {
      payload = await req.json();
    } catch {
      return badRequest("Request body is not valid JSON.");
    }
    const result = await restoreJson(payload, mode);
    return ok({
      format: "json",
      mode,
      ...result,
    });
  } catch (e) {
    return serverError(e);
  }
}
