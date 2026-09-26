"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, BookOpen, Check, Cloud, DatabaseZap, Loader2 } from "lucide-react";
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

interface StorageStatus {
  backend: "database" | "local" | "r2";
  r2Configured: boolean;
  databaseImages: number;
}

interface CopyReport {
  copied: number;
  alreadyThere: number;
  failed: number;
  remaining: number;
  done: boolean;
  errors: string[];
}

interface ChapterJob {
  state: "idle" | "running" | "done" | "stopped";
  startedAt: string | null;
  finishedAt: string | null;
  published: number;
  pagesSaved: number;
  failed: number;
  alreadyDone: number;
  noPages: number;
  remaining: number | null;
  errors: string[];
  stopReason: string | null;
}

/** Calls an owner-only endpoint and returns its JSON, or the server's own message on failure. */
async function ownerCall<T>(path: string, method: "GET" | "POST"): Promise<{ ok: true; body: T } | { ok: false; message: string; status: number }> {
  try {
    const res = await fetch(path, method === "POST" ? { method, headers: { "Content-Type": "application/json" }, body: "{}" } : { method });
    const body = await res.json().catch(() => null);
    if (!res.ok) return { ok: false, status: res.status, message: body?.message ?? "فشلت العملية." };
    return { ok: true, body: body as T };
  } catch {
    return { ok: false, status: 0, message: "تعذر الاتصال بالخادم." };
  }
}

function ErrorLine({ text }: { text: string }) {
  return (
    <p className="flex items-center gap-1.5 text-sm text-red-400" role="alert">
      <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {text}
    </p>
  );
}

function ErrorList({ errors }: { errors: string[] }) {
  if (errors.length === 0) return null;
  return (
    <details className="text-xs text-red-300">
      <summary className="cursor-pointer">أخطاء ({errors.length})</summary>
      <ul className="mt-1 list-disc space-y-0.5 ps-5">
        {errors.slice(0, 20).map((e) => (
          <li key={e} dir="ltr">
            {e}
          </li>
        ))}
      </ul>
    </details>
  );
}

/** The owner's tools for bringing the old lunexteam.com content over: the catalogue, then the image storage, then the chapters. */
export default function LegacyImportPage() {
  const role = useSession((s) => s.user?.role);

  const [running, setRunning] = useState(false);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [error, setError] = useState("");

  const [storage, setStorage] = useState<StorageStatus | null>(null);
  const [copying, setCopying] = useState(false);
  const [copyTotals, setCopyTotals] = useState<{ copied: number; alreadyThere: number; done: boolean; errors: string[] } | null>(null);
  const [copyError, setCopyError] = useState("");

  const [job, setJob] = useState<ChapterJob | null>(null);
  const [starting, setStarting] = useState(false);
  const [chapterError, setChapterError] = useState("");

  useEffect(() => {
    document.title = "استيراد من الموقع القديم | LUNEX TEAM";
  }, []);

  const loadStorage = useCallback(async () => {
    const result = await ownerCall<StorageStatus>("/api/catalog/import/storage", "GET");
    if (result.ok) setStorage(result.body);
  }, []);

  const loadJob = useCallback(async () => {
    const result = await ownerCall<ChapterJob>("/api/catalog/import/legacy/chapters/status", "GET");
    if (result.ok) setJob(result.body);
  }, []);

  useEffect(() => {
    if (role === "owner") {
      void loadStorage();
      void loadJob();
    }
  }, [role, loadStorage, loadJob]);

  // The import runs on the server; this page only watches it, so it can be closed and reopened.
  const jobRunning = job?.state === "running";
  useEffect(() => {
    if (!jobRunning) return;
    const timer = setInterval(() => void loadJob(), 4000);
    return () => clearInterval(timer);
  }, [jobRunning, loadJob]);

  if (role !== "owner") {
    return <p className="panel p-6 text-center text-sm text-lunex-gray">هذه الصفحة للمالك فقط.</p>;
  }

  async function runCatalog() {
    setRunning(true);
    setError("");
    setReport(null);
    const result = await ownerCall<ImportReport>("/api/catalog/import/legacy", "POST");
    if (result.ok) setReport(result.body);
    else setError(result.status === 429 ? "استخدمت الاستيراد عدة مرات خلال الساعة الماضية. انتظر قليلًا." : result.message);
    setRunning(false);
  }

  async function copyImages() {
    setCopying(true);
    setCopyError("");
    setCopyTotals({ copied: 0, alreadyThere: 0, done: false, errors: [] });
    let copied = 0;
    let alreadyThere = 0;
    for (let round = 0; round < 50; round++) {
      const result = await ownerCall<CopyReport>("/api/catalog/import/storage/copy-to-r2", "POST");
      if (!result.ok) {
        setCopyError(result.message);
        break;
      }
      copied += result.body.copied;
      alreadyThere = Math.max(alreadyThere, result.body.alreadyThere);
      setCopyTotals({ copied, alreadyThere, done: result.body.done, errors: result.body.errors });
      if (result.body.done) break;
      // A round that copied nothing and still has work left is stuck (errors), not slow.
      if (result.body.copied === 0) {
        setCopyError("توقف النسخ بسبب أخطاء. راجع القائمة أدناه.");
        break;
      }
    }
    setCopying(false);
    void loadStorage();
  }

  async function startChapters() {
    setStarting(true);
    setChapterError("");
    const result = await ownerCall<ChapterJob>("/api/catalog/import/legacy/chapters/start", "POST");
    if (result.ok) setJob(result.body);
    else setChapterError(result.message);
    setStarting(false);
  }

  const backendLabel = storage?.backend === "r2" ? "Cloudflare R2" : storage?.backend === "local" ? "قرص محلي (تطوير)" : "قاعدة البيانات";
  const canCopy = Boolean(storage?.r2Configured) && (storage?.databaseImages ?? 0) > 0;
  const canImportChapters = storage?.backend === "r2" || storage?.backend === "local";

  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-bold text-white">استيراد من الموقع القديم</h1>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <DatabaseZap className="h-4 w-4" /> 1. نسخ الكتالوج
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm leading-relaxed text-lunex-gray">
            يقرأ الأعمال والتصنيفات وفرق الترجمة وأغلفة الأعمال من الموقع القديم (lunexteam.com) ويضيفها إلى هذا الموقع. آمن للتكرار: ما هو
            موجود مسبقًا لا يُعدَّل ولا يتكرر، ولا يُحذف شيء. تستغرق العملية نحو دقيقة.
          </p>
          <p className="text-xs text-lunex-gray">الفرق المستوردة بلا قائد إلى أن يسجّل قادتها هنا وتعيّنهم من إدارة الفرق.</p>

          <Button onClick={runCatalog} disabled={running}>
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <DatabaseZap className="h-4 w-4" />}
            {running ? "جاري الاستيراد..." : "ابدأ الاستيراد"}
          </Button>

          {error && <ErrorLine text={error} />}

          {report && (
            <div className="space-y-2 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm" role="status">
              <p className="flex items-center gap-1.5 font-bold text-emerald-400">
                <Check className="h-4 w-4" /> اكتمل الاستيراد
              </p>
              <ul className="space-y-1 text-lunex-gray">
                <li>التصنيفات: أُضيف {report.tags.created}، موجود مسبقًا {report.tags.existing}</li>
                <li>الفرق: أُضيف {report.teams.created}، موجود مسبقًا {report.teams.existing}</li>
                <li>
                  الأعمال: أُضيف {report.series.created}، موجود مسبقًا {report.series.existing}
                  {report.series.skippedUnapproved > 0 && `، تم تجاهل ${report.series.skippedUnapproved} غير معتمد`}
                </li>
                <li>
                  الأغلفة: حُفظ {report.covers.saved}
                  {report.covers.missing > 0 && `، بدون غلاف ${report.covers.missing}`}
                  {report.covers.failed > 0 && `، فشل ${report.covers.failed}`}
                </li>
              </ul>
              <ErrorList errors={report.errors} />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Cloud className="h-4 w-4" /> 2. تخزين الصور (Cloudflare R2)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm leading-relaxed text-lunex-gray">
            صور الفصول تحتاج مخزنًا خاصًا بها؛ ثلاثة آلاف صفحة تقريبًا لا تتسع في قاعدة البيانات. أنشئ حاوية R2 وأضف مفاتيحها في إعدادات Railway
            (R2_ACCOUNT_ID وR2_BUCKET_NAME وR2_ACCESS_KEY_ID وR2_SECRET_ACCESS_KEY)، ثم انسخ الصور الموجودة هنا، ثم غيّر IMAGE_STORAGE_BACKEND إلى r2 في Railway.
          </p>

          {storage ? (
            <ul className="space-y-1 text-sm text-lunex-gray">
              <li>
                مكان الحفظ الحالي: <span className="font-bold text-white">{backendLabel}</span>
              </li>
              <li>
                مفاتيح R2 على الخادم: <span className={storage.r2Configured ? "font-bold text-emerald-400" : "font-bold text-amber-400"}>{storage.r2Configured ? "موجودة" : "غير مضافة بعد"}</span>
              </li>
              <li>صور محفوظة في قاعدة البيانات: {storage.databaseImages}</li>
            </ul>
          ) : (
            <p className="text-xs text-lunex-gray">جاري قراءة حالة التخزين...</p>
          )}

          <Button onClick={copyImages} disabled={copying || !canCopy} variant="outline">
            {copying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Cloud className="h-4 w-4" />}
            {copying ? "جاري النسخ..." : "انسخ الصور الموجودة إلى R2"}
          </Button>
          {storage && !canCopy && (
            <p className="text-xs text-lunex-gray">
              {!storage.r2Configured ? "أضف مفاتيح R2 في Railway أولًا." : "لا توجد صور في قاعدة البيانات لنسخها."}
            </p>
          )}

          {copyError && <ErrorLine text={copyError} />}
          {copyTotals && !copyError && (
            <div className="space-y-2 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm" role="status">
              <p className="flex items-center gap-1.5 font-bold text-emerald-400">
                {copyTotals.done ? <Check className="h-4 w-4" /> : <Loader2 className="h-4 w-4 animate-spin" />}
                {copyTotals.done ? "اكتمل النسخ" : "جاري النسخ"}
              </p>
              <p className="text-lunex-gray">
                نُسخت {copyTotals.copied}، وكانت موجودة {copyTotals.alreadyThere}. النسخ الأصلية تبقى في قاعدة البيانات ولا يُحذف شيء.
              </p>
            </div>
          )}
          {copyTotals && copyTotals.errors.length > 0 && <ErrorList errors={copyTotals.errors} />}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BookOpen className="h-4 w-4" /> 3. الفصول وصورها
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm leading-relaxed text-lunex-gray">
            ينسخ فصول الأعمال المستوردة وصفحاتها من الموقع القديم إلى المخزن. يعمل على دفعات ويكمل تلقائيًا من حيث توقف إن انقطع، ولا ينشر الفصل إلا بعد اكتمال
            صفحاته. الفصل الذي أضفتَه بنفس الرقم يبقى كما هو. الفصول المستوردة كلها مفتوحة للقراء كما في الموقع القديم.
          </p>

          <Button onClick={startChapters} disabled={starting || jobRunning || !canImportChapters}>
            {starting || jobRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <BookOpen className="h-4 w-4" />}
            {jobRunning ? "يعمل على الخادم..." : job?.state === "stopped" ? "تابع استيراد الفصول" : "استورد الفصول"}
          </Button>
          {storage && !canImportChapters && (
            <p className="text-xs text-amber-400">لن يعمل قبل أن يصبح مكان الحفظ الحالي Cloudflare R2 (الخطوة 2).</p>
          )}

          {chapterError && <ErrorLine text={chapterError} />}
          {job && job.state !== "idle" && (
            <div className="space-y-2 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm" role="status">
              <p className={job.state === "stopped" ? "flex items-center gap-1.5 font-bold text-amber-400" : "flex items-center gap-1.5 font-bold text-emerald-400"}>
                {job.state === "done" ? <Check className="h-4 w-4" /> : job.state === "running" ? <Loader2 className="h-4 w-4 animate-spin" /> : <AlertCircle className="h-4 w-4" />}
                {job.state === "done" ? "اكتمل استيراد الفصول" : job.state === "running" ? "الاستيراد شغّال على الخادم، تقدر تغلق هذه الصفحة" : "توقف الاستيراد"}
              </p>
              {job.state === "stopped" && job.stopReason && <p className="text-xs text-amber-300">{job.stopReason}</p>}
              <ul className="space-y-1 text-lunex-gray">
                <li>فصول نُشرت في هذه الجولة: {job.published}، وصفحات حُفظت: {job.pagesSaved}</li>
                <li>
                  فصول جاهزة مسبقًا: {job.alreadyDone}، المتبقي: {job.remaining ?? "—"}
                  {job.noPages > 0 && `، بلا صفحات في الموقع القديم: ${job.noPages}`}
                </li>
              </ul>
              <ErrorList errors={job.errors} />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
