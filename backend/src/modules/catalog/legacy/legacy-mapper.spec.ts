import { EXTRA_TAGS, findCoverUrl, mapGroup, mapManga, mapTag, safeUrl, TAG_AR, type LegacyManga } from "./legacy-mapper";

// Captured from the old site's GET /v2/manga (trimmed).
const GODDESS: LegacyManga = {
  id: "019fa8a7-6b16-7000-967a-24711075b5b4",
  attributes: {
    title: { en: "Goddess of fortune " },
    altTitles: [],
    description: [{ en: "طوال حياتها، كانت \"جي-يون\" تحتل المركز الثاني دائمًا في فصلها." }],
    status: "ongoing",
    state: "approved",
    year: 2026,
    originalLanguage: "ko",
    contentRating: "safe",
    createdAt: "2026-07-28T12:16:12.121Z",
    tags: [
      { id: "t-survival", attributes: { name: { en: "Survival" }, group: "theme" } },
      { id: "t-romance", attributes: { name: { en: "Romance" }, group: "genre" } },
    ],
  },
};

describe("mapManga", () => {
  it("maps a real record", () => {
    expect(mapManga(GODDESS)).toMatchObject({
      legacyId: "019fa8a7-6b16-7000-967a-24711075b5b4",
      titleEn: "Goddess of fortune",
      titleAr: "Goddess of fortune",
      status: "ongoing",
      year: 2026,
      country: "kr",
      type: "manhwa",
      approved: true,
      tagLegacyIds: ["t-survival", "t-romance"],
    });
    expect(mapManga(GODDESS).synopsis).toContain("جي-يون");
  });

  it("takes an Arabic title from the alternatives when there is one", () => {
    const m = mapManga({ ...GODDESS, attributes: { ...GODDESS.attributes, altTitles: [{ ja: "運の女神" }, { ar: "إلهة الحظ" }] } });
    expect(m.titleAr).toBe("إلهة الحظ");
    expect(m.titleEn).toBe("Goddess of fortune");
    // The Arabic one is now the main title, so it is not repeated as an alternative.
    expect(m.alternativeTitles).toEqual(["運の女神"]);
  });

  it("survives a record with no title at all", () => {
    const m = mapManga({ id: "x", attributes: { title: null, altTitles: [{ en: "Lemonade" }] } });
    expect(m.titleEn).toBe("Lemonade");
    expect(m.titleAr).toBe("Lemonade");
    const nothing = mapManga({ id: "y", attributes: {} });
    expect(nothing.titleAr).toBe("بدون عنوان");
  });

  it.each([
    ["ko", "kr", "manhwa"],
    ["ja", "jp", "manga"],
    ["zh", "cn", "manhua"],
    ["fr", "kr", "manhwa"],
    [undefined, "kr", "manhwa"],
  ])("derives country and type from the original language %s", (lang, country, type) => {
    const m = mapManga({ id: "x", attributes: { title: { en: "T" }, originalLanguage: lang } });
    expect({ country: m.country, type: m.type }).toEqual({ country, type });
  });

  it("maps statuses, treating cancelled as dropped and unknown as ongoing", () => {
    const status = (s: string | null) => mapManga({ id: "x", attributes: { title: { en: "T" }, status: s } }).status;
    expect(status("completed")).toBe("completed");
    expect(status("hiatus")).toBe("hiatus");
    expect(status("cancelled")).toBe("dropped");
    expect(status("weird")).toBe("ongoing");
    expect(status(null)).toBe("ongoing");
  });

  it("marks anything not approved so the importer can skip it", () => {
    expect(mapManga({ id: "x", attributes: { title: { en: "T" }, state: "pending" } }).approved).toBe(false);
  });

  it("caps the synopsis and the alternative titles", () => {
    const long = mapManga({
      id: "x",
      attributes: { title: { en: "T" }, description: [{ en: "a".repeat(9000) }], altTitles: Array.from({ length: 40 }, (_, i) => ({ en: `alt ${i}` })) },
    });
    expect(long.synopsis).toHaveLength(5000);
    expect(long.alternativeTitles).toHaveLength(20);
  });
});

describe("mapTag", () => {
  it("slugs like the frontend's genres and translates known names", () => {
    expect(mapTag({ id: "1", attributes: { name: { en: "Slice of Life" }, group: "genre" } })).toMatchObject({
      slug: "slice-of-life",
      nameAr: "شريحة حياة",
      group: "genre",
    });
    expect(mapTag({ id: "2", attributes: { name: { en: "Sci-Fi" }, group: "genre" } }).slug).toBe("sci-fi");
    expect(mapTag({ id: "3", attributes: { name: { en: "Martial Arts" }, group: "theme" } }).slug).toBe("martial-arts");
  });

  it("keeps an unknown tag's English name and defaults an odd group to genre", () => {
    expect(mapTag({ id: "4", attributes: { name: { en: "Brand New Thing" }, group: "mystery-box" } })).toMatchObject({
      nameAr: "Brand New Thing",
      group: "genre",
    });
  });

  it("has an Arabic name for every tag the old site is known to use, and the extras are not duplicates", () => {
    expect(Object.keys(TAG_AR)).toHaveLength(77);
    for (const extra of EXTRA_TAGS) expect(TAG_AR[extra.nameEn]).toBeUndefined();
  });
});

describe("mapGroup", () => {
  it("cleans markdown out of the description and keeps only real links", () => {
    const g = mapGroup({
      id: "g1",
      attributes: { name: "ajram | أجــرام", description: "***الترجمه والتحرير***", discord: "not a url", website: "https://example.com/x", inactive: false, createdAt: "2026-03-19T03:37:32.000Z" },
    });
    expect(g).toMatchObject({ legacyId: "g1", description: "الترجمه والتحرير", discordUrl: null, websiteUrl: "https://example.com/x", status: "active" });
    expect(g.createdAt?.toISOString()).toBe("2026-03-19T03:37:32.000Z");
  });

  it("archives an inactive group", () => {
    expect(mapGroup({ id: "g2", attributes: { name: "idk", inactive: true } }).status).toBe("archived");
  });
});

describe("safeUrl", () => {
  it("accepts http(s) only", () => {
    expect(safeUrl("https://discord.gg/abc")).toBe("https://discord.gg/abc");
    expect(safeUrl("javascript:alert(1)")).toBeNull();
    expect(safeUrl("ftp://x.com")).toBeNull();
    expect(safeUrl("")).toBeNull();
    expect(safeUrl(null)).toBeNull();
  });
});

describe("findCoverUrl", () => {
  it("finds the CDN cover in a page and ignores other images", () => {
    const html =
      '<img src="https://lunexteam.com/img/ui/logo2.png"><img src="https://cdn.lunexteam.com/manga/019fa8a7-6b16-7000-967a-24711075b5b4/cover/019fa8a7-6e77-7000-a45e-f8c297f1a5de.webp">';
    expect(findCoverUrl(html)).toBe(
      "https://cdn.lunexteam.com/manga/019fa8a7-6b16-7000-967a-24711075b5b4/cover/019fa8a7-6e77-7000-a45e-f8c297f1a5de.webp"
    );
    expect(findCoverUrl("<html>nothing here</html>")).toBeNull();
  });

  it("refuses a look-alike host", () => {
    expect(findCoverUrl("https://cdn.lunexteam.com.evil.example/manga/019fa8a7-6b16-7000-967a-24711075b5b4/cover/019fa8a7-6e77-7000-a45e-f8c297f1a5de.webp")).toBeNull();
  });
});
