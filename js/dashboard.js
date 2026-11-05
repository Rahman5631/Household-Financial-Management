// ============================================================
// داشبورد اصلی
// ============================================================
import {
    getDashboardSummary, getCategoryBreakdown, getRecentTransactions,
    listAccountsWithBalance
} from './services/db.js';
import { formatNumber, formatCurrencyShort, toPersianDigits } from './utils/format.js';
import { todayJalali, getJalaliMonthRange, formatJalali, monthName } from './utils/jalali.js';
import { escapeHtml } from './components/modal.js';
import { openTransactionModal } from './components/transaction-modal.js';
import { toast } from './components/toast.js';

Chart.defaults.font.family = 'Vazirmatn, sans-serif';
Chart.defaults.font.size = 12;
Chart.defaults.color = '#64748b';

let chartCategory = null;
let chartTrend = null;

export async function loadDashboard() {
    const today = todayJalali();
    const { start, end } = getJalaliMonthRange(today.year, today.month);
    document.getElementById('current-period').textContent =
        `${monthName(today.month)} ${toPersianDigits(today.year)}`;

    try {
        const [summary, breakdown, recent, accounts] = await Promise.all([
            getDashboardSummary(start, end),
            getCategoryBreakdown(start, end),
            getRecentTransactions(6),
            listAccountsWithBalance()
        ]);

        const cash = accounts
            .filter(a => a.account_type === 'cash' || a.account_type === 'wallet')
            .reduce((s, a) => s + Number(a.balance), 0);
        const bank = accounts
            .filter(a => a.account_type === 'bank')
            .reduce((s, a) => s + Number(a.balance), 0);
        const total = accounts.reduce((s, a) => s + Number(a.balance), 0);

        set('stat-income', formatNumber(summary.income));
        set('stat-expense', formatNumber(summary.expense));
        set('stat-net', formatNumber(summary.net));
        set('stat-cash', formatNumber(cash));
        set('stat-bank', formatNumber(bank));
        set('stat-total', formatNumber(total));

        renderCategoryChart(breakdown);
        await renderTrendChart();
        renderRecent(recent);
    } catch (err) {
        console.error(err);
        toast.error('خطا در بارگذاری داشبورد: ' + err.message);
    }
}

function set(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
}

function renderCategoryChart(data) {
    const canvas = document.getElementById('chart-categories');
    if (!canvas) return;
    chartCategory?.destroy();

    if (!data.length) {
        canvas.parentElement.innerHTML =
            '<div class="empty-state">هزینه‌ای در این ماه ثبت نشده است.</div>';
        return;
    }

    chartCategory = new Chart(canvas, {
        type: 'doughnut',
        data: {
            labels: data.map(d => d.name),
            datasets: [{
                data: data.map(d => d.amount),
                backgroundColor: data.map(d => d.color),
                borderWidth: 2,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '62%',
            plugins: {
                legend: {
                    position: 'bottom',
                    rtl: true,
                    labels: { font: { family: 'Vazirmatn' }, padding: 12, boxWidth: 12 }
                },
                tooltip: {
                    callbacks: {
                        label: ctx => ` ${ctx.label}: ${formatNumber(ctx.parsed)} ریال`
                    }
                }
            }
        }
    });
}

async function renderTrendChart() {
    const today = todayJalali();
    const labels = [], incomes = [], expenses = [];

    for (let i = 5; i >= 0; i--) {
        let m = today.month - i, y = today.year;
        while (m < 1) { m += 12; y -= 1; }
        const { start, end } = getJalaliMonthRange(y, m);
        try {
            const s = await getDashboardSummary(start, end);
            incomes.push(s.income);
            expenses.push(s.expense);
            labels.push(`${monthName(m)} ${toPersianDigits(String(y).slice(-2))}`);
        } catch { /* ignore */ }
    }

    const canvas = document.getElementById('chart-trend');
    if (!canvas) return;
    chartTrend?.destroy();

    chartTrend = new Chart(canvas, {
        type: 'bar',
        data: {
            labels,
            datasets: [
                { label: 'درآمد', data: incomes, backgroundColor: '#10b981', borderRadius: 6, maxBarThickness: 32 },
                { label: 'هزینه', data: expenses, backgroundColor: '#ef4444', borderRadius: 6, maxBarThickness: 32 }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom', rtl: true, labels: { font: { family: 'Vazirmatn' }, boxWidth: 12 } },
                tooltip: {
                    callbacks: {
                        label: ctx => `${ctx.dataset.label}: ${formatNumber(ctx.parsed.y)} ریال`
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { callback: v => formatCurrencyShort(v), font: { family: 'Vazirmatn' } },
                    grid: { color: '#f1f5f9' }
                },
                x: { ticks: { font: { family: 'Vazirmatn' } }, grid: { display: false } }
            }
        }
    });
}

function renderRecent(items) {
    const box = document.getElementById('recent-transactions');
    if (!box) return;
    if (!items.length) {
        box.innerHTML = '<div class="empty-state">هنوز تراکنشی ثبت نشده است.</div>';
        return;
    }
    box.innerHTML = items.map(t => {
        const isIncome = t.type === 'income';
        const isTransfer = t.type === 'transfer';
        const cls = isIncome ? 'income' : isTransfer ? 'transfer' : 'expense';
        const sign = isIncome ? '+' : isTransfer ? '' : '−';
        return `
            <div class="tx-row">
                <div class="tx-row-icon ${cls}">${isIncome ? '↓' : isTransfer ? '⇄' : '↑'}</div>
                <div class="tx-row-body">
                    <div class="tx-row-title">${escapeHtml(t.title)}</div>
                    <div class="tx-row-meta">${formatJalali(t.transaction_date)} · ${escapeHtml(t.category?.name || '—')}</div>
                </div>
                <div class="tx-row-amount ${cls}">${sign}${formatNumber(t.amount)}</div>
            </div>
        `;
    }).join('');
}

export function wireFab() {
    document.getElementById('fab-add-tx')?.addEventListener('click', () => {
        openTransactionModal({ onSaved: loadDashboard });
    });
}
