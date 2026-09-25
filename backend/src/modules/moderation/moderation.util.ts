export type SanctionType = "warning" | "timeout" | "ban";
export const SANCTION_TYPES: readonly SanctionType[] = ["warning", "timeout", "ban"];

interface BanState {
  isBanned: boolean;
  bannedUntil: Date | null;
}

interface MuteState {
  mutedUntil: Date | null;
}

/**
 * The single definition of "is this account banned right now". `isBanned` alone
 * is not enough: a temporary ban leaves it true after `bannedUntil` passes, so
 * nothing needs to run at expiry — every check goes through here instead.
 */
export function isEffectivelyBanned(user: BanState, now: Date = new Date()): boolean {
  if (!user.isBanned) return false;
  return user.bannedUntil === null || user.bannedUntil > now;
}

export function isMuted(user: MuteState, now: Date = new Date()): boolean {
  return user.mutedUntil !== null && user.mutedUntil > now;
}

/** ISO string while a timeout is running, else null — what the client is told. */
export function activeMutedUntil(user: MuteState, now: Date = new Date()): string | null {
  return isMuted(user, now) && user.mutedUntil ? user.mutedUntil.toISOString() : null;
}

/** ISO string of a still-running temporary ban's end, else null (also null for a permanent ban). */
export function activeBannedUntil(user: BanState, now: Date = new Date()): string | null {
  return isEffectivelyBanned(user, now) && user.bannedUntil ? user.bannedUntil.toISOString() : null;
}
