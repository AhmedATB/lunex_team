"use client";

import { create } from "zustand";
import { DEFAULT_LOCK_RULE, type LockRule } from "@/lib/chapter-lock";
import { useSession } from "@/store/session";
import { useToast } from "@/store/toast";

/** The signed-in member's coins, reading credits and opened chapters, as the server reports them (backend modules/wallet). */
export interface Wallet extends LockRule {
  coins: number;
  unlockCredits: number;
  /** Finished chapters counted toward the next credit. */
  creditProgress: number;
  chaptersPerCredit: number;
  coinPrice: number;
  unlockedChapterIds: string[];
}

export type UnlockMethod = "credit" | "coins";
export type UnlockResult = { ok: true } | { ok: false; code: "insufficient_credits" | "insufficient_coins" | "error" };

interface WalletState {
  wallet: Wallet | null;
  /** True once the server has answered at least once for this session — until then a lock screen must not be trusted. */
  loaded: boolean;
  refresh: () => Promise<void>;
  unlock: (chapterId: string, method: UnlockMethod) => Promise<UnlockResult>;
  reset: () => void;
}

/** The rule to draw locks with: the server's once known, its launch defaults before. */
export function lockRuleOf(wallet: Wallet | null): LockRule {
  return wallet ? { lockedWindow: wallet.lockedWindow, freeFirstChapters: wallet.freeFirstChapters } : DEFAULT_LOCK_RULE;
}

export const useWallet = create<WalletState>((set, get) => ({
  wallet: null,
  loaded: false,

  refresh: async () => {
    if (!useSession.getState().currentUserId) return get().reset();
    try {
      const res = await fetch("/api/me/wallet", { cache: "no-store" });
      if (res.ok) set({ wallet: (await res.json()) as Wallet, loaded: true });
    } catch {
      // offline or restarting: keep what is shown; the next look catches up
    }
  },

  unlock: async (chapterId, method) => {
    try {
      const res = await fetch(`/api/chapters/${encodeURIComponent(chapterId)}/unlock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method }),
      });
      const body = await res.json().catch(() => null);
      if (res.ok) {
        set({ wallet: body as Wallet, loaded: true });
        useToast.getState().push({ title: "تم فتح الفصل", description: method === "credit" ? "استُخدم رصيد قراءة." : "خُصمت العملات من رصيدك." });
        return { ok: true };
      }
      const code = body?.code === "insufficient_credits" || body?.code === "insufficient_coins" ? body.code : "error";
      return { ok: false, code };
    } catch {
      return { ok: false, code: "error" };
    }
  },

  reset: () => set({ wallet: null, loaded: false }),
}));
