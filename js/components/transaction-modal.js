// ============================================================
// مودال ثبت/ویرایش تراکنش (برای FAB و دکمه‌ها)
// ============================================================
import { createModal, escapeHtml } from './modal.js';
import { getCategories, listAccountsWithBalance, createTransaction, updateTransaction } from '../services/db.js';
import { todayJalaliString, parseJalaliInput, formatJalali } from '../utils/jalali.js';
import { formatNumber, parseAmount } from '../utils/format.js';
import { toast } from './toast.js';

export async function openTransactionModal({ transaction = null, onSaved } = {}) {
    const isEdit = !!transaction;

    let categories, accounts;
    try {
        [categories, accounts] = await Promise.all([getCategories(), listAccountsWithBalance()]);
    } catch (err) {
        toast.error('خطا در بارگذاری اطلاعات: ' + err.message);
        return;
    }

    if (!accounts.length) {
        toast.warning('ابتدا یک حساب بانکی یا نقدی ایجاد کنید.');
        return;
    }

    const currentType = isEdit ? transaction.type : 'expense';
    const html = `
        <form class="tx-form">
            <div class="tx-type-toggle">
                <button type="button" class="tx-type-btn ${currentType === 'expense' ? 'active' : ''}" data-type="expense">هزینه</button>
                <button type="button" class="tx-type-btn ${currentType === 'income' ? 'active' : ''}" data-type="income">درآمد</button>
            </div>

            <div class="form-group">
                <label>عنوان <span class="req">*</span></label>
                <input type="text" name="title" required maxlength="100"
                       value="${isEdit ? escapeHtml(transaction.title) : ''}" autofocus>
            </div>

            <div class="form-group">
                <label>مبلغ (ریال) <span class="req">*</span></label>
                <input type="text" name="amount" inputmode="numeric" required
                       value="${isEdit ? formatNumber(transaction.amount) : ''}">
            </div>

            <div class="form-row">
                <div class="form-group">
                    <label>دسته‌بندی <span class="req">*</span></label>
                    <select name="category_id" required></select>
                </div>
                <div class="form-group">
                    <label>حساب <span class="req">*</span></label>
                    <select name="account_id" required>
                        ${accounts.map(a =>
                            `<option value="${a.id}" ${isEdit && transaction.account_id === a.id ? 'selected' : ''}>${escapeHtml(a.name)}</option>`
                        ).join('')}
                    </select>
                </div>
            </div>

            <div class="form-group">
                <label>تاریخ (شمسی) <span class="req">*</span></label>
                <input type="text" name="date" required
                       value="${isEdit ? formatJalali(transaction.transaction_date) : todayJalaliString()}"
                       placeholder="۱۴۰۳/۰۸/۱۵" dir="ltr" style="text-align:left">
                <small class="hint">قالب: YYYY/MM/DD — مثال: ۱۴۰۳/۰۸/۱۵</small>
            </div>

            <div class="form-group">
                <label>توضیحات (اختیاری)</label>
                <textarea name="description" rows="2" maxlength="500">${isEdit ? escapeHtml(transaction.description || '') : ''}</textarea>
            </div>

            <div class="form-error" id="tx-form-error"></div>

            <div class="modal-actions">
                <button type="button" class="btn btn-secondary" data-cancel>انصراف</button>
                <button type="submit" class="btn btn-primary">${isEdit ? 'ذخیرهٔ تغییرات' : 'ثبت تراکنش'}</button>
            </div>
        </form>
    `;

    const modal = createModal({ title: isEdit ? 'ویرایش تراکنش' : 'ثبت تراکنش جدید', content: html });
    const form = modal.body.querySelector('form');
    const typeBtns = form.querySelectorAll('.tx-type-btn');
    const categorySelect = form.querySelector('select[name="category_id"]');

    let activeType = currentType;
    function renderCategories() {
        const list = categories.filter(c => c.type === activeType);
        categorySelect.innerHTML = '<option value="">انتخاب کنید...</option>' +
            list.map(c => `<option value="${c.id}" ${isEdit && transaction.category_id === c.id ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('');
    }
    renderCategories();

    typeBtns.forEach(b => b.addEventListener('click', () => {
        activeType = b.dataset.type;
        typeBtns.forEach(x => x.classList.toggle('active', x === b));
        renderCategories();
    }));

    form.querySelector('[data-cancel]').onclick = modal.close;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const errEl = form.querySelector('#tx-form-error');
        errEl.textContent = '';

        const fd = new FormData(form);
        const title = fd.get('title').trim();
        const amount = parseAmount(fd.get('amount'));
        const category_id = fd.get('category_id');
        const account_id = fd.get('account_id');
        const description = fd.get('description').trim();
        const transaction_date = parseJalaliInput(fd.get('date'));

        if (!title) return (errEl.textContent = 'عنوان الزامی است.');
        if (!amount || amount <= 0) return (errEl.textContent = 'مبلغ نامعتبر است.');
        if (!category_id) return (errEl.textContent = 'دسته‌بندی را انتخاب کنید.');
        if (!account_id) return (errEl.textContent = 'حساب را انتخاب کنید.');
        if (!transaction_date) return (errEl.textContent = 'تاریخ نامعتبر است. از قالب ۱۴۰۳/۰۸/۱۵ استفاده کنید.');

        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        const origHtml = submitBtn.innerHTML;
        submitBtn.innerHTML = '<span class="spinner"></span>';

        try {
            const payload = {
                title, amount, type: activeType,
                category_id, account_id,
                description: description || null,
                transaction_date
            };
            if (isEdit) await updateTransaction(transaction.id, payload);
            else await createTransaction(payload);

            toast.success(isEdit ? 'تراکنش به‌روزرسانی شد.' : 'تراکنش با موفقیت ثبت شد.');
            modal.close();
            onSaved?.();
        } catch (err) {
            errEl.textContent = err.message || 'خطا در ثبت تراکنش.';
            submitBtn.disabled = false;
            submitBtn.innerHTML = origHtml;
        }
    });
}
