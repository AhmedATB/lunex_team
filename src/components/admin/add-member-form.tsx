"use client";

import { useState } from "react";
import { Loader2, UserPlus } from "lucide-react";
import { MEMBER_ROLES, teamApi, type MemberRole } from "@/lib/team-api";
import { TEAM_ROLE_LABELS } from "@/lib/rbac";
import { useToast } from "@/store/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/**
 * Puts an account on a team straight away, by username — no recruitment post and no application to accept.
 * The person must already have an account on the site.
 */
export function AddMemberForm({ teamId, onAdded }: { teamId: string; onAdded: () => void }) {
  const [username, setUsername] = useState("");
  const [role, setRole] = useState<MemberRole>("translator");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const name = username.trim().replace(/^@/, "");
    if (!name || busy) return;
    setBusy(true);
    setError("");
    const result = await teamApi.addMember(teamId, name, role);
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    useToast.getState().push({ title: "تمت الإضافة", description: `أُضيف ${name} إلى الفريق كـ ${TEAM_ROLE_LABELS[role]}.` });
    setUsername("");
    onAdded();
  }

  return (
    <form onSubmit={submit} className="space-y-2 rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <p className="text-sm font-semibold text-white">إضافة عضو مباشرة</p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="اسم المستخدم (username)"
          dir="ltr"
          autoComplete="off"
          aria-label="اسم مستخدم العضو"
          className="sm:flex-1"
        />
        <Select value={role} onValueChange={(v) => setRole(v as MemberRole)}>
          <SelectTrigger className="sm:w-44" aria-label="دور العضو"><SelectValue /></SelectTrigger>
          <SelectContent>
            {MEMBER_ROLES.map((r) => <SelectItem key={r} value={r}>{TEAM_ROLE_LABELS[r]}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button type="submit" disabled={busy || !username.trim()}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />} إضافة
        </Button>
      </div>
      {error && <p className="text-xs text-red-400" role="alert">{error}</p>}
      <p className="text-xs text-lunex-gray">يجب أن يكون للشخص حساب على الموقع. ينضم فوراً دون طلب توظيف.</p>
    </form>
  );
}
