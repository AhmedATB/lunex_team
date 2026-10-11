import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { Calendar, Megaphone, Newspaper, Play, Sparkles, Star } from "lucide-react-native";
import { useMemo } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { AppHeader } from "../../components/app-header";
import { Carousel, Grid, GUTTER, unmirror } from "../../components/layout";
import { CoverPanel, CoverTile, openChapterNumber, openSeries } from "../../components/series-card";
import { Badge, Button, ErrorState, formatNumber, formatRating, Loading, Panel, RatingPill, Row, SectionHeader, Txt } from "../../components/ui";
import { byPopularity, byThisWeek, latestPerSeries, seriesTitle, timeAgo, useBootstrap } from "../../lib/catalog";
import { absolute } from "../../lib/config";
import { useLibrary } from "../../lib/library";
import type { Series } from "../../lib/types";
import { colors, lunexGradient, panel, radius } from "../../theme";

/** The site's lib/essential-genres.ts: the genres worth a tile on the home page, in this order, when some work uses them. */
const ESSENTIAL_GENRE_SLUGS = [
  "action",
  "adventure",
  "fantasy",
  "romance",
  "comedy",
  "drama",
  "horror",
  "mystery",
  "thriller",
  "sci-fi",
  "supernatural",
  "martial-arts",
  "survival",
  "school-life",
  "psychological",
  "isekai",
  "sports",
  "historical",
];

const NEWS_ICON = { announcement: Megaphone, event: Calendar, news: Newspaper } as const;
const NEWS_LABEL: Record<string, string> = { announcement: "إعلان", event: "فعالية", news: "خبر" };

const explore = (params: Record<string, string>) => router.navigate({ pathname: "/explore", params });

/** The lead story: the first pinned work, its cover beside its title, a purple glow behind. */
function Lead({ series }: { series: Series }) {
  return (
    <Pressable onPress={() => openSeries(series.slug)} style={({ pressed }) => [panel, styles.lead, pressed && { transform: [{ scale: 0.99 }] }]}>
      <LinearGradient colors={["rgba(109,40,217,0.35)", "transparent"]} start={{ x: 0.75, y: 0.3 }} end={{ x: 0.1, y: 1 }} style={StyleSheet.absoluteFill} />
      <LinearGradient colors={["rgba(0,0,0,0.25)", "rgba(0,0,0,0.45)", "rgba(0,0,0,0.85)"]} style={StyleSheet.absoluteFill} />
      <Row gap={16}>
        <View style={styles.leadCover}>
          <Image source={absolute(series.cover)} style={StyleSheet.absoluteFill} contentFit="cover" priority="high" />
        </View>
        <View style={{ flex: 1, gap: 10 }}>
          <Badge label="حصري LUNEX" />
          <Txt display size={20} weight="900" numberOfLines={3} style={{ lineHeight: 28 }}>
            {seriesTitle(series)}
          </Txt>
          <Txt size={12} color="rgba(255,255,255,0.8)" numberOfLines={3} style={{ lineHeight: 18 }}>
            {series.synopsis.replace(/\s+/g, " ").trim()}
          </Txt>
          <Row gap={12} style={{ paddingTop: 4, flexWrap: "wrap" }}>
            <Button label="ابدأ القراءة" onPress={() => openSeries(series.slug)} />
            <RatingPill rating={series.rating} ratingCount={series.ratingCount} large />
          </Row>
        </View>
      </Row>
    </Pressable>
  );
}

function SecondaryStory({ series }: { series: Series }) {
  return (
    <Pressable onPress={() => openSeries(series.slug)} style={({ pressed }) => [panel, styles.secondary, pressed && { transform: [{ scale: 0.98 }] }]}>
      <Row gap={12} style={{ alignItems: "stretch" }}>
        <View style={styles.secondaryCover}>
          <Image source={absolute(series.cover)} style={StyleSheet.absoluteFill} contentFit="cover" />
        </View>
        <View style={{ flex: 1, justifyContent: "center", gap: 4 }}>
          <Txt size={14} weight="700" numberOfLines={1}>
            {seriesTitle(series)}
          </Txt>
          <Row gap={4} style={styles.amberChip}>
            <Star size={12} color={colors.amber300} fill={colors.amber300} />
            <Txt size={12} weight="700" color={colors.amber300}>
              {formatRating(series.rating, series.ratingCount)}
            </Txt>
          </Row>
          <Txt size={12} color={colors.muted}>
            {formatNumber(series.views)} مشاهدة
          </Txt>
        </View>
      </Row>
    </Pressable>
  );
}

/** The site's home page ("تحريري", components/home/layouts/editorial-home.tsx), section for section. */
export default function HomeScreen() {
  const { data, isLoading, isError, refetch, isRefetching } = useBootstrap();
  const { progress, readAt } = useLibrary();

  const view = useMemo(() => {
    if (!data) return null;
    const series = data.series;
    const seriesMap = new Map(series.map((s) => [s.id, s]));
    const featured = series
      .filter((s) => s.isFeatured)
      .sort((a, b) => (a.featuredOrder ?? Number.MAX_SAFE_INTEGER) - (b.featuredOrder ?? Number.MAX_SAFE_INTEGER) || byPopularity(a, b))
      .slice(0, 6);
    const trending = [...series].sort(byThisWeek).slice(0, 10);
    const popular = [...series].sort(byPopularity);
    const latestChapters = latestPerSeries(
      data.recentChapters.filter((c) => seriesMap.has(c.seriesId)),
      12,
    ).map((c) => ({ ...c, series: seriesMap.get(c.seriesId)! }));
    const usedGenres = new Set(series.flatMap((s) => s.genreIds));
    const bySlug = new Map(data.tags.filter((t) => t.group === "genre" || t.group === "theme").map((t) => [t.slug, t]));
    const genres = ESSENTIAL_GENRE_SLUGS.flatMap((slug) => {
      const tag = bySlug.get(slug);
      return tag && usedGenres.has(tag.id) ? [tag] : [];
    });
    return {
      lead: featured[0] ?? trending[0],
      secondary: featured.length > 1 ? featured.slice(1, 4) : trending.slice(1, 4),
      topTrending: trending.slice(0, 6),
      latestChapters: latestChapters.slice(0, 6),
      popular: popular.slice(0, 6),
      ongoing: popular.filter((s) => s.status === "ongoing").slice(0, 6),
      completed: popular.filter((s) => s.status === "completed").slice(0, 6),
      newReleases: [...series].sort((a, b) => b.year - a.year).slice(0, 6),
      picks: popular.filter((s) => s.isRecommended).slice(0, 3),
      randomPick: series.length ? series[Math.floor((Date.now() / 86_400_000) % series.length)] : undefined,
      genres,
      news: [...data.news].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)).slice(0, 6),
      continueReading: Object.entries(progress)
        .sort(([a], [b]) => (readAt[b] ?? "").localeCompare(readAt[a] ?? ""))
        .flatMap(([seriesId, chapter]) => {
          const s = seriesMap.get(seriesId);
          return s ? [{ series: s, chapter }] : [];
        })
        .slice(0, 6),
    };
  }, [data, progress, readAt]);

  if (isLoading) return <Loading />;
  if (isError || !view) return <ErrorState onRetry={refetch} />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <AppHeader ticker />
      <ScrollView
        contentContainerStyle={{ paddingTop: 24, paddingBottom: 48, gap: 56 }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary400} colors={[colors.primary400]} />}
      >
        {view.lead && (
          <View style={{ gap: 16 }}>
            <View style={{ paddingHorizontal: GUTTER }}>
              <Lead series={view.lead} />
            </View>
            {view.secondary.length > 0 && (
              <Carousel>
                {view.secondary.map((s) => (
                  <View key={s.id} style={unmirror}>
                    <SecondaryStory series={s} />
                  </View>
                ))}
              </Carousel>
            )}
          </View>
        )}

        {view.continueReading.length > 0 && (
          <View>
            <SectionHeader title="تابع القراءة" />
            <Grid
              items={view.continueReading}
              columns={2}
              gap={16}
              keyOf={(x) => x.series.id}
              render={({ series, chapter }) => (
                <Pressable
                  onPress={() => openChapterNumber(series.slug, chapter)}
                  style={styles.continueCard}
                >
                  <View style={{ aspectRatio: 3 / 4.2 }}>
                    <Image source={absolute(series.cover)} style={StyleSheet.absoluteFill} contentFit="cover" />
                    <LinearGradient colors={["transparent", "rgba(0,0,0,0.2)", "rgba(0,0,0,0.9)"]} style={StyleSheet.absoluteFill} />
                    <View style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center" }]}>
                      <LinearGradient {...lunexGradient} style={styles.play}>
                        <Play size={20} color={colors.text} />
                      </LinearGradient>
                    </View>
                    <View style={{ position: "absolute", left: 12, right: 12, bottom: 12 }}>
                      <Txt size={12} weight="700" numberOfLines={1}>
                        {seriesTitle(series)}
                      </Txt>
                      <Txt size={11} color={colors.primary300}>
                        الفصل {chapter}
                      </Txt>
                    </View>
                  </View>
                </Pressable>
              )}
            />
          </View>
        )}

        <View>
          <SectionHeader title="الأكثر قراءة هذا الأسبوع" onShowAll={() => explore({ sort: "trending" })} />
          <View style={{ paddingHorizontal: GUTTER, gap: 12 }}>
            {view.topTrending.map((s, i) => (
              <Pressable key={s.id} onPress={() => openSeries(s.slug)}>
                {({ pressed }) => (
                  <Row gap={16}>
                    <Txt display size={30} weight="800" color={pressed ? colors.primary400 : colors.border} style={{ width: 44 }}>
                      {String(i + 1).padStart(2, "0")}
                    </Txt>
                    <View style={styles.rankCover}>
                      <Image source={absolute(s.cover)} style={StyleSheet.absoluteFill} contentFit="cover" />
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Txt size={14} weight="700" color={pressed ? colors.primary300 : colors.text} numberOfLines={1}>
                        {seriesTitle(s)}
                      </Txt>
                      <Txt size={12} color={colors.muted}>
                        ★ {formatRating(s.rating, s.ratingCount)} · {formatNumber(s.views)} مشاهدة
                      </Txt>
                    </View>
                  </Row>
                )}
              </Pressable>
            ))}
          </View>
        </View>

        <View>
          <SectionHeader title="آخر تحديثات الفصول" onShowAll={() => explore({ sort: "latest" })} />
          <Grid
            items={view.latestChapters}
            columns={3}
            gap={12}
            keyOf={(c) => c.id}
            render={(c, i) => (
              <Pressable onPress={() => router.push({ pathname: "/read/[chapterId]", params: { chapterId: c.id, slug: c.series.slug } })} style={{ gap: 8 }}>
                <CoverPanel uri={c.series.cover} recyclingKey={c.series.id} scrim>
                  {i === 0 && (
                    <View style={styles.newBadge}>
                      <Txt size={11} weight="700">
                        جديد
                      </Txt>
                    </View>
                  )}
                  <Txt size={11} weight="700" style={{ position: "absolute", left: 8, right: 8, bottom: 8 }}>
                    الفصل {c.number}
                    {c.moreCount > 0 ? <Txt size={11} color="rgba(255,255,255,0.7)">{` · +${c.moreCount}`}</Txt> : null}
                  </Txt>
                </CoverPanel>
                <Txt size={12} weight="700" numberOfLines={2}>
                  {seriesTitle(c.series)}
                </Txt>
              </Pressable>
            )}
          />
        </View>

        <View>
          <SectionHeader title="الأكثر شعبية" onShowAll={() => explore({ sort: "popular" })} />
          <Carousel>
            {view.popular.map((s, i) => (
              <View key={s.id} style={unmirror}>
                <CoverTile series={s} width={160} rank={i + 1} />
              </View>
            ))}
          </Carousel>
        </View>

        {view.ongoing.length > 0 && (
          <View>
            <SectionHeader title="مستمرة" onShowAll={() => explore({ status: "ongoing" })} />
            <Grid items={view.ongoing} columns={2} gap={16} keyOf={(s) => s.id} render={(s) => <CoverTile series={s} />} />
          </View>
        )}

        {view.completed.length > 0 && (
          <View>
            <SectionHeader title="مكتملة" onShowAll={() => explore({ status: "completed" })} />
            <Grid items={view.completed} columns={2} gap={16} keyOf={(s) => s.id} render={(s) => <CoverTile series={s} />} />
          </View>
        )}

        <View>
          <SectionHeader title="إصدارات جديدة" onShowAll={() => explore({ sort: "latest" })} />
          <Grid items={view.newReleases} columns={2} gap={16} keyOf={(s) => s.id} render={(s) => <CoverTile series={s} />} />
        </View>

        {view.picks.length > 0 && (
          <View>
            <SectionHeader title="اختيارات المحررين" onShowAll={() => explore({})} />
            <View style={{ paddingHorizontal: GUTTER, gap: 16 }}>
              {view.picks.map((s) => (
                <Pressable key={s.id} onPress={() => openSeries(s.slug)} style={[panel, { padding: 12 }]}>
                  <Row gap={16}>
                    <View style={styles.pickCover}>
                      <Image source={absolute(s.cover)} style={StyleSheet.absoluteFill} contentFit="cover" />
                    </View>
                    <View style={{ flex: 1, gap: 8 }}>
                      <Txt display size={16} weight="700">
                        {seriesTitle(s)}
                      </Txt>
                      <Txt size={12} color={colors.muted} numberOfLines={3}>
                        {s.synopsis.replace(/\s+/g, " ").trim()}
                      </Txt>
                    </View>
                  </Row>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {view.randomPick && (
          <View style={{ paddingHorizontal: GUTTER }}>
            <Panel style={{ padding: 24, gap: 24, overflow: "hidden" }}>
              <View style={{ position: "absolute", top: -16, left: 24 }}>
                <Sparkles size={96} color="rgba(139,49,232,0.1)" />
              </View>
              <View style={{ aspectRatio: 3 / 4, borderRadius: radius.xl, overflow: "hidden" }}>
                <Image source={absolute(view.randomPick.cover)} style={StyleSheet.absoluteFill} contentFit="cover" />
              </View>
              <View style={{ gap: 12 }}>
                <Badge label="اختيار عشوائي لليوم" variant="outline" />
                <Txt display size={24} weight="700">
                  {seriesTitle(view.randomPick)}
                </Txt>
                <Txt size={14} color={colors.muted} numberOfLines={3} style={{ lineHeight: 22 }}>
                  {view.randomPick.synopsis.replace(/\s+/g, " ").trim()}
                </Txt>
                <Button label="اقرأ الآن" variant="secondary" onPress={() => openSeries(view.randomPick!.slug)} style={{ alignSelf: "flex-end" }} />
              </View>
            </Panel>
          </View>
        )}

        {view.genres.length > 0 && (
          <View>
            <SectionHeader title="تصفح حسب التصنيف" />
            <Grid
              items={[...view.genres.map((g) => ({ id: g.id, label: g.nameAr || g.name, all: false })), { id: "__all", label: "كل التصنيفات", all: true }]}
              columns={2}
              gap={12}
              keyOf={(g) => g.id}
              render={(g) => (
                <Pressable onPress={() => explore(g.all ? {} : { genre: g.id })} style={({ pressed }) => [panel, styles.genreTile, pressed && styles.genrePressed]}>
                  {({ pressed }) => (
                    <Txt size={14} weight="600" align="center" color={g.all ? colors.primary300 : pressed ? colors.text : colors.muted}>
                      {g.label}
                    </Txt>
                  )}
                </Pressable>
              )}
            />
          </View>
        )}

        {view.news.length > 0 && (
          <View>
            <SectionHeader title="أخبار وفعاليات الفريق" />
            <View style={{ paddingHorizontal: GUTTER, gap: 16 }}>
              {view.news.map((n) => {
                const Icon = NEWS_ICON[n.category as keyof typeof NEWS_ICON] ?? Newspaper;
                return (
                  <Panel key={n.id} style={{ overflow: "hidden" }}>
                    <View style={{ aspectRatio: 16 / 9 }}>
                      <Image source={absolute(n.cover)} style={StyleSheet.absoluteFill} contentFit="cover" />
                      <View style={{ position: "absolute", left: 12, bottom: 12 }}>
                        <Icon size={20} color="rgba(255,255,255,0.7)" />
                      </View>
                      <Badge label={NEWS_LABEL[n.category] ?? n.category} variant="secondary" style={{ position: "absolute", top: 8, right: 8 }} />
                    </View>
                    <View style={{ padding: 16, gap: 4 }}>
                      <Txt size={14} weight="700" numberOfLines={2}>
                        {n.title}
                      </Txt>
                      <Txt size={12} color={colors.muted}>
                        {timeAgo(n.createdAt)}
                      </Txt>
                    </View>
                  </Panel>
                );
              })}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  lead: { padding: 16, overflow: "hidden" },
  leadCover: {
    width: 128,
    aspectRatio: 2 / 3,
    borderRadius: radius.xl,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  secondary: { width: 256, padding: 12 },
  secondaryCover: { width: 64, minHeight: 72, borderRadius: radius.md, overflow: "hidden" },
  amberChip: { alignSelf: "flex-end", backgroundColor: "rgba(251,191,36,0.15)", borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 },
  continueCard: { borderRadius: radius["2xl"], overflow: "hidden", borderWidth: 1, borderColor: colors.white10 },
  play: { borderRadius: 999, padding: 12 },
  rankCover: { width: 50, height: 66, borderRadius: radius.md, overflow: "hidden" },
  newBadge: { position: "absolute", top: 8, right: 8, backgroundColor: "rgba(168,85,247,0.8)", borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 },
  pickCover: { width: 96, aspectRatio: 3 / 4, borderRadius: radius.md, overflow: "hidden" },
  genreTile: { paddingHorizontal: 16, paddingVertical: 12, alignItems: "center", justifyContent: "center" },
  genrePressed: { borderColor: "rgba(168,85,247,0.4)", transform: [{ scale: 0.97 }] },
});
