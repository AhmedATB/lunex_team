import type { ReactNode } from "react";
import { RbacGate } from "@/components/admin/rbac-gate";
import { AdminSidebar } from "@/components/admin/admin-sidebar";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <RbacGate permission="view_statistics">
      <div className="container flex flex-col gap-6 py-6 lg:flex-row">
        <AdminSidebar />
        <div className="min-w-0 flex-1 space-y-6">{children}</div>
      </div>
    </RbacGate>
  );
}
