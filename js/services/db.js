// ============================================================
// لایهٔ دسترسی به دیتابیس
// ============================================================
import { supabase } from './supabase-client.js';

let _hhCache = null;
let _catCache = null;

export async function getMyHousehold(force = false) {
    if (_hhCache && !force) return _hhCache;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('کاربر وارد نشده است.');

    const { data, error } = await supabase
        .from('household_members')
        .select('household_id, role, households(name)')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();

    if (error) throw new Error('خطا در دریافت اطلاعات خانواده: ' + error.message);
    if (!data) throw new Error('خانواده‌ای برای این کاربر یافت نشد.');

    _hhCache = {
        id: data.household_id,
        role: data.role,
        name: data.households?.name || 'خانواده'
    };
    return _hhCache;
}

export async function getCategories(force = false) {
    if (_catCache && !force) return _catCache;
    const hh = await getMyHousehold();
    const { data, error } = await supabase
        .from('categories')
        .select('*')
        .or(`household_id.is.null,household_id.eq.${hh.id}`)
        .order('type')
        .order('name');
    if (error) throw error;
    _catCache = data;
    return data;
}

// ---------- حساب‌ها ----------
export async function listAccountsWithBalance() {
    const hh = await getMyHousehold();
    const { data, error } = await supabase.rpc('household_account_balances', {
        p_household_id: hh.id
    });
    if (error) throw error;
    return data;
}

export async function createAccount({ name, account_type, initial_balance }) {
    const hh = await getMyHousehold();
    const { data, error } = await supabase
        .from('accounts')
        .insert({
            household_id: hh.id,
            name,
            account_type,
            initial_balance: Number(initial_balance) || 0
        })
        .select()
        .single();
    if (error) throw error;
    return data;
}

export async function updateAccount(id, patch) {
    const { data, error } = await supabase
        .from('accounts').update(patch).eq('id', id).select().single();
    if (error) throw error;
    return data;
}

export async function deleteAccount(id) {
    const { error } = await supabase.from('accounts').delete().eq('id', id);
    if (error) throw error;
}

// ---------- تراکنش‌ها ----------
export async function listTransactions({
    from, to, type, account_id, category_id, search, limit = 50, offset = 0
} = {}) {
    const hh = await getMyHousehold();
    let q = supabase
        .from('transactions')
        .select('*, category:categories(id,name,type,color)', { count: 'exact' })
        .eq('household_id', hh.id)
        .order('transaction_date', { ascending: false })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

    if (from) q = q.gte('transaction_date', from);
    if (to) q = q.lte('transaction_date', to);
    if (type) q = q.eq('type', type);
    if (account_id) q = q.or(`account_id.eq.${account_id},transfer_to_account_id.eq.${account_id}`);
    if (category_id) q = q.eq('category_id', category_id);
    if (search) q = q.ilike('title', `%${search}%`);

    const { data, error, count } = await q;
    if (error) throw error;
    return { items: data, total: count };
}

export async function createTransaction(payload) {
    const hh = await getMyHousehold();
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase
        .from('transactions')
        .insert({
            household_id: hh.id,
            created_by: user.id,
            ...payload,
            idempotency_key: crypto.randomUUID()
        })
        .select()
        .single();
    if (error) throw error;
    return data;
}

export async function updateTransaction(id, patch) {
    const { data, error } = await supabase
        .from('transactions').update(patch).eq('id', id).select().single();
    if (error) throw error;
    return data;
}

export async function deleteTransaction(id) {
    const { error } = await supabase.from('transactions').delete().eq('id', id);
    if (error) throw error;
}

// ---------- تجمیع برای داشبورد ----------
export async function getDashboardSummary(start, end) {
    const hh = await getMyHousehold();
    const { data, error } = await supabase
        .from('transactions')
        .select('type, amount')
        .eq('household_id', hh.id)
        .gte('transaction_date', start)
        .lte('transaction_date', end);
    if (error) throw error;

    let income = 0, expense = 0;
    for (const t of data) {
        if (t.type === 'income') income += Number(t.amount);
        else if (t.type === 'expense') expense += Number(t.amount);
    }
    return { income, expense, net: income - expense };
}

export async function getCategoryBreakdown(start, end) {
    const hh = await getMyHousehold();
    const { data, error } = await supabase
        .from('transactions')
        .select('amount, category:categories(name,color)')
        .eq('household_id', hh.id)
        .eq('type', 'expense')
        .gte('transaction_date', start)
        .lte('transaction_date', end);
    if (error) throw error;

    const map = new Map();
    for (const t of data) {
        const name = t.category?.name || 'سایر';
        const color = t.category?.color || '#94a3b8';
        const existing = map.get(name) || { name, color, amount: 0 };
        existing.amount += Number(t.amount);
        map.set(name, existing);
    }
    return Array.from(map.values()).sort((a, b) => b.amount - a.amount);
}

export async function getRecentTransactions(limit = 5) {
    const hh = await getMyHousehold();
    const { data, error } = await supabase
        .from('transactions')
        .select('*, category:categories(name,type,color)')
        .eq('household_id', hh.id)
        .order('transaction_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(limit);
    if (error) throw error;
    return data;
}
