"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Generic fetch helper
// ---------------------------------------------------------------------------

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message =
      (data as { error?: string })?.error ?? `Request failed (${res.status})`;
    throw new Error(message);
  }
  return data as T;
}

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const qk = {
  dashboard: ["dashboard"] as const,
  accounts: ["accounts"] as const,
  customers: ["customers"] as const,
  vendors: ["vendors"] as const,
  categories: ["categories"] as const,
  sales: ["sales"] as const,
  expenses: ["expenses"] as const,
  transfers: ["transfers"] as const,
  invoices: ["invoices"] as const,
  ar: ["ar"] as const,
  ap: ["ap"] as const,
  budget: ["budget"] as const,
  budgetMonth: (m: string) => ["budget", m] as const,
  goals: ["goals"] as const,
  recurring: ["recurring"] as const,
  reconcile: ["reconcile"] as const,
  health: ["health"] as const,
  alerts: ["alerts"] as const,
  calendar: (m: string) => ["calendar", m] as const,
};

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useDashboard() {
  return useQuery({
    queryKey: qk.dashboard,
    queryFn: () => fetchJson<import("@/types").DashboardData>("/api/dashboard"),
  });
}

export function useAccounts() {
  return useQuery({
    queryKey: qk.accounts,
    queryFn: () => fetchJson<import("@/types").Account[]>("/api/accounts"),
  });
}

export function useCustomers() {
  return useQuery({
    queryKey: qk.customers,
    queryFn: () => fetchJson<import("@/types").Customer[]>("/api/customers"),
  });
}

export function useVendors() {
  return useQuery({
    queryKey: qk.vendors,
    queryFn: () => fetchJson<import("@/types").Vendor[]>("/api/vendors"),
  });
}

export function useCategories() {
  return useQuery({
    queryKey: qk.categories,
    queryFn: () => fetchJson<import("@/types").Category[]>("/api/categories"),
  });
}

export function useSales(limit = 100) {
  return useQuery({
    queryKey: qk.sales,
    queryFn: () =>
      fetchJson<import("@/types").Sale[]>(`/api/sales?limit=${limit}`),
  });
}

export function useExpenses(limit = 100) {
  return useQuery({
    queryKey: qk.expenses,
    queryFn: () =>
      fetchJson<import("@/types").Expense[]>(`/api/expenses?limit=${limit}`),
  });
}

export function useTransfers() {
  return useQuery({
    queryKey: qk.transfers,
    queryFn: () => fetchJson<import("@/types").Transfer[]>("/api/transfers"),
  });
}

export function useInvoices(limit = 100) {
  return useQuery({
    queryKey: qk.invoices,
    queryFn: () =>
      fetchJson<import("@/types").Invoice[]>(`/api/invoices?limit=${limit}`),
  });
}

export function useAR() {
  return useQuery({
    queryKey: qk.ar,
    queryFn: () => fetchJson<import("@/types").AccountsReceivable[]>("/api/ar"),
  });
}

export function useAP() {
  return useQuery({
    queryKey: qk.ap,
    queryFn: () => fetchJson<import("@/types").AccountsPayable[]>("/api/ap"),
  });
}

export function useBudget() {
  return useQuery({
    queryKey: qk.budget,
    queryFn: () => fetchJson<import("@/types").Budget[]>("/api/budget"),
  });
}

export function useGoals() {
  return useQuery({
    queryKey: qk.goals,
    queryFn: () => fetchJson<import("@/types").SavingsGoal[]>("/api/goals"),
  });
}

export function useRecurring() {
  return useQuery({
    queryKey: qk.recurring,
    queryFn: () => fetchJson<import("@/types").RecurringTransaction[]>("/api/recurring"),
  });
}

export function useReconciliations(accountId?: string) {
  return useQuery({
    queryKey: accountId ? ["reconcile", accountId] : qk.reconcile,
    queryFn: () =>
      fetchJson<import("@/types").Reconciliation[]>(
        `/api/reconcile${accountId ? `?accountId=${accountId}` : ""}`,
      ),
  });
}

export function useHealthScore() {
  return useQuery({
    queryKey: qk.health,
    queryFn: () => fetchJson<import("@/types").HealthScore>("/api/health"),
    refetchInterval: 60_000, // refresh every minute
  });
}

export function useBudgetAlerts() {
  return useQuery({
    queryKey: qk.alerts,
    queryFn: () => fetchJson<import("@/types").BudgetAlert[]>("/api/alerts"),
    refetchInterval: 30_000, // refresh every 30 seconds
  });
}

export function useCalendar(month: string) {
  return useQuery({
    queryKey: qk.calendar(month),
    queryFn: () =>
      fetchJson<import("@/types").CalendarEvent[]>(
        `/api/calendar?month=${encodeURIComponent(month)}`,
      ),
    enabled: Boolean(month) && /^\d{4}-\d{2}$/.test(month),
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useCreate<TBody, TResp>(url: string, keysToInvalidate: ReadonlyArray<readonly unknown[]>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: TBody) => fetchJson<TResp>(url, { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      keysToInvalidate.forEach((k) => qc.invalidateQueries({ queryKey: k }));
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdate<TBody, TResp>(urlFn: (id: string) => string, keysToInvalidate: ReadonlyArray<readonly unknown[]>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: TBody }) =>
      fetchJson<TResp>(urlFn(id), { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: () => {
      keysToInvalidate.forEach((k) => qc.invalidateQueries({ queryKey: k }));
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDelete(urlFn: (id: string) => string, keysToInvalidate: ReadonlyArray<readonly unknown[]>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => fetchJson(urlFn(id), { method: "DELETE" }),
    onSuccess: () => {
      keysToInvalidate.forEach((k) => qc.invalidateQueries({ queryKey: k }));
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useSeed() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => fetchJson("/api/seed", { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries();
      toast.success("Demo data loaded");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
