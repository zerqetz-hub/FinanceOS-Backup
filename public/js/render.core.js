'use strict';
// render.core.js — render system, dirty pages, _currentPage

// ── render.js — lazy per-page rendering and Chart.js charts ────────────────
// @requires state.js (S), helpers.js (fmt, fmtS, sortedCF, …)
'use strict';

/** Active dashboard time filter — mutated by setFilter() in ui.js. */
let _dashFilter = 'Bulanan';

// =============================================
// RENDER SYSTEM — lazy per-page
// =============================================
const _dirtyPages = new Set();
let _currentPage = 'dashboard';

// Mark all pages dirty (data changed globally)
/** Mark all pages dirty and render the currently visible one. */
function renderAll() {
  _dirtyPages.add('dashboard');
  _dirtyPages.add('cashflow');
  _dirtyPages.add('assets');
  _dirtyPages.add('debts');
  _dirtyPages.add('networth');
  _dirtyPages.add('goals');
  _dirtyPages.add('emergency');
  _dirtyPages.add('investment');
  _renderCurrentPage();
  renderRecentTransactions();
}

// Only render the currently visible page
/** Render only the currently active page if it is marked dirty. */
function _renderCurrentPage() {
  const id = _currentPage;
  if (!_dirtyPages.has(id)) return;
  _dirtyPages.delete(id);
  switch(id) {
    case 'dashboard':   renderDashboard(); break;
    case 'cashflow':    renderCashflow();  break;
    case 'assets':      renderAssets();    break;
    case 'debts':       renderDebts();     break;
    case 'networth':    renderNetWorth(); setTimeout(() => renderNWSimulator(), 60); break;
    case 'goals':       renderGoals();     break;
    case 'emergency':   renderEmergency(); break;
    case 'investment':  renderInvestment(); break;
  }
}

