import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { Bookmark, BookOpen } from "lucide-react-native";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { seriesTitle } from "../lib/catalog";
import { absolute } from "../lib/config";
import type { Series, Tag } from "../lib/types";
import { colors, panel, radius, STATUS_LABEL } from "../theme";
import { Badge, formatNumber, RatingPill, Row, Txt } from "./ui";

export const openSeries = (slug: string) => router.push({ pathname: "/series/[slug]", params: { slug } });
export const openChapter = (slug: string, chapterId: string) => router.push({ pathname: "/read/[chapterId]", params: { chapterId, slug } });
/** One of the site's own pages inside the app (app/web.tsx). */
export const openWeb = (path: string, title?: string) => router.push({ pathname: "/web", params: { path, ...(title ? { title } : {}) } });

/** Opens a chapter known only by its number (reading progress keeps numbers, like the site's URLs). */
export const openChapterNumber = (slug: string, number: number) =>
  router.push({ pathname: "/read/[chapterId]", params: { chapterId: "by-number", slug, number: String(number) } });

/** A cover filling a `.panel` (3:4 unless told otherwise), with whatever is laid over it. */
export function CoverPanel({
  uri,
  recyclingKey,
  children,
  style,
  aspect = 3 / 4,
  scrim,
}: {
  uri: string;
  recyclingKey?: string;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  aspect?: number;
  scrim?: boolean;
}) {
  return (
    <View style={[panel, { aspectRatio: aspect, overflow: "hidden" }, style]}>
      <Image source={absolute(uri)} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} recyclingKey={recyclingKey} />
      {scrim && (
        <LinearGradient
          colors={["rgba(0,0,0,0.05)", "rgba(0,0,0,0.35)", "rgba(0,0,0,0.85)"]}
          locations={[0, 0.5, 1]}
          style={StyleSheet.absoluteFill}
        />
      )}
      {children}
    </View>
  );
}

/**
 * The cover-and-title tile of the site's home grids and carousels (editorial-home.tsx): the rating pill in the left corner, an
 * optional rank in the right one, the title under it in two lines.
 */
export function CoverTile({ series, width, rank }: { series: Series; width?: number; rank?: number }) {
  return (
    <Pressable onPress={() => openSeries(series.slug)} style={[{ gap: 8 }, width ? { width } : { flex: 1 }]}>
      {({ pressed }) => (
        <>
          <CoverPanel uri={series.cover} recyclingKey={series.id} style={pressed && styles.pressed}>
            {rank !== undefined && (
              <View style={[styles.corner, { right: 8 }]}>
                <Txt size={12} weight="700" color={colors.primary300}>
                  {String(rank).padStart(2, "0")}
                </Txt>
              </View>
            )}
            <RatingPill rating={series.rating} ratingCount={series.ratingCount} style={{ position: "absolute", top: 8, left: 8 }} />
          </CoverPanel>
          <Txt size={14} weight="700" numberOfLines={2} color={pressed ? colors.primary300 : colors.text}>
            {seriesTitle(series)}
          </Txt>
        </>
      )}
    </Pressable>
  );
}

/** The genre chips of the site's cards: the first three genres, each in its own colour. */
const CHIP_STYLES = [
  { backgroundColor: "rgba(109,40,217,0.9)", color: colors.text },
  { backgroundColor: colors.amber400, color: "#451a03" },
  { backgroundColor: "#c084fc", color: "#2c0a4d" },
];

/**
 * The explore page's card (shared/series-card.tsx): the cover with its rating (and a status badge for anything not ongoing), then
 * genre chips, the title, the latest chapter number and how many saved it.
 */
export function SeriesCard({ series, tags, width }: { series: Series; tags: Map<string, Tag>; width: number }) {
  const genres = series.genreIds
    .map((id) => tags.get(id))
    .filter((t): t is Tag => Boolean(t))
    .slice(0, 3);
  return (
    <Pressable onPress={() => openSeries(series.slug)} style={({ pressed }) => [styles.card, { width }, pressed && styles.pressed]}>
      <View style={{ aspectRatio: 3 / 4 }}>
        <Image source={absolute(series.cover)} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} recyclingKey={series.id} />
        <LinearGradient colors={["transparent", "transparent", "rgba(0,0,0,0.4)"]} style={StyleSheet.absoluteFill} />
        {series.status !== "ongoing" && (
          <Badge label={STATUS_LABEL[series.status] ?? series.status} style={{ position: "absolute", top: 8, right: 8 }} />
        )}
        <RatingPill
          rating={series.rating}
          ratingCount={series.ratingCount}
          style={{ position: "absolute", top: 8, left: 8, transform: [{ rotate: "3deg" }] }}
        />
      </View>
      <View style={styles.cardBody}>
        {genres.length > 0 && (
          <Row gap={4} style={{ flexWrap: "wrap" }}>
            {genres.map((g, i) => {
              const chip = CHIP_STYLES[i % CHIP_STYLES.length];
              return (
                <View key={g.id} style={[styles.chip, { backgroundColor: chip.backgroundColor }]}>
                  <Txt size={9} weight="700" color={chip.color}>
                    {g.nameAr || g.name}
                  </Txt>
                </View>
              );
            })}
          </Row>
        )}
        <Txt display size={14} weight="700" numberOfLines={2} style={{ lineHeight: 20 }}>
          {seriesTitle(series)}
        </Txt>
        <Row gap={12} style={{ marginTop: "auto" }}>
          <Row gap={4}>
            <BookOpen size={12} color={colors.muted} />
            <Txt size={11} weight="500" color={colors.muted}>
              {series.latestChapterNumber}
            </Txt>
          </Row>
          <Row gap={4}>
            <Bookmark size={12} color={colors.muted} />
            <Txt size={11} weight="500" color={colors.muted}>
              {formatNumber(series.bookmarks)}
            </Txt>
          </Row>
        </Row>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: { transform: [{ scale: 0.98 }], borderColor: "rgba(168,85,247,0.5)" },
  corner: {
    position: "absolute",
    top: 8,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  card: {
    borderRadius: radius["2xl"],
    borderWidth: 1,
    borderColor: colors.white10,
    backgroundColor: "#120a1f",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 5,
  },
  cardBody: { flex: 1, gap: 6, padding: 10, backgroundColor: "#150c26", borderTopWidth: 1, borderTopColor: colors.white5 },
  chip: { borderRadius: radius.pill, paddingHorizontal: 6, paddingVertical: 2 },
});
