import { cookies } from "next/headers";
import { DEFAULT_STYLE, STYLE_COOKIE, STYLE_PRESETS, type StyleId } from "@/lib/theme-presets";

const VALID_STYLE_IDS = new Set<string>(STYLE_PRESETS.map((p) => p.id));

/** Mirrors the client's persisted style preference (see store/theme.ts) so Server Components can render the right style/layout on the very first response instead of always defaulting and swapping after hydration. */
export async function getInitialStyle(): Promise<StyleId> {
  const raw = (await cookies()).get(STYLE_COOKIE)?.value;
  return raw && VALID_STYLE_IDS.has(raw) ? (raw as StyleId) : DEFAULT_STYLE;
}
