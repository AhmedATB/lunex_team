"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Search, Settings2, ShieldAlert } from "lucide-react";
import { useCatalog } from "@/components/catalog-provider";
import { useSession } from "@/store/session";
import { useToast } from "@/store/toast";
import { can } from "@/lib/rbac";
import { prepareSearchQuery, rankByTier, searchTier } from "@/lib/fuzzy-search";
import { teamApi } from "@/lib/team-api";
import type { Team } from "@/lib/types";
import { TeamManageDialog } from "@/components/admin/team-manage-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const STATUS_LABEL: Record<Team["status"], string> = { active: "نشط", suspended: "معلّق", archived: "مؤرشف" };
const STATUS_VARIANT: Record<Team["status"], "success" | "warning" | "secondary"> = { active: "success", suspended: "warning", archived: "secondary" };

/** Roles that manage teams site-wide; a team's own leader manages theirs from the team's dashboard. */
const TEAM_MANAGING_ROLES = new Set(["owner", "super_administrator", "global_team_manager"]);

export default function AdminTeamsPage() {
  useEffect(() => {
    document.title = "إدارة الفرق | LUNEX TEAM";
  }, []);

  const router = useRouter();
  const db = useCatalog();
  const currentUserId = useSession((s) => s.currentUserId);
  const me = db.users.find((u) => u.id === currentUserId);

  const [query, setQuery] = useState("");
  const [managedId, setManagedId] = useState<string | null>(null);

  const teams = db.teams;
  const shown = useMemo(() => {
    const prepared = prepareSearchQuery(query);
    if (prepared.tokens.length === 0) return teams;
    return rankByTier(teams, (t) => searchTier(prepared, [t.name, t.description]));
  }, [teams, query]);

  if (!me || !TEAM_MANAGING_ROLES.has(me.role)) {
    return (
      <div className="panel flex flex-col items-center gap-3 p-10 text-center">
        <ShieldAlert className="h-10 w-10 text-red-400" />
        <p className="text-white">هذه الصفحة للمالك ومديري الفرق.</p>
        <p className="text-sm text-lunex-gray">قائد الفريق يدير فريقه من «لوحة إدارة الفريق».</p>
      </div>
    );
  }

  const abilities = {
    transfer: can(me, "manage_series"),
    status: can(me, "edit_team"),
    remove: can(me, "delete_team"),
  };
  const worksOf = (teamId: string) => db.series.filter((s) => s.teamId === teamId).length;
  const managed = teams.find((t) => t.id === managedId) ?? null;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-display text-2xl font-bold text-white">إدارة الفرق ({teams.length})</h1>
        <div className="flex gap-2">
          <div className="relative w-full sm:w-56">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-lunex-gray" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ابحث عن فريق..." className="ps-9" />
          </div>
          {can(me, "create_team") && <CreateTeamDialog onCreated={() => router.refresh()} />}
        </div>
      </div>

      <div className="space-y-2">
        {shown.map((team) => {
          const leader = db.users.find((u) => u.id === team.leaderId);
          return (
            <Card key={team.id} className="panel-hover">
              <CardContent className="flex flex-wrap items-center gap-3 p-3.5">
                <div
                  className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl font-display text-lg font-black text-white"
                  style={team.logoUrl ? undefined : { background: `linear-gradient(135deg, ${team.color}, #C084FC)` }}
                >
                  {team.logoUrl ? <Image src={team.logoUrl} alt="" fill sizes="44px" className="object-cover" unoptimized /> : team.name[0]}
                </div>
                <div className="min-w-0 flex-1">
                  <Link href={`/teams/${team.slug}`} className="block truncate text-sm font-bold text-white hover:underline">{team.name}</Link>
                  <p className="truncate text-xs text-lunex-gray">
                    القائد: {leader?.displayName ?? "غير معيّن"} · {team.memberIds.length} عضو · {worksOf(team.id)} عمل
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  {team.recruiting && <Badge variant="success">يستقبل طلبات</Badge>}
                  <Badge variant={STATUS_VARIANT[team.status]}>{STATUS_LABEL[team.status]}</Badge>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <Button size="sm" onClick={() => setManagedId(team.id)}>
                    <Settings2 className="h-3.5 w-3.5" /> إدارة
                  </Button>
                  <Button size="sm" variant="secondary" asChild>
                    <Link href={`/teams/${team.slug}/dashboard`}>لوحة الفريق</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {shown.length === 0 && <div className="panel p-8 text-center text-lunex-gray">لا توجد فرق مطابقة.</div>}
      </div>

      <TeamManageDialog
        team={managed}
        teams={teams}
        series={db.series}
        can={abilities}
        onChanged={() => router.refresh()}
        onClose={() => setManagedId(null)}
      />
    </div>
  );
}

function CreateTeamDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [leader, setLeader] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (name.trim().length < 2 || busy) return;
    setBusy(true);
    setError("");
    const result = await teamApi.create({
      name: name.trim(),
      ...(description.trim() ? { description: description.trim() } : {}),
      ...(leader.trim() ? { leaderUsername: leader.trim().replace(/^@/, "") } : {}),
    });
    setBusy(false);
    if (!result.ok) return setError(result.message);
    useToast.getState().push({ title: "أُنشئ الفريق", description: name.trim() });
    setName(""); setDescription(""); setLeader(""); setOpen(false);
    onCreated();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="h-4 w-4" /> فريق جديد</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>إنشاء فريق</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="new-team-name">اسم الفريق</Label>
            <Input id="new-team-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-team-desc">نبذة (اختياري)</Label>
            <Textarea id="new-team-desc" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-team-leader">القائد (username، اختياري)</Label>
            <Input id="new-team-leader" dir="ltr" value={leader} onChange={(e) => setLeader(e.target.value)} autoComplete="off" />
          </div>
          {error && <p className="text-sm text-red-400" role="alert">{error}</p>}
          <Button type="submit" className="w-full" disabled={busy || name.trim().length < 2}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} إنشاء الفريق
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
