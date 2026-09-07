"use client";

import { create } from "zustand";

export interface ToastItem {
  id: string;
  title: string;
  description?: string;
}

interface ToastState {
  items: ToastItem[];
  push: (toast: Omit<ToastItem, "id">) => void;
  dismiss: (id: string) => void;
}

/** Ephemeral, never persisted — a toast queue only makes sense for the current tab session. */
export const useToast = create<ToastState>((set) => ({
  items: [],
  push: (toast) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    set((s) => ({ items: [...s.items, { ...toast, id }] }));
  },
  dismiss: (id) => {
    set((s) => ({ items: s.items.filter((t) => t.id !== id) }));
  },
}));
