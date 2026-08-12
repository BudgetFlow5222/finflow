"use client";

import { create } from "zustand";
import type { ViewKey } from "@/components/app/sidebar";

// Lightweight UI store: tracks the active view and which form dialog to open
// (so the global Quick Add menu can trigger a form inside a specific view).
interface UIState {
  view: ViewKey;
  pendingForm: string | null; // e.g. "sale", "expense", "invoice", "transfer", "account", "customer", "vendor", "goal", "recurring"
  setView: (v: ViewKey) => void;
  openForm: (form: string) => void; // sets view if needed + form
  consumeForm: () => string | null;
}

export const useUI = create<UIState>((set, get) => ({
  view: "dashboard",
  pendingForm: null,
  setView: (v) => set({ view: v }),
  openForm: (form) => set({ pendingForm: form }),
  consumeForm: () => {
    const f = get().pendingForm;
    if (f) set({ pendingForm: null });
    return f;
  },
}));
