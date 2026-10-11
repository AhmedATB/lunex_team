import { useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { apiFetch, apiJson, ApiError } from "./api";
import { syncLibrary } from "./library";
import { OAuthError, signInWithProvider, type OAuthProvider } from "./oauth";
import { fetchAndSolvePow } from "./pow";
import type { SessionUser } from "./types";

type Status = "loading" | "signedIn" | "signedOut";

interface SessionValue {
  status: Status;
  user: SessionUser | null;
  /** Throws an Error whose message is ready to show. */
  login: (email: string, password: string, turnstileToken: string | null) => Promise<void>;
  /** Resolves false when the reader closed the browser without signing in; throws an Error whose message is ready to show. */
  loginWithProvider: (provider: OAuthProvider) => Promise<boolean>;
  /** Throws the ApiError as is: the sign-up form maps each code to its own step and message. */
  register: (form: { email: string; username: string; displayName: string; password: string }, turnstileToken: string | null) => Promise<void>;
  /** Asks for a reset link; resolves either way the account exists (the server never says). */
  forgotPassword: (email: string, turnstileToken: string | null) => Promise<void>;
  logout: () => Promise<void>;
  reload: () => Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);

/** The backend's messages are English; these are the ones a reader can actually hit on the sign-in form. */
function loginErrorMessage(err: unknown): string {
  if (!(err instanceof ApiError)) return "فشل تسجيل الدخول.";
  switch (err.code) {
    case "invalid_credentials":
      return "البريد الإلكتروني أو كلمة المرور غير صحيحة.";
    case "account_banned":
      return "تم حظر هذا الحساب. تواصل مع الإدارة عبر Discord إن كنت تراه خطأً.";
    case "turnstile_required":
      return "انتظر حتى يكتمل التحقق أعلاه ثم حاول مرة أخرى.";
    case "turnstile_failed":
      return "لم ينجح التحقق. حاول مرة أخرى.";
    case "no_password_set":
      return "هذا الحساب مسجل عبر Discord أو Google. سجّل الدخول من الموقع ثم أضف كلمة مرور من الإعدادات.";
    case "network":
      return err.message;
  }
  if (err.status === 429) return "محاولات كثيرة. انتظر قليلًا ثم حاول مرة أخرى.";
  return "فشل تسجيل الدخول.";
}

/**
 * Who is signed in. The session itself is the site's cookies (kept by the native cookie store); this only mirrors who they
 * belong to. `/api/auth/*` is the one corner of the site that does not refresh an expired access token on its own, so the
 * startup check first touches a route that does.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<Status>("loading");
  const [user, setUser] = useState<SessionUser | null>(null);

  const reload = useCallback(async () => {
    try {
      await apiFetch("/api/notifications/unread-count").catch(() => null);
      const me = await apiJson<SessionUser | null>("/api/auth/me");
      setUser(me);
      setStatus(me ? "signedIn" : "signedOut");
      void syncLibrary(me?.id ?? null);
    } catch {
      setUser(null);
      setStatus("signedOut");
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const login = useCallback(
    async (email: string, password: string, turnstileToken: string | null) => {
      try {
        const powSolution = await fetchAndSolvePow();
        await apiJson("/api/auth/login", {
          method: "POST",
          headers: { "x-pow-solution": powSolution, ...(turnstileToken ? { "x-turnstile-token": turnstileToken } : {}) },
          body: JSON.stringify({ email: email.trim(), password }),
        });
      } catch (err) {
        throw new Error(loginErrorMessage(err));
      }
      await reload();
      void queryClient.invalidateQueries();
    },
    [reload, queryClient],
  );

  const loginWithProvider = useCallback(
    async (provider: OAuthProvider) => {
      try {
        await signInWithProvider(provider);
      } catch (err) {
        if (err instanceof OAuthError && err.cancelled) return false;
        throw err instanceof OAuthError ? err : new Error("تعذر تسجيل الدخول، حاول مرة أخرى.");
      }
      await reload();
      void queryClient.invalidateQueries();
      return true;
    },
    [reload, queryClient],
  );

  const register = useCallback(
    async (form: { email: string; username: string; displayName: string; password: string }, turnstileToken: string | null) => {
      const powSolution = await fetchAndSolvePow();
      await apiJson("/api/auth/register", {
        method: "POST",
        headers: { "x-pow-solution": powSolution, ...(turnstileToken ? { "x-turnstile-token": turnstileToken } : {}) },
        body: JSON.stringify(form),
      });
      await reload();
      void queryClient.invalidateQueries();
    },
    [reload, queryClient],
  );

  const forgotPassword = useCallback(async (email: string, turnstileToken: string | null) => {
    const powSolution = await fetchAndSolvePow();
    await apiJson("/api/auth/forgot-password", {
      method: "POST",
      headers: { "x-pow-solution": powSolution, ...(turnstileToken ? { "x-turnstile-token": turnstileToken } : {}) },
      body: JSON.stringify({ email: email.trim() }),
    });
  }, []);

  const logout = useCallback(async () => {
    await apiFetch("/api/auth/logout", { method: "POST" }).catch(() => null);
    setUser(null);
    setStatus("signedOut");
    void syncLibrary(null);
    void queryClient.invalidateQueries();
  }, [queryClient]);

  const value = useMemo(
    () => ({ status, user, login, loginWithProvider, register, forgotPassword, logout, reload }),
    [status, user, login, loginWithProvider, register, forgotPassword, logout, reload],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession outside SessionProvider");
  return value;
}
