"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { CheckCircle2, Send } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCatalog } from "@/components/catalog-provider";
import { useSession } from "@/store/session";
import { REQUEST_STATUS_LABELS, REQUEST_STATUS_VARIANT, teamRequestApi, type TeamRequest } from "@/lib/team-request-api";
import { TEAM_ROLE_LABELS } from "@/lib/rbac";
import { TEAM_COLOR_PALETTE } from "@/lib/team-colors";
import { CATEGORY_LABELS } from "@/lib/team-labels";
import { cn } from "@/lib/utils";
import type { TeamCategory, TeamRole } from "@/lib/types";

const POSITION_OPTIONS: TeamRole[] = ["translator", "editor", "proofreader", "qc", "publisher"];

const EMPTY_FORM = {
  teamName: "",
  description: "",
  goals: "",
  discordUrl: "",
  category: "manhwa" as TeamCategory,
  expectedMembers: 8,
  previousExperience: "",
  portfolioUrl: "",
  logoUrl: "",
  color: TEAM_COLOR_PALETTE[0] as string,
};

export default function CreateTeamPage() {
  return (
    <Suspense fallback={null}>
      <CreateTeamForm />
    </Suspense>
  );
}

/** Asking to open a team. The request goes to the site's team managers; a decision (or a request for changes) comes back as a notification. */
function CreateTeamForm() {
  useEffect(() => {
    document.title = "طلب إنشاء فريق | LUNEX TEAM";
  }, []);

  const router = useRouter();
  const editId = useSearchParams().get("edit");
  const db = useCatalog();
  const currentUserId = useSession((s) => s.currentUserId);

  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [positions, setPositions] = useState<TeamRole[]>([]);
  const [error, setError] = useState("");
  const [mine, setMine] = useState<TeamRequest[] | null>(null);
  const [prefilled, setPrefilled] = useState(false);

  useEffect(() => {
    void teamRequestApi.mine().then((r) => setMine(r.ok ? r.body.items : []));
  }, [submitted]);

  // The request a manager sent back for changes: its fields go into the form.
  const editing = useMemo(() => (editId && mine ? mine.find((r) => r.id === editId && r.status === "needs_modification") ?? null : null), [editId, mine]);
  useEffect(() => {
    if (!editing || prefilled) return;
    setForm({
      teamName: editing.teamName,
      description: editing.description,
      goals: editing.goals,
      discordUrl: editing.discordUrl,
      category: editing.category as TeamCategory,
      expectedMembers: editing.expectedMembers,
      previousExperience: editing.previousExperience,
      portfolioUrl: editing.portfolioUrl ?? "",
      logoUrl: editing.logoUrl ?? "",
      color: editing.color ?? TEAM_COLOR_PALETTE[0],
    });
    setPositions(editing.requiredPositions as TeamRole[]);
    setPrefilled(true);
  }, [editing, prefilled]);

  const togglePosition = (role: TeamRole) => {
    setPositions((p) => (p.includes(role) ? p.filter((r) => r !== role) : [...p, role]));
  };

  const canSubmit = useMemo(
    () => form.teamName.trim() && form.description.trim() && form.goals.trim() && positions.length > 0,
    [form, positions]
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!currentUserId) {
      setError("يجب تسجيل الدخول لإرسال طلب إنشاء فريق.");
      return;
    }
    if (!canSubmit) {
      setError("يرجى تعبئة جميع الحقول المطلوبة واختيار وظيفة واحدة على الأقل.");
      return;
    }
    setError("");
    setBusy(true);
    const input = {
      teamName: form.teamName.trim(),
      description: form.description.trim(),
      goals: form.goals.trim(),
      discordUrl: form.discordUrl.trim() || undefined,
      requiredPositions: positions,
      category: form.category,
      expectedMembers: form.expectedMembers,
      previousExperience: form.previousExperience.trim(),
      portfolioUrl: form.portfolioUrl.trim() || undefined,
      logoUrl: form.logoUrl.trim() || undefined,
      color: form.color,
    };
    const result = editing ? await teamRequestApi.resubmit(editing.id, input) : await teamRequestApi.create(input);
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="container flex flex-col items-center gap-4 py-24 text-center">
        <div className="relative">
          <div className="pointer-events-none absolute -inset-6 -z-10 opacity-60 blur-2xl">
            <div className="h-full w-full rounded-full bg-emerald-500" />
          </div>
          <CheckCircle2 className="float-slow h-16 w-16 text-emerald-400 drop-shadow-[0_0_20px_rgba(52,211,153,0.6)]" />
        </div>
        <h1 className="section-title font-display text-2xl font-black text-white">تم إرسال طلبك بنجاح</h1>
        <p className="max-w-md text-sm text-lunex-gray">
          سيراجع فريق إدارة المنصة طلبك، وسيصلك إشعار بالقرار أو بما يلزم تعديله.
        </p>
        <Button onClick={() => router.push("/teams")}>العودة إلى الفرق</Button>
      </div>
    );
  }

  return (
    <div className="container max-w-2xl space-y-6 py-8">
      <div>
        <h1 className="section-title font-display text-2xl font-black text-white sm:text-3xl">
          {editing ? "تعديل طلب إنشاء الفريق" : "طلب إنشاء فريق جديد"}
        </h1>
        <p className="mt-2 text-sm text-lunex-gray">
          {editing ? "عدّل ما طُلب منك ثم أعد إرسال الطلب." : "عبّئ النموذج التالي وسيراجع فريق LUNEX طلبك للموافقة عليه."}
        </p>
      </div>

      {editing?.reviewerNote && (
        <p className="border-s-4 border-amber-400 bg-amber-400/10 p-3 text-sm text-amber-300">ملاحظة المراجع: {editing.reviewerNote}</p>
      )}

      {mine && mine.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>طلباتي</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {mine.map((request) => {
              const team = request.createdTeamId ? db.teams.find((t) => t.id === request.createdTeamId) : undefined;
              return (
                <div key={request.id} className="space-y-1.5 rounded-xl border border-white/10 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-display font-bold text-white">{request.teamName}</span>
                    <Badge variant={REQUEST_STATUS_VARIANT[request.status]}>{REQUEST_STATUS_LABELS[request.status]}</Badge>
                  </div>
                  {request.reviewerNote && request.status !== "needs_modification" && (
                    <p className="text-xs text-lunex-gray">ملاحظة المراجع: {request.reviewerNote}</p>
                  )}
                  {request.status === "needs_modification" && request.id !== editing?.id && (
                    <Button asChild size="sm" variant="secondary">
                      <Link href={`/teams/create?edit=${request.id}`}>عدّل الطلب</Link>
                    </Button>
                  )}
                  {team && (
                    <Link href={`/teams/${team.slug}`} className="text-sm font-medium text-primary-300 hover:underline">
                      فتح صفحة الفريق
                    </Link>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>معلومات الفريق</CardTitle>
          <CardDescription>كل الحقول أدناه تساعدنا على تقييم طلبك بشكل أفضل.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="teamName">اسم الفريق *</Label>
              <Input
                id="teamName"
                value={form.teamName}
                onChange={(e) => setForm((f) => ({ ...f, teamName: e.target.value }))}
                placeholder="مثال: Crescent Ink"
                maxLength={80}
              />
            </div>

            <div className="space-y-1.5">
              <Label>شعار الفريق</Label>
              <div className="flex flex-wrap items-center gap-4">
                <div
                  className="art-glow shine relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl font-display text-2xl font-black text-white"
                  style={{ background: `linear-gradient(135deg, ${form.color}, #C084FC)` }}
                >
                  {form.logoUrl.trim() ? (
                    <Image src={form.logoUrl.trim()} alt="معاينة الشعار" fill sizes="64px" className="object-cover" unoptimized />
                  ) : (
                    (form.teamName.trim()[0] ?? "L").toUpperCase()
                  )}
                </div>
                <div className="min-w-[220px] flex-1 space-y-1.5">
                  <Input
                    value={form.logoUrl}
                    onChange={(e) => setForm((f) => ({ ...f, logoUrl: e.target.value }))}
                    placeholder="رابط صورة الشعار (اختياري)"
                  />
                  <p className="text-xs text-lunex-gray">
                    يراه المراجع فقط. يبدأ الفريق بشعار حرف اسمه مع اللون المختار، ويضع مديره الشعار الحقيقي بعد الموافقة.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                {TEAM_COLOR_PALETTE.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={`اختر اللون ${c}`}
                    onClick={() => setForm((f) => ({ ...f, color: c }))}
                    className={cn(
                      "hover-pop h-7 w-7 rounded-full border-2 transition-transform",
                      form.color === c ? "border-white scale-110" : "border-white/20"
                    )}
                    style={{ background: c }}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="description">وصف الفريق *</Label>
              <Textarea
                id="description"
                rows={3}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="عرّف عن فريقك وما الذي يميزه..."
                maxLength={2000}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="goals">أهداف الفريق *</Label>
              <Textarea
                id="goals"
                rows={2}
                value={form.goals}
                onChange={(e) => setForm((f) => ({ ...f, goals: e.target.value }))}
                placeholder="ما الذي يسعى الفريق لتحقيقه؟"
                maxLength={2000}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="discord">رابط سيرفر الديسكورد</Label>
                <Input
                  id="discord"
                  value={form.discordUrl}
                  onChange={(e) => setForm((f) => ({ ...f, discordUrl: e.target.value }))}
                  placeholder="https://discord.gg/..."
                />
              </div>
              <div className="space-y-1.5">
                <Label>تصنيف الفريق</Label>
                <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v as TeamCategory }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>الوظائف المطلوبة *</Label>
              <div className="flex flex-wrap gap-3 pt-1">
                {POSITION_OPTIONS.map((role) => (
                  <label key={role} className="flex items-center gap-2 text-sm text-lunex-gray">
                    <Checkbox checked={positions.includes(role)} onCheckedChange={() => togglePosition(role)} />
                    {TEAM_ROLE_LABELS[role]}
                  </label>
                ))}
              </div>
              <p className="text-xs text-lunex-gray">تُفتح هذه الوظائف للتقديم في صفحة فريقك بعد الموافقة.</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="expectedMembers">عدد الأعضاء المتوقع</Label>
                <Input
                  id="expectedMembers"
                  type="number"
                  min={1}
                  max={100}
                  value={form.expectedMembers}
                  onChange={(e) => setForm((f) => ({ ...f, expectedMembers: Number(e.target.value) }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="portfolio">رابط أعمال سابقة (اختياري)</Label>
                <Input
                  id="portfolio"
                  value={form.portfolioUrl}
                  onChange={(e) => setForm((f) => ({ ...f, portfolioUrl: e.target.value }))}
                  placeholder="https://..."
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="experience">خبرة سابقة</Label>
              <Textarea
                id="experience"
                rows={2}
                value={form.previousExperience}
                onChange={(e) => setForm((f) => ({ ...f, previousExperience: e.target.value }))}
                placeholder="هل عمل أعضاء الفريق سابقًا في فرق ترجمة أخرى؟"
                maxLength={1500}
              />
            </div>

            {error && <p className="text-sm text-red-400" role="alert">{error}</p>}

            <Button type="submit" size="lg" className="w-full" disabled={busy}>
              <Send className="h-4 w-4" /> {editing ? "إعادة إرسال الطلب" : "إرسال الطلب"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
