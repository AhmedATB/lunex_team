import Ionicons from "@expo/vector-icons/Ionicons";
import { Image } from "expo-image";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, Loading, Row, Txt } from "../../components/ui";
import { SITE_URL } from "../../lib/config";
import { useSession } from "../../lib/session";
import { colors, radius } from "../../theme";

const DISCORD_URL = "https://discord.gg/KSbdfBqNrE";
const TELEGRAM_URL = "https://t.me/lunex_team";

function LinkRow({ icon, label, url }: { icon: keyof typeof Ionicons.glyphMap; label: string; url: string }) {
  return (
    <Pressable
      onPress={() => WebBrowser.openBrowserAsync(url)}
      style={({ pressed }) => [styles.linkRow, pressed && { backgroundColor: colors.surfaceRaised }]}
    >
      <Row gap={12}>
        <Ionicons name={icon} size={20} color={colors.lilac} />
        <Txt style={{ flex: 1 }}>{label}</Txt>
        <Ionicons name="chevron-back" size={18} color={colors.faint} />
      </Row>
    </Pressable>
  );
}

export default function AccountScreen() {
  const insets = useSafeAreaInsets();
  const { status, user, logout } = useSession();

  if (status === "loading") return <Loading />;

  return (
    <ScrollView contentContainerStyle={{ paddingTop: insets.top + 24, paddingHorizontal: 16, paddingBottom: 32, gap: 24 }}>
      {user ? (
        <Row gap={14}>
          <View style={styles.avatar}>
            {user.avatarVersion ? (
              <Image
                source={`${SITE_URL}/api/users/${encodeURIComponent(user.id)}/avatar?v=${encodeURIComponent(user.avatarVersion)}`}
                style={StyleSheet.absoluteFill}
              />
            ) : (
              <Txt size={24} weight="800">
                {(user.displayName || user.username).slice(0, 1).toUpperCase()}
              </Txt>
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Txt size={20} weight="800">
              {user.displayName || user.username}
            </Txt>
            <Txt size={13} color={colors.muted}>
              @{user.username}
            </Txt>
          </View>
        </Row>
      ) : (
        <View style={styles.card}>
          <Txt size={18} weight="800">
            أهلًا بك في LUNEX
          </Txt>
          <Txt color={colors.muted}>سجّل الدخول لتقرأ الفصول المقفلة وتحفظ تقدّمك على كل أجهزتك.</Txt>
          <Button label="تسجيل الدخول" onPress={() => router.push("/login")} />
          <Button label="إنشاء حساب من الموقع" variant="ghost" onPress={() => WebBrowser.openBrowserAsync(`${SITE_URL}/register`)} />
        </View>
      )}

      <View style={{ gap: 8 }}>
        <LinkRow icon="logo-discord" label="سيرفر Discord" url={DISCORD_URL} />
        <LinkRow icon="paper-plane-outline" label="قناة Telegram" url={TELEGRAM_URL} />
        <LinkRow icon="globe-outline" label="الموقع" url={SITE_URL} />
        <LinkRow icon="shield-checkmark-outline" label="سياسة الخصوصية" url={`${SITE_URL}/privacy`} />
        <LinkRow icon="document-text-outline" label="شروط الاستخدام" url={`${SITE_URL}/terms`} />
      </View>

      {user && <Button label="تسجيل الخروج" variant="ghost" onPress={logout} />}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    overflow: "hidden",
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  card: { gap: 12, padding: 16, borderRadius: radius.lg, backgroundColor: colors.surface },
  linkRow: { padding: 14, borderRadius: radius.md, backgroundColor: colors.surface },
});
