'use strict';
// render.transactions.js — renderRecentTransactions

function renderRecentTransactions() {
  const el = document.getElementById('recentTxList');
  if (!el) return;
  const txs = S.transactions || [];
  if (!txs.length) {
    el.innerHTML = '<div class="empty-state"><div class="icon">💳</div><strong>Belum ada transaksi</strong><span>Catat pemasukan dan pengeluaran harian kamu di sini.</span></div>';
    if (typeof renderTxLoadMore === 'function') renderTxLoadMore();
    return;
  }
  el.innerHTML = txs.map(t => `
    <div class="tx-item">
      <div style="display:flex;align-items:center;gap:10px;flex:1;min-width:0">
        <div style="width:32px;height:32px;border-radius:8px;background:${t.catColor||'#888'}22;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0">${t.cat||'💳'}</div>
        <div style="min-width:0">
          <div style="font-size:13px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(t.name)}</div>
          <div style="font-size:11px;color:var(--text3)">${esc(t.catName||'')} · ${esc(t.date||t.dateAdded||'')}</div>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:8px;flex-shrink:0">
        <div style="font-size:13px;font-weight:600;color:${t.amount>=0?'var(--accent)':'var(--red)'}">${t.amount>=0?'+':''}${fmtS(Math.abs(t.amount))}</div>
        <div class="row-actions">
          <button class="btn-edit" onclick="openEditModal('tx','${t.id}')" title="Edit">✏️</button>
          <button class="btn-delete" onclick="del('tx','${t.id}','${esc(t.name)}')" title="Hapus">🗑</button>
        </div>
      </div>
    </div>`).join('');
  if (typeof renderTxLoadMore === 'function') renderTxLoadMore();
}
