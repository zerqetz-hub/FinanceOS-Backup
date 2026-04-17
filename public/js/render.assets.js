'use strict';
// render.assets.js — renderAssets

// ---- ASSETS ----
/** Render the assets page: metrics cards, asset grid, history chart. */
function renderAssets() {
  const ta = totalAssets(); const types = {};
  S.assets.forEach(a => { if(!types[a.type]) types[a.type]={items:[],total:0}; types[a.type].items.push(a); types[a.type].total+=a.value; });
  const totalCost = S.assets.reduce((s,a) => s + (a.cost||0), 0);
  const pnlRp  = ta - totalCost;
  const retPct = totalCost ? (pnlRp / totalCost * 100).toFixed(1) : '0.0';

  document.getElementById('asset-metrics').innerHTML = `
    <div class="card-sm"><div class="metric-label">Total Modal</div><div class="metric-value">${fmtS(totalCost)}</div><div class="metric-sub">${S.assets.length} aset tercatat</div></div>
    <div class="card-sm"><div class="metric-label">Nilai Pasar</div><div class="metric-value c-blue">${fmtS(ta)}</div><div class="metric-sub">harga sekarang</div></div>
    <div class="card-sm"><div class="metric-label">Unrealized PnL</div><div class="metric-value ${pnlRp>=0?'c-green':'c-red'}">${pnlRp>=0?'+':''}${fmtS(Math.abs(pnlRp))}</div><div class="metric-sub">${pnlRp>=0?'+':''}${retPct}% vs modal</div></div>`;

  if (!S.assets.length) { document.getElementById('assetCards').innerHTML='<div class="empty-state" style="grid-column:1/-1"><div class="icon">💼</div><strong>Belum ada aset</strong><span>Tambahkan saham, reksa dana, properti, emas, atau tabungan kamu.</span><div class="empty-action"></div></div>'; return; }

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
            <button class="btn-edit" onclick="openTopUpModal('${a.id}')" title="Tambah Modal">💰</button>
            <button class="btn-edit" onclick="openPriceUpdateModal('${a.id}')" title="Update Nilai Pasar">📈</button>
            <button class="btn-edit" onclick="openTransferModal('${a.id}')" title="Transfer Dana">🔄</button>
            <button class="btn-edit" onclick="openEditModal('asset','${a.id}')" title="Edit">✏️</button>
            <button class="btn-delete" onclick="del('asset','${a.id}','${esc(a.name)}')">🗑</button>
          </div>
        </div>
      </div>`).join('')}
    </div>`).join('');
  renderAssetHistChart();
}

