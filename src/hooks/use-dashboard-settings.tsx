"use client";

import * as React from "react";

// Dashboard widget visibility settings — persisted to localStorage.
export type WidgetKey =
  | "healthScore"
  | "budgetAlerts"
  | "kpiCards"
  | "secondaryKpis"
  | "cashFlowChart"
  | "budgetDonut"
  | "accountBalances"
  | "expenseBreakdown"
  | "recentInvoices"
  | "recentExpenses"
  | "arApWidgets"
  | "savingsGoals"
  | "incomeTrend";

const DEFAULT_VISIBILITY: Record<WidgetKey, boolean> = {
  healthScore: true,
  budgetAlerts: true,
  kpiCards: true,
  secondaryKpis: true,
  cashFlowChart: true,
  budgetDonut: true,
  accountBalances: true,
  expenseBreakdown: true,
  recentInvoices: true,
  recentExpenses: true,
  arApWidgets: true,
  savingsGoals: true,
  incomeTrend: true,
};

const STORAGE_KEY = "finflow-dashboard-widgets";

function loadVisibility(): Record<WidgetKey, boolean> {
  if (typeof window === "undefined") return DEFAULT_VISIBILITY;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return DEFAULT_VISIBILITY;
    const parsed = JSON.parse(stored);
    return { ...DEFAULT_VISIBILITY, ...parsed };
  } catch {
    return DEFAULT_VISIBILITY;
  }
}

interface DashboardSettings {
  visibility: Record<WidgetKey, boolean>;
  toggleWidget: (key: WidgetKey) => void;
  setAll: (visible: boolean) => void;
  reset: () => void;
}

const DashboardSettingsContext = React.createContext<DashboardSettings | null>(null);

export function DashboardSettingsProvider({ children }: { children: React.ReactNode }) {
  const [visibility, setVisibility] = React.useState<Record<WidgetKey, boolean>>(DEFAULT_VISIBILITY);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setVisibility(loadVisibility());
    setMounted(true);
  }, []);

  const toggleWidget = React.useCallback((key: WidgetKey) => {
    setVisibility((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      if (typeof window !== "undefined") {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      }
      return next;
    });
  }, []);

  const setAll = React.useCallback((visible: boolean) => {
    const next = Object.fromEntries(
      Object.keys(DEFAULT_VISIBILITY).map((k) => [k, visible]),
    ) as Record<WidgetKey, boolean>;
    setVisibility(next);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    }
  }, []);

  const reset = React.useCallback(() => {
    setVisibility(DEFAULT_VISIBILITY);
    if (typeof window !== "undefined") {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const value = React.useMemo(
    () => ({ visibility: mounted ? visibility : DEFAULT_VISIBILITY, toggleWidget, setAll, reset }),
    [visibility, mounted, toggleWidget, setAll, reset],
  );

  return (
    <DashboardSettingsContext.Provider value={value}>
      {children}
    </DashboardSettingsContext.Provider>
  );
}

export function useDashboardSettings() {
  const ctx = React.useContext(DashboardSettingsContext);
  if (!ctx) {
    return {
      visibility: DEFAULT_VISIBILITY,
      toggleWidget: () => {},
      setAll: () => {},
      reset: () => {},
    };
  }
  return ctx;
}

// Collapsible section state — also persisted
export function useCollapsibleState(sectionKey: string, defaultOpen = true) {
  const [isOpen, setIsOpen] = React.useState(defaultOpen);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(`finflow-collapse-${sectionKey}`);
      if (stored !== null) {
        setIsOpen(stored === "true");
      }
    }
    setMounted(true);
  }, [sectionKey]);

  const toggle = React.useCallback(() => {
    setIsOpen((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        localStorage.setItem(`finflow-collapse-${sectionKey}`, String(next));
      }
      return next;
    });
  }, [sectionKey]);

  return { isOpen: mounted ? isOpen : defaultOpen, toggle };
}
