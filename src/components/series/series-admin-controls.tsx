"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, ShieldCheck, Trash2 } from "lucide-react";
import { useCatalog } from "@/components/catalog-provider";
import { useSession } from "@/store/session";
import { useToast } from "@/store/toast";
import { can } from "@/lib/rbac";
import { seriesApi } from "@/lib/series-api";
import type { SeriesStatus } from "@/lib/types";
import { SeriesFormDialog } from "@/components/admin/series-form-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const STATUS_OPTIONS: { value: SeriesStatus; label: string }[] = [
  { value: "ongoing", label: "مستمر" },
  { value: "completed", label: "مكتمل" },
  { value: "hiatus", label: "متوقف مؤقتًا" },
  { value: "dropped", label: "متروك" },
];

const say = (title: string, description?: string) => useToast.getState().push({ title, description });

/**
 * The manager's strip on a series page: the status, editing (title, story, cover, banner, genres ...) and deleting. Shown
 * to owner and editors, and to the leader of the team that publishes the series; every change is a real request to the
 * server, which checks the account's role again.
 */
export function SeriesAdminControls({
  seriesId,
  teamId,
  initialStatus,
}: {
  seriesId: string;
  teamId: string;
  initialStatus: SeriesStatus;
  initialTitleAr?: string;
  initialSynopsis?: string;
  initialCover?: string;
  initialBanner?: string;
}) {
  const router = useRouter();
  const db = useCatalog();
  const currentUserId = useSession((s) => s.currentUserId);
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState(false);

  const currentUser = db.users.find((u) => u.id === currentUserId);
  const series = db.series.find((s) => s.id === seriesId);
  const team = db.teams.find((t) => t.id === teamId);

  const isGlobalEditor = !!currentUser && can(currentUser, "manage_series");
  const leadsTeam = !!currentUser && !!team && team.leaderId === currentUser.id;

  if (!ready || !currentUser || !series || (!isGlobalEditor && !leadsTeam)) return null;

  async function changeStatus(status: SeriesStatus) {
    const result = await seriesApi.update(seriesId, { status });
    if (!result.ok) return say("تعذر تغيير الحالة", result.message);
    router.refresh();
  }

  async function remove() {
    setBusy(true);
    const result = await seriesApi.remove(seriesId);
    setBusy(false);
    if (!result.ok) return say("تعذر الحذف", result.message);
    say("حُذفت السلسلة", series?.titleAr);
    router.push("/series");
    router.refresh();
  }

  return (
    <div className="panel mt-2 flex flex-wrap items-center gap-2 p-3">
      <Badge variant="secondary" className="flex items-center gap-1">
        <ShieldCheck className="h-3 w-3" /> إدارة العمل
      </Badge>
      <Select value={initialStatus} onValueChange={(v) => changeStatus(v as SeriesStatus)}>
        <SelectTrigger className="w-36" aria-label="حالة العمل"><SelectValue /></SelectTrigger>
        <SelectContent>
          {STATUS_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
        </SelectContent>
      </Select>
      <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
        <Pencil className="h-3.5 w-3.5" /> تعديل
      </Button>
      {isGlobalEditor && (
        <Button variant="ghost" size="sm" className="text-red-400 hover:bg-red-500/10" onClick={() => setDeleting(true)}>
          <Trash2 className="h-3.5 w-3.5" /> حذف
        </Button>
      )}

      <SeriesFormDialog open={editing} onClose={() => setEditing(false)} series={series} canEditorial={isGlobalEditor} teams={db.teams} fixedTeamId={isGlobalEditor ? undefined : teamId} />

      <Dialog open={deleting} onOpenChange={setDeleting}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>حذف هذا العمل؟</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-lunex-gray">يُحذف العمل مع كل فصوله وتعليقاته وتقييماته وتقدّم القرّاء فيه. لا يمكن التراجع عن هذا.</p>
          <div className="flex gap-2 pt-2">
            <Button variant="destructive" className="flex-1" onClick={remove} disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} حذف نهائيًا
            </Button>
            <Button variant="secondary" onClick={() => setDeleting(false)}>إلغاء</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** The series' status as a badge. */
export function SeriesStatusBadge({ initialStatus }: { seriesId?: string; initialStatus: SeriesStatus }) {
  const label = STATUS_OPTIONS.find((o) => o.value === initialStatus)?.label ?? initialStatus;
  return <Badge variant="success">{label}</Badge>;
}

/** Kept for the series page's markup; a deleted series is simply gone from the server now, so there is nothing to guard. */
export function SeriesRemovedGuard(props: { seriesId: string }) {
  void props;
  return null;
}

export function SeriesTitleAr({ initialTitleAr }: { seriesId?: string; initialTitleAr: string }) {
  return <>{initialTitleAr}</>;
}

export function SeriesSynopsis({ initialSynopsis }: { seriesId?: string; initialSynopsis: string }) {
  return <>{initialSynopsis}</>;
}

/**
 * Plain <img>, not next/image with `fill` — covers come in every aspect ratio (tall portrait, square, landscape), and a
 * fixed-ratio `fill` box would force every one of them into the same crop.
 */
export function SeriesCoverImage({ initialCover, alt, className }: { seriesId?: string; initialCover: string; alt: string; className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={initialCover} alt={alt} className={className} />;
}

export function SeriesBannerImage({
  initialBanner,
  alt,
  className,
  style,
}: {
  seriesId?: string;
  initialBanner: string;
  alt: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  return <Image src={initialBanner} alt={alt} fill priority sizes="100vw" className={className} style={style} />;
}

/** Collaboration between teams is not kept on the server yet, so there is nothing to show here. */
export function SeriesCollaboratorTeams(props: { seriesId: string }) {
  void props;
  return null;
}
