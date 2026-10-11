import { useQuery } from "@tanstack/react-query";
import { apiJson } from "./api";
import { useSession } from "./session";
import type { LockRule } from "./types";

/** GET /api/me/wallet — the account's coins, unlock credits, the lock settings, and the locked chapters it has opened. */
export interface Wallet extends LockRule {
  coins: number;
  unlockCredits: number;
  creditProgress: number;
  chaptersPerCredit: number;
  coinPrice: number;
  unlockedChapterIds: string[];
}

export function useWallet() {
  const { status } = useSession();
  return useQuery({
    queryKey: ["wallet"],
    queryFn: () => apiJson<Wallet>("/api/me/wallet"),
    enabled: status === "signedIn",
    staleTime: 30_000,
  });
}
