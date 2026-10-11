import Ionicons from "@expo/vector-icons/Ionicons";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import { Button, ErrorState, Loading, Row, Txt } from "../../components/ui";
import { apiJson } from "../../lib/api";
import { chapterLabel, isLocked, seriesTitle, timeAgo, useBootstrap, useLockRule, useSeriesDetail } from "../../lib/catalog";
import { absolute } from "../../lib/config";
import { toggleBookmark, useLibrary } from "../../lib/library";
import { useSession } from "../../lib/session";
import type { Chapter, Series } from "../../lib/types";
import { colors, radius, STATUS_LABEL, TYPE_LABEL } from "../../theme";

interface ChapterProgress {
  fraction: number;
  finished: boolean;
}

/** The reader's checkmarks and progress bars for this work's chapters; empty when signed out. */
function useSeriesProgress(seriesId: string | undefined) {
  const { status } = useSession();
  return useQuery({
    queryKey: ["series-progress", seriesId],
    enabled: Boolean(seriesId) && status === "signedIn",
    queryFn: async () => {
      const body = await apiJson<{ items: ({ chapterId: string } & ChapterProgress)[] }>(
        `/api/me/reading/progress?seriesId=${encodeURIComponent(seriesId!)}`,
      );
      return Object.fromEntries(body.items.map(({ chapterId, ...p }) => [chapterId, p])) as Record<string, ChapterProgress>;
    },
  });
}

function Header({ series, genres, firstChapter, resume }: { series: Series; genres: string[]; firstChapter?: Chapter; resume?: Chapter }) {
  const { width } = useWindowDimensions();
  const { bookmarks } = useLibrary();
  const saved = bookmarks.includes(series.id);
  const [expanded, setExpanded] = useState(false);
  const target = resume ?? firstChapter;

  return (
    <View>
      <View style={{ height: width * 0.6 }}>
        <Image
          source={absolute(series.banner || series.cover)}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          blurRadius={series.banner === series.cover ? 12 : 0}
        />
        <LinearGradient colors={["rgba(9,9,11,0.2)", colors.bg]} style={StyleSheet.absoluteFill} />
      </View>
      <Row gap={14} style={{ paddingHorizontal: 16, marginTop: -90, alignItems: "flex-end" }}>
        <Image source={absolute(series.cover)} style={styles.cover} contentFit="cover" />
        <View style={{ flex: 1, gap: 4, paddingBottom: 4 }}>
          <Txt size={22} weight="800" numberOfLines={3}>
            {seriesTitle(series)}
          </Txt>
          {series.titleAr && series.title !== series.titleAr ? (
            <Txt size={12} color={colors.muted} numberOfLines={1}>
              {series.title}
            </Txt>
          ) : null}
          <Txt size={12} color={colors.lilac}>
            {[TYPE_LABEL[series.type] ?? series.type, STATUS_LABEL[series.status] ?? series.status, series.year]
              .filter(Boolean)
              .join(" · ")}
          </Txt>
        </View>
      </Row>

      <Row style={{ paddingHorizontal: 16, marginTop: 16 }} gap={10}>
        {target ? (
          <Pressable
            onPress={() => router.push({ pathname: "/read/[chapterId]", params: { chapterId: target.id, slug: series.slug } })}
            style={[styles.primaryBtn, { flex: 1 }]}
          >
            <Txt weight="700">{resume ? `تابع ${chapterLabel(resume)}` : "ابدأ القراءة"}</Txt>
          </Pressable>
        ) : (
          <View style={{ flex: 1 }} />
        )}
        <Pressable
          onPress={() => toggleBookmark(series.id)}
          style={styles.iconBtn}
          accessibilityLabel={saved ? "إزالة من المحفوظات" : "حفظ"}
        >
          <Ionicons name={saved ? "bookmark" : "bookmark-outline"} size={22} color={saved ? colors.lilac : colors.text} />
        </Pressable>
      </Row>

      <Row style={{ paddingHorizontal: 16, marginTop: 16, flexWrap: "wrap" }} gap={6}>
        {genres.map((g) => (
          <View key={g} style={styles.genre}>
            <Txt size={12} color={colors.muted}>
              {g}
            </Txt>
          </View>
        ))}
      </Row>

      <Pressable onPress={() => setExpanded((e) => !e)} style={{ paddingHorizontal: 16, marginTop: 14 }}>
        <Txt size={14} color={colors.muted} numberOfLines={expanded ? undefined : 4} style={{ lineHeight: 22 }}>
          {series.synopsis.trim()}
        </Txt>
      </Pressable>

      <Txt size={18} weight="800" style={{ paddingHorizontal: 16, marginTop: 24, marginBottom: 8 }}>
        الفصول ({series.chapterCount})
      </Txt>
    </View>
  );
}

export default function SeriesScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { data, isLoading, isError, refetch } = useSeriesDetail(slug);
  const { data: boot } = useBootstrap();
  const rule = useLockRule();
  const { data: progress } = useSeriesProgress(data?.series.id);
  const { history } = useLibrary();

  const chapters = useMemo(() => [...(data?.chapters ?? [])].sort((a, b) => b.number - a.number), [data]);
  const genres = useMemo(() => {
    if (!data || !boot) return [];
    const names = new Map(boot.tags.map((t) => [t.id, t.nameAr || t.name]));
    return data.series.genreIds.map((id) => names.get(id)).filter((n): n is string => Boolean(n));
  }, [data, boot]);

  if (isLoading) return <Loading />;
  if (isError || !data) return <ErrorState onRetry={refetch} />;

  const { series } = data;
  const lastRead = history.find((h) => h.seriesId === series.id);
  const resume = lastRead ? chapters.find((c) => c.id === lastRead.chapterId) : undefined;
  const firstChapter = chapters[chapters.length - 1];

  return (
    <>
      <Stack.Screen options={{ title: "", headerTransparent: true, headerStyle: { backgroundColor: "transparent" } }} />
      <FlatList
        data={chapters}
        keyExtractor={(c) => c.id}
        ListHeaderComponent={<Header series={series} genres={genres} firstChapter={firstChapter} resume={resume} />}
        contentContainerStyle={{ paddingBottom: 40 }}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        renderItem={({ item }) => {
          const locked = isLocked(item, series.latestChapterNumber, rule);
          const p = progress?.[item.id];
          return (
            <Pressable
              onPress={() => router.push({ pathname: "/read/[chapterId]", params: { chapterId: item.id, slug: series.slug } })}
              style={({ pressed }) => [styles.chapterRow, pressed && { backgroundColor: colors.surface }]}
            >
              <Row gap={12}>
                {item.thumbnail ? (
                  <Image source={absolute(item.thumbnail)} style={styles.thumb} contentFit="cover" />
                ) : (
                  <View style={[styles.thumb, { alignItems: "center", justifyContent: "center" }]}>
                    <Txt weight="800" color={colors.faint}>
                      {item.number}
                    </Txt>
                  </View>
                )}
                <View style={{ flex: 1, gap: 3 }}>
                  <Txt weight="600" numberOfLines={1} color={p?.finished ? colors.muted : colors.text}>
                    {chapterLabel(item)}
                  </Txt>
                  <Txt size={11} color={colors.faint}>
                    {timeAgo(item.releasedAt)}
                  </Txt>
                  {p && !p.finished && p.fraction > 0 ? (
                    <View style={styles.progressTrack}>
                      <View style={[styles.progressFill, { width: `${Math.round(p.fraction * 100)}%` }]} />
                    </View>
                  ) : null}
                </View>
                {locked ? <Ionicons name="lock-closed" size={16} color={colors.warning} /> : null}
                {p?.finished ? <Ionicons name="checkmark-circle" size={18} color={colors.success} /> : null}
              </Row>
            </Pressable>
          );
        }}
        ListEmptyComponent={<Button label="لا توجد فصول منشورة بعد" variant="ghost" disabled onPress={() => {}} style={{ margin: 16 }} />}
      />
    </>
  );
}

const styles = StyleSheet.create({
  cover: { width: 110, height: 156, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  primaryBtn: { height: 48, borderRadius: radius.md, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  iconBtn: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  genre: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: colors.surface },
  chapterRow: { paddingHorizontal: 16, paddingVertical: 10 },
  thumb: { width: 72, height: 48, borderRadius: radius.sm, backgroundColor: colors.surface },
  separator: { height: 1, backgroundColor: colors.border, marginHorizontal: 16 },
  progressTrack: { height: 3, borderRadius: 2, backgroundColor: colors.surfaceRaised, overflow: "hidden", marginTop: 2 },
  progressFill: { height: 3, backgroundColor: colors.violet, alignSelf: "flex-end" },
});
