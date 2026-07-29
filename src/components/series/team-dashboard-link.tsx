"use client";

import Link from "next/link";
import { LayoutDashboard } from "lucide-react";
import { useSession } from "@/store/session";
import { useTeamManagement } from "@/store/team-management";
import { getMockDatabase } from "@/lib/mock/generate";
import { Button } from "@/components/ui/button";

export function TeamDashboardLink({ teamId, teamSlug, leaderId }: { teamId: string; teamSlug: string; leaderId: string }) {
  const currentUserId = useSession((s) => s.currentUserId);
  const memberRoleOverrides = useTeamManagement((s) => s.memberRoleOverrides);
  const user = getMockDatabase().users.find((u) => u.id === currentUserId);
  const isGlobalAdmin = user?.role === "owner" || user?.role === "super_administrator";
  const isLeader = user?.id === leaderId;
  const effectiveTeamRole = user ? memberRoleOverrides[user.id]?.teamRole ?? user.teamRole : undefined;
  const isAssistantLeader = user?.teamId === teamId && effectiveTeamRole === "assistant_leader";

  // Dashboard access is restricted to the team leader, their assistant leader, and
  // platform admins — mirrors the access gate in the dashboard page itself.
  if (!isLeader && !isAssistantLeader && !isGlobalAdmin) return null;

  return (
    <Button variant="secondary" asChild>
      <Link href={`/teams/${teamSlug}/dashboard`}>
        <LayoutDashboard className="h-4 w-4" /> لوحة الإدارة
      </Link>
    </Button>
  );
}
