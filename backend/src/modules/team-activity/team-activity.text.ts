/**
 * The words of a team's activity log. The database keeps only codes and ids; the sentence is put together here when the log
 * is read, in the reader's own language, with names looked up then (so a deleted account leaves no name in the log).
 */

export const TEAM_ACTIVITY_ACTIONS = [
  "team_created",
  "team_updated",
  "team_status_changed",
  "leader_changed",
  "member_added",
  "member_role_changed",
  "member_removed",
  "position_opened",
  "position_closed",
  "position_deleted",
  "application_accepted",
  "application_rejected",
  "application_interview",
  "application_waitlist",
  "collaboration_sent",
  "collaboration_received",
  "collaboration_accepted",
  "collaboration_rejected",
  "collaboration_negotiating",
  "collaboration_accepted_by",
  "collaboration_rejected_by",
  "collaboration_negotiating_by",
  "collaboration_ended",
  "collaborator_removed",
  "chapter_published",
  "chapter_unpublished",
] as const;
export type TeamActivityAction = (typeof TEAM_ACTIVITY_ACTIONS)[number];

const ROLE_AR: Record<string, string> = {
  trainee: "متدرب",
  member: "عضو",
  translator: "مترجم",
  editor: "محرر",
  proofreader: "مدقق لغوي",
  qc: "مراقب جودة",
  publisher: "ناشر",
  uploader: "رافع",
  recruiter: "مسؤول توظيف",
  reviewer: "مراجع",
  team_administrator: "مدير فريق",
  assistant_leader: "نائب القائد",
  team_leader: "قائد الفريق",
};
const STATUS_AR: Record<string, string> = { active: "نشط", suspended: "معلّق", archived: "مؤرشف" };

const role = (code: string | null) => (code ? ROLE_AR[code] ?? code : "");

export interface ActivityWords {
  /** Who did it; null when the site did (or the action has no person: a team answering another). */
  actor: string | null;
  subject: string;
  detail: string | null;
}

/**
 * What happened, as a noun phrase — "تغيير دور سارة إلى محرر" — followed by "بواسطة" and the person who did it. Nouns rather than
 * verbs, so the sentence needs no guess about anybody's gender. Null for a code this version does not know (an entry written by a
 * newer one).
 */
export function describeActivity(action: string, words: ActivityWords): string | null {
  const { subject, detail } = words;
  const d = detail ?? "";
  const what = ((): string | null => {
    switch (action) {
      case "team_created": return "إنشاء الفريق";
      case "team_updated": return "تعديل معلومات الفريق";
      case "team_status_changed": return `تغيير حالة الفريق إلى ${STATUS_AR[d] ?? d}`;
      case "leader_changed": return subject ? `نقل قيادة الفريق إلى ${subject}` : "إزالة قائد الفريق";
      case "member_added": return `إضافة ${subject} إلى الفريق بدور ${role(detail)}`;
      case "member_role_changed": return `تغيير دور ${subject} إلى ${role(detail)}`;
      case "member_removed": return `إزالة ${subject} من الفريق`;
      case "position_opened": return `فتح باب التوظيف لدور ${role(detail)}`;
      case "position_closed": return `إغلاق باب التوظيف لدور ${role(detail)}`;
      case "position_deleted": return `حذف وظيفة ${role(detail)}`;
      case "application_accepted": return `قبول ${subject} في الفريق بدور ${role(detail)}`;
      case "application_rejected": return `رفض طلب انضمام ${subject}`;
      case "application_interview": return `دعوة ${subject} إلى مقابلة`;
      case "application_waitlist": return `وضع ${subject} في قائمة الانتظار`;
      case "collaboration_sent": return `إرسال طلب تعاون إلى فريق ${d}`;
      case "collaboration_received": return `وصل طلب تعاون من فريق ${d}`;
      case "collaboration_accepted": return `قبول طلب تعاون من فريق ${d}`;
      case "collaboration_rejected": return `رفض طلب تعاون من فريق ${d}`;
      case "collaboration_negotiating": return `بدء التفاوض على طلب تعاون من فريق ${d}`;
      case "collaboration_accepted_by": return `قبل فريق ${d} طلب التعاون`;
      case "collaboration_rejected_by": return `رفض فريق ${d} طلب التعاون`;
      case "collaboration_negotiating_by": return `بدأ فريق ${d} التفاوض على طلب التعاون`;
      case "collaboration_ended": return `إنهاء تعاون فريقكم على ${d}`;
      case "collaborator_removed": return `إنهاء تعاون فريق ${d} على أحد أعمال الفريق`;
      case "chapter_published": return `نشر الفصل ${d}`;
      case "chapter_unpublished": return `إزالة نشر الفصل ${d}`;
      default: return null;
    }
  })();
  if (what === null) return null;
  return words.actor ? `${what} — بواسطة ${words.actor}` : what;
}
