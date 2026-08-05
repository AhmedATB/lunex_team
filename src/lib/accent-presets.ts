export type AccentId = "violet-gold" | "oceanic" | "fiery" | "forest" | "rose-gold" | "royal";

/**
 * Each preset is a coordinated 3-color combination, not a single hue: a full
 * shade ramp (50-950, "R G B" triples for Tailwind's rgb(var(--x) / <alpha-value>)
 * pattern) drives buttons/links/badges via --primary-*, while two further
 * accent hues drive the gradient/glow decoration (--lunex-purple/violet/lilac,
 * used by .text-gradient, .lunex-gradient, .art-glow, etc.) — so picking a
 * preset changes more than one color at once, on top of whichever of the 6
 * base styles is active.
 */
export interface AccentPreset {
  id: AccentId;
  nameAr: string;
  swatches: [string, string, string];
  shades: Record<50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 | 950, string>;
  lunexPurple: string;
  lunexViolet: string;
  lunexLilac: string;
}

export const ACCENT_PRESETS: AccentPreset[] = [
  {
    id: "violet-gold",
    nameAr: "بنفسجي كلاسيكي",
    swatches: ["#a855f7", "#e879f9", "#fbbf24"],
    shades: {
      50: "243 232 255", 100: "233 213 255", 200: "216 180 254", 300: "192 132 252",
      400: "168 85 247", 500: "139 49 232", 600: "109 40 217", 700: "91 33 182",
      800: "76 29 149", 900: "59 10 112", 950: "36 6 70",
    },
    lunexPurple: "109 40 217",
    lunexViolet: "232 121 249",
    lunexLilac: "251 191 36",
  },
  {
    id: "oceanic",
    nameAr: "محيطي",
    swatches: ["#22d3ee", "#3b82f6", "#2dd4bf"],
    shades: {
      50: "236 254 255", 100: "207 250 254", 200: "165 243 252", 300: "103 232 249",
      400: "34 211 238", 500: "6 182 212", 600: "8 145 178", 700: "14 116 144",
      800: "21 94 117", 900: "22 78 99", 950: "8 51 68",
    },
    lunexPurple: "37 99 235",
    lunexViolet: "45 212 191",
    lunexLilac: "103 232 249",
  },
  {
    id: "fiery",
    nameAr: "ناري",
    swatches: ["#ef4444", "#fb923c", "#fbbf24"],
    shades: {
      50: "254 242 242", 100: "254 226 226", 200: "254 202 202", 300: "252 165 165",
      400: "248 113 113", 500: "239 68 68", 600: "220 38 38", 700: "185 28 28",
      800: "153 27 27", 900: "127 29 29", 950: "69 10 10",
    },
    lunexPurple: "234 88 12",
    lunexViolet: "251 191 36",
    lunexLilac: "252 165 165",
  },
  {
    id: "forest",
    nameAr: "زمردي",
    swatches: ["#10b981", "#2dd4bf", "#a3e635"],
    shades: {
      50: "236 253 245", 100: "209 250 229", 200: "167 243 208", 300: "110 231 183",
      400: "52 211 153", 500: "16 185 129", 600: "5 150 105", 700: "4 120 87",
      800: "6 95 70", 900: "6 78 59", 950: "2 44 34",
    },
    lunexPurple: "13 148 136",
    lunexViolet: "163 230 53",
    lunexLilac: "110 231 183",
  },
  {
    id: "rose-gold",
    nameAr: "وردي ذهبي",
    swatches: ["#f43f5e", "#d946ef", "#fbbf24"],
    shades: {
      50: "255 241 242", 100: "255 228 230", 200: "254 205 211", 300: "253 164 175",
      400: "251 113 133", 500: "244 63 94", 600: "225 29 72", 700: "190 18 60",
      800: "159 18 57", 900: "136 19 55", 950: "76 5 25",
    },
    lunexPurple: "192 38 211",
    lunexViolet: "251 191 36",
    lunexLilac: "253 164 175",
  },
  {
    id: "royal",
    nameAr: "ملكي",
    swatches: ["#3b82f6", "#6366f1", "#22d3ee"],
    shades: {
      50: "239 246 255", 100: "219 234 254", 200: "191 219 254", 300: "147 197 253",
      400: "96 165 250", 500: "59 130 246", 600: "37 99 235", 700: "29 78 216",
      800: "30 64 175", 900: "30 58 138", 950: "23 37 84",
    },
    lunexPurple: "79 70 229",
    lunexViolet: "34 211 238",
    lunexLilac: "147 197 253",
  },
];
