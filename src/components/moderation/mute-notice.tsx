"use client";

import { Clock } from "lucide-react";
import { useMuteStatus } from "@/lib/use-mute-status";

/** Shown in place of a composer's hint while the account is in a timeout; renders nothing otherwise. */
export function MuteNotice({ className = "" }: { className?: string }) {
  const { muted, message } = useMuteStatus();
  if (!muted) return null;
  return (
    <p
      role="status"
      className={`flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs leading-relaxed text-amber-200 ${className}`}
    >
      <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {message}
    </p>
  );
}
