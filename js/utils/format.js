// ============================================================
// ابزارهای فرمت‌دهی اعداد و مبالغ
// ============================================================
export function formatNumber(num) {
    const n = Number(num);
    if (!n && n !== 0) return '۰';
    return new Intl.NumberFormat('fa-IR').format(Math.round(n));
}

export function formatCurrency(num) {
    return `${formatNumber(num)} ریال`;
}

export function formatCurrencyShort(num) {
    const n = Number(num) || 0;
    const abs = Math.abs(n);
    if (abs >= 1_000_000_000) return `${formatNumber(n / 1_000_000_000)} میلیارد`;
    if (abs >= 1_000_000) return `${formatNumber(n / 1_000_000)} میلیون`;
    if (abs >= 1_000) return `${formatNumber(n / 1_000)} هزار`;
    return formatNumber(n);
}

export function toPersianDigits(str) {
    return String(str).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
}

export function toEnglishDigits(str) {
    return String(str).replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
}

export function parseAmount(str) {
    const cleaned = toEnglishDigits(String(str || '')).replace(/[^\d]/g, '');
    return parseInt(cleaned, 10) || 0;
}

