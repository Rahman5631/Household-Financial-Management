-- ============================================================
-- دسته‌بندی‌های سیستمی (سراسری، household_id = NULL)
-- ============================================================

INSERT INTO public.categories (household_id, name, type, icon, color, is_system) VALUES
-- درآمدها
(NULL, 'حقوق', 'income', 'wallet', '#10b981', true),
(NULL, 'درآمد شغل دوم', 'income', 'briefcase', '#10b981', true),
(NULL, 'کسب‌وکار', 'income', 'store', '#10b981', true),
(NULL, 'اجاره', 'income', 'home', '#10b981', true),
(NULL, 'سود سرمایه‌گذاری', 'income', 'trending-up', '#10b981', true),
(NULL, 'هدیه', 'income', 'gift', '#10b981', true),
(NULL, 'سایر درآمدها', 'income', 'plus-circle', '#10b981', true),
-- هزینه‌ها
(NULL, 'خوراک', 'expense', 'utensils', '#ef4444', true),
(NULL, 'مسکن', 'expense', 'home', '#ef4444', true),
(NULL, 'قبوض', 'expense', 'file-text', '#ef4444', true),
(NULL, 'حمل‌ونقل', 'expense', 'car', '#ef4444', true),
(NULL, 'درمان', 'expense', 'heart-pulse', '#ef4444', true),
(NULL, 'پوشاک', 'expense', 'shirt', '#ef4444', true),
(NULL, 'آموزش', 'expense', 'graduation-cap', '#ef4444', true),
(NULL, 'تفریح', 'expense', 'smile', '#ef4444', true),
(NULL, 'تعمیرات', 'expense', 'wrench', '#ef4444', true),
(NULL, 'خرید خانه', 'expense', 'building', '#ef4444', true),
(NULL, 'اقساط', 'expense', 'calendar', '#ef4444', true),
(NULL, 'سایر هزینه‌ها', 'expense', 'more-horizontal', '#ef4444', true)
ON CONFLICT DO NOTHING;
