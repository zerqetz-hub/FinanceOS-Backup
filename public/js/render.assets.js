'use strict';
// render.assets.js — renderAssets

// ---- ASSETS ----
/** Render the assets page: metrics cards, asset grid, history chart. */
function renderAssets() {
  const ta        = totalAssets();
  const totalCost = S.assets.reduce((s, a) => s + a.cost, 0);
  const totalPnl  = ta - totalCost;
  const totalPnlPct = totalCost > 0 ? (totalPnl / totalCost * 100) : 0;

  const types = {};
  S.assets.forEach(a => {
    if (!types[a.type]) types[a.type] = { items: [], totalVal: 0, totalCost: 0 };
    types[a.type].items.push(a);
    types[a.type].totalVal  += a.value;
    types[a.type].totalCost += a.cost;
  });

  document.getElementById('asset-metrics').innerHTML = `
    <div class="card-sm">
      <div class="metric-label">Modal Diinvest</div>
      <div class="metric-value">${fmtS(totalCost)}</div>
      <div class="metric-sub">${S.assets.length} aset</div>
    </div>
    <div class="card-sm">
      <div class="metric-label">Nilai Pasar</div>
      <div class="metric-value">${fmtS(ta)}</div>
      <div class="metric-sub">Harga terkini</div>
    </div>
    <div class="card-sm">
      <div class="metric-label">Unrealized PnL</div>
      <div class="metric-value ${totalPnl>=0?'c-green':'c-red'}">${totalPnl>=0?'+':''}${fmtS(Math.abs(totalPnl))}</div>
      <div class="metric-sub" style="color:${totalPnl>=0?'var(--accent)':'var(--red)'}">${totalPnl>=0?'+':''}${totalPnlPct.toFixed(1)}% dari modal</div>
    </div>`;

  if (!S.assets.length) { document.getElementById('assetCards').innerHTML='<div class="empty-state" style="grid-column:1/-1"><div class="icon">💼</div><strong>Belum ada aset</strong><span>Tambahkan saham, reksa dana, properti, emas, atau tabungan kamu.<div class="empty-action"></div></div>'; return; }

  document.getElementById('assetCards').innerHTML = Object.entries(types).map(([type, d]) => {
    const grpPnl    = d.totalVal - d.totalCost;
    const grpPnlPct = d.totalCost > 0 ? (grpPnl / d.totalCost * 100) : 0;
    return `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <div class="section-title">${TYPE_NAMES[type]||type}</div>
        <div style="text-align:right">
          <div style="font-size:14px;font-weight:600">${fmtS(d.totalVal)}</div>
          <div style="font-size:11px;color:${grpPnl>=0?'var(--accent)':'var(--red)'}">PnL: ${grpPnl>=0?'+':''}${fmtS(Math.abs(grpPnl))} (${grpPnl>=0?'+':''}${grpPnlPct.toFixed(1)}%)</div>
        </div>
      </div>
      ${d.items.map(a => {
        const pnl     = a.value - a.cost;
        const pnlPct  = a.cost > 0 ? (pnl / a.cost * 100).toFixed(1) : '0.0';
        const pnlColor = pnl >= 0 ? 'var(--accent)' : 'var(--red)';
        return `
        <div class="tx-item" style="flex-wrap:wrap;gap:8px">
          <div style="flex:1;min-width:120px">
            <div style="font-size:13px;font-weight:500">${esc(a.name)}</div>
            <div style="font-size:11px;color:var(--text3)">${esc(a.sub)}</div>
          </div>
          <div style="display:flex;align-items:center;gap:12px;flex-shrink:0">
            <div style="text-align:right">
              <div style="font-size:10px;color:var(--text3)">Modal</div>
              <div style="font-size:12px">${fmtS(a.cost)}</div>
            </div>
            <div style="text-align:right">
              <div style="font-size:10px;color:var(--text3)">Nilai</div>
              <div style="font-size:13px;font-weight:600">${fmtS(a.value)}</div>
            </div>
            <div style="text-align:right">
              <div style="font-size:10px;color:var(--text3)">PnL</div>
              <div style="font-size:12px;font-weight:600;color:${pnlColor}">${pnl>=0?'+':''}${fmtS(Math.abs(pnl))}</div>
              <div style="font-size:10px;color:${pnlColor}">${pnl>=0?'+':''}${pnlPct}%</div>
            </div>
            <div class="row-actions">
              <button onclick="openPriceUpdateModal('${a.id}')" title="Perbarui Nilai" style="font-size:11px;padding:3px 8px;border-radius:4px;border:1px solid var(--accent);color:var(--accent);background:var(--accent-light,rgba(26,107,74,.08));cursor:pointer;white-space:nowrap;font-family:var(--font)">📈 Perbarui</button>
              <button onclick="openTransferModal('${a.id}')" title="Transfer Dana" style="font-size:11px;padding:3px 8px;border-radius:4px;border:1px solid var(--blue,#1a5ba6);color:var(--blue,#1a5ba6);background:rgba(26,91,166,.08);cursor:pointer;white-space:nowrap;font-family:var(--font)">🔄 Transfer</button>
              <button class="btn-edit" onclick="openEditModal('asset','${a.id}')" title="Edit">✏️</button>
              <button class="btn-delete" onclick="del('asset','${a.id}','${esc(a.name)}')">🗑</button>
            </div>
          </div>
        </div>`;
      }).join('')}
    </div>`;
  }).join('');
  renderAssetHistChart();
}

