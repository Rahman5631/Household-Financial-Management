// ============================================================
// ابزارهای تاریخ شمسی (وابسته به window.jalaali از CDN)
// ============================================================
const MONTHS_FA = ['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'];

function pd(s) { return String(s).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]); }
function ed(s) { return String(s).replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)); }

export function monthName(m) { return MONTHS_FA[m - 1]; }

export function toJalali(dateStr) {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    const j = window.jalaali.toJalaali(d.getFullYear(), d.getMonth() + 1, d.getDate());
    return { year: j.jy, month: j.jm, day: j.jd };
}

export function toGregorian(year, month, day) {
    const g = window.jalaali.toGregorian(year, month, day);
    return `${g.gy}-${String(g.gm).padStart(2, '0')}-${String(g.gd).padStart(2, '0')}`;
}

export function formatJalali(dateStr, { long = false } = {}) {
    const j = toJalali(dateStr);
    if (!j) return '—';
    if (long) return `${pd(j.day)} ${MONTHS_FA[j.month - 1]} ${pd(j.year)}`;
    return `${pd(j.year)}/${pd(String(j.month).padStart(2,'0'))}/${pd(String(j.day).padStart(2,'0'))}`;
}

export function todayJalali() {
    return toJalali(new Date().toISOString().slice(0, 10));
}

export function todayJalaliString() {
    const j = todayJalali();
    return `${j.year}/${String(j.month).padStart(2,'0')}/${String(j.day).padStart(2,'0')}`;
}

export function parseJalaliInput(str) {
    const cleaned = ed(String(str || '').trim());
    const m = cleaned.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
    if (!m) return null;
    const year = +m[1], month = +m[2], day = +m[3];
    if (year < 1300 || year > 1500) return null;
    if (month < 1 || month > 12) return null;
    if (day < 1 || day > 31) return null;
    try { return toGregorian(year, month, day); } catch { return null; }
}

export function getJalaliMonthRange(year, month) {
    const s = window.jalaali.toGregorian(year, month, 1);
    const start = new Date(s.gy, s.gm - 1, s.gd);
    const len = window.jalaali.jalaaliMonthLength(year, month);
    const e = window.jalaali.toGregorian(year, month, len);
    const end = new Date(e.gy, e.gm - 1, e.gd);
    const fmt = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    return { start: fmt(start), end: fmt(end), days: len };
}

export function currentJalaliMonthRange() {
    const t = todayJalali();
    return getJalaliMonthRange(t.year, t.month);
}
