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
  /** `teamId` is left out for a work that belongs to no team. */
  create: (input: { seriesId: string; teamId?: string; number: number; title: string }) => call<CreatedChapter>("/api/chapters", "POST", input),

  uploadPage: (chapterId: string, pageNumber: number, file: File) => {
    const form = new FormData();
    form.append("file", file);
    form.append("pageNumber", String(pageNumber));
    // A long picture is cut into several pages on the server: `pages` says how many this one became.
    return callForm<{ pages: number }>(`/api/chapters/${encodeURIComponent(chapterId)}/pages`, form);
  },

  setPublished: (chapterId: string, isPublished: boolean) => call<unknown>(`/api/chapters/${encodeURIComponent(chapterId)}`, "PATCH", { isPublished }),

  remove: (chapterId: string) => call<void>(`/api/chapters/${encodeURIComponent(chapterId)}`, "DELETE"),

  driveInfo: () => call<DriveInfo>("/api/chapters/import/drive/info", "GET"),

  importDrive: (chapterId: string, link: string) => call<{ total: number }>(`/api/chapters/${encodeURIComponent(chapterId)}/import/drive`, "POST", { link }),

  importStatus: (chapterId: string) => call<ImportStatus | null>(`/api/chapters/${encodeURIComponent(chapterId)}/import/status`, "GET"),
};
