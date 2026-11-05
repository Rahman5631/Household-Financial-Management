// ============================================================
// مودال عمومی
// ============================================================
export function createModal({ title, content, size = 'md', onClose }) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
        <div class="modal modal-${size}" role="dialog" aria-modal="true">
            <div class="modal-header">
                <h3>${title}</h3>
                <button class="modal-close" type="button" aria-label="بستن">×</button>
            </div>
            <div class="modal-body"></div>
        </div>
    `;
    const body = overlay.querySelector('.modal-body');
    if (typeof content === 'string') body.innerHTML = content;
    else body.appendChild(content);

    const close = () => {
        overlay.classList.remove('modal-show');
        setTimeout(() => overlay.remove(), 200);
        document.body.style.overflow = '';
        onClose?.();
    };

    overlay.querySelector('.modal-close').addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    document.addEventListener('keydown', function onEsc(e) {
        if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onEsc); }
    });

    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => overlay.classList.add('modal-show'));

    return { overlay, body, close };
}

export function confirmDialog(message, { title = 'تأیید', danger = false } = {}) {
    return new Promise(resolve => {
        const modal = createModal({
            title,
            size: 'sm',
            content: `
                <p class="confirm-msg">${message}</p>
                <div class="modal-actions">
                    <button type="button" class="btn btn-secondary" data-cancel>انصراف</button>
                    <button type="button" class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-ok>تأیید</button>
                </div>
            `,
            onClose: () => resolve(false)
        });
        modal.body.querySelector('[data-cancel]').onclick = () => { modal.close(); };
        modal.body.querySelector('[data-ok]').onclick = () => { resolve(true); modal.close(); };
    });
}

export function escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}
