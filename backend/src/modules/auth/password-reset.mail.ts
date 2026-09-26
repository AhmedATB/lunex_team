import type { OutgoingMail } from "../mail/mail.service";

/** How long the link works — said in the mail, enforced in AuthService. */
export const PASSWORD_RESET_TTL_MINUTES = 60;

const escapeHtml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * The reset mail. The token rides in the link's fragment (#), which a browser never sends to any server or in a Referer
 * header, so it cannot leak through a request log or a third-party script on the page. Written without a gendered form.
 */
export function passwordResetMail(to: string, link: string): OutgoingMail {
  const minutes = PASSWORD_RESET_TTL_MINUTES;
  const text = [
    "استعادة كلمة المرور — LUNEX TEAM",
    "",
    "وصلنا طلب لاستعادة كلمة المرور لهذا الحساب. لاختيار كلمة مرور جديدة افتح الرابط التالي:",
    link,
    "",
    `الرابط يعمل مرة واحدة فقط وينتهي بعد ${minutes} دقيقة.`,
    "إذا لم يكن الطلب منك فتجاهل هذه الرسالة؛ لن يتغير شيء في الحساب.",
  ].join("\n");
  const safe = escapeHtml(link);
  const html = `<!doctype html><html lang="ar" dir="rtl"><body style="margin:0;padding:24px;background:#0d0b14;font-family:Tahoma,Arial,sans-serif;color:#e8e6ef">
<div style="max-width:480px;margin:auto;background:#161222;border:1px solid #2a2340;border-radius:16px;padding:28px">
<h2 style="margin:0 0 12px;font-size:20px">استعادة كلمة المرور</h2>
<p style="line-height:1.8;color:#b9b4cc;margin:0 0 20px">وصلنا طلب لاستعادة كلمة المرور لهذا الحساب. لاختيار كلمة مرور جديدة اضغط الزر:</p>
<p style="margin:0 0 20px"><a href="${safe}" style="display:inline-block;background:#7c5cff;color:#fff;text-decoration:none;padding:12px 24px;border-radius:12px;font-weight:bold">اختيار كلمة مرور جديدة</a></p>
<p style="line-height:1.8;color:#b9b4cc;font-size:13px;margin:0 0 8px">الرابط يعمل مرة واحدة فقط وينتهي بعد ${minutes} دقيقة.</p>
<p style="line-height:1.8;color:#b9b4cc;font-size:13px;margin:0 0 16px">إذا لم يكن الطلب منك فتجاهل هذه الرسالة؛ لن يتغير شيء في الحساب.</p>
<p style="line-height:1.6;color:#7d7796;font-size:12px;margin:0;word-break:break-all">إن لم يعمل الزر انسخ هذا الرابط إلى المتصفح:<br>${safe}</p>
</div></body></html>`;
  return { to, subject: "استعادة كلمة المرور — LUNEX TEAM", text, html };
}
