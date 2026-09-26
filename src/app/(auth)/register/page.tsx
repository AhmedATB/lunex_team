"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowLeft, ArrowRight, AtSign, Check, Eye, EyeOff, Loader2, Lock, Mail, Stamp, User } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useReaderPass } from "@/components/auth/auth-shell";
import { useSession } from "@/store/session";
import { useRealUsers, synthesizeProfile } from "@/store/real-users";
import { mergeRealUsers } from "@/lib/mock/generate";
import { getDeviceFingerprint } from "@/lib/device-fingerprint";
import { cleanDisplayName, displayNameProblem } from "@/lib/display-name";
import { fetchAndSolvePow } from "@/lib/pow-client";
import { nextPathFrom } from "@/lib/safe-next";
import { cn } from "@/lib/utils";

type Step = 1 | 2 | 3;

const STEPS: { id: Step; label: string }[] = [
  { id: 1, label: "الاسمان" },
  { id: 2, label: "المفتاح" },
  { id: 3, label: "الختم" },
];

const USERNAME_PATTERN = /^[a-zA-Z0-9_]+$/;
const EMAIL_PATTERN = /^\S+@\S+\.\S+$/;

/** 0–4: length carries most of the weight; variety adds the rest. Only the 12-character minimum is required (the server enforces it too). */
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

/** Asks the server; if it cannot be reached the form does not get stuck — the server checks again when the account is created. */
async function checkUsername(username: string): Promise<Availability> {
  try {
    const res = await fetch(`/api/auth/username-available?username=${encodeURIComponent(username)}`, { cache: "no-store" });
    if (!res.ok) return "unknown";
    const body: { available: boolean; reason?: string } = await res.json();
    if (body.available) return "free";
    return body.reason === "reserved" ? "reserved" : "taken";
  } catch {
    return "unknown";
  }
}

/** Two nearby names to offer when one is taken; stays within 24 characters. */
function suggestNames(username: string): string[] {
  const base = username.slice(0, 19);
  const digits = () => String(Math.floor(10 + Math.random() * 90));
  return [`${base}_${digits()}`, `${base.slice(0, 21)}${digits()}`];
}

function Stepper({ current }: { current: Step }) {
  return (
    <ol className="flex items-center gap-2" aria-label="خطوات إنشاء الحساب">
      {STEPS.map(({ id, label }, index) => {
        const done = id < current;
        const active = id === current;
        return (
          <li key={id} className="flex flex-1 items-center gap-2" aria-current={active ? "step" : undefined}>
            <span
              className={cn(
                "grid h-8 w-8 shrink-0 place-items-center rounded-full border text-xs font-bold transition-colors duration-300",
                done && "border-transparent bg-lunex-gradient text-white",
                active && "border-primary-400 bg-primary-500/20 text-primary-200 shadow-glow",
                !done && !active && "border-white/15 text-lunex-gray"
              )}
            >
              {done ? <Check className="h-4 w-4" strokeWidth={3} /> : id}
            </span>
            <span className={cn("text-xs font-bold", active ? "text-white" : "text-lunex-gray")}>{label}</span>
            {index < STEPS.length - 1 && (
              <span className="h-px flex-1 overflow-hidden rounded bg-white/10" aria-hidden>
                <span className={cn("block h-full bg-lunex-gradient transition-all duration-500", done ? "w-full" : "w-0")} />
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function FieldMessage({ id, tone, children }: { id: string; tone: "hint" | "ok" | "error"; children: React.ReactNode }) {
  return (
    <p
      id={id}
      aria-live="polite"
      className={cn("flex min-h-5 items-center gap-1.5 text-xs", tone === "error" ? "text-red-400" : tone === "ok" ? "text-emerald-400" : "text-lunex-gray")}
    >
      {tone === "error" && <AlertCircle className="h-3.5 w-3.5 shrink-0" />}
      {tone === "ok" && <Check className="h-3.5 w-3.5 shrink-0" />}
      {children}
    </p>
  );
}

export default function RegisterPage() {
  const router = useRouter();
  const setUser = useSession((s) => s.setUser);
  const [step, setStep] = useState<Step>(1);
  const [form, setForm] = useState({ displayName: "", username: "", email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [agree, setAgree] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sealed, setSealed] = useState(false);
  const [error, setError] = useState("");

  const displayNameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const agreeRef = useRef<HTMLButtonElement>(null);
  const mounted = useRef(false);

  useReaderPass({ username: form.username, displayName: cleanDisplayName(form.displayName), stage: sealed ? "sealed" : loading ? "minting" : "draft" });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("error") === "oauth_failed") setError("تعذر إنشاء الحساب عبر هذا المزود، حاول مرة أخرى.");
    else if (params.get("error") === "oauth_unavailable") setError("التسجيل عبر هذا المزود غير متاح حاليًا.");
  }, []);

  // Each step puts the cursor where the work is; not on first load, so phones do not open the keyboard unasked.
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    (step === 1 ? displayNameRef : step === 2 ? emailRef : agreeRef).current?.focus();
  }, [step]);

  const shownNameProblem = displayNameProblem(form.displayName);
  const shownNameValid = cleanDisplayName(form.displayName).length >= 2 && !shownNameProblem;
  const nameProblem = usernameProblem(form.username);
  const nameValid = form.username.length >= 3 && !nameProblem;

  // Is the name free? Asked shortly after typing stops; the server also treats look-alikes (case, underscores, 0/o, 1/l/i, 5/s) as taken.
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
  const stepValid = step === 1 ? shownNameValid && nameValid && !nameBlocked : step === 2 ? emailValid && passwordValid : agree;

  function goTo(target: Step) {
    setError("");
    setStep(target);
  }

  async function createAccount() {
    setLoading(true);
    setError("");
    try {
      const powSolution = await fetchAndSolvePow();
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-device-fingerprint": getDeviceFingerprint(),
          "x-pow-solution": powSolution,
        },
        body: JSON.stringify({ email: form.email, username: form.username, displayName: cleanDisplayName(form.displayName), password: form.password }),
      });
      const body = await res.json();
      if (!res.ok) {
        const message: string = body?.message ?? "تعذر إنشاء الحساب.";
        if (body?.code === "display_name_reserved") {
          setStep(1);
          setError("هذا الاسم الظاهر محجوز للفريق، اختر اسمًا آخر.");
          return;
        }
        if (body?.code === "registration_failed") {
          // The server does not say which of the two clashed. The name can be asked about; if it is fine, the email is the one.
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
          return;
        }
        setError(message);
        return;
      }
      setUser(body.user);
      useRealUsers.getState().upsertProfile(synthesizeProfile(body.user));
      mergeRealUsers(useRealUsers.getState().profiles);

      // Let the seal land before leaving, unless the person asked for less motion.
      setSealed(true);
      const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      await new Promise((resolve) => setTimeout(resolve, calm ? 0 : 1100));
      router.push(nextPathFrom(window.location.search) ?? "/profile");
      router.refresh();
    } catch {
      setError("تعذر الاتصال بالخادم، حاول مرة أخرى.");
    } finally {
      setLoading(false);
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (loading || sealed) return;
    setError("");
    if (step === 1) {
      if (!shownNameValid) return setError(shownNameProblem ?? "اكتب الاسم الذي يراه القرّاء (حرفان على الأقل).");
      if (!nameValid) return setError(nameProblem ?? "اكتب اسم مستخدم من ٣ أحرف على الأقل.");
      return goTo(2);
    }
    if (step === 2) {
      if (!emailValid) return setError("اكتب بريدًا إلكترونيًا صحيحًا.");
      if (!passwordValid) return setError("يجب أن تتكون كلمة المرور من 12 حرفًا على الأقل.");
      return goTo(3);
    }
    if (!agree) return setError("يجب الموافقة على الشروط والأحكام وسياسة الخصوصية.");
    void createAccount();
  }

  const busy = loading || sealed;

  return (
    <div className="rounded-3xl border border-white/10 bg-card/70 p-6 shadow-glow-lg backdrop-blur-xl sm:p-8">
      <header className="space-y-1.5">
        <h1 className="font-display text-2xl font-extrabold text-white sm:text-3xl">أنشئ بطاقة القارئ</h1>
        <p className="text-sm text-lunex-gray">ثلاث خطوات قصيرة وتُفتح لك البوابة.</p>
      </header>

      <div className="mt-6">
        <Stepper current={step} />
      </div>

      <form onSubmit={submit} className="mt-6 space-y-5" noValidate>
        <div key={step} className="step-in space-y-5">
          {step === 1 && (
            <>
              <div>
                <h2 className="font-display text-lg font-bold text-white">بماذا نناديك؟</h2>
                <p className="text-xs text-lunex-gray">اسمك الظاهر يراه القرّاء في التعليقات وعلى ملفك، واسم المستخدم هو معرّفك الفريد. راقب بطاقتك وهي تتشكّل.</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="displayName">الاسم الظاهر</Label>
                <div className="relative">
                  <User className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-lunex-gray" />
                  <Input
                    id="displayName"
                    ref={displayNameRef}
                    dir="auto"
                    value={form.displayName}
                    onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value.replace(/^\s+/, "").replace(/\s{2,}/g, " ") }))}
                    placeholder="مثال: قيس أحمد"
                    autoComplete="nickname"
                    maxLength={40}
                    aria-invalid={Boolean(shownNameProblem)}
                    aria-describedby="display-name-note"
                    disabled={busy}
                    className="h-12 ps-9 text-start text-base"
                  />
                </div>
                {shownNameProblem ? (
                  <FieldMessage id="display-name-note" tone="error">
                    {shownNameProblem}
                  </FieldMessage>
                ) : (
                  <FieldMessage id="display-name-note" tone="hint">
                    بأي لغة، ويمكنك تغييره لاحقًا. لا يُشترط أن يكون فريدًا.
                  </FieldMessage>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="username">اسم المستخدم</Label>
                <div className="relative">
                  <AtSign className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-lunex-gray" />
                  <Input
                    id="username"
                    dir="ltr"
                    value={form.username}
                    onChange={(e) => setForm((f) => ({ ...f, username: e.target.value.trim() }))}
                    placeholder="username"
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck={false}
                    maxLength={24}
                    aria-invalid={Boolean(nameProblem)}
                    aria-describedby="username-note"
                    disabled={busy}
                    className="h-12 ps-9 text-start text-base"
                  />
                </div>
                {nameProblem ? (
                  <FieldMessage id="username-note" tone="error">
                    {nameProblem}
                  </FieldMessage>
                ) : nameValid && availability === "checking" ? (
                  <FieldMessage id="username-note" tone="hint">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> نتأكد أن الاسم متاح...
                  </FieldMessage>
                ) : nameValid && availability === "free" ? (
                  <FieldMessage id="username-note" tone="ok">
                    الاسم متاح.
                  </FieldMessage>
                ) : nameValid && availability === "reserved" ? (
                  <FieldMessage id="username-note" tone="error">
                    هذا الاسم محجوز للفريق، اختر اسمًا آخر.
                  </FieldMessage>
                ) : nameValid && availability === "taken" ? (
                  <div id="username-note" aria-live="polite" className="space-y-1.5">
                    <p className="flex items-center gap-1.5 text-xs text-red-400">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0" /> هذا الاسم مستخدم أو يشبه اسمًا مستخدمًا. جرّب:
                    </p>
                    <div className="flex flex-wrap gap-2" dir="ltr">
                      {suggestions.map((name) => (
                        <button
                          key={name}
                          type="button"
                          onClick={() => setForm((f) => ({ ...f, username: name }))}
                          className="rounded-full border border-primary-400/50 px-3 py-1 text-xs font-bold text-primary-200 transition-colors hover:bg-primary-500/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                        >
                          {name}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : nameValid ? (
                  <FieldMessage id="username-note" tone="ok">
                    الاسم مناسب. سنتأكد أنه غير مستخدم عند الختم.
                  </FieldMessage>
                ) : (
                  <FieldMessage id="username-note" tone="hint">
                    ٣–٢٤ حرفًا: إنجليزية وأرقام و _ — يظهر في رابط ملفك ولا يتكرر.
                  </FieldMessage>
                )}
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div>
                <h2 className="font-display text-lg font-bold text-white">مفتاح بوابتك</h2>
                <p className="text-xs text-lunex-gray">بريدك لاسترجاع الحساب، وكلمة مرور لا يعرفها أحد غيرك.</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">البريد الإلكتروني</Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-lunex-gray" />
                  <Input
                    id="email"
                    ref={emailRef}
                    type="email"
                    dir="ltr"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value.trim() }))}
                    placeholder="you@example.com"
                    autoComplete="email"
                    inputMode="email"
                    disabled={busy}
                    className="h-12 ps-9 text-start text-base"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">كلمة المرور</Label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-lunex-gray" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    dir="ltr"
                    value={form.password}
                    onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                    placeholder="••••••••••••"
                    autoComplete="new-password"
                    maxLength={256}
                    aria-describedby="password-note"
                    disabled={busy}
                    className="h-12 px-9 text-start text-base"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                    aria-pressed={showPassword}
                    className="absolute end-1 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-lg text-lunex-gray transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>

                <div className="flex items-center gap-2 pt-1" aria-hidden>
                  <div className="flex flex-1 gap-1">
                    {[0, 1, 2, 3].map((i) => (
                      <div key={i} className={cn("h-1.5 flex-1 rounded-full transition-colors duration-300", i < score ? "bg-lunex-gradient" : "bg-white/10")} />
                    ))}
                  </div>
                  <span className="w-12 text-end text-[0.7rem] font-bold text-lunex-gray">{form.password ? SCORE_LABELS[score] : ""}</span>
                </div>
                <ul id="password-note" aria-live="polite" className="space-y-1 pt-1 text-xs">
                  {[
                    { ok: form.password.length >= 12, text: "١٢ حرفًا على الأقل (مطلوب)" },
                    { ok: /[a-z]/.test(form.password) && /[A-Z]/.test(form.password), text: "حروف كبيرة وصغيرة (يقوّيها)" },
                    { ok: /\d/.test(form.password) && /[^A-Za-z0-9]/.test(form.password), text: "أرقام ورمز (يقوّيها)" },
                  ].map((rule) => (
                    <li key={rule.text} className={cn("flex items-center gap-1.5", rule.ok ? "text-emerald-400" : "text-lunex-gray")}>
                      <Check className={cn("h-3.5 w-3.5", !rule.ok && "opacity-30")} /> {rule.text}
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div>
                <h2 className="font-display text-lg font-bold text-white">اختم بطاقتك</h2>
                <p className="text-xs text-lunex-gray">راجع بياناتك، ثم وافق على القواعد وسنختم البطاقة.</p>
              </div>
              <dl className="divide-y divide-white/10 rounded-2xl border border-white/10 bg-black/20 text-sm">
                {[
                  { label: "الاسم الظاهر", value: cleanDisplayName(form.displayName), dir: "auto" as const, back: 1 as Step },
                  { label: "اسم المستخدم", value: `@${form.username}`, dir: "ltr" as const, back: 1 as Step },
                  { label: "البريد", value: form.email, dir: "ltr" as const, back: 2 as Step },
                ].map((row) => (
                  <div key={row.label} className="flex items-center justify-between gap-3 px-4 py-3">
                    <dt className="shrink-0 text-lunex-gray">{row.label}</dt>
                    <dd className="flex min-w-0 items-center gap-3">
                      <span dir={row.dir} className="truncate font-semibold text-white">
                        {row.value}
                      </span>
                      <button type="button" onClick={() => goTo(row.back)} disabled={busy} className="shrink-0 text-xs font-bold text-primary-300 hover:text-primary-200 focus-visible:outline-none focus-visible:underline">
                        تعديل
                      </button>
                    </dd>
                  </div>
                ))}
              </dl>

              <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-white/10 p-4 text-sm leading-relaxed text-lunex-gray transition-colors hover:border-white/20">
                <Checkbox ref={agreeRef} checked={agree} onCheckedChange={(v) => setAgree(v === true)} disabled={busy} className="mt-1 h-5 w-5" />
                <span>
                  أوافق على{" "}
                  <Link href="/terms" target="_blank" className="font-semibold text-primary-300 hover:underline">
                    الشروط والأحكام
                  </Link>{" "}
                  و
                  <Link href="/privacy" target="_blank" className="font-semibold text-primary-300 hover:underline">
                    سياسة الخصوصية
                  </Link>
                  .
                </span>
              </label>
            </>
          )}
        </div>

        {error && (
          <p className="flex items-start gap-1.5 text-sm text-red-400" role="alert">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
          </p>
        )}

        <div className="flex items-center gap-3">
          {step > 1 && (
            <Button type="button" variant="secondary" size="lg" onClick={() => goTo((step - 1) as Step)} disabled={busy} className="shrink-0 px-5" aria-label="الخطوة السابقة">
              <ArrowRight className="h-4 w-4 rtl:rotate-0 ltr:rotate-180" />
              رجوع
            </Button>
          )}
          <Button type="submit" size="lg" className="flex-1" disabled={busy || !stepValid}>
            {step < 3 ? (
              <>
                التالي <ArrowLeft className="h-4 w-4 rtl:rotate-0 ltr:rotate-180" />
              </>
            ) : busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> {sealed ? "أهلًا بك في LUNEX" : "جاري الختم..."}
              </>
            ) : (
              <>
                <Stamp className="h-4 w-4" /> اختم بطاقتي
              </>
            )}
          </Button>
        </div>
      </form>

      {step === 1 && (
        <div className="mt-6 space-y-3">
          <div className="flex items-center gap-3 text-xs text-lunex-gray" aria-hidden>
            <span className="h-px flex-1 bg-white/10" /> أو ابدأ بحساب جاهز <span className="h-px flex-1 bg-white/10" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Button variant="secondary" type="button" asChild className="h-11">
              <a href="/api/auth/oauth/google/start">Google</a>
            </Button>
            <Button variant="secondary" type="button" asChild className="h-11">
              <a href="/api/auth/oauth/discord/start">Discord</a>
            </Button>
          </div>
        </div>
      )}

      <p className="mt-6 text-center text-sm text-lunex-gray">
        لديك حساب بالفعل؟{" "}
        <Link href="/login" className="font-semibold text-primary-300 hover:text-primary-200">
          سجّل الدخول
        </Link>
      </p>
    </div>
  );
}
