// js/transactions.js
import { listTransactions, deleteTransaction, getCategories, listAccountsWithBalance } from './services/db.js';
import { formatNumber } from './utils/format.js';
import { formatJalali, todayJalaliString, currentJalaliMonthRange } from './utils/jalali.js';
import { openTransactionModal } from './components/transaction-modal.js';
import { confirmDialog, escapeHtml } from './components/modal.js';
import { toast } from './components/toast.js';

let filters = { from: '', to: '', type: '', account_id: '', category_id: '', search: '' };
let offset = 0;
const LIMIT = 30;
let allItems = [];

export async function initTransactions() {
    // مقداردهی اولیه فیلترها: ماه جاری
    const range = currentJalaliMonthRange();
    filters.from = range.start;
    filters.to = range.end;

    await loadFilterOptions();
    await loadList(true);
    wireFilters();
    wireFab();
    wireAddButton();
}

async function loadFilterOptions() {
    const [cats, accs] = await Promise.all([getCategories(), listAccountsWithBalance()]);
    const catSelect = document.getElementById('filter-category');
    catSelect.innerHTML = '<option value="">همهٔ دسته‌ها</option>' +
        cats.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');

    const accSelect = document.getElementById('filter-account');
    accSelect.innerHTML = '<option value="">همهٔ حساب‌ها</option>' +
        accs.map(a => `<option value="${a.id}">${escapeHtml(a.name)}</option>`).join('');
}

function wireFilters() {
    const form = document.getElementById('filter-form');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        filters.type = form.type.value;
        filters.account_id = form.account_id.value;
        filters.category_id = form.category_id.value;
        filters.search = form.search.value.trim();
        filters.from = form.from.value ? parseJalali(form.from.value) : '';
        filters.to = form.to.value ? parseJalali(form.to.value) : '';
        await loadList(true);
    });
    form.addEventListener('reset', async () => {
        setTimeout(async () => {
            const range = currentJalaliMonthRange();
            filters = { from: range.start, to: range.end, type: '', account_id: '', category_id: '', search: '' };
            await loadList(true);
        }, 0);
    });

    // مقدار اولیه در فیلدهای تاریخ
    const today = todayJalaliString();
    form.from.value = today.slice(0, 7) + '/01';
    form.to.value = today;

    document.getElementById('btn-load-more').addEventListener('click', async () => {
        offset += LIMIT;
        await loadList(false, true);
    });
}

function parseJalali(input) {
    // ورودی فرض: YYYY/MM/DD شمسی
    const m = String(input).replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
    if (!m) return '';
    const g = window.jalaali.toGregorian(+m[1], +m[2], +m[3]);
    return `${g.gy}-${String(g.gm).padStart(2,'0')}-${String(g.gd).padStart(2,'0')}`;
}

async function loadList(reset = false, append = false) {
    const tbody = document.getElementById('tx-tbody');
    const empty = document.getElementById('tx-empty');
    const loadMore = document.getElementById('btn-load-more');

    if (reset) {
        offset = 0;
        allItems = [];
        tbody.innerHTML = '<tr><td colspan="6" class="loading-cell">در حال بارگذاری...</td></tr>';
        empty.style.display = 'none';
        loadMore.style.display = 'none';
    }

    try {
        const { items, total } = await listTransactions({ ...filters, limit: LIMIT, offset });
        if (reset) tbody.innerHTML = '';
        allItems = append ? allItems.concat(items) : items;
        renderRows(allItems);

        if (!allItems.length) {
            empty.style.display = 'block';
        } else {
            empty.style.display = 'none';
        }

        loadMore.style.display = (allItems.length < total) ? 'inline-flex' : 'none';
        document.getElementById('tx-count').textContent = total;
    } catch (err) {
        toast.error('خطا در بارگذاری: ' + err.message);
        tbody.innerHTML = `<tr><td colspan="6" class="error-cell">${escapeHtml(err.message)}</td></tr>`;
    }
}

function renderRows(items) {
    const tbody = document.getElementById('tx-tbody');
    if (!items.length) { tbody.innerHTML = ''; return; }

    tbody.innerHTML = items.map(t => {
        const isIncome = t.type === 'income';
        const isTransfer = t.type === 'transfer';
        const cls = isIncome ? 'income' : isTransfer ? 'transfer' : 'expense';
        const sign = isIncome ? '+' : isTransfer ? '' : '−';
        const catName = t.category?.name || (isTransfer ? 'انتقال' : '—');
        return `
            <tr>
                <td>${formatJalali(t.transaction_date)}</td>
                <td><span class="pill pill-${cls}">${isIncome ? 'درآمد' : isTransfer ? 'انتقال' : 'هزینه'}</span></td>
                <td class="tx-title-cell">${escapeHtml(t.title)}${t.description ? `<div class="tx-desc">${escapeHtml(t.description)}</div>` : ''}</td>
                <td>${escapeHtml(catName)}</td>
                <td class="amount-cell ${cls}">${sign}${formatNumber(t.amount)}</td>
                <td class="actions-cell">
                    <button class="icon-btn" data-edit="${t.id}" title="ویرایش">✎</button>
                    <button class="icon-btn danger" data-delete="${t.id}" title="حذف">🗑</button>
                </td>
            </tr>
        `;
    }).join('');

    tbody.querySelectorAll('[data-edit]').forEach(btn => {
        btn.addEventListener('click', () => {
            const tx = allItems.find(x => x.id === btn.dataset.edit);
            if (tx) openTransactionModal({ transaction: tx, onSaved: () => loadList(true) });
        });
    });
    tbody.querySelectorAll('[data-delete]').forEach(btn => {
        btn.addEventListener('click', async () => {
            if (!await confirmDialog('این تراکنش حذف شود؟', { danger: true })) return;
            try {
                await deleteTransaction(btn.dataset.delete);
                toast.success('تراکنش حذف شد.');
                loadList(true);
            } catch (err) {
                toast.error('خطا در حذف: ' + err.message);
            }
        });
    });
}

function wireFab() {
    document.getElementById('fab-add-tx')?.addEventListener('click', () => {
        openTransactionModal({ onSaved: () => loadList(true) });
    });
}

function wireAddButton() {
    document.getElementById('btn-add-tx')?.addEventListener('click', () => {
        openTransactionModal({ onSaved: () => loadList(true) });
    });
}
