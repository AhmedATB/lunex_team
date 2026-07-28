"use client";

import Link from "next/link";
import { LayoutDashboard } from "lucide-react";
import { useSession } from "@/store/session";
import { getMockDatabase } from "@/lib/mock/generate";
import { Button } from "@/components/ui/button";

export function TeamDashboardLink({ teamId, teamSlug }: { teamId: string; teamSlug: string }) {
  const currentUserId = useSession((s) => s.currentUserId);
  const user = getMockDatabase().users.find((u) => u.id === currentUserId);
  const canAccess = user && (user.teamId === teamId || user.role === "owner" || user.role === "super_administrator");

  if (!canAccess) return null;

  return (
    <Button variant="secondary" asChild>
      <Link href={`/teams/${teamSlug}/dashboard`}>
        <LayoutDashboard className="h-4 w-4" /> لوحة الإدارة
      </Link>
    </Button>
  );
}
