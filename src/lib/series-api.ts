import { call, callForm } from "@/lib/api-call";

/** Everything a series can be created or changed with; only what is given is sent. Mirrors the backend's Create/UpdateSeriesDto. */
export interface SeriesInput {
  titleAr?: string;
  titleEn?: string;
  alternativeTitles?: string[];
  synopsis?: string;
  type?: string;
  status?: string;
  country?: string;
  author?: string;
  artist?: string;
  year?: number;
  contentRating?: string;
  /** Global editors only. An empty string takes the series off every team. */
  teamId?: string;
  isFeatured?: boolean;
  isRecommended?: boolean;
  state?: "draft" | "approved";
  tagSlugs?: string[];
}

export interface SeriesSummary {
  id: string;
  slug: string;
}

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

/** Why a picked file cannot be used as a cover or banner, before it is sent (the server checks again). */
export function imageProblem(file: File): string | null {
  if (!IMAGE_TYPES.includes(file.type)) return "الصورة يجب أن تكون JPEG أو PNG أو WebP أو GIF.";
  if (file.size > MAX_IMAGE_BYTES) return "حجم الصورة أكبر من 8 ميغابايت.";
  return null;
}

const enc = encodeURIComponent;

export const seriesApi = {
  create: (input: SeriesInput) => call<SeriesSummary>("/api/catalog/series", "POST", input),

  update: (id: string, patch: SeriesInput) => call<SeriesSummary>(`/api/catalog/series/${enc(id)}`, "PATCH", patch),

  remove: (id: string) => call<void>(`/api/catalog/series/${enc(id)}`, "DELETE"),

  /** A cover or banner from the device: the server resizes it, turns it into WebP and stores it. */
  uploadImage: (id: string, kind: "cover" | "banner", file: File) => {
    const form = new FormData();
    form.append("file", file);
    return callForm<SeriesSummary>(`/api/catalog/series/${enc(id)}/${kind}`, form);
  },

  /** Exactly these works, in this order, are pinned to the top of the home page (the first is the big lead). */
  setFeatured: (seriesIds: string[]) => call<{ seriesIds: string[] }>("/api/catalog/featured", "PUT", { seriesIds }),
};
