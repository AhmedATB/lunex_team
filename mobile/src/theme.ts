/** The site's default dark theme (globals.css `--lunex-*` / `--primary-*`), as plain colours. */
export const colors = {
  bg: "#09090b",
  surface: "#141418",
  surfaceRaised: "#1c1c22",
  border: "rgba(255,255,255,0.08)",
  text: "#fafafa",
  muted: "#a1a1aa",
  faint: "#71717a",
  primary: "#6d28d9",
  violet: "#a855f7",
  lilac: "#c084fc",
  danger: "#f87171",
  warning: "#fbbf24",
  success: "#4ade80",
} as const;

export const radius = { sm: 8, md: 12, lg: 16, pill: 999 } as const;

export const TYPE_LABEL: Record<string, string> = { manhwa: "مانهوا", manga: "مانجا", manhua: "مانها", novel: "رواية" };
export const STATUS_LABEL: Record<string, string> = { ongoing: "مستمر", completed: "مكتمل", hiatus: "متوقف مؤقتًا", dropped: "متروك" };
