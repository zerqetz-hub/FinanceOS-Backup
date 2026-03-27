// ── tutorial.js — Smart Slide-in Tutorial Panel v5.5 ─────────────────────────
// Panel non-blocking yang otomatis pindah posisi agar TIDAK menutupi elemen target.
'use strict';

const TUT = {
  dashboard: {
    title: 'Dashboard',
    steps: [
      { target: '#dash-metrics',   title: 'Ringkasan Keuangan',
        desc: 'Empat kartu utama: Net Worth (aset − hutang), Pemasukan bulan ini, Saldo Bersih, dan Status Dana Darurat. Semua diperbarui otomatis.',
        action: 'Coba klik salah satu kartu untuk navigasi ke halaman terkait.' },
      { target: '#alertBanner',    title: 'Peringatan Otomatis',
        desc: 'Banner ini aktif jika kondisi finansial perlu perhatian: saving rate rendah, DTI > 40%, atau dana darurat belum cukup.', action: null },
      { target: '#incomeExpChart', title: 'Grafik Income vs Pengeluaran',
        desc: 'Batang hijau = pemasukan, merah = pengeluaran per bulan.',
        action: 'Coba klik tombol "Kuartal" atau "Tahunan" di atas.' },
      { target: '#expBreakChart',  title: 'Expense Breakdown',
        desc: 'Proporsi pengeluaran per kategori. Hover tiap irisan untuk melihat nominalnya.', action: null },
      { target: '#recentTxList',   title: 'Transaksi Terbaru',
        desc: 'Daftar 20 transaksi harian terakhir. Klik "+ Tambah" untuk mencatat transaksi baru.',
        action: 'Coba klik "+ Tambah" untuk mencatat transaksi pertamamu.' },
    ],
  },
  cashflow: {
    title: 'Cash Flow',
    steps: [
      { target: '#cf-metrics',       title: 'Ringkasan Bulan Aktif',
        desc: 'Total pemasukan, pengeluaran, dan saldo bersih. Saldo positif = kamu menyisihkan uang bulan itu.', action: null },
      { target: '#cfMonthSelect',    title: 'Navigasi Bulan',
        desc: 'Gunakan dropdown atau ‹ › untuk berpindah bulan. Setiap bulan menyimpan data secara terpisah.',
        action: 'Coba klik ‹ untuk melihat bulan sebelumnya.' },
      { target: '.income-btn',       title: 'Tambah Pemasukan',
        desc: 'Klik untuk mencatat sumber pemasukan: Gaji, Freelance, Bisnis, dll.',
        action: 'Coba klik "+ Tambah Income" untuk mencatat pemasukan.' },
      { target: '#expenseBreakdown', title: 'Rincian Pengeluaran',
        desc: 'Isi nominal setiap kategori. Klik "+ Kelola" untuk menambah atau menghapus kategori.', action: null },
      { target: '#cashflowTable',    title: 'Riwayat Semua Bulan',
        desc: 'Rekap semua bulan: pemasukan, pengeluaran, saldo, dan saving rate. Klik ✏️ untuk mengedit.', action: null },
    ],
  },
  assets: {
    title: 'Manajemen Aset',
    steps: [
      { target: '#asset-metrics',  title: 'Ringkasan Portofolio',
        desc: 'Total nilai aset, jenis terbesar, dan return unrealized vs modal awal.', action: null },
      { target: 'button[onclick="openModal(\'asset\')"]', title: 'Tambah Aset',
        desc: 'Klik untuk menambah aset: Saham, Crypto, Properti, Emas, Reksa Dana.',
        action: 'Coba klik "+ Tambah Aset" untuk menambah aset pertamamu.' },
      { target: '#assetCards',     title: 'Kartu Aset',
        desc: 'Setiap aset ditampilkan dengan nilai dan return. Klik "📈 Perbarui" untuk mencatat nilai terbaru.', action: null },
      { target: '#assetHistChart', title: 'Grafik Perkembangan',
        desc: 'Tren nilai setiap aset dari waktu ke waktu. Semakin sering update, semakin akurat.', action: null },
    ],
  },
  debts: {
    title: 'Manajemen Hutang',
    steps: [
      { target: '#debt-metrics', title: 'Ringkasan Hutang',
        desc: 'Total sisa hutang, cicilan per bulan, dan DTI Ratio. Ideal < 35%, berbahaya jika > 40%.', action: null },
      { target: 'button[onclick="openModal(\'debt\')"]', title: 'Tambah Hutang',
        desc: 'Catat hutang: KPR, kendaraan, kartu kredit. Isi total, sisa, bunga, dan cicilan per bulan.',
        action: 'Coba klik "+ Tambah Hutang" untuk mencatat hutang.' },
      { target: '#debtList',     title: 'Hutang Aktif',
        desc: 'Semua hutang aktif dengan progress bar. Klik "Update Saldo" tiap bulan untuk mencatat pembayaran.', action: null },
      { target: '#debtHistChart', title: 'Grafik Sisa Hutang',
        desc: 'Tren penurunan sisa hutang. Tren turun konsisten = kamu konsisten melunasi.', action: null },
    ],
  },
  networth: {
    title: 'Net Worth',
    steps: [
      { target: '#nw-callout',      title: 'Net Worth Saat Ini',
        desc: 'Net Worth = Total Aset − Total Hutang. Negatif wajar jika hutang (KPR) lebih besar dari aset yang dimiliki.', action: null },
      { target: '#nwGrowthChart',   title: 'Tren Pertumbuhan',
        desc: 'Perjalanan net worth dari waktu ke waktu. Tren naik konsisten = kondisi finansial membaik.', action: null },
      { target: '#nwSimChart',      title: 'Simulasi Proyeksi',
        desc: 'Proyeksi ke depan. Pilih horizon waktu dan skenario: Normal, Optimis (+20%), Pesimis (−20%).',
        action: 'Coba ubah Horizon atau Skenario menggunakan dropdown di atas grafik.' },
    ],
  },
  goals: {
    title: 'Goal Tracker',
    steps: [
      { target: 'button[onclick="openModal(\'goal\')"]', title: 'Buat Goal Finansial',
        desc: 'Tetapkan target: dana pensiun, uang muka rumah, liburan. Isi nama, nominal, dana terkumpul, dan deadline.',
        action: 'Coba klik "+ Tambah Goal" untuk membuat target pertamamu.' },
      { target: '#goalList', title: 'Progress Goal',
        desc: 'Setiap goal dengan progress bar berwarna. Klik ✏️ untuk memperbarui "Dana Terkumpul" secara berkala.', action: null },
    ],
  },
  emergency: {
    title: 'Dana Darurat',
    steps: [
      { target: '#ef-metrics', title: 'Status Dana Darurat',
        desc: 'Target ideal = 6× rata-rata pengeluaran bulanan. Harus berupa kas atau tabungan — bukan saham atau crypto.', action: null },
      { target: '#efChart', title: 'Grafik Proyeksi',
        desc: 'Garis hijau = aktual. Garis putus-putus = proyeksi kapan target tercapai berdasarkan rata-rata saving historis.', action: null },
    ],
  },
  investment: {
    title: 'Investasi',
    steps: [
      { target: '#investList', title: 'Performa Investasi',
        desc: 'Semua aset investasi dengan return vs modal awal. Hijau = untung, merah = rugi. Kas/Tabungan tidak masuk di sini.', action: null },
      { target: '#investChart', title: 'Komposisi Portofolio',
        desc: 'Nilai setiap instrumen. Gunakan ini untuk menilai diversifikasi — idealnya tidak terlalu dominan di satu aset.', action: null },
    ],
  },
};

const _t = { pageId: null, steps: [], step: 0, key: null, offKey: null, tx: null };
const TUT_VER = 'v5.5';
const TUT_KEY = id => 'ku_tut_' + id;

function startTutorial(pageId) {
  const def = TUT[pageId];
  if (!def) return;
  _stop(false);
  _t.pageId = pageId;
  _t.steps  = def.steps;
  _t.step   = 0;
  _t.key    = TUT_KEY(pageId);
  _show();
}

function checkTutorial(pageId) {
  try {
    if (localStorage.getItem('ku_tut_ver') !== TUT_VER) {
      Object.keys(localStorage).filter(k => k.startsWith('ku_tut_')).forEach(k => localStorage.removeItem(k));
      localStorage.setItem('ku_tut_ver', TUT_VER);
    }
    if (localStorage.getItem(TUT_KEY(pageId))) return;
  } catch {}
  if (!TUT[pageId]) return;
  setTimeout(() => startTutorial(pageId), 800);
}
function _checkPageTutorial(pageId) { checkTutorial(pageId); }

// ─── INJECT STYLES ───────────────────────────────────────────────────────────

function _injectStyles() {
  if (document.getElementById('tutCSS')) return;
  const s = document.createElement('style');
  s.id = 'tutCSS';
  s.textContent = `
#tutPanel {
  position: fixed;
  z-index: 4000;
  width: 286px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 14px;
  box-shadow: 0 8px 40px rgba(0,0,0,.22);
  overflow: hidden;
  opacity: 0;
  pointer-events: none;
  transition: opacity .3s ease, top .35s cubic-bezier(.22,1,.36,1), left .35s cubic-bezier(.22,1,.36,1);
}
#tutPanel.tut-open {
  opacity: 1;
  pointer-events: all;
}
/* Dark overlay panels — 4 rectangles surrounding target */
.tut-overlay-panel {
  position: fixed;
  background: rgba(0,0,0,.55);
  pointer-events: all;
  transition: all .35s cubic-bezier(.4,0,.2,1);
  z-index: 3998;
}
/* Click on overlay = close tutorial */

#tutRing {
  position: fixed;
  pointer-events: none;
  z-index: 3999;
  border-radius: 10px;
  outline: 2.5px solid var(--accent);
  outline-offset: 5px;
  box-shadow: 0 0 0 5px rgba(26,107,74,.13), 0 0 24px rgba(26,107,74,.16);
  transition: all .38s cubic-bezier(.22,1,.36,1);
  opacity: 0;
}
#tutRing.on { opacity: 1; animation: tRP 2.2s ease-in-out infinite; }
@keyframes tRP { 0%,100%{outline-offset:5px}55%{outline-offset:9px} }
.tut-hdr { padding: 12px 14px 0; display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; }
.tut-tag { font-size: 10px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--accent); margin-bottom: 3px; display: flex; align-items: center; gap: 4px; }
.tut-ttl { font-size: 14px; font-weight: 600; color: var(--text); line-height: 1.3; }
.tut-x { flex-shrink:0; width: 26px; height: 26px; border-radius: 50%; background: none; border: none; cursor: pointer; color: var(--text3); font-size: 18px; display: flex; align-items: center; justify-content: center; transition: background .15s; line-height: 1; font-family: inherit; }
.tut-x:hover { background: var(--surface2); }
.tut-bar { height: 2px; background: var(--border); margin: 10px 14px 0; overflow: hidden; border-radius: 1px; }
.tut-bar-f { height: 100%; background: var(--accent); border-radius: 1px; transition: width .35s ease; }
.tut-body { padding: 10px 14px 0; font-size: 12.5px; color: var(--text2); line-height: 1.65; }
.tut-tip { margin: 8px 14px 0; padding: 7px 11px; background: var(--accent-light); border-left: 2.5px solid var(--accent); border-radius: 0 6px 6px 0; font-size: 11px; color: var(--accent); line-height: 1.5; }
.tut-foot { padding: 10px 14px 12px; display: flex; align-items: center; justify-content: space-between; gap: 6px; border-top: 1px solid var(--border); margin-top: 10px; }
.tut-cnt { font-size: 11px; color: var(--text3); }
.tut-skip { font-size: 12px; padding: 4px 8px; background: none; border: none; color: var(--text3); cursor: pointer; border-radius: 6px; font-family: var(--font); }
.tut-skip:hover { background: var(--surface2); color: var(--text); }
.tut-prev { font-size: 12px; padding: 5px 12px; background: var(--surface2); border: 1px solid var(--border); border-radius: 7px; cursor: pointer; color: var(--text2); font-family: var(--font); }
.tut-next { font-size: 12px; padding: 5px 14px; background: var(--accent); color: #fff; border: none; border-radius: 7px; cursor: pointer; font-weight: 600; font-family: var(--font); }`;
  document.head.appendChild(s);
}

// ─── SHOW ────────────────────────────────────────────────────────────────────

function _show() {
  _injectStyles();

  // Create panel
  let panel = document.getElementById('tutPanel');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'tutPanel';
    document.body.appendChild(panel);
  }

  // Create ring
  if (!document.getElementById('tutRing')) {
    const r = document.createElement('div');
    r.id = 'tutRing';
    document.body.appendChild(r);
  }

  // Keyboard
  const onKey = e => {
    if (!document.getElementById('tutPanel')?.classList.contains('tut-open')) return;
    if (e.key === 'ArrowRight' || e.key === 'Enter') _nav(1);
    else if (e.key === 'ArrowLeft') _nav(-1);
    else if (e.key === 'Escape') _stop(true);
  };
  document.addEventListener('keydown', onKey);
  _t.offKey = onKey;

  // Touch swipe on panel
  panel.addEventListener('touchstart', e => { _t.tx = e.touches[0].clientX; }, { passive: true });
  panel.addEventListener('touchend',   e => {
    if (_t.tx === null) return;
    const dx = e.changedTouches[0].clientX - _t.tx; _t.tx = null;
    if (Math.abs(dx) > 40) _nav(dx < 0 ? 1 : -1);
  }, { passive: true });

  _render();
  // Show after first render
  requestAnimationFrame(() => requestAnimationFrame(() => {
    document.getElementById('tutPanel')?.classList.add('tut-open');
  }));
}

// ─── RENDER STEP ─────────────────────────────────────────────────────────────

function _render() {
  const s      = _t.steps[_t.step];
  const total  = _t.steps.length;
  const pct    = Math.round((_t.step + 1) / total * 100);
  const isLast = _t.step === total - 1;
  const panel  = document.getElementById('tutPanel');
  if (!panel) return;

  const pageTitle = TUT[_t.pageId]?.title || '';
  const SVG = '<svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="8" cy="8" r="6"/><path d="M8 7.5c0-1 .75-1.5 1.5-1.5S11 6.5 11 7.5c0 .75-.5 1.25-1.5 1.5V10"/><circle cx="8" cy="12" r=".75" fill="currentColor" stroke="none"/></svg>';

  panel.innerHTML = `
    <div class="tut-hdr">
      <div>
        <div class="tut-tag">${SVG}Tutorial · ${esc(pageTitle)}</div>
        <div class="tut-ttl">${esc(s.title)}</div>
      </div>
      <button class="tut-x" onclick="_stop(true)">×</button>
    </div>
    <div class="tut-bar"><div class="tut-bar-f" style="width:${pct}%"></div></div>
    <div class="tut-body">${esc(s.desc)}</div>
    ${s.action ? `<div class="tut-tip">💡 ${esc(s.action)}</div>` : ''}
    <div class="tut-foot">
      <span class="tut-cnt">${_t.step + 1} / ${total}</span>
      <div style="display:flex;gap:5px;align-items:center">
        <button class="tut-skip" onclick="_stop(true)">Lewati</button>
        ${_t.step > 0 ? '<button class="tut-prev" onclick="_nav(-1)">←</button>' : ''}
        <button class="tut-next" onclick="_nav(1)">${isLast ? 'Selesai ✓' : 'Lanjut →'}</button>
      </div>
    </div>`;

  // Highlight and reposition
  _highlightAndPosition(s.target);
}

// ─── SMART POSITIONING ───────────────────────────────────────────────────────
// Panel moves to whichever corner/side has enough space that doesn't overlap target.

function _highlightAndPosition(selector) {
  const ring  = document.getElementById('tutRing');
  const panel = document.getElementById('tutPanel');
  if (!ring || !panel) return;

  const el = selector ? document.querySelector(selector) : null;

  if (!el) {
    ring.className = '';
    _removeOverlays();
    const vw = window.innerWidth, vh = window.innerHeight;
    const PW = 286, PH = panel.offsetHeight || 220;
    panel.style.left = Math.round((vw - PW) / 2) + 'px';
    panel.style.top  = Math.round((vh - PH) / 2) + 'px';
    return;
  }

  el.scrollIntoView({ behavior: 'smooth', block: 'center' });

  setTimeout(() => {
    const r   = el.getBoundingClientRect();
    const PAD = 8;
    const vw  = window.innerWidth;
    const vh  = window.innerHeight;
    const PW  = 286;
    const PH  = panel.offsetHeight || 220;
    const GAP = 12;

    // Update ring
    const tTop = r.top - PAD, tBot = r.bottom + PAD;
    const tLeft = r.left - PAD, tRight = r.right + PAD;
    ring.style.top    = tTop + 'px';
    ring.style.left   = tLeft + 'px';
    ring.style.width  = (tRight - tLeft) + 'px';
    ring.style.height = (tBot - tTop)   + 'px';
    ring.className = 'on';
    // Overlay panels surrounding target
    _updateOverlays(tTop, tBot, tLeft, tRight);

    // Target rect (with PAD)
    const tTop    = r.top    - PAD;
    const tBottom = r.bottom + PAD;
    const tLeft   = r.left   - PAD;
    const tRight  = r.right  + PAD;

    // Try 4 positions: below-right, below-left, above-right, above-left
    const candidates = [
      // Below target, right-aligned area (most common)
      { t: tBottom + GAP, l: Math.min(tLeft, vw - PW - GAP) },
      // Below target, left edge
      { t: tBottom + GAP, l: GAP },
      // Above target, right-aligned  
      { t: tTop - PH - GAP, l: Math.min(tLeft, vw - PW - GAP) },
      // Above target, left edge
      { t: tTop - PH - GAP, l: GAP },
      // Right of target
      { t: Math.max(GAP, tTop), l: tRight + GAP },
      // Left of target
      { t: Math.max(GAP, tTop), l: tLeft - PW - GAP },
      // Bottom-right corner (fallback)
      { t: vh - PH - GAP, l: vw - PW - GAP },
      // Top-right corner
      { t: GAP, l: vw - PW - GAP },
    ];

    // Score each candidate by: 1) fits in viewport, 2) doesn't overlap target
    function overlaps(t, l) {
      const pRight = l + PW, pBottom = t + PH;
      return !(pRight < tLeft || l > tRight || pBottom < tTop || t > tBottom);
    }
    function fitsViewport(t, l) {
      return t >= 0 && l >= 0 && (l + PW) <= vw && (t + PH) <= vh;
    }

    let best = candidates.find(c => fitsViewport(c.t, c.l) && !overlaps(c.t, c.l));
    if (!best) best = candidates.find(c => !overlaps(c.t, c.l));
    if (!best) best = candidates[7]; // top-right fallback

    // Clamp to viewport
    best.l = Math.max(GAP, Math.min(vw - PW - GAP, best.l));
    best.t = Math.max(GAP, Math.min(vh - PH - GAP, best.t));

    panel.style.left = Math.round(best.l) + 'px';
    panel.style.top  = Math.round(best.t) + 'px';
  }, 300);
}

// ─── NAVIGATION ───────────────────────────────────────────────────────────────

function _removeOverlays() {
  document.querySelectorAll('.tut-overlay-panel').forEach(p => p.remove());
}

function _updateOverlays(tTop, tBot, tLeft, tRight) {
  _removeOverlays();
  const vw = window.innerWidth, vh = window.innerHeight;
  const panels = [
    { top: 0,    left: 0,          width: vw,          height: tTop },           // above
    { top: tBot, left: 0,          width: vw,          height: vh - tBot },       // below
    { top: tTop, left: 0,          width: tLeft,        height: tBot - tTop },     // left
    { top: tTop, left: tRight,     width: vw - tRight,  height: tBot - tTop },     // right
  ];
  panels.forEach(s => {
    if (s.width <= 0 || s.height <= 0) return;
    const d = document.createElement('div');
    d.className = 'tut-overlay-panel';
    d.style.top    = s.top    + 'px';
    d.style.left   = s.left   + 'px';
    d.style.width  = s.width  + 'px';
    d.style.height = s.height + 'px';
    d.addEventListener('click', () => _stop(true));
    document.body.appendChild(d);
  });
}

function _nav(dir) {
  const next = _t.step + dir;
  if (next >= _t.steps.length) { _stop(true); return; }
  if (next < 0) return;
  _t.step = next;
  _render();
}

// ─── STOP ─────────────────────────────────────────────────────────────────────

function _stop(markSeen) {
  if (markSeen) { try { if (_t.key) localStorage.setItem(_t.key, '1'); } catch {} }
  // Remove immediately — setTimeout caused panel to vanish 380ms after restart
  _removeOverlays();
  const panel = document.getElementById('tutPanel');
  if (panel) panel.remove();
  const ring = document.getElementById('tutRing');
  if (ring) ring.remove();
  if (_t.offKey) { document.removeEventListener('keydown', _t.offKey); _t.offKey = null; }
  _t.pageId = null; _t.steps = []; _t.step = 0; _t.key = null; _t.tx = null;
}
