"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Check, DatabaseZap, Loader2 } from "lucide-react";
import { useSession } from "@/store/session";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ImportReport {
  tags: { created: number; existing: number };
  teams: { created: number; existing: number };
  series: { created: number; existing: number; skippedUnapproved: number };
  covers: { saved: number; missing: number; failed: number };
  errors: string[];
}

/** The owner's one-button copy of the old lunexteam.com catalogue into this site's database. */
export default function LegacyImportPage() {
  const role = useSession((s) => s.user?.role);
  const [running, setRunning] = useState(false);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    document.title = "استيراد من الموقع القديم | LUNEX TEAM";
  }, []);

  if (role !== "owner") {
    return <p className="panel p-6 text-center text-sm text-lunex-gray">هذه الصفحة للمالك فقط.</p>;
  }

  async function run() {
    setRunning(true);
    setError("");
    setReport(null);
    try {
      const res = await fetch("/api/catalog/import/legacy", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(res.status === 429 ? "استخدمت الاستيراد عدة مرات خلال الساعة الماضية. انتظر قليلاً." : (body?.message ?? "فشل الاستيراد."));
        return;
      }
      setReport(body);
    } catch {
      setError("تعذر الاتصال بالخادم.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-bold text-white">استيراد من الموقع القديم</h1>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <DatabaseZap className="h-4 w-4" /> نسخ الكتالوج
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm leading-relaxed text-lunex-gray">
            يقرأ الأعمال والتصنيفات وفرق الترجمة وأغلفة الأعمال من الموقع القديم (lunexteam.com) ويضيفها إلى هذا الموقع. آمن للتكرار: ما هو
            موجود مسبقاً لا يُعدَّل ولا يتكرر، ولا يُحذف شيء. الفصول وصورها تُستورد في خطوة منفصلة. تستغرق العملية نحو دقيقة.
          </p>
          <p className="text-xs text-lunex-gray">الفرق المستوردة بلا قائد إلى أن يسجّل قادتها هنا وتعيّنهم من إدارة الفرق.</p>

          <Button onClick={run} disabled={running}>
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <DatabaseZap className="h-4 w-4" />}
            {running ? "جاري الاستيراد..." : "ابدأ الاستيراد"}
          </Button>

          {error && (
            <p className="flex items-center gap-1.5 text-sm text-red-400" role="alert">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {error}
            </p>
          )}

          {report && (
            <div className="space-y-2 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm" role="status">
              <p className="flex items-center gap-1.5 font-bold text-emerald-400">
                <Check className="h-4 w-4" /> اكتمل الاستيراد
              </p>
              <ul className="space-y-1 text-lunex-gray">
                <li>التصنيفات: أُضيف {report.tags.created}، موجود مسبقاً {report.tags.existing}</li>
                <li>الفرق: أُضيف {report.teams.created}، موجود مسبقاً {report.teams.existing}</li>
                <li>
                  الأعمال: أُضيف {report.series.created}، موجود مسبقاً {report.series.existing}
                  {report.series.skippedUnapproved > 0 && `، تم تجاهل ${report.series.skippedUnapproved} غير معتمد`}
                </li>
                <li>
                  الأغلفة: حُفظ {report.covers.saved}
                  {report.covers.missing > 0 && `، بدون غلاف ${report.covers.missing}`}
                  {report.covers.failed > 0 && `، فشل ${report.covers.failed}`}
                </li>
              </ul>
              {report.errors.length > 0 && (
                <details className="text-xs text-red-300">
                  <summary className="cursor-pointer">أخطاء ({report.errors.length})</summary>
                  <ul className="mt-1 list-disc space-y-0.5 ps-5">
                    {report.errors.slice(0, 20).map((e) => (
                      <li key={e} dir="ltr">
                        {e}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
