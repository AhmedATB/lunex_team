import { slugify } from "../catalog.util";

/**
 * Pure translation from the old lunexteam.com API's shapes (a MangaDex-style
 * v2 API) to this platform's. Nothing here touches the network or the
 * database, so it is fully unit-tested against real captured records.
 */

export interface LegacyTag {
  id: string;
  attributes: { name: Record<string, string>; group: string };
}

export interface LegacyManga {
  id: string;
  attributes: {
    title?: Record<string, string> | null;
    altTitles?: Record<string, string>[] | null;
    description?: Record<string, string>[] | null;
    status?: string | null;
    state?: string | null;
    year?: number | null;
    originalLanguage?: string | null;
    contentRating?: string | null;
    createdAt?: string;
    tags?: LegacyTag[];
  };
}

export interface LegacyGroup {
  id: string;
  attributes: {
    name: string;
    description?: string | null;
    website?: string | null;
    discord?: string | null;
    inactive?: boolean;
    createdAt?: string;
  };
}

/** Arabic names for the old site's 77 tags. Anything not listed keeps its English name until an editor renames it. */
export const TAG_AR: Record<string, string> = {
  "4-Koma": "أربع لوحات",
  Adaptation: "مقتبس",
  Anthology: "مختارات",
  "Award Winning": "حائز على جوائز",
  Doujinshi: "دوجينشي",
  "Fan Colored": "ملوّن من المعجبين",
  "Full Color": "ملوّن بالكامل",
  "Long Strip": "شريط طويل",
  "Official Colored": "ملوّن رسميًا",
  Oneshot: "فصل واحد",
  "Self-Published": "نشر ذاتي",
  "Web Comic": "ويب كوميك",
  Action: "أكشن",
  Adventure: "مغامرة",
  "Boys' Love": "حب الفتيان",
  Comedy: "كوميدي",
  Crime: "جريمة",
  Drama: "دراما",
  Fantasy: "خيال",
  "Girls' Love": "حب الفتيات",
  Historical: "تاريخي",
  Horror: "رعب",
  Isekai: "عالم آخر",
  "Magical Girls": "الفتيات السحريات",
  Mecha: "ميكا",
  Medical: "طبي",
  Mystery: "غموض",
  Philosophical: "فلسفي",
  Psychological: "نفسي",
  Romance: "رومانسي",
  "Sci-Fi": "خيال علمي",
  "Slice of Life": "شريحة حياة",
  Sports: "رياضة",
  Superhero: "أبطال خارقون",
  Thriller: "إثارة",
  Tragedy: "مأساة",
  Wuxia: "ووشيا",
  Aliens: "كائنات فضائية",
  Animals: "حيوانات",
  Cooking: "طبخ",
  Crossdressing: "تنكّر بزي الجنس الآخر",
  Delinquents: "مشاغبون",
  Demons: "شياطين",
  Genderswap: "تبديل الجنس",
  Ghosts: "أشباح",
  Gyaru: "غيارو",
  Harem: "حريم",
  Incest: "محارم",
  Loli: "لولي",
  Mafia: "مافيا",
  Magic: "سحر",
  Mahjong: "ماجونغ",
  "Martial Arts": "فنون قتالية",
  Military: "عسكري",
  "Monster Girls": "فتيات وحوش",
  Monsters: "وحوش",
  Music: "موسيقى",
  Ninja: "نينجا",
  "Office Workers": "موظفو مكاتب",
  Police: "شرطة",
  "Post-Apocalyptic": "ما بعد الكارثة",
  Reincarnation: "تناسخ",
  "Reverse Harem": "حريم معكوس",
  Samurai: "ساموراي",
  "School Life": "حياة مدرسية",
  Shota: "شوتا",
  Supernatural: "خارق للطبيعة",
  Survival: "بقاء",
  "Time Travel": "السفر عبر الزمن",
  "Traditional Games": "ألعاب تقليدية",
  Vampires: "مصاصو دماء",
  "Video Games": "ألعاب فيديو",
  Villainess: "الشريرة",
  "Virtual Reality": "واقع افتراضي",
  Zombies: "زومبي",
  Gore: "دموي",
  "Sexual Violence": "عنف جنسي",
};

/**
 * Old-site tags this platform does not carry (owner's decision, 2026-09-30): the import skips them, and the migration
 * `remove_hidden_tags` deleted the ones already imported. A series that arrives tagged with one simply loses that tag.
 */
export const HIDDEN_TAGS = new Set(["Boys' Love", "Girls' Love", "Loli"]);

/** Genres this platform already used before the import that the old site does not have. */
export const EXTRA_TAGS: { nameEn: string; nameAr: string; group: string }[] = [
  { nameEn: "Regression", nameAr: "رجوع بالزمن", group: "theme" },
  { nameEn: "Murim", nameAr: "موريم", group: "theme" },
  { nameEn: "System", nameAr: "نظام", group: "theme" },
  { nameEn: "Revenge", nameAr: "انتقام", group: "theme" },
];

const ARABIC = /[؀-ۿ]/;
const KNOWN_GROUPS = new Set(["genre", "theme", "format", "content"]);

export function mapTag(tag: LegacyTag) {
  const nameEn = (tag.attributes.name.en ?? Object.values(tag.attributes.name)[0] ?? "").trim();
  return {
    legacyId: tag.id,
    slug: slugify(nameEn, "tag"),
    nameEn,
    nameAr: TAG_AR[nameEn] ?? nameEn,
    group: KNOWN_GROUPS.has(tag.attributes.group) ? tag.attributes.group : "genre",
  };
}

export function mapGroup(group: LegacyGroup) {
  const name = group.attributes.name.trim();
  return {
    legacyId: group.id,
    name,
    slug: slugify(name, "team"),
    description: (group.attributes.description ?? "").replace(/[*_#>`]/g, "").trim(),
    discordUrl: safeUrl(group.attributes.discord),
    websiteUrl: safeUrl(group.attributes.website),
    status: group.attributes.inactive ? "archived" : "active",
    createdAt: group.attributes.createdAt ? new Date(group.attributes.createdAt) : undefined,
  };
}

/** Old free-text link fields are often empty or a bare handle; keep only real http(s) URLs. */
export function safeUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

const STATUS_MAP: Record<string, string> = { ongoing: "ongoing", completed: "completed", hiatus: "hiatus", cancelled: "dropped", dropped: "dropped" };
const LANGUAGE_MAP: Record<string, { country: string; type: string }> = {
  ko: { country: "kr", type: "manhwa" },
  ja: { country: "jp", type: "manga" },
  zh: { country: "cn", type: "manhua" },
  "zh-hk": { country: "cn", type: "manhua" },
};

function firstText(values: Record<string, string>[] | null | undefined, preferred = "ar"): string {
  if (!values) return "";
  for (const entry of values) if (entry[preferred]) return entry[preferred].trim();
  for (const entry of values) {
    const text = Object.values(entry)[0];
    if (text) return text.trim();
  }
  return "";
}

export function mapManga(manga: LegacyManga) {
  const a = manga.attributes;
  const titles = [a.title?.ar, a.title?.en, ...Object.values(a.title ?? {})].filter((t): t is string => Boolean(t?.trim())).map((t) => t.trim());
  const alternatives = (a.altTitles ?? []).flatMap((entry) => Object.values(entry)).map((t) => t.trim()).filter(Boolean);
  const titleEn = (a.title?.en ?? titles[0] ?? alternatives[0] ?? "").trim();
  const arabicTitle = [...titles, ...alternatives].find((t) => ARABIC.test(t));
  const titleAr = arabicTitle ?? titleEn ?? "بدون عنوان";
  const lang = LANGUAGE_MAP[(a.originalLanguage ?? "").toLowerCase()] ?? { country: "kr", type: "manhwa" };

  return {
    legacyId: manga.id,
    titleEn,
    titleAr: titleAr || "بدون عنوان",
    alternativeTitles: [...new Set(alternatives.filter((t) => t !== titleEn && t !== titleAr))].slice(0, 20),
    synopsis: firstText(a.description).slice(0, 5000),
    status: STATUS_MAP[(a.status ?? "").toLowerCase()] ?? "ongoing",
    year: a.year ?? null,
    contentRating: a.contentRating ?? "safe",
    country: lang.country,
    type: lang.type,
    approved: (a.state ?? "approved") === "approved",
    createdAt: a.createdAt ? new Date(a.createdAt) : undefined,
    tagLegacyIds: (a.tags ?? []).map((t) => t.id),
  };
}

const COVER_PATTERN = /https:\/\/cdn\.lunexteam\.com\/manga\/[0-9a-f-]{36}\/cover\/[0-9a-f-]{36}\.(?:webp|jpg|jpeg|png)/i;

/** The old title page embeds the cover's CDN address; the API only exposes an opaque cover id. */
export function findCoverUrl(html: string): string | null {
  return COVER_PATTERN.exec(html)?.[0] ?? null;
}
