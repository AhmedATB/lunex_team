import { useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ArrowRight, ChevronDown, ChevronLeft, ChevronRight, X } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  Modal,
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
import { ChapterGate } from "../../components/chapter-gate";
import { CommentSection } from "../../components/comments";
import { ProtectedPage } from "../../components/protected-page";
import { Button, ErrorState, Loading, Row, Txt } from "../../components/ui";
import { apiFetch, apiJson } from "../../lib/api";
import { chapterLabel, isLocked, seriesTitle, useLockRule, useSeriesDetail } from "../../lib/catalog";
import { recordRead } from "../../lib/library";
import { useSession } from "../../lib/session";
import type { Chapter } from "../../lib/types";
import { useWallet } from "../../lib/wallet";
import { colors, panel, radius } from "../../theme";

/** Pages this far either side of what is on screen are fetched ahead, so scrolling rarely meets a blank page. */
const LOOKAHEAD = 3;
const READS_EVERYTHING = new Set(["uploader", "editor", "super_administrator", "owner"]);

/** The site's reader/chapter-end-nav.tsx: what this is, previous / next, back to the work. */
function ChapterEndNav({ label, title, teamName, prev, next, onGo, slug }: { label: string; title: string; teamName?: string; prev?: Chapter; next?: Chapter; onGo: (c?: Chapter) => void; slug: string }) {
  return (
    <View style={{ paddingHorizontal: 16, paddingVertical: 32, gap: 12, backgroundColor: colors.bg }}>
      <Txt size={12} color={colors.muted} align="center" style={{ lineHeight: 20 }}>
        {label} من «{title}»{teamName ? ` — ترجمة فريق ${teamName}` : ""}
      </Txt>
      <Row gap={12}>
        {next ? (
          <Button size="lg" label="الفصل التالي" onPress={() => onGo(next)} style={{ flex: 1, height: 56 }} />
        ) : (
          <View style={[styles.lastBox, { flex: 1 }]}>
            <Txt size={14} color={colors.muted} align="center">
              هذا آخر فصل حتى الآن
            </Txt>
          </View>
        )}
        {prev ? <Button size="lg" variant="secondary" label="الفصل السابق" onPress={() => onGo(prev)} style={{ flex: 1, height: 56 }} /> : <View style={{ flex: 1 }} />}
      </Row>
      <Button label="العودة إلى صفحة العمل" variant="ghost" onPress={() => router.dismissTo({ pathname: "/series/[slug]", params: { slug } })} />
    </View>
  );
}

/** A novel chapter: plain Arabic text, paragraphs separated by blank lines (the site's novel-viewer, sepia off). */
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

/** The site's reader (app/(reader)/series/[slug]/[chapter]): the toolbar, the pages top to bottom, the end navigation and the chapter's comments. */
export default function ReaderScreen() {
  const params = useLocalSearchParams<{ chapterId: string; slug: string; number?: string }>();
  const { slug } = params;
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { status, user } = useSession();
  const { data, isLoading, isError, refetch } = useSeriesDetail(slug);
  const rule = useLockRule();
  const { data: wallet } = useWallet();
  const [chrome, setChrome] = useState(true);
  const [picker, setPicker] = useState(false);
  const [visible, setVisible] = useState({ first: 0, last: 2 });
  const [blocked, setBlocked] = useState<string | null>(null);
  const completedRef = useRef(false);
  const lastSentRef = useRef({ at: 0, fraction: 0 });

  const ordered = useMemo(() => [...(data?.chapters ?? [])].sort((a, b) => a.number - b.number), [data]);
  const index =
    params.chapterId === "by-number" ? ordered.findIndex((c) => String(c.number) === params.number) : ordered.findIndex((c) => c.id === params.chapterId);
  const chapter = ordered[index];
  const prev = index > 0 ? ordered[index - 1] : undefined;
  const next = index >= 0 && index < ordered.length - 1 ? ordered[index + 1] : undefined;
  const pages = useMemo(() => Array.from({ length: chapter?.pages ?? 0 }, (_, i) => i + 1), [chapter?.pages]);

  useEffect(() => {
    setBlocked(null);
    completedRef.current = false;
    setVisible({ first: 0, last: 2 });
  }, [chapter?.id]);

  // Signing in or opening the chapter from the lock screen: try the pages again.
  useEffect(() => {
    setBlocked(null);
  }, [status, wallet?.unlockedChapterIds.length]);

  // Remember it (furthest chapter per work, like the site), and count the view (one per reader per chapter per day on the server).
  useEffect(() => {
    if (!chapter || !data) return;
    void recordRead(data.series.id, chapter.number);
    apiFetch(`/api/catalog/chapters/${encodeURIComponent(chapter.id)}/view`, { method: "POST" }).catch(() => {});
  }, [chapter, data]);

  // The last page came into view: the chapter is read (the site counts the bottom of the pages, not of the comments under them).
  useEffect(() => {
    if (status !== "signedIn" || !chapter || pages.length === 0 || completedRef.current) return;
    if (visible.last >= pages.length - 1) {
      completedRef.current = true;
      apiFetch("/api/me/reading/complete", { method: "POST", body: JSON.stringify({ chapterId: chapter.id }) }).catch(() => {});
    }
  }, [visible.last, pages.length, status, chapter]);

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

  function onScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    if (status !== "signedIn" || !chapter) return;
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    const scrollable = contentSize.height - layoutMeasurement.height;
    if (scrollable <= 0) return;
    const fraction = Math.min(1, Math.max(0, contentOffset.y / scrollable));
    const now = Date.now();
    const last = lastSentRef.current;
    if (now - last.at > 2_500 && Math.abs(fraction - last.fraction) > 0.02) {
      lastSentRef.current = { at: now, fraction };
      apiFetch("/api/me/reading/position", { method: "PUT", body: JSON.stringify({ chapterId: chapter.id, fraction }) }).catch(() => {});
    }
  }

  if (isLoading) return <Loading />;
  if (isError || !data) return <ErrorState onRetry={refetch} />;
  if (!chapter) return <ErrorState message="لم يُعثر على هذا الفصل." />;

  const title = seriesTitle(data.series);
  const label = chapterLabel(chapter);
  const staff = Boolean(user && READS_EVERYTHING.has(user.role));
  const latestNumber = ordered.reduce((max, c) => Math.max(max, c.number), 0);
  const lockedByRule = isLocked(chapter, latestNumber, rule) && !(wallet?.unlockedChapterIds ?? []).includes(chapter.id) && !staff;
  const gated = lockedByRule || blocked === "locked" || blocked === "login_required";

  const toolbar = chrome && (
    <View style={[styles.toolbar, { paddingTop: insets.top + 8 }]}>
      <Row gap={8}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace({ pathname: "/series/[slug]", params: { slug } }))} hitSlop={8} style={{ flexShrink: 1 }}>
          <Row gap={4}>
            <ArrowRight size={16} color={colors.muted} />
            <Txt size={14} color={colors.muted} numberOfLines={1} style={{ maxWidth: 110 }}>
              {title}
            </Txt>
          </Row>
        </Pressable>
        <View style={{ flex: 1 }} />
        <Pressable disabled={!prev} onPress={() => goTo(prev)} style={[styles.iconBtn, !prev && { opacity: 0.4 }]}>
          <ChevronRight size={18} color={colors.text} />
        </Pressable>
        <Pressable onPress={() => setPicker(true)} style={styles.select}>
          <Row gap={6}>
            <Txt size={13} numberOfLines={1} style={{ flex: 1 }}>
              {label}
            </Txt>
            <ChevronDown size={14} color={colors.muted} />
          </Row>
        </Pressable>
        <Pressable disabled={!next} onPress={() => goTo(next)} style={[styles.iconBtn, !next && { opacity: 0.4 }]}>
          <ChevronLeft size={18} color={colors.text} />
        </Pressable>
      </Row>
    </View>
  );

  const pickerModal = (
    <Modal visible={picker} transparent animationType="fade" onRequestClose={() => setPicker(false)}>
      <Pressable style={styles.backdrop} onPress={() => setPicker(false)} />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 12 }]}>
        <Row style={{ justifyContent: "space-between", marginBottom: 8 }}>
          <Txt display size={18} weight="700">
            الفصول
          </Txt>
          <Pressable onPress={() => setPicker(false)} hitSlop={10}>
            <X size={20} color={colors.muted} />
          </Pressable>
        </Row>
        <FlatList
          data={[...ordered].reverse()}
          keyExtractor={(c) => c.id}
          initialScrollIndex={Math.max(0, ordered.length - 1 - index - 3)}
          getItemLayout={(_, i) => ({ length: 48, offset: 48 * i, index: i })}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => {
                setPicker(false);
                if (item.id !== chapter.id) goTo(item);
              }}
              style={[styles.pickRow, item.id === chapter.id && { backgroundColor: "rgba(109,40,217,0.25)" }]}
            >
              <Txt size={14} weight={item.id === chapter.id ? "700" : "400"} numberOfLines={1}>
                {chapterLabel(item)}
              </Txt>
            </Pressable>
          )}
        />
      </View>
    </Modal>
  );

  const footer = (
    <View>
      <ChapterEndNav label={label} title={title} teamName={data.team?.name} prev={prev} next={next} onGo={goTo} slug={slug} />
      <View style={{ paddingHorizontal: 16, paddingBottom: 48, backgroundColor: colors.bg }}>
        <CommentSection seriesId={data.series.id} chapterId={chapter.id} title="تعليقات الفصل" />
      </View>
    </View>
  );

  if (gated) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top + 56 }}>
        <ChapterGate
          chapterId={chapter.id}
          chapterNumber={chapter.number}
          seriesTitle={title}
          seriesSlug={slug}
          wallet={wallet}
          signedIn={status === "signedIn"}
        />
        {toolbar}
        {pickerModal}
      </View>
    );
  }

  if (chapter.hasContent || data.series.type === "novel") {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <StatusBar hidden={!chrome} />
        <NovelChapter chapterId={chapter.id} header={<View style={{ height: insets.top + 72 }} />} footer={footer} />
        {toolbar}
        {pickerModal}
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#09090B" }}>
      <StatusBar hidden={!chrome} />
      <FlatList
        data={pages}
        keyExtractor={(p) => String(p)}
        ListHeaderComponent={<View style={{ height: chrome ? insets.top + 56 : 0 }} />}
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
        ListFooterComponent={footer}
      />
      {toolbar}
      {pickerModal}
    </View>
  );
}

const styles = StyleSheet.create({
  toolbar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 12,
    paddingBottom: 8,
    backgroundColor: "rgba(9,9,11,0.92)",
    borderBottomWidth: 1,
    borderBottomColor: colors.white10,
  },
  iconBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: radius.lg },
  select: {
    width: 150,
    height: 38,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "rgba(255,255,255,0.03)",
    paddingHorizontal: 10,
    justifyContent: "center",
  },
  lastBox: { height: 56, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.white10, alignItems: "center", justifyContent: "center", paddingHorizontal: 12 },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)" },
  sheet: { ...panel, maxHeight: "70%", borderBottomLeftRadius: 0, borderBottomRightRadius: 0, padding: 16, backgroundColor: colors.popover },
  pickRow: { height: 48, justifyContent: "center", paddingHorizontal: 12, borderRadius: radius.md },
});
