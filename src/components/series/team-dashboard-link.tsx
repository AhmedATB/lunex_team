"use client";

import Link from "next/link";
import { LayoutDashboard } from "lucide-react";
import { useSession } from "@/store/session";
import { useTeamManagement } from "@/store/team-management";
import { getTeamAuthRoles } from "@/lib/team-auth";
import { accessIn } from "@/lib/team-access";
import { useCatalog } from "@/components/catalog-provider";
import { Button } from "@/components/ui/button";

export function TeamDashboardLink({ teamId, teamSlug, leaderId }: { teamId: string; teamSlug: string; leaderId: string }) {
  const currentUserId = useSession((s) => s.currentUserId);
  const sessionUser = useSession((s) => s.user);
  const memberRoleOverrides = useTeamManagement((s) => s.memberRoleOverrides);
  const db = useCatalog();
  const user = db.users.find((u) => u.id === currentUserId);
  const { isGlobalAdmin, isLeader, isAssistantLeader } = getTeamAuthRoles({ id: teamId, leaderId }, user, memberRoleOverrides);

  // Mirrors the access gate in the dashboard page itself: the team's leadership and platform admins, plus whoever the site says may
  // work on its chapters (a publisher or an uploader — for them the dashboard is just the chapters).
  const access = accessIn(sessionUser, teamId);
  if (!isLeader && !isAssistantLeader && !isGlobalAdmin && !access) return null;
  const leads = isLeader || isAssistantLeader || isGlobalAdmin || access?.level === "lead";

  return (
    <Button variant="secondary" asChild>
      <Link href={`/teams/${teamSlug}/dashboard`}>
        <LayoutDashboard className="h-4 w-4" /> {leads ? "لوحة الإدارة" : "رفع الفصول"}
      </Link>
    </Button>
  );
}
