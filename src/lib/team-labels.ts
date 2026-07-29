import type { TeamCategory, DepartmentKind } from "@/lib/types";

export const CATEGORY_LABELS: Record<TeamCategory, string> = {
  manhwa: "مانهوا",
  manhua: "مانها",
  manga: "مانجا",
  novel: "روايات",
  mixed: "متنوع",
};

export const DEPARTMENT_KIND_LABELS: Record<DepartmentKind, string> = {
  translation: "الترجمة",
  editing: "التحرير",
  proofreading: "التدقيق اللغوي",
  quality_control: "مراقبة الجودة",
  publishing: "النشر",
  media: "الإعلام",
  recruitment: "التوظيف",
};
