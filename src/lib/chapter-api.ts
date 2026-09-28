import { call, callForm } from "@/lib/api-call";

export interface CreatedChapter {
  id: string;
}

/** One of the four pictures offered for a chapter's featured picture: which page it comes from, and a small copy of it (a data address). */
export interface ThumbnailSuggestion {
  pageNumber: number;
  preview: string;
}

export interface ThumbnailSuggestions {
  items: ThumbnailSuggestion[];
  /** How many rounds there are before they start over. */
  rounds: number;
  pages: number;
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

  /** Four suggestions for the featured picture, from the chapter's own pages; `round` 1, 2 … gives others. */
  thumbnailSuggestions: (chapterId: string, round: number) => call<ThumbnailSuggestions>(`/api/chapters/${encodeURIComponent(chapterId)}/thumbnail-suggestions?round=${round}`, "GET"),

  /** The featured picture from one of the chapter's own pages. */
  thumbnailFromPage: (chapterId: string, pageNumber: number) => call<{ thumbnailAssetId: string }>(`/api/chapters/${encodeURIComponent(chapterId)}/thumbnail/page`, "PUT", { pageNumber }),

  /** The featured picture from a picture on the device. */
  thumbnailUpload: (chapterId: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return callForm<{ thumbnailAssetId: string }>(`/api/chapters/${encodeURIComponent(chapterId)}/thumbnail`, form, "PUT");
  },

  thumbnailRemove: (chapterId: string) => call<void>(`/api/chapters/${encodeURIComponent(chapterId)}/thumbnail`, "DELETE"),

  setPublished: (chapterId: string, isPublished: boolean) => call<unknown>(`/api/chapters/${encodeURIComponent(chapterId)}`, "PATCH", { isPublished }),

  remove: (chapterId: string) => call<void>(`/api/chapters/${encodeURIComponent(chapterId)}`, "DELETE"),

  driveInfo: () => call<DriveInfo>("/api/chapters/import/drive/info", "GET"),

  /** `link` is a Drive folder of pictures or a ZIP file of them; `total` is 0 for a ZIP (counted once it is fetched). */
  importDrive: (chapterId: string, link: string) => call<{ total: number; kind: "folder" | "zip" }>(`/api/chapters/${encodeURIComponent(chapterId)}/import/drive`, "POST", { link }),

  importStatus: (chapterId: string) => call<ImportStatus | null>(`/api/chapters/${encodeURIComponent(chapterId)}/import/status`, "GET"),
};
