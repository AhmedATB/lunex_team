import { Image } from "expo-image";
import { router } from "expo-router";
import { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SeriesCard } from "../../components/series-card";
import { Row, SectionTitle, Txt } from "../../components/ui";
import { timeAgo, useBootstrap } from "../../lib/catalog";
import { absolute } from "../../lib/config";
import { useLibrary } from "../../lib/library";
import { colors, radius } from "../../theme";

const COLUMNS = 3;
const GAP = 12;

export default function LibraryScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { history, bookmarks } = useLibrary();
  const { data } = useBootstrap();

  const saved = useMemo(() => {
    const byId = new Map((data?.series ?? []).map((s) => [s.id, s]));
    return bookmarks.map((id) => byId.get(id)).filter((s) => s !== undefined);
  }, [data, bookmarks]);

  const cardWidth = (width - 32 - GAP * (COLUMNS - 1)) / COLUMNS;

  return (
    <ScrollView contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: 32 }}>
      <SectionTitle>المحفوظات</SectionTitle>
      {saved.length === 0 ? (
        <Txt color={colors.muted} style={styles.empty}>
          احفظ الأعمال من صفحتها بزر الحفظ لتجدها هنا.
        </Txt>
      ) : (
        <View style={styles.grid}>
          {saved.map((s) => (
            <SeriesCard key={s.id} series={s} width={cardWidth} />
          ))}
        </View>
      )}

      <SectionTitle style={{ marginTop: 28 }}>سجل القراءة</SectionTitle>
      {history.length === 0 ? (
        <Txt color={colors.muted} style={styles.empty}>
          الفصول التي تقرؤها ستظهر هنا.
        </Txt>
      ) : (
        <View style={{ paddingHorizontal: 16, gap: 8 }}>
          {history.map((h) => (
            <Pressable
              key={h.seriesId}
              onPress={() => router.push({ pathname: "/read/[chapterId]", params: { chapterId: h.chapterId, slug: h.slug } })}
              style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surfaceRaised }]}
            >
              <Row gap={12}>
                <Image source={absolute(h.cover)} style={styles.cover} contentFit="cover" />
                <View style={{ flex: 1, gap: 2 }}>
                  <Txt weight="700" numberOfLines={1}>
                    {h.title}
                  </Txt>
                  <Txt size={13} color={colors.lilac}>
                    تابع من الفصل {h.chapterNumber}
                  </Txt>
                  <Txt size={11} color={colors.faint}>
                    {timeAgo(h.readAt)}
                  </Txt>
                </View>
              </Row>
            </Pressable>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  empty: { paddingHorizontal: 16 },
  grid: { flexDirection: "row-reverse", flexWrap: "wrap", gap: GAP, paddingHorizontal: 16, rowGap: 18 },
  row: { padding: 8, borderRadius: radius.md, backgroundColor: colors.surface },
  cover: { width: 52, height: 72, borderRadius: radius.sm, backgroundColor: colors.surfaceRaised },
});
