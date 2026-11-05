# خانه‌حساب 🏠💰

نرم‌افزار ابری مدیریت مالی خانواده — فارسی، راست‌چین، امن و PWA-ready.

## پیش‌نیازها
- حساب [Supabase](https://supabase.com)
- Git
- (اختیاری) [Supabase CLI](https://supabase.com/docs/guides/cli)
- (اختیاری) سرور محلی ساده مثل `python -m http.server` یا `npx serve`

## راه‌اندازی فاز ۱

### ۱) ساخت پروژهٔ Supabase
1. در Supabase یک پروژهٔ جدید بسازید.
2. از بخش **Project Settings → API**، مقادیر `Project URL` و `anon public key` را کپی کنید.
3. در **Authentication → Providers → Email**، تأیید ایمیل را (برای تست) می‌توانید غیرفعال کنید.

### ۲) اجرای Migrations
در **Supabase Dashboard → SQL Editor** به ترتیب این فایل‌ها را اجرا کنید:
1. `migrations/001_initial_schema.sql`
2. `migrations/002_rls_policies.sql`
3. `migrations/003_seed_categories.sql`
4. `migrations/004_triggers_and_functions.sql`

یا با CLI:
```bash
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
