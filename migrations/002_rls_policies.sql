-- ============================================================
-- خانه‌حساب | Row Level Security
-- اصل: هر کاربر فقط به دادهٔ خانواده‌هایی که عضوش است دسترسی دارد
-- ============================================================

-- فعال‌سازی RLS روی همهٔ جداول
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.households ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.household_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debt_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loan_installments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.savings_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- ---------- تابع کمکی: آیا کاربر عضو این خانواده است؟ ----------
CREATE OR REPLACE FUNCTION public.is_household_member(p_household_id UUID, p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.household_members
        WHERE household_id = p_household_id AND user_id = p_user_id
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ---------- profiles ----------
CREATE POLICY "profiles_self_select" ON public.profiles
    FOR SELECT USING (id = auth.uid());
CREATE POLICY "profiles_self_update" ON public.profiles
    FOR UPDATE USING (id = auth.uid());

-- ---------- households ----------
CREATE POLICY "households_member_select" ON public.households
    FOR SELECT USING (public.is_household_member(id));
CREATE POLICY "households_owner_insert" ON public.households
    FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "households_owner_update" ON public.households
    FOR UPDATE USING (owner_id = auth.uid());

-- ---------- household_members ----------
CREATE POLICY "hm_self_or_member_select" ON public.household_members
    FOR SELECT USING (
        user_id = auth.uid() OR public.is_household_member(household_id)
    );
CREATE POLICY "hm_owner_insert" ON public.household_members
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM public.households WHERE id = household_id AND owner_id = auth.uid())
    );
CREATE POLICY "hm_owner_delete" ON public.household_members
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM public.households WHERE id = household_id AND owner_id = auth.uid())
        OR user_id = auth.uid()
    );

-- ---------- الگوی عمومی برای جداول خانواده‌محور ----------
DO $$
DECLARE
    tbl TEXT;
    tables TEXT[] := ARRAY[
        'accounts','budgets','debts','loans','assets',
        'savings_goals','attachments','recurring_transactions',
        'financial_events'
    ];
BEGIN
    FOREACH tbl IN ARRAY tables LOOP
        EXECUTE format(
            'CREATE POLICY "%1$s_member_all" ON public.%1$s
             FOR ALL USING (public.is_household_member(household_id))
             WITH CHECK (public.is_household_member(household_id));',
            tbl
        );
    END LOOP;
END $$;

-- ---------- categories (سراسری + خصوصی) ----------
CREATE POLICY "categories_select" ON public.categories
    FOR SELECT USING (
        household_id IS NULL OR public.is_household_member(household_id)
    );
CREATE POLICY "categories_insert" ON public.categories
    FOR INSERT WITH CHECK (
        household_id IS NOT NULL AND public.is_household_member(household_id)
    );
CREATE POLICY "categories_update" ON public.categories
    FOR UPDATE USING (
        household_id IS NOT NULL AND public.is_household_member(household_id) AND is_system = false
    );
CREATE POLICY "categories_delete" ON public.categories
    FOR DELETE USING (
        household_id IS NOT NULL AND public.is_household_member(household_id) AND is_system = false
    );

-- ---------- transactions ----------
CREATE POLICY "tx_select" ON public.transactions
    FOR SELECT USING (public.is_household_member(household_id));
CREATE POLICY "tx_insert" ON public.transactions
    FOR INSERT WITH CHECK (
        public.is_household_member(household_id) AND created_by = auth.uid()
    );
CREATE POLICY "tx_update" ON public.transactions
    FOR UPDATE USING (public.is_household_member(household_id));
CREATE POLICY "tx_delete" ON public.transactions
    FOR DELETE USING (public.is_household_member(household_id));

-- ---------- debt_payments و loan_installments (از طریق والد) ----------
CREATE POLICY "debt_payments_access" ON public.debt_payments
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.debts d
            WHERE d.id = debt_payments.debt_id
              AND public.is_household_member(d.household_id)
        )
    );

CREATE POLICY "installments_access" ON public.loan_installments
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.loans l
            WHERE l.id = loan_installments.loan_id
              AND public.is_household_member(l.household_id)
        )
    );

-- ---------- user_settings ----------
CREATE POLICY "settings_self" ON public.user_settings
    FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
