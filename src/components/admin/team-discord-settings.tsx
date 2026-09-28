"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { teamApi } from "@/lib/team-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/store/toast";

/**
 * A team's own Discord server: a new chapter, and a new work, can each post there through their own webhook — independent of
 * each other, and independent of the site's own webhooks and role (every server has its own). Shown only to this team's own
 * leader (from the team's dashboard) or a site manager (from «إدارة الفرق»); its data is fetched from its own endpoint so it
 * never rides on the team's public page.
 */
export function TeamDiscordSettings({ teamId }: { teamId: string }) {
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [chapterWebhook, setChapterWebhook] = useState("");
  const [seriesWebhook, setSeriesWebhook] = useState("");
  const [role, setRole] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    void teamApi.getDiscordSettings(teamId).then((result) => {
      if (cancelled) return;
      if (result.ok) {
        setChapterWebhook(result.body.discordChapterWebhookUrl ?? "");
        setSeriesWebhook(result.body.discordSeriesWebhookUrl ?? "");
        setRole(result.body.discordRoleId ?? "");
        setLoadError("");
      } else {
        setLoadError(result.message);
      }
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [teamId]);

  async function save() {
    setBusy(true);
    setError("");
    const result = await teamApi.update(teamId, {
      discordChapterWebhookUrl: chapterWebhook.trim(),
      discordSeriesWebhookUrl: seriesWebhook.trim(),
      discordRoleId: role.trim(),
    });
    setBusy(false);
    if (!result.ok) return setError(result.message);
    useToast.getState().push({ title: "حُفظت إعدادات ديسكورد" });
  }

  return (
    <div className="space-y-3 rounded-xl border border-white/10 bg-white/[0.02] p-3">
      <div>
        <p className="text-sm font-semibold text-white">إشعارات على سيرفر الفريق في ديسكورد</p>
        <p className="mt-0.5 text-xs text-lunex-gray">
          كل واحد من الرابطين اختياري ومستقل عن الآخر — فعّلوا أحدهما أو كليهما. تُنشر الإشعارات هناك بالإضافة إلى قناة الموقع الرئيسية. لا يظهر هذا القسم لغير قائد الفريق ومدراء الموقع.
        </p>
      </div>

      {!loaded ? (
        <p className="flex items-center gap-2 text-sm text-lunex-gray">
          <Loader2 className="h-4 w-4 animate-spin" /> جارٍ التحميل...
        </p>
      ) : (
        <>
          {loadError && (
            <p className="text-sm text-red-400" role="alert">
              {loadError}
            </p>
          )}
          <div className="space-y-1.5">
            <Label htmlFor={`discord-chapter-webhook-${teamId}`}>ويبهوك الفصول الجديدة</Label>
            <Input
              id={`discord-chapter-webhook-${teamId}`}
              dir="ltr"
              value={chapterWebhook}
              onChange={(e) => setChapterWebhook(e.target.value)}
              placeholder="https://discord.com/api/webhooks/..."
              autoComplete="off"
              disabled={busy}
            />
            <p className="text-xs text-lunex-gray">يُنشر إليه عند صدور فصل جديد من إحدى أعمال الفريق.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`discord-series-webhook-${teamId}`}>ويبهوك الأعمال الجديدة</Label>
            <Input
              id={`discord-series-webhook-${teamId}`}
              dir="ltr"
              value={seriesWebhook}
              onChange={(e) => setSeriesWebhook(e.target.value)}
              placeholder="https://discord.com/api/webhooks/..."
              autoComplete="off"
              disabled={busy}
            />
            <p className="text-xs text-lunex-gray">يُنشر إليه عند إضافة عمل جديد للفريق إلى الموقع. يمكن أن يكون نفس رابط الأعلى أو رابطًا آخر — أو تتركوه فارغًا.</p>
          </div>
          <p className="text-xs text-lunex-gray">
            من إعدادات القناة في سيرفركم ← التكاملات ← ويبهوكس ← إنشاء ويبهوك، ثم انسخوا الرابط. كرّروا الخطوة لقناة ثانية إذا أردتم فصل الإشعارين.
          </p>
          <div className="space-y-1.5">
            <Label htmlFor={`discord-role-${teamId}`}>الرتبة المذكورة عند النشر (اختياري)</Label>
            <Input
              id={`discord-role-${teamId}`}
              dir="ltr"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="معرّف الرتبة (أرقام فقط)"
              autoComplete="off"
              disabled={busy}
            />
            <p className="text-xs text-lunex-gray">تُذكر عند النشر على أي من الرابطين أعلاه. فعّلوا «وضع المطوّر» من إعدادات ديسكورد، ثم بيمين الرتبة في سيرفركم ← «نسخ المعرّف». اتركوه فارغًا لعدم ذكر أي رتبة.</p>
          </div>
          {error && (
            <p className="text-sm text-red-400" role="alert">
              {error}
            </p>
          )}
          <Button type="button" size="sm" onClick={save} disabled={busy || !loaded}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} حفظ إعدادات ديسكورد
          </Button>
        </>
      )}
    </div>
  );
}
