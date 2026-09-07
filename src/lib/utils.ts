import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${n}`;
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "الآن";
  if (minutes < 60) return `منذ ${minutes} د`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `منذ ${hours} س`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `منذ ${days} يوم`;
  const months = Math.floor(days / 30);
  if (months < 12) return `منذ ${months} شهر`;
  return `منذ ${Math.floor(months / 12)} سنة`;
}

export function avatarUrl(seed: string): string {
  return `https://i.pravatar.cc/150?u=${encodeURIComponent(seed)}`;
}

/**
 * A real uploaded avatar (avatarVersion set) always wins over the seeded
 * placeholder — the version string is only there to bust the browser's
 * cache after a re-upload, since the URL is otherwise stable per user.
 */
export function resolveAvatarUrl(userId: string, avatarVersion: string | null | undefined, fallbackSeed: string): string {
  if (avatarVersion) {
    return `/api/users/${encodeURIComponent(userId)}/avatar?v=${encodeURIComponent(avatarVersion)}`;
  }
  return avatarUrl(fallbackSeed);
}

export function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
