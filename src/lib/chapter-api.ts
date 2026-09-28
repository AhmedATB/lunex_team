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
  /** `downloading`: a ZIP is still being fetched from Drive and its pictures are not counted yet. */
  phase: "downloading" | "importing";
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

  /** A picture from the device in place of one page of the chapter (the same page number; a long strip is not cut). */
  replacePage: (chapterId: string, pageNumber: number, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return callForm<{ pageNumber: number }>(`/api/chapters/${encodeURIComponent(chapterId)}/pages/${pageNumber}`, form, "PUT");
  },

  setPublished: (chapterId: string, isPublished: boolean) => call<unknown>(`/api/chapters/${encodeURIComponent(chapterId)}`, "PATCH", { isPublished }),

  remove: (chapterId: string) => call<void>(`/api/chapters/${encodeURIComponent(chapterId)}`, "DELETE"),

  driveInfo: () => call<DriveInfo>("/api/chapters/import/drive/info", "GET"),

  /** `link` is a Drive folder of pictures or a ZIP file of them; `total` is 0 for a ZIP (counted once it is fetched). */
  importDrive: (chapterId: string, link: string) => call<{ total: number; kind: "folder" | "zip" }>(`/api/chapters/${encodeURIComponent(chapterId)}/import/drive`, "POST", { link }),

  importStatus: (chapterId: string) => call<ImportStatus | null>(`/api/chapters/${encodeURIComponent(chapterId)}/import/status`, "GET"),
};
