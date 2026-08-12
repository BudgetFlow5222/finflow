import { db } from "@/lib/db";
import { ok, serverError } from "@/lib/api";
import { computeInvoiceTotals, syncARForInvoice } from "@/services/finance";
import { monthKey, generateInvoiceNumber } from "@/lib/utils";

export const dynamic = "force-dynamic";

// POST /api/seed — populate the database with a realistic demo dataset.
// Idempotent: if data already exists, it returns the current counts.
export async function POST() {
  try {
    const accountsCount = await db.account.count();
    if (accountsCount > 0) {
      const counts = {
        accounts: accountsCount,
        customers: await db.customer.count(),
        vendors: await db.vendor.count(),
        categories: await db.category.count(),
        sales: await db.sale.count(),
        expenses: await db.expense.count(),
        invoices: await db.invoice.count(),
        transfers: await db.transfer.count(),
        ar: await db.accountsReceivable.count(),
        ap: await db.accountsPayable.count(),
        goals: await db.savingsGoal.count(),
        recurring: await db.recurringTransaction.count(),
      };
      return ok({ skipped: true, counts });
    }

    const now = new Date();
    const curMonth = monthKey(now);

    // --- Categories ---
    const needCategories = [
      { name: "Rent & Utilities", icon: "Home" },
      { name: "Groceries", icon: "ShoppingCart" },
      { name: "Insurance", icon: "ShieldCheck" },
      { name: "Internet & Phone", icon: "Wifi" },
      { name: "Office Supplies", icon: "Briefcase" },
    ];
    const wantCategories = [
      { name: "Dining Out", icon: "Utensils" },
      { name: "Entertainment", icon: "Clapperboard" },
      { name: "Travel", icon: "Plane" },
      { name: "Shopping", icon: "ShoppingBag" },
    ];
    const savingsCategories = [
      { name: "Investments", icon: "TrendingUp" },
      { name: "Emergency Fund", icon: "PiggyBank" },
    ];
    const incomeCategories = [
      { name: "Consulting", icon: "Laptop" },
      { name: "Product Sales", icon: "Package" },
      { name: "Services", icon: "Wrench" },
    ];

    const allCats = [
      ...needCategories.map((c, i) => ({ ...c, type: "EXPENSE" as const, budgetType: "NEED" as const, color: FINANCE_PALETTE[i] })),
      ...wantCategories.map((c, i) => ({ ...c, type: "EXPENSE" as const, budgetType: "WANT" as const, color: FINANCE_PALETTE[i + 5] })),
      ...savingsCategories.map((c, i) => ({ ...c, type: "EXPENSE" as const, budgetType: "SAVINGS" as const, color: FINANCE_PALETTE[i + 9] })),
      ...incomeCategories.map((c, i) => ({ ...c, type: "INCOME" as const, budgetType: null, color: FINANCE_PALETTE[i + 2] })),
    ];

    const categories = await Promise.all(
      allCats.map((c) =>
        db.category.create({
          data: { name: c.name, type: c.type, budgetType: c.budgetType, color: c.color, icon: c.icon },
        }),
      ),
    );

    // --- Accounts ---
    const accounts = await Promise.all([
      db.account.create({ data: { name: "HDFC Business Checking", type: "BANK", openingBalance: 250000, currentBalance: 250000, currency: "INR", color: "#10b981" } }),
      db.account.create({ data: { name: "Cash Wallet", type: "CASH", openingBalance: 25000, currentBalance: 25000, currency: "INR", color: "#eab308" } }),
      db.account.create({ data: { name: "Paytm Wallet", type: "WALLET", openingBalance: 5000, currentBalance: 5000, currency: "INR", color: "#06b6d4" } }),
      db.account.create({ data: { name: "UPI — Personal", type: "UPI", openingBalance: 12000, currentBalance: 12000, currency: "INR", color: "#8b5cf6" } }),
    ]);
    const [hdfc, cash, paytm] = accounts;

    // --- Customers ---
    const customers = await Promise.all(
      [
        { name: "Acme Corp", company: "Acme Inc", email: "ap@acme.com", phone: "+91 98xxxxxx01" },
        { name: "Globex Ltd", company: "Globex", email: "billing@globex.com", phone: "+91 98xxxxxx02" },
        { name: "Initech", company: "Initech LLC", email: "accounts@initech.com", phone: "+91 98xxxxxx03" },
        { name: "Stark Industries", company: "Stark", email: "finance@stark.com", phone: "+91 98xxxxxx04" },
        { name: "Wayne Enterprises", company: "Wayne", email: "pay@wayne.com", phone: "+91 98xxxxxx05" },
      ].map((c) => db.customer.create({ data: c })),
    );

    // --- Vendors ---
    const vendors = await Promise.all(
      [
        { name: "WeWork", company: "WeWork India", email: "billing@wework.com" },
        { name: "Airtel Business", company: "Bharti Airtel", email: "biz@airtel.com" },
        { name: "Amazon Web Services", company: "AWS", email: "aws-billing@amazon.com" },
        { name: "BigBasket", company: "BigBasket", email: "support@bigbasket.com" },
        { name: "Swiggy", company: "Swiggy", email: "biz@swiggy.com" },
        { name: "Zerodha", company: "Zerodha Broking", email: "support@zerodha.com" },
      ].map((v) => db.vendor.create({ data: v })),
    );

    // --- Budget for current month ---
    await db.budget.create({
      data: { month: curMonth, income: 180000, needsPct: 50, wantsPct: 30, savingsPct: 20 },
    });

    // --- Savings Goals ---
    await db.savingsGoal.create({
      data: {
        name: "Emergency Fund",
        targetAmount: 500000,
        savedAmount: 180000,
        color: "#10b981",
        targetDate: new Date(now.getFullYear() + 1, 5, 1),
        status: "ACTIVE",
      },
    });
    await db.savingsGoal.create({
      data: {
        name: "New Laptop",
        targetAmount: 120000,
        savedAmount: 85000,
        color: "#8b5cf6",
        targetDate: new Date(now.getFullYear(), now.getMonth() + 3, 1),
        status: "ACTIVE",
      },
    });
    await db.savingsGoal.create({
      data: {
        name: "Vacation Fund",
        targetAmount: 80000,
        savedAmount: 32000,
        color: "#06b6d4",
        targetDate: new Date(now.getFullYear(), now.getMonth() + 6, 1),
        status: "ACTIVE",
      },
    });

    // --- Recurring Transactions ---
    await db.recurringTransaction.create({ data: { name: "Office Rent", type: "EXPENSE", amount: 18000, categoryId: categories[0].id, accountId: hdfc.id, vendorId: vendors[0].id, frequency: "MONTHLY", interval: 1, nextDate: new Date(now.getFullYear(), now.getMonth() + 1, 5), budgetType: "NEED", status: "ACTIVE" } });
    await db.recurringTransaction.create({ data: { name: "Internet & Phone", type: "EXPENSE", amount: 2500, categoryId: categories[3].id, accountId: hdfc.id, vendorId: vendors[1].id, frequency: "MONTHLY", interval: 1, nextDate: new Date(now.getFullYear(), now.getMonth() + 1, 8), budgetType: "NEED", status: "ACTIVE" } });
    await db.recurringTransaction.create({ data: { name: "AWS Subscription", type: "EXPENSE", amount: 11000, categoryId: categories[0].id, accountId: hdfc.id, vendorId: vendors[2].id, frequency: "MONTHLY", interval: 1, nextDate: new Date(now.getFullYear(), now.getMonth() + 1, 12), budgetType: "NEED", status: "ACTIVE" } });

    // --- Sales for last 6 months ---
    const salesData: { customerId: string; accountId: string; monthsAgo: number; amount: number; taxRate: number }[] = [
      { customerId: customers[0].id, accountId: hdfc.id, monthsAgo: 5, amount: 65000, taxRate: 18 },
      { customerId: customers[1].id, accountId: hdfc.id, monthsAgo: 5, amount: 42000, taxRate: 18 },
      { customerId: customers[2].id, accountId: hdfc.id, monthsAgo: 4, amount: 38000, taxRate: 18 },
      { customerId: customers[0].id, accountId: hdfc.id, monthsAgo: 4, amount: 55000, taxRate: 18 },
      { customerId: customers[3].id, accountId: hdfc.id, monthsAgo: 3, amount: 95000, taxRate: 18 },
      { customerId: customers[4].id, accountId: hdfc.id, monthsAgo: 3, amount: 28000, taxRate: 18 },
      { customerId: customers[1].id, accountId: hdfc.id, monthsAgo: 2, amount: 48000, taxRate: 18 },
      { customerId: customers[0].id, accountId: hdfc.id, monthsAgo: 2, amount: 72000, taxRate: 18 },
      { customerId: customers[2].id, accountId: hdfc.id, monthsAgo: 1, amount: 39000, taxRate: 18 },
      { customerId: customers[3].id, accountId: hdfc.id, monthsAgo: 1, amount: 85000, taxRate: 18 },
      { customerId: customers[0].id, accountId: hdfc.id, monthsAgo: 0, amount: 62000, taxRate: 18 },
      { customerId: customers[4].id, accountId: hdfc.id, monthsAgo: 0, amount: 34000, taxRate: 18 },
    ];

    let saleCounter = 0;
    for (const s of salesData) {
      const date = new Date(now.getFullYear(), now.getMonth() - s.monthsAgo, Math.min(28, 5 + saleCounter));
      const tax = Math.round((s.amount * s.taxRate) / 100);
      const total = s.amount + tax;
      await db.$transaction(async (tx) => {
        const created = await tx.sale.create({
          data: {
            customerId: s.customerId,
            accountId: s.accountId,
            date,
            amount: s.amount,
            tax,
            discount: 0,
            total,
            paymentMethod: "BANK",
            status: "COMPLETED",
          },
        });
        const acc = await tx.account.findUnique({ where: { id: s.accountId } });
        if (acc) {
          await tx.account.update({
            where: { id: s.accountId },
            data: { currentBalance: acc.currentBalance + total },
          });
        }
      });
      saleCounter++;
    }

    // --- Expenses for last 6 months ---
    const expenseData: { vendorId: string; categoryId: string; accountId: string; monthsAgo: number; amount: number; budgetType: "NEED" | "WANT" | "SAVINGS" }[] = [
      { vendorId: vendors[0].id, categoryId: categories[0].id, accountId: hdfc.id, monthsAgo: 5, amount: 18000, budgetType: "NEED" },
      { vendorId: vendors[1].id, categoryId: categories[3].id, accountId: hdfc.id, monthsAgo: 5, amount: 2500, budgetType: "NEED" },
      { vendorId: vendors[2].id, categoryId: categories[0].id, accountId: hdfc.id, monthsAgo: 5, amount: 8500, budgetType: "NEED" },
      { vendorId: vendors[3].id, categoryId: categories[1].id, accountId: cash.id, monthsAgo: 4, amount: 6500, budgetType: "NEED" },
      { vendorId: vendors[4].id, categoryId: categories[5].id, accountId: paytm.id, monthsAgo: 4, amount: 4200, budgetType: "WANT" },
      { vendorId: vendors[5].id, categoryId: categories[9].id, accountId: hdfc.id, monthsAgo: 4, amount: 15000, budgetType: "SAVINGS" },
      { vendorId: vendors[0].id, categoryId: categories[0].id, accountId: hdfc.id, monthsAgo: 3, amount: 18000, budgetType: "NEED" },
      { vendorId: vendors[4].id, categoryId: categories[5].id, accountId: cash.id, monthsAgo: 3, amount: 5800, budgetType: "WANT" },
      { vendorId: vendors[2].id, categoryId: categories[0].id, accountId: hdfc.id, monthsAgo: 3, amount: 9200, budgetType: "NEED" },
      { vendorId: vendors[3].id, categoryId: categories[1].id, accountId: cash.id, monthsAgo: 2, amount: 7200, budgetType: "NEED" },
      { vendorId: vendors[4].id, categoryId: categories[5].id, accountId: paytm.id, monthsAgo: 2, amount: 6100, budgetType: "WANT" },
      { vendorId: vendors[5].id, categoryId: categories[10].id, accountId: hdfc.id, monthsAgo: 2, amount: 18000, budgetType: "SAVINGS" },
      { vendorId: vendors[0].id, categoryId: categories[0].id, accountId: hdfc.id, monthsAgo: 1, amount: 18000, budgetType: "NEED" },
      { vendorId: vendors[1].id, categoryId: categories[3].id, accountId: hdfc.id, monthsAgo: 1, amount: 2500, budgetType: "NEED" },
      { vendorId: vendors[2].id, categoryId: categories[0].id, accountId: hdfc.id, monthsAgo: 1, amount: 11000, budgetType: "NEED" },
      { vendorId: vendors[4].id, categoryId: categories[5].id, accountId: cash.id, monthsAgo: 1, amount: 7800, budgetType: "WANT" },
      { vendorId: vendors[0].id, categoryId: categories[0].id, accountId: hdfc.id, monthsAgo: 0, amount: 18000, budgetType: "NEED" },
      { vendorId: vendors[1].id, categoryId: categories[3].id, accountId: hdfc.id, monthsAgo: 0, amount: 2500, budgetType: "NEED" },
      { vendorId: vendors[3].id, categoryId: categories[1].id, accountId: cash.id, monthsAgo: 0, amount: 8200, budgetType: "NEED" },
      { vendorId: vendors[4].id, categoryId: categories[5].id, accountId: paytm.id, monthsAgo: 0, amount: 4500, budgetType: "WANT" },
    ];

    let expCounter = 0;
    for (const e of expenseData) {
      const date = new Date(now.getFullYear(), now.getMonth() - e.monthsAgo, Math.min(28, 8 + expCounter));
      await db.$transaction(async (tx) => {
        await tx.expense.create({
          data: {
            vendorId: e.vendorId,
            categoryId: e.categoryId,
            accountId: e.accountId,
            date,
            amount: e.amount,
            tax: 0,
            total: e.amount,
            paymentMethod: "BANK",
            budgetType: e.budgetType,
            status: "COMPLETED",
          },
        });
        const acc = await tx.account.findUnique({ where: { id: e.accountId } });
        if (acc) {
          await tx.account.update({
            where: { id: e.accountId },
            data: { currentBalance: acc.currentBalance - e.amount },
          });
        }
      });
      expCounter++;
    }

    // --- Transfers ---
    const transferData = [
      { from: hdfc.id, to: cash.id, monthsAgo: 2, amount: 15000 },
      { from: hdfc.id, to: paytm.id, monthsAgo: 1, amount: 5000 },
      { from: hdfc.id, to: cash.id, monthsAgo: 0, amount: 10000 },
    ];
    for (const t of transferData) {
      const date = new Date(now.getFullYear(), now.getMonth() - t.monthsAgo, 12);
      await db.$transaction(async (tx) => {
        await tx.transfer.create({
          data: { fromAccountId: t.from, toAccountId: t.to, amount: t.amount, date, fee: 0 },
        });
        const f = await tx.account.findUnique({ where: { id: t.from } });
        const to = await tx.account.findUnique({ where: { id: t.to } });
        if (f && to) {
          await tx.account.update({ where: { id: t.from }, data: { currentBalance: f.currentBalance - t.amount } });
          await tx.account.update({ where: { id: t.to }, data: { currentBalance: to.currentBalance + t.amount } });
        }
      });
    }

    // --- Invoices ---
    const invoiceData: {
      customerId: string;
      monthsAgo: number;
      dueInDays: number;
      items: { description: string; quantity: number; rate: number }[];
      taxRate: number;
      status: "DRAFT" | "SENT" | "PAID" | "PARTIALLY_PAID";
      paidAmount?: number;
    }[] = [
      {
        customerId: customers[0].id,
        monthsAgo: 2,
        dueInDays: -10,
        items: [
          { description: "Monthly consulting retainer", quantity: 1, rate: 60000 },
          { description: "Architecture review", quantity: 4, rate: 3500 },
        ],
        taxRate: 18,
        status: "PAID",
      },
      {
        customerId: customers[1].id,
        monthsAgo: 1,
        dueInDays: 15,
        items: [
          { description: "Website redesign — phase 1", quantity: 1, rate: 45000 },
          { description: "UI audit", quantity: 1, rate: 12000 },
        ],
        taxRate: 18,
        status: "SENT",
      },
      {
        customerId: customers[2].id,
        monthsAgo: 0,
        dueInDays: 30,
        items: [{ description: "DevOps setup & deployment", quantity: 1, rate: 38000 }],
        taxRate: 18,
        status: "SENT",
      },
      {
        customerId: customers[3].id,
        monthsAgo: 0,
        dueInDays: 25,
        items: [
          { description: "API integration", quantity: 1, rate: 55000 },
          { description: "Performance tuning", quantity: 2, rate: 8000 },
        ],
        taxRate: 18,
        status: "PARTIALLY_PAID",
        paidAmount: 35000,
      },
      {
        customerId: customers[4].id,
        monthsAgo: 0,
        dueInDays: -3,
        items: [{ description: "Quarterly audit", quantity: 1, rate: 28000 }],
        taxRate: 18,
        status: "SENT",
      },
    ];

    let invCount = 0;
    for (const inv of invoiceData) {
      const issueDate = new Date(now.getFullYear(), now.getMonth() - inv.monthsAgo, 10);
      const dueDate = new Date(issueDate);
      dueDate.setDate(dueDate.getDate() + inv.dueInDays);
      const { subtotal, tax, total } = computeInvoiceTotals(inv.items, inv.taxRate, 0);
      const paidAmount = inv.paidAmount ?? (inv.status === "PAID" ? total : 0);
      const number = generateInvoiceNumber(invCount);
      invCount++;
      await db.$transaction(async (tx) => {
        const created = await tx.invoice.create({
          data: {
            number,
            customerId: inv.customerId,
            issueDate,
            dueDate,
            subtotal,
            taxRate: inv.taxRate,
            tax,
            discount: 0,
            total,
            paidAmount,
            status: inv.status,
            items: {
              create: inv.items.map((it) => ({
                description: it.description,
                quantity: it.quantity,
                rate: it.rate,
                amount: it.quantity * it.rate,
              })),
            },
          },
        });
        await syncARForInvoice(tx, created.id);
      });
    }

    // --- AP bills ---
    const apData = [
      { vendorId: vendors[0].id, monthsAgo: 0, dueInDays: -2, amount: 18000, billNumber: "WW-2025-08" },
      { vendorId: vendors[2].id, monthsAgo: 0, dueInDays: 10, amount: 11000, billNumber: "AWS-2025-08" },
      { vendorId: vendors[5].id, monthsAgo: 0, dueInDays: 20, amount: 18000, billNumber: "ZD-2025-08" },
    ];
    for (const a of apData) {
      const issueDate = new Date(now.getFullYear(), now.getMonth() - a.monthsAgo, 5);
      const dueDate = new Date(issueDate);
      dueDate.setDate(dueDate.getDate() + a.dueInDays);
      await db.accountsPayable.create({
        data: {
          vendorId: a.vendorId,
          billNumber: a.billNumber,
          amount: a.amount,
          paidAmount: 0,
          issueDate,
          dueDate,
          status: "OUTSTANDING",
        },
      });
    }

    const counts = {
      accounts: await db.account.count(),
      customers: await db.customer.count(),
      vendors: await db.vendor.count(),
      categories: await db.category.count(),
      sales: await db.sale.count(),
      expenses: await db.expense.count(),
      invoices: await db.invoice.count(),
      transfers: await db.transfer.count(),
      ar: await db.accountsReceivable.count(),
      ap: await db.accountsPayable.count(),
      budget: await db.budget.count(),
      goals: await db.savingsGoal.count(),
      recurring: await db.recurringTransaction.count(),
    };
    return ok({ seeded: true, counts });
  } catch (e) {
    return serverError(e);
  }
}

const FINANCE_PALETTE = [
  "#10b981", "#14b8a6", "#06b6d4", "#84cc16", "#eab308",
  "#f97316", "#ef4444", "#ec4899", "#8b5cf6", "#6366f1",
  "#0ea5e9", "#22c55e",
];
