"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useSession } from "@/store/session";

const SessionHintContext = createContext<string | null>(null);

/**
 * The session store fills in after the page mounts, so on the very first render every page looks like a visitor's.
 * The root layout knows who is signed in (from the cookie) and hands the id down here, so the parts of the page that
 * differ between a member and a visitor (the header's account controls, sign-in prompts) are right from the first
 * paint instead of flashing "sign in" at someone who already has.
 */
export function SessionHint({ userId, children }: { userId: string | null; children: ReactNode }) {
  return <SessionHintContext.Provider value={userId}>{children}</SessionHintContext.Provider>;
}

/** The signed-in account's id, or null for a visitor — correct from the first render, and following sign-in and sign-out afterwards. */
export function useSignedInUserId(): string | null {
  const hint = useContext(SessionHintContext);
  const inStore = useSession((s) => s.currentUserId);
  return inStore ?? hint;
}
