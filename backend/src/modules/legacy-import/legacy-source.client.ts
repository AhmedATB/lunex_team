import { Injectable } from "@nestjs/common";

const BASE_URL = "https://lunexteam.com/api";

/** A normal browser UA, not our own bot-integration identity — this is an outbound call to someone else's public API/CDN, not our own machine-to-machine link. */
const OUTBOUND_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

export interface LegacyGroup {
  id: string;
  attributes: {
    name: string;
    description?: string | null;
    official?: boolean;
    verified?: boolean;
    inactive?: boolean;
  };
}

export interface LegacyMangaRelationship {
  id: string;
  type: string;
  attributes?: { fileName?: string } | null;
}

export interface LegacyManga {
  id: string;
  attributes: {
    title: Record<string, string>;
    altTitles?: Array<Record<string, string>>;
    description?: Record<string, string>;
    status?: string;
    originalLanguage?: string;
    contentRating?: string;
    publicationDemographic?: string | null;
    year?: number | null;
    state?: string;
    tags?: unknown;
  };
  relationships?: LegacyMangaRelationship[];
}

export interface LegacyChapter {
  id: string;
  attributes: {
    chapter: string;
    title?: string | null;
    translatedLanguage?: string;
    pages?: number;
  };
  relationships?: LegacyMangaRelationship[];
}

export interface LegacyReadInfo {
  baseUrl: string;
  chapter: { hash: string; data: string[] };
}

interface LegacyListResponse<T> {
  data: T[];
  total?: number;
}

/**
 * Thin, read-only fetch client for lunexteam.com's public v2 API (the old
 * site — see legacy-import.service.ts for why this exists). Callers handle
 * pagination and per-item error isolation themselves; this just throws on a
 * non-2xx response.
 */
@Injectable()
export class LegacySourceClient {
  private async getJson<T>(path: string): Promise<T> {
    const res = await fetch(`${BASE_URL}${path}`, {
      headers: { "User-Agent": OUTBOUND_USER_AGENT, Accept: "application/json" },
    });
    if (!res.ok) {
      throw new Error(`legacy source ${path} responded ${res.status}`);
    }
    return (await res.json()) as T;
  }

  listGroups(limit: number, offset: number) {
    return this.getJson<LegacyListResponse<LegacyGroup>>(`/v2/groups?limit=${limit}&offset=${offset}`);
  }

  listManga(limit: number, offset: number) {
    const include = encodeURIComponent(JSON.stringify({ cover_art: true }));
    return this.getJson<LegacyListResponse<LegacyManga>>(`/v2/manga?limit=${limit}&offset=${offset}&include=${include}`);
  }

  getMangaFeed(mangaId: string, limit: number, offset: number) {
    return this.getJson<LegacyListResponse<LegacyChapter>>(`/v2/manga/${mangaId}/feed?limit=${limit}&offset=${offset}`);
  }

  getChapterReadInfo(chapterId: string) {
    return this.getJson<LegacyReadInfo>(`/v2/read/${chapterId}`);
  }

  /** Pure string builder, no request — the cover CDN pattern confirmed by inspecting the old site's own rendered <img> tags. */
  getCoverUrl(mangaId: string, fileName: string): string {
    return `https://cdn.lunexteam.com/manga/${mangaId}/cover/${fileName}`;
  }

  async downloadBytes(url: string): Promise<Buffer> {
    const res = await fetch(url, { headers: { "User-Agent": OUTBOUND_USER_AGENT } });
    if (!res.ok) {
      throw new Error(`legacy source download ${url} responded ${res.status}`);
    }
    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
}
