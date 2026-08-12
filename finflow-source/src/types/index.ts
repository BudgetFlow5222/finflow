// FinFlow — shared TypeScript types. Mirror Prisma models for API/UI consumption.

export type AccountType = "CASH" | "BANK" | "WALLET" | "UPI" | "CARD";
export type AccountStatus = "ACTIVE" | "CLOSED" | "FROZEN";
export type PaymentMethod = "CASH" | "BANK" | "UPI" | "CARD" | "WALLET";
export type BudgetType = "NEED" | "WANT" | "SAVINGS";
export type TransactionStatus = "COMPLETED" | "PENDING" | "REFUNDED";

export type InvoiceStatus =
  | "DRAFT"
  | "SENT"
  | "PAID"
  | "PARTIALLY_PAID"
  | "OVERDUE"
  | "CANCELLED";

export type ArApStatus =
  | "OUTSTANDING"
  | "PARTIALLY_PAID"
  | "PAID"
  | "OVERDUE";

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  openingBalance: number;
  currentBalance: number;
  currency: string;
  status: AccountStatus;
  color?: string | null;
  notes?: string | null;
  lastReconciledAt?: string | null;
  lastReconciledBalance?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface Customer {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  notes?: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface Vendor {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  notes?: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  name: string;
  type: "INCOME" | "EXPENSE";
  budgetType?: BudgetType | null;
  color?: string | null;
  icon?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Sale {
  id: string;
  customerId: string;
  accountId: string;
  invoiceId?: string | null;
  date: string;
  amount: number;
  tax: number;
  discount: number;
  total: number;
  paymentMethod?: PaymentMethod | null;
  status: TransactionStatus;
  notes?: string | null;
  customer?: Customer;
  account?: Account;
  invoice?: Invoice;
  createdAt: string;
  updatedAt: string;
}

export interface Expense {
  id: string;
  vendorId?: string | null;
  categoryId?: string | null;
  accountId: string;
  date: string;
  amount: number;
  tax: number;
  total: number;
  paymentMethod?: PaymentMethod | null;
  budgetType?: BudgetType | null;
  status: TransactionStatus;
  notes?: string | null;
  vendor?: Vendor;
  category?: Category;
  account?: Account;
  createdAt: string;
  updatedAt: string;
}

export interface Transfer {
  id: string;
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  date: string;
  notes?: string | null;
  fee: number;
  fromAccount?: Account;
  toAccount?: Account;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceItem {
  id: string;
  invoiceId: string;
  description: string;
  quantity: number;
  rate: number;
  amount: number;
  createdAt: string;
}

export interface Invoice {
  id: string;
  number: string;
  customerId: string;
  issueDate: string;
  dueDate: string;
  subtotal: number;
  taxRate: number;
  tax: number;
  discount: number;
  total: number;
  paidAmount: number;
  status: InvoiceStatus;
  notes?: string | null;
  customer?: Customer;
  items?: InvoiceItem[];
  sale?: Sale;
  ar?: AccountsReceivable;
  createdAt: string;
  updatedAt: string;
}

export interface AccountsReceivable {
  id: string;
  invoiceId: string;
  customerId: string;
  amount: number;
  paidAmount: number;
  dueDate: string;
  status: ArApStatus;
  createdAt: string;
  updatedAt: string;
  invoice?: Invoice;
  customer?: Customer;
}

export interface AccountsPayable {
  id: string;
  vendorId: string;
  billNumber?: string | null;
  amount: number;
  paidAmount: number;
  dueDate: string;
  issueDate: string;
  status: ArApStatus;
  notes?: string | null;
  vendor?: Vendor;
  createdAt: string;
  updatedAt: string;
}

export interface Budget {
  id: string;
  month: string;
  income: number;
  needsPct: number;
  wantsPct: number;
  savingsPct: number;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SavingsGoal {
  id: string;
  name: string;
  targetAmount: number;
  savedAmount: number;
  targetDate?: string | null;
  color?: string | null;
  icon?: string | null;
  status: "ACTIVE" | "COMPLETED" | "PAUSED";
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RecurringTransaction {
  id: string;
  name: string;
  type: "INCOME" | "EXPENSE";
  amount: number;
  categoryId?: string | null;
  accountId: string;
  vendorId?: string | null;
  customerId?: string | null;
  frequency: "DAILY" | "WEEKLY" | "MONTHLY" | "QUARTERLY" | "YEARLY";
  interval: number;
  nextDate: string;
  endDate?: string | null;
  paymentMethod?: PaymentMethod | null;
  budgetType?: BudgetType | null;
  status: "ACTIVE" | "PAUSED" | "COMPLETED";
  notes?: string | null;
  lastPosted?: string | null;
  createdAt: string;
  updatedAt: string;
  category?: Category;
  account?: Account;
  vendor?: Vendor;
  customer?: Customer;
}

// ---------------------------------------------------------------------------
// Dashboard aggregates
// ---------------------------------------------------------------------------

export interface DashboardData {
  kpis: {
    totalBalance: number;
    monthlyIncome: number;
    monthlyExpenses: number;
    netCashFlow: number;
    outstandingAR: number;
    outstandingAP: number;
    budgetUsedPct: number;
  };
  accounts: Account[];
  cashFlow: { month: string; income: number; expense: number; net: number }[];
  budgetSplit: { name: BudgetType; value: number; pct: number; spent: number }[];
  expenseByCategory: { name: string; value: number; color: string }[];
  incomeByMonth: { month: string; value: number }[];
  recentInvoices: (Invoice & { customer?: Customer })[];
  recentExpenses: (Expense & { vendor?: Vendor; category?: Category })[];
  arList: (AccountsReceivable & { customer?: Customer; invoice?: Invoice })[];
  apList: (AccountsPayable & { vendor?: Vendor })[];
  monthlyBudget: Budget | null;
  monthlySpent: { needs: number; wants: number; savings: number; total: number };
  savingsGoals: SavingsGoal[];
  alerts: { type: "AR" | "AP" | "BUDGET" | "OVERDUE"; message: string; severity: "info" | "warning" | "danger" }[];
}

export interface HealthScore {
  overall: number; // 0-100
  grade: "A" | "B" | "C" | "D" | "F";
  factors: {
    key: string;
    label: string;
    score: number; // 0-100
    weight: number; // percentage of overall
    value: string; // display value
    status: "good" | "fair" | "poor";
    description: string;
  }[];
  recommendations: { title: string; description: string; priority: "high" | "medium" | "low" }[];
}

export interface Reconciliation {
  id: string;
  accountId: string;
  statementDate: string;
  statementBalance: number;
  systemBalance: number;
  difference: number;
  status: "MATCHED" | "DISCREPANCY" | "ADJUSTED";
  notes?: string | null;
  createdAt: string;
  account?: Account;
}

// ---------------------------------------------------------------------------
// Calendar events — unified financial timeline (bills, invoices, recurring, goals)
// ---------------------------------------------------------------------------

export type CalendarEventType =
  | "bill_due"
  | "bill_overdue"
  | "invoice_due"
  | "invoice_overdue"
  | "recurring"
  | "goal_deadline";

export type CalendarEventStatus = "upcoming" | "overdue" | "due_today";

export type CalendarEventEntity = "ap" | "ar" | "recurring" | "invoice" | "goal";

export interface CalendarEvent {
  id: string;
  date: string; // ISO date (YYYY-MM-DD)
  type: CalendarEventType;
  title: string;
  amount: number;
  status: CalendarEventStatus;
  entity: CalendarEventEntity;
  entityId: string;
  description?: string;
  color: string; // hex color for the event dot
}

// ---------------------------------------------------------------------------
// Budget alerts — proactive warnings surfaced on the dashboard
// ---------------------------------------------------------------------------

export type BudgetAlertType =
  | "BUDGET_THRESHOLD"
  | "OVERDRAFT"
  | "OVERDUE"
  | "GOAL_BEHIND"
  | "INFO";

export type BudgetAlertSeverity = "info" | "warning" | "danger" | "success";

export interface BudgetAlert {
  id: string;
  type: BudgetAlertType;
  severity: BudgetAlertSeverity;
  title: string;
  message: string;
  category?: string;
  currentAmount?: number;
  budgetAmount?: number;
  percentage?: number;
  action?: string;
}
