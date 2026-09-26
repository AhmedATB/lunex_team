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
