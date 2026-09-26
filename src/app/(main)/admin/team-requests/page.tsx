"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Check, X, MessageSquareWarning, PauseCircle, Archive, PlayCircle, Loader2 } from "lucide-react";
import { useCatalog } from "@/components/catalog-provider";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { REQUEST_STATUS_LABELS, REQUEST_STATUS_VARIANT, teamRequestApi, type TeamRequest, type TeamRequestStatus } from "@/lib/team-request-api";
import { TEAM_ROLE_LABELS } from "@/lib/rbac";
import { CATEGORY_LABELS } from "@/lib/team-labels";
import { cn, timeAgo } from "@/lib/utils";
import type { TeamRole } from "@/lib/types";

/** Requests to open a team, from the server: every member's, whichever browser it was sent from. */
export default function AdminTeamRequestsPage() {
  useEffect(() => {
    document.title = "طلبات إنشاء الفرق | LUNEX TEAM";
  }, []);

  const db = useCatalog();
  const [statusFilter, setStatusFilter] = useState<"all" | TeamRequestStatus>("all");
  const [requests, setRequests] = useState<TeamRequest[] | null>(null);
  const [error, setError] = useState("");
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const result = await teamRequestApi.list(statusFilter === "all" ? undefined : statusFilter);
    if (result.ok) {
      setRequests(result.body.items);
      setError("");
    } else {
      setError(result.message);
      setRequests([]);
    }
  }, [statusFilter]);

  useEffect(() => {
    setRequests(null);
    void load();
  }, [load]);

  async function act(request: TeamRequest, status: Exclude<TeamRequestStatus, "pending">) {
    setBusyId(request.id);
    setError("");
    const result = await teamRequestApi.review(request.id, status, noteDrafts[request.id]);
    setBusyId(null);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setNoteDrafts((d) => ({ ...d, [request.id]: "" }));
    await load();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="section-title font-display text-2xl font-bold text-white">طلبات إنشاء الفرق{requests ? ` (${requests.length})` : ""}</h1>
          <p className="text-sm text-lunex-gray">راجع طلبات إنشاء الفرق الجديدة واتخذ الإجراء المناسب. تصل القرارات إلى أصحاب الطلبات كإشعارات.</p>
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الحالات</SelectItem>
            {Object.entries(REQUEST_STATUS_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {error && <p className="text-sm text-red-400" role="alert">{error}</p>}

      <div className="space-y-3">
        {requests === null && (
          <div className="panel flex items-center justify-center gap-2 p-10 text-lunex-gray">
            <Loader2 className="h-4 w-4 animate-spin" /> جارٍ التحميل...
          </div>
        )}
        {requests?.map((request) => {
          const team = request.createdTeamId ? db.teams.find((t) => t.id === request.createdTeamId) : undefined;
          const busy = busyId === request.id;
          return (
            <Card
              key={request.id}
              className={cn(
                "panel-hover",
                request.status === "pending" && "ring-2 ring-amber-400/30 shadow-[0_0_28px_rgba(251,191,36,0.2)]"
              )}
            >
              <CardContent className="space-y-3 p-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div
                      className="art-glow shine relative h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-white/10"
                      style={request.logoUrl ? undefined : { background: `linear-gradient(135deg, ${request.color ?? "#A855F7"}, #C084FC)` }}
                    >
                      {request.logoUrl ? (
                        <Image src={request.logoUrl} alt={request.teamName} fill sizes="48px" className="object-cover" unoptimized />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center font-display text-lg font-black text-white">
                          {request.teamName[0]?.toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div>
                      <h3 className="font-display text-lg font-black text-white">{request.teamName}</h3>
                      <p className="text-xs text-lunex-gray">
                        مقدَّم من{" "}
                        <Link href={`/profile/${request.requester.username}`} className="text-primary-300 hover:underline">
                          {request.requester.displayName}
                        </Link>{" "}
                        · {timeAgo(request.createdAt)}
                      </p>
                    </div>
                  </div>
                  <Badge variant={REQUEST_STATUS_VARIANT[request.status]}>{REQUEST_STATUS_LABELS[request.status]}</Badge>
                </div>

                <p className="text-sm text-lunex-gray">{request.description}</p>
                <p className="text-sm text-lunex-gray"><span className="font-bold text-white">الأهداف:</span> {request.goals}</p>

                <div className="flex flex-wrap gap-4 text-xs text-lunex-gray">
                  <span><span className="font-bold text-white">التصنيف:</span> {CATEGORY_LABELS[request.category as keyof typeof CATEGORY_LABELS] ?? request.category}</span>
                  <span><span className="font-bold text-white">الأعضاء المتوقعون:</span> {request.expectedMembers}</span>
                  {request.previousExperience && <span><span className="font-bold text-white">الخبرة:</span> {request.previousExperience}</span>}
                </div>

                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                  {request.discordUrl && <a href={request.discordUrl} target="_blank" rel="noopener noreferrer" className="text-primary-300 hover:underline">سيرفر الديسكورد</a>}
                  {request.portfolioUrl && <a href={request.portfolioUrl} target="_blank" rel="noopener noreferrer" className="text-primary-300 hover:underline">أعمال سابقة</a>}
                  {request.logoUrl && <a href={request.logoUrl} target="_blank" rel="noopener noreferrer" className="text-primary-300 hover:underline">الشعار المقترح</a>}
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {request.requiredPositions.map((p) => (
                    <Badge key={p} variant="secondary" className="text-[10px]">{TEAM_ROLE_LABELS[p as TeamRole] ?? p}</Badge>
                  ))}
                </div>

                {request.reviewerNote && (
                  <p className="border-s-4 border-amber-400 bg-amber-400/10 p-2 text-xs text-amber-300">
                    ملاحظة المراجع: {request.reviewerNote}
                  </p>
                )}

                {team && (
                  <Link href={`/teams/${team.slug}`} className="inline-block text-sm font-medium text-primary-300 hover:underline">
                    فتح صفحة الفريق
                  </Link>
                )}

                {(request.status === "pending" || request.status === "needs_modification") && (
                  <div className="space-y-2 border-t-2 border-white/10 pt-3">
                    <Input
                      value={noteDrafts[request.id] ?? ""}
                      onChange={(e) => setNoteDrafts((d) => ({ ...d, [request.id]: e.target.value }))}
                      placeholder="ملاحظة اختيارية للمتقدم..."
                      maxLength={600}
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" onClick={() => act(request, "approved")} disabled={busy}>
                        <Check className="hover-pop h-3.5 w-3.5" /> قبول
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => act(request, "rejected")} disabled={busy}>
                        <X className="hover-pop h-3.5 w-3.5" /> رفض
                      </Button>
                      {request.status === "pending" && (
                        <Button size="sm" variant="secondary" onClick={() => act(request, "needs_modification")} disabled={busy}>
                          <MessageSquareWarning className="hover-pop h-3.5 w-3.5" /> طلب تعديل
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                {(request.status === "approved" || request.status === "suspended") && (
                  <div className="flex flex-wrap gap-2 border-t-2 border-white/10 pt-3">
                    {request.status === "approved" ? (
                      <Button size="sm" variant="secondary" onClick={() => act(request, "suspended")} disabled={busy}>
                        <PauseCircle className="h-3.5 w-3.5" /> تعليق
                      </Button>
                    ) : (
                      <Button size="sm" variant="secondary" onClick={() => act(request, "approved")} disabled={busy}>
                        <PlayCircle className="h-3.5 w-3.5" /> إعادة تفعيل
                      </Button>
                    )}
                    <Button size="sm" variant="secondary" onClick={() => act(request, "archived")} disabled={busy}>
                      <Archive className="h-3.5 w-3.5" /> أرشفة
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
        {requests?.length === 0 && !error && (
          <div className="panel p-10 text-center text-lunex-gray">لا توجد طلبات بهذه الحالة.</div>
        )}
      </div>
    </div>
  );
}
