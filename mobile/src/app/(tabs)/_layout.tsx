import Ionicons from "@expo/vector-icons/Ionicons";
import { Tabs } from "expo-router";
import type { ColorValue } from "react-native";
import { colors } from "../../theme";

type IconName = keyof typeof Ionicons.glyphMap;

const icon =
  (name: IconName) =>
  ({ color, size }: { color: ColorValue; size: number }) => <Ionicons name={name} color={color as string} size={size} />;

/**
 * Tabs read right to left: declared in reverse, because the tab bar itself lays out left to right (the app does not flip the
 * whole layout — see components/ui.tsx). "الرئيسية" ends up on the right, where an Arabic reader looks first.
 */
export default function TabsLayout() {
  return (
    <Tabs
      initialRouteName="index"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.lilac,
        tabBarInactiveTintColor: colors.faint,
        tabBarStyle: { backgroundColor: colors.bg, borderTopColor: colors.border },
        tabBarLabelStyle: { fontWeight: "600" },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen name="account" options={{ title: "حسابي", tabBarIcon: icon("person-circle-outline") }} />
      <Tabs.Screen name="library" options={{ title: "مكتبتي", tabBarIcon: icon("bookmarks-outline") }} />
      <Tabs.Screen name="search" options={{ title: "البحث", tabBarIcon: icon("search-outline") }} />
      <Tabs.Screen name="index" options={{ title: "الرئيسية", tabBarIcon: icon("home-outline") }} />
    </Tabs>
  );
}
