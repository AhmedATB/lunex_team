"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertCircle, Check, Eye, Loader2 } from "lucide-react";
import { useSession } from "@/store/session";
import type { BackendPublicUser } from "@/lib/auth-types";
import { PROFILE_VISIBILITY_LEVELS, VISIBILITY_LABELS, type PrivacySettings, type ProfileVisibility } from "@/lib/profile-types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const SECTIONS: { key: keyof PrivacySettings; label: string; hint: string }[] = [
  {
    key: "profileVisibility",
    label: "صفحة ملفي الشخصي",
    hint: "النبذة وتاريخ الانضمام. اسمك وصورتك يظهران دائمًا بجانب تعليقاتك.",
  },
  { key: "historyVisibility", label: "سجل القراءة", hint: "الأعمال التي قرأتها وآخر فصل وصلت إليه. مستواك وعدّاد الفصول يظهران دائمًا في ملفك وفي قائمة أفضل القرّاء." },
  { key: "favoritesVisibility", label: "المفضلة", hint: "الأعمال التي أضفتها إلى مفضلتك." },
];

/** Who may see each part of the account's public profile. Saves as soon as a choice changes. */
export function PrivacyCard({ user }: { user: BackendPublicUser }) {
  const setUser = useSession((s) => s.setUser);
  const [saving, setSaving] = useState<keyof PrivacySettings | null>(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  async function change(key: keyof PrivacySettings, value: ProfileVisibility) {
    if (value === user[key]) return;
    setError("");
    setSaved(false);
    setSaving(key);
    try {
      const res = await fetch("/api/profiles/me/privacy", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: value }),
      });
      if (!res.ok) {
        setError("تعذر حفظ الاختيار، حاول مرة أخرى.");
        return;
      }
      const updated: PrivacySettings = await res.json();
      setUser({ ...user, ...updated });
      setSaved(true);
    } catch {
      setError("تعذر الاتصال بالخادم، حاول مرة أخرى.");
    } finally {
      setSaving(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Eye className="h-4 w-4" /> الخصوصية
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="text-sm leading-relaxed text-lunex-gray">
          اختر من يستطيع رؤية كل قسم في{" "}
          <Link href={`/profile/${encodeURIComponent(user.username)}`} className="text-primary-300 underline-offset-2 hover:underline">
            صفحتك العامة
          </Link>
          . المشرفون يستطيعون رؤية الأقسام المخفية لأغراض الإشراف فقط.
        </p>

        {SECTIONS.map(({ key, label, hint }) => (
          <div key={key} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-0.5">
              <Label htmlFor={`privacy-${key}`} className="text-white">
                {label}
              </Label>
              <p className="text-xs text-lunex-gray">{hint}</p>
            </div>
            <div className="flex items-center gap-2">
              {saving === key && <Loader2 className="h-4 w-4 animate-spin text-lunex-gray" />}
              <Select value={user[key]} onValueChange={(v) => change(key, v as ProfileVisibility)} disabled={saving !== null}>
                <SelectTrigger id={`privacy-${key}`} className="w-52">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROFILE_VISIBILITY_LEVELS.map((level) => (
                    <SelectItem key={level} value={level}>
                      {VISIBILITY_LABELS[level]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        ))}

        {error && (
          <p className="flex items-center gap-1.5 text-sm text-red-400" role="alert">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {error}
          </p>
        )}
        {saved && !error && (
          <p className="flex items-center gap-1.5 text-sm text-emerald-400" role="status">
            <Check className="h-3.5 w-3.5 shrink-0" /> تم حفظ اختيارك.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
