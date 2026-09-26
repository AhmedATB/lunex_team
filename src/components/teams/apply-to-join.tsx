"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Loader2, UserPlus } from "lucide-react";
import { useSignedInUserId } from "@/components/session-hint";
import { recruitmentApi, RECRUIT_ROLES, ROLE_LABELS, STATUS_LABELS, type MyApplication, type Position } from "@/lib/recruitment-api";
import type { Team } from "@/lib/types";
import { useToast } from "@/store/toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const UNDECIDED = new Set(["pending", "interview", "waitlist"]);

/**
 * The join button on a team's page. A visitor is asked to sign in; a member sees the team's open positions in an
 * application form that goes to the team's leaders (it is kept on the server), and afterwards the state of their
 * request, which they can take back while it is undecided. Nothing shows for someone already on the team.
 */
export function ApplyToJoin({ team }: { team: Team }) {
  const me = useSignedInUserId();
  const pathname = usePathname();
  const [positions, setPositions] = useState<Position[] | null>(null);
  const [mine, setMine] = useState<MyApplication | null>(null);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    const [p, m] = await Promise.all([recruitmentApi.positions(team.id), me ? recruitmentApi.mine() : Promise.resolve(null)]);
    setPositions(p.ok ? p.body : []);
    if (m && m.ok) setMine(m.body.items.find((a) => a.teamId === team.id && UNDECIDED.has(a.status)) ?? null);
  }, [team.id, me]);

  useEffect(() => {
    void load();
  }, [load]);

  const isMember = !!me && (team.leaderId === me || team.memberIds.includes(me));
  if (isMember || team.status !== "active") return null;
  if (positions === null) return null;
  if (!team.recruiting && positions.length === 0) return null;

  if (!me) {
    return (
      <Button asChild>
        <Link href={`/login?next=${encodeURIComponent(pathname)}`}>
          <UserPlus className="h-4 w-4" /> سجّل الدخول للتقديم
        </Link>
      </Button>
    );
  }

  if (mine) {
    return (
      <div className="flex items-center gap-2">
        <Button variant="secondary" disabled>طلبك: {STATUS_LABELS[mine.status]}</Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={async () => {
            const result = await recruitmentApi.withdraw(mine.id);
            if (!result.ok) return useToast.getState().push({ title: "تعذر سحب الطلب", description: result.message });
            setMine(null);
          }}
        >
          سحب الطلب
        </Button>
      </div>
    );
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <UserPlus className="h-4 w-4" /> قدّم للانضمام
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          {open && (
            <ApplyForm
              team={team}
              positions={positions}
              onSent={async () => {
                setOpen(false);
                await load();
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function ApplyForm({ team, positions, onSent }: { team: Team; positions: Position[]; onSent: () => void | Promise<void> }) {
  const [positionId, setPositionId] = useState(positions[0]?.id ?? "");
  const [role, setRole] = useState<string>("translator");
  const [experience, setExperience] = useState("");
  const [portfolio, setPortfolio] = useState("");
  const [languages, setLanguages] = useState("العربية");
  const [availability, setAvailability] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const position = positions.find((p) => p.id === positionId);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    const result = await recruitmentApi.apply(team.id, {
      ...(position ? { positionId: position.id } : {}),
      preferredRole: position?.role ?? role,
      experience: experience.trim(),
      ...(portfolio.trim() ? { portfolioUrl: portfolio.trim() } : {}),
      languages: languages.split(/[،,]/).map((l) => l.trim()).filter(Boolean),
      availability: availability.trim(),
    });
    setBusy(false);
    if (!result.ok) return setError(result.message);
    useToast.getState().push({ title: "أُرسل طلبك", description: `سيراجعه قائد ${team.name} ويرد عليك، وسيصلك إشعار.` });
    await onSent();
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <DialogHeader>
        <DialogTitle>طلب انضمام إلى {team.name}</DialogTitle>
      </DialogHeader>

      <div className="space-y-1.5">
        <Label>الوظيفة</Label>
        {positions.length > 0 ? (
          <Select value={positionId} onValueChange={setPositionId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {positions.map((p) => <SelectItem key={p.id} value={p.id}>{ROLE_LABELS[p.role] ?? p.role}</SelectItem>)}
            </SelectContent>
          </Select>
        ) : (
          <Select value={role} onValueChange={setRole}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {RECRUIT_ROLES.map((r) => <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        {position?.description && <p className="text-xs text-lunex-gray">{position.description}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="ap-exp">خبرتك السابقة</Label>
        <Textarea id="ap-exp" rows={3} value={experience} onChange={(e) => setExperience(e.target.value)} placeholder="حدّثنا عن خبرتك في هذا المجال..." maxLength={1500} required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ap-port">رابط أعمال سابقة (اختياري)</Label>
        <Input id="ap-port" dir="ltr" value={portfolio} onChange={(e) => setPortfolio(e.target.value)} placeholder="https://..." />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ap-lang">اللغات (افصل بينها بـ ،)</Label>
        <Input id="ap-lang" value={languages} onChange={(e) => setLanguages(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ap-time">مدى التفرغ</Label>
        <Input id="ap-time" value={availability} onChange={(e) => setAvailability(e.target.value)} placeholder="مثال: 3 فصول أسبوعيًا" maxLength={200} required />
      </div>

      {error && <p className="text-sm text-red-400" role="alert">{error}</p>}
      <Button type="submit" className="w-full" disabled={busy || experience.trim().length < 5 || availability.trim().length < 2}>
        {busy && <Loader2 className="h-4 w-4 animate-spin" />} إرسال الطلب
      </Button>
    </form>
  );
}
