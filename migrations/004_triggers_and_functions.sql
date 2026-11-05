-- ============================================================
-- تریگرها و توابع اتمیک
-- ============================================================

-- تریگر updated_at برای همهٔ جداول دارای این ستون
DO $$
DECLARE
    tbl TEXT;
    tables TEXT[] := ARRAY[
        'profiles','households','accounts','categories','transactions',
        'budgets','debts','loans','assets','savings_goals',
        'recurring_transactions','user_settings'
    ];
BEGIN
    FOREACH tbl IN ARRAY tables LOOP
        EXECUTE format(
            'DROP TRIGGER IF EXISTS trg_%1$s_updated_at ON public.%1$s;
             CREATE TRIGGER trg_%1$s_updated_at
             BEFORE UPDATE ON public.%1$s
             FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();',
            tbl
        );
    END LOOP;
END $$;

-- ---------- ایجاد خودکار پروفایل و خانواده هنگام ثبت‌نام ----------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    new_household_id UUID;
BEGIN
    -- ایجاد پروفایل
    INSERT INTO public.profiles (id, full_name)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))
    );

    -- ایجاد خانوادهٔ پیش‌فرض
    INSERT INTO public.households (name, owner_id)
    VALUES (
        COALESCE(NEW.raw_user_meta_data->>'household_name', 'خانوادهٔ من'),
        NEW.id
    )
    RETURNING id INTO new_household_id;

    -- افزودن کاربر به‌عنوان owner
    INSERT INTO public.household_members (household_id, user_id, role)
    VALUES (new_household_id, NEW.id, 'owner');

    -- تنظیمات پیش‌فرض
    INSERT INTO public.user_settings (user_id) VALUES (NEW.id);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ---------- تابع محاسبهٔ موجودی حساب ----------
CREATE OR REPLACE FUNCTION public.account_balance(p_account_id UUID)
RETURNS NUMERIC AS $$
    SELECT
        COALESCE((SELECT initial_balance FROM public.accounts WHERE id = p_account_id), 0)
        + COALESCE((
            SELECT SUM(CASE
                WHEN type = 'income' THEN amount
                WHEN type = 'expense' THEN -amount
                WHEN type = 'transfer' THEN -amount
            END)
            FROM public.transactions
            WHERE account_id = p_account_id
        ), 0)
        + COALESCE((
            SELECT SUM(amount) FROM public.transactions
            WHERE type = 'transfer' AND transfer_to_account_id = p_account_id
        ), 0);
$$ LANGUAGE sql STABLE;

-- ---------- تابع اتمیک پرداخت قسط ----------
CREATE OR REPLACE FUNCTION public.pay_installment_atomic(
    p_installment_id UUID,
    p_account_id UUID,
    p_user_id UUID
) RETURNS UUID AS $$
DECLARE
    v_loan_id UUID;
    v_amount NUMERIC;
    v_household_id UUID;
    v_tx_id UUID;
BEGIN
    -- دریافت اطلاعات قسط و وام
    SELECT li.loan_id, li.amount, l.household_id
    INTO v_loan_id, v_amount, v_household_id
    FROM public.loan_installments li
    JOIN public.loans l ON l.id = li.loan_id
    WHERE li.id = p_installment_id AND li.is_paid = false
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'قسط یافت نشد یا قبلاً پرداخت شده است.';
    END IF;

    -- بررسی عضویت
    IF NOT public.is_household_member(v_household_id, p_user_id) THEN
        RAISE EXCEPTION 'دسترسی غیرمجاز.';
    END IF;

    -- ثبت تراکنش هزینه
    INSERT INTO public.transactions (
        household_id, account_id, type, amount, title,
        transaction_date, created_by
    ) VALUES (
        v_household_id, p_account_id, 'expense', v_amount,
        'پرداخت قسط وام', CURRENT_DATE, p_user_id
    ) RETURNING id INTO v_tx_id;

    -- به‌روزرسانی قسط
    UPDATE public.loan_installments
    SET is_paid = true, paid_at = now(), transaction_id = v_tx_id
    WHERE id = p_installment_id;

    RETURN v_tx_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
