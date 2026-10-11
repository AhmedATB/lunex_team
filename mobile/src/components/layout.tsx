import type { ReactNode } from "react";
import { ScrollView, View, useWindowDimensions } from "react-native";

/** The site's `container` side padding on a phone. */
export const GUTTER = 16;

/** A right-to-left grid of `columns` equal cells. */
export function Grid<T>({
  items,
  columns,
  gap,
  render,
  keyOf,
}: {
  items: T[];
  columns: number;
  gap: number;
  render: (item: T, i: number, width: number) => ReactNode;
  keyOf: (item: T) => string;
}) {
  const { width } = useWindowDimensions();
  const cell = (width - GUTTER * 2 - gap * (columns - 1)) / columns;
  return (
    <View style={{ flexDirection: "row-reverse", flexWrap: "wrap", gap, paddingHorizontal: GUTTER }}>
      {items.map((item, i) => (
        <View key={keyOf(item)} style={{ width: cell }}>
          {render(item, i, cell)}
        </View>
      ))}
    </View>
  );
}

/** A row that starts at the right edge and scrolls leftwards: the scroll view is mirrored, and each item mirrored back. */
export function Carousel({ children, gap = 16 }: { children: ReactNode; gap?: number }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ transform: [{ scaleX: -1 }] }}
      contentContainerStyle={{ paddingHorizontal: GUTTER, gap }}
    >
      {children}
    </ScrollView>
  );
}

/** Wrap each carousel item in this to undo the mirror. */
export const unmirror = { transform: [{ scaleX: -1 }] } as const;
