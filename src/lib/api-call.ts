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
  page_number_taken: "هذه الصفحة موجودة مسبقًا في الفصل.",
  image_too_large: "أبعاد إحدى الصور أكبر من المسموح.",
  drive_not_configured: "الرفع من درايف غير مفعّل بعد على الموقع.",
  invalid_drive_link: "هذا ليس رابط مجلد Google Drive صحيحًا.",
  drive_folder_not_shared: "المجلد خاص أو غير موجود. اجعله عامًا (أي شخص لديه الرابط) أو شاركه مع حساب الخدمة المذكور.",
  drive_not_a_folder: "هذا الرابط لملف وليس لمجلد.",
  no_images: "لا توجد صور داخل المجلد.",
  too_many_images: "عدد الصور في المجلد أكبر من الحد المسموح للفصل (300).",
  import_running: "هذا الفصل يُستورد الآن. انتظر حتى ينتهي.",
  drive_rate_limited: "Google Drive يحدّ الطلبات الآن. حاول بعد دقيقة.",
  drive_auth_failed: "تعذر على الموقع تسجيل الدخول إلى Google Drive.",
  drive_failed: "تعذرت قراءة المجلد من Google Drive.",
  too_many_open_requests: "لديك طلبان بانتظار القرار. انتظر الرد عليهما أولًا.",
  too_many_requests: "أرسلت طلبات كثيرة اليوم. حاول غدًا.",
  team_name_taken: "يوجد فريق بهذا الاسم. اختر اسمًا آخر.",
  not_awaiting_changes: "لا يمكن تعديل هذا الطلب الآن.",
  invalid_transition: "لا يمكن نقل الطلب إلى هذه الحالة من حالته الحالية.",
  request_not_found: "هذا الطلب غير موجود.",
  invalid_request: "الاسم والوصف والأهداف لا يمكن أن تكون فارغة.",
};

export function messageFor(body: unknown): string {
  const code = (body as { code?: string } | null)?.code;
  if (code && MESSAGES[code]) return MESSAGES[code];
  const message = (body as { message?: string | string[] } | null)?.message;
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
