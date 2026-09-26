"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useCatalog } from "@/components/catalog-provider";
import { ImagePicker } from "@/components/admin/image-picker";
import { seriesApi, type SeriesInput } from "@/lib/series-api";
import type { Series, Team } from "@/lib/types";
import { useToast } from "@/store/toast";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const TYPES = [
  { value: "manhwa", label: "مانهوا" },
  { value: "manga", label: "مانجا" },
  { value: "manhua", label: "مانها" },
  { value: "novel", label: "رواية" },
];
const STATUSES = [
  { value: "ongoing", label: "مستمر" },
  { value: "completed", label: "مكتمل" },
  { value: "hiatus", label: "متوقف مؤقتًا" },
  { value: "dropped", label: "متروك" },
];
const COUNTRIES = [
  { value: "kr", label: "كوريا" },
  { value: "jp", label: "اليابان" },
  { value: "cn", label: "الصين" },
];
const RATINGS = [
  { value: "safe", label: "للجميع" },
  { value: "suggestive", label: "إيحائي" },
  { value: "erotica", label: "للبالغين" },
  { value: "pornographic", label: "صريح (للبالغين)" },
];

const NO_TEAM = "none";

interface Props {
  open: boolean;
  onClose: () => void;
  /** The series being changed, or null to make a new one. */
  series?: Series | null;
  /**
   * Owner and editors may pick any team and set the editorial flags; a team's leader adding a series for their own team
   * passes `fixedTeamId` instead and sees neither.
   */
  canEditorial: boolean;
  fixedTeamId?: string;
  teams?: Team[];
  onSaved?: () => void;
}

/** Create a series or change one — including its cover and banner, which are chosen from the device, not pasted as links. */
export function SeriesFormDialog({ open, onClose, series = null, canEditorial, fixedTeamId, teams = [], onSaved }: Props) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        {open && <Form key={series?.id ?? "new"} series={series} canEditorial={canEditorial} fixedTeamId={fixedTeamId} teams={teams} onClose={onClose} onSaved={onSaved} />}
      </DialogContent>
    </Dialog>
  );
}

function Form({ series, canEditorial, fixedTeamId, teams = [], onClose, onSaved }: Omit<Props, "open">) {
  const router = useRouter();
  const genres = useCatalog().genres;
  const editing = series !== null && series !== undefined;

  const [titleAr, setTitleAr] = useState(series?.titleAr ?? "");
  const [titleEn, setTitleEn] = useState(series && series.title !== series.titleAr ? series.title : "");
  const [alternatives, setAlternatives] = useState((series?.alternativeTitles ?? []).join("\n"));
  const [synopsis, setSynopsis] = useState(series?.synopsis ?? "");
  const [type, setType] = useState<string>(series?.type ?? "manhwa");
  const [status, setStatus] = useState<string>(series?.status ?? "ongoing");
  const [country, setCountry] = useState<string>(series?.country ?? "kr");
  const [author, setAuthor] = useState(series?.author ?? "");
  const [artist, setArtist] = useState(series?.artist ?? "");
  const [year, setYear] = useState(series?.year ? String(series.year) : "");
  const [rating, setRating] = useState(series?.contentRating ?? "safe");
  const [teamId, setTeamId] = useState(fixedTeamId ?? (series?.teamId || NO_TEAM));
  const [recommended, setRecommended] = useState(series?.isRecommended ?? false);
  const [picked, setPicked] = useState<Set<string>>(new Set(series?.genreIds ?? []));
  const [cover, setCover] = useState<File | null>(null);
  const [banner, setBanner] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => setError(""), [titleAr]);

  function toggleGenre(id: string) {
    setPicked((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!titleAr.trim() || busy) return;
    setBusy(true);
    setError("");

    const parsedYear = Number.parseInt(year, 10);
    const input: SeriesInput = {
      titleAr: titleAr.trim(),
      titleEn: titleEn.trim(),
      alternativeTitles: alternatives.split("\n").map((t) => t.trim()).filter(Boolean).slice(0, 20),
      synopsis: synopsis.trim(),
      type,
      status,
      country,
      author: author.trim(),
      artist: artist.trim(),
      contentRating: rating,
      tagSlugs: genres.filter((g) => picked.has(g.id)).map((g) => g.slug),
      ...(Number.isInteger(parsedYear) && parsedYear >= 1900 && parsedYear <= 2100 ? { year: parsedYear } : {}),
      ...(canEditorial ? { teamId: teamId === NO_TEAM ? "" : teamId, isRecommended: recommended } : {}),
      // A team leader adds to their own team; the backend checks they lead it.
      ...(!editing && !canEditorial && fixedTeamId ? { teamId: fixedTeamId } : {}),
    };

    const saved = editing ? await seriesApi.update(series.id, input) : await seriesApi.create(input);
    if (!saved.ok) {
      setBusy(false);
      setError(saved.message);
      return;
    }

    // The pictures go up after the series exists; if one fails the series is kept and can be given its picture again.
    const failures: string[] = [];
    for (const [kind, file] of [["cover", cover], ["banner", banner]] as const) {
      if (!file) continue;
      const uploaded = await seriesApi.uploadImage(saved.body.id, kind, file);
      if (!uploaded.ok) failures.push(`${kind === "cover" ? "الغلاف" : "البانر"}: ${uploaded.message}`);
    }

    setBusy(false);
    useToast.getState().push(
      failures.length > 0
        ? { title: editing ? "حُفظت السلسلة، لكن تعذر رفع صورة" : "أُنشئت السلسلة، لكن تعذر رفع صورة", description: failures.join(" · ") }
        : { title: editing ? "حُفظت التعديلات" : "أُنشئت السلسلة", description: titleAr.trim() }
    );
    router.refresh();
    onSaved?.();
    onClose();
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <DialogHeader>
        <DialogTitle>{editing ? "تعديل السلسلة" : "سلسلة جديدة"}</DialogTitle>
      </DialogHeader>

      <div className="flex flex-wrap gap-5">
        <ImagePicker label="الغلاف" hint="من جهازك. يُقص إلى 2:3." current={series?.cover} file={cover} onChange={setCover} />
        <ImagePicker label="البانر (اختياري)" hint="صورة عريضة لأعلى صفحة العمل." current={series?.banner} file={banner} onChange={setBanner} aspect="aspect-[8/3]" className="min-w-[14rem] flex-1" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="f-title-ar">الاسم بالعربية *</Label>
          <Input id="f-title-ar" value={titleAr} onChange={(e) => setTitleAr(e.target.value)} maxLength={200} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="f-title-en">الاسم بالإنجليزية</Label>
          <Input id="f-title-en" dir="ltr" value={titleEn} onChange={(e) => setTitleEn(e.target.value)} maxLength={200} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="f-alt">أسماء بديلة (اسم في كل سطر)</Label>
        <Textarea id="f-alt" rows={2} value={alternatives} onChange={(e) => setAlternatives(e.target.value)} placeholder="يظهر العمل في البحث بهذه الأسماء أيضًا" />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="f-synopsis">القصة</Label>
        <Textarea id="f-synopsis" rows={4} value={synopsis} onChange={(e) => setSynopsis(e.target.value)} maxLength={5000} />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Choice label="النوع" value={type} onChange={setType} options={TYPES} />
        <Choice label="الحالة" value={status} onChange={setStatus} options={STATUSES} />
        <Choice label="البلد" value={country} onChange={setCountry} options={COUNTRIES} />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="f-author">المؤلف</Label>
          <Input id="f-author" value={author} onChange={(e) => setAuthor(e.target.value)} maxLength={200} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="f-artist">الرسام</Label>
          <Input id="f-artist" value={artist} onChange={(e) => setArtist(e.target.value)} maxLength={200} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="f-year">سنة الإصدار</Label>
          <Input id="f-year" dir="ltr" inputMode="numeric" value={year} onChange={(e) => setYear(e.target.value.replace(/\D/g, "").slice(0, 4))} />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Choice label="تصنيف المحتوى" value={rating} onChange={setRating} options={RATINGS} />
        {canEditorial ? (
          <div className="space-y-1.5">
            <Label>الفريق الناشر</Label>
            <Select value={teamId} onValueChange={setTeamId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value={NO_TEAM}>بدون فريق</SelectItem>
                {teams.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        ) : null}
      </div>

      {canEditorial && (
        <label className="flex items-center gap-2 text-sm text-lunex-gray">
          <Checkbox checked={recommended} onCheckedChange={(v) => setRecommended(v === true)} />
          من اختيارات المحررين
        </label>
      )}

      <div className="space-y-1.5">
        <Label>التصنيفات</Label>
        <div className="grid max-h-44 grid-cols-2 gap-1.5 overflow-y-auto rounded-xl border border-white/10 p-2.5 sm:grid-cols-3">
          {genres.map((g) => (
            <label key={g.id} className="flex items-center gap-2 text-xs text-lunex-gray">
              <Checkbox checked={picked.has(g.id)} onCheckedChange={() => toggleGenre(g.id)} />
              {g.nameAr}
            </label>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-red-400" role="alert">{error}</p>}
      <Button type="submit" className="w-full" disabled={busy || !titleAr.trim()}>
        {busy && <Loader2 className="h-4 w-4 animate-spin" />} {editing ? "حفظ التعديلات" : "إنشاء السلسلة"}
      </Button>
    </form>
  );
}

function Choice({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          {options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}
