/**
 * The site's default style ("البنفسجي الليلي", globals.css :root), converted to plain colours. Names follow the site's Tailwind
 * tokens so a class there maps to one value here: bg-background → colors.bg, bg-card → colors.card, text-lunex-gray → colors.muted,
 * text-primary-300 → colors.primary300, border-border → colors.border.
 */
export const colors = {
  bg: "#09070d",
  card: "#150e20",
  popover: "#110b19",
  mutedBg: "#251f2e",
  border: "#3a2259",
  text: "#ffffff",
  muted: "#a1a1aa",
  faint: "#71717a",
  primary200: "#d8b4fe",
  primary300: "#c084fc",
  primary400: "#a855f7",
  primary500: "#8b31e8",
  primary600: "#6d28d9",
  amber300: "#fcd34d",
  amber400: "#fbbf24",
  emerald300: "#6ee7b7",
  danger: "#ef4444",
  success: "#4ade80",
  white10: "rgba(255,255,255,0.1)",
  white5: "rgba(255,255,255,0.05)",
} as const;

/** `bg-lunex-gradient`: 135deg, primary-600 → primary-400 → primary-300. */
export const lunexGradient = {
  colors: [colors.primary600, colors.primary400, colors.primary300] as const,
  start: { x: 0, y: 0 },
  end: { x: 1, y: 1 },
};

/** `--radius: 0.9rem` and Tailwind's rounded-* scale at a 16px root. */
export const radius = { sm: 8, md: 10, lg: 12, xl: 14.4, "2xl": 16, pill: 999 } as const;

/** The same names the site gives types and statuses (lib/seo.ts and the series cards). */
export const TYPE_LABEL: Record<string, string> = { manhwa: "مانهوا", manga: "مانجا", manhua: "مانها", novel: "رواية" };
export const STATUS_LABEL: Record<string, string> = { ongoing: "مستمر", completed: "مكتمل", hiatus: "متوقف مؤقتًا", dropped: "متروك" };

/** `.panel`: rounded-2xl, 1px border-border, bg-card, a soft drop shadow. */
export const panel = {
  borderRadius: radius["2xl"],
  borderWidth: 1,
  borderColor: colors.border,
  backgroundColor: colors.card,
  shadowColor: "#000",
  shadowOpacity: 0.5,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 8 },
  elevation: 6,
} as const;
