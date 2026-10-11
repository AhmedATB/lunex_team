import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { router } from "expo-router";
import { CornerUpLeft, Lock, Send, ThumbsDown, ThumbsUp } from "lucide-react-native";
import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from "react-native";
import { apiFetch, apiJson, ApiError } from "../lib/api";
import { timeAgo } from "../lib/catalog";
import { SITE_URL } from "../lib/config";
import { useSession } from "../lib/session";
import { colors, panel, radius } from "../theme";
import { Row, Txt } from "./ui";

/** GET /api/comments?seriesId= */
interface CommentRow {
  id: string;
  parentId: string | null;
  chapterId: string | null;
  chapterNumber: number | null;
  content: string;
  isSpoiler: boolean;
  isPinned: boolean;
  createdAt: string;
  likes: number;
  dislikes: number;
  myReaction: "like" | "dislike" | null;
  author: { id: string; username: string; displayName: string | null; role: string; avatarVersion: string | null };
}

type Tab = "latest" | "top" | "chapters";
const TABS: { id: Tab; label: string }[] = [
  { id: "latest", label: "الأحدث" },
  { id: "top", label: "الأكثر" },
  { id: "chapters", label: "الفصول" },
];

export function Avatar({ user, size = 40 }: { user: { id: string; username: string; displayName?: string | null; avatarVersion: string | null }; size?: number }) {
  const style = { width: size, height: size, borderRadius: size / 2 };
  if (user.avatarVersion) {
    return (
      <Image
        source={`${SITE_URL}/api/users/${encodeURIComponent(user.id)}/avatar?v=${encodeURIComponent(user.avatarVersion)}`}
        style={[style, { borderWidth: 1, borderColor: colors.white10 }]}
      />
    );
  }
  return (
    <View style={[style, { backgroundColor: colors.primary600, alignItems: "center", justifyContent: "center" }]}>
      <Txt weight="800" size={size * 0.4}>
        {(user.displayName || user.username).slice(0, 1).toUpperCase()}
      </Txt>
    </View>
  );
}

function GuestNotice() {
  return (
    <View style={[panel, styles.guest]}>
      <Row gap={6} style={{ flexWrap: "wrap" }}>
        <Lock size={16} color={colors.primary300} />
        <Txt size={14} color={colors.muted}>
          التعليق للأعضاء فقط.
        </Txt>
        <Pressable onPress={() => router.push("/login")}>
          <Txt size={14} weight="700" color={colors.primary300}>
            تسجيل الدخول
          </Txt>
        </Pressable>
      </Row>
    </View>
  );
}

function Composer({ seriesId, chapterId, parentId, onDone, autoFocus }: { seriesId: string; chapterId?: string; parentId?: string; onDone?: () => void; autoFocus?: boolean }) {
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const post = useMutation({
    mutationFn: () =>
      apiJson("/api/comments", {
        method: "POST",
        body: JSON.stringify({ seriesId, content: text.trim(), ...(chapterId ? { chapterId } : {}), ...(parentId ? { parentId } : {}) }),
      }),
    onSuccess: () => {
      setText("");
      setError("");
      onDone?.();
      void queryClient.invalidateQueries({ queryKey: ["comments", seriesId] });
    },
    onError: (err) => setError(err instanceof ApiError && err.status === 403 ? "لا يمكنك التعليق الآن." : "تعذر نشر التعليق، حاول مرة أخرى."),
  });
  return (
    <View style={{ gap: 6 }}>
      <Row gap={8} style={[panel, styles.composer]}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder={parentId ? "اكتب ردًا…" : "اكتب تعليقًا…"}
          placeholderTextColor={colors.muted}
          style={styles.composerInput}
          multiline
          autoFocus={autoFocus}
          maxLength={2000}
        />
        <Pressable onPress={() => post.mutate()} disabled={!text.trim() || post.isPending} style={[styles.send, (!text.trim() || post.isPending) && { opacity: 0.5 }]}>
          {post.isPending ? <ActivityIndicator color={colors.text} size="small" /> : <Send size={18} color={colors.text} />}
        </Pressable>
      </Row>
      {error ? (
        <Txt size={12} color="#f87171">
          {error}
        </Txt>
      ) : null}
    </View>
  );
}

function CommentCard({ comment, replies, seriesId, depth = 0 }: { comment: CommentRow; replies: Map<string, CommentRow[]>; seriesId: string; depth?: number }) {
  const { status } = useSession();
  const queryClient = useQueryClient();
  const [revealed, setRevealed] = useState(!comment.isSpoiler);
  const [replying, setReplying] = useState(false);
  const [mine, setMine] = useState(comment.myReaction);
  const [counts, setCounts] = useState({ likes: comment.likes, dislikes: comment.dislikes });

  function react(kind: "like" | "dislike") {
    if (status !== "signedIn") return router.push("/login");
    const next = mine === kind ? null : kind;
    setCounts((c) => ({
      likes: c.likes + (next === "like" ? 1 : 0) - (mine === "like" ? 1 : 0),
      dislikes: c.dislikes + (next === "dislike" ? 1 : 0) - (mine === "dislike" ? 1 : 0),
    }));
    setMine(next);
    apiFetch(`/api/comments/${encodeURIComponent(comment.id)}/reaction`, { method: "PUT", body: JSON.stringify({ kind: next ?? "none" }) })
      .then((res) => {
        if (!res.ok) void queryClient.invalidateQueries({ queryKey: ["comments", seriesId] });
      })
      .catch(() => {});
  }

  const name = comment.author.displayName || comment.author.username;
  const children = replies.get(comment.id) ?? [];
  return (
    <View style={{ gap: 12 }}>
      <View style={[panel, { padding: 16, gap: 10 }, depth > 0 && { backgroundColor: "rgba(21,14,32,0.6)" }]}>
        <Row gap={12} style={{ alignItems: "flex-start" }}>
          <Avatar user={comment.author} size={depth > 0 ? 36 : 44} />
          <View style={{ flex: 1, gap: 4 }}>
            <Row gap={8} style={{ flexWrap: "wrap" }}>
              <Txt display size={15} weight="700">
                {name}
              </Txt>
              <Txt size={12} color={colors.muted}>
                {timeAgo(comment.createdAt)}
              </Txt>
              {comment.chapterNumber !== null && (
                <Txt size={11} weight="700" color={colors.primary300}>
                  الفصل {comment.chapterNumber}
                </Txt>
              )}
              {comment.isPinned && (
                <Txt size={11} weight="700" color={colors.amber300}>
                  مثبّت
                </Txt>
              )}
            </Row>
            {revealed ? (
              <Txt size={14} style={{ lineHeight: 22 }}>
                {comment.content}
              </Txt>
            ) : (
              <Pressable onPress={() => setRevealed(true)} style={styles.spoiler}>
                <Txt size={13} weight="700" color={colors.muted}>
                  حرق للأحداث — اضغط للعرض
                </Txt>
              </Pressable>
            )}
            <Row gap={16} style={{ marginTop: 4 }}>
              <Pressable onPress={() => react("like")} hitSlop={6}>
                <Row gap={4}>
                  <ThumbsUp size={16} color={mine === "like" ? colors.primary300 : colors.muted} />
                  <Txt size={13} color={mine === "like" ? colors.primary300 : colors.muted}>
                    {counts.likes}
                  </Txt>
                </Row>
              </Pressable>
              <Pressable onPress={() => react("dislike")} hitSlop={6}>
                <Row gap={4}>
                  <ThumbsDown size={16} color={mine === "dislike" ? colors.primary300 : colors.muted} />
                  <Txt size={13} color={mine === "dislike" ? colors.primary300 : colors.muted}>
                    {counts.dislikes}
                  </Txt>
                </Row>
              </Pressable>
              {depth === 0 && (
                <Pressable onPress={() => (status === "signedIn" ? setReplying((r) => !r) : router.push("/login"))} hitSlop={6}>
                  <Row gap={4}>
                    <CornerUpLeft size={16} color={colors.muted} />
                    <Txt size={13} color={colors.muted}>
                      رد
                    </Txt>
                  </Row>
                </Pressable>
              )}
            </Row>
          </View>
        </Row>
      </View>
      {replying && <Composer seriesId={seriesId} chapterId={comment.chapterId ?? undefined} parentId={comment.id} onDone={() => setReplying(false)} autoFocus />}
      {children.length > 0 && (
        <View style={{ marginRight: 24, gap: 12, borderRightWidth: 2, borderRightColor: colors.border, paddingRight: 12 }}>
          {children.map((c) => (
            <CommentCard key={c.id} comment={c} replies={replies} seriesId={seriesId} depth={depth + 1} />
          ))}
        </View>
      )}
    </View>
  );
}

/** The site's comment section (series/comment-section.tsx): heading with tabs, the composer (or a sign-in notice), the cards. */
export function CommentSection({ seriesId, chapterId, title = "التعليقات" }: { seriesId: string; chapterId?: string; title?: string }) {
  const { status } = useSession();
  const [tab, setTab] = useState<Tab>("latest");
  const { data, isLoading } = useQuery({
    queryKey: ["comments", seriesId, chapterId ?? null],
    queryFn: () =>
      apiJson<{ comments: CommentRow[] }>(
        `/api/comments?seriesId=${encodeURIComponent(seriesId)}${chapterId ? `&chapterId=${encodeURIComponent(chapterId)}` : ""}`,
      ),
  });

  const { roots, replies, total } = useMemo(() => {
    const all = data?.comments ?? [];
    const byParent = new Map<string, CommentRow[]>();
    for (const c of all) {
      if (!c.parentId) continue;
      const list = byParent.get(c.parentId) ?? [];
      list.push(c);
      byParent.set(c.parentId, list);
    }
    for (const list of byParent.values()) list.sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));
    let top = all.filter((c) => !c.parentId);
    if (tab === "chapters") top = top.filter((c) => c.chapterId);
    top.sort((a, b) =>
      tab === "top"
        ? Number(b.isPinned) - Number(a.isPinned) || b.likes - b.dislikes - (a.likes - a.dislikes)
        : Number(b.isPinned) - Number(a.isPinned) || +new Date(b.createdAt) - +new Date(a.createdAt),
    );
    return { roots: top, replies: byParent, total: all.length };
  }, [data, tab]);

  return (
    <View style={{ gap: 16 }}>
      <Row style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <Txt display size={20} weight="700">
          {title} ({total})
        </Txt>
        {!chapterId && (
          <Row gap={4} style={styles.tabs}>
            {TABS.map((t) => (
              <Pressable key={t.id} onPress={() => setTab(t.id)} style={[styles.tab, tab === t.id && styles.tabActive]}>
                <Txt size={13} weight="700" color={tab === t.id ? colors.text : colors.muted}>
                  {t.label}
                </Txt>
              </Pressable>
            ))}
          </Row>
        )}
      </Row>
      {status === "signedIn" ? <Composer seriesId={seriesId} chapterId={chapterId} /> : <GuestNotice />}
      {isLoading ? (
        <ActivityIndicator color={colors.primary400} />
      ) : roots.length === 0 ? (
        <Txt size={14} color={colors.muted} align="center" style={{ paddingVertical: 16 }}>
          لا توجد تعليقات بعد. كن أول من يعلّق!
        </Txt>
      ) : (
        roots.map((c) => <CommentCard key={c.id} comment={c} replies={replies} seriesId={seriesId} />)
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  guest: { padding: 16 },
  composer: { padding: 8, paddingRight: 14, alignItems: "flex-end" },
  composerInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 140,
    color: colors.text,
    fontFamily: "Tajawal_400Regular",
    fontSize: 14,
    textAlign: "right",
    writingDirection: "rtl",
    paddingVertical: 8,
  },
  send: { width: 40, height: 40, borderRadius: radius.lg, backgroundColor: colors.primary600, alignItems: "center", justifyContent: "center" },
  spoiler: { backgroundColor: "rgba(255,255,255,0.06)", borderRadius: radius.md, padding: 10 },
  tabs: { borderRadius: radius.pill, borderWidth: 1, borderColor: colors.white10, backgroundColor: "rgba(255,255,255,0.03)", padding: 4 },
  tab: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: radius.pill },
  tabActive: { backgroundColor: "rgba(109,40,217,0.45)" },
});
