"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { teamApi } from "@/lib/team-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/store/toast";

/**
 * A team's own Discord server: chapter and new-work announcements about this team can also post there, with a webhook and role
 * this team supplies — every server has its own, so the site's own webhook and role never apply here. Shown only to this team's
 * own leader (from the team's dashboard) or a site manager (from «إدارة الفرق»); its data is fetched from its own endpoint so
 * it never rides on the team's public page.
 */
export function TeamDiscordSettings({ teamId }: { teamId: string }) {
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [webhook, setWebhook] = useState("");
  const [role, setRole] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    void teamApi.getDiscordSettings(teamId).then((result) => {
      if (cancelled) return;
      if (result.ok) {
        setWebhook(result.body.discordWebhookUrl ?? "");
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
    const result = await teamApi.update(teamId, { discordWebhookUrl: webhook.trim(), discordRoleId: role.trim() });
    setBusy(false);
    if (!result.ok) return setError(result.message);
    useToast.getState().push({ title: "حُفظت إعدادات ديسكورد" });
  }

  return (
    <div className="space-y-3 rounded-xl border border-white/10 bg-white/[0.02] p-3">
      <div>
        <p className="text-sm font-semibold text-white">إشعارات على سيرفر الفريق في ديسكورد</p>
        <p className="mt-0.5 text-xs text-lunex-gray">
          فصل جديد أو عمل جديد لهذا الفريق يُنشر أيضًا على سيرفركم في ديسكورد، بالإضافة إلى قناة الموقع الرئيسية. لا يظهر هذا القسم لغير قائد الفريق ومدراء الموقع.
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
            <Label htmlFor={`discord-webhook-${teamId}`}>رابط الويبهوك</Label>
            <Input
              id={`discord-webhook-${teamId}`}
              dir="ltr"
              value={webhook}
              onChange={(e) => setWebhook(e.target.value)}
              placeholder="https://discord.com/api/webhooks/..."
              autoComplete="off"
              disabled={busy}
            />
            <p className="text-xs text-lunex-gray">من إعدادات القناة في سيرفركم ← التكاملات ← ويبهوكس ← إنشاء ويبهوك، ثم انسخوا الرابط هنا. اتركوه فارغًا لإيقاف الإرسال لسيرفركم.</p>
          </div>
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
            <p className="text-xs text-lunex-gray">فعّلوا «وضع المطوّر» من إعدادات ديسكورد، ثم بيمين الرتبة في سيرفركم ← «نسخ المعرّف». اتركوه فارغًا لعدم ذكر أي رتبة.</p>
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
