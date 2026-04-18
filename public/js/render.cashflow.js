'use strict';
// render.cashflow.js — renderCashflow, month navigation

// ---- CASH FLOW ----
let _selectedCFMonth = null; // null = use latest

function _getCFMonths() { return allCFRows().map(c => c.month); }
function _selectedCF() {
  const rows = allCFRows();
  if (!rows.length) return null;
  const month = _selectedCFMonth || rows[rows.length - 1].month;
  return rows.find(c => c.month === month) || rows[rows.length - 1];
}

function setCFMonth(m) { _selectedCFMonth = m; renderCashflow(); }
function shiftCFMonth(dir) {
  const months = _getCFMonths();
  if (!months.length) return;
  const cur = _selectedCFMonth || months[months.length-1];
  const idx = months.indexOf(cur);
  const newIdx = Math.max(0, Math.min(months.length-1, idx+dir));
  _selectedCFMonth = months[newIdx];
  renderCashflow();
}

function _syncCFMonthSelector() {
  const sel = document.getElementById('cfMonthSelect');
  const prev = document.getElementById('cfMonthPrev');
  const next = document.getElementById('cfMonthNext');
  const months = _getCFMonths();
  if (!sel) return;
  sel.innerHTML = months.length
    ? months.slice().reverse().map(m => `<option value="${m}" ${m===(_selectedCFMonth||months[months.length-1])?'selected':''}>${mLabel(m)}</option>`).join('')
    : '<option>Belum ada data</option>';
  const cur = _selectedCFMonth || months[months.length - 1];
  const idx = months.indexOf(cur);
  if (prev) prev.disabled = idx <= 0;
  if (next) next.disabled = idx >= months.length - 1;
}

/** Render the cashflow page for the selected month. */
function renderCashflow() {
  _syncCFMonthSelector();
  const cfs = allCFRows(); const cf = _selectedCF();
  const exp = cfExp(cf); const inc = cf ? cf.income : 0;
  const sav = inc - exp; const savR = inc ? (sav/inc*100).toFixed(1) : '0.0';
  const avgExp = avgMonthExp();
  const txCount = cf?.fromTx
    ? (S.transactions || []).filter(t => (t.dateAdded || '').slice(0, 7) === cf.month).length
    : 0;

  document.getElementById('cf-metrics').innerHTML = `
    ${cf?.fromTx ? `<div class="card" style="grid-column:1/-1;padding:10px 14px;background:var(--accent-light);border:1px solid var(--accent);border-radius:10px;font-size:13px;color:var(--accent)">📊 Data dihitung otomatis dari <strong>${txCount} catatan harian</strong>. Edit transaksi untuk mengubah data ini.</div>` : ''}
    <div class="card-sm"><div class="metric-label">Saving Rate</div><div class="metric-value c-green">${savR}%</div><div class="metric-sub">bulan ini</div><div class="progress-wrap"><div class="progress-bar bar-green" style="width:${Math.min(100,+savR)}%"></div></div></div>
    <div class="card-sm"><div class="metric-label">Saldo Bulanan</div><div class="metric-value ${sav>=0?'c-green':'c-red'}">${fmtS(sav)}</div><div class="metric-sub">bulan ini</div></div>
    <div class="card-sm"><div class="metric-label">Rata-rata Pengeluaran</div><div class="metric-value">${fmtS(avgExp)}</div><div class="metric-sub">${cfs.length} bulan data</div></div>`;

  // Budget tracker month label
  const bmEl = document.getElementById('cf-budget-month');
  if (bmEl) bmEl.textContent = cf ? mLabel(cf.month) : '';

  // Income breakdown detail
  const incMonthEl = document.getElementById('cf-income-month');
  const incBreakEl = document.getElementById('incomeBreakdownView');
  if (incBreakEl) {
    if (cf && cf.incomeBreakdown && Object.keys(cf.incomeBreakdown).length) {
      if (incMonthEl) incMonthEl.textContent = mLabel(cf.month);
      const INC_COLORS = ['#1a6b4a','#1a5ba6','#5a3fb5','#c45c1a','#b87614','#c23b3b','#888888'];
      const incCats = getIncomeCats();
      const entries = Object.entries(cf.incomeBreakdown).filter(([,v]) => v > 0).sort((a,b) => b[1]-a[1]);
      const totalInc = cf.income || 0;
      incBreakEl.innerHTML = entries.map(([cat, amt]) => {
        const pct = totalInc > 0 ? (amt/totalInc*100) : 0;
        const ci = incCats.indexOf(cat);
        const color = INC_COLORS[ci >= 0 ? ci % INC_COLORS.length : 6];
        return `<div class="breakdown-row">
          <div style="font-size:13px;display:flex;align-items:center;gap:6px"><span style="width:8px;height:8px;border-radius:50%;background:${color};display:inline-block;flex-shrink:0"></span>${esc(cat)}</div>
          <div><div class="progress-wrap" style="margin-top:0"><div class="progress-bar" style="width:${pct.toFixed(1)}%;background:${color}"></div></div></div>
          <div style="font-size:12px;color:var(--text3);text-align:right">${fmtS(amt)}</div>
          <div class="breakdown-pct"><span style="font-size:12px;font-weight:500;color:${color}">${pct.toFixed(1)}%</span></div>
        </div>`;
      }).join('') +
      `<div style="display:flex;justify-content:space-between;padding:10px 0;font-weight:600;font-size:13px;border-top:1px solid var(--border);margin-top:4px">
        <span>Total Income</span><span class="c-green">${fmtS(totalInc)}</span>
      </div>`;
    } else {
      if (incMonthEl) incMonthEl.textContent = cf ? mLabel(cf.month) : '';
      incBreakEl.innerHTML = `<div class="empty-state"><div class="icon">💰</div>Gunakan + Tambah Income untuk mencatat breakdown per kategori</div>`;
    }
  }

  // ── Expense breakdown — mirrors income breakdown style, no budget comparison
  const expBreakEl = document.getElementById('expenseBreakdown');
  const expMonthEl = document.getElementById('cf-budget-month');
  if (expBreakEl) {
    if (cf) {
      if (expMonthEl) expMonthEl.textContent = mLabel(cf.month);
      const EXP_COLORS2 = ['#c23b3b','#c45c1a','#b87614','#1a5ba6','#5a3fb5','#1a6b4a','#888888'];
      const expCats  = getCats();
      const entries  = Object.entries(cf.expenses).filter(([,v]) => v > 0).sort((a,b) => b[1]-a[1]);
      const totalExp = cfExp(cf) || 1;
      if (entries.length) {
        expBreakEl.innerHTML = entries.map(([cat, amt]) => {
          const pct   = (amt / totalExp * 100);
          const ci    = expCats.indexOf(cat);
          const color = EXP_COLORS2[ci >= 0 ? ci % EXP_COLORS2.length : 6];
          return `<div class="breakdown-row">
            <div style="font-size:13px;display:flex;align-items:center;gap:6px">
              <span style="width:8px;height:8px;border-radius:50%;background:${color};display:inline-block;flex-shrink:0"></span>${esc(cat)}
            </div>
            <div><div class="progress-wrap" style="margin-top:0"><div class="progress-bar" style="width:${pct.toFixed(1)}%;background:${color}"></div></div></div>
            <div style="font-size:12px;color:var(--text3);text-align:right">${fmtS(amt)}</div>
            <div class="breakdown-pct"><span style="font-size:12px;font-weight:500;color:${color}">${pct.toFixed(1)}%</span></div>
          </div>`;
        }).join('') +
        `<div style="display:flex;justify-content:space-between;padding:10px 0;font-weight:600;font-size:13px;border-top:1px solid var(--border);margin-top:4px">
          <span>Total Pengeluaran</span><span class="c-red">${fmtS(cfExp(cf))}</span>
        </div>`;
      } else {
        expBreakEl.innerHTML = '<div class="empty-state"><div class="icon">📊</div>Belum ada data pengeluaran bulan ini</div>';
      }
    } else {
      if (expMonthEl) expMonthEl.textContent = '';
      expBreakEl.innerHTML = '<div class="empty-state"><div class="icon">📊</div>Tambah data cash flow untuk melihat rincian pengeluaran</div>';
    }
  }

  document.getElementById('cashflowTable').innerHTML = cfs.length ? cfs.slice().reverse().map(c => {
    const e = cfExp(c); const s = c.income - e; const r = c.income ? (s/c.income*100).toFixed(1) : '0.0';
    const srcBadge = c.fromTx
      ? `<span style="font-size:10px;color:var(--accent);background:var(--accent-light);border-radius:4px;padding:1px 5px">catatan harian</span>`
      : (c.dateAdded ? `<span style="font-size:11px;color:var(--text3)">${isoToDisplay(c.dateAdded)}</span>` : '—');
    const actions = c.fromTx
      ? `<span style="font-size:11px;color:var(--text3)">otomatis</span>`
      : `<div class="row-actions"><button class="btn-edit" onclick="openEditModal('cashflow','${c.id}')" title="Edit">✏️</button><button class="btn-delete" onclick="del('cashflow','${c.id}','${mLabel(c.month)}')">🗑</button></div>`;
    return `<tr>
      <td>${mLabel(c.month)}</td>
      <td class="cf-date-col">${srcBadge}</td>
      <td class="text-right c-green">${fmt(c.income)}</td>
      <td class="text-right c-red">${fmt(e)}</td>
      <td class="text-right ${s>=0?'c-green':'c-red'}">${fmt(s)}</td>
      <td class="text-right"><span class="badge ${+r>=30?'badge-green':'badge-amber'}">${r}%</span></td>
      <td class="text-right">${actions}</td>
    </tr>`;
  }).join('') : '<tr><td colspan="7" style="text-align:center;color:var(--text3);padding:24px">Belum ada data. Tambah transaksi harian atau klik + Tambah Income/Expense.</td></tr>';

  renderCfChart();
}

