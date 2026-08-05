# نشر LUNEX TEAM (Vercel + Railway)

هذا المشروع مكوّن من تطبيقين منفصلين بنفس الـ repo:
- **الفرونت-إند** (Next.js) — جذر الـ repo، يترفع على **Vercel**.
- **الباك-إند** (NestJS + Prisma) — مجلد `backend/`، يترفع على **Railway** مع إضافة Postgres.

البيانات الحساسة (JWT secrets، إلخ) ما ينكتبون هنا أبداً — تُضاف فقط كمتغيرات بيئة (Environment Variables) داخل لوحة Railway/Vercel مباشرة.

## 1. GitHub

```bash
git remote add origin https://github.com/<username>/<repo>.git
git push -u origin master
```

## 2. Railway (الباك-إند + قاعدة البيانات)

1. New Project → Deploy from GitHub repo → اختر نفس الـ repo.
2. **Settings → Root Directory**: `backend`
3. أضف **Postgres** كخدمة إضافية بنفس المشروع (New → Database → PostgreSQL) — Railway يولّد `DATABASE_URL` تلقائياً ويشاركه مع خدمة الباك-إند إذا فعّلت "Reference Variable".
4. أضف متغيرات البيئة التالية على خدمة الباك-إند:
   - `DATABASE_URL` → مرجع لقاعدة بيانات Postgres اللي أنشأتها (Railway يعبّيها تلقائي عبر "Add Reference")
   - `JWT_ACCESS_SECRET`, `JWT_REFRESH_PEPPER`, `IMAGE_TOKEN_SECRET` → قيم عشوائية قوية (جهّزتها، أعطيك إياها عند التنفيذ الفعلي)
   - `IMAGE_STORAGE_DIR` → `./storage/images`
   - `CORS_ORIGINS` → رابط الفرونت-إند بعد نشره على Vercel (مثال: `https://lunex-team.vercel.app`)
   - `NODE_ENV` → `production`
5. Deploy. بعد أول نشر، خد الرابط العام اللي يعطيك ياه Railway (مثال: `https://lunex-backend-production.up.railway.app`).

## 3. Vercel (الفرونت-إند)

1. Add New Project → Import من نفس الـ GitHub repo.
2. Root Directory: اتركه فاضي (جذر الـ repo — هذا مكان تطبيق Next.js).
3. أضف متغير بيئة واحد:
   - `BACKEND_URL` → رابط الباك-إند من Railway (خطوة 2.5 فوق)
4. Deploy.

## 4. آخر خطوة

ارجع لـ Railway وحدّث `CORS_ORIGINS` بالرابط الفعلي اللي عطاك ياه Vercel، وأعد النشر (Redeploy) للباك-إند.

## ملاحظات

- قاعدة البيانات المحلية SQLite (للتطوير فقط) لازم تتحول لـ Postgres قبل النشر — `prisma/schema.prisma` يحتاج تعديل `provider` من `sqlite` إلى `postgresql`، وتوليد migration جديد ضد قاعدة Railway الحقيقية (لأن SQLite وPostgres عندهم صيغة migration مختلفة).
- التخزين المحلي للصور (`backend/storage/`) غير دائم على Railway (يُمسح عند كل نشر جديد) — كافي للتجربة، لكن للاستخدام الحقيقي لاحقاً يحتاج تخزين خارجي (S3/R2)، موثّق كخطوة مستقبلية بمستند العمارة الأمنية.
