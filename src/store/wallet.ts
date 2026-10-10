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
  /** The server's lock rule for everyone, visitors included (a member's wallet carries the same numbers). */
  rule: LockRule | null;
  /** True once the server has answered at least once for this session — until then a lock screen must not be trusted. */
  loaded: boolean;
  refresh: () => Promise<void>;
  loadRule: () => Promise<void>;
  unlock: (chapterId: string, method: UnlockMethod) => Promise<UnlockResult>;
  reset: () => void;
}

/** The rule to draw locks with: the member's wallet, else the rule the server told everyone, else its launch defaults. */
export function lockRuleOf(wallet: Wallet | null, rule: LockRule | null = null): LockRule {
  if (wallet) return { lockedWindow: wallet.lockedWindow, freeFirstChapters: wallet.freeFirstChapters };
  return rule ?? DEFAULT_LOCK_RULE;
}

const RULE_REFRESH_MS = 60_000;
let ruleAskedAt = 0;

export const useWallet = create<WalletState>((set, get) => ({
  wallet: null,
  rule: null,
  loaded: false,

  loadRule: async () => {
    if (Date.now() - ruleAskedAt < RULE_REFRESH_MS) return;
    ruleAskedAt = Date.now();
    try {
      const res = await fetch("/api/wallet/rule", { cache: "no-store" });
      if (!res.ok) return void (ruleAskedAt = 0);
      const body = (await res.json()) as Partial<LockRule>;
      if (typeof body.lockedWindow === "number" && typeof body.freeFirstChapters === "number") {
        set({ rule: { lockedWindow: body.lockedWindow, freeFirstChapters: body.freeFirstChapters } });
      }
    } catch {
      ruleAskedAt = 0; // offline or restarting: ask again next time
    }
  },

  refresh: async () => {
    void get().loadRule();
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
