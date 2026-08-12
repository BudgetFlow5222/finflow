import { z } from "zod";

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

export const accountTypeEnum = z.enum(["CASH", "BANK", "WALLET", "UPI", "CARD"]);
export const accountStatusEnum = z.enum(["ACTIVE", "CLOSED", "FROZEN"]);
export const paymentMethodEnum = z.enum(["CASH", "BANK", "UPI", "CARD", "WALLET"]);
export const budgetTypeEnum = z.enum(["NEED", "WANT", "SAVINGS"]);
export const transactionStatusEnum = z.enum(["COMPLETED", "PENDING", "REFUNDED"]);
export const invoiceStatusEnum = z.enum([
  "DRAFT",
  "SENT",
  "PAID",
  "PARTIALLY_PAID",
  "OVERDUE",
  "CANCELLED",
]);
export const arApStatusEnum = z.enum([
  "OUTSTANDING",
  "PARTIALLY_PAID",
  "PAID",
  "OVERDUE",
]);

// ---------------------------------------------------------------------------
// Account
// ---------------------------------------------------------------------------

export const accountSchema = z.object({
  name: z.string().min(1, "Name is required").max(80),
  type: accountTypeEnum,
  openingBalance: z.coerce.number().default(0),
  currency: z.string().max(8).default("INR"),
  status: accountStatusEnum.default("ACTIVE"),
  color: z.string().max(20).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
});
export type AccountInput = z.infer<typeof accountSchema>;

// ---------------------------------------------------------------------------
// Customer / Vendor
// ---------------------------------------------------------------------------

export const customerSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().max(30).optional().or(z.literal("")),
  company: z.string().max(120).optional().or(z.literal("")),
  notes: z.string().max(500).optional().or(z.literal("")),
  status: z.string().default("ACTIVE"),
});
export type CustomerInput = z.infer<typeof customerSchema>;

export const vendorSchema = customerSchema;
export type VendorInput = z.infer<typeof vendorSchema>;

// ---------------------------------------------------------------------------
// Category
// ---------------------------------------------------------------------------

export const categorySchema = z.object({
  name: z.string().min(1).max(80),
  type: z.enum(["INCOME", "EXPENSE"]),
  budgetType: budgetTypeEnum.optional().nullable(),
  color: z.string().max(20).optional().nullable(),
  icon: z.string().max(60).optional().nullable(),
});
export type CategoryInput = z.infer<typeof categorySchema>;

// ---------------------------------------------------------------------------
// Sale
// ---------------------------------------------------------------------------

export const saleSchema = z.object({
  customerId: z.string().min(1),
  accountId: z.string().min(1),
  invoiceId: z.string().optional().nullable(),
  date: z.coerce.date(),
  amount: z.coerce.number().min(0),
  tax: z.coerce.number().min(0).default(0),
  discount: z.coerce.number().min(0).default(0),
  paymentMethod: paymentMethodEnum.optional().nullable(),
  status: transactionStatusEnum.default("COMPLETED"),
  notes: z.string().max(500).optional().nullable(),
});
export type SaleInput = z.infer<typeof saleSchema>;

// ---------------------------------------------------------------------------
// Expense
// ---------------------------------------------------------------------------

export const expenseSchema = z.object({
  vendorId: z.string().optional().nullable(),
  categoryId: z.string().optional().nullable(),
  accountId: z.string().min(1),
  date: z.coerce.date(),
  amount: z.coerce.number().min(0),
  tax: z.coerce.number().min(0).default(0),
  paymentMethod: paymentMethodEnum.optional().nullable(),
  budgetType: budgetTypeEnum.optional().nullable(),
  status: transactionStatusEnum.default("COMPLETED"),
  notes: z.string().max(500).optional().nullable(),
});
export type ExpenseInput = z.infer<typeof expenseSchema>;

// ---------------------------------------------------------------------------
// Transfer
// ---------------------------------------------------------------------------

export const transferSchema = z
  .object({
    fromAccountId: z.string().min(1),
    toAccountId: z.string().min(1),
    amount: z.coerce.number().positive("Amount must be positive"),
    date: z.coerce.date(),
    notes: z.string().max(500).optional().nullable(),
    fee: z.coerce.number().min(0).default(0),
  })
  .refine((d) => d.fromAccountId !== d.toAccountId, {
    message: "Source and destination accounts must differ",
    path: ["toAccountId"],
  });
export type TransferInput = z.infer<typeof transferSchema>;

// ---------------------------------------------------------------------------
// Invoice + items
// ---------------------------------------------------------------------------

export const invoiceItemSchema = z.object({
  id: z.string().optional(),
  description: z.string().min(1).max(200),
  quantity: z.coerce.number().min(0).default(1),
  rate: z.coerce.number().min(0).default(0),
});
export type InvoiceItemInput = z.infer<typeof invoiceItemSchema>;

export const invoiceSchema = z.object({
  number: z.string().min(1).max(40),
  customerId: z.string().min(1),
  issueDate: z.coerce.date(),
  dueDate: z.coerce.date(),
  taxRate: z.coerce.number().min(0).max(100).default(0),
  discount: z.coerce.number().min(0).default(0),
  status: invoiceStatusEnum.default("DRAFT"),
  notes: z.string().max(500).optional().nullable(),
  items: z.array(invoiceItemSchema).min(1, "At least one line item is required"),
});
export type InvoiceInput = z.infer<typeof invoiceSchema>;

// ---------------------------------------------------------------------------
// Accounts Payable (manual bill)
// ---------------------------------------------------------------------------

export const apSchema = z.object({
  vendorId: z.string().min(1),
  billNumber: z.string().max(80).optional().nullable(),
  amount: z.coerce.number().positive(),
  paidAmount: z.coerce.number().min(0).default(0),
  dueDate: z.coerce.date(),
  issueDate: z.coerce.date().default(new Date()),
  notes: z.string().max(500).optional().nullable(),
  status: arApStatusEnum.default("OUTSTANDING"),
});
export type ApInput = z.infer<typeof apSchema>;

// ---------------------------------------------------------------------------
// Budget (50/30/20)
// ---------------------------------------------------------------------------

export const budgetSchema = z
  .object({
    month: z.string().regex(/^\d{4}-\d{2}$/, "Use YYYY-MM"),
    income: z.coerce.number().min(0),
    needsPct: z.coerce.number().min(0).max(100).default(50),
    wantsPct: z.coerce.number().min(0).max(100).default(30),
    savingsPct: z.coerce.number().min(0).max(100).default(20),
    notes: z.string().max(500).optional().nullable(),
  })
  .refine((d) => Math.abs(d.needsPct + d.wantsPct + d.savingsPct - 100) < 0.01, {
    message: "Needs + Wants + Savings must equal 100%",
    path: ["savingsPct"],
  });
export type BudgetInput = z.infer<typeof budgetSchema>;

// ---------------------------------------------------------------------------
// AR/AP payment recording
// ---------------------------------------------------------------------------

export const paymentSchema = z.object({
  amount: z.coerce.number().positive("Payment amount must be positive"),
  accountId: z.string().min(1, "Select a payment account"),
  date: z.coerce.date().default(new Date()),
  notes: z.string().max(500).optional().nullable(),
});
export type PaymentInput = z.infer<typeof paymentSchema>;

// ---------------------------------------------------------------------------
// Savings Goals
// ---------------------------------------------------------------------------

export const savingsGoalSchema = z.object({
  name: z.string().min(1, "Name is required").max(120),
  targetAmount: z.coerce.number().positive("Target must be positive"),
  savedAmount: z.coerce.number().min(0).default(0),
  targetDate: z.coerce.date().optional().nullable(),
  color: z.string().max(20).optional().nullable(),
  icon: z.string().max(60).optional().nullable(),
  status: z.enum(["ACTIVE", "COMPLETED", "PAUSED"]).default("ACTIVE"),
  notes: z.string().max(500).optional().nullable(),
});
export type SavingsGoalInput = z.infer<typeof savingsGoalSchema>;

// ---------------------------------------------------------------------------
// Recurring Transactions
// ---------------------------------------------------------------------------

export const recurringSchema = z.object({
  name: z.string().min(1, "Name is required").max(120),
  type: z.enum(["INCOME", "EXPENSE"]),
  amount: z.coerce.number().positive("Amount must be positive"),
  categoryId: z.string().optional().nullable(),
  accountId: z.string().min(1, "Account is required"),
  vendorId: z.string().optional().nullable(),
  customerId: z.string().optional().nullable(),
  frequency: z.enum(["DAILY", "WEEKLY", "MONTHLY", "QUARTERLY", "YEARLY"]),
  interval: z.coerce.number().int().min(1).default(1),
  nextDate: z.coerce.date(),
  endDate: z.coerce.date().optional().nullable(),
  paymentMethod: paymentMethodEnum.optional().nullable(),
  budgetType: budgetTypeEnum.optional().nullable(),
  status: z.enum(["ACTIVE", "PAUSED", "COMPLETED"]).default("ACTIVE"),
  notes: z.string().max(500).optional().nullable(),
});
export type RecurringInput = z.infer<typeof recurringSchema>;
