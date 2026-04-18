'use strict';
// render.charts.js — all Chart.js charts (CI map, renderDashCharts, etc.)

// =============================================
// CHARTS
// =============================================
const CI = {};
const dc = id => { if(CI[id]){CI[id].destroy();delete CI[id];} };
const gc = () => {
  const dark = document.body.dataset.theme === 'dark';
  return { grid: dark?'rgba(255,255,255,.06)':'rgba(0,0,0,.06)', text: dark?'#9b9a93':'#6b6960' };
};
// Smart unit: rb (ribu) if max < 1jt, jt (juta) if < 1M, M (miliar) otherwise
const smartUnit = (maxAbs) => {
  if (maxAbs < 1e6)  return { div: 1e3,  suffix: 'rb' };
  if (maxAbs < 1e9)  return { div: 1e6,  suffix: 'jt' };
  return               { div: 1e9,  suffix: 'M'  };
};

/** Render all dashboard chart canvases (income/expense bar + pie). */
function renderDashCharts(slices, cf) {
  if (!slices) { const agg = _aggregateCFs(); slices = agg.slices; cf = agg.cf; }
  const {grid,text} = gc();
  const lbs = slices.map(c => c.label ? c.label : mLabel(c.month).split(' ')[0]);
  dc('incomeExpChart');
  const el1 = document.getElementById('incomeExpChart');
  if (el1) CI['incomeExpChart'] = new Chart(el1, {
    type:'bar', data:{labels:lbs, datasets:[
      {label:'Income', data:slices.map(c=>c.income/1e6), backgroundColor:'#1a6b4a', borderRadius:4, borderSkipped:false},
      {label:'Expense', data:slices.map(c=>cfExp(c)/1e6), backgroundColor:'#c23b3b', borderRadius:4, borderSkipped:false}
    ]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{grid:{display:false},ticks:{color:text,font:{size:11}}},y:{grid:{color:grid},ticks:{color:text,font:{size:11},callback:v=>v+'jt'}}}}
  });
  cf = latestCF();
  if (cf) {
    const eAllKeys = Object.keys(cf.expenses); const eAllVals = Object.values(cf.expenses).map(v=>v/1e6);
    const eTot = eAllVals.reduce((a,b)=>a+b,0);
    // Filter out zero-value categories
    const ePairs = eAllKeys.map((k,i)=>({k,v:eAllVals[i]})).filter(p=>p.v>0);
    const eKeys = ePairs.map(p=>p.k); const eVals = ePairs.map(p=>p.v);
    document.getElementById('expLegend').innerHTML = ePairs.map((p,i) =>
      `<span style="display:flex;align-items:center;gap:4px;font-size:11px;color:var(--text3)"><span style="width:8px;height:8px;border-radius:50%;background:${EXP_COLORS[i%7]};flex-shrink:0;display:inline-block"></span>${p.k} ${eTot?(p.v/eTot*100).toFixed(0):0}%</span>`).join('');
    dc('expBreakChart');
    const el2 = document.getElementById('expBreakChart');
    if (el2) CI['expBreakChart'] = new Chart(el2, {
      type:'doughnut', data:{labels:eKeys,datasets:[{data:eVals,backgroundColor:EXP_COLORS,borderWidth:0,hoverOffset:4}]},
      options:{responsive:true,maintainAspectRatio:false,cutout:'65%',plugins:{legend:{display:false},tooltip:{callbacks:{label:ctx=>ctx.label+': '+fmtS(ctx.raw*1e6)}}}}
    });
  } else { document.getElementById('expLegend').innerHTML=''; dc('expBreakChart'); }

  const assetByType = {};
  S.assets.forEach(a => { assetByType[a.type]=(assetByType[a.type]||0)+a.value; });
  const aL = Object.keys(assetByType); const aV = Object.values(assetByType).map(v=>v/1e6);
  const aTot = aV.reduce((a,b)=>a+b,0);
  document.getElementById('allocLegend').innerHTML = aL.map((l,i) =>
    `<span style="display:flex;align-items:center;gap:4px;font-size:11px;color:var(--text3)"><span style="width:8px;height:8px;border-radius:50%;background:${ASSET_COLORS[i%7]};flex-shrink:0;display:inline-block"></span>${TYPE_NAMES[l]||l} ${aTot?(aV[i]/aTot*100).toFixed(0):0}%</span>`).join('');
  dc('allocChart');
  const el3 = document.getElementById('allocChart');
  if (el3 && aL.length) CI['allocChart'] = new Chart(el3, {
    type:'doughnut', data:{labels:aL.map(l=>TYPE_NAMES[l]||l),datasets:[{data:aV,backgroundColor:ASSET_COLORS,borderWidth:0,hoverOffset:4}]},
    options:{responsive:true,maintainAspectRatio:false,cutout:'65%',plugins:{legend:{display:false},tooltip:{callbacks:{label:ctx=>ctx.label+': '+fmtS(ctx.raw*1e6)}}}}
  });
}

/** Render the cashflow trend line chart. */
function renderCfChart() {
  const {grid,text} = gc(); const cfs = allCFRows().slice(-12);
  dc('cashflowHistChart');
  const el = document.getElementById('cashflowHistChart');
  if (!el || !cfs.length) return;
  const maxCfVal = Math.max(...cfs.map(c => c.income), ...cfs.map(c => cfExp(c)), 1);
  const {div: cfDiv, suffix: cfSuffix} = smartUnit(maxCfVal);
  CI['cashflowHistChart'] = new Chart(el, {
    type:'line', data:{labels:cfs.map(c=>mLabel(c.month).split(' ')[0]), datasets:[
      {label:'Income', data:cfs.map(c=>parseFloat((c.income/cfDiv).toFixed(4))), borderColor:'#1a6b4a', backgroundColor:'rgba(26,107,74,.1)', fill:true, tension:.4, pointRadius:3},
      {label:'Expense', data:cfs.map(c=>parseFloat((cfExp(c)/cfDiv).toFixed(4))), borderColor:'#c23b3b', backgroundColor:'rgba(194,59,59,.1)', fill:true, tension:.4, pointRadius:3}
    ]},
    options:{responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:false}, tooltip:{callbacks:{label:ctx=>ctx.dataset.label+': '+fmtS(ctx.raw*cfDiv)}}},
      scales:{x:{grid:{display:false},ticks:{color:text}},y:{grid:{color:grid},ticks:{color:text,callback:v=>parseFloat(v.toFixed(3))+cfSuffix}}}}
  });
}

/** Render the net-worth history area chart. */
function renderNWChart() {
  const {grid,text} = gc(); const cfs = allCFRows().slice(-12);
  const nwNow = netWorth(); let data = [nwNow];
  for (let i = cfs.length-1; i >= 1; i--) {
    const s = cfs[i].income - cfExp(cfs[i]); data.unshift(data[0] - s);
  }
  const maxAbs = Math.max(...data.map(v => Math.abs(v)), 1);
  const {div: nwDiv, suffix: nwSuffix} = smartUnit(maxAbs);
  dc('nwGrowthChart');
  const el = document.getElementById('nwGrowthChart');
  if (el) CI['nwGrowthChart'] = new Chart(el, {
    type:'line', data:{labels:cfs.length?cfs.map(c=>mLabel(c.month).split(' ')[0]):['Sekarang'],datasets:[{label:'Net Worth',data:data.map(v=>parseFloat((v/nwDiv).toFixed(3))),borderColor:'#1a6b4a',backgroundColor:'rgba(26,107,74,.1)',fill:true,tension:.4,pointRadius:3,pointBackgroundColor:'#1a6b4a'}]},
    options:{responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:false}, tooltip:{callbacks:{label:ctx=>fmtS(ctx.raw*nwDiv)}}},
      scales:{x:{grid:{display:false},ticks:{color:text}},y:{grid:{color:grid},ticks:{color:text,callback:v=>{const n=parseFloat(v.toFixed(3));return (n>=0?'':'−')+'Rp '+Math.abs(n)+nwSuffix;}}}}}
  });
}



/** Render the emergency-fund gauge/progress chart. */
function renderEfChart() {
  const {grid,text} = gc(); const cfs = allCFRows().slice(-6);
  const target = efTarget(); const saved = efSaved();
  const data = cfs.map((_,i,arr) => Math.min(target, saved*(i+1)/arr.length));
  const maxDataVal = Math.max(...data, target > 0 ? 0 : 1, 1);
  const {div: efDiv, suffix: efSuffix} = smartUnit(maxDataVal);
  dc('efChart');
  const el = document.getElementById('efChart');
  if (el) CI['efChart'] = new Chart(el, {
    type:'bar', data:{labels:cfs.length?cfs.map(c=>mLabel(c.month).split(' ')[0]):['—'],datasets:[{label:'Dana Darurat',data:data.map(v=>parseFloat((v/efDiv).toFixed(4))),backgroundColor:'#1a5ba6',borderRadius:4,borderSkipped:false}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:ctx=>fmtS(ctx.raw*efDiv)}}},scales:{x:{grid:{display:false},ticks:{color:text}},y:{grid:{color:grid},ticks:{color:text,callback:v=>parseFloat(v.toFixed(3))+efSuffix}}}}
  });
}

/** Render the investment performance chart. */
function renderPerfChart() {
  const {grid,text} = gc(); const ia = investAssets();
  dc('perfChart');
  const el = document.getElementById('perfChart');
  if (!el || !ia.length) return;
  const maxVal = Math.max(...ia.map(a => a.value), 1);
  const {div: pDiv, suffix: pSuffix} = smartUnit(maxVal);
  CI['perfChart'] = new Chart(el, {
    type:'bar', data:{labels:ia.map(a=>a.name),datasets:[{label:'Nilai Sekarang',data:ia.map(a=>parseFloat((a.value/pDiv).toFixed(4))),backgroundColor:ia.map((_,i)=>ASSET_COLORS[i%7]),borderRadius:4,borderSkipped:false}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:ctx=>fmtS(ctx.raw*pDiv)}}},scales:{x:{grid:{display:false},ticks:{color:text}},y:{grid:{color:grid},ticks:{color:text,callback:v=>parseFloat(v.toFixed(3))+pSuffix}}}}
  });
}

// Helper: bulan diff antara dua string YYYY-MM
function _mdiff(from, to) {
  const [fy,fm] = from.split('-').map(Number);
  const [ty,tm] = to.split('-').map(Number);
  return (ty-fy)*12+(tm-fm);
}
// Generate array of YYYY-MM strings
function _mrange(start, end) {
  const res = []; let [y,m] = start.split('-').map(Number);
  const [ey,em] = end.split('-').map(Number);
  while (y < ey || (y===ey && m<=em)) { res.push(`${y}-${String(m).padStart(2,'0')}`); if(++m>12){m=1;y++;} }
  return res;
}

/** Render the asset price-history multi-line chart. */
function renderAssetHistChart() {
  const {grid,text} = gc();
  dc('assetHistChart');
  const el = document.getElementById('assetHistChart');
  if (!el || !S.assets.length) {
    const card = document.getElementById('assetHistCard');
    if (card) card.style.display = 'none';
    return;
  }
  const card = document.getElementById('assetHistCard');
  if (card) card.style.display = '';

  // Collect all unique dates from all assets' priceHistory
  const allDates = new Set();
  S.assets.forEach(a => {
    if (!a.priceHistory || !a.priceHistory.length) {
      // Fallback: use dateAdded as cost and today as value
      if (a.dateAdded) allDates.add(a.dateAdded);
      allDates.add(new Date().toISOString().slice(0,10));
    } else {
      a.priceHistory.forEach(h => allDates.add(h.date));
    }
  });
  const labels = [...allDates].sort();
  if (labels.length < 1) return;

  const COLORS = ['#1a6b4a','#1a5ba6','#5a3fb5','#b87614','#c23b3b','#2d8a5e','#e05555'];

  const datasets = S.assets.map((a, i) => {
    const hist = a.priceHistory && a.priceHistory.length
      ? [...a.priceHistory].sort((x,y) => x.date.localeCompare(y.date))
      : [{date: a.dateAdded || labels[0], value: a.cost}, {date: labels[labels.length-1], value: a.value}];
    // For each label date, find the last known value at or before that date
    const data = labels.map(d => {
      const pts = hist.filter(h => h.date <= d);
      return pts.length ? Math.round(pts[pts.length-1].value) / 1e6 : null;
    });
    return {
      label: a.name,
      data,
      borderColor: COLORS[i % COLORS.length],
      backgroundColor: 'transparent',
      tension: 0.3, pointRadius: 3, pointHoverRadius: 5,
      borderWidth: 2, spanGaps: false
    };
  });

  // Total dataset
  const totalData = labels.map((d, li) => {
    const total = datasets.reduce((sum, ds) => {
      const val = ds.data[li];
      return val != null ? sum + val : sum;
    }, 0);
    return total > 0 ? total : null;
  });
  // Smart unit based on max total value (raw, before division)
  const maxRaw = Math.max(...totalData.filter(v => v != null).map(v => v * 1e6), 0);
  const {div: aDivRaw, suffix: aSuffix} = smartUnit(maxRaw);
  const aDiv = aDivRaw; // already in base units
  // Rescale all individual datasets from /1e6 back to base then re-divide
  datasets.forEach(ds => { ds.data = ds.data.map(v => v != null ? parseFloat((v * 1e6 / aDiv).toFixed(4)) : null); });
  datasets.push({
    label: '▸ Total',
    data: totalData.map(v => v != null ? parseFloat((v * 1e6 / aDiv).toFixed(4)) : null),
    borderColor: text,
    backgroundColor: 'transparent',
    tension: 0.3, pointRadius: 3, borderWidth: 2.5,
    borderDash: [6, 3],
    spanGaps: false,
    order: -1
  });

  // Format labels
  const fmtLbl = d => {
    const [y,m,day] = d.split('-');
    return `${day}/${MNAMES[+m]}/${y.slice(2)}`;
  };

  CI['assetHistChart'] = new Chart(el, {
    type: 'line',
    data: { labels: labels.map(fmtLbl), datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: true, position: 'bottom', labels: { color: text, font: {size: 11}, boxWidth: 12, padding: 14 } },
        tooltip: { callbacks: { label: ctx => ctx.dataset.label + ': ' + fmtS(ctx.raw * aDiv) } }
      },
      scales: {
        x: { grid: {display: false}, ticks: {color: text, font: {size: 11}, maxTicksLimit: 10, maxRotation: 30} },
        y: { grid: {color: grid}, ticks: {color: text, font: {size: 11}, callback: v => parseFloat(v.toFixed(3)) + aSuffix}, beginAtZero: false }
      }
    }
  });
}

/** Render the debt balance-history multi-line chart. */
function renderDebtHistChart() {
  const {grid,text} = gc();
  dc('debtHistChart');
  const el = document.getElementById('debtHistChart');
  if (!el) return;
  const showPaid = document.getElementById('showPaidInChart')?.checked || false;
  const allDebts = [
    ...S.debts,
    ...(showPaid ? (S.paidDebts||[]).map(d => ({...d, _paid: true})) : [])
  ];
  if (!allDebts.length) return;

  // Collect all unique dates
  const allDates = new Set();
  allDebts.forEach(d => {
    if (!d.balanceHistory || !d.balanceHistory.length) {
      if (d.dateAdded) allDates.add(d.dateAdded);
      allDates.add(d.paidDate || new Date().toISOString().slice(0,10));
    } else {
      d.balanceHistory.forEach(h => allDates.add(h.date));
      if (d.paidDate) allDates.add(d.paidDate);
    }
  });
  const labels = [...allDates].sort();
  if (labels.length < 1) return;

  const DCOLORS = ['#c23b3b','#b87614','#1a5ba6','#5a3fb5','#e05555','#d97706','#4d8fdf'];

  const datasets = allDebts.map((d, i) => {
    const hist = d.balanceHistory && d.balanceHistory.length
      ? [...d.balanceHistory].sort((x,y) => x.date.localeCompare(y.date))
      : [{date: d.dateAdded || labels[0], sisa: d.total}, {date: d.paidDate || labels[labels.length-1], sisa: d._paid ? 0 : d.sisa}];
    if (d._paid && d.paidDate && !hist.find(h => h.date === d.paidDate)) {
      hist.push({date: d.paidDate, sisa: 0});
    }
    // Store raw sisa values first (positive), negate later after unit is determined
    const data = labels.map(lbl => {
      const pts = hist.filter(h => h.date <= lbl);
      if (!pts.length) return null;
      return pts[pts.length-1].sisa; // raw positive value
    });
    return {
      label: d.name + (d._paid ? ' ✓' : ''),
      _rawData: data,
      borderColor: DCOLORS[i % DCOLORS.length],
      backgroundColor: DCOLORS[i % DCOLORS.length] + '18',
      fill: true, tension: 0.3, pointRadius: 3, pointHoverRadius: 5,
      borderWidth: d._paid ? 1.5 : 2,
      borderDash: d._paid ? [4, 3] : undefined,
      spanGaps: false
    };
  });

  // Determine smart unit from max sisa value
  const allRawVals = datasets.flatMap(ds => ds._rawData.filter(v => v != null));
  const maxDebtRaw = Math.max(...allRawVals, 1);
  const {div: dDiv, suffix: dSuffix} = smartUnit(maxDebtRaw);

  // Assign scaled & negated data
  datasets.forEach(ds => {
    ds.data = ds._rawData.map(v => v != null ? parseFloat((-v / dDiv).toFixed(4)) : null);
    delete ds._rawData;
  });

  // Total debt line
  const totalData = labels.map((_, li) => {
    const sum = datasets.reduce((acc, ds) => {
      const val = ds.data[li];
      return val != null ? acc + val : acc;
    }, 0);
    return sum < 0 ? sum : null;
  });
  const {grid: _g, text: totalLineColor} = gc();
  datasets.push({
    label: '▸ Total Hutang',
    data: totalData,
    borderColor: totalLineColor,
    backgroundColor: 'transparent',
    fill: false, tension: 0.3, pointRadius: 3,
    borderWidth: 2.5, borderDash: [6, 3], spanGaps: false,
    order: -1
  });

  const fmtLbl = d => {
    const [y,m,day] = d.split('-');
    return `${day}/${MNAMES[+m]}/${y.slice(2)}`;
  };

  CI['debtHistChart'] = new Chart(el, {
    type: 'line',
    data: { labels: labels.map(fmtLbl), datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: true, position: 'bottom', labels: { color: text, font: {size: 11}, boxWidth: 12, padding: 14 } },
        tooltip: {
          callbacks: {
            label: ctx => ctx.dataset.label + ': ' + fmtS(Math.abs(ctx.raw) * dDiv)
          }
        }
      },
      scales: {
        x: { grid: {display: false}, ticks: {color: text, font: {size: 11}, maxTicksLimit: 10, maxRotation: 30} },
        y: {
          grid: {color: grid},
          ticks: {
            color: text, font: {size: 11},
            callback: v => (v === 0 ? '0' : '−' + Math.abs(parseFloat(v.toFixed(3)))) + dSuffix
          },
          max: 0
        }
      }
    }
  });
}


// ─── RECENT TRANSACTIONS ──────────────────────────────────────────────────────
