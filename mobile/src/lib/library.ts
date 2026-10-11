import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";

/** The last chapter opened in one work — what "تابع القراءة" resumes. */
export interface HistoryEntry {
  seriesId: string;
  slug: string;
  title: string;
  cover: string;
  chapterId: string;
  chapterNumber: number;
  readAt: string;
}

interface LibraryState {
  history: HistoryEntry[];
  bookmarks: string[];
}

/**
 * Reading history and saved works, kept on the phone — the site keeps both in the browser too (reader-settings store), so
 * there is nothing on the server to sync with yet.
 */
const KEY = "lunex-library-v1";
const HISTORY_LIMIT = 60;

let state: LibraryState = { history: [], bookmarks: [] };
let loaded: Promise<void> | null = null;
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

function update(next: LibraryState) {
  state = next;
  listeners.forEach((l) => l());
  AsyncStorage.setItem(KEY, JSON.stringify(state)).catch(() => {});
}

export async function recordRead(entry: Omit<HistoryEntry, "readAt">) {
  await load();
  const history = [{ ...entry, readAt: new Date().toISOString() }, ...state.history.filter((h) => h.seriesId !== entry.seriesId)];
  update({ ...state, history: history.slice(0, HISTORY_LIMIT) });
}

export async function toggleBookmark(seriesId: string) {
  await load();
  const has = state.bookmarks.includes(seriesId);
  update({ ...state, bookmarks: has ? state.bookmarks.filter((id) => id !== seriesId) : [seriesId, ...state.bookmarks] });
}

export function useLibrary(): LibraryState {
  const [snapshot, setSnapshot] = useState(state);
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
