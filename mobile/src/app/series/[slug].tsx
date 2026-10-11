import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import {
  ArrowDownUp,
  ArrowRight,
  Bookmark,
  BookOpen,
  Calendar,
  CheckCircle2,
  Eye,
  Heart,
  Lock,
  Search,
  Share2,
  Star,
  User as UserIcon,
} from "lucide-react-native";
import { useMemo, useState, type ReactNode } from "react";
import { Pressable, ScrollView, Share, StyleSheet, TextInput, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CommentSection } from "../../components/comments";
import { GUTTER } from "../../components/layout";
import { RatingWidget } from "../../components/rating-widget";
import { openChapter, SeriesCard } from "../../components/series-card";
import { Badge, Button, ErrorState, formatNumber, Loading, Panel, Row, Txt } from "../../components/ui";
import { apiJson } from "../../lib/api";
import { chapterLabel, isLocked, seriesTitle, timeAgo, useBootstrap, useLockRule, useSeriesDetail } from "../../lib/catalog";
import { absolute, SITE_URL } from "../../lib/config";
import { toggleBookmark, useLibrary } from "../../lib/library";
import { useSession } from "../../lib/session";
import type { Chapter, Tag } from "../../lib/types";
import { useWallet } from "../../lib/wallet";
import { colors, panel, radius, STATUS_LABEL, TYPE_LABEL } from "../../theme";

interface ChapterProgress {
  fraction: number;
  finished: boolean;
}

/** Roles that read every chapter, locked or not (series/chapter-list.tsx `readsEverything`). */
const READS_EVERYTHING = new Set(["uploader", "editor", "super_administrator", "owner"]);

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

/** `.magic-divider`: a fading purple line with a glowing diamond in the middle. */
function MagicDivider() {
  return (
    <View style={{ height: 16, justifyContent: "center", marginHorizontal: GUTTER }}>
      <LinearGradient colors={["transparent", "rgba(168,85,247,0.5)", "transparent"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ height: 1 }} />
      <LinearGradient
        colors={["#c084fc", "#f0abfc"]}
        style={{ position: "absolute", alignSelf: "center", width: 8, height: 8, transform: [{ rotate: "45deg" }] }}
      />
    </View>
  );
}

function Stat({ icon, label, color = colors.muted }: { icon: ReactNode; label: string; color?: string }) {
  return (
    <Row gap={4}>
      {icon}
      <Txt size={14} weight={color === colors.amber300 ? "700" : "400"} color={color}>
        {label}
      </Txt>
    </Row>
  );
}

function InfoRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <Row style={[{ justifyContent: "space-between", gap: 8, paddingBottom: 8 }, !last && { borderBottomWidth: 1, borderBottomColor: colors.white5 }]}>
      <Txt size={14} color={colors.muted}>
        {label}
      </Txt>
      <Txt size={14} align="left" style={{ flex: 1 }}>
        {value}
      </Txt>
    </Row>
  );
}

/** The site's series page (app/(main)/series/[slug]/page.tsx), top to bottom. */
export default function SeriesScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { status, user } = useSession();
  const { data, isLoading, isError, refetch } = useSeriesDetail(slug);
  const { data: boot } = useBootstrap();
  const rule = useLockRule();
  const { data: wallet } = useWallet();
  const { data: progress } = useSeriesProgress(data?.series.id);
  const { bookmarks, progress: lastReadBySeries } = useLibrary();
  const [query, setQuery] = useState("");
  const [asc, setAsc] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const tags = useMemo(() => new Map<string, Tag>((boot?.tags ?? []).map((t) => [t.id, t])), [boot]);
  const chapters = useMemo(() => [...(data?.chapters ?? [])].sort((a, b) => b.number - a.number), [data]);
  const list = useMemo(() => {
    const items = chapters.filter((c) => c.number.toString().includes(query) || chapterLabel(c).includes(query));
    return asc ? [...items].reverse() : items;
  }, [chapters, query, asc]);

  if (isLoading) return <Loading />;
  if (isError || !data) return <ErrorState onRetry={refetch} />;

  const { series, team } = data;
  const lastRead = lastReadBySeries[series.id];
  const nextUnread = [...chapters].sort((a, b) => a.number - b.number).find((c) => lastRead === undefined || c.number > lastRead);
  const latest = chapters[0];
  const genres = series.genreIds.map((id) => tags.get(id)).filter((t): t is Tag => Boolean(t));
  const latestNumber = chapters.reduce((max, c) => Math.max(max, c.number), 0);
  const opened = new Set(wallet?.unlockedChapterIds ?? []);
  const readsEverything = Boolean(user && READS_EVERYTHING.has(user.role));
  const related = (boot?.series ?? [])
    .filter((s) => s.id !== series.id && s.genreIds.includes(series.genreIds[0]))
    .sort((a, b) => b.bookmarks - a.bookmarks)
    .slice(0, 6);
  const saved = bookmarks.includes(series.id);
  const cardWidth = (width - GUTTER * 2 - 16) / 2;

  const chapterRow = (c: Chapter, isLast: boolean) => {
    const locked = isLocked(c, latestNumber, rule) && !opened.has(c.id) && !readsEverything;
    const p = progress?.[c.id];
    const finished = Boolean(p?.finished);
    const inProgress = !finished && (p?.fraction ?? 0) >= 0.02;
    const current = lastRead === c.number;
    return (
      <Pressable
        key={c.id}
        onPress={() => openChapter(series.slug, c.id)}
        style={({ pressed }) => [
          styles.chapterRow,
          !isLast && { borderBottomWidth: 1, borderBottomColor: colors.white5 },
          (pressed || current) && { backgroundColor: "rgba(109,40,217,0.12)" },
          current && { borderRightWidth: 2, borderRightColor: colors.primary400 },
        ]}
      >
        <Row gap={12}>
          {c.thumbnail ? <Image source={absolute(c.thumbnail)} style={styles.thumb} contentFit="cover" /> : null}
          <View style={{ flex: 1, gap: 2 }}>
            <Row gap={6}>
              {locked && <Lock size={14} color={colors.amber300} />}
              {finished && <CheckCircle2 size={14} color={colors.primary400} />}
              <Txt size={14} weight="500" numberOfLines={1} style={{ flexShrink: 1 }}>
                {chapterLabel(c)}
              </Txt>
              {inProgress && (
                <Txt size={10} weight="700" color={colors.primary300}>
                  {Math.round((p?.fraction ?? 0) * 100)}٪
                </Txt>
              )}
              {current && (
                <View style={styles.lastRead}>
                  <Txt size={10} color={colors.primary300}>
                    آخر قراءة
                  </Txt>
                </View>
              )}
            </Row>
            <Txt size={12} color={colors.muted}>
              {timeAgo(c.releasedAt)}
            </Txt>
          </View>
          <Row gap={4}>
            <Eye size={14} color={colors.muted} />
            <Txt size={12} color={colors.muted}>
              {formatNumber(c.views)}
            </Txt>
          </Row>
        </Row>
        {inProgress && (
          <View style={styles.progressTrack}>
            <LinearGradient
              colors={[colors.primary600, colors.primary300]}
              start={{ x: 1, y: 0 }}
              end={{ x: 0, y: 0 }}
              style={{ height: 2, width: `${Math.round((p?.fraction ?? 0) * 100)}%`, alignSelf: "flex-end" }}
            />
          </View>
        )}
      </Pressable>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 48 }}>
        <View style={{ height: 256, overflow: "hidden" }}>
          <Image source={absolute(series.banner || series.cover)} style={[StyleSheet.absoluteFill, { transform: [{ scale: 1.08 }] }]} contentFit="cover" />
          <LinearGradient colors={["rgba(9,9,11,0.3)", "rgba(9,9,11,0.7)", "#09090B"]} style={StyleSheet.absoluteFill} />
          <LinearGradient colors={["rgba(109,40,217,0.35)", "transparent"]} start={{ x: 0.9, y: 0 }} end={{ x: 0.3, y: 0.7 }} style={StyleSheet.absoluteFill} />
        </View>

        <View style={{ marginTop: -96, paddingHorizontal: GUTTER, gap: 24 }}>
          <View style={styles.cover}>
            <Image source={absolute(series.cover)} style={{ width: "100%", aspectRatio: 2 / 3 }} contentFit="cover" />
          </View>

          <View style={{ gap: 12 }}>
            <Row gap={8} style={{ flexWrap: "wrap" }}>
              {series.status !== "ongoing" && <Badge label={STATUS_LABEL[series.status] ?? series.status} />}
              <Badge label={TYPE_LABEL[series.type] ?? series.type} variant="secondary" />
              {genres.slice(0, 4).map((g) => (
                <Badge key={g.id} label={g.nameAr || g.name} variant="outline" />
              ))}
            </Row>
            <Txt display size={24} weight="900" style={{ lineHeight: 34 }}>
              {seriesTitle(series)}
            </Txt>
            {series.title.trim().toLowerCase() !== series.titleAr.trim().toLowerCase() && (
              <Txt size={14} color={colors.muted}>
                {series.title}
              </Txt>
            )}
            <Row gap={16} style={{ flexWrap: "wrap", rowGap: 6 }}>
              <Stat
                icon={<Star size={16} color={colors.amber300} fill={colors.amber300} />}
                label={`${series.ratingCount > 0 ? series.rating.toFixed(1) : "—"} (${formatNumber(series.ratingCount)} تقييم)`}
                color={colors.amber300}
              />
              <Stat icon={<Eye size={16} color={colors.muted} />} label={`${formatNumber(series.views)} مشاهدة`} />
              <Stat icon={<Bookmark size={16} color={colors.muted} />} label={`${formatNumber(series.bookmarks)} مفضلة`} />
              <Stat icon={<Heart size={16} color={colors.muted} />} label={`${formatNumber(series.likes)} إعجاب`} />
              <Stat icon={<Calendar size={16} color={colors.muted} />} label={String(series.year)} />
              {series.author?.trim() ? <Stat icon={<UserIcon size={16} color={colors.muted} />} label={series.author} /> : null}
            </Row>
            <Pressable onPress={() => setExpanded((e) => !e)}>
              <Txt size={14} color={colors.muted} numberOfLines={expanded ? undefined : 6} style={{ lineHeight: 24 }}>
                {series.synopsis.trim()}
              </Txt>
            </Pressable>

            <View style={{ gap: 8, paddingTop: 8 }}>
              {nextUnread && (
                <Button
                  size="lg"
                  label={lastRead === undefined ? "ابدأ من الفصل الأول" : `أكمل من الفصل ${nextUnread.number}`}
                  icon={<BookOpen size={16} color={colors.text} />}
                  onPress={() => openChapter(series.slug, nextUnread.id)}
                />
              )}
              <Row gap={8}>
                {latest && (
                  <Button
                    size="lg"
                    variant={nextUnread ? "secondary" : "default"}
                    label={`أحدث فصل (${latest.number})`}
                    onPress={() => openChapter(series.slug, latest.id)}
                    style={{ flex: 1 }}
                  />
                )}
                {status === "signedIn" && (
                  <Button
                    size="lg"
                    variant="secondary"
                    icon={<Bookmark size={18} color={saved ? colors.primary300 : colors.text} fill={saved ? colors.primary300 : "transparent"} />}
                    onPress={() => toggleBookmark(series.id)}
                    style={{ width: 48 }}
                  />
                )}
                <Button
                  size="lg"
                  variant="secondary"
                  icon={<Share2 size={18} color={colors.text} />}
                  onPress={() => Share.share({ message: `${seriesTitle(series)} — ${SITE_URL}/series/${series.slug}` })}
                  style={{ width: 48 }}
                />
              </Row>
            </View>

            {status !== "signedIn" && (
              <Panel style={{ padding: 16, gap: 8, backgroundColor: "rgba(255,255,255,0.03)" }}>
                <Row gap={8} style={{ alignItems: "flex-start" }}>
                  <Lock size={16} color={colors.primary300} />
                  <Txt size={14} color={colors.muted} style={{ flex: 1, lineHeight: 22 }}>
                    تتصفح كزائر: تقرأ الفصول المفتوحة، أما الفصول المقفلة والمفضلة والتعليق والتقييم فللأعضاء.
                  </Txt>
                </Row>
                <Pressable onPress={() => router.push("/login")}>
                  <Txt size={14} weight="700" color={colors.primary300}>
                    تسجيل الدخول
                  </Txt>
                </Pressable>
              </Panel>
            )}

            {team && (
              <Row gap={8} style={{ flexWrap: "wrap" }}>
                <Pressable onPress={() => router.push({ pathname: "/teams/[slug]", params: { slug: team.slug } })} style={styles.teamChip}>
                  <Row gap={6}>
                    <Txt size={12} color={colors.muted}>
                      ترجمة فريق
                    </Txt>
                    <Txt size={12} weight="700" color={colors.primary300}>
                      {team.name}
                    </Txt>
                  </Row>
                </Pressable>
                {team.recruiting && (
                  <View style={styles.recruiting}>
                    <Txt size={12} weight="700" color={colors.emerald300}>
                      يستقبل طلبات انضمام
                    </Txt>
                  </View>
                )}
              </Row>
            )}

            {series.tags.length > 0 && (
              <Row gap={6} style={{ flexWrap: "wrap" }}>
                {series.tags.map((tag) => (
                  <View key={tag} style={styles.hashTag}>
                    <Txt size={11} color={colors.muted}>
                      #{tag}
                    </Txt>
                  </View>
                ))}
              </Row>
            )}
          </View>
        </View>

        <View style={{ marginVertical: 32 }}>
          <MagicDivider />
        </View>

        <View style={{ paddingHorizontal: GUTTER, gap: 24 }}>
          <View style={{ gap: 12 }}>
            <Txt display size={20} weight="700">
              الفصول ({chapters.length})
            </Txt>
            <Row gap={8}>
              <Row gap={8} style={styles.search}>
                <Search size={16} color={colors.muted} />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder="ابحث عن رقم الفصل..."
                  placeholderTextColor={colors.muted}
                  style={styles.searchInput}
                />
              </Row>
              <Button variant="secondary" icon={<ArrowDownUp size={16} color={colors.text} />} onPress={() => setAsc((v) => !v)} style={{ width: 44, height: 44 }} />
            </Row>
            <View style={[panel, { overflow: "hidden" }]}>
              {list.map((c, i) => chapterRow(c, i === list.length - 1))}
              {list.length === 0 && (
                <Txt size={14} color={colors.muted} align="center" style={{ padding: 24 }}>
                  لا توجد فصول مطابقة.
                </Txt>
              )}
            </View>
          </View>

          <CommentSection seriesId={series.id} />

          <RatingWidget seriesId={series.id} rating={series.rating} ratingCount={series.ratingCount} />

          <Panel style={{ padding: 16, gap: 8 }}>
            <Txt display size={14} weight="700" style={{ marginBottom: 8 }}>
              معلومات إضافية
            </Txt>
            <InfoRow label="الرسّام" value={series.artist ?? ""} />
            <InfoRow label="سنة الإصدار" value={String(series.year)} />
            <InfoRow label="عدد الفصول" value={String(series.chapterCount)} />
            <InfoRow label="العناوين البديلة" value={series.alternativeTitles.join("، ")} last />
          </Panel>
        </View>

        {related.length > 0 && (
          <>
            <View style={{ marginVertical: 32 }}>
              <MagicDivider />
            </View>
            <View style={{ gap: 16 }}>
              <Txt display size={20} weight="700" style={{ paddingHorizontal: GUTTER }}>
                أعمال مشابهة
              </Txt>
              <View style={{ flexDirection: "row-reverse", flexWrap: "wrap", gap: 16, paddingHorizontal: GUTTER }}>
                {related.map((s) => (
                  <SeriesCard key={s.id} series={s} tags={tags} width={cardWidth} />
                ))}
              </View>
            </View>
          </>
        )}
      </ScrollView>

      <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} style={[styles.back, { top: insets.top + 8 }]} hitSlop={8}>
        <ArrowRight size={20} color={colors.text} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  cover: {
    width: 160,
    alignSelf: "flex-end",
    borderRadius: radius["2xl"],
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.white10,
    backgroundColor: colors.card,
  },
  chapterRow: { paddingHorizontal: 16, paddingVertical: 12 },
  thumb: { width: 96, aspectRatio: 16 / 9, borderRadius: 6, borderWidth: 1, borderColor: colors.white10 },
  lastRead: { backgroundColor: "rgba(139,49,232,0.2)", borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 },
  progressTrack: { position: "absolute", left: 0, right: 0, bottom: 0, height: 2, backgroundColor: colors.white10 },
  search: {
    flex: 1,
    height: 44,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "rgba(255,255,255,0.03)",
    paddingHorizontal: 12,
  },
  searchInput: { flex: 1, color: colors.text, fontFamily: "Tajawal_400Regular", fontSize: 14, textAlign: "right" },
  teamChip: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "rgba(255,255,255,0.03)",
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  recruiting: { borderRadius: radius.pill, backgroundColor: "rgba(16,185,129,0.15)", paddingHorizontal: 10, paddingVertical: 4 },
  hashTag: { borderRadius: radius.pill, backgroundColor: colors.white5, paddingHorizontal: 10, paddingVertical: 4 },
  back: {
    position: "absolute",
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
});
