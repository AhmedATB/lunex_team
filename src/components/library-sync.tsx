"use client";

import { useEffect } from "react";
import { useBookmarks, useReadingProgress } from "@/store/reader-settings";

/**
 * Keeps a signed-in account's favorites and reading history on the server, so
 * other people can see them if the owner allows it (see the profile privacy
 * settings) and so they follow the account across devices. Signed-out readers
 * keep the same device-local behaviour as before.
 *
 * The local stores are per-BROWSER, not per-account, which drives the rules:
 *  - `lunex-library-owner` records whose library the local stores currently
 *    mirror. A different account signing in on the same browser never inherits
 *    (or uploads) the previous one's favorites: they are cleared first.
 *  - Signing out clears the mirror — it lives on the server and comes back on
 *    the next sign-in.
 *  - Data that predates the account (a guest's favorites) is merged UP once, as
 *    a union / furthest-chapter, on the first sign-in. After that the browser
 *    only pulls, so a favorite removed on another device is not resurrected.
 */
const OWNER_KEY = "lunex-library-owner";
const RETRY_DELAYS_MS = [2_000, 6_000, 15_000];

interface Library {
  bookmarks: string[];
  progress: Record<string, number>;
}

interface Hydratable {
  persist: { hasHydrated: () => boolean; onFinishHydration: (fn: () => void) => () => void };
}

function whenHydrated(store: Hydratable): Promise<void> {
  return new Promise((resolve) => {
    if (store.persist.hasHydrated()) return resolve();
    const stop = store.persist.onFinishHydration(() => {
      stop();
      resolve();
    });
  });
}

function readOwner(): string | null {
  try {
    return window.localStorage.getItem(OWNER_KEY);
  } catch {
    return null;
  }
}

function writeOwner(userId: string | null) {
  try {
    if (userId) window.localStorage.setItem(OWNER_KEY, userId);
    else window.localStorage.removeItem(OWNER_KEY);
  } catch {
    // Storage blocked — the library then simply behaves as device-local.
  }
}

/** True while WE are writing server data into the stores, so the change subscribers don't echo it straight back. */
let applyingRemote = false;

function applyLibrary(library: Library) {
  applyingRemote = true;
  try {
    useBookmarks.setState({ bookmarks: library.bookmarks });
    useReadingProgress.setState({ progress: library.progress });
  } finally {
    applyingRemote = false;
  }
}

function clearLocalLibrary() {
  applyLibrary({ bookmarks: [], progress: {} });
}

async function requestLibrary(method: "GET" | "POST", url: string, body?: Library): Promise<Library> {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`library request failed: ${res.status}`);
  return res.json();
}

/** Fire-and-forget write with a few retries; a permanent client error (bad id) is dropped rather than retried. */
function push(method: "PUT" | "DELETE", url: string, body?: unknown, attempt = 0) {
  fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    keepalive: true,
  })
    .then((res) => {
      if (res.ok || (res.status >= 400 && res.status < 500 && res.status !== 401 && res.status !== 429)) return;
      throw new Error(String(res.status));
    })
    .catch(() => {
      const delay = RETRY_DELAYS_MS[attempt];
      if (delay !== undefined) setTimeout(() => push(method, url, body, attempt + 1), delay);
    });
}

function startPushingChanges(): () => void {
  const stopBookmarks = useBookmarks.subscribe((state, prev) => {
    if (applyingRemote) return;
    const before = new Set(prev.bookmarks);
    const after = new Set(state.bookmarks);
    for (const id of after) if (!before.has(id)) push("PUT", `/api/profiles/me/bookmarks/${encodeURIComponent(id)}`);
    for (const id of before) if (!after.has(id)) push("DELETE", `/api/profiles/me/bookmarks/${encodeURIComponent(id)}`);
  });

  const stopProgress = useReadingProgress.subscribe((state, prev) => {
    if (applyingRemote) return;
    for (const [id, chapterNumber] of Object.entries(state.progress)) {
      if (prev.progress[id] !== chapterNumber) {
        push("PUT", `/api/profiles/me/progress/${encodeURIComponent(id)}`, { chapterNumber });
      }
    }
  });

  return () => {
    stopBookmarks();
    stopProgress();
  };
}

/** `userId` is the SERVER-verified session from the root layout — the client store only learns it a tick later, and a null there must not be mistaken for "signed out". */
export function LibrarySync({ userId }: { userId: string | null }) {
  useEffect(() => {
    let cancelled = false;
    let stopPushing = () => {};

    (async () => {
      await Promise.all([whenHydrated(useBookmarks), whenHydrated(useReadingProgress)]);
      if (cancelled) return;

      const owner = readOwner();

      if (!userId) {
        if (owner) {
          clearLocalLibrary();
          writeOwner(null);
        }
        return;
      }

      if (owner && owner !== userId) clearLocalLibrary();

      try {
        const local: Library = {
          bookmarks: useBookmarks.getState().bookmarks,
          progress: useReadingProgress.getState().progress,
        };
        const library =
          owner === userId
            ? await requestLibrary("GET", "/api/profiles/me/library")
            : await requestLibrary("POST", "/api/profiles/me/library/sync", local);
        if (cancelled) return;
        applyLibrary(library);
        writeOwner(userId);
      } catch {
        // Backend unreachable: keep the local copy and try again on the next load. Not pushing until then, since we
        // don't know what the server has.
        return;
      }

      stopPushing = startPushingChanges();
    })();

    return () => {
      cancelled = true;
      stopPushing();
    };
  }, [userId]);

  return null;
}
