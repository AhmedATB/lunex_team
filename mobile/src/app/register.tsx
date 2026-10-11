import { router } from "expo-router";
import { AtSign, Check, Eye, EyeOff, Lock, Mail, User } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { AuthShell, Field, OrDivider } from "../components/auth-shell";
import { TurnstileBox } from "../components/turnstile-box";
import { Button, Row, Txt } from "../components/ui";
import { apiJson, ApiError } from "../lib/api";
import { SITE_URL } from "../lib/config";
import { cleanDisplayName, displayNameProblem } from "@/lib/display-name";
import type { OAuthProvider } from "../lib/oauth";
import { useSession } from "../lib/session";
import * as WebBrowser from "expo-web-browser";
import { colors, radius } from "../theme";

/** The site's three-step sign-up (app/(auth)/register/page.tsx): names, the key, the seal. Same rules and messages. */
type Step = 1 | 2 | 3;
const STEPS: { id: Step; label: string }[] = [
  { id: 1, label: "الاسمان" },
  { id: 2, label: "المفتاح" },
  { id: 3, label: "الختم" },
];

const USERNAME_PATTERN = /^[a-zA-Z0-9_]+$/;
const EMAIL_PATTERN = /^\S+@\S+\.\S+$/;

function passwordScore(password: string): number {
  let score = 0;
  if (password.length >= 12) score++;
  if (password.length >= 16) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password) && /[^A-Za-z0-9]/.test(password)) score++;
  return score;
}
const SCORE_LABELS = ["قصيرة", "مقبولة", "جيدة", "قوية", "ممتازة"];

function usernameProblem(username: string): string | null {
  if (!username) return null;
  if (!USERNAME_PATTERN.test(username)) return "أحرف إنجليزية وأرقام و _ فقط.";
  if (username.length < 3) return "٣ أحرف على الأقل.";
  if (username.length > 24) return "٢٤ حرفًا كحد أقصى.";
  return null;
}

type Availability = "idle" | "checking" | "free" | "taken" | "reserved" | "unknown";

async function checkUsername(username: string): Promise<Availability> {
  try {
    const body = await apiJson<{ available: boolean; reason?: string }>(`/api/auth/username-available?username=${encodeURIComponent(username)}`);
    if (body.available) return "free";
    return body.reason === "reserved" ? "reserved" : "taken";
  } catch {
    return "unknown";
  }
}

function suggestNames(username: string): string[] {
  const base = username.slice(0, 19);
  const digits = () => String(Math.floor(10 + Math.random() * 90));
  return [`${base}_${digits()}`, `${base.slice(0, 21)}${digits()}`];
}

function Stepper({ current }: { current: Step }) {
  return (
    <Row gap={8} style={{ justifyContent: "center" }}>
      {STEPS.map(({ id, label }, i) => {
        const done = id < current;
        const active = id === current;
        return (
          <Row key={id} gap={8}>
            <Row gap={6}>
              <View style={[styles.stepDot, (active || done) && { backgroundColor: colors.primary600, borderColor: colors.primary400 }]}>
                {done ? (
                  <Check size={12} color={colors.text} />
                ) : (
                  <Txt size={11} weight="700">
                    {id}
                  </Txt>
                )}
              </View>
              <Txt size={12} weight="700" color={active ? colors.text : colors.muted}>
                {label}
              </Txt>
            </Row>
            {i < STEPS.length - 1 && <View style={[styles.stepLine, done && { backgroundColor: colors.primary400 }]} />}
          </Row>
        );
      })}
    </Row>
  );
}

export default function RegisterScreen() {
  const { register, loginWithProvider } = useSession();
  const [step, setStep] = useState<Step>(1);
  const [form, setForm] = useState({ displayName: "", username: "", email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [agree, setAgree] = useState(false);
  const [boxToken, setBoxToken] = useState<string | null>(null);
  const [boxReset, setBoxReset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [providerBusy, setProviderBusy] = useState<OAuthProvider | null>(null);
  const [error, setError] = useState("");

  const shownNameProblem = displayNameProblem(form.displayName);
  const shownNameValid = cleanDisplayName(form.displayName).length >= 2 && !shownNameProblem;
  const nameProblem = usernameProblem(form.username);
  const nameValid = form.username.length >= 3 && !nameProblem;

  const [availability, setAvailability] = useState<Availability>("idle");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  useEffect(() => {
    if (!nameValid) {
      setAvailability("idle");
      return;
    }
    setAvailability("checking");
    let stale = false;
    const timer = setTimeout(async () => {
      const result = await checkUsername(form.username);
      if (stale) return;
      setAvailability(result);
      setSuggestions(result === "taken" ? suggestNames(form.username) : []);
    }, 400);
    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [form.username, nameValid]);

  const nameBlocked = availability === "checking" || availability === "taken" || availability === "reserved";
  const emailValid = EMAIL_PATTERN.test(form.email);
  const score = useMemo(() => passwordScore(form.password), [form.password]);
  const passwordValid = form.password.length >= 12;
  const set = (key: keyof typeof form) => (value: string) => setForm((f) => ({ ...f, [key]: value }));

  function next() {
    setError("");
    if (step === 1) {
      if (!shownNameValid) return setError(shownNameProblem ?? "اكتب الاسم الذي يراه القرّاء (حرفان على الأقل).");
      if (!nameValid) return setError(nameProblem ?? "اكتب اسم مستخدم من ٣ أحرف على الأقل.");
      if (nameBlocked) return;
      return setStep(2);
    }
    if (step === 2) {
      if (!emailValid) return setError("اكتب بريدًا إلكترونيًا صحيحًا.");
      if (!passwordValid) return setError("يجب أن تتكون كلمة المرور من 12 حرفًا على الأقل.");
      return setStep(3);
    }
    void createAccount();
  }

  async function createAccount() {
    if (!agree) return setError("يجب الموافقة على الشروط والأحكام وسياسة الخصوصية.");
    if (!boxToken) return setError("أكّد أنك لست روبوتًا بالضغط على المربع أعلاه.");
    setLoading(true);
    setError("");
    try {
      await register({ email: form.email.trim(), username: form.username, displayName: cleanDisplayName(form.displayName), password: form.password }, boxToken);
      router.back();
    } catch (err) {
      const code = err instanceof ApiError ? err.code : undefined;
      if (code === "display_name_reserved") {
        setStep(1);
        setError("هذا الاسم الظاهر محجوز للفريق، اختر اسمًا آخر.");
      } else if (code === "registration_failed") {
        const again = await checkUsername(form.username);
        if (again === "taken" || again === "reserved") {
          setAvailability(again);
          setSuggestions(again === "taken" ? suggestNames(form.username) : []);
          setStep(1);
          setError("سبقك أحدهم إلى هذا الاسم. اختر اسمًا آخر.");
        } else {
          setStep(2);
          setError("تعذر إكمال التسجيل. قد يكون هذا البريد مسجّلًا من قبل؛ جرّب تسجيل الدخول أو بريدًا آخر.");
        }
      } else if (code === "turnstile_required") setError("أكّد أنك لست روبوتًا بالضغط على المربع أعلاه.");
      else if (code === "turnstile_failed") setError("لم ينجح التحقق. حاول مرة أخرى.");
      else if (code === "network") setError("تعذر الاتصال بالخادم، حاول مرة أخرى.");
      else setError(err instanceof ApiError && err.status === 429 ? "محاولات كثيرة. انتظر قليلًا ثم حاول مرة أخرى." : "تعذر إنشاء الحساب.");
    } finally {
      setLoading(false);
      setBoxReset((n) => n + 1);
    }
  }

  async function withProvider(provider: OAuthProvider) {
    setError("");
    setProviderBusy(provider);
    try {
      if (await loginWithProvider(provider)) router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر إنشاء الحساب عبر هذا المزود، حاول مرة أخرى.");
    } finally {
      setProviderBusy(null);
    }
  }

  const availabilityText: Partial<Record<Availability, { text: string; color: string }>> = {
    checking: { text: "جارٍ التحقق…", color: colors.muted },
    free: { text: "متاح ✓", color: colors.emerald300 },
    taken: { text: "مأخوذ", color: "#f87171" },
    reserved: { text: "محجوز", color: "#f87171" },
  };

  return (
    <AuthShell title="إنشاء حساب" subtitle="انضم إلى LUNEX TEAM في ثلاث خطوات">
      <Stepper current={step} />

      {step === 1 && (
        <>
          <Field
            label="الاسم الظاهر"
            icon={<User size={18} color={colors.muted} />}
            value={form.displayName}
            onChangeText={set("displayName")}
            placeholder="مثال: قيس أحمد"
            maxLength={32}
            hint={
              <Txt size={12} color={shownNameProblem ? "#f87171" : colors.muted}>
                {shownNameProblem ?? "الاسم الذي يراه القرّاء في تعليقاتك وملفك."}
              </Txt>
            }
          />
          <Field
            label="اسم المستخدم"
            icon={<AtSign size={18} color={colors.muted} />}
            value={form.username}
            onChangeText={(v) => set("username")(v.trim())}
            placeholder="username"
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={24}
            ltr
            aside={
              availabilityText[availability] ? (
                <Txt size={12} weight="700" color={availabilityText[availability]!.color}>
                  {availabilityText[availability]!.text}
                </Txt>
              ) : undefined
            }
            hint={
              nameProblem ? (
                <Txt size={12} color="#f87171">
                  {nameProblem}
                </Txt>
              ) : suggestions.length > 0 ? (
                <Row gap={8} style={{ flexWrap: "wrap" }}>
                  <Txt size={12} color={colors.muted}>
                    جرّب:
                  </Txt>
                  {suggestions.map((s) => (
                    <Pressable key={s} onPress={() => set("username")(s)} style={styles.suggestion}>
                      <Txt size={12} color={colors.primary300}>
                        {s}
                      </Txt>
                    </Pressable>
                  ))}
                </Row>
              ) : null
            }
          />
        </>
      )}

      {step === 2 && (
        <>
          <Field
            label="البريد الإلكتروني"
            icon={<Mail size={18} color={colors.muted} />}
            value={form.email}
            onChangeText={set("email")}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            ltr
          />
          <Field
            label="كلمة المرور"
            icon={<Lock size={18} color={colors.muted} />}
            value={form.password}
            onChangeText={set("password")}
            placeholder="••••••••••••"
            secureTextEntry={!showPassword}
            autoComplete="new-password"
            ltr
            trailing={
              <Pressable onPress={() => setShowPassword((s) => !s)} hitSlop={8}>
                {showPassword ? <EyeOff size={18} color={colors.muted} /> : <Eye size={18} color={colors.muted} />}
              </Pressable>
            }
            hint={
              <View style={{ gap: 6 }}>
                <Row gap={4}>
                  {[0, 1, 2, 3].map((i) => (
                    <View key={i} style={[styles.meter, i < score && { backgroundColor: score >= 3 ? colors.emerald300 : colors.primary400 }]} />
                  ))}
                </Row>
                <Txt size={12} color={form.password.length >= 12 ? colors.emerald300 : colors.muted}>
                  {form.password ? `قوة كلمة المرور: ${SCORE_LABELS[score]} · ` : ""}١٢ حرفًا على الأقل (مطلوب)
                </Txt>
              </View>
            }
          />
        </>
      )}

      {step === 3 && (
        <>
          <View style={styles.review}>
            {[
              { label: "الاسم الظاهر", value: cleanDisplayName(form.displayName), back: 1 as Step },
              { label: "اسم المستخدم", value: `@${form.username}`, back: 1 as Step },
              { label: "البريد", value: form.email, back: 2 as Step },
            ].map((row, i) => (
              <Row key={row.label} style={[styles.reviewRow, i > 0 && { borderTopWidth: 1, borderTopColor: colors.white5 }]}>
                <Txt size={13} color={colors.muted}>
                  {row.label}
                </Txt>
                <Txt size={13} align="left" numberOfLines={1} style={{ flex: 1 }}>
                  {row.value}
                </Txt>
                <Pressable onPress={() => setStep(row.back)} hitSlop={6}>
                  <Txt size={12} color={colors.primary300}>
                    تعديل
                  </Txt>
                </Pressable>
              </Row>
            ))}
          </View>
          <Pressable onPress={() => setAgree((a) => !a)} style={styles.agree}>
            <Row gap={10} style={{ alignItems: "flex-start" }}>
              <View style={[styles.checkbox, agree && { backgroundColor: colors.primary600, borderColor: colors.primary400 }]}>
                {agree && <Check size={14} color={colors.text} />}
              </View>
              <Txt size={13} color={colors.muted} style={{ flex: 1, lineHeight: 21 }}>
                أوافق على{" "}
                <Txt size={13} color={colors.primary300} onPress={() => WebBrowser.openBrowserAsync(`${SITE_URL}/terms`)}>
                  الشروط والأحكام
                </Txt>{" "}
                و
                <Txt size={13} color={colors.primary300} onPress={() => WebBrowser.openBrowserAsync(`${SITE_URL}/privacy`)}>
                  سياسة الخصوصية
                </Txt>
                .
              </Txt>
            </Row>
          </Pressable>
          <TurnstileBox action="register" onToken={setBoxToken} resetKey={boxReset} />
        </>
      )}

      {error ? (
        <Txt size={13} color="#f87171">
          {error}
        </Txt>
      ) : null}

      <Row gap={8}>
        <Button size="lg" label={step === 3 ? "إنشاء الحساب" : "التالي"} onPress={next} loading={loading} style={{ flex: 1 }} disabled={step === 1 && nameBlocked} />
        {step > 1 && <Button size="lg" variant="secondary" label="السابق" onPress={() => setStep((s) => (s - 1) as Step)} disabled={loading} />}
      </Row>

      {step === 1 && (
        <>
          <OrDivider />
          <Row gap={12}>
            {(["discord", "google"] as const).map((p) => (
              <Pressable key={p} onPress={() => withProvider(p)} disabled={providerBusy !== null} style={styles.provider}>
                <Txt weight="700" size={15}>
                  {providerBusy === p ? "…" : p === "google" ? "Google" : "Discord"}
                </Txt>
              </Pressable>
            ))}
          </Row>
        </>
      )}

      <Row gap={4} style={{ justifyContent: "center" }}>
        <Txt size={14} color={colors.muted}>
          لديك حساب؟
        </Txt>
        <Pressable onPress={() => router.replace("/login")} hitSlop={6}>
          <Txt size={14} weight="800" color={colors.primary300}>
            سجّل الدخول
          </Txt>
        </Pressable>
      </Row>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  stepDot: { width: 22, height: 22, borderRadius: 11, borderWidth: 1, borderColor: colors.white10, alignItems: "center", justifyContent: "center" },
  stepLine: { width: 18, height: 2, borderRadius: 1, backgroundColor: colors.white10 },
  suggestion: { borderRadius: radius.pill, borderWidth: 1, borderColor: "rgba(168,85,247,0.4)", paddingHorizontal: 8, paddingVertical: 2 },
  meter: { flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.white10 },
  review: { borderRadius: 16, borderWidth: 1, borderColor: colors.white10, overflow: "hidden" },
  reviewRow: { justifyContent: "space-between", gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  agree: { borderRadius: 16, borderWidth: 1, borderColor: colors.white10, padding: 16 },
  checkbox: { width: 20, height: 20, borderRadius: 6, borderWidth: 1, borderColor: "rgba(255,255,255,0.25)", alignItems: "center", justifyContent: "center" },
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
