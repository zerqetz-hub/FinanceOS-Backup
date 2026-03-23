'use strict';
// render.dashboard.js — renderDashboard, _aggregateCFs

// ---- DASHBOARD ----
// Aggregates cashflows by quarter or year for dashboard metrics
function _aggregateCFs() {
  const cfs = sortedCF();
  if (_dashFilter === 'Bulanan') return { slices: cfs.slice(-6), cf: cfs[cfs.length-1] };

  if (_dashFilter === 'Kuartal') {
    // Group by YYYY-QN
    const qMap = {};
    cfs.forEach(c => {
      const [y, m] = c.month.split('-').map(Number);
      const q = `${y}-Q${Math.ceil(m/3)}`;
      if (!qMap[q]) qMap[q] = {label: `Q${Math.ceil(m/3)} ${y}`, income:0, expenses:{}, _months:[]};
      qMap[q].income += c.income;
      qMap[q]._months.push(c);
      Object.entries(c.expenses).forEach(([k,v]) => { qMap[q].expenses[k] = (qMap[q].expenses[k]||0)+v; });
    });
    const slices = Object.entries(qMap).slice(-4).map(([,v]) => v);
    const last = slices[slices.length-1];
    return { slices, cf: last, label: last?.label };
  }

  if (_dashFilter === 'Tahunan') {
    const yMap = {};
    cfs.forEach(c => {
      const y = c.month.slice(0,4);
      if (!yMap[y]) yMap[y] = {label: y, income:0, expenses:{}, _months:[]};
      yMap[y].income += c.income;
      yMap[y]._months.push(c);
      Object.entries(c.expenses).forEach(([k,v]) => { yMap[y].expenses[k] = (yMap[y].expenses[k]||0)+v; });
    });
    const slices = Object.entries(yMap).slice(-5).map(([,v]) => v);
    const last = slices[slices.length-1];
    return { slices, cf: last, label: last?.label };
  }
  return { slices: cfs.slice(-6), cf: cfs[cfs.length-1] };
}

/** Render the dashboard page: net-worth callout, metrics, charts. */
function renderDashboard() {
  const { slices, cf, label } = _aggregateCFs();
  const exp = cfExp(cf); const inc = cf ? cf.income : 0;
  const sav = inc - exp; const savR = inc ? (sav/inc*100).toFixed(1) : '0.0';
  const nw = netWorth(); const ta = totalAssets(); const td = totalDebts();
  const efPct = efTarget() > 0 ? Math.min(100, efSaved()/efTarget()*100).toFixed(0) : 0;
  const periodLabel = label || (cf ? mLabel(cf.month) : '');

  document.getElementById('dash-sub').textContent = cf
    ? `Ringkasan keuangan — ${periodLabel}`
    : 'Belum ada data cash flow';

  document.getElementById('dash-nw-callout').innerHTML = `
    <div class="nw-callout">
      <div class="lbl">Total Net Worth</div>
      <div class="val">${fmt(nw)}</div>
      <div class="sub">Aset − Liabilitas (realtime)</div>
      <div class="nw-row">
        <div class="nw-row-item"><div class="l">Total Aset</div><div class="v">${fmtS(ta)}</div></div>
        <div class="nw-row-item"><div class="l">Total Hutang</div><div class="v" style="color:#ffa0a0">${fmtS(td)}</div></div>
      </div>
    </div>`;

  const periodSub = _dashFilter === 'Bulanan' ? 'bulan terakhir' : _dashFilter === 'Kuartal' ? 'kuartal terakhir' : 'tahun terakhir';
  document.getElementById('dash-metrics').innerHTML = `
    <div class="card-sm"><div class="metric-label">Pemasukan</div><div class="metric-value c-green">${fmtS(inc)}</div><div class="metric-sub">${periodLabel||'—'}</div></div>
    <div class="card-sm"><div class="metric-label">Pengeluaran</div><div class="metric-value c-red">${fmtS(exp)}</div><div class="metric-sub">${periodSub}</div></div>
    <div class="card-sm"><div class="metric-label">Saldo Bersih</div><div class="metric-value ${sav>=0?'c-green':'c-red'}">${fmtS(sav)}</div><div class="metric-sub">Saving rate: <span class="c-green">${savR}%</span></div></div>
    <div class="card-sm"><div class="metric-label">Emergency Fund</div><div class="metric-value c-blue">${efPct}%</div><div class="metric-sub">${fmtS(efSaved())} / ${fmtS(efTarget())}</div></div>`;

  renderDashCharts(slices, cf);
  renderAlerts();
}


