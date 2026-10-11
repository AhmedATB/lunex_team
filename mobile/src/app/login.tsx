import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { TurnstileBox } from "../components/turnstile-box";
import { Button, Row, Txt } from "../components/ui";
import type { OAuthProvider } from "../lib/oauth";
import { SITE_URL } from "../lib/config";
import { useSession } from "../lib/session";
import { colors, radius } from "../theme";

export default function LoginScreen() {
  const { login, loginWithProvider } = useSession();
  const [providerBusy, setProviderBusy] = useState<OAuthProvider | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [boxToken, setBoxToken] = useState<string | null>(null);
  const [boxReset, setBoxReset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    setError("");
    if (!email.trim() || !password) {
      setError("أدخل البريد الإلكتروني وكلمة المرور.");
      return;
    }
    if (!boxToken) {
      setError("انتظر حتى يكتمل التحقق ثم حاول مرة أخرى.");
      return;
    }
    setLoading(true);
    try {
      await login(email, password, boxToken);
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل تسجيل الدخول.");
      setBoxReset((n) => n + 1); // a Turnstile token works once
    } finally {
      setLoading(false);
    }
  }

  async function withProvider(provider: OAuthProvider) {
    setError("");
    setProviderBusy(provider);
    try {
      if (await loginWithProvider(provider)) router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر تسجيل الدخول، حاول مرة أخرى.");
    } finally {
      setProviderBusy(null);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Txt size={24} weight="800">
          مرحبًا بعودتك
        </Txt>
        <Txt color={colors.muted}>سجّل الدخول بحسابك في LUNEX.</Txt>

        <Row gap={10}>
          {(
            [
              { id: "google", label: "Google", icon: "logo-google" },
              { id: "discord", label: "Discord", icon: "logo-discord" },
            ] as const
          ).map((p) => (
            <Pressable
              key={p.id}
              onPress={() => withProvider(p.id)}
              disabled={providerBusy !== null || loading}
              style={({ pressed }) => [styles.provider, pressed && { backgroundColor: colors.surfaceRaised }]}
            >
              {providerBusy === p.id ? (
                <ActivityIndicator color={colors.text} />
              ) : (
                <Row gap={8}>
                  <Ionicons name={p.icon} size={18} color={colors.text} />
                  <Txt weight="700">{p.label}</Txt>
                </Row>
              )}
            </Pressable>
          ))}
        </Row>

        <Row gap={10}>
          <View style={styles.divider} />
          <Txt size={12} color={colors.faint}>
            أو بالبريد الإلكتروني
          </Txt>
          <View style={styles.divider} />
        </Row>

        <View style={{ gap: 6 }}>
          <Txt size={13} color={colors.muted}>
            البريد الإلكتروني
          </Txt>
          <TextInput
            value={email}
            onChangeText={setEmail}
            style={[styles.input, { textAlign: "left" }]}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            textContentType="emailAddress"
            placeholder="you@example.com"
            placeholderTextColor={colors.faint}
          />
        </View>

        <View style={{ gap: 6 }}>
          <Txt size={13} color={colors.muted}>
            كلمة المرور
          </Txt>
          <TextInput
            value={password}
            onChangeText={setPassword}
            style={[styles.input, { textAlign: "left" }]}
            secureTextEntry
            autoComplete="current-password"
            textContentType="password"
            onSubmitEditing={submit}
          />
        </View>

        <TurnstileBox action="login" onToken={setBoxToken} resetKey={boxReset} />

        {error ? (
          <Txt size={13} color={colors.danger}>
            {error}
          </Txt>
        ) : null}

        <Button label="تسجيل الدخول" onPress={submit} loading={loading} />

        <View style={{ gap: 4, marginTop: 8 }}>
          <Button label="نسيت كلمة المرور؟" variant="ghost" onPress={() => WebBrowser.openBrowserAsync(`${SITE_URL}/forgot-password`)} />
          <Txt size={12} color={colors.faint} style={{ textAlign: "center", marginTop: 8 }}>
            ليس لديك حساب؟ أنشئه من الموقع ثم سجّل الدخول هنا.
          </Txt>
          <Button label="إنشاء حساب" variant="ghost" onPress={() => WebBrowser.openBrowserAsync(`${SITE_URL}/register`)} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 16 },
  provider: {
    flex: 1,
    height: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  divider: { flex: 1, height: 1, backgroundColor: colors.border },
  input: {
    height: 50,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    paddingHorizontal: 14,
    fontSize: 15,
  },
});
