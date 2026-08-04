"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { notFound } from "next/navigation";
import Image from "next/image";
import { Users, ExternalLink, Crown, MessageCircle, UserPlus } from "lucide-react";
import { getMockDatabase } from "@/lib/mock/generate";
import { useSession } from "@/store/session";
import { useTeamManagement, applyTeamOverride } from "@/store/team-management";
import { useProfile, effectiveAvatarSeed } from "@/store/profile";
import { TEAM_ROLE_LABELS } from "@/lib/rbac";
import { roleTierAvatarClass, roleTierAnimationClass } from "@/lib/role-tier";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { SeriesRow } from "@/components/shared/series-card";
import { TeamDashboardLink } from "@/components/series/team-dashboard-link";
import { avatarUrl, cn, safeDecodeURIComponent } from "@/lib/utils";
import type { RecruitmentPosition } from "@/lib/types";

export default function TeamDetailPage() {
  const params = useParams<{ slug: string }>();
  const slug = safeDecodeURIComponent(params.slug);

  const db = useMemo(() => getMockDatabase(), []);
  const store = useTeamManagement();
  const currentUserId = useSession((s) => s.currentUserId);
  const avatarOverrides = useProfile((s) => s.avatarOverrides);
  const rawTeam = [...db.teams, ...store.createdTeams].find((t) => t.slug === slug);
  const team = rawTeam ? applyTeamOverride(rawTeam, store.teamInfoOverrides) : undefined;

  // Persisted stores use skipHydration + rehydrate-on-mount (see StoreHydration), so
  // `createdTeams` is still empty on the very first client render after a hard reload.
  // Wait one tick before trusting a "not found" result, or a freshly created team 404s.
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  useEffect(() => {
    document.title = team ? `${team.name} | LUNEX TEAM` : "غير موجود | LUNEX TEAM";
  }, [team]);

  if (!ready) return null;
  if (!team) {
    notFound();
  }

  const removedIds = new Set(store.removedMemberIds[team.id] ?? []);
  const members = team.memberIds
    .filter((id) => !removedIds.has(id))
    .map((id) => db.users.find((u) => u.id === id))
    .filter(Boolean)
    .map((u) => {
      const override = store.memberRoleOverrides[u!.id];
      return { ...u!, teamRole: override?.teamRole ?? u!.teamRole, customRoleId: override?.customRoleId ?? u!.customRoleId };
    });
  const leader = db.users.find((u) => u.id === team.leaderId);
  const projects = [
    ...db.series.filter((s) => s.teamId === team.id),
    ...store.addedSeries.filter((s) => s.teamId === team.id),
  ];
  const openPositions = [
    ...db.recruitmentPositions.filter((p) => p.teamId === team.id),
    ...store.addedRecruitmentPositions.filter((p) => p.teamId === team.id),
  ]
    .map((p) => ({ ...p, ...store.recruitmentPositionOverrides[p.id] }))
    .filter((p) => p.isOpen);
  const currentUser = db.users.find((u) => u.id === currentUserId);
  const alreadyApplied = Boolean(
    currentUserId &&
      [...db.recruitmentApplications, ...store.addedApplications].some(
        (a) => a.teamId === team.id && a.userId === currentUserId
      )
  );

  return (
    <div className="container space-y-8 py-6">
      <div
        className="relative overflow-hidden rounded-2xl border border-white/10 p-8"
        style={{ background: `linear-gradient(135deg, ${team.color}33, transparent)` }}
      >
        <div className="pointer-events-none absolute inset-0 opacity-70">
          <div className="ambient-blob start-[-10%] top-[-20%] h-56 w-56 bg-primary-600/40" />
          <div className="ambient-blob end-[10%] top-[10%] h-48 w-48 bg-pink-500/25" style={{ animationDelay: "-4s" }} />
        </div>
        <div className="relative flex flex-col items-center gap-4 text-center sm:flex-row sm:text-start">
          <div
            className="magic-border art-glow shine relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl font-display text-3xl font-black text-white"
            style={team.logoUrl ? undefined : { background: `linear-gradient(135deg, ${team.color}, #C084FC)` }}
          >
            {team.logoUrl ? (
              <Image src={team.logoUrl} alt={team.name} fill className="object-cover" unoptimized />
            ) : (
              team.name[0]
            )}
          </div>
          <div className="flex-1">
            <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              <h1 className="font-display text-3xl font-black text-white">{team.name}</h1>
              <Badge variant={team.recruiting ? "success" : "secondary"}>
                {team.recruiting ? "يستقبل طلبات انضمام" : "مكتمل العدد"}
              </Badge>
              {team.status !== "active" && (
                <Badge variant={team.status === "suspended" ? "warning" : "secondary"}>
                  {team.status === "suspended" ? "معلّق" : "مؤرشف"}
                </Badge>
              )}
            </div>
            <p className="mt-2 max-w-xl text-sm text-lunex-gray">{team.description}</p>
          </div>
          <div className="flex gap-2">
            <TeamDashboardLink teamId={team.id} teamSlug={team.slug} leaderId={team.leaderId} />
            {team.recruiting && currentUser && currentUser.teamId !== team.id && (
              <ApplyToJoinDialog
                positions={openPositions}
                alreadyApplied={alreadyApplied}
                onSubmit={(patch) => store.submitApplication({ teamId: team.id, userId: currentUser.id, ...patch })}
              />
            )}
            {currentUserId && currentUserId !== team.leaderId && (
              <Button variant="secondary" asChild>
                <Link href={`/messages?to=${team.leaderId}`}>
                  <MessageCircle className="h-4 w-4" /> راسل القائد
                </Link>
              </Button>
            )}
            {team.discordUrl && (
              <Button variant="secondary" asChild>
                <a href={team.discordUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4" /> Discord
                </a>
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <MiniStat label="المشاريع" value={projects.length} />
        <MiniStat label="الأعضاء" value={members.length} />
        <MiniStat label="الترتيب" value={team.rank} prefix="#" />
      </div>

      <div className="magic-divider" />

      <section className="space-y-4">
        <h2 className="section-title font-display text-xl font-bold text-white">الأعضاء</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {members.map((m) => {
            const isLeader = m!.id === leader?.id;
            return (
            <div key={m!.id} className="panel panel-hover flex items-center gap-3 p-3">
              <div
                className={cn(
                  "relative h-10 w-10 shrink-0 overflow-hidden rounded-full",
                  roleTierAvatarClass(m!.teamRole, isLeader),
                  roleTierAnimationClass(m!.teamRole, isLeader)
                )}
              >
                <Image src={avatarUrl(effectiveAvatarSeed(m!, avatarOverrides))} alt={m!.displayName} fill className="object-cover" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-white">{m!.displayName}</p>
                <p className="text-xs text-primary-300">{m!.teamRole ? TEAM_ROLE_LABELS[m!.teamRole] : "عضو"}</p>
              </div>
              {m!.id === leader?.id && (
                <Crown className="hover-pop h-4 w-4 shrink-0 fill-amber-300 text-amber-300 drop-shadow-[0_0_6px_rgba(252,211,77,0.6)]" />
              )}
            </div>
            );
          })}
        </div>
      </section>

      {projects.length > 0 && (
        <>
          <div className="magic-divider" />
          <SeriesRow title="مشاريع الفريق" series={projects} />
        </>
      )}
    </div>
  );
}

function MiniStat({ label, value, prefix = "" }: { label: string; value: number; prefix?: string }) {
  return (
    <div className="panel panel-hover flex flex-col items-center gap-1 py-4 text-center">
      <span className="flex items-center gap-1 font-display text-xl font-bold text-white">
        <Users className="h-4 w-4 text-primary-300" /> {prefix}{value}
      </span>
      <span className="text-xs text-lunex-gray">{label}</span>
    </div>
  );
}

function ApplyToJoinDialog({
  positions,
  alreadyApplied,
  onSubmit,
}: {
  positions: RecruitmentPosition[];
  alreadyApplied: boolean;
  onSubmit: (patch: {
    positionId: string;
    preferredRole: RecruitmentPosition["role"];
    experience: string;
    portfolioUrl?: string;
    languages: string[];
    availability: string;
  }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [positionId, setPositionId] = useState(positions[0]?.id ?? "");
  const [experience, setExperience] = useState("");
  const [portfolioUrl, setPortfolioUrl] = useState("");
  const [languages, setLanguages] = useState("العربية");
  const [availability, setAvailability] = useState("");
  const [submitted, setSubmitted] = useState(false);

  function submit() {
    const position = positions.find((p) => p.id === positionId);
    if (!position || !experience.trim() || !availability.trim()) return;
    onSubmit({
      positionId: position.id,
      preferredRole: position.role,
      experience: experience.trim(),
      portfolioUrl: portfolioUrl.trim() || undefined,
      languages: languages.split("،").map((l) => l.trim()).filter(Boolean),
      availability: availability.trim(),
    });
    setSubmitted(true);
  }

  if (alreadyApplied) {
    return <Button variant="secondary" disabled>تم إرسال طلبك</Button>;
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setSubmitted(false); }}>
      <DialogTrigger asChild>
        <Button disabled={positions.length === 0}>
          <UserPlus className="h-4 w-4" /> قدّم للانضمام
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>طلب انضمام للفريق</DialogTitle></DialogHeader>
        {submitted ? (
          <p className="py-4 text-center text-sm text-lunex-gray">
            تم إرسال طلبك بنجاح! سيراجع قائد الفريق طلبك ويرد عليك قريباً.
          </p>
        ) : positions.length === 0 ? (
          <p className="py-4 text-center text-sm text-lunex-gray">لا توجد وظائف مفتوحة حالياً لدى هذا الفريق.</p>
        ) : (
          <div className="space-y-3 pt-2">
            <div className="space-y-1.5">
              <Label>الوظيفة</Label>
              <Select value={positionId} onValueChange={setPositionId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {positions.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{TEAM_ROLE_LABELS[p.role]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>خبرتك السابقة</Label>
              <Textarea rows={3} value={experience} onChange={(e) => setExperience(e.target.value)} placeholder="حدّثنا عن خبرتك في هذا المجال..." />
            </div>
            <div className="space-y-1.5">
              <Label>رابط أعمال سابقة (اختياري)</Label>
              <Input value={portfolioUrl} onChange={(e) => setPortfolioUrl(e.target.value)} placeholder="https://..." />
            </div>
            <div className="space-y-1.5">
              <Label>اللغات (افصل بينها بـ ،)</Label>
              <Input value={languages} onChange={(e) => setLanguages(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>مدى التفرغ</Label>
              <Input value={availability} onChange={(e) => setAvailability(e.target.value)} placeholder="مثال: 3 فصول أسبوعياً" />
            </div>
            <Button onClick={submit} className="w-full" disabled={!experience.trim() || !availability.trim()}>
              إرسال الطلب
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
