// js/accounts.js
import {
    listAccountsWithBalance, createAccount, updateAccount, deleteAccount,
    createTransaction
} from './services/db.js';
import { formatNumber, parseAmount } from './utils/format.js';
import { formatJalali, todayJalaliString, parseJalaliInput } from './utils/jalali.js';
import { createModal, confirmDialog, escapeHtml } from './components/modal.js';
import { toast } from './components/toast.js';

let accounts = [];

const TYPE_LABELS = {
    bank: 'بانکی', cash: 'نقدی', wallet: 'کیف پول', other: 'سایر'
};

export async function initAccounts() {
    await load();
    document.getElementById('btn-add-account').addEventListener('click', () => openAccountModal());
    document.getElementById('btn-transfer').addEventListener('click', () => openTransferModal());
    document.getElementById('fab-add-tx')?.addEventListener('click', () => {
        // FAB در این صفحه: انتقال سریع
        openTransferModal();
    });
}

async function load() {
    try {
        accounts = await listAccountsWithBalance();
        render();
    } catch (err) {
        toast.error('خطا: ' + err.message);
    }
}

function render() {
    const grid = document.getElementById('accounts-grid');
    if (!accounts.length) {
        grid.innerHTML = `<div class="empty-state">هنوز حسابی ثبت نشده است. برای شروع روی «افزودن حساب» کلیک کنید.</div>`;
        return;
    }
    grid.innerHTML = accounts.map(a => `
        <div class="account-card">
            <div class="account-head">
                <div class="account-type">${TYPE_LABELS[a.account_type] || a.account_type}</div>
                <div class="account-actions">
                    <button class="icon-btn" data-edit="${a.id}" title="ویرایش">✎</button>
                    <button class="icon-btn danger" data-delete="${a.id}" title="حذف">🗑</button>
                </div>
            </div>
            <h3 class="account-name">${escapeHtml(a.name)}</h3>
            <div class="account-balance">
                <span class="balance-value">${formatNumber(a.balance)}</span>
                <span class="balance-unit">ریال</span>
            </div>
            <div class="account-meta">موجودی اولیه: ${formatNumber(a.initial_balance)}</div>
        </div>
    `).join('');

    grid.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => {
        const a = accounts.find(x => x.id === b.dataset.edit);
        if (a) openAccountModal(a);
    }));
    grid.querySelectorAll('[data-delete]').forEach(b => b.addEventListener('click', async () => {
        if (!await confirmDialog('این حساب حذف شود؟ تراکنش‌های مرتبط نیز حذف خواهند شد.', { danger: true })) return;
        try {
            await deleteAccount(b.dataset.delete);
            toast.success('حساب حذف شد.');
            load();
        } catch (err) {
            toast.error('خطا در حذف: ' + err.message);
        }
    }));
}

function openAccountModal(account = null) {
    const isEdit = !!account;
    const html = `
        <form>
            <div class="form-group">
                <label>نام حساب <span class="req">*</span></label>
                <input type="text" name="name" required maxlength="50" value="${isEdit ? escapeHtml(account.name) : ''}">
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>نوع</label>
                    <select name="account_type">
                        ${Object.entries(TYPE_LABELS).map(([k, v]) =>
                            `<option value="${k}" ${isEdit && account.account_type === k ? 'selected' : ''}>${v}</option>`
                        ).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>موجودی اولیه (ریال)</label>
                    <input type="text" name="initial_balance" inputmode="numeric"
                           value="${isEdit ? formatNumber(account.initial_balance) : '0'}" ${isEdit ? 'disabled' : ''}>
                    ${isEdit ? '<small class="hint">برای تغییر موجودی اولیه، از تراکنش استفاده کنید.</small>' : ''}
                </div>
            </div>
            <div class="form-error" id="acc-err"></div>
            <div class="modal-actions">
                <button type="button" class="btn btn-secondary" data-cancel>انصراف</button>
                <button type="submit" class="btn btn-primary">${isEdit ? 'ذخیره' : 'ایجاد حساب'}</button>
            </div>
        </form>
    `;
    const m = createModal({ title: isEdit ? 'ویرایش حساب' : 'حساب جدید', content: html });
    const form = m.body.querySelector('form');
    form.querySelector('[data-cancel]').onclick = m.close;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const err = form.querySelector('#acc-err');
        err.textContent = '';
        const fd = new FormData(form);
        const name = fd.get('name').trim();
        if (!name) return (err.textContent = 'نام حساب الزامی است.');
        try {
            const payload = { name, account_type: fd.get('account_type') };
            if (!isEdit) payload.initial_balance = parseAmount(fd.get('initial_balance'));
            if (isEdit) await updateAccount(account.id, payload);
            else await createAccount(payload);
            toast.success(isEdit ? 'حساب به‌روزرسانی شد.' : 'حساب ایجاد شد.');
            m.close();
            load();
        } catch (ex) {
            err.textContent = ex.message || 'خطا در ذخیره.';
        }
    });
}

function openTransferModal() {
    if (accounts.length < 2) {
        toast.warning('برای انتقال وجه، حداقل دو حساب لازم است.');
        return;
    }
    const html = `
        <form>
            <div class="form-group">
                <label>از حساب</label>
                <select name="from_account" required>
                    ${accounts.map(a => `<option value="${a.id}">${escapeHtml(a.name)} (${formatNumber(a.balance)})</option>`).join('')}
                </select>
            </div>
            <div class="form-group">
                <label>به حساب</label>
                <select name="to_account" required>
                    ${accounts.map(a => `<option value="${a.id}">${escapeHtml(a.name)} (${formatNumber(a.balance)})</option>`).join('')}
                </select>
            </div>
            <div class="form-group">
                <label>مبلغ (ریال) <span class="req">*</span></label>
                <input type="text" name="amount" inputmode="numeric" required>
            </div>
            <div class="form-group">
                <label>تاریخ (شمسی) <span class="req">*</span></label>
                <input type="text" name="date" required value="${todayJalaliString()}" dir="ltr" style="text-align:left">
            </div>
            <div class="form-group">
                <label>عنوان/توضیح</label>
                <input type="text" name="title" value="انتقال بین حساب‌ها" maxlength="80">
            </div>
            <div class="form-error" id="tr-err"></div>
            <div class="modal-actions">
                <button type="button" class="btn btn-secondary" data-cancel>انصراف</button>
                <button type="submit" class="btn btn-primary">ثبت انتقال</button>
            </div>
        </form>
    `;
    const m = createModal({ title: 'انتقال وجه بین حساب‌ها', content: html });
    const form = m.body.querySelector('form');
    form.querySelector('[data-cancel]').onclick = m.close;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const err = form.querySelector('#tr-err');
        err.textContent = '';
        const fd = new FormData(form);
        const from_id = fd.get('from_account');
        const to_id = fd.get('to_account');
        const amount = parseAmount(fd.get('amount'));
        const date = parseJalaliInput(fd.get('date'));
        const title = fd.get('title').trim() || 'انتقال بین حساب‌ها';

        if (from_id === to_id) return (err.textContent = 'حساب مبدأ و مقصد نباید یکی باشند.');
        if (!amount || amount <= 0) return (err.textContent = 'مبلغ نامعتبر است.');
        if (!date) return (err.textContent = 'تاریخ نامعتبر است.');

        try {
            await createTransaction({
                type: 'transfer',
                title,
                amount,
                account_id: from_id,
                transfer_to_account_id: to_id,
                category_id: null,
                transaction_date: date
            });
            toast.success('انتقال وجه ثبت شد.');
            m.close();
            load();
        } catch (ex) {
            err.textContent = ex.message || 'خطا در ثبت انتقال.';
        }
    });
}
