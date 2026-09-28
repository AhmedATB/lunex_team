/** Pictures that go with comments and chat messages: uploaded first, joined to the comment or message when it is sent. */

export interface AttachmentInfo {
  id: string;
  width: number;
  height: number;
}

/** Where a picture is shown from (the small one for lists, the full one for opening it). */
export const attachmentSrc = (id: string, size: "thumb" | "full" = "full") => `/api/attachments/${encodeURIComponent(id)}${size === "thumb" ? "?size=thumb" : ""}`;

/** What the server accepts as a file: a bit under its 8 MB limit, since a large photo is made smaller here before it is sent. */
export const MAX_PICTURE_BYTES = 8 * 1024 * 1024;

/** A photo from a phone can be 10 MB of detail nobody will see: shrink big ones here so they upload fast on a weak connection. */
const SHRINK_ABOVE_BYTES = 1_200_000;
const SHRINK_TO_PX = 2000;

async function shrink(file: File): Promise<File> {
  if (file.size <= SHRINK_ABOVE_BYTES || !/^image\/(jpeg|png|webp)$/.test(file.type)) return file;
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, SHRINK_TO_PX / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.86));
    return blob && blob.size < file.size ? new File([blob], file.name.replace(/\.\w+$/, "") + ".webp", { type: "image/webp" }) : file;
  } catch {
    return file;
  }
}

const ERRORS: Record<string, string> = {
  invalid_image: "تعذرت قراءة هذا الملف كصورة.",
  no_file: "اختر صورة أولًا.",
  upload_limit: "رفعت صورًا كثيرة. حاول لاحقًا.",
  account_muted: "أنت في تايم أوت ولا يمكنك رفع صور الآن.",
  account_banned: "هذا الحساب محظور.",
};

export type UploadResult = { ok: true; attachment: AttachmentInfo } | { ok: false; message: string };

export async function uploadPicture(file: File): Promise<UploadResult> {
  if (!file.type.startsWith("image/")) return { ok: false, message: "هذا الملف ليس صورة." };
  const ready = await shrink(file);
  if (ready.size > MAX_PICTURE_BYTES) return { ok: false, message: "الصورة أكبر من 8 ميغابايت." };
  try {
    const form = new FormData();
    form.append("file", ready);
    const res = await fetch("/api/attachments", { method: "POST", body: form, cache: "no-store" });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      const code = (json as { code?: string } | null)?.code;
      if (res.status === 401) return { ok: false, message: "سجّل الدخول أولًا." };
      if (res.status === 429) return { ok: false, message: ERRORS.upload_limit };
      return { ok: false, message: (code && ERRORS[code]) || "تعذر رفع الصورة." };
    }
    return { ok: true, attachment: json as AttachmentInfo };
  } catch {
    return { ok: false, message: "تعذر الاتصال بالخادم." };
  }
}
