/**
 * How the admin screens talk to the site's own API: JSON or an uploaded file in, the result (or the server's reason in
 * Arabic) out — never a thrown error. Everything goes through the BFF doors, which pass the member's session along; the
 * backend decides against the account's current role who may do what.
 */

export type ApiResult<T> = { ok: true; body: T } | { ok: false; message: string; status: number };

const MESSAGES: Record<string, string> = {
  user_not_found: "لا يوجد حساب بهذا الاسم.",
  team_not_found: "هذا الفريق غير موجود.",
  series_not_found: "بعض هذه الأعمال لم تعد موجودة.",
  global_editor_only: "هذا الإجراء للمالك والمحررين فقط.",
  global_manager_only: "حالة الفريق وقائده يغيّرها مدير الفرق أو المالك فقط.",
  insufficient_permissions: "لا تملك صلاحية لهذا الإجراء.",
  account_banned: "هذا الحساب محظور.",
  tag_exists: "هذا الاسم موجود مسبقًا.",
  unknown_tags: "أحد التصنيفات المختارة غير موجود.",
  missing_file: "اختر ملفًا أولًا.",
  unsupported_image_type: "الصورة يجب أن تكون JPEG أو PNG أو WebP أو GIF.",
  invalid_image: "تعذرت قراءة هذا الملف كصورة.",
  chapter_exists: "يوجد فصل بهذا الرقم في هذا العمل.",
  series_not_listed: "هذا العمل غير منشور بعد، فلا يُعلن عنه.",
  approver_only: "الموافقة على الأعمال أو رفضها للمالك والمسؤول الأعلى فقط.",
  series_not_approved: "هذا العمل ما زال بانتظار موافقة الإدارة، فلا يمكن نشر فصوله بعد.",
  page_number_taken: "هذه الصفحة موجودة مسبقًا في الفصل.",
  chapter_number_taken: "يوجد فصل آخر بهذا الرقم في هذا العمل.",
  invalid_title: "اكتب عنوانًا للفصل.",
  last_page: "لا يمكن حذف الصفحة الوحيدة في الفصل. احذف الفصل نفسه بدلًا منها.",
  page_not_found: "هذه الصفحة غير موجودة في الفصل.",
  image_too_large: "أبعاد إحدى الصور أكبر من المسموح.",
  drive_not_configured: "الرفع من درايف غير مفعّل بعد على الموقع.",
  invalid_drive_link: "هذا ليس رابط مجلد أو ملف على Google Drive.",
  drive_folder_not_shared: "المجلد خاص أو غير موجود. اجعله عامًا (أي شخص لديه الرابط) أو شاركه مع حساب الخدمة المذكور.",
  drive_not_a_folder: "هذا الرابط لملف وليس لمجلد.",
  drive_unsupported_file: "هذا الرابط ليس لمجلد صور ولا لملف ZIP. إن كان ملف RAR أو 7z فاضغطه كـ ZIP، أو ضع الصور في مجلد وانسخ رابط المجلد.",
  drive_file_too_large: "ملف ZIP كبير جدًا (الحد 350 ميغابايت). قسّمه إلى أجزاء.",
  no_images: "لا توجد صور داخل المجلد.",
  too_many_images: "عدد الصور في المجلد أكبر من الحد المسموح للفصل (300).",
  import_running: "هذا الفصل يُستورد الآن. انتظر حتى ينتهي.",
  drive_rate_limited: "Google Drive يحدّ الطلبات الآن. حاول بعد دقيقة.",
  drive_auth_failed: "تعذر على الموقع تسجيل الدخول إلى Google Drive.",
  drive_failed: "تعذرت قراءة المجلد من Google Drive.",
  too_many_open_requests: "لديك طلبان بانتظار القرار. انتظر الرد عليهما أولًا.",
  too_many_requests: "أرسلت طلبات كثيرة اليوم. حاول غدًا.",
  outranked: "رتبتك لا تسمح بهذا التغيير على هذا العضو.",
  team_name_taken: "يوجد فريق بهذا الاسم. اختر اسمًا آخر.",
  invalid_discord_webhook: "هذا ليس رابط ويبهوك ديسكورد صحيحًا. من إعدادات القناة ← التكاملات ← ويبهوكس، ثم انسخ الرابط.",
  invalid_discord_role: "هذا ليس معرّف رتبة صحيحًا. فعّل «وضع المطوّر» في ديسكورد، ثم اضغط بيمين الرتبة واختر «نسخ المعرّف».",
  not_awaiting_changes: "لا يمكن تعديل هذا الطلب الآن.",
  invalid_transition: "لا يمكن نقل الطلب إلى هذه الحالة من حالته الحالية.",
  request_not_found: "هذا الطلب غير موجود.",
  invalid_request: "الاسم والوصف والأهداف لا يمكن أن تكون فارغة.",
};

/** Codes whose server message names what was found (a file name and type), worth showing beside the Arabic explanation. */
const WITH_DETAIL = new Set(["drive_unsupported_file"]);

export function messageFor(body: unknown): string {
  const code = (body as { code?: string } | null)?.code;
  const message = (body as { message?: string | string[] } | null)?.message;
  if (code && MESSAGES[code]) return WITH_DETAIL.has(code) && typeof message === "string" ? `${MESSAGES[code]} (${message})` : MESSAGES[code];
  if (Array.isArray(message) && message.length > 0) return `بيانات غير صالحة: ${message[0]}`;
  return "فشلت العملية.";
}

async function send<T>(path: string, init: RequestInit): Promise<ApiResult<T>> {
  try {
    const res = await fetch(path, { cache: "no-store", ...init });
    if (res.status === 204) return { ok: true, body: undefined as T };
    const json = await res.json().catch(() => null);
    if (!res.ok) return { ok: false, status: res.status, message: messageFor(json) };
    return { ok: true, body: json as T };
  } catch {
    return { ok: false, status: 0, message: "تعذر الاتصال بالخادم." };
  }
}

export function call<T>(path: string, method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE", body?: unknown): Promise<ApiResult<T>> {
  return send<T>(path, { method, ...(body === undefined ? {} : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }) });
}

/** Uploads a file (and any other fields) as multipart form data; the browser sets the boundary itself. */
export function callForm<T>(path: string, form: FormData, method: "POST" | "PUT" = "POST"): Promise<ApiResult<T>> {
  return send<T>(path, { method, body: form });
}
