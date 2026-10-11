import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useMemo } from "react";
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SeriesCard } from "../../components/series-card";
import { ErrorState, Loading, Row, SectionTitle, Txt } from "../../components/ui";
import { chapterLabel, seriesTitle, timeAgo, useBootstrap } from "../../lib/catalog";
import { absolute } from "../../lib/config";
import { useLibrary } from "../../lib/library";
import type { Chapter, Series } from "../../lib/types";
import { colors, radius, TYPE_LABEL } from "../../theme";

/** A horizontal shelf that starts at the right edge and scrolls leftwards, as an Arabic reader expects. */
function Shelf<T>({ data, render, keyOf }: { data: T[]; render: (item: T) => React.ReactElement; keyOf: (item: T) => string }) {
  return (
    <FlatList
      horizontal
      inverted
      data={data}
      keyExtractor={keyOf}
      renderItem={({ item }) => render(item)}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
    />
  );
}

function Hero({ series }: { series: Series }) {
  const { width } = useWindowDimensions();
  return (
    <Pressable
      onPress={() => router.push({ pathname: "/series/[slug]", params: { slug: series.slug } })}
      style={{ width, height: width * 0.95 }}
    >
      <Image source={absolute(series.banner || series.cover)} style={StyleSheet.absoluteFill} contentFit="cover" />
      <LinearGradient
        colors={["rgba(9,9,11,0.1)", "rgba(9,9,11,0.55)", colors.bg]}
        locations={[0, 0.6, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.heroText}>
        <Txt size={12} weight="700" color={colors.lilac}>
          {TYPE_LABEL[series.type] ?? series.type} · {series.chapterCount} فصل
        </Txt>
        <Txt size={26} weight="800" numberOfLines={2}>
          {seriesTitle(series)}
        </Txt>
        <Txt size={13} color={colors.muted} numberOfLines={2}>
          {series.synopsis.replace(/\s+/g, " ").trim()}
        </Txt>
      </View>
    </Pressable>
  );
}

function LatestChapterRow({ chapter, series }: { chapter: Chapter; series: Series }) {
  return (
    <Pressable
      onPress={() => router.push({ pathname: "/read/[chapterId]", params: { chapterId: chapter.id, slug: series.slug } })}
      style={({ pressed }) => [styles.latestRow, pressed && { backgroundColor: colors.surfaceRaised }]}
    >
      <Row gap={12}>
        <Image source={absolute(series.cover)} style={styles.latestCover} contentFit="cover" recyclingKey={series.id} />
        <View style={{ flex: 1, gap: 2 }}>
          <Txt weight="700" numberOfLines={1}>
            {seriesTitle(series)}
          </Txt>
          <Txt size={13} color={colors.lilac} numberOfLines={1}>
            {chapterLabel(chapter)}
          </Txt>
          <Txt size={11} color={colors.faint}>
            {timeAgo(chapter.releasedAt)}
          </Txt>
        </View>
      </Row>
    </Pressable>
  );
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { data, isLoading, isError, refetch, isRefetching } = useBootstrap();
  const { history } = useLibrary();

  const view = useMemo(() => {
    if (!data) return null;
    const bySeries = new Map(data.series.map((s) => [s.id, s]));
    const featured =
      [...data.series].filter((s) => s.isFeatured).sort((a, b) => (a.featuredOrder ?? 99) - (b.featuredOrder ?? 99))[0] ??
      [...data.series].sort((a, b) => (b.viewsWeek ?? 0) - (a.viewsWeek ?? 0))[0];
    const trending = [...data.series].sort((a, b) => (b.viewsWeek ?? b.views) - (a.viewsWeek ?? a.views)).slice(0, 15);
    const latest = data.recentChapters
      .map((c) => ({ chapter: c, series: bySeries.get(c.seriesId) }))
      .filter((x): x is { chapter: Chapter; series: Series } => Boolean(x.series))
      .slice(0, 20);
    const recentlyUpdated = [...data.series].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return { featured, trending, latest, recentlyUpdated };
  }, [data]);

  if (isLoading) return <Loading />;
  if (isError || !view) return <ErrorState onRetry={refetch} />;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ paddingBottom: 32 }}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.violet} progressViewOffset={insets.top} />
      }
    >
      {view.featured && <Hero series={view.featured} />}

      {history.length > 0 && (
        <View style={styles.section}>
          <SectionTitle>تابع القراءة</SectionTitle>
          <Shelf
            data={history.slice(0, 12)}
            keyOf={(h) => h.seriesId}
            render={(h) => (
              <Pressable
                onPress={() => router.push({ pathname: "/read/[chapterId]", params: { chapterId: h.chapterId, slug: h.slug } })}
                style={{ width: 110 }}
              >
                <Image source={absolute(h.cover)} style={styles.historyCover} contentFit="cover" />
                <Txt size={12} weight="600" numberOfLines={1} style={{ marginTop: 6 }}>
                  {h.title}
                </Txt>
                <Txt size={11} color={colors.lilac}>
                  الفصل {h.chapterNumber}
                </Txt>
              </Pressable>
            )}
          />
        </View>
      )}

      <View style={styles.section}>
        <SectionTitle>الأكثر رواجًا هذا الأسبوع</SectionTitle>
        <Shelf data={view.trending} keyOf={(s) => s.id} render={(s) => <SeriesCard series={s} />} />
      </View>

      <View style={styles.section}>
        <SectionTitle>آخر الفصول</SectionTitle>
        <View style={{ paddingHorizontal: 16, gap: 8 }}>
          {view.latest.map(({ chapter, series }) => (
            <LatestChapterRow key={chapter.id} chapter={chapter} series={series} />
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <SectionTitle>أعمال حُدّثت مؤخرًا</SectionTitle>
        <Shelf
          data={view.recentlyUpdated}
          keyOf={(s) => s.id}
          render={(s) => <SeriesCard series={s} subtitle={`${s.chapterCount} فصل`} />}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  heroText: { position: "absolute", left: 16, right: 16, bottom: 16, gap: 6 },
  section: { marginTop: 24 },
  historyCover: { width: 110, height: 150, borderRadius: radius.md, backgroundColor: colors.surface },
  latestRow: { padding: 8, borderRadius: radius.md, backgroundColor: colors.surface },
  latestCover: { width: 52, height: 72, borderRadius: radius.sm, backgroundColor: colors.surfaceRaised },
});
