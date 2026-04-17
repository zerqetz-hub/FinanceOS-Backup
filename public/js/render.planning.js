'use strict';
// render.planning.js — renderNetWorth, renderGoals, renderEmergency, renderInvestment

// ---- NET WORTH ----
/** Render the net-worth page: callout, breakdown lists, charts. */
function renderNetWorth() {
  const nw = netWorth(); const ta = totalAssets(); const td = totalDebts();
  document.getElementById('nw-callout').innerHTML = `
    <div class="nw-callout">
      <div class="lbl">Net Worth Saat Ini</div>
      <div class="val">${fmt(nw)}</div>
      <div class="sub">Total Aset ${fmtS(ta)} − Total Hutang ${fmtS(td)}</div>
    </div>`;

  const assetByType = {};
  S.assets.forEach(a => { assetByType[a.type] = (assetByType[a.type]||0) + a.value; });
  document.getElementById('nwAssetBreak').innerHTML = Object.keys(assetByType).length
    ? Object.entries(assetByType).sort((a,b) => b[1]-a[1]).map(([t,v]) =>
        `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border)">
          <span style="font-size:13px">${TYPE_NAMES[t]||t}</span>
          <div style="text-align:right"><div style="font-size:13px;font-weight:500">${fmtS(v)}</div><div style="font-size:11px;color:var(--text3)">${ta?(v/ta*100).toFixed(1):0}%</div></div>
        </div>`).join('') + `<div style="display:flex;justify-content:space-between;padding:10px 0;font-weight:600"><span>Total</span><span>${fmtS(ta)}</span></div>`
    : '<div class="empty-state">Belum ada aset</div>';
  document.getElementById('nwDebtBreak').innerHTML = S.debts.length
    ? S.debts.map(d =>
        `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border)">
          <span style="font-size:13px">${esc(d.name)}</span>
          <div style="text-align:right"><div style="font-size:13px;font-weight:500;color:var(--red)">${fmtS(d.sisa)}</div><div style="font-size:11px;color:var(--text3)">${td?(d.sisa/td*100).toFixed(1):0}%</div></div>
        </div>`).join('')
      + `<div style="display:flex;justify-content:space-between;padding:10px 0;font-weight:600"><span>Total Aktif</span><span class="c-red">${fmtS(td)}</span></div>`
    : '<div class="empty-state">Tidak ada hutang aktif</div>';
}

// ---- GOALS ----
/** Render the goals page: metrics and goal progress bars. */
function renderGoals() {
  const active = S.goals.length;
  const onTrack = S.goals.filter(g => g.current/g.target >= 0.5).length;
  const withDeadline = S.goals.filter(g => g.deadline);
  const nearest = withDeadline.length ? withDeadline.slice().sort((a,b) => a.deadline.localeCompare(b.deadline))[0] : null;
  document.getElementById('goal-metrics').innerHTML = `
    <div class="card-sm"><div class="metric-label">Goals Aktif</div><div class="metric-value">${active}</div></div>
    <div class="card-sm"><div class="metric-label">Goal Terdekat</div><div class="metric-value" style="font-size:16px">${nearest?esc(nearest.name):'—'}</div><div class="metric-sub">${nearest?nearest.deadline:'—'}</div></div>
    <div class="card-sm"><div class="metric-label">On-track ≥ 50%</div><div class="metric-value c-green">${onTrack} / ${active}</div></div>`;
  if (!S.goals.length) { document.getElementById('goalList').innerHTML='<div class="empty-state"><div class="icon">🎯</div>Belum ada goal. Klik + Tambah Goal.</div>'; return; }
  document.getElementById('goalList').innerHTML = S.goals.map(g => {
    const p = Math.min(100, Math.round(g.current/g.target*100));
    const gAdded = g.dateAdded ? isoToDisplay(g.dateAdded) : null;
    return `<div class="goal-item">
      <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px">
        <div><div style="font-weight:500;font-size:13px">${esc(g.name)}</div>${gAdded?`<div style="font-size:10px;color:var(--text3)">Dibuat: ${gAdded}</div>`:''}</div>
        <div style="display:flex;align-items:center;gap:10px">
          <div style="font-size:13px;font-weight:600;color:${g.color}">${p}%</div>
          <div class="row-actions"><button class="btn-edit" onclick="openEditModal('goal','${g.id}')" title="Edit">✏️</button><button class="btn-delete" onclick="del('goal','${g.id}','${esc(g.name)}')">🗑</button></div>
        </div>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text3);margin-bottom:6px">
        <span>${fmtS(g.current)} dari ${fmtS(g.target)}</span><span>Target: ${g.deadline}</span>
      </div>
      <div class="progress-wrap"><div class="progress-bar" style="width:${p}%;background:${g.color}"></div></div>
    </div>`;
  }).join('');
}

// ---- EMERGENCY FUND ----
/** Render the emergency fund page with target vs saved comparison. */
function renderEmergency() {
  const saved = efSaved(); const target = efTarget(); const avg = avgMonthExp();
  const pct = target > 0 ? Math.min(100, saved/target*100) : 0;
  const covered = avg > 0 ? (saved/avg).toFixed(1) : '0';
  document.getElementById('ef-main').innerHTML = `
    <div class="card" style="margin-bottom:16px;text-align:center;padding:32px">
      <div style="font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:.8px;margin-bottom:8px">Progress Dana Darurat</div>
      <div style="font-size:48px;font-weight:700;color:var(--blue);letter-spacing:-2px">${pct.toFixed(0)}%</div>
      <div style="font-size:14px;color:var(--text2);margin:8px 0">${fmtS(saved)} dari target ${fmtS(target)}</div>
      <div class="progress-wrap" style="height:10px;margin:16px auto;max-width:400px"><div class="progress-bar bar-blue" style="width:${pct.toFixed(0)}%"></div></div>
      <div style="font-size:13px;color:var(--text3)">Mencukupi <strong style="color:var(--text)">${covered} bulan</strong> pengeluaran • Sisa: <strong style="color:var(--text)">${fmtS(Math.max(0,target-saved))}</strong></div>
    </div>`;
  document.getElementById('ef-metrics').innerHTML = `
    <div class="card-sm"><div class="metric-label">Pengeluaran Rata-rata</div><div class="metric-value">${fmtS(avg)}</div><div class="metric-sub">${S.cashflows.length} bulan data</div></div>
    <div class="card-sm"><div class="metric-label">Target (6 bulan)</div><div class="metric-value c-blue">${fmtS(target)}</div></div>
    <div class="card-sm"><div class="metric-label">Dana Tersimpan</div><div class="metric-value c-green">${fmtS(saved)}</div><div class="metric-sub">Dari aset tipe Cash</div></div>`;
  renderEfChart();
}

// ---- INVESTMENT ----
/** Render the investment page: metrics, performance table, chart. */
function renderInvestment() {
  const ia = investAssets(); const tv = totalInvestVal(); const tc = totalInvestCost();
  const ret = tc ? (tv-tc)/tc*100 : 0;
  const best = ia.length ? ia.slice().sort((a,b) => (b.value-b.cost)/Math.max(1,b.cost) - (a.value-a.cost)/Math.max(1,a.cost))[0] : null;
  document.getElementById('invest-metrics').innerHTML = `
    <div class="card-sm"><div class="metric-label">Total Modal</div><div class="metric-value">${fmtS(tc)}</div><div class="metric-sub">Cost basis</div></div>
    <div class="card-sm"><div class="metric-label">Nilai Pasar</div><div class="metric-value">${fmtS(tv)}</div><div class="metric-sub">Market value</div></div>
    <div class="card-sm"><div class="metric-label">Unrealized PnL</div><div class="metric-value ${tv-tc>=0?'c-green':'c-red'}">${tv-tc>=0?'+':''}${fmtS(Math.abs(tv-tc))}</div><div class="metric-sub" style="color:${tv-tc>=0?'var(--accent)':'var(--red)'}">${ret>=0?'+':''}${ret.toFixed(1)}% dari modal</div></div>
    <div class="card-sm"><div class="metric-label">Best Performer</div><div class="metric-value c-green" style="font-size:15px">${best?esc(best.name):'—'}</div><div class="metric-sub">${best&&best.cost?'+'+((best.value-best.cost)/best.cost*100).toFixed(1)+'%':''}</div></div>`;
  if (!ia.length) { document.getElementById('investTable').innerHTML='<tr><td colspan="8" style="text-align:center;color:var(--text3);padding:24px">Belum ada aset investasi</td></tr>'; renderPerfChart(); return; }
  document.getElementById('investTable').innerHTML = ia.map(a => {
    const r = a.cost ? (a.value-a.cost)/a.cost*100 : 0; const g = a.value-a.cost;
    const dA = a.dateAdded ? isoToDisplay(a.dateAdded) : '—';
    return `<tr>
      <td style="font-weight:500">${esc(a.name)}</td>
      <td><span class="badge badge-blue">${TYPE_NAMES[a.type]||a.type}</span></td>
      <td style="font-size:11px;color:var(--text3)">${dA}</td>
      <td class="text-right">${fmtS(a.cost)}</td>
      <td class="text-right">${fmtS(a.value)}</td>
      <td class="text-right" style="color:${g>=0?'var(--accent)':'var(--red)'};font-weight:500">${g>=0?'+':''}${r.toFixed(1)}%</td>
      <td class="text-right"><span class="badge ${g>=0?'badge-green':'badge-red'}">${g>=0?'+':''}${fmtS(Math.abs(g))}</span></td>
      <td class="text-right"><div class="row-actions"><button class="btn-edit" onclick="openEditModal('asset','${a.id}')" title="Edit">✏️</button><button class="btn-delete" onclick="del('asset','${a.id}','${esc(a.name)}')">🗑</button></div></td>
    </tr>`;
  }).join('');
  renderPerfChart();
}

