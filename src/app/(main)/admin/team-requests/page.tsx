"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { Check, X, MessageSquareWarning, PauseCircle, Archive } from "lucide-react";
import { getMockDatabase } from "@/lib/mock/generate";
import { useTeamManagement } from "@/store/team-management";
import { useSession } from "@/store/session";
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
import { TEAM_ROLE_LABELS } from "@/lib/rbac";
import { cn, timeAgo } from "@/lib/utils";
import type { TeamCreationRequest } from "@/lib/types";

const STATUS_LABEL: Record<TeamCreationRequest["status"], string> = {
  pending: "قيد المراجعة",
  approved: "مقبول",
  rejected: "مرفوض",
  needs_modification: "يحتاج تعديلاً",
  suspended: "معلّق",
  archived: "مؤرشف",
};

const STATUS_VARIANT: Record<TeamCreationRequest["status"], "success" | "secondary" | "warning" | "destructive"> = {
  pending: "warning",
  approved: "success",
  rejected: "destructive",
  needs_modification: "warning",
  suspended: "secondary",
  archived: "secondary",
};

export default function AdminTeamRequestsPage() {
  useEffect(() => {
    document.title = "طلبات إنشاء الفرق | LUNEX TEAM";
  }, []);

  const db = useMemo(() => getMockDatabase(), []);
  const currentUserId = useSession((s) => s.currentUserId);
  const submittedRequests = useTeamManagement((s) => s.submittedRequests);
  const requestOverrides = useTeamManagement((s) => s.requestOverrides);
  const reviewRequest = useTeamManagement((s) => s.reviewRequest);

  const [statusFilter, setStatusFilter] = useState<"all" | TeamCreationRequest["status"]>("all");
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});

  const allRequests = useMemo(() => {
    const merged = [...submittedRequests, ...db.teamCreationRequests].map((r) => {
      const override = requestOverrides[r.id];
      return override ? { ...r, ...override } : r;
    });
    return merged.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  }, [submittedRequests, db.teamCreationRequests, requestOverrides]);

  const filtered = statusFilter === "all" ? allRequests : allRequests.filter((r) => r.status === statusFilter);

  function act(request: TeamCreationRequest, status: TeamCreationRequest["status"]) {
    if (!currentUserId) return;
    reviewRequest(request, status, currentUserId, noteDrafts[request.id]);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="section-title font-display text-2xl font-bold text-white">طلبات إنشاء الفرق ({filtered.length})</h1>
          <p className="text-sm text-lunex-gray">راجع طلبات إنشاء الفرق الجديدة واتخذ الإجراء المناسب.</p>
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الحالات</SelectItem>
            {Object.entries(STATUS_LABEL).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-3">
        {filtered.map((request) => {
          const requester = db.users.find((u) => u.id === request.requesterId);
          return (
            <Card
              key={request.id}
              className={cn("panel-hover", request.status === "pending" && "magic-border")}
            >
              <CardContent className="space-y-3 p-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <Image
                      src={`https://picsum.photos/seed/${request.logoSeed}/64/64`}
                      alt={request.teamName}
                      width={48}
                      height={48}
                      className="art-glow shine rounded-xl border border-white/10"
                    />
                    <div>
                      <h3 className="font-display text-lg font-black text-white">{request.teamName}</h3>
                      {requester && (
                        <p className="text-xs text-lunex-gray">
                          مقدَّم من <span className="text-primary-300">{requester.displayName}</span> · {timeAgo(request.createdAt)}
                        </p>
                      )}
                    </div>
                  </div>
                  <Badge variant={STATUS_VARIANT[request.status]}>{STATUS_LABEL[request.status]}</Badge>
                </div>

                <p className="text-sm text-lunex-gray">{request.description}</p>
                <p className="text-sm text-lunex-gray"><span className="font-bold text-white">الأهداف:</span> {request.goals}</p>

                <div className="flex flex-wrap gap-4 text-xs text-lunex-gray">
                  <span><span className="font-bold text-white">التصنيف:</span> {request.category}</span>
                  <span><span className="font-bold text-white">الأعضاء المتوقعون:</span> {request.expectedMembers}</span>
                  <span><span className="font-bold text-white">الخبرة:</span> {request.previousExperience}</span>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {request.requiredPositions.map((p) => (
                    <Badge key={p} variant="secondary" className="text-[10px]">{TEAM_ROLE_LABELS[p]}</Badge>
                  ))}
                </div>

                {request.reviewerNote && (
                  <p className="border-s-4 border-amber-400 bg-amber-400/10 p-2 text-xs text-amber-300">
                    ملاحظة المراجع: {request.reviewerNote}
                  </p>
                )}

                {(request.status === "pending" || request.status === "needs_modification") && (
                  <div className="space-y-2 border-t-2 border-white/10 pt-3">
                    <Input
                      value={noteDrafts[request.id] ?? ""}
                      onChange={(e) => setNoteDrafts((d) => ({ ...d, [request.id]: e.target.value }))}
                      placeholder="ملاحظة اختيارية للمتقدم..."
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" onClick={() => act(request, "approved")}>
                        <Check className="hover-pop h-3.5 w-3.5" /> قبول
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => act(request, "rejected")}>
                        <X className="hover-pop h-3.5 w-3.5" /> رفض
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => act(request, "needs_modification")}>
                        <MessageSquareWarning className="hover-pop h-3.5 w-3.5" /> طلب تعديل
                      </Button>
                    </div>
                  </div>
                )}

                {request.status === "approved" && (
                  <div className="flex flex-wrap gap-2 border-t-2 border-white/10 pt-3">
                    <Button size="sm" variant="secondary" onClick={() => act(request, "suspended")}>
                      <PauseCircle className="h-3.5 w-3.5" /> تعليق
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => act(request, "archived")}>
                      <Archive className="h-3.5 w-3.5" /> أرشفة
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
        {filtered.length === 0 && (
          <div className="panel p-10 text-center text-lunex-gray">لا توجد طلبات بهذه الحالة.</div>
        )}
      </div>
    </div>
  );
}
