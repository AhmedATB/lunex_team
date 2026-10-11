import { Search, SlidersHorizontal, X } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { FlatList, Modal, Pressable, ScrollView, StyleSheet, TextInput, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { byFollowers, byPopularity, byThisWeek, byTopRated, byViews, useBootstrap } from "../lib/catalog";
import { prepareSearchQuery, searchTier, seriesSearchFields } from "@/lib/fuzzy-search";
import type { Series, Tag } from "../lib/types";
import { colors, panel, radius } from "../theme";
import { AppHeader } from "./app-header";
import { GUTTER } from "./layout";
import { SeriesCard } from "./series-card";
import { Badge, Button, ErrorState, Loading, Row, Txt } from "./ui";

/** The site's explore page options (components/explore/series-explorer.tsx), same values and labels. */
const STATUS_OPTIONS = [
  { value: "ongoing", label: "مستمر" },
  { value: "completed", label: "مكتمل" },
  { value: "hiatus", label: "متوقف مؤقتًا" },
  { value: "dropped", label: "متروك" },
];
const TYPE_OPTIONS = [
  { value: "manhwa", label: "مانهوا" },
  { value: "manga", label: "مانجا" },
  { value: "manhua", label: "مانها" },
  { value: "novel", label: "رواية" },
];
const COUNTRY_OPTIONS = [
  { value: "kr", label: "كوريا" },
  { value: "jp", label: "اليابان" },
  { value: "cn", label: "الصين" },
];
const SORT_OPTIONS = [
  { value: "popular", label: "الأكثر شعبية" },
  { value: "trending", label: "الأكثر قراءة هذا الأسبوع" },
  { value: "views", label: "الأكثر مشاهدة" },
  { value: "followers", label: "الأكثر متابعة" },
  { value: "latest", label: "آخر تحديث" },
  { value: "rating", label: "الأعلى تقييمًا" },
  { value: "az", label: "أبجديًا" },
] as const;

type Sort = (typeof SORT_OPTIONS)[number]["value"];

export interface ExplorerFilters {
  q: string;
  genre?: string;
  status?: string;
  type?: string;
  country?: string;
  sort: Sort;
}

const PAGE_SIZE = 24;
const COLUMNS = 2;
const GAP = 16;

function sortSeries(items: Series[], sort: Sort) {
  switch (sort) {
    case "views":
      return items.sort(byViews);
    case "trending":
      return items.sort(byThisWeek);
    case "followers":
      return items.sort(byFollowers);
    case "latest":
      return items.sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt));
    case "rating":
      return items.sort(byTopRated);
    case "az":
      return items.sort((a, b) => a.titleAr.localeCompare(b.titleAr, "ar"));
    default:
      return items.sort(byPopularity);
  }
}

function OptionGroup({
  title,
  options,
  value,
  onChange,
  allowEmpty = true,
}: {
  title: string;
  options: readonly { value: string; label: string }[];
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  allowEmpty?: boolean;
}) {
  return (
    <View style={{ gap: 10 }}>
      <Txt size={13} weight="700" color={colors.muted}>
        {title}
      </Txt>
      <Row gap={8} style={{ flexWrap: "wrap" }}>
        {allowEmpty && <Chip label="الكل" selected={!value} onPress={() => onChange(undefined)} />}
        {options.map((o) => (
          <Chip key={o.value} label={o.label} selected={value === o.value} onPress={() => onChange(value === o.value && allowEmpty ? undefined : o.value)} />
        ))}
      </Row>
    </View>
  );
}

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, selected && styles.chipSelected]}>
      <Txt size={13} weight={selected ? "700" : "500"} color={selected ? colors.text : colors.muted}>
        {label}
      </Txt>
    </Pressable>
  );
}

/** The site's explore page: the title, a search box, the filters, "N نتيجة", and a two-column grid of cards with paging. */
export function SeriesExplorer({ initial, novels = false }: { initial: Partial<ExplorerFilters>; novels?: boolean }) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { data, isLoading, isError, refetch } = useBootstrap();
  const base: ExplorerFilters = { q: "", sort: "popular", ...(novels ? { type: "novel" } : {}) };
  const [filters, setFilters] = useState<ExplorerFilters>({ ...base, ...initial });
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);

  // Coming back from a home-page link with new filters replaces the old ones.
  const initialKey = JSON.stringify(initial);
  useEffect(() => {
    setFilters({ ...base, ...initial });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialKey]);
  useEffect(() => setPage(1), [filters]);

  const tags = useMemo(() => new Map<string, Tag>((data?.tags ?? []).map((t) => [t.id, t])), [data]);
  const genres = useMemo(() => (data?.tags ?? []).filter((t) => t.group === "genre" || t.group === "theme"), [data]);

  const filtered = useMemo(() => {
    let items = [...(data?.series ?? [])];
    const query = prepareSearchQuery(filters.q);
    const tiers = new Map<string, number>();
    if (query.tokens.length > 0) {
      items = items.filter((s) => {
        const tier = searchTier(query, seriesSearchFields(s));
        if (tier > 0) tiers.set(s.id, tier);
        return tier > 0;
      });
    }
    if (filters.genre) items = items.filter((s) => s.genreIds.includes(filters.genre!));
    if (filters.status) items = items.filter((s) => s.status === filters.status);
    if (filters.type) items = items.filter((s) => s.type === filters.type);
    if (filters.country) items = items.filter((s) => s.country === filters.country);
    sortSeries(items, filters.sort);
    if (tiers.size > 0) items.sort((a, b) => (tiers.get(b.id) ?? 0) - (tiers.get(a.id) ?? 0));
    return items;
  }, [data, filters]);

  if (isLoading) return <Loading />;
  if (isError) return <ErrorState onRetry={refetch} />;

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const novelsView = filters.type === "novel";
  const activeCount = [filters.genre, filters.status, filters.type, filters.country].filter(Boolean).length - (novels ? 1 : 0);
  const cardWidth = (width - GUTTER * 2 - GAP * (COLUMNS - 1)) / COLUMNS;
  const update = <K extends keyof ExplorerFilters>(key: K, value: ExplorerFilters[K]) => setFilters((f) => ({ ...f, [key]: value }));

  const header = (
    <View style={{ gap: 24, paddingBottom: 24 }}>
      <View style={{ gap: 12 }}>
        <View>
          <Txt display size={24} weight="700">
            {novelsView ? "الروايات" : "استكشاف السلاسل"}
          </Txt>
          {novelsView && (
            <Txt size={14} color={colors.muted} style={{ marginTop: 4 }}>
              مجموعة الروايات النصية المترجمة على المنصة.
            </Txt>
          )}
        </View>
        <Row style={styles.input} gap={8}>
          <Search size={16} color={colors.muted} />
          <TextInput
            value={filters.q}
            onChangeText={(q) => update("q", q)}
            placeholder="ابحث بالاسم أو المؤلف..."
            placeholderTextColor={colors.muted}
            style={styles.inputText}
            returnKeyType="search"
            autoCorrect={false}
          />
        </Row>
      </View>
      <Row gap={8} style={{ flexWrap: "wrap" }}>
        <Button
          variant="secondary"
          size="sm"
          label={`الفلاتر${activeCount > 0 ? ` (${activeCount})` : ""}`}
          icon={<SlidersHorizontal size={16} color={colors.text} />}
          onPress={() => setShowFilters(true)}
        />
        {activeCount > 0 && (
          <Pressable onPress={() => setFilters(base)} style={{ paddingHorizontal: 8 }}>
            <Row gap={4}>
              <X size={14} color="#f87171" />
              <Txt size={12} weight="700" color="#f87171">
                مسح الفلاتر
              </Txt>
            </Row>
          </Pressable>
        )}
      </Row>
      <Txt size={14} color={colors.muted}>
        {filtered.length} نتيجة
      </Txt>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <AppHeader ticker />
      <FlatList
        data={paged}
        keyExtractor={(s) => s.id}
        numColumns={COLUMNS}
        columnWrapperStyle={{ flexDirection: "row-reverse", gap: GAP }}
        contentContainerStyle={{ padding: GUTTER, paddingTop: 24, gap: GAP, paddingBottom: 40 }}
        keyboardDismissMode="on-drag"
        ListHeaderComponent={header}
        renderItem={({ item }) => <SeriesCard series={item} tags={tags} width={cardWidth} />}
        ListEmptyComponent={
          <View style={[panel, { padding: 40 }]}>
            <Txt color={colors.muted} align="center">
              لا توجد نتائج مطابقة لبحثك، جرّب تعديل الفلاتر.
            </Txt>
          </View>
        }
        ListFooterComponent={
          totalPages > 1 ? (
            <Row gap={8} style={{ justifyContent: "center", paddingTop: 16 }}>
              <Button variant="secondary" size="sm" label="السابق" disabled={page <= 1} onPress={() => setPage((p) => p - 1)} />
              <Badge variant="secondary" label={`${page} / ${totalPages}`} style={{ alignSelf: "center" }} />
              <Button variant="secondary" size="sm" label="التالي" disabled={page >= totalPages} onPress={() => setPage((p) => p + 1)} />
            </Row>
          ) : null
        }
      />

      <Modal visible={showFilters} transparent animationType="slide" onRequestClose={() => setShowFilters(false)}>
        <Pressable style={styles.backdrop} onPress={() => setShowFilters(false)} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <Row style={{ justifyContent: "space-between", marginBottom: 8 }}>
            <Txt display size={18} weight="700">
              الفلاتر
            </Txt>
            <Pressable onPress={() => setShowFilters(false)} hitSlop={10}>
              <X size={20} color={colors.muted} />
            </Pressable>
          </Row>
          <ScrollView contentContainerStyle={{ gap: 20, paddingBottom: 16 }}>
            <OptionGroup title="الترتيب" options={SORT_OPTIONS} value={filters.sort} onChange={(v) => update("sort", (v ?? "popular") as Sort)} allowEmpty={false} />
            <OptionGroup title="الحالة" options={STATUS_OPTIONS} value={filters.status} onChange={(v) => update("status", v)} />
            {!novels && <OptionGroup title="النوع" options={TYPE_OPTIONS} value={filters.type} onChange={(v) => update("type", v)} />}
            <OptionGroup title="البلد" options={COUNTRY_OPTIONS} value={filters.country} onChange={(v) => update("country", v)} />
            <OptionGroup
              title="التصنيف"
              options={genres.map((g) => ({ value: g.id, label: g.nameAr || g.name }))}
              value={filters.genre}
              onChange={(v) => update("genre", v)}
            />
          </ScrollView>
          <Button label={`عرض ${filtered.length} نتيجة`} onPress={() => setShowFilters(false)} />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    height: 44,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "rgba(255,255,255,0.03)",
    paddingHorizontal: 12,
  },
  inputText: { flex: 1, color: colors.text, fontFamily: "Tajawal_400Regular", fontSize: 14, textAlign: "right", writingDirection: "rtl" },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: radius.pill, borderWidth: 1, borderColor: "rgba(255,255,255,0.15)", backgroundColor: "rgba(255,255,255,0.05)" },
  chipSelected: { backgroundColor: colors.primary600, borderColor: colors.primary400 },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)" },
  sheet: {
    maxHeight: "80%",
    backgroundColor: colors.popover,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
    gap: 12,
  },
});
