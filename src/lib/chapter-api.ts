import { call, callForm } from "@/lib/api-call";

export interface CreatedChapter {
  id: string;
}

export interface DriveInfo {
  configured: boolean;
  /** The address a private Drive folder has to be shared with. */
  serviceEmail: string | null;
}

export interface ImportStatus {
  state: "running" | "done" | "failed";
  total: number;
  done: number;
  error: string | null;
}

/** Real chapters (pictures) from the browser: create one, give it pages from the device, a ZIP or Google Drive, publish it. */
export const chapterApi = {
  create: (input: { seriesId: string; teamId: string; number: number; title: string }) => call<CreatedChapter>("/api/chapters", "POST", input),

  uploadPage: (chapterId: string, pageNumber: number, file: File) => {
    const form = new FormData();
    form.append("file", file);
    form.append("pageNumber", String(pageNumber));
    return callForm<unknown>(`/api/chapters/${encodeURIComponent(chapterId)}/pages`, form);
  },

  setPublished: (chapterId: string, isPublished: boolean) => call<unknown>(`/api/chapters/${encodeURIComponent(chapterId)}`, "PATCH", { isPublished }),

  remove: (chapterId: string) => call<void>(`/api/chapters/${encodeURIComponent(chapterId)}`, "DELETE"),

  driveInfo: () => call<DriveInfo>("/api/chapters/import/drive/info", "GET"),

  importDrive: (chapterId: string, link: string) => call<{ total: number }>(`/api/chapters/${encodeURIComponent(chapterId)}/import/drive`, "POST", { link }),

  importStatus: (chapterId: string) => call<ImportStatus | null>(`/api/chapters/${encodeURIComponent(chapterId)}/import/status`, "GET"),
};

/**
 * Runs `work` over the items a few at a time, in order of start, and stops handing out new ones after the first failure.
 * Returns the index of the item that failed (and its message), or null when all went through.
 */
export async function inPool<T>(
  items: readonly T[],
  size: number,
  work: (item: T, index: number) => Promise<string | null>,
  onProgress?: (finished: number) => void
): Promise<{ index: number; message: string } | null> {
  let next = 0;
  let finished = 0;
  let failure: { index: number; message: string } | null = null;

  async function worker() {
    while (failure === null) {
      const index = next++;
      if (index >= items.length) return;
      const message = await work(items[index], index);
      if (message !== null) {
        failure ??= { index, message };
        return;
      }
      onProgress?.(++finished);
    }
  }

  await Promise.all(Array.from({ length: Math.min(size, items.length) }, worker));
  return failure;
}
