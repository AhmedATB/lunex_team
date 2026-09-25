import { COVER_PLACEHOLDER, EMPTY_STATS, imageUrl, slugify, toChapterDto, toSeriesDto, toTeamDto, uniqueSlug, type SeriesRow } from "./catalog.util";

describe("slugify", () => {
  it("keeps Arabic letters and turns everything else into single hyphens", () => {
    expect(slugify("ملك المصارع الأسطوري!")).toBe("ملك-المصارع-الأسطوري");
    expect(slugify("  The  Wind Mage :: Vol. 2 ")).toBe("the-wind-mage-vol-2");
  });

  it("falls back when nothing usable is left, and never returns an empty or hyphen-edged slug", () => {
    expect(slugify("!!!", "series")).toBe("series");
    expect(slugify("---a---")).toBe("a");
  });

  it("caps the length without leaving a trailing hyphen", () => {
    const slug = slugify("word ".repeat(40));
    expect(slug.length).toBeLessThanOrEqual(80);
    expect(slug.endsWith("-")).toBe(false);
  });
});

describe("uniqueSlug", () => {
  it("appends a counter until the slug is free", async () => {
    const taken = new Set(["a", "a-2", "a-3"]);
    expect(await uniqueSlug("a", async (s) => taken.has(s))).toBe("a-4");
    expect(await uniqueSlug("b", async (s) => taken.has(s))).toBe("b");
  });
});

describe("imageUrl", () => {
  const at = new Date("2026-01-02T03:04:05.000Z");
  it("is null without an asset and versioned with one", () => {
    expect(imageUrl("series", "s1", null, at)).toBeNull();
    expect(imageUrl("series", "s1", "asset", at)).toBe(`/api/catalog/series/s1/cover?v=${at.getTime()}`);
    expect(imageUrl("team", "t1", "asset", at)).toBe(`/api/catalog/teams/t1/logo?v=${at.getTime()}`);
  });
});

const tag = (slug: string, group: string, nameAr = slug) => ({ tag: { id: slug, slug, nameEn: slug, nameAr, group } });

const seriesRow = (overrides: Partial<SeriesRow> = {}): SeriesRow => ({
  id: "s1",
  slug: "the-wind-mage",
  titleAr: "ساحر الرياح",
  titleEn: "The Wind Mage",
  alternativeTitles: ["Wind"],
  synopsis: "x",
  type: "manhwa",
  status: "ongoing",
  country: "kr",
  author: "",
  artist: "",
  year: null,
  contentRating: "safe",
  coverAssetId: null,
  bannerAssetId: null,
  teamId: null,
  isFeatured: false,
  isRecommended: false,
  viewCount: 7,
  createdAt: new Date("2026-03-01T00:00:00Z"),
  updatedAt: new Date("2026-03-02T00:00:00Z"),
  tags: [tag("action", "genre"), tag("survival", "theme", "بقاء")],
  ...overrides,
});

describe("toSeriesDto", () => {
  it("speaks the frontend's Series shape", () => {
    const dto = toSeriesDto(seriesRow(), { ...EMPTY_STATS, chapterCount: 12, latestChapterNumber: 12, bookmarks: 5 });
    expect(dto).toMatchObject({
      id: "s1",
      title: "The Wind Mage",
      titleAr: "ساحر الرياح",
      views: 7,
      bookmarks: 5,
      likes: 5,
      chapterCount: 12,
      latestChapterNumber: 12,
      teamId: "",
      year: 2026,
    });
  });

  it("treats genres and themes as the UI's genres, and format/content as free-form tags", () => {
    const dto = toSeriesDto(seriesRow({ tags: [tag("action", "genre"), tag("survival", "theme", "بقاء"), tag("full-color", "format", "ملوّن بالكامل"), tag("gore", "content", "دموي")] }));
    expect(dto.genreIds).toEqual(["action", "survival"]);
    expect(dto.tags).toEqual(["ملوّن بالكامل", "دموي"]);
  });

  it("uses a placeholder when there is no cover, and the cover for the banner when there is no banner", () => {
    expect(toSeriesDto(seriesRow()).cover).toBe(COVER_PLACEHOLDER);
    const withCover = toSeriesDto(seriesRow({ coverAssetId: "a1" }));
    expect(withCover.cover).toContain("/api/catalog/series/s1/cover?v=");
    expect(withCover.banner).toBe(withCover.cover);
  });

  it("reports the newest activity as updatedAt", () => {
    const later = new Date("2026-04-01T00:00:00Z");
    expect(toSeriesDto(seriesRow(), { ...EMPTY_STATS, latestChapterAt: later }).updatedAt).toBe(later.toISOString());
    const earlier = new Date("2026-01-01T00:00:00Z");
    expect(toSeriesDto(seriesRow(), { ...EMPTY_STATS, latestChapterAt: earlier }).updatedAt).toBe("2026-03-02T00:00:00.000Z");
  });

  it("falls back to the title in the other language", () => {
    expect(toSeriesDto(seriesRow({ titleEn: "" })).title).toBe("ساحر الرياح");
  });
});

describe("toTeamDto", () => {
  const team = {
    id: "t1",
    slug: "nova",
    name: "Nova",
    description: "",
    goals: "",
    color: "#6D28D9",
    logoHue: 270,
    logoAssetId: null,
    discordUrl: null,
    websiteUrl: null,
    category: "mixed",
    status: "active",
    recruiting: false,
    leaderId: null as string | null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-02-01T00:00:00Z"),
    members: [{ userId: "u1" }],
  };

  it("has an empty leader id when the group has no leader yet, and no logo url", () => {
    const dto = toTeamDto(team, 3, null);
    expect(dto.leaderId).toBe("");
    expect(dto.logoUrl).toBeUndefined();
    expect(dto.rank).toBe(3);
    expect(dto.memberIds).toEqual(["u1"]);
  });

  it("counts the leader as a member exactly once", () => {
    expect(toTeamDto({ ...team, leaderId: "u1" }, 1, null).memberIds).toEqual(["u1"]);
    expect(toTeamDto({ ...team, leaderId: "u2" }, 1, null).memberIds.sort()).toEqual(["u1", "u2"]);
  });
});

describe("toChapterDto", () => {
  it("uses the publish date when there is one, the creation date otherwise, and reports pages and novel text", () => {
    const base = {
      id: "c1",
      seriesId: "s1",
      teamId: "t1",
      number: 3,
      title: "Three",
      isPublished: true,
      scheduledFor: null,
      manualLock: null,
      viewCount: 4,
      content: null,
      createdAt: new Date("2026-01-01T00:00:00Z"),
      publishedAt: null as Date | null,
      _count: { pages: 18 },
    };
    expect(toChapterDto(base)).toMatchObject({ releasedAt: "2026-01-01T00:00:00.000Z", pages: 18, hasContent: false, views: 4 });
    expect(toChapterDto({ ...base, publishedAt: new Date("2026-02-01T00:00:00Z"), content: "نص" })).toMatchObject({
      releasedAt: "2026-02-01T00:00:00.000Z",
      hasContent: true,
    });
  });
});
