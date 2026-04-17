'use strict';
// render.assets.js — renderAssets

// ---- ASSETS ----
/** Render the assets page: metrics cards, asset grid, history chart. */
function renderAssets() {
  const ta = totalAssets(); const types = {};
  S.assets.forEach(a => { if(!types[a.type]) types[a.type]={items:[],total:0}; types[a.type].items.push(a); types[a.type].total+=a.value; });
  const top = Object.entries(types).sort((a,b) => b[1].total-a[1].total)[0];
  const retPct = totalInvestCost() ? ((totalInvestVal()-totalInvestCost())/totalInvestCost()*100).toFixed(1) : '0.0';

  document.getElementById('asset-metrics').innerHTML = `
    <div class="card-sm"><div class="metric-label">Total Aset</div><div class="metric-value">${fmtS(ta)}</div><div class="metric-sub">${S.assets.length} aset tercatat</div></div>
    <div class="card-sm"><div class="metric-label">Aset Terbesar</div><div class="metric-value c-blue" style="font-size:16px">${top ? TYPE_NAMES[top[0]]||top[0] : '—'}</div><div class="metric-sub">${top&&ta ? (top[1].total/ta*100).toFixed(0) : 0}% dari portofolio</div></div>
    <div class="card-sm"><div class="metric-label">Return Unrealized</div><div class="metric-value ${+retPct>=0?'c-green':'c-red'}">${+retPct>=0?'+':''}${retPct}%</div><div class="metric-sub">vs modal awal</div></div>`;

  if (!S.assets.length) { document.getElementById('assetCards').innerHTML='<div class="empty-state" style="grid-column:1/-1"><div class="icon">💼</div><strong>Belum ada aset</strong><span>Tambahkan saham, reksa dana, properti, emas, atau tabungan kamu.<div class="empty-action"></div></div>'; return; }

  document.getElementById('assetCards').innerHTML = Object.entries(types).map(([type,d]) => `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <div class="section-title">${TYPE_NAMES[type]||type}</div>
        <div style="font-size:14px;font-weight:600">${fmtS(d.total)}</div>
      </div>
      ${d.items.map(a => `
      <div class="tx-item">
        <div><div style="font-size:13px;font-weight:500">${esc(a.name)}</div><div style="font-size:11px;color:var(--text3)">${esc(a.sub)}</div></div>
        <div style="display:flex;align-items:center;gap:8px">
          <div style="text-align:right">
            <div style="font-size:13px;font-weight:500">${fmtS(a.value)}</div>
            <div style="font-size:11px;color:${a.value>=a.cost?'var(--accent)':'var(--red)'}">${a.value>=a.cost?'+':''}${pctChg(a.cost,a.value)}</div>
          </div>
          <div class="row-actions">
            <button onclick="openPriceUpdateModal('${a.id}')" title="Perbarui Nilai" style="font-size:11px;padding:3px 8px;border-radius:4px;border:1px solid var(--accent);color:var(--accent);background:var(--accent-light,rgba(26,107,74,.08));cursor:pointer;white-space:nowrap;font-family:var(--font)">📈 Perbarui</button>
            <button onclick="openTransferModal('${a.id}')" title="Transfer Dana" style="font-size:11px;padding:3px 8px;border-radius:4px;border:1px solid var(--blue,#1a5ba6);color:var(--blue,#1a5ba6);background:rgba(26,91,166,.08);cursor:pointer;white-space:nowrap;font-family:var(--font)">🔄 Transfer</button>
            <button class="btn-edit" onclick="openEditModal('asset','${a.id}')" title="Edit">✏️</button>
            <button class="btn-delete" onclick="del('asset','${a.id}','${esc(a.name)}')">🗑</button>
          </div>
        </div>
      </div>`).join('')}
    </div>`).join('');
  renderAssetHistChart();
}

