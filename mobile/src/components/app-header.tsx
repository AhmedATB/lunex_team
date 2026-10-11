import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Bell, Mail, Search, Users, Zap } from "lucide-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { apiJson } from "../lib/api";
import { latestPerSeries, seriesTitle, useBootstrap } from "../lib/catalog";
import { SITE_URL } from "../lib/config";
import { useSession } from "../lib/session";
import { colors } from "../theme";
import { openWeb } from "./series-card";
import { Row, Txt } from "./ui";

/** The strip of newest chapters under the header (the site's layout/ticker.tsx): it drifts left, one loop every 26 s. */
function Ticker() {
  const { data } = useBootstrap();
  const items = useMemo(() => {
    if (!data) return [];
    const seriesMap = new Map(data.series.map((s) => [s.id, s]));
    return latestPerSeries(
      data.recentChapters.filter((c) => seriesMap.has(c.seriesId)),
      10,
    ).map((chapter) => ({ chapter, series: seriesMap.get(chapter.seriesId)! }));
  }, [data]);

  const [rowWidth, setRowWidth] = useState(0);
  const shift = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!rowWidth) return;
    shift.setValue(0);
    const loop = Animated.loop(
      Animated.timing(shift, { toValue: -rowWidth, duration: 26_000, easing: Easing.linear, useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [rowWidth, shift]);

  if (items.length === 0) return null;

  const row = (measure: boolean) => (
    <View style={{ flexDirection: "row" }} onLayout={measure ? (e) => setRowWidth(e.nativeEvent.layout.width) : undefined}>
      {items.map(({ chapter, series }) => (
        <Pressable
          key={`${measure}-${chapter.id}`}
          onPress={() => router.push({ pathname: "/read/[chapterId]", params: { chapterId: chapter.id, slug: series.slug } })}
          style={styles.tickerItem}
        >
          <Zap size={14} color={colors.amber400} fill={colors.amber400} />
          <Txt size={12} weight="500" color="rgba(255,255,255,0.7)" numberOfLines={1}>
            <Txt size={12} weight="700" color={colors.amber300}>
              جديد:
            </Txt>{" "}
            {seriesTitle(series)} — الفصل {chapter.number}
            {chapter.moreCount > 0 ? ` (+${chapter.moreCount})` : ""}
          </Txt>
        </Pressable>
      ))}
    </View>
  );

  return (
    <View style={styles.ticker}>
      <Animated.View style={{ flexDirection: "row", transform: [{ translateX: shift }] }}>
        {row(true)}
        {row(false)}
      </Animated.View>
    </View>
  );
}

/** The amber count the site puts on its bell and envelope (layout/notifications-bell.tsx, messages-link.tsx). */
function CountBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <View style={styles.count}>
      <Txt size={10} weight="700" color="#000" align="center">
        {count > 9 ? "9+" : count}
      </Txt>
    </View>
  );
}

/**
 * The site's header on a phone (layout/header.tsx): the round logo on the right; search, teams and the account on the left.
 * `ticker` adds the newest-chapters strip the site shows under it.
 */
export function AppHeader({ ticker = false }: { ticker?: boolean }) {
  const insets = useSafeAreaInsets();
  const { status, user } = useSession();
  const signedIn = status === "signedIn";
  const { data: unread } = useQuery({
    queryKey: ["unread-counts"],
    enabled: signedIn,
    refetchInterval: 60_000,
    queryFn: async () => {
      const [notifications, messages] = await Promise.all([
        apiJson<{ unreadCount?: number }>("/api/notifications/unread-count").catch(() => ({ unreadCount: 0 })),
        apiJson<{ unreadMessages?: number }>("/api/conversations/unread-count").catch(() => ({ unreadMessages: 0 })),
      ]);
      return { notifications: notifications.unreadCount ?? 0, messages: messages.unreadMessages ?? 0 };
    },
  });

  return (
    <View>
      <LinearGradient colors={["#1d0f36", "rgba(9,7,13,0.96)"]} style={[styles.header, { paddingTop: insets.top }]}>
        <Row style={styles.bar}>
          <Pressable onPress={() => router.navigate("/")} hitSlop={6}>
            <Image source={require("../../assets/brand-icon.png")} style={styles.logo} />
          </Pressable>
          <View style={{ flex: 1 }} />
          <Pressable onPress={() => router.push("/search")} hitSlop={8} style={styles.iconBtn}>
            <Search size={20} color={colors.text} />
          </Pressable>
          <Pressable onPress={() => router.push("/teams")} hitSlop={8} style={styles.iconBtn}>
            <Users size={20} color={colors.text} />
          </Pressable>
          {signedIn && (
            <>
              <Pressable onPress={() => openWeb("/messages", "الرسائل")} hitSlop={8} style={styles.iconBtn}>
                <Mail size={20} color={colors.text} />
                <CountBadge count={unread?.messages ?? 0} />
              </Pressable>
              <Pressable onPress={() => openWeb("/notifications", "الإشعارات")} hitSlop={8} style={styles.iconBtn}>
                <Bell size={20} color={colors.text} />
                <CountBadge count={unread?.notifications ?? 0} />
              </Pressable>
            </>
          )}
          {status === "signedIn" && user ? (
            <Pressable onPress={() => router.navigate("/account")} style={styles.avatarBtn}>
              {user.avatarVersion ? (
                <Image
                  source={`${SITE_URL}/api/users/${encodeURIComponent(user.id)}/avatar?v=${encodeURIComponent(user.avatarVersion)}`}
                  style={styles.avatar}
                />
              ) : (
                <View style={[styles.avatar, { backgroundColor: colors.primary600, alignItems: "center", justifyContent: "center" }]}>
                  <Txt weight="800" size={13}>
                    {(user.displayName || user.username).slice(0, 1).toUpperCase()}
                  </Txt>
                </View>
              )}
            </Pressable>
          ) : (
            <Pressable onPress={() => router.push("/login")} hitSlop={6} style={{ paddingHorizontal: 6 }}>
              <Txt weight="700" size={14}>
                تسجيل الدخول
              </Txt>
            </Pressable>
          )}
        </Row>
      </LinearGradient>
      {ticker && <Ticker />}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { borderBottomWidth: 1, borderBottomColor: colors.border },
  bar: { height: 64, paddingHorizontal: 16, gap: 6 },
  logo: { width: 34, height: 34, borderRadius: 17 },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 10 },
  avatarBtn: { borderRadius: 999, borderWidth: 1, borderColor: colors.white10, padding: 2 },
  avatar: { width: 32, height: 32, borderRadius: 16 },
  count: {
    position: "absolute",
    top: 2,
    left: 2,
    minWidth: 18,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 3,
    backgroundColor: colors.amber400,
    borderWidth: 1,
    borderColor: "#000",
    justifyContent: "center",
  },
  ticker: { overflow: "hidden", borderBottomWidth: 1, borderBottomColor: colors.white10, backgroundColor: "rgba(0,0,0,0.3)" },
  tickerItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 6,
    borderLeftWidth: 1,
    borderLeftColor: colors.white10,
  },
});
