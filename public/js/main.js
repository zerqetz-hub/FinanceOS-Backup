// ── main.js — boot sequence, alerts, net worth simulator v5.4
// Fix #14: persist halaman aktif saat refresh (sessionStorage)
// Fix #23: avatar initials dari huruf pertama username
// Fix #5:  sembunyikan tombol undo/redo dari UI (Ctrl+Z/Y tetap bekerja)
'use strict';

function _computeAlerts() {
  const alerts = [];
  const cf = latestCF();
  if (cf) {
    const exp  = cfExp(cf);
    // Fix #12: saldo bukan tabungan
    const saldo = cf.income - exp;
    const rate  = cf.income > 0 ? saldo / cf.income : 0;
    if (cf.income > 0 && rate < 0.1) alerts.push({ type:'warn', msg:'Saving rate bulan ini hanya ' + (rate*100).toFixed(0) + '% — target minimal 20%.' });
    getCats().forEach(cat => {
      const budget = S.budgets?.[cat];
      const spent  = cf.expenses?.[cat] || 0;
      if (budget && spent > budget)
        alerts.push({ type:'danger', msg:'Budget ' + esc(cat) + ' terlampaui: ' + fmtS(spent) + ' dari ' + fmtS(budget) + '.' });
    });
  }
  const dti = latestCF() && latestCF().income > 0 ? totalCicilan() / latestCF().income : 0;
  if (dti > 0.4) alerts.push({ type:'warn', msg:'DTI ' + (dti*100).toFixed(0) + '% — di atas batas aman 40%.' });
  const ef = efSaved(); const eft = efTarget();
  if (eft > 0 && ef < eft) alerts.push({ type:'info', msg:'Dana darurat ' + (ef/eft*100).toFixed(0) + '% dari target 6× pengeluaran bulanan.' });
  return alerts;
}

function renderAlerts() {
  const el = document.getElementById('alertBanner');
  if (!el) return;
  const alerts = _computeAlerts();
  if (!alerts.length) { el.style.display = 'none'; return; }
  el.style.display = 'block';
  el.innerHTML = alerts.map(a => '<div class="alert-item alert-' + a.type + '">' + a.msg + '</div>').join('');
}

function renderNWSimulator() {
  const canvas = document.getElementById('nwSimChart');
  if (!canvas) return;
  if (allCFRows().length < 2) {
    canvas.parentElement.innerHTML = '<div class="empty-state"><div class="icon">📈</div>Butuh minimal 2 bulan data untuk simulasi</div>';
    return;
  }
  const horizonEl  = document.getElementById('nwSimHorizon');
  const scenarioEl = document.getElementById('nwSimScenario');
  const months     = parseInt(horizonEl?.value || '12', 10);
  const scenario   = scenarioEl?.value || 'base';
  const cfs = allCFRows();
  // Fix #10: saldo = income - expenses
  const savings = cfs.map(c => c.income - Object.values(c.expenses || {}).reduce((a,b) => a+b, 0));
  const avgSaving = savings.reduce((a,b) => a+b, 0) / savings.length;
  const n = savings.length;
  const xMean = (n-1)/2; const yMean = avgSaving;
  const slope = n > 2
    ? savings.reduce((acc,y,i) => acc + (i-xMean)*(y-yMean), 0) / savings.reduce((acc,_,i) => acc + (i-xMean)**2, 0)
    : 0;
  let assetMonthlyReturn = 0;
  let totalCost = 0; let totalVal = 0;
  S.assets.forEach(a => { totalCost += a.cost || 0; totalVal += a.value || 0; });
  if (totalCost > 0 && totalVal > totalCost) {
    assetMonthlyReturn = Math.min(((totalVal - totalCost) / totalCost) / 12, 0.03);
  }
  const mult = scenario === 'opt' ? 1.2 : scenario === 'pes' ? 0.8 : 1.0;
  const startNW = netWorth();
  const lastMonth = cfs[cfs.length-1].month;
  const [ly, lm] = lastMonth.split('-').map(Number);
  const labels = ['Sekarang']; const nwValues = [Math.round(startNW)];
  let curNW = startNW; let curAssets = totalVal;
  for (let i = 1; i <= months; i++) {
    const mo = ((lm-1+i) % 12) + 1;
    const yr = ly + Math.floor((lm-1+i)/12);
    labels.push(mLabel(yr + '-' + String(mo).padStart(2,'0')));
    const monthlySaving = (avgSaving + slope * i) * mult;
    const assetGrowth = curAssets * assetMonthlyReturn * mult;
    curAssets += assetGrowth;
    curNW = curNW + monthlySaving + assetGrowth;
    nwValues.push(Math.round(curNW));
  }
  const milestones = [];
  const milestonesEl = document.getElementById('nwSimMilestones');
  (S.goals || []).forEach(g => {
    if (g.target > startNW) {
      const hitIdx = nwValues.findIndex(v => v >= g.target);
      if (hitIdx > 0) milestones.push({ label: esc(g.name), idx: hitIdx, target: g.target });
    }
  });
  const doubleIdx = nwValues.findIndex(v => v >= startNW * 2);
  if (doubleIdx > 0) milestones.push({ label:'NW 2×', idx:doubleIdx, target:startNW*2, special:true });
  if (milestonesEl) {
    milestonesEl.innerHTML = milestones.length
      ? milestones.map(m => '<span style="font-size:11px;padding:4px 10px;border-radius:99px;background:var(--accent-light);color:var(--accent);font-weight:500">' + (m.special ? '🎯 ' : '') + m.label + ' — ' + labels[m.idx] + '</span>').join('')
      : '<span style="font-size:11px;color:var(--text3)">Tidak ada goal yang tercapai dalam periode ini</span>';
  }
  if (CI['nwSim']) { CI['nwSim'].destroy(); delete CI['nwSim']; }
  const scenarioColors = {
    base: { border:'#1a6b4a', bg:'rgba(26,107,74,.1)' },
    opt:  { border:'#1a5ba6', bg:'rgba(26,91,166,.1)' },
    pes:  { border:'#c23b3b', bg:'rgba(194,59,59,.1)' },
  };
  const col = scenarioColors[scenario] || scenarioColors.base;
  const pointBg = nwValues.map((_,i) => milestones.find(m => m.idx===i) ? '#b87614' : col.border);
  const pointR  = nwValues.map((_,i) => milestones.find(m => m.idx===i) ? 6 : 3);
  CI['nwSim'] = new Chart(canvas, {
    type:'line',
    data:{ labels, datasets:[{ label:'Net Worth (' + (scenario==='opt'?'Optimis':scenario==='pes'?'Pesimis':'Normal') + ')', data:nwValues, borderColor:col.border, backgroundColor:col.bg, fill:true, tension:0.35, pointBackgroundColor:pointBg, pointRadius:pointR, pointHoverRadius:6 }] },
    options:{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{display:false}, tooltip:{ callbacks:{ label: ctx => { const m = milestones.find(m => m.idx===ctx.dataIndex); const val = fmtS(ctx.parsed.y); return m ? val + '  ← ' + m.label : val; } } } }, scales:{ y:{ ticks:{ callback: v => fmtS(v) } }, x:{ ticks:{ maxTicksLimit:8 } } } },
  });
}

// ─── BOOT ────────────────────────────────────────────────────────────────────
async function bootApp() {
  hideLoginOverlay();
  const landing = document.getElementById('landingPage');
  const app     = document.getElementById('appShell');
  if (landing) landing.style.display = 'none';
  if (app)     app.style.display     = 'block';
  const ov = document.getElementById('loadingOverlay');
  const msgEl = ov.querySelector('.msg');
  ov.style.display = 'flex';
  if (msgEl) msgEl.textContent = 'Memuat data...';

  try {
    if (msgEl) msgEl.textContent = 'Menyiapkan dashboard...';
    await loadStore();
  } catch (e) { console.error('Boot error:', e); }

  // ── Load user info dan avatar (#23: initials dari huruf pertama username) ──
  try {
    const me      = await fetch('/api/auth/me').then(r => r.json());
    const name    = (me.username && me.username !== 'Pengguna') ? me.username : '?';
    const initial = name.charAt(0).toUpperCase();
    const initEl  = document.getElementById('avatarInitial');
    const nameEl  = document.getElementById('avatarMenuName');
    const emailEl = document.getElementById('avatarMenuEmail');
    if (initEl)  initEl.textContent = initial;
    if (nameEl)  nameEl.textContent = name;
    if (emailEl) emailEl.textContent = me.email || '';
    if (me.avatar) {
      const btn = document.getElementById('avatarBtn');
      // Sanitasi: hanya izinkan MIME aman — blokir SVG dan format lain yang bisa XSS
      const SAFE_AVATAR_MIME = ['data:image/jpeg;', 'data:image/png;', 'data:image/webp;'];
      const safeAvatar = SAFE_AVATAR_MIME.some(p => me.avatar.startsWith(p));
      if (btn && safeAvatar) {
        btn.style.backgroundImage    = "url('" + me.avatar + "')";
        btn.style.backgroundSize     = 'cover';
        btn.style.backgroundPosition = 'center';
        if (initEl) initEl.style.opacity = '0';
      }
    }
    if (S.transactionsMeta) resetTxPagination();
  } catch {}

  _updateCurrencyBtn();
  renderAll();
  // Fix #5: sembunyikan tombol undo/redo dari UI — keyboard shortcut tetap aktif
  ['undoBtn','redoBtn'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  ov.style.display = 'none';
  loadCheckpointInfo().catch(() => {});
  refreshRates().then(() => { if (S.currency !== 'IDR') renderAll(); }).catch(() => {});

  // Fix #14: restore halaman yang sedang aktif sebelum refresh
  try {
    const savedPage = sessionStorage.getItem('ku_page');
    if (savedPage) {
      const pageEl = document.getElementById('page-' + savedPage);
      const navEl  = document.querySelector('.nav-item[onclick*="\'' + savedPage + '\'"]');
      if (pageEl) showPage(savedPage, navEl);
    }
  } catch {}

  // PWA shortcut: ?shortcut=tx → langsung buka modal tambah transaksi
  try {
    const shortcut = new URLSearchParams(location.search).get('shortcut');
    if (shortcut === 'tx') {
      history.replaceState(null, '', '/');
      setTimeout(() => { showPage('transactions'); openAddTxModal(); }, 400);
    }
  } catch {}

  // Tutorial muncul setelah dashboard selesai render (tutorial.js handles version & state)
  setTimeout(() => _checkPageTutorial('dashboard'), 1200);
}

// Tutorial system moved to tutorial.js — _checkPageTutorial() is defined there

// ─── ENTRY POINT ─────────────────────────────────────────────────────────────
(async () => {
  const savedTheme = localStorage.getItem('ku_theme');
  if (savedTheme) {
    document.body.dataset.theme = savedTheme;
    const btn = document.getElementById('themeBtn');
    if (btn) btn.textContent = savedTheme === 'dark' ? '☀️' : '🌙';
  }

  let loggedIn = false;
  try {
    const r  = await fetch('/api/auth/status');
    const st = await r.json();
    loggedIn = !!st.loggedIn;
  } catch {}

  if (!loggedIn) {
    const ov      = document.getElementById('loadingOverlay');
    const app     = document.getElementById('appShell');
    const landing = document.getElementById('landingPage');
    if (ov)      ov.style.display      = 'none';
    if (app)     app.style.display     = 'none';
    if (landing) landing.style.display = 'block';
  } else {
    await bootApp();
  }
})();

function showLandingAuth(screen) {
  const landing = document.getElementById('landingPage');
  if (landing) landing.style.display = 'none';
  showLoginOverlay();
  showAuthScreen(screen);
}
