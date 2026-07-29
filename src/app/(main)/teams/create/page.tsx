"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Send } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import { useSession } from "@/store/session";
import { useTeamManagement } from "@/store/team-management";
import { TEAM_ROLE_LABELS } from "@/lib/rbac";
import type { TeamCategory, TeamRole } from "@/lib/types";

const CATEGORY_LABELS: Record<TeamCategory, string> = {
  manhwa: "مانهوا",
  manhua: "مانها",
  manga: "مانجا",
  novel: "روايات",
  mixed: "متنوع",
};

const POSITION_OPTIONS: TeamRole[] = ["translator", "proofreader", "cleaner", "redrawer", "typesetter", "qc", "publisher"];

export default function CreateTeamPage() {
  useEffect(() => {
    document.title = "طلب إنشاء فريق | LUNEX TEAM";
  }, []);

  const router = useRouter();
  const currentUserId = useSession((s) => s.currentUserId);
  const submitTeamRequest = useTeamManagement((s) => s.submitTeamRequest);

  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    teamName: "",
    description: "",
    goals: "",
    discordUrl: "",
    category: "manhwa" as TeamCategory,
    expectedMembers: 8,
    previousExperience: "",
    portfolioUrl: "",
  });
  const [positions, setPositions] = useState<TeamRole[]>([]);
  const [error, setError] = useState("");

  const togglePosition = (role: TeamRole) => {
    setPositions((p) => (p.includes(role) ? p.filter((r) => r !== role) : [...p, role]));
  };

  const canSubmit = useMemo(
    () => form.teamName.trim() && form.description.trim() && form.goals.trim() && positions.length > 0,
    [form, positions]
  );

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!currentUserId) {
      setError("يجب تسجيل الدخول لإرسال طلب إنشاء فريق.");
      return;
    }
    if (!canSubmit) {
      setError("يرجى تعبئة جميع الحقول المطلوبة واختيار وظيفة واحدة على الأقل.");
      return;
    }
    setError("");
    submitTeamRequest({
      requesterId: currentUserId,
      teamName: form.teamName.trim(),
      logoSeed: `lunex-new-team-${Date.now()}`,
      bannerSeed: `lunex-new-team-banner-${Date.now()}`,
      description: form.description.trim(),
      goals: form.goals.trim(),
      discordUrl: form.discordUrl.trim(),
      requiredPositions: positions,
      category: form.category,
      expectedMembers: form.expectedMembers,
      previousExperience: form.previousExperience.trim(),
      portfolioUrl: form.portfolioUrl.trim() || undefined,
    });
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
          سيقوم فريق إدارة المنصة بمراجعة طلبك والرد عليه قريباً. يمكنك متابعة حالة الطلب من لوحة إدارة الطلبات إذا كنت مسؤولاً.
        </p>
        <Button onClick={() => router.push("/teams")}>العودة إلى الفرق</Button>
      </div>
    );
  }

  return (
    <div className="container max-w-2xl space-y-6 py-8">
      <div>
        <h1 className="section-title font-display text-2xl font-black text-white sm:text-3xl">طلب إنشاء فريق جديد</h1>
        <p className="mt-2 text-sm text-lunex-gray">عبّئ النموذج التالي وسيراجع فريق LUNEX طلبك للموافقة عليه.</p>
      </div>

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
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="description">وصف الفريق *</Label>
              <Textarea
                id="description"
                rows={3}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="عرّف عن فريقك وما الذي يميزه..."
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
                placeholder="هل عمل أعضاء الفريق سابقاً في فرق ترجمة أخرى؟"
              />
            </div>

            {error && <p className="text-sm text-red-400">{error}</p>}

            <Button type="submit" size="lg" className="w-full">
              <Send className="h-4 w-4" /> إرسال الطلب
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
