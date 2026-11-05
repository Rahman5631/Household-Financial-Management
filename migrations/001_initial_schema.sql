-- ============================================================
-- خانه‌حساب | Schema اولیه
-- اجرا در: Supabase SQL Editor یا با Supabase CLI
-- ============================================================

-- افزونهٔ تولید UUID
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------- تابع به‌روزرسانی updated_at ----------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------- پروفایل کاربران ----------
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- خانواده ----------
CREATE TABLE public.households (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL CHECK (length(trim(name)) > 0),
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_households_owner ON public.households(owner_id);

-- ---------- عضویت خانواده ----------
CREATE TABLE public.household_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
    joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(household_id, user_id)
);
CREATE INDEX idx_hm_user ON public.household_members(user_id);
CREATE INDEX idx_hm_household ON public.household_members(household_id);

-- ---------- حساب‌ها ----------
CREATE TABLE public.accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
    name TEXT NOT NULL CHECK (length(trim(name)) > 0),
    account_type TEXT NOT NULL CHECK (account_type IN ('bank','cash','wallet','other')),
    initial_balance NUMERIC(18,0) NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'IRR',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_accounts_household ON public.accounts(household_id);

-- ---------- دسته‌بندی‌ها ----------
CREATE TABLE public.categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id UUID REFERENCES public.households(id) ON DELETE CASCADE,
    name TEXT NOT NULL CHECK (length(trim(name)) > 0),
    type TEXT NOT NULL CHECK (type IN ('income','expense')),
    icon TEXT,
    color TEXT,
    is_system BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(household_id, type, name)
);
CREATE INDEX idx_categories_household ON public.categories(household_id);
CREATE INDEX idx_categories_type ON public.categories(type);

-- ---------- تراکنش‌ها ----------
CREATE TABLE public.transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE RESTRICT,
    category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    type TEXT NOT NULL CHECK (type IN ('income','expense','transfer')),
    amount NUMERIC(18,0) NOT NULL CHECK (amount > 0),
    title TEXT NOT NULL CHECK (length(trim(title)) > 0),
    description TEXT,
    transaction_date DATE NOT NULL,
    transfer_to_account_id UUID REFERENCES public.accounts(id) ON DELETE RESTRICT,
    receipt_url TEXT,
    idempotency_key UUID,
    created_by UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT transfer_shape CHECK (
        (type = 'transfer' AND transfer_to_account_id IS NOT NULL AND category_id IS NULL AND transfer_to_account_id <> account_id)
        OR (type <> 'transfer' AND transfer_to_account_id IS NULL)
    )
);
CREATE UNIQUE INDEX idx_tx_idempotency ON public.transactions(idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX idx_tx_household_date ON public.transactions(household_id, transaction_date DESC);
CREATE INDEX idx_tx_account ON public.transactions(account_id);
CREATE INDEX idx_tx_category ON public.transactions(category_id);

-- ---------- بودجه ----------
CREATE TABLE public.budgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
    category_id UUID REFERENCES public.categories(id) ON DELETE CASCADE,
    year_jalali INT NOT NULL CHECK (year_jalali BETWEEN 1300 AND 1500),
    month_jalali INT NOT NULL CHECK (month_jalali BETWEEN 1 AND 12),
    amount NUMERIC(18,0) NOT NULL CHECK (amount >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(household_id, category_id, year_jalali, month_jalali)
);
CREATE INDEX idx_budgets_household_period ON public.budgets(household_id, year_jalali, month_jalali);

-- ---------- بدهی / طلب ----------
CREATE TABLE public.debts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
    direction TEXT NOT NULL CHECK (direction IN ('receivable','payable')),
    person_name TEXT NOT NULL CHECK (length(trim(person_name)) > 0),
    initial_amount NUMERIC(18,0) NOT NULL CHECK (initial_amount > 0),
    remaining_amount NUMERIC(18,0) NOT NULL CHECK (remaining_amount >= 0),
    due_date DATE,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','settled')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (remaining_amount <= initial_amount)
);
CREATE INDEX idx_debts_household ON public.debts(household_id);

CREATE TABLE public.debt_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    debt_id UUID NOT NULL REFERENCES public.debts(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE RESTRICT,
    amount NUMERIC(18,0) NOT NULL CHECK (amount > 0),
    payment_date DATE NOT NULL,
    transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_debt_payments_debt ON public.debt_payments(debt_id);

-- ---------- وام ----------
CREATE TABLE public.loans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
    bank_name TEXT NOT NULL,
    total_amount NUMERIC(18,0) NOT NULL CHECK (total_amount > 0),
    interest_rate NUMERIC(5,2),
    installment_count INT NOT NULL CHECK (installment_count > 0),
    installment_amount NUMERIC(18,0) NOT NULL CHECK (installment_amount > 0),
    first_installment_date DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_loans_household ON public.loans(household_id);

CREATE TABLE public.loan_installments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loan_id UUID NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
    installment_number INT NOT NULL,
    due_date DATE NOT NULL,
    amount NUMERIC(18,0) NOT NULL CHECK (amount > 0),
    is_paid BOOLEAN NOT NULL DEFAULT false,
    paid_at TIMESTAMPTZ,
    transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
    UNIQUE(loan_id, installment_number)
);
CREATE INDEX idx_installments_due ON public.loan_installments(due_date) WHERE is_paid = false;

-- ---------- دارایی‌ها ----------
CREATE TABLE public.assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    asset_type TEXT NOT NULL CHECK (asset_type IN ('gold','coin','currency','stock','fund','property','vehicle','other')),
    quantity NUMERIC(18,4),
    purchase_price NUMERIC(18,0),
    current_price NUMERIC(18,0),
    purchase_date DATE,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_assets_household ON public.assets(household_id);

-- ---------- اهداف پس‌انداز ----------
CREATE TABLE public.savings_goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    target_amount NUMERIC(18,0) NOT NULL CHECK (target_amount > 0),
    saved_amount NUMERIC(18,0) NOT NULL DEFAULT 0 CHECK (saved_amount >= 0),
    start_date DATE NOT NULL,
    target_date DATE,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','cancelled')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_savings_household ON public.savings_goals(household_id);

-- ---------- پیوست‌ها ----------
CREATE TABLE public.attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
    related_type TEXT NOT NULL,
    related_id UUID NOT NULL,
    file_path TEXT NOT NULL,
    file_size BIGINT,
    mime_type TEXT,
    created_by UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_attachments_related ON public.attachments(related_type, related_id);

-- ---------- تراکنش‌های تکرارشونده ----------
CREATE TABLE public.recurring_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES public.accounts(id),
    category_id UUID REFERENCES public.categories(id),
    type TEXT NOT NULL CHECK (type IN ('income','expense')),
    amount NUMERIC(18,0) NOT NULL CHECK (amount > 0),
    title TEXT NOT NULL,
    frequency TEXT NOT NULL CHECK (frequency IN ('daily','weekly','monthly','yearly')),
    day_of_month INT CHECK (day_of_month BETWEEN 1 AND 31),
    next_run_date DATE NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- رویدادهای مالی (تقویم) ----------
CREATE TABLE public.financial_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    event_date DATE NOT NULL,
    event_type TEXT NOT NULL CHECK (event_type IN ('bill','salary','installment','reminder','other')),
    related_id UUID,
    is_done BOOLEAN NOT NULL DEFAULT false,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_events_household_date ON public.financial_events(household_id, event_date);

-- ---------- تنظیمات کاربر ----------
CREATE TABLE public.user_settings (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    theme TEXT NOT NULL DEFAULT 'light' CHECK (theme IN ('light','dark')),
    calendar TEXT NOT NULL DEFAULT 'jalali' CHECK (calendar IN ('jalali','gregorian')),
    notification_enabled BOOLEAN NOT NULL DEFAULT true,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
