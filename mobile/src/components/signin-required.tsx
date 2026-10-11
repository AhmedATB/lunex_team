import { router } from "expo-router";
import { Lock } from "lucide-react-native";
import { View } from "react-native";
import { colors, panel } from "../theme";
import { Button, Txt } from "./ui";

/** What the site does by redirecting to /login: a page that belongs to an account asks a guest to sign in first. */
export function SignInRequired({ text }: { text: string }) {
  return (
    <View style={[panel, { margin: 16, padding: 28, alignItems: "center", gap: 14 }]}>
      <Lock size={36} color={colors.primary300} />
      <Txt size={14} color={colors.muted} align="center" style={{ lineHeight: 22 }}>
        {text}
      </Txt>
      <View style={{ alignSelf: "stretch", gap: 8 }}>
        <Button label="تسجيل الدخول" onPress={() => router.push("/login")} />
        <Button label="إنشاء حساب" variant="secondary" onPress={() => router.push("/register")} />
      </View>
    </View>
  );
}
