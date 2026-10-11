import { Image } from "expo-image";
import { router } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import { seriesTitle } from "../lib/catalog";
import { absolute } from "../lib/config";
import type { Series } from "../lib/types";
import { colors, radius, TYPE_LABEL } from "../theme";
import { Txt } from "./ui";

/** A cover with the title under it — the unit of every horizontal list and grid. */
export function SeriesCard({ series, width = 120, subtitle }: { series: Series; width?: number; subtitle?: string }) {
  return (
    <Pressable onPress={() => router.push({ pathname: "/series/[slug]", params: { slug: series.slug } })} style={{ width }}>
      <View style={[styles.cover, { width, height: width * 1.42 }]}>
        <Image
          source={absolute(series.cover)}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={150}
          recyclingKey={series.id}
        />
        <View style={styles.badge}>
          <Txt size={10} weight="700">
            {TYPE_LABEL[series.type] ?? series.type}
          </Txt>
        </View>
      </View>
      <Txt size={13} weight="600" numberOfLines={2} style={{ marginTop: 6 }}>
        {seriesTitle(series)}
      </Txt>
      {subtitle ? (
        <Txt size={11} color={colors.muted} numberOfLines={1}>
          {subtitle}
        </Txt>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cover: { borderRadius: radius.md, overflow: "hidden", backgroundColor: colors.surface },
  badge: {
    position: "absolute",
    top: 6,
    right: 6,
    backgroundColor: "rgba(109,40,217,0.9)",
    borderRadius: radius.pill,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
});
