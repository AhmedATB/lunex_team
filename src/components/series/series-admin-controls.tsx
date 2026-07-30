"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Settings2, Trash2, ShieldCheck, ImagePlus } from "lucide-react";
import { getMockDatabase } from "@/lib/mock/generate";
import { useSession } from "@/store/session";
import { useTeamManagement, applyTeamOverride } from "@/store/team-management";
import type { SeriesStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";

const STATUS_OPTIONS: { value: SeriesStatus; label: string }[] = [
  { value: "ongoing", label: "مستمر" },
  { value: "completed", label: "مكتمل" },
  { value: "hiatus", label: "متوقف مؤقتاً" },
  { value: "dropped", label: "متروك" },
];

export function SeriesAdminControls({
  seriesId,
  teamId,
  initialStatus,
  initialTitleAr,
  initialSynopsis,
  initialCover,
  initialBanner,
}: {
  seriesId: string;
  teamId: string;
  initialStatus: SeriesStatus;
  initialTitleAr: string;
  initialSynopsis: string;
  initialCover: string;
  initialBanner: string;
}) {
  const router = useRouter();
  const db = useMemo(() => getMockDatabase(), []);
  const currentUserId = useSession((s) => s.currentUserId);
  const store = useTeamManagement();

  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  const currentUser = db.users.find((u) => u.id === currentUserId);
  const rawTeam = [...db.teams, ...store.createdTeams].find((t) => t.id === teamId);
  const team = rawTeam ? applyTeamOverride(rawTeam, store.teamInfoOverrides) : undefined;

  const isGlobalAdmin = currentUser?.role === "owner" || currentUser?.role === "super_administrator";
  const effectiveTeamRole = currentUser
    ? store.memberRoleOverrides[currentUser.id]?.teamRole ?? currentUser.teamRole
    : undefined;
  const isLeader = Boolean(team && currentUser?.id === team.leaderId);
  const isAssistant = Boolean(team && currentUser?.teamId === team.id && effectiveTeamRole === "assistant_leader");
  const canManage = isGlobalAdmin || isLeader || isAssistant;

  const override = store.seriesInfoOverrides[seriesId];
  const status = override?.status ?? initialStatus;

  if (!ready || !currentUser || !canManage) return null;

  return (
    <div className="panel mt-2 flex flex-wrap items-center gap-2 p-3">
      <Badge variant="secondary" className="flex items-center gap-1">
        <ShieldCheck className="h-3 w-3" /> إدارة العمل
      </Badge>
      <Select
        value={status}
        onValueChange={(v) => store.updateSeriesInfo(seriesId, { status: v as SeriesStatus }, teamId, currentUser.id)}
      >
        <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
        <SelectContent>
          {STATUS_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
        </SelectContent>
      </Select>
      <EditSeriesDialog
        titleAr={override?.titleAr ?? initialTitleAr}
        synopsis={override?.synopsis ?? initialSynopsis}
        cover={override?.cover ?? initialCover}
        banner={override?.banner ?? initialBanner}
        onSave={(patch) => store.updateSeriesInfo(seriesId, patch, teamId, currentUser.id)}
      />
      <DeleteSeriesDialog
        onDelete={() => {
          store.removeSeries(seriesId, teamId, currentUser.id);
          router.push("/series");
        }}
      />
    </div>
  );
}

/** Picks an image from the device (gallery/studio on mobile, file browser on desktop) and reads it as a data URL — no server upload in this mock app. */
function ImageUploadField({
  label,
  value,
  onChange,
  previewClassName,
}: {
  label: string;
  value: string;
  onChange: (dataUrl: string) => void;
  previewClassName: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  function onFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") onChange(reader.result);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className={cn("relative overflow-hidden rounded-xl border border-white/10", previewClassName)}>
        <Image src={value} alt={`معاينة ${label}`} fill className="object-cover" unoptimized />
      </div>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onFileSelected} />
      <Button type="button" size="sm" variant="secondary" className="w-full" onClick={() => inputRef.current?.click()}>
        <ImagePlus className="h-3.5 w-3.5" /> اختر من الجهاز
      </Button>
    </div>
  );
}

function EditSeriesDialog({
  titleAr,
  synopsis,
  cover,
  banner,
  onSave,
}: {
  titleAr: string;
  synopsis: string;
  cover: string;
  banner: string;
  onSave: (patch: { titleAr: string; synopsis: string; cover: string; banner: string }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(titleAr);
  const [text, setText] = useState(synopsis);
  const [coverUrl, setCoverUrl] = useState(cover);
  const [bannerUrl, setBannerUrl] = useState(banner);

  function submit() {
    if (!title.trim()) return;
    onSave({
      titleAr: title.trim(),
      synopsis: text.trim(),
      cover: coverUrl.trim() || cover,
      banner: bannerUrl.trim() || banner,
    });
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="secondary"><Settings2 className="h-3.5 w-3.5" /> تعديل</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[80vh] overflow-y-auto">
        <DialogHeader><DialogTitle>تعديل معلومات العمل</DialogTitle></DialogHeader>
        <div className="space-y-3 pt-2">
          <div className="space-y-1.5">
            <Label>اسم العمل</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>القصة</Label>
            <Textarea rows={4} value={text} onChange={(e) => setText(e.target.value)} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <ImageUploadField
              label="صورة الغلاف"
              value={coverUrl || cover}
              onChange={setCoverUrl}
              previewClassName="aspect-[3/4.2] w-24"
            />
            <ImageUploadField
              label="صورة البانر"
              value={bannerUrl || banner}
              onChange={setBannerUrl}
              previewClassName="h-16 w-full"
            />
          </div>
          <Button onClick={submit} className="w-full">حفظ التغييرات</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DeleteSeriesDialog({ onDelete }: { onDelete: () => void }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="destructive"><Trash2 className="h-3.5 w-3.5" /> حذف</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>حذف العمل نهائياً</DialogTitle></DialogHeader>
        <p className="text-sm text-lunex-gray">
          سيختفي العمل وجميع فصوله من المنصة. هل أنت متأكد؟
        </p>
        <div className="flex gap-2 pt-2">
          <Button variant="destructive" className="flex-1" onClick={onDelete}>
            <Trash2 className="h-4 w-4" /> نعم، احذف العمل
          </Button>
          <Button variant="secondary" className="flex-1" onClick={() => setOpen(false)}>
            تراجع
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Client-side merged status badge — reflects leader/admin status changes instantly. */
export function SeriesStatusBadge({ seriesId, initialStatus }: { seriesId: string; initialStatus: SeriesStatus }) {
  const override = useTeamManagement((s) => s.seriesInfoOverrides[seriesId]);
  const status = override?.status ?? initialStatus;
  const label = STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status;
  return <Badge variant="success">{label}</Badge>;
}

/** Full-screen guard shown when a leader/admin removed this series. */
export function SeriesRemovedGuard({ seriesId }: { seriesId: string }) {
  const removed = useTeamManagement((s) => s.removedSeriesIds.includes(seriesId));
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  if (!ready || !removed) return null;
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-[#09090B] text-center">
      <Trash2 className="h-12 w-12 text-red-400" />
      <h1 className="font-display text-2xl font-bold text-white">تم حذف هذا العمل</h1>
      <p className="text-sm text-lunex-gray">هذا العمل لم يعد متاحاً على المنصة.</p>
      <Button asChild><Link href="/series">تصفح الأعمال الأخرى</Link></Button>
    </div>
  );
}

/**
 * The series page is a Server Component rendering the original mock data —
 * these four small client components read the same seriesInfoOverrides store
 * as the edit dialog, so a leader/admin's edits actually show up on the page
 * instead of only being visible next time the edit dialog is reopened.
 */
export function SeriesTitleAr({ seriesId, initialTitleAr }: { seriesId: string; initialTitleAr: string }) {
  const override = useTeamManagement((s) => s.seriesInfoOverrides[seriesId]);
  return <>{override?.titleAr ?? initialTitleAr}</>;
}

export function SeriesSynopsis({ seriesId, initialSynopsis }: { seriesId: string; initialSynopsis: string }) {
  const override = useTeamManagement((s) => s.seriesInfoOverrides[seriesId]);
  return <>{override?.synopsis ?? initialSynopsis}</>;
}

export function SeriesCoverImage({
  seriesId,
  initialCover,
  alt,
  className,
  sizes,
}: {
  seriesId: string;
  initialCover: string;
  alt: string;
  className?: string;
  sizes?: string;
}) {
  const override = useTeamManagement((s) => s.seriesInfoOverrides[seriesId]);
  const cover = override?.cover ?? initialCover;
  return <Image src={cover} alt={alt} fill sizes={sizes} className={className} unoptimized={Boolean(override?.cover)} />;
}

export function SeriesBannerImage({
  seriesId,
  initialBanner,
  alt,
  className,
  style,
}: {
  seriesId: string;
  initialBanner: string;
  alt: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const override = useTeamManagement((s) => s.seriesInfoOverrides[seriesId]);
  const banner = override?.banner ?? initialBanner;
  return (
    <Image
      src={banner}
      alt={alt}
      fill
      priority
      sizes="100vw"
      className={className}
      style={style}
      unoptimized={Boolean(override?.banner)}
    />
  );
}

/** Teams that joined this series via an accepted collaboration request — shown next to the owning team's badge. */
export function SeriesCollaboratorTeams({ seriesId }: { seriesId: string }) {
  const collaboratorTeamIds = useTeamManagement((s) => s.seriesCollaboratorTeamIds[seriesId]) ?? [];
  const createdTeams = useTeamManagement((s) => s.createdTeams);
  const db = useMemo(() => getMockDatabase(), []);
  if (collaboratorTeamIds.length === 0) return null;
  const teams = [...db.teams, ...createdTeams].filter((t) => collaboratorTeamIds.includes(t.id));
  return (
    <>
      {teams.map((t) => (
        <Link
          key={t.id}
          href={`/teams/${t.slug}`}
          className="panel mt-2 inline-flex items-center gap-2 px-3 py-1.5 text-xs text-lunex-gray transition-colors hover:border-primary-400/40"
        >
          بالتعاون مع <span className="font-semibold text-primary-300">{t.name}</span>
        </Link>
      ))}
    </>
  );
}
