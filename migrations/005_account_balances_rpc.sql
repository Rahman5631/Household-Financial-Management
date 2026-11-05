-- ============================================================
-- RPC محاسبهٔ موجودی همهٔ حساب‌های یک خانواده
-- ============================================================
CREATE OR REPLACE FUNCTION public.household_account_balances(p_household_id UUID)
RETURNS TABLE (
    id UUID,
    name TEXT,
    account_type TEXT,
    initial_balance NUMERIC,
    currency TEXT,
    is_active BOOLEAN,
    balance NUMERIC
) AS $$
BEGIN
    IF NOT public.is_household_member(p_household_id, auth.uid()) THEN
        RAISE EXCEPTION 'دسترسی غیرمجاز.';
    END IF;

    RETURN QUERY
    SELECT
        a.id,
        a.name,
        a.account_type,
        a.initial_balance,
        a.currency,
        a.is_active,
        a.initial_balance
        + COALESCE((
            SELECT SUM(CASE
                WHEN t.type = 'income' THEN t.amount
                WHEN t.type = 'expense' THEN -t.amount
                WHEN t.type = 'transfer' THEN -t.amount
            END)
            FROM public.transactions t WHERE t.account_id = a.id
        ), 0)
        + COALESCE((
            SELECT SUM(t.amount)
            FROM public.transactions t
            WHERE t.type = 'transfer' AND t.transfer_to_account_id = a.id
        ), 0) AS balance
    FROM public.accounts a
    WHERE a.household_id = p_household_id
    ORDER BY a.created_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
