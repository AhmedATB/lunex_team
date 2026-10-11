import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { router } from "expo-router";
import { ArrowRight, Search } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Avatar } from "../components/comments";
import { GUTTER } from "../components/layout";
import { openSeries } from "../components/series-card";
import { TeamLogo } from "../components/team-logo";
import { Panel, Row, Txt } from "../components/ui";
import { apiJson } from "../lib/api";
import { seriesTitle, useBootstrap } from "../lib/catalog";
import { absolute } from "../lib/config";
import { prepareSearchQuery, searchTier, seriesSearchFields } from "../lib/fuzzy-search";
import { useSession } from "../lib/session";
import { colors, panel, radius, TYPE_LABEL } from "../theme";

interface FoundUser {
  id: string;
  username: string;
  displayName: string | null;
  avatarVersion: string | null;
}

const BROWSE = [
  { label: "كل السلاسل", params: {} },
  { label: "الأكثر قراءة هذا الأسبوع", params: { sort: "trending" } },
  { label: "الأكثر شعبية", params: { sort: "popular" } },
  { label: "آخر التحديثات", params: { sort: "latest" } },
  { label: "المكتملة", params: { status: "completed" } },
];

/** The site's /search: one box for works, teams and people, and ways to browse while it is empty. */
export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const { status } = useSession();
  const { data } = useBootstrap();
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  const query = useMemo(() => prepareSearchQuery(debounced), [debounced]);
  const series = useMemo(() => {
    if (!data || query.tokens.length === 0) return [];
    return data.series
      .map((s) => ({ s, tier: searchTier(query, seriesSearchFields(s)) }))
      .filter((x) => x.tier > 0)
      .sort((a, b) => b.tier - a.tier)
      .map((x) => x.s)
      .slice(0, 20);
  }, [data, query]);
  const teams = useMemo(() => {
    if (!data || query.tokens.length === 0) return [];
    return data.teams.filter((t) => searchTier(query, [t.name, t.slug]) > 0).slice(0, 10);
  }, [data, query]);
  const { data: users } = useQuery({
    queryKey: ["user-search", debounced],
    queryFn: () => apiJson<FoundUser[] | { items: FoundUser[] }>(`/api/users/search?q=${encodeURIComponent(debounced)}`).then((b) => (Array.isArray(b) ? b : b.items ?? [])),
    enabled: status === "signedIn" && debounced.length >= 2,
  });
  const genres = (data?.tags ?? []).filter((t) => t.group === "genre").slice(0, 14);
  const empty = debounced.length === 0;
  const nothing = !empty && series.length === 0 && teams.length === 0 && (users?.length ?? 0) === 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: GUTTER, paddingTop: insets.top + 56, gap: 24, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <View style={{ gap: 6 }}>
          <Txt display size={26} weight="700">
            البحث
          </Txt>
          <Txt size={14} color={colors.muted}>
            ابحث عن سلاسل، فرق ترجمة، أو مستخدمين في مكان واحد.
          </Txt>
        </View>
        <Row gap={8} style={styles.input}>
          <Search size={18} color={colors.muted} />
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="ابحث عن مانهوا، فريق، أو مستخدم..."
            placeholderTextColor={colors.muted}
            style={styles.inputText}
            autoFocus
            returnKeyType="search"
          />
        </Row>

        {empty ? (
          <>
            <Panel style={{ padding: 32, backgroundColor: "rgba(109,40,217,0.12)" }}>
              <Txt size={16} color={colors.muted} align="center" style={{ lineHeight: 26 }}>
                اكتب كلمة للبحث عن سلاسل، فرق، أو مستخدمين.
              </Txt>
            </Panel>
            <View style={{ gap: 14 }}>
              <Txt display size={18} weight="700">
                أو تصفّح
              </Txt>
              <Row gap={8} style={{ flexWrap: "wrap" }}>
                {BROWSE.map((b) => (
                  <Pressable key={b.label} onPress={() => router.navigate({ pathname: "/explore", params: b.params })} style={styles.browse}>
                    <Txt size={14} color={colors.muted}>
                      {b.label}
                    </Txt>
                  </Pressable>
                ))}
                <Pressable onPress={() => router.push("/teams")} style={styles.browse}>
                  <Txt size={14} color={colors.muted}>
                    الفرق
                  </Txt>
                </Pressable>
              </Row>
              <Row gap={8} style={{ flexWrap: "wrap" }}>
                {genres.map((g) => (
                  <Pressable key={g.id} onPress={() => router.navigate({ pathname: "/explore", params: { genre: g.id } })} style={styles.genre}>
                    <Txt size={13} weight="500" color={colors.primary200}>
                      {g.nameAr || g.name}
                    </Txt>
                  </Pressable>
                ))}
              </Row>
            </View>
          </>
        ) : nothing ? (
          <Panel style={{ padding: 32 }}>
            <Txt color={colors.muted} align="center">
              لا توجد نتائج مطابقة لـ «{debounced}».
            </Txt>
          </Panel>
        ) : (
          <>
            {series.length > 0 && (
              <View style={{ gap: 10 }}>
                <Txt display size={18} weight="700">
                  السلاسل ({series.length})
                </Txt>
                {series.map((s) => (
                  <Pressable key={s.id} onPress={() => openSeries(s.slug)} style={[panel, { padding: 10 }]}>
                    <Row gap={12}>
                      <Image source={absolute(s.cover)} style={styles.cover} contentFit="cover" />
                      <View style={{ flex: 1, gap: 2 }}>
                        <Txt size={14} weight="700" numberOfLines={1}>
                          {seriesTitle(s)}
                        </Txt>
                        <Txt size={12} color={colors.muted}>
                          {TYPE_LABEL[s.type] ?? s.type} · {s.chapterCount} فصل
                        </Txt>
                      </View>
                    </Row>
                  </Pressable>
                ))}
              </View>
            )}
            {teams.length > 0 && (
              <View style={{ gap: 10 }}>
                <Txt display size={18} weight="700">
                  الفرق ({teams.length})
                </Txt>
                {teams.map((t) => (
                  <Pressable key={t.id} onPress={() => router.push({ pathname: "/teams/[slug]", params: { slug: t.slug } })} style={[panel, { padding: 12 }]}>
                    <Row gap={12}>
                      <TeamLogo team={t} size={40} />
                      <Txt size={14} weight="700" style={{ flex: 1 }}>
                        {t.name}
                      </Txt>
                    </Row>
                  </Pressable>
                ))}
              </View>
            )}
            {(users?.length ?? 0) > 0 && (
              <View style={{ gap: 10 }}>
                <Txt display size={18} weight="700">
                  المستخدمون ({users!.length})
                </Txt>
                {users!.map((u) => (
                  <View key={u.id} style={[panel, { padding: 12 }]}>
                    <Row gap={12}>
                      <Avatar user={u} size={40} />
                      <View style={{ flex: 1 }}>
                        <Txt size={14} weight="700">
                          {u.displayName || u.username}
                        </Txt>
                        <Txt size={12} color={colors.muted}>
                          @{u.username}
                        </Txt>
                      </View>
                    </Row>
                  </View>
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>
      <Pressable onPress={() => router.back()} style={{ position: "absolute", top: insets.top + 8, right: 16, padding: 8 }} hitSlop={8}>
        <ArrowRight size={22} color={colors.text} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  input: { height: 50, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: "rgba(255,255,255,0.03)", paddingHorizontal: 14 },
  inputText: { flex: 1, color: colors.text, fontFamily: "Tajawal_400Regular", fontSize: 15, textAlign: "right" },
  browse: { borderRadius: radius.pill, borderWidth: 1, borderColor: "rgba(255,255,255,0.15)", paddingHorizontal: 14, paddingVertical: 8 },
  genre: { borderRadius: radius.pill, backgroundColor: "rgba(109,40,217,0.35)", paddingHorizontal: 12, paddingVertical: 6 },
  cover: { width: 48, height: 64, borderRadius: radius.sm },
});
