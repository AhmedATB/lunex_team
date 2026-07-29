import type { TeamRole } from "@/lib/types";

/**
 * Visual "prestige" tier per team role — leaders and deputies get a distinct
 * glowing ring instead of the flat default, so rank reads at a glance in
 * member lists without relying on the text badge alone.
 */
export function roleTierAvatarClass(teamRole: TeamRole | undefined, isLeader: boolean): string {
  if (isLeader) {
    return "ring-2 ring-amber-400/80 shadow-[0_0_16px_rgba(252,211,77,0.55)]";
  }
  if (teamRole === "assistant_leader") {
    return "ring-2 ring-slate-300/70 shadow-[0_0_14px_rgba(226,232,240,0.4)]";
  }
  if (teamRole === "team_administrator") {
    return "ring-2 ring-purple-400/70 shadow-[0_0_14px_rgba(192,132,252,0.4)]";
  }
  return "ring-2 ring-primary-500/30";
}

/** Leaders and their deputies get a slow idle float — a small "this member matters" cue. */
export function roleTierAnimationClass(teamRole: TeamRole | undefined, isLeader: boolean): string {
  return isLeader || teamRole === "assistant_leader" || teamRole === "team_administrator" ? "float-slow" : "";
}
