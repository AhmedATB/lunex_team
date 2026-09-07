# نشر LUNEX TEAM (Railway)

> **تحديث:** هذا المستند كان يوصف نشر مقسّم Vercel (فرونت-إند) + Railway (باك-إند). فعلياً الاثنين انتقلوا لـ Railway بخدمتين منفصلتين بنفس المشروع — أبسط لإدارة رابط الباك-إند الداخلي، وما في حاجة حقيقية لـ Vercel كانت السبب الأصلي وراء الفكرة. الخطوات تحت معدّلة لتطابق هذا.

هذا المشروع مكوّن من تطبيقين منفصلين بنفس الـ repo، كل واحد خدمة Railway مستقلة بنفس المشروع:
- **الفرونت-إند** (Next.js) — جذر الـ repo.
- **الباك-إند** (NestJS + Prisma) — مجلد `backend/`.
- **Postgres** — خدمة قاعدة بيانات مُدارة من Railway، بنفس المشروع.

البيانات الحساسة (JWT secrets، إلخ) ما ينكتبون هنا أبداً — تُضاف فقط كمتغيرات بيئة (Environment Variables) داخل لوحة Railway مباشرة.

## 1. GitHub

```bash
git remote add origin https://github.com/<username>/<repo>.git
git push -u origin master
```

## 2. خدمة الباك-إند + قاعدة البيانات

1. New Project → Deploy from GitHub repo → اختر نفس الـ repo.
2. **Settings → Root Directory**: `backend`
3. أضف **Postgres** كخدمة إضافية بنفس المشروع (New → Database → PostgreSQL) — Railway يولّد `DATABASE_URL` تلقائياً ويشاركه مع خدمة الباك-إند إذا فعّلت "Reference Variable".
4. أضف متغيرات البيئة التالية على خدمة الباك-إند:
   - `DATABASE_URL` → مرجع لقاعدة بيانات Postgres اللي أنشأتها (Railway يعبّيها تلقائي عبر "Add Reference")
   - `JWT_ACCESS_SECRET`, `JWT_REFRESH_PEPPER`, `IMAGE_TOKEN_SECRET` → قيم عشوائية قوية
   - `CORS_ORIGINS` → رابط خدمة الفرونت-إند على Railway (خطوة 3 تحت) — دفاع إضافي فقط، المتصفح أصلاً ما يتصل بالباك-إند مباشرة (شوف مستند العمارة الأمنية §00/§15)
   - `NODE_ENV` → `production`
   - ملاحظة عن `IMAGE_STORAGE_DIR`: أي مسار محلي على القرص غير دائم على Railway (يُمسح كل نشر جديد — شوف §16 بمستند العمارة). مقبول حالياً لأن الصور المحفوظة فعلياً (الأفاتار) بقاعدة البيانات مباشرة (§17)، لا على القرص؛ خط أنابيب صور الفصول الحقيقي لاحقاً يحتاج تخزين خارجي (S3/R2) قبل استخدام هذا المتغير فعلياً.
5. Deploy. بعد أول نشر، خد الرابط العام اللي يعطيك ياه Railway (مثال: `https://lunex-backend-production.up.railway.app`) — هذا يصير `BACKEND_URL` بالخطوة الجاية.

## 3. خدمة الفرونت-إند

1. أضف خدمة جديدة بنفس مشروع Railway → Deploy from GitHub repo → نفس الـ repo.
2. **Settings → Root Directory**: اتركه فاضي (جذر الـ repo).
3. أضف متغير بيئة واحد:
   - `BACKEND_URL` → رابط خدمة الباك-إند من الخطوة 2.5 فوق
4. Deploy. خد الرابط العام لهذه الخدمة (مثال: `https://lunexteam-production.up.railway.app`).

## 4. آخر خطوة

ارجع لخدمة الباك-إند وحدّث `CORS_ORIGINS` بالرابط الفعلي اللي عطتك ياه خدمة الفرونت-إند، وأعد النشر (Redeploy) للباك-إند.

## ملاحظات

- قاعدة البيانات المحلية SQLite (للتطوير فقط) لازم تتحول لـ Postgres قبل النشر — `prisma/schema.prisma` يحتاج تعديل `provider` من `sqlite` إلى `postgresql`، وتوليد migration جديد ضد قاعدة Railway الحقيقية (لأن SQLite وPostgres عندهم صيغة migration مختلفة).
- التخزين المحلي على القرص (`backend/storage/` أو أي مسار آخر) غير دائم على Railway (يُمسح عند كل نشر جديد) — التفاصيل والخطوة المستقبلية (S3/R2) موثّقة بـ `backend/docs/security-architecture.md` §16/§17/§19.
