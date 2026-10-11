import { Tabs } from "expo-router";
import { TabBar } from "../../components/tab-bar";
import { colors } from "../../theme";

/** The site's bottom navigation: الرئيسية، استكشاف، الروايات، المتجر، مفضلتي، حسابي (components/tab-bar.tsx draws it). */
export default function TabsLayout() {
  return (
    <Tabs initialRouteName="index" tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.bg } }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="explore" />
      <Tabs.Screen name="novels" />
      <Tabs.Screen name="store" />
      <Tabs.Screen name="bookmarks" />
      <Tabs.Screen name="account" />
    </Tabs>
  );
}
