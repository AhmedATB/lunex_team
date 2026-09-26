"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Check, HandHeart, Handshake, Loader2, MessageCircle, Plus, X } from "lucide-react";
import {
  COLLABORATION_STATUS_LABELS,
  COLLABORATION_TYPE_LABELS,
  collaborationApi,
  type CollaborationRequest,
  type CollaborationStatus,
  type CollaborationType,
} from "@/lib/collaboration-api";
import { useToast } from "@/store/toast";
import { timeAgo } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

interface TeamOption {
  id: string;
  name: string;
  leaderId?: string;
  status?: string;
}

const STATUS_VARIANT: Record<CollaborationStatus, "success" | "destructive" | "warning"> = {
  accepted: "success",
  rejected: "destructive",
  pending: "warning",
  negotiating: "warning",
};

/**
 * Collaboration between teams for a team that is on the site: requests it sent and received, kept on the server so the asked
 * team's leaders really see them. Accepting makes the asked team a collaborator on the series.
 */
export function CollaborationPanel({ teamId, teams, ownSeries, canManage }: { teamId: string; teams: TeamOption[]; ownSeries: { id: string; titleAr: string }[]; canManage: boolean }) {
  const [data, setData] = useState<{ incoming: CollaborationRequest[]; outgoing: CollaborationRequest[] } | null>(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    const result = await collaborationApi.forTeam(teamId);
    if (result.ok) {
      setData(result.body);
      setError("");
    } else {
      setError(result.message);
      setData({ incoming: [], outgoing: [] });
    }
  }, [teamId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function run(id: string, work: () => Promise<{ ok: true } | { ok: false; message: string }>) {
    setBusyId(id);
    const result = await work();
    setBusyId(null);
    if (!result.ok) {
      useToast.getState().push({ title: "تعذر تنفيذ الإجراء", description: result.message });
      return;
    }
    await load();
  }

  const leaderOf = (id: string) => teams.find((t) => t.id === id)?.leaderId;

  const renderRow = (request: CollaborationRequest, incoming: boolean) => {
    const other = incoming ? request.fromTeam : request.toTeam;
    const busy = busyId === request.id;
    const open = request.status === "pending" || request.status === "negotiating";
    const leader = leaderOf(other.id);
    return (
      <Card className="panel-hover">
        <CardContent className="space-y-2 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <HandHeart className="h-5 w-5 shrink-0 text-primary-300" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-white">
                <Link href={`/teams/${other.slug}`} className="hover:underline">{other.name}</Link> — {COLLABORATION_TYPE_LABELS[request.type]}
              </p>
              <p className="text-xs text-lunex-gray">
                <Link href={`/series/${request.series.slug}`} className="hover:underline">{request.series.titleAr}</Link> · {timeAgo(request.createdAt)}
              </p>
            </div>
            <Badge variant={STATUS_VARIANT[request.status]}>{COLLABORATION_STATUS_LABELS[request.status]}</Badge>
          </div>
          <p className="text-sm text-lunex-gray">{request.message}</p>
          {canManage && (
            <div className="flex flex-wrap gap-2">
              {leader && (
                <Button size="sm" variant="secondary" asChild>
                  <Link href={`/messages?to=${leader}`}><MessageCircle className="h-3.5 w-3.5" /> مراسلة القائد</Link>
                </Button>
              )}
              {incoming && open && (
                <>
                  <Button size="sm" disabled={busy} onClick={() => run(request.id, () => collaborationApi.respond(request.id, "accepted"))}>
                    <Check className="h-3.5 w-3.5" /> قبول
                  </Button>
                  {request.status === "pending" && (
                    <Button size="sm" variant="secondary" disabled={busy} onClick={() => run(request.id, () => collaborationApi.respond(request.id, "negotiating"))}>
                      <Handshake className="h-3.5 w-3.5" /> تفاوض
                    </Button>
                  )}
                  <Button size="sm" variant="destructive" disabled={busy} onClick={() => run(request.id, () => collaborationApi.respond(request.id, "rejected"))}>
                    <X className="h-3.5 w-3.5" /> رفض
                  </Button>
                </>
              )}
              {request.status === "accepted" && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-red-400 hover:bg-red-500/10"
                  disabled={busy}
                  onClick={() => {
                    if (window.confirm("إنهاء هذا التعاون؟ لن يبقى الفريق متعاونًا على هذا العمل.")) void run(request.id, () => collaborationApi.endCollaboration(request.series.id, request.toTeam.id));
                  }}
                >
                  إنهاء التعاون
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-4">
      {canManage && (
        <Button size="sm" onClick={() => setCreating(true)} disabled={ownSeries.length === 0}>
          <Plus className="h-3.5 w-3.5" /> طلب تعاون جديد
        </Button>
      )}
      {canManage && ownSeries.length === 0 && <p className="text-xs text-lunex-gray">يلزم أن يكون للفريق عمل واحد على الأقل ليطلب مساعدة عليه.</p>}
      {error && <p className="text-sm text-red-400" role="alert">{error}</p>}

      {data === null ? (
        <div className="flex justify-center p-8 text-lunex-gray"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : (
        (["incoming", "outgoing"] as const).map((direction) => (
          <div key={direction} className="space-y-3">
            <h3 className="font-display text-sm font-black text-white">طلبات {direction === "incoming" ? "واردة" : "صادرة"}</h3>
            {data[direction].map((request) => <div key={request.id}>{renderRow(request, direction === "incoming")}</div>)}
            {data[direction].length === 0 && <p className="text-sm text-lunex-gray">لا توجد طلبات {direction === "incoming" ? "واردة" : "صادرة"}.</p>}
          </div>
        ))
      )}

      <NewRequestDialog
        open={creating}
        onClose={() => setCreating(false)}
        teamId={teamId}
        teams={teams.filter((t) => t.id !== teamId && (t.status ?? "active") === "active")}
        series={ownSeries}
        onSent={async () => {
          setCreating(false);
          await load();
        }}
      />
    </div>
  );
}

function NewRequestDialog({
  open,
  onClose,
  teamId,
  teams,
  series,
  onSent,
}: {
  open: boolean;
  onClose: () => void;
  teamId: string;
  teams: TeamOption[];
  series: { id: string; titleAr: string }[];
  onSent: () => void | Promise<void>;
}) {
  const [toTeamId, setToTeamId] = useState("");
  const [seriesId, setSeriesId] = useState("");
  const [type, setType] = useState<CollaborationType>("need_translator");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setToTeamId("");
      setSeriesId(series.length === 1 ? series[0].id : "");
      setType("need_translator");
      setMessage("");
      setError("");
    }
  }, [open, series]);

  async function submit() {
    if (!toTeamId || !seriesId || message.trim().length < 3 || busy) return;
    setBusy(true);
    setError("");
    const result = await collaborationApi.create({ fromTeamId: teamId, toTeamId, seriesId, type, message: message.trim() });
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    useToast.getState().push({ title: "أُرسل طلب التعاون", description: "سيصل إشعار إلى قادة الفريق الآخر." });
    await onSent();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>طلب تعاون من فريق آخر</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          <div className="space-y-1.5">
            <Label>الفريق المطلوب مساعدته</Label>
            <Select value={toTeamId} onValueChange={setToTeamId}>
              <SelectTrigger><SelectValue placeholder="اختر فريقًا" /></SelectTrigger>
              <SelectContent className="max-h-72">
                {teams.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>العمل</Label>
            <Select value={seriesId} onValueChange={setSeriesId}>
              <SelectTrigger><SelectValue placeholder="اختر عملًا من أعمال فريقك" /></SelectTrigger>
              <SelectContent className="max-h-72">
                {series.map((s) => <SelectItem key={s.id} value={s.id}>{s.titleAr}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>نوع المساعدة</Label>
            <Select value={type} onValueChange={(v) => setType(v as CollaborationType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(COLLABORATION_TYPE_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="collab-message">رسالة للفريق</Label>
            <Textarea id="collab-message" rows={3} value={message} onChange={(e) => setMessage(e.target.value)} maxLength={1000} placeholder="اشرح ما تحتاجونه وما تعرضونه مقابله..." />
          </div>
          {error && <p className="text-sm text-red-400" role="alert">{error}</p>}
          <Button className="w-full" onClick={submit} disabled={!toTeamId || !seriesId || message.trim().length < 3 || busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} إرسال الطلب
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
