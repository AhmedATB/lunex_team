export type StyleId =
  | "violet-night"
  | "neon-cyber"
  | "ink-paper"
  | "hero-sunset"
  | "blue-moon"
  | "crimson-blood";

export interface StylePreset {
  id: StyleId;
  nameAr: string;
  descriptionAr: string;
  /** Two swatch colors for the picker UI only — the real values live in globals.css under [data-style="id"]. */
  swatchBg: string;
  swatchAccent: string;
}

export const STYLE_PRESETS: StylePreset[] = [
  {
    id: "violet-night",
    nameAr: "البنفسجي الليلي",
    descriptionAr: "الطابع الأساسي للموقع — بنفسجي داكن فاخر.",
    swatchBg: "#0d0616",
    swatchAccent: "#a855f7",
  },
  {
    id: "neon-cyber",
    nameAr: "نيون سايبر",
    descriptionAr: "أزرق سماوي متوهج على خلفية شبه سوداء.",
    swatchBg: "#050a0d",
    swatchAccent: "#22d3ee",
  },
  {
    id: "ink-paper",
    nameAr: "حبر وورق",
    descriptionAr: "خلفية دافئة بنية كأوراق قديمة، وحبر أحمر — طابع القراءة الهادئة.",
    swatchBg: "#1a150d",
    swatchAccent: "#dc2626",
  },
  {
    id: "hero-sunset",
    nameAr: "غروب الأبطال",
    descriptionAr: "برتقالي دافئ على بني داكن — أجواء المواجهات الحماسية.",
    swatchBg: "#140b06",
    swatchAccent: "#f97316",
  },
  {
    id: "blue-moon",
    nameAr: "قمر أزرق",
    descriptionAr: "أزرق هادئ بارد — أجواء هادئة وغامضة.",
    swatchBg: "#050810",
    swatchAccent: "#3b82f6",
  },
  {
    id: "crimson-blood",
    nameAr: "دم قرمزي",
    descriptionAr: "أحمر قرمزي حاد على أسود — أجواء الأكشن والقتال.",
    swatchBg: "#0d0505",
    swatchAccent: "#dc2626",
  },
];

export const DEFAULT_STYLE: StyleId = "violet-night";
