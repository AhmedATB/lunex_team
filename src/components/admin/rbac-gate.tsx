"use client";

import { useMemo, type ReactNode } from "react";
import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { useSession } from "@/store/session";
import { getMockDatabase } from "@/lib/mock/generate";
import { can, type Permission } from "@/lib/rbac";
import { Button } from "@/components/ui/button";

export function RbacGate({ permission, children }: { permission: Permission; children: ReactNode }) {
  const currentUserId = useSession((s) => s.currentUserId);
  const user = useMemo(
    () => getMockDatabase().users.find((u) => u.id === currentUserId),
    [currentUserId]
  );

  if (!user || !can(user, permission)) {
    return (
      <div className="container flex flex-col items-center justify-center gap-4 py-24 text-center">
        <ShieldAlert className="h-14 w-14 text-red-400" />
        <h1 className="font-display text-2xl font-bold text-white">وصول مرفوض</h1>
        <p className="max-w-sm text-sm text-lunex-gray">
          لا تملك الصلاحيات الكافية للوصول إلى لوحة الإدارة. جرّب تبديل الدور من قائمة الحساب للتجربة (Demo RBAC).
        </p>
        <Button asChild>
          <Link href="/">العودة للرئيسية</Link>
        </Button>
      </div>
    );
  }

  return <>{children}</>;
}
