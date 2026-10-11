import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import { apiFetch, apiJson } from "./api";

/**
 * Favourites ("مفضلتي") and reading progress, the same two things the site keeps (store/reader-settings.ts):
 *  - `bookmarks`: series ids, in the order they were added;
 *  - `progress`: series id → the furthest chapter number opened. It only ever advances, so re-reading an earlier chapter does not
 *    move "تابع القراءة" backwards.
 * `readAt` adds when each work was last opened, so the app can list the most recent first.
 *
 * For a signed-in reader both live on the account (components/library-sync.tsx on the site, same endpoints and same rules):
 * a guest's library is merged up once on the first sign-in, after that the phone pulls and pushes each change.
 */
export interface LibraryState {
  bookmarks: string[];
  progress: Record<string, number>;
  readAt: Record<string, string>;
}

interface Stored extends LibraryState {
  /** Whose account the local copy mirrors (`lunex-library-owner` on the site). */
  owner: string | null;
}

const KEY = "lunex-library-v2";
const RETRY_DELAYS_MS = [2_000, 6_000, 15_000];

let state: Stored = { bookmarks: [], progress: {}, readAt: {}, owner: null };
let loaded: Promise<void> | null = null;
/** Set once the server copy has been fetched for the signed-in account; changes are pushed only then. */
let syncedFor: string | null = null;
const listeners = new Set<() => void>();

function load(): Promise<void> {
  loaded ??= AsyncStorage.getItem(KEY)
    .then((raw) => {
      if (raw) state = { ...state, ...JSON.parse(raw) };
    })
    .catch(() => {})
    .finally(() => listeners.forEach((l) => l()));
  return loaded;
}

function update(next: Partial<Stored>) {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
  AsyncStorage.setItem(KEY, JSON.stringify(state)).catch(() => {});
}

function push(method: "PUT" | "DELETE", path: string, body?: unknown, attempt = 0) {
  if (!syncedFor) return;
  apiFetch(path, { method, body: body ? JSON.stringify(body) : undefined })
    .then((res) => {
      if (!res.ok && res.status >= 500) throw new Error(String(res.status));
    })
    .catch(() => {
      const delay = RETRY_DELAYS_MS[attempt];
      if (delay !== undefined) setTimeout(() => push(method, path, body, attempt + 1), delay);
    });
}

/** The reader opened a chapter: remember it (forwards only) and when. */
export async function recordRead(seriesId: string, chapterNumber: number) {
  await load();
  const furthest = Math.max(state.progress[seriesId] ?? 0, chapterNumber);
  update({ progress: { ...state.progress, [seriesId]: furthest }, readAt: { ...state.readAt, [seriesId]: new Date().toISOString() } });
  if (furthest !== chapterNumber) return;
  push("PUT", `/api/profiles/me/progress/${encodeURIComponent(seriesId)}`, { chapterNumber: furthest });
}

export async function toggleBookmark(seriesId: string) {
  await load();
  const has = state.bookmarks.includes(seriesId);
  update({ bookmarks: has ? state.bookmarks.filter((id) => id !== seriesId) : [...state.bookmarks, seriesId] });
  push(has ? "DELETE" : "PUT", `/api/profiles/me/bookmarks/${encodeURIComponent(seriesId)}`);
}

/**
 * Brings the phone's copy in line with the account. A different account signing in never inherits the previous one's library;
 * signing out clears it (it lives on the server and comes back with the next sign-in).
 */
export async function syncLibrary(userId: string | null) {
  await load();
  if (!userId) {
    syncedFor = null;
    if (state.owner) update({ bookmarks: [], progress: {}, readAt: {}, owner: null });
    return;
  }
  if (state.owner && state.owner !== userId) update({ bookmarks: [], progress: {}, readAt: {}, owner: null });
  const local = { bookmarks: state.bookmarks, progress: state.progress };
  try {
    const library = await apiJson<{ bookmarks: string[]; progress: Record<string, number> }>(
      state.owner === userId ? "/api/profiles/me/library" : "/api/profiles/me/library/sync",
      state.owner === userId ? {} : { method: "POST", body: JSON.stringify(local) },
    );
    // Anything opened while the answer was on its way and further than the server knows is kept, and pushed after.
    const movedMeanwhile = Object.entries(state.progress).filter(
      ([id, chapter]) => chapter !== local.progress[id] && chapter > (library.progress[id] ?? Number.NEGATIVE_INFINITY),
    );
    update({ bookmarks: library.bookmarks, progress: { ...library.progress, ...Object.fromEntries(movedMeanwhile) }, owner: userId });
    syncedFor = userId;
    for (const [id, chapterNumber] of movedMeanwhile) push("PUT", `/api/profiles/me/progress/${encodeURIComponent(id)}`, { chapterNumber });
  } catch {
    // Unreachable: keep the local copy, and push nothing until we know what the server has.
  }
}

export function useLibrary(): LibraryState {
  const [snapshot, setSnapshot] = useState<LibraryState>(state);
  useEffect(() => {
    const listener = () => setSnapshot(state);
    listeners.add(listener);
    void load();
    listener();
    return () => {
      listeners.delete(listener);
    };
  }, []);
  return snapshot;
}
