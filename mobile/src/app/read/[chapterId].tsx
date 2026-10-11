import Ionicons from "@expo/vector-icons/Ionicons";
import { useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ViewToken,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ProtectedPage } from "../../components/protected-page";
import { Button, ErrorState, Loading, Row, Txt } from "../../components/ui";
import { apiFetch, apiJson } from "../../lib/api";
import { chapterLabel, seriesTitle, useSeriesDetail } from "../../lib/catalog";
import { recordRead } from "../../lib/library";
import { useSession } from "../../lib/session";
import type { Chapter } from "../../lib/types";
import { colors, radius } from "../../theme";

/** Pages this far either side of what is on screen are fetched ahead, so scrolling rarely meets a blank page. */
const LOOKAHEAD = 3;

function ChapterEnd({ next, slug, onNext }: { next?: Chapter; slug: string; onNext: () => void }) {
  return (
    <View style={styles.end}>
      <Txt size={16} weight="800" style={{ textAlign: "center" }}>
        انتهى الفصل
      </Txt>
      {next ? (
        <Button label={`التالي: ${chapterLabel(next)}`} onPress={onNext} style={{ alignSelf: "stretch" }} />
      ) : (
        <Txt color={colors.muted} style={{ textAlign: "center" }}>
          هذا آخر فصل منشور حتى الآن.
        </Txt>
      )}
      <Button
        label="العودة إلى صفحة العمل"
        variant="ghost"
        onPress={() => router.dismissTo({ pathname: "/series/[slug]", params: { slug } })}
        style={{ alignSelf: "stretch" }}
      />
    </View>
  );
}

function Blocked({ reason, signedIn }: { reason: string; signedIn: boolean }) {
  const needsLogin = reason === "login_required" || (reason === "locked" && !signedIn);
  return (
    <View style={styles.blocked}>
      <Ionicons name="lock-closed" size={36} color={colors.warning} />
      <Txt size={17} weight="800" style={{ textAlign: "center" }}>
        {needsLogin ? "سجّل الدخول لقراءة هذا الفصل" : "هذا الفصل مقفل"}
      </Txt>
      <Txt color={colors.muted} style={{ textAlign: "center" }}>
        {needsLogin ? "هذا الفصل متاح للأعضاء فقط." : "هذا الفصل من أحدث الفصول وسيُفتح للجميع قريبًا."}
      </Txt>
      {needsLogin && <Button label="تسجيل الدخول" onPress={() => router.push("/login")} style={{ alignSelf: "stretch" }} />}
    </View>
  );
}

/** A novel chapter: plain Arabic text, paragraphs separated by blank lines. */
function NovelChapter({ chapterId, header, footer }: { chapterId: string; header: React.ReactNode; footer: React.ReactNode }) {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["chapter", chapterId],
    queryFn: () => apiJson<{ content: string | null }>(`/api/chapters/${encodeURIComponent(chapterId)}`),
  });
  if (isLoading) return <Loading />;
  if (isError) return <ErrorState onRetry={refetch} />;
  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
      {header}
      {(data?.content ?? "")
        .split(/\n\s*\n/)
        .filter(Boolean)
        .map((p, i) => (
          <Txt key={i} size={18} style={{ lineHeight: 34, paddingHorizontal: 20, marginBottom: 18 }}>
            {p.trim()}
          </Txt>
        ))}
      {footer}
    </ScrollView>
  );
}

export default function ReaderScreen() {
  const { chapterId, slug } = useLocalSearchParams<{ chapterId: string; slug: string }>();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { status } = useSession();
  const { data, isLoading, isError, refetch } = useSeriesDetail(slug);
  const [chrome, setChrome] = useState(true);
  const [visible, setVisible] = useState({ first: 0, last: 2 });
  const [blocked, setBlocked] = useState<string | null>(null);
  const completedRef = useRef(false);
  const lastSentRef = useRef({ at: 0, fraction: 0 });

  const ordered = useMemo(() => [...(data?.chapters ?? [])].sort((a, b) => a.number - b.number), [data]);
  const index = ordered.findIndex((c) => c.id === chapterId);
  const chapter = ordered[index];
  const prev = index > 0 ? ordered[index - 1] : undefined;
  const next = index >= 0 && index < ordered.length - 1 ? ordered[index + 1] : undefined;
  const pages = useMemo(() => Array.from({ length: chapter?.pages ?? 0 }, (_, i) => i + 1), [chapter?.pages]);

  // A new chapter (the screen is replaced, but be safe): start fresh.
  useEffect(() => {
    setBlocked(null);
    completedRef.current = false;
    setVisible({ first: 0, last: 2 });
  }, [chapterId]);

  // Signing in from the lock screen: try the pages again with the new session.
  useEffect(() => {
    setBlocked(null);
  }, [status]);

  // Remember it for "تابع القراءة", and count the view (one per reader per chapter per day on the server).
  useEffect(() => {
    if (!chapter || !data) return;
    void recordRead({
      seriesId: data.series.id,
      slug: data.series.slug,
      title: seriesTitle(data.series),
      cover: data.series.cover,
      chapterId: chapter.id,
      chapterNumber: chapter.number,
    });
    apiFetch(`/api/catalog/chapters/${encodeURIComponent(chapter.id)}/view`, { method: "POST" }).catch(() => {});
  }, [chapter, data]);

  const goTo = useCallback(
    (target?: Chapter) => {
      if (target) router.replace({ pathname: "/read/[chapterId]", params: { chapterId: target.id, slug } });
    },
    [slug],
  );

  const onViewable = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const indexes = viewableItems.map((v) => v.index ?? 0);
    if (indexes.length) setVisible({ first: Math.min(...indexes), last: Math.max(...indexes) });
  }).current;

  /** Where the reader is, for resuming on the site too; and the chapter's end, which the server may reward. */
  function onScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    if (status !== "signedIn" || !chapter) return;
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    const scrollable = contentSize.height - layoutMeasurement.height;
    if (scrollable <= 0) return;
    const fraction = Math.min(1, Math.max(0, contentOffset.y / scrollable));
    const now = Date.now();
    const last = lastSentRef.current;
    if (now - last.at > 4_000 && Math.abs(fraction - last.fraction) > 0.02) {
      lastSentRef.current = { at: now, fraction };
      apiFetch("/api/me/reading/position", { method: "PUT", body: JSON.stringify({ chapterId: chapter.id, fraction }) }).catch(() => {});
    }
    if (fraction > 0.97 && !completedRef.current) {
      completedRef.current = true;
      apiFetch("/api/me/reading/complete", { method: "POST", body: JSON.stringify({ chapterId: chapter.id }) }).catch(() => {});
    }
  }

  if (isLoading) return <Loading />;
  if (isError || !data) return <ErrorState onRetry={refetch} />;
  if (!chapter) return <ErrorState message="لم يُعثر على هذا الفصل." />;

  const title = chapterLabel(chapter);
  const topBar = chrome && (
    <View style={[styles.topBar, { paddingTop: insets.top + 6 }]}>
      <Row>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.barBtn}>
          <Ionicons name="arrow-forward" size={22} color={colors.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Txt size={12} color={colors.muted} numberOfLines={1}>
            {seriesTitle(data.series)}
          </Txt>
          <Txt weight="700" numberOfLines={1}>
            {title}
          </Txt>
        </View>
      </Row>
    </View>
  );
  const bottomBar = chrome && (
    <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 8 }]}>
      <Row style={{ justifyContent: "space-between" }}>
        <Pressable disabled={!prev} onPress={() => goTo(prev)} style={[styles.navBtn, !prev && { opacity: 0.35 }]}>
          <Row gap={4}>
            <Ionicons name="chevron-forward" size={18} color={colors.text} />
            <Txt size={13}>السابق</Txt>
          </Row>
        </Pressable>
        <Txt size={12} color={colors.muted}>
          {pages.length ? `${Math.min(visible.last + 1, pages.length)} / ${pages.length}` : ""}
        </Txt>
        <Pressable disabled={!next} onPress={() => goTo(next)} style={[styles.navBtn, !next && { opacity: 0.35 }]}>
          <Row gap={4}>
            <Txt size={13}>التالي</Txt>
            <Ionicons name="chevron-back" size={18} color={colors.text} />
          </Row>
        </Pressable>
      </Row>
    </View>
  );

  const footer = <ChapterEnd next={next} slug={slug} onNext={() => goTo(next)} />;

  if (chapter.hasContent || data.series.type === "novel") {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <StatusBar hidden={!chrome} />
        <NovelChapter chapterId={chapter.id} header={<View style={{ height: insets.top + 80 }} />} footer={footer} />
        {topBar}
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      <StatusBar hidden={!chrome} />
      {blocked ? (
        <Blocked reason={blocked} signedIn={status === "signedIn"} />
      ) : (
        <FlatList
          data={pages}
          keyExtractor={(p) => String(p)}
          renderItem={({ item, index: i }) => (
            <Pressable onPress={() => setChrome((c) => !c)}>
              <ProtectedPage
                chapterId={chapter.id}
                pageNumber={item}
                width={width}
                active={i >= visible.first - LOOKAHEAD && i <= visible.last + LOOKAHEAD}
                onBlocked={setBlocked}
              />
            </Pressable>
          )}
          onViewableItemsChanged={onViewable}
          viewabilityConfig={{ itemVisiblePercentThreshold: 1 }}
          onScroll={onScroll}
          scrollEventThrottle={250}
          initialNumToRender={3}
          windowSize={9}
          removeClippedSubviews
          ListFooterComponent={footer}
        />
      )}
      {topBar}
      {bottomBar}
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 12,
    paddingBottom: 10,
    backgroundColor: "rgba(9,9,11,0.92)",
  },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 12,
    paddingTop: 8,
    backgroundColor: "rgba(9,9,11,0.92)",
  },
  barBtn: { padding: 6 },
  navBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.surfaceRaised },
  end: { padding: 24, gap: 14, alignItems: "center", backgroundColor: colors.bg, paddingBottom: 120 },
  blocked: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 32, backgroundColor: colors.bg },
});
