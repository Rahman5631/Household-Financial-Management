// ============================================================
// Bootstrap احراز هویت (صفحهٔ index.html)
// ============================================================
import {
    signUp, signIn, sendPasswordReset, updatePassword,
    redirectIfAuthenticated
} from './auth.js';
import { toast } from './components/toast.js';

const $ = (id) => document.getElementById(id);

// ---------- مدیریت تب‌ها ----------
function showPanel(panel) {
    ['login', 'register', 'forgot', 'reset'].forEach(p => {
        const form = $(`form-${p}`);
        if (form) form.style.display = (p === panel) ? 'block' : 'none';
    });
    document.querySelectorAll('.tab').forEach(t => {
        t.classList.toggle('active', t.dataset.tab === panel);
    });
}

document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => showPanel(tab.dataset.tab));
});

$('btn-forgot').addEventListener('click', () => showPanel('forgot'));
$('btn-back-login').addEventListener('click', () => showPanel('login'));

// ---------- کمکی: مدیریت وضعیت دکمه ----------
function setLoading(btnId, isLoading, text) {
    const btn = $(btnId);
    if (!btn) return;
    if (isLoading) {
        btn.disabled = true;
        btn.dataset.original = btn.innerHTML;
        btn.innerHTML = '<span class="spinner"></span><span>لطفاً صبر کنید...</span>';
    } else {
        btn.disabled = false;
        btn.innerHTML = btn.dataset.original || text;
    }
}

function showError(errorId, msg) {
    const el = $(errorId);
    if (el) el.textContent = msg || '';
}

// ---------- فرم ورود ----------
$('form-login').addEventListener('submit', async (e) => {
    e.preventDefault();
    showError('login-error', '');
    setLoading('btn-login', true);

    try {
        await signIn({
            email: $('login-email').value,
            password: $('login-password').value
        });
        toast.success('خوش آمدید!');
        window.location.href = '/dashboard.html';
    } catch (err) {
        showError('login-error', err.message);
        toast.error(err.message);
    } finally {
        setLoading('btn-login', false, 'ورود به خانه‌حساب');
    }
});

// ---------- فرم ثبت‌نام ----------
$('form-register').addEventListener('submit', async (e) => {
    e.preventDefault();
    showError('register-error', '');

    const password = $('reg-password').value;
    if (password.length < 8) {
        showError('register-error', 'رمز عبور باید حداقل ۸ کاراکتر باشد.');
        return;
    }

    setLoading('btn-register', true);

    try {
        const result = await signUp({
            email: $('reg-email').value,
            password,
            fullName: $('reg-name').value,
            householdName: $('reg-household').value
        });

        // اگر تأیید ایمیل فعال باشد، session وجود ندارد
        if (!result.session) {
            toast.success('ثبت‌نام موفق! لطفاً ایمیل خود را برای تأیید بررسی کنید.');
            showPanel('login');
        } else {
            toast.success('خوش آمدید! حساب شما آماده است.');
            window.location.href = '/dashboard.html';
        }
    } catch (err) {
        showError('register-error', err.message);
        toast.error(err.message);
    } finally {
        setLoading('btn-register', false, 'ایجاد حساب کاربری');
    }
});

// ---------- فراموشی رمز ----------
$('form-forgot').addEventListener('submit', async (e) => {
    e.preventDefault();
    showError('forgot-error', '');
    setLoading('btn-forgot-submit', true);

    try {
        await sendPasswordReset($('forgot-email').value);
        toast.success('لینک بازیابی به ایمیل شما ارسال شد.');
        showPanel('login');
    } catch (err) {
        showError('forgot-error', err.message);
        toast.error(err.message);
    } finally {
        setLoading('btn-forgot-submit', false, 'ارسال لینک بازیابی');
    }
});

// ---------- تعیین رمز جدید (با hash در URL) ----------
if (window.location.hash.includes('reset-password') ||
    new URLSearchParams(window.location.search).has('code') ||
    window.location.hash.includes('access_token')) {
    showPanel('reset');
}

$('form-reset').addEventListener('submit', async (e) => {
    e.preventDefault();
    showError('reset-error', '');
    setLoading('btn-reset-submit', true);

    try {
        await updatePassword($('reset-password').value);
        toast.success('رمز عبور با موفقیت تغییر کرد.');
        window.location.href = '/dashboard.html';
    } catch (err) {
        showError('reset-error', err.message);
        toast.error(err.message);
    } finally {
        setLoading('btn-reset-submit', false, 'ذخیرهٔ رمز جدید');
    }
});

// ---------- اگر لاگین هست، مستقیم به داشبورد ----------
redirectIfAuthenticated();
