import { call, callForm } from "@/lib/api-call";

export type NewsCategory = "announcement" | "event" | "news";

export const NEWS_CATEGORY_LABELS: Record<NewsCategory, string> = {
  announcement: "إعلان",
  event: "فعالية",
  news: "خبر",
};

export interface NewsInput {
  title?: string;
  excerpt?: string;
  content?: string;
  category?: NewsCategory;
  isPublished?: boolean;
}

/** A post as the editors see it (drafts too). */
export interface EditorNews {
  id: string;
  title: string;
  excerpt: string;
  content: string;
  cover: string;
  category: NewsCategory;
  isPublished: boolean;
  createdAt: string;
}

const enc = encodeURIComponent;

export const newsApi = {
  list: () => call<{ items: EditorNews[] }>("/api/catalog/admin/news", "GET"),
  create: (input: NewsInput) => call<EditorNews>("/api/catalog/news", "POST", input),
  update: (id: string, patch: NewsInput) => call<EditorNews>(`/api/catalog/news/${enc(id)}`, "PATCH", patch),
  remove: (id: string) => call<void>(`/api/catalog/news/${enc(id)}`, "DELETE"),
  uploadCover: (id: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return callForm<EditorNews>(`/api/catalog/news/${enc(id)}/cover`, form);
  },
};
