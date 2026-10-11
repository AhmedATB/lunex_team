import type { Tabs } from "expo-router";
import { BookText, Bookmark, Coins, Compass, Home, User, type LucideIcon } from "lucide-react-native";
import type { ComponentProps } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../theme";
import { Txt } from "./ui";

type BottomTabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>["tabBar"]>>[0];

/** The site's BOTTOM_NAV (layout/nav-items.ts), same order, labels and icons. */
const ITEMS: Record<string, { label: string; icon: LucideIcon }> = {
  index: { label: "الرئيسية", icon: Home },
  explore: { label: "استكشاف", icon: Compass },
  novels: { label: "الروايات", icon: BookText },
  store: { label: "المتجر", icon: Coins },
  bookmarks: { label: "مفضلتي", icon: Bookmark },
  account: { label: "حسابي", icon: User },
};

/** layout/bottom-nav.tsx: six equal cells, the first on the right; the active one purple with a soft glow. */
export function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingBottom: insets.bottom }]}>
      <View style={styles.row}>
        {state.routes.map((route, index) => {
          const item = ITEMS[route.name];
          if (!item) return null;
          const active = state.index === index;
          const color = active ? colors.primary300 : colors.muted;
          const Icon = item.icon;
          return (
            <Pressable
              key={route.key}
              style={styles.cell}
              onPress={() => {
                const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
                if (!active && !event.defaultPrevented) navigation.navigate(route.name, route.params);
              }}
            >
              <View style={active ? styles.glow : undefined}>
                <Icon size={20} color={color} />
              </View>
              <Txt size={11} weight="700" color={color} align="center">
                {item.label}
              </Txt>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { backgroundColor: "rgba(9,7,13,0.95)", borderTopWidth: 1, borderTopColor: colors.border },
  row: { flexDirection: "row-reverse" },
  cell: { flex: 1, alignItems: "center", gap: 4, paddingVertical: 10 },
  glow: { shadowColor: colors.primary400, shadowOpacity: 0.6, shadowRadius: 6, shadowOffset: { width: 0, height: 0 } },
});
