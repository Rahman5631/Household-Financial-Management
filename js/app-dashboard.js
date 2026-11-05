// ============================================================
// Entry برای dashboard.html
// ============================================================
import { initShell } from './components/shell.js';
import { loadDashboard, wireFab } from './dashboard.js';

const shell = await initShell();
if (shell) {
    wireFab();
    await loadDashboard();
}
