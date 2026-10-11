import { useQuery } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { Bell, Bookmark, BookOpen, ChevronLeft, Flame, Globe, Lock, LogOut, MessageSquare, Send, ShieldCheck, FileText, type LucideIcon } from "lucide-react-native";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { AppHeader } from "../../components/app-header";
import { Avatar } from "../../components/comments";
import { GUTTER } from "../../components/layout";
import { SeriesCard } from "../../components/series-card";
import { SignInRequired } from "../../components/signin-required";
import { Badge, Button, formatNumber, Loading, Panel, Row, Txt } from "../../components/ui";
import { ACHIEVEMENTS, type AchievementMetric } from "../../lib/achievements";
import { apiJson } from "../../lib/api";
import { timeAgo, useBootstrap } from "../../lib/catalog";
import { SITE_URL } from "../../lib/config";
import { useLibrary } from "../../lib/library";
import { useSession } from "../../lib/session";
import type { Tag } from "../../lib/types";
import { colors, lunexGradient, radius } from "../../theme";

const DISCORD_URL = "https://discord.gg/KSbdfBqNrE";
const TELEGRAM_URL = "https://t.me/lunex_team";

/** lib/rbac.ts GLOBAL_ROLE_LABELS */
const ROLE_LABELS: Record<string, string> = {
  guest: "زائر",
  reader: "قارئ",
  verified_member: "عضو موثّق",
  uploader: "رافع فصول",
  moderator: "مشرف",
  support: "دعم فني",
  news_manager: "مسؤول أخبار",
  editor: "محرر",
  global_team_manager: "مدير فرق عام",
  super_administrator: "مسؤول أعلى",
  owner: "المالك",
};

/** GET /api/me/progress — level, experience, streaks, counts and earned achievements (the server's numbers). */
interface Progress {
  xp: number;
  level: number;
  xpIntoLevel: number;
  levelSpan: number;
  streak: number;
  bestStreak: number;
  chaptersRead: number;
  comments: number;
  bookmarks: number;
  todayXp: number;
  dailyCap: number;
  achievements: string[];
}

interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  createdAt: string;
}

type Tab = "history" | "bookmarks" | "achievements" | "notifications";
const TABS: { id: Tab; label: string }[] = [
  { id: "history", label: "سجل القراءة" },
  { id: "bookmarks", label: "المفضلة" },
  { id: "achievements", label: "الإنجازات" },
  { id: "notifications", label: "الإشعارات" },
];

function Stat({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: number }) {
  return (
    <Panel style={{ flex: 1, alignItems: "center", gap: 2, paddingVertical: 12, paddingHorizontal: 4 }}>
      <Icon size={16} color={colors.primary300} />
      <Txt display size={14} weight="700" align="center">
        {formatNumber(value)}
      </Txt>
      <Txt size={10} color={colors.muted} align="center">
        {label}
      </Txt>
    </Panel>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <Panel style={{ padding: 40 }}>
      <Txt color={colors.muted} align="center">
        {text}
      </Txt>
    </Panel>
  );
}

function LinkRow({ icon: Icon, label, onPress, danger }: { icon: LucideIcon; label: string; onPress: () => void; danger?: boolean }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.linkRow, pressed && { backgroundColor: "rgba(109,40,217,0.12)" }]}>
      <Row gap={12}>
        <Icon size={18} color={danger ? "#f87171" : colors.primary300} />
        <Txt size={14} color={danger ? "#f87171" : colors.text} style={{ flex: 1 }}>
          {label}
        </Txt>
        {!danger && <ChevronLeft size={16} color={colors.muted} />}
      </Row>
    </Pressable>
  );
}

/** The site's /profile for the signed-in reader, with the links the site keeps in its header menu and footer. */
export default function AccountScreen() {
  const { width } = useWindowDimensions();
  const { status, user, logout } = useSession();
  const { data: boot } = useBootstrap();
  const { bookmarks, progress: readProgress, readAt } = useLibrary();
  const [tab, setTab] = useState<Tab>("history");
  const signedIn = status === "signedIn";

  const { data: progress } = useQuery({ queryKey: ["progress"], queryFn: () => apiJson<Progress>("/api/me/progress"), enabled: signedIn });
  const { data: notifications, isLoading: notifLoading } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => apiJson<{ items: AppNotification[] }>("/api/notifications").then((b) => b.items ?? []),
    enabled: signedIn && tab === "notifications",
  });

  const tags = useMemo(() => new Map<string, Tag>((boot?.tags ?? []).map((t) => [t.id, t])), [boot]);
  const seriesById = useMemo(() => new Map((boot?.series ?? []).map((s) => [s.id, s])), [boot]);
  const history = Object.entries(readProgress)
    .sort(([a], [b]) => (readAt[b] ?? "").localeCompare(readAt[a] ?? ""))
    .flatMap(([id, chapter]) => {
      const s = seriesById.get(id);
      return s ? [{ series: s, chapter }] : [];
    });
  const saved = (boot?.series ?? []).filter((s) => bookmarks.includes(s.id));
  const cardWidth = (width - GUTTER * 2 - 16) / 2;
  const earned = new Set(progress?.achievements ?? []);
  const values: Record<AchievementMetric, number> = {
    chaptersRead: progress?.chaptersRead ?? 0,
    comments: progress?.comments ?? 0,
    bookmarks: progress?.bookmarks ?? bookmarks.length,
    streak: progress?.bestStreak ?? 0,
    level: progress?.level ?? 1,
  };

  const links = (
    <Panel style={{ overflow: "hidden" }}>
      <LinkRow icon={MessageSquare} label="سيرفر Discord" onPress={() => WebBrowser.openBrowserAsync(DISCORD_URL)} />
      <LinkRow icon={Send} label="قناة Telegram" onPress={() => WebBrowser.openBrowserAsync(TELEGRAM_URL)} />
      <LinkRow icon={Globe} label="الموقع" onPress={() => WebBrowser.openBrowserAsync(SITE_URL)} />
      <LinkRow icon={ShieldCheck} label="سياسة الخصوصية" onPress={() => WebBrowser.openBrowserAsync(`${SITE_URL}/privacy`)} />
      <LinkRow icon={FileText} label="شروط الاستخدام" onPress={() => WebBrowser.openBrowserAsync(`${SITE_URL}/terms`)} />
      {signedIn && <LinkRow icon={LogOut} label="تسجيل الخروج" onPress={logout} danger />}
    </Panel>
  );

  if (status === "loading") {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <AppHeader />
        <Loading />
      </View>
    );
  }

  if (!signedIn || !user) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <AppHeader />
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
          <SignInRequired text="سجّل الدخول لترى ملفك: مستواك وإنجازاتك وسجل قراءتك ومفضلتك وإشعاراتك." />
          <View style={{ paddingHorizontal: GUTTER }}>{links}</View>
        </ScrollView>
      </View>
    );
  }

  const name = user.displayName || user.username;
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <AppHeader />
      <ScrollView contentContainerStyle={{ padding: GUTTER, paddingTop: 24, gap: 24, paddingBottom: 40 }}>
        <Panel style={{ overflow: "hidden", padding: 24, alignItems: "center", gap: 14 }}>
          <LinearGradient {...lunexGradient} style={[StyleSheet.absoluteFill, { height: 96, opacity: 0.2 }]} />
          <View style={styles.avatarRing}>
            <Avatar user={user} size={96} />
          </View>
          <View style={{ alignItems: "center", gap: 6 }}>
            <Row gap={8} style={{ flexWrap: "wrap", justifyContent: "center" }}>
              <Txt display size={24} weight="700" align="center">
                {name}
              </Txt>
              <Badge label={ROLE_LABELS[user.role] ?? user.role} />
            </Row>
            <Txt size={14} color={colors.muted}>
              @{user.username}
            </Txt>
            {user.bio ? (
              <Txt size={14} color={colors.muted} align="center">
                {user.bio}
              </Txt>
            ) : null}
          </View>
          <View style={{ alignSelf: "stretch", gap: 4 }}>
            <Row style={{ justifyContent: "space-between" }}>
              <Txt size={12} color={colors.muted}>
                المستوى {progress?.level ?? 1}
              </Txt>
              <Txt size={12} color={colors.muted}>
                {progress?.xpIntoLevel ?? 0}/{progress?.levelSpan ?? 100} XP
              </Txt>
            </Row>
            <View style={styles.track}>
              <LinearGradient
                {...lunexGradient}
                style={{ height: 8, width: `${progress ? Math.min(100, (progress.xpIntoLevel / progress.levelSpan) * 100) : 0}%`, alignSelf: "flex-end" }}
              />
            </View>
            {progress && (
              <Row style={{ justifyContent: "space-between" }}>
                <Txt size={11} color="rgba(161,161,170,0.8)">
                  {formatNumber(progress.xp)} XP في المجموع
                </Txt>
                <Txt size={11} color="rgba(161,161,170,0.8)">
                  اليوم {progress.todayXp}/{progress.dailyCap}
                </Txt>
              </Row>
            )}
          </View>
          <Row gap={8} style={{ alignSelf: "stretch" }}>
            <Stat icon={BookOpen} label="فصل مقروء" value={progress?.chaptersRead ?? 0} />
            <Stat icon={Flame} label="أيام متتالية" value={progress?.streak ?? 0} />
            <Stat icon={MessageSquare} label="تعليق" value={progress?.comments ?? 0} />
            <Stat icon={Bookmark} label="مفضلة" value={saved.length} />
          </Row>
          <Button label="إعدادات الحساب" variant="secondary" onPress={() => WebBrowser.openBrowserAsync(`${SITE_URL}/profile/settings`)} style={{ alignSelf: "stretch" }} />
        </Panel>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ transform: [{ scaleX: -1 }] }} contentContainerStyle={styles.tabs}>
          {TABS.map((t) => (
            <Pressable key={t.id} onPress={() => setTab(t.id)} style={[styles.tab, tab === t.id && styles.tabActive, { transform: [{ scaleX: -1 }] }]}>
              <Txt size={13} weight="700" color={tab === t.id ? colors.text : colors.muted}>
                {t.label}
              </Txt>
            </Pressable>
          ))}
        </ScrollView>

        {tab === "history" &&
          (history.length === 0 ? (
            <Empty text="لم تبدأ القراءة بعد، اختر سلسلة وابدأ رحلتك!" />
          ) : (
            <View style={{ flexDirection: "row-reverse", flexWrap: "wrap", gap: 16 }}>
              {history.map(({ series, chapter }) => (
                <View key={series.id}>
                  <SeriesCard series={series} tags={tags} width={cardWidth} />
                  <Badge label={`الفصل ${chapter}`} style={{ position: "absolute", top: 8, right: 8 }} />
                </View>
              ))}
            </View>
          ))}

        {tab === "bookmarks" &&
          (saved.length === 0 ? (
            <Empty text="قائمة مفضلتك فارغة حاليًا." />
          ) : (
            <View style={{ flexDirection: "row-reverse", flexWrap: "wrap", gap: 16 }}>
              {saved.map((s) => (
                <SeriesCard key={s.id} series={s} tags={tags} width={cardWidth} />
              ))}
            </View>
          ))}

        {tab === "achievements" && (
          <View style={{ flexDirection: "row-reverse", flexWrap: "wrap", gap: 12 }}>
            {ACHIEVEMENTS.map((a) => {
              const unlocked = earned.has(a.id);
              const value = values[a.metric];
              const pct = Math.min(100, Math.round((value / a.target) * 100));
              const Icon = a.icon;
              return (
                <Panel
                  key={a.id}
                  style={[
                    { width: (width - GUTTER * 2 - 12) / 2, padding: 16, alignItems: "center", gap: 8 },
                    unlocked ? { borderColor: "rgba(168,85,247,0.4)" } : { opacity: 0.6 },
                  ]}
                >
                  <View style={[styles.badgeIcon, unlocked && { backgroundColor: colors.primary600 }]}>
                    {unlocked ? <Icon size={24} color={colors.text} /> : <Lock size={20} color={colors.muted} />}
                  </View>
                  <Txt size={14} weight="700" align="center">
                    {a.title}
                  </Txt>
                  <Txt size={12} color={colors.muted} align="center">
                    {a.description}
                  </Txt>
                  {!unlocked && (
                    <View style={{ alignSelf: "stretch", gap: 4 }}>
                      <View style={[styles.track, { height: 6 }]}>
                        <LinearGradient {...lunexGradient} style={{ height: 6, width: `${pct}%`, alignSelf: "flex-end" }} />
                      </View>
                      <Txt size={10} color="rgba(161,161,170,0.7)" align="center">
                        {Math.min(value, a.target)}/{a.target}
                      </Txt>
                    </View>
                  )}
                </Panel>
              );
            })}
          </View>
        )}

        {tab === "notifications" &&
          (notifLoading ? (
            <Loading />
          ) : !notifications || notifications.length === 0 ? (
            <Empty text="لا توجد إشعارات بعد." />
          ) : (
            <Panel style={{ overflow: "hidden" }}>
              {notifications.map((n, i) => (
                <Row key={n.id} gap={12} style={[{ padding: 16, alignItems: "flex-start" }, i > 0 && { borderTopWidth: 1, borderTopColor: colors.white5 }]}>
                  <Bell size={16} color={colors.primary300} style={{ marginTop: 2 }} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Txt size={14}>{n.title}</Txt>
                    {n.body ? (
                      <Txt size={14} color={colors.muted}>
                        {n.body}
                      </Txt>
                    ) : null}
                    <Txt size={12} color="rgba(161,161,170,0.7)">
                      {timeAgo(n.createdAt)}
                    </Txt>
                  </View>
                </Row>
              ))}
            </Panel>
          ))}

        {links}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  avatarRing: { borderRadius: 999, borderWidth: 4, borderColor: "rgba(139,49,232,0.3)" },
  track: { height: 8, borderRadius: radius.pill, backgroundColor: colors.white10, overflow: "hidden" },
  tabs: { gap: 6, padding: 4, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.white10, backgroundColor: "rgba(255,255,255,0.03)" },
  tab: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.md },
  tabActive: { backgroundColor: "rgba(109,40,217,0.45)" },
  badgeIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.white10, alignItems: "center", justifyContent: "center" },
  linkRow: { paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.white5 },
});
