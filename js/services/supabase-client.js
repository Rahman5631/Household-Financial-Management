// ============================================================
// کلاینت Supabase — تک‌نمونه (Singleton)
// ============================================================
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.0/+esm';
import { CONFIG } from '../config.js';

export const supabase = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: window.localStorage,
        flowType: 'pkce'
    },
    global: {
        headers: { 'x-application-name': CONFIG.APP_NAME }
    }
});

// ---------- ترجمهٔ خطاهای رایج Supabase به فارسی ----------
export function translateAuthError(error) {
    if (!error) return 'خطای نامشخص';
    const msg = (error.message || '').toLowerCase();

    if (msg.includes('invalid login credentials')) return 'ایمیل یا رمز عبور نادرست است.';
    if (msg.includes('email not confirmed')) return 'ایمیل شما هنوز تأیید نشده است. لطفاً صندوق ایمیل خود را بررسی کنید.';
    if (msg.includes('user already registered')) return 'این ایمیل قبلاً ثبت‌نام کرده است.';
    if (msg.includes('password should be at least')) return 'رمز عبور باید حداقل ۸ کاراکتر باشد.';
    if (msg.includes('unable to validate email')) return 'فرمت ایمیل نامعتبر است.';
    if (msg.includes('rate limit')) return 'تلاش‌های بیش از حد. لطفاً چند دقیقه صبر کنید.';
    if (msg.includes('network') || msg.includes('fetch')) return 'خطای شبکه. اتصال اینترنت خود را بررسی کنید.';
    if (msg.includes('jwt') || msg.includes('token')) return 'نشست شما منقضی شده است. لطفاً دوباره وارد شوید.';
    return 'خطا: ' + (error.message || 'ناشناخته');
}
