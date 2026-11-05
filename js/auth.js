// ============================================================
// ماژول احراز هویت
// ============================================================
import { supabase, translateAuthError } from './services/supabase-client.js';

// ---------- ثبت‌نام ----------
export async function signUp({ email, password, fullName, householdName }) {
    const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
            data: {
                full_name: fullName.trim(),
                household_name: householdName?.trim() || 'خانوادهٔ من'
            },
            emailRedirectTo: `${location.origin}/index.html`
        }
    });
    if (error) throw new Error(translateAuthError(error));
    return data;
}

// ---------- ورود ----------
export async function signIn({ email, password }) {
    const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password
    });
    if (error) throw new Error(translateAuthError(error));
    return data;
}

// ---------- خروج ----------
export async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw new Error(translateAuthError(error));
    window.location.href = '/index.html';
}

// ---------- بازیابی رمز عبور ----------
export async function sendPasswordReset(email) {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${location.origin}/index.html#reset-password`
    });
    if (error) throw new Error(translateAuthError(error));
}

// ---------- تغییر رمز عبور ----------
export async function updatePassword(newPassword) {
    if (newPassword.length < 8) {
        throw new Error('رمز عبور باید حداقل ۸ کاراکتر باشد.');
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw new Error(translateAuthError(error));
}

// ---------- دریافت کاربر فعلی ----------
export async function getCurrentUser() {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
}

// ---------- محافظت از صفحه (redirect به login در صورت عدم ورود) ----------
export async function requireAuth() {
    const user = await getCurrentUser();
    if (!user) {
        window.location.href = '/index.html';
        return null;
    }
    return user;
}

// ---------- هدایت کاربر لاگین‌شده به داشبورد ----------
export async function redirectIfAuthenticated() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
        window.location.href = '/dashboard.html';
    }
}

// ---------- گوش دادن به تغییرات نشست (برای امنیت) ----------
supabase.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT' || event === 'USER_DELETED') {
        if (location.pathname !== '/index.html') {
            location.href = '/index.html';
        }
    }
});
