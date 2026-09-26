"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Clock, ExternalLink, Loader2, MessageCircle, Plus, Trash2, X } from "lucide-react";
import { recruitmentApi, RECRUIT_ROLES, ROLE_LABELS, STATUS_LABELS, type Position, type TeamApplication } from "@/lib/recruitment-api";
import { resolveAvatarUrl, timeAgo } from "@/lib/utils";
import { useToast } from "@/store/toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const say = (title: string, description?: string) => useToast.getState().push({ title, description });

type Decision = "accepted" | "interview" | "waitlist" | "rejected";
const DECISION_LABELS: Record<Decision, string> = { accepted: "قبول", interview: "مقابلة", waitlist: "قائمة انتظار", rejected: "رفض" };

/**
 * A team's recruitment, kept on the server: the positions the team opens (an open position is what makes the team show as
 * recruiting), and the applications members send, which the leaders accept (the person joins the team), take to an
 * interview, put on a waiting list or turn down — each with a note, and each telling the applicant.
 */
export function RecruitmentPanel({ teamId, canManage }: { teamId: string; canManage: boolean }) {
  const router = useRouter();
  const [positions, setPositions] = useState<Position[] | null>(null);
  const [applications, setApplications] = useState<TeamApplication[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [deciding, setDeciding] = useState<{ application: TeamApplication; decision: Decision } | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const [p, a] = await Promise.all([recruitmentApi.positions(teamId, true), recruitmentApi.teamApplications(teamId)]);
    setPositions(p.ok ? p.body : []);
    setApplications(a.ok ? a.body.items : []);
    setError(p.ok && a.ok ? "" : !a.ok ? a.message : !p.ok ? p.message : "");
  }, [teamId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function changed(refreshCatalogue = false) {
    await load();
    if (refreshCatalogue) router.refresh(); // the team's "recruiting" badge follows its open positions
  }

  async function toggle(position: Position) {
    const result = await recruitmentApi.setOpen(position.id, !position.isOpen);
    if (!result.ok) return say("تعذر التغيير", result.message);
    await changed(true);
  }

  async function remove(position: Position) {
    const result = await recruitmentApi.removePosition(position.id);
    if (!result.ok) return say("تعذر الحذف", result.message);
    await changed(true);
  }

  if (positions === null || applications === null) {
    return <div className="flex justify-center py-12 text-lunex-gray"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  const waiting = applications.filter((a) => a.status === "pending").length;

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-red-400" role="alert">{error}</p>}

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>الوظائف المفتوحة</CardTitle>
          {canManage && (
            <Button size="sm" onClick={() => setCreating(true)}>
              <Plus className="h-3.5 w-3.5" /> فتح وظيفة
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-2">
          {positions.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center gap-2 border-b border-white/10 pb-2 last:border-0">
              <Badge variant={p.isOpen ? "success" : "secondary"}>{ROLE_LABELS[p.role] ?? p.role}</Badge>
              <span className="min-w-0 flex-1 text-xs text-lunex-gray">{p.description || "بلا وصف"}</span>
              {canManage && (
                <div className="flex shrink-0 gap-1">
                  <Button size="sm" variant="secondary" onClick={() => toggle(p)}>{p.isOpen ? "إغلاق" : "إعادة فتح"}</Button>
                  <Button size="icon" variant="ghost" className="text-red-400 hover:bg-red-500/10" onClick={() => remove(p)} aria-label="حذف الوظيفة">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          ))}
          {positions.length === 0 && <p className="text-sm text-lunex-gray">لا توجد وظائف مفتوحة حاليًا. افتح وظيفة ليظهر الفريق أنه يستقبل طلبات.</p>}
        </CardContent>
      </Card>

      <div className="flex items-center gap-2">
        <h3 className="font-display text-lg font-bold text-white">طلبات الانضمام</h3>
        {waiting > 0 && <Badge variant="warning">{waiting} بانتظار الرد</Badge>}
      </div>

      <div className="space-y-3">
        {applications.map((a) => {
          const undecided = a.status === "pending" || a.status === "interview" || a.status === "waitlist";
          return (
            <Card key={a.id} className="panel-hover">
              <CardContent className="space-y-3 p-4">
                <div className="flex flex-wrap items-start gap-3">
                  <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full ring-2 ring-primary-500/30">
                    <Image src={resolveAvatarUrl(a.applicant.id, a.applicant.avatarVersion, a.applicant.avatarSeed)} alt="" fill sizes="40px" className="object-cover" unoptimized />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-white">
                      <Link href={`/profile/${encodeURIComponent(a.applicant.username)}`} className="hover:text-primary-300">{a.applicant.displayName}</Link>
                      <span className="font-normal text-lunex-gray"> — {ROLE_LABELS[a.preferredRole] ?? a.preferredRole}</span>
                    </p>
                    <p className="whitespace-pre-line text-xs text-lunex-gray">{a.experience}</p>
                    <p className="text-xs text-lunex-gray">
                      اللغات: {a.languages.join("، ") || "—"} · التفرغ: {a.availability} · {timeAgo(a.appliedAt)}
                    </p>
                    {a.portfolioUrl && (
                      <a href={a.portfolioUrl} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 text-xs text-primary-300 hover:underline">
                        <ExternalLink className="h-3 w-3" /> أعمال سابقة
                      </a>
                    )}
                    {a.note && <p className="mt-1 text-xs text-white/80">ملاحظتك: {a.note}</p>}
                  </div>
                  <Badge variant={a.status === "accepted" ? "success" : a.status === "rejected" ? "destructive" : "warning"}>{STATUS_LABELS[a.status]}</Badge>
                </div>

                {canManage && (
                  <div className="flex flex-wrap gap-1.5">
                    <Button size="sm" variant="secondary" asChild>
                      <Link href={`/messages?to=${a.applicant.id}`}><MessageCircle className="h-3.5 w-3.5" /> مراسلة</Link>
                    </Button>
                    {undecided && (
                      <>
                        <Button size="sm" onClick={() => setDeciding({ application: a, decision: "accepted" })}><Check className="h-3.5 w-3.5" /> قبول</Button>
                        {a.status !== "interview" && <Button size="sm" variant="secondary" onClick={() => setDeciding({ application: a, decision: "interview" })}><Clock className="h-3.5 w-3.5" /> مقابلة</Button>}
                        {a.status !== "waitlist" && <Button size="sm" variant="secondary" onClick={() => setDeciding({ application: a, decision: "waitlist" })}>انتظار</Button>}
                        <Button size="sm" variant="destructive" onClick={() => setDeciding({ application: a, decision: "rejected" })}><X className="h-3.5 w-3.5" /> رفض</Button>
                      </>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
        {applications.length === 0 && <div className="panel p-10 text-center text-lunex-gray">لا توجد طلبات انضمام بعد.</div>}
      </div>

      <PositionDialog open={creating} onClose={() => setCreating(false)} teamId={teamId} onCreated={() => changed(true)} />
      <DecisionDialog deciding={deciding} onClose={() => setDeciding(null)} onDone={() => changed(true)} />
    </div>
  );
}

function PositionDialog({ open, onClose, teamId, onCreated }: { open: boolean; onClose: () => void; teamId: string; onCreated: () => void | Promise<void> }) {
  const [role, setRole] = useState<string>("translator");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setRole("translator");
      setDescription("");
      setError("");
    }
  }, [open]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    const result = await recruitmentApi.createPosition(teamId, role, description.trim());
    setBusy(false);
    if (!result.ok) return setError(result.message);
    say("فُتحت الوظيفة", "صار الفريق يظهر أنه يستقبل طلبات على صفحته وفي قائمة الفرق.");
    onClose();
    await onCreated();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <form onSubmit={submit} className="space-y-3">
          <DialogHeader><DialogTitle>فتح وظيفة توظيف جديدة</DialogTitle></DialogHeader>
          <div className="space-y-1.5">
            <Label>الوظيفة المطلوبة</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{RECRUIT_ROLES.map((r) => <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pos-desc">وصف الوظيفة</Label>
            <Textarea id="pos-desc" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={600} placeholder="المتطلبات والمهام المتوقعة..." />
          </div>
          {error && <p className="text-sm text-red-400" role="alert">{error}</p>}
          <Button type="submit" className="w-full" disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} فتح الوظيفة
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DecisionDialog({ deciding, onClose, onDone }: { deciding: { application: TeamApplication; decision: Decision } | null; onClose: () => void; onDone: () => void | Promise<void> }) {
  return (
    <Dialog open={deciding !== null} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        {deciding && <DecisionForm key={deciding.application.id + deciding.decision} application={deciding.application} decision={deciding.decision} onClose={onClose} onDone={onDone} />}
      </DialogContent>
    </Dialog>
  );
}

function DecisionForm({ application, decision, onClose, onDone }: { application: TeamApplication; decision: Decision; onClose: () => void; onDone: () => void | Promise<void> }) {
  const [role, setRole] = useState<string>(application.preferredRole);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    const result = await recruitmentApi.review(application.id, { status: decision, ...(decision === "accepted" ? { role } : {}), ...(note.trim() ? { note: note.trim() } : {}) });
    setBusy(false);
    if (!result.ok) return setError(result.message);
    say(decision === "accepted" ? "أُضيف إلى الفريق" : "حُفظ القرار", `${application.applicant.displayName}: ${DECISION_LABELS[decision]}. وصله إشعار.`);
    onClose();
    await onDone();
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <DialogHeader>
        <DialogTitle>{DECISION_LABELS[decision]}: {application.applicant.displayName}</DialogTitle>
      </DialogHeader>
      {decision === "accepted" && (
        <div className="space-y-1.5">
          <Label>يدخل الفريق بدور</Label>
          <Select value={role} onValueChange={setRole}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{RECRUIT_ROLES.map((r) => <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="dec-note">رسالة له (اختياري)</Label>
        <Textarea id="dec-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder={decision === "interview" ? "مثال: تعال إلى قناة الفريق على ديسكورد الثلاثاء" : "تصله مع الإشعار"} />
      </div>
      {error && <p className="text-sm text-red-400" role="alert">{error}</p>}
      <Button type="submit" className="w-full" variant={decision === "rejected" ? "destructive" : "default"} disabled={busy}>
        {busy && <Loader2 className="h-4 w-4 animate-spin" />} تأكيد
      </Button>
    </form>
  );
}
