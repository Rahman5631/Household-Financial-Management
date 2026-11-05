// ============================================================
// هدر مشترک صفحات + منوی ناوبری
// ============================================================
import { requireAuth, signOut } from '../auth.js';
import { supabase } from '../services/supabase-client.js';

const NAV_ITEMS = [
    { href: '/dashboard.html', label: 'داشبورد', icon: 'home' },
    { href: '/transactions.html', label: 'تراکنش‌ها', icon: 'list' },
    { href: '/accounts.html', label: 'حساب‌ها', icon: 'credit-card' }
];

export async function initShell() {
    const user = await requireAuth();
    if (!user) return null;

    const { data: profile } = await supabase
        .from('profiles').select('full_name').eq('id', user.id).single();
    const displayName = profile?.full_name || user.email.split('@')[0];

    const current = location.pathname;

    // Sidebar (desktop) + bottom nav (mobile)
    const sidebarHtml = `
        <aside class="sidebar">
            <div class="sidebar-brand">
                <span class="brand-icon">🏠</span>
                <span class="brand-name">خانه‌حساب</span>
            </div>
            <nav class="sidebar-nav">
                ${NAV_ITEMS.map(n => `
                    <a href="${n.href}" class="nav-link ${current === n.href ? 'active' : ''}">
                        ${n.label}
                    </a>
                `).join('')}
            </nav>
            <div class="sidebar-footer">
                <div class="user-chip">
                    <div class="user-avatar">${displayName.charAt(0)}</div>
                    <div class="user-meta">
                        <div class="user-name">${displayName}</div>
                        <div class="user-email">${user.email}</div>
                    </div>
                </div>
                <button class="btn-logout" id="btn-logout">خروج</button>
            </div>
        </aside>
        <nav class="bottom-nav">
            ${NAV_ITEMS.map(n => `
                <a href="${n.href}" class="bottom-link ${current === n.href ? 'active' : ''}">
                    <span>${n.label}</span>
                </a>
            `).join('')}
        </nav>
    `;

    document.body.insertAdjacentHTML('afterbegin', sidebarHtml);
    document.body.classList.add('has-shell');

    document.getElementById('btn-logout').addEventListener('click', signOut);

    return { user, displayName };
}
