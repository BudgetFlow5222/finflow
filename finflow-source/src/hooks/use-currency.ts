"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CurrencyCode } from "@/lib/currency";

interface CurrencyState {
  currency: CurrencyCode;
  setCurrency: (c: CurrencyCode) => void;
}

/**
 * Display-currency store. All amounts are stored in INR (base); the active
 * `currency` controls how they are displayed (converted + formatted).
 * Persisted to localStorage so the choice survives reloads.
 */
export const useCurrency = create<CurrencyState>()(
  persist(
    (set) => ({
      currency: "INR",
      setCurrency: (c) => set({ currency: c }),
    }),
    {
      name: "finflow-currency",
      // Only persist the currency choice, not the setter.
      partialize: (s) => ({ currency: s.currency }),
    },
  ),
);
