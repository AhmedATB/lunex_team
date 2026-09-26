"use client";

import { useEffect, useState } from "react";
import { ClipboardList, Loader2 } from "lucide-react";
import { teamActivityApi, type ActivityEntry } from "@/lib/collaboration-api";
import { timeAgo } from "@/lib/utils";

/** What happened in a team, newest first: members and roles, recruitment, collaboration, chapters going live. Kept on the site. */
export function ActivityPanel({ teamId }: { teamId: string }) {
  const [items, setItems] = useState<ActivityEntry[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    void teamActivityApi.list(teamId).then((result) => {
      if (cancelled) return;
      if (result.ok) setItems(result.body.items);
      else {
        setError(result.message);
        setItems([]);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [teamId]);

  if (items === null) return <div className="flex justify-center p-8 text-lunex-gray"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  return (
    <div className="space-y-2">
      {error && <p className="text-sm text-red-400" role="alert">{error}</p>}
      {items.map((entry) => (
        <div key={entry.id} className="flex items-start gap-2 border-b-2 border-white/10 py-2 text-sm last:border-0">
          <ClipboardList className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary-300" />
          <div className="min-w-0 flex-1">
            <p className="text-lunex-gray">{entry.text}</p>
            <p className="text-[11px] text-lunex-gray/60">{timeAgo(entry.at)}</p>
          </div>
        </div>
      ))}
      {items.length === 0 && !error && <div className="panel p-10 text-center text-lunex-gray">لا يوجد نشاط مسجل بعد.</div>}
    </div>
  );
}
