import Ionicons from "@expo/vector-icons/Ionicons";
import { useMemo, useState } from "react";
import { FlatList, Pressable, ScrollView, StyleSheet, TextInput, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SeriesCard } from "../../components/series-card";
import { ErrorState, Loading, Row, Txt } from "../../components/ui";
import { useBootstrap } from "../../lib/catalog";
import { colors, radius } from "../../theme";

/** Folds the spellings an Arabic search should treat as one: diacritics, alef forms, ta marbuta, alef maqsura, tatweel. */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[ً-ٰٟـ]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/\s+/g, " ")
    .trim();
}

const COLUMNS = 3;
const GAP = 12;

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { data, isLoading, isError, refetch } = useBootstrap();
  const [query, setQuery] = useState("");
  const [genre, setGenre] = useState<string | null>(null);

  const genres = useMemo(() => (data?.tags ?? []).filter((t) => t.group === "genre"), [data]);
  const results = useMemo(() => {
    if (!data) return [];
    const q = normalize(query);
    return data.series.filter((s) => {
      if (genre && !s.genreIds.includes(genre) && !s.tags.includes(genre)) return false;
      if (!q) return true;
      return [s.title, s.titleAr, ...s.alternativeTitles].some((t) => normalize(t ?? "").includes(q));
    });
  }, [data, query, genre]);

  if (isLoading) return <Loading />;
  if (isError) return <ErrorState onRetry={refetch} />;

  const cardWidth = (width - 32 - GAP * (COLUMNS - 1)) / COLUMNS;

  return (
    <View style={{ flex: 1, paddingTop: insets.top + 12 }}>
      <Row style={styles.inputWrap}>
        <Ionicons name="search" size={18} color={colors.faint} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="ابحث عن عمل…"
          placeholderTextColor={colors.faint}
          style={styles.input}
          returnKeyType="search"
          autoCorrect={false}
        />
        {query ? (
          <Pressable onPress={() => setQuery("")} hitSlop={10}>
            <Ionicons name="close-circle" size={18} color={colors.faint} />
          </Pressable>
        ) : null}
      </Row>

      <View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
          style={{ transform: [{ scaleX: -1 }] }}
        >
          {[{ id: "", nameAr: "الكل" }, ...genres].map((g) => {
            const selected = (genre ?? "") === g.id;
            return (
              <Pressable
                key={g.id || "all"}
                onPress={() => setGenre(g.id || null)}
                style={[styles.chip, selected && styles.chipSelected, { transform: [{ scaleX: -1 }] }]}
              >
                <Txt size={13} weight={selected ? "700" : "400"} color={selected ? colors.text : colors.muted}>
                  {g.nameAr}
                </Txt>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <FlatList
        data={results}
        keyExtractor={(s) => s.id}
        numColumns={COLUMNS}
        columnWrapperStyle={{ flexDirection: "row-reverse", gap: GAP }}
        contentContainerStyle={{ padding: 16, gap: 18 }}
        keyboardDismissMode="on-drag"
        renderItem={({ item }) => <SeriesCard series={item} width={cardWidth} />}
        ListEmptyComponent={
          <Txt color={colors.muted} style={{ textAlign: "center", marginTop: 40 }}>
            لا توجد نتائج.
          </Txt>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  inputWrap: { marginHorizontal: 16, paddingHorizontal: 14, height: 46, borderRadius: radius.md, backgroundColor: colors.surface },
  input: { flex: 1, color: colors.text, fontSize: 15, textAlign: "right", writingDirection: "rtl" },
  chips: { paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: radius.pill, backgroundColor: colors.surface },
  chipSelected: { backgroundColor: colors.primary },
});
