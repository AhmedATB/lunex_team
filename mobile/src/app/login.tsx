import { router } from "expo-router";
import { Lock, Mail } from "lucide-react-native";
import { useState } from "react";
import { Pressable, StyleSheet } from "react-native";
import { AuthShell, Field, OrDivider } from "../components/auth-shell";
import { TurnstileBox } from "../components/turnstile-box";
import { Button, Row, Txt } from "../components/ui";
import type { OAuthProvider } from "../lib/oauth";
import { useSession } from "../lib/session";
import { colors, radius } from "../theme";

/** The site's /login: email and password, the "not a robot" box, then Google / Discord. */
export default function LoginScreen() {
  const { login, loginWithProvider } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [boxToken, setBoxToken] = useState<string | null>(null);
  const [boxReset, setBoxReset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [providerBusy, setProviderBusy] = useState<OAuthProvider | null>(null);
  const [error, setError] = useState("");

  async function submit() {
    setError("");
    if (!email.trim() || !password) return setError("أدخل البريد الإلكتروني وكلمة المرور.");
    if (!boxToken) return setError("أكّد أنك لست روبوتًا بالضغط على المربع أعلاه.");
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
    <AuthShell title="تسجيل الدخول" subtitle="أهلًا بعودتك إلى LUNEX TEAM">
      <Field
        label="البريد الإلكتروني"
        icon={<Mail size={18} color={colors.muted} />}
        value={email}
        onChangeText={setEmail}
        placeholder="you@example.com"
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        textContentType="emailAddress"
        ltr
      />
      <Field
        label="كلمة المرور"
        icon={<Lock size={18} color={colors.muted} />}
        aside={
          <Pressable onPress={() => router.push("/forgot-password")} hitSlop={6}>
            <Txt size={12} color={colors.primary300}>
              نسيت كلمة المرور؟
            </Txt>
          </Pressable>
        }
        value={password}
        onChangeText={setPassword}
        placeholder="••••••••"
        secureTextEntry
        autoComplete="current-password"
        textContentType="password"
        onSubmitEditing={submit}
        ltr
      />
      <TurnstileBox action="login" onToken={setBoxToken} resetKey={boxReset} />
      {error ? (
        <Txt size={13} color="#f87171">
          {error}
        </Txt>
      ) : null}
      <Button size="lg" label="تسجيل الدخول" onPress={submit} loading={loading} disabled={providerBusy !== null} />
      <OrDivider />
      <Row gap={12}>
        {(["discord", "google"] as const).map((p) => (
          <Pressable
            key={p}
            onPress={() => withProvider(p)}
            disabled={providerBusy !== null || loading}
            style={({ pressed }) => [styles.provider, pressed && { backgroundColor: "rgba(255,255,255,0.08)" }, providerBusy === p && { opacity: 0.6 }]}
          >
            <Txt weight="700" size={15}>
              {providerBusy === p ? "…" : p === "google" ? "Google" : "Discord"}
            </Txt>
          </Pressable>
        ))}
      </Row>
      <Row gap={4} style={{ justifyContent: "center" }}>
        <Txt size={14} color={colors.muted}>
          ليس لديك حساب؟
        </Txt>
        <Pressable onPress={() => router.replace("/register")} hitSlop={6}>
          <Txt size={14} weight="800" color={colors.primary300}>
            أنشئ حسابًا
          </Txt>
        </Pressable>
      </Row>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  provider: {
    flex: 1,
    height: 48,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    backgroundColor: "rgba(255,255,255,0.05)",
    alignItems: "center",
    justifyContent: "center",
  },
});
