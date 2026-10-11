import { router } from "expo-router";
import { Mail, MailCheck } from "lucide-react-native";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { AuthShell, Field } from "../components/auth-shell";
import { TurnstileBox } from "../components/turnstile-box";
import { Button, Row, Txt } from "../components/ui";
import { ApiError } from "../lib/api";
import { useSession } from "../lib/session";
import { colors } from "../theme";

/** The site's /forgot-password: one field; the answer is the same whether or not the address has an account. */
export default function ForgotPasswordScreen() {
  const { forgotPassword } = useSession();
  const [email, setEmail] = useState("");
  const [boxToken, setBoxToken] = useState<string | null>(null);
  const [boxReset, setBoxReset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    setError("");
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError("اكتب بريدًا إلكترونيًا صحيحًا.");
    if (!boxToken) return setError("أكّد أنك لست روبوتًا بالضغط على المربع أعلاه.");
    setLoading(true);
    try {
      await forgotPassword(email, boxToken);
      setSent(true);
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 429
          ? "طلبات كثيرة. انتظر قليلًا ثم حاول مرة أخرى."
          : err instanceof ApiError && err.code === "turnstile_failed"
            ? "لم ينجح التحقق. حاول مرة أخرى."
            : "تعذر إرسال الرابط، حاول مرة أخرى.",
      );
      setBoxReset((n) => n + 1);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell title="نسيت كلمة المرور؟" subtitle="نرسل لك رابطًا لتعيين كلمة مرور جديدة">
      {sent ? (
        <View style={{ alignItems: "center", gap: 12, paddingVertical: 8 }}>
          <MailCheck size={44} color={colors.primary300} />
          <Txt size={14} color={colors.muted} align="center" style={{ lineHeight: 22 }}>
            إن كان هذا البريد مسجّلًا لدينا فستصلك رسالة فيها رابط تعيين كلمة المرور خلال دقائق. تحقق من مجلد الرسائل غير المرغوب فيها أيضًا.
          </Txt>
          <Button label="العودة لتسجيل الدخول" onPress={() => router.replace("/login")} style={{ alignSelf: "stretch" }} />
        </View>
      ) : (
        <>
          <Field
            label="البريد الإلكتروني"
            icon={<Mail size={18} color={colors.muted} />}
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            ltr
          />
          <TurnstileBox action="forgot" onToken={setBoxToken} resetKey={boxReset} />
          {error ? (
            <Txt size={13} color="#f87171">
              {error}
            </Txt>
          ) : null}
          <Button size="lg" label="أرسل رابط التعيين" onPress={submit} loading={loading} />
          <Row gap={4} style={{ justifyContent: "center" }}>
            <Pressable onPress={() => router.replace("/login")} hitSlop={6}>
              <Txt size={14} weight="700" color={colors.primary300}>
                العودة لتسجيل الدخول
              </Txt>
            </Pressable>
          </Row>
        </>
      )}
    </AuthShell>
  );
}
