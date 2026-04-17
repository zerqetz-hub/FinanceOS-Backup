// ── ui.js — navigation, theme, modal, toast, delete, categories v5.4
// Fix #1:  Enter key submit di semua modal form
// Fix #2:  Income breakdown tampil & editable saat edit cashflow
// Fix #3:  Kelola kategori inline saat tambah income/expense (tab di modal)
// Fix #4:  Sidebar sticky (di CSS)
// Fix #5:  Tombol undo/redo disembunyikan (Ctrl+Z/Y masih aktif via state.js)
// Fix #6:  Currency hanya USD-IDR (di helpers.js)
// Fix #9:  Field keterangan/notes di income & expense
// Fix #11: Hapus tanggal input dari cashflow form
// Fix #12: Terminologi "saldo" konsisten
// Fix #13: Hapus export excel button dari tampilan
// Fix #19: Penjelasan dana darurat = kas likuid
// Fix #21: Halaman profil lengkap
// Fix #23: Avatar initials dari huruf pertama username
'use strict';

function showFormError(msg) {
  const el = document.getElementById('formErr');
  if (el) { el.textContent = msg; el.classList.add('show'); }
  else showToast(msg, 'error');
}

function clearFormError() {
  const el = document.getElementById('formErr');
  if (el) { el.textContent = ''; el.classList.remove('show'); }
}

async function withLoading(btnOrId, asyncFn) {
  const btn = typeof btnOrId === 'string' ? document.getElementById(btnOrId) : btnOrId;
  const origText = btn ? btn.textContent : '';
  if (btn) { btn.disabled = true; btn.classList.add('btn-loading'); }
  try { await asyncFn(); }
  finally { if (btn) { btn.disabled = false; btn.classList.remove('btn-loading'); btn.textContent = origText; } }
}

// ─── TOAST ────────────────────────────────────────────────────────────────────
let toastTimer = null;

function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  document.getElementById('toastMsg').textContent = msg;
  t.className = 'toast' + (type ? ' toast-' + type : '');
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), type === 'error' ? 6000 : 4000);
}

// ─── CONFIRM MODAL ────────────────────────────────────────────────────────────
function showConfirm(title, msg, okLabel = 'Ya') {
  return new Promise(resolve => {
    document.getElementById('confirmTitle').textContent = title;
    document.getElementById('confirmMsg').textContent   = msg;
    const okBtn = document.getElementById('confirmOkBtn');
    okBtn.textContent = okLabel;
    const fresh = okBtn.cloneNode(true);
    okBtn.replaceWith(fresh);
    fresh.onclick = () => { closeConfirm(); resolve(true); };
    const overlay = document.getElementById('confirmOverlay');
    const onBg = e => {
      if (e.target === overlay) { overlay.removeEventListener('click', onBg); closeConfirm(); resolve(false); }
    };
    overlay.addEventListener('click', onBg);
    const cancelBtn = overlay.querySelector('.btn-ghost');
    const freshCancel = cancelBtn.cloneNode(true);
    cancelBtn.replaceWith(freshCancel);
    freshCancel.onclick = () => { overlay.removeEventListener('click', onBg); closeConfirm(); resolve(false); };
    overlay.style.display = 'flex';
  });
}

const EP = { cashflow:'/api/cashflows', asset:'/api/assets', debt:'/api/debts', goal:'/api/goals', tx:'/api/transactions' };

async function del(type, id, label) {
  const typeLabel = { cashflow:'data cash flow', asset:'aset', debt:'hutang', goal:'goal', tx:'transaksi' }[type] || 'data';
  const ok = await showConfirm('Hapus ' + typeLabel + '?', '"' + label + '" akan dihapus permanen dari database.', 'Hapus');
  if (ok) execDel(type, id, label);
}

function closeConfirm() { document.getElementById('confirmOverlay').style.display = 'none'; }
document.getElementById('confirmOverlay').addEventListener('click', e => {
  if (e.target === document.getElementById('confirmOverlay')) closeConfirm();
});

async function execDel(type, id, label) {
  const arr = { cashflow:S.cashflows, asset:S.assets, debt:S.debts, goal:S.goals, tx:S.transactions }[type];
  if (!arr) return;
  const idx = arr.findIndex(x => x.id === id);
  if (idx < 0) return;
  const _snapshot = JSON.parse(JSON.stringify(arr[idx]));
  arr.splice(idx, 1);
  renderAll();
  try {
    await API.del(EP[type] + '/' + id);
    pushCommand('Hapus ' + label,
      async () => { arr.push(_snapshot); await API.post(EP[type], _snapshot); },
      async () => { const i = arr.findIndex(x=>x.id===id); if(i>=0) arr.splice(i,1); await API.del(EP[type]+'/'+id); }
    );
    showToast('"' + label + '" berhasil dihapus', 'success');
  } catch(e) {
    arr.splice(idx, 0, _snapshot);
    renderAll();
    showToast(e?.message || 'Gagal hapus dari server', 'error');
  }
}

// ─── NAVIGATION ───────────────────────────────────────────────────────────────
function showPage(id, btn) {
  const mainEl = document.querySelector('.main');
  if (mainEl) mainEl.scrollTop = 0;
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-' + id).classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  if (btn) btn.classList.add('active');
  _currentPage = id;
  closeMobileMenu();
  _renderCurrentPage();
  if (id === 'dashboard') renderAlerts();
  // Persist halaman aktif agar tidak balik ke dashboard saat refresh (#14)
  try { sessionStorage.setItem('ku_page', id); } catch {}
  setTimeout(() => {
    if (id==='dashboard')  renderDashCharts();
    if (id==='cashflow')   renderCfChart();
    if (id==='networth')   renderNWChart();
    if (id==='emergency')  renderEfChart();
    if (id==='investment') renderPerfChart();
    if (id==='assets')     renderAssetHistChart();
    if (id==='debts')      renderDebtHistChart();
  }, 60);
  if (id === 'networth') setTimeout(() => renderNWSimulator(), 250);
  if (id === 'profile')  setTimeout(() => renderProfile(), 0);
  // Tutorial saat pertama buka halaman
  if (id !== 'profile') setTimeout(() => _checkPageTutorial(id), 600);
}

function toggleMobileMenu() {
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  const isOpen  = sidebar.classList.contains('open');
  sidebar.classList.toggle('open', !isOpen);
  overlay.classList.toggle('open', !isOpen);
}

function closeMobileMenu() {
  document.querySelector('.sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('open');
}

function setFilter(btn) {
  btn.closest('.filter-bar').querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  _dashFilter = btn.textContent.trim();
  renderDashboard();
}

function toggleTheme() {
  const dark = document.body.dataset.theme === 'dark';
  document.body.dataset.theme = dark ? 'light' : 'dark';
  document.getElementById('themeBtn').textContent = dark ? '🌙 Dark' : '☀️ Light';
  localStorage.setItem('ku_theme', dark ? 'light' : 'dark');
  setTimeout(() => {
    Object.keys(CI).forEach(k => { CI[k].destroy(); delete CI[k]; });
    renderAll();
    showPage(_currentPage);
  }, 60);
}

// ─── MODAL ────────────────────────────────────────────────────────────────────
function openModal(type) {
  document.getElementById('modalOverlay').style.display = 'flex';
  const T = {
    income:'Tambah Pemasukan', expense:'Tambah Pengeluaran',
    asset:'Tambah Aset Baru', debt:'Tambah Data Hutang',
    goal:'Tambah Financial Goal', tx:'Tambah Transaksi',
  };
  document.getElementById('modalTitle').textContent = T[type] || 'Tambah Data';
  const curMonth = new Date().toISOString().slice(0,7);
  const today    = new Date().toISOString().slice(0,10);
  const incCats  = getIncomeCats();
  const expCats  = getCats();

  // ── Helper: inline category pills HTML ──
  const incomePills = () => incCats.map(c =>
    '<span class="cat-pill">' + esc(c) + '<button class="cat-pill-rm" onclick="removeCategoryInline(\'income\',\'' + esc(c) + '\')" title="Hapus">×</button></span>'
  ).join('');
  const expensePills = () => expCats.map(c =>
    '<span class="cat-pill">' + esc(c) + '<button class="cat-pill-rm" onclick="removeCategoryInline(\'expense\',\'' + esc(c) + '\')" title="Hapus">×</button></span>'
  ).join('');

  const forms = {
    income: `
      <div class="form-grid">
        <div class="form-group"><label>Bulan</label><input type="month" id="f_inc_month" value="${curMonth}"></div>
        <div class="form-group"><label>Jumlah (Rp)</label><input type="number" id="f_inc_amount" placeholder="0" min="0" autofocus></div>
        <div class="form-group full">
          <label style="display:flex;align-items:center;justify-content:space-between">
            <span>Kategori Pemasukan</span>
            <button type="button" onclick="toggleInlineCatManager('income')" style="font-size:11px;background:none;border:none;color:var(--accent);cursor:pointer;padding:0">+ Kelola</button>
          </label>
          <select id="f_inc_cat">${incCats.map(c => '<option value="' + esc(c) + '">' + esc(c) + '</option>').join('')}</select>
        </div>
        <div id="inlineCatManager_income" style="display:none" class="form-group full">
          <div id="incomeCatPills_modal" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px">${incomePills()}</div>
          <div style="display:flex;gap:8px"><input type="text" id="newIncomeCat_modal" placeholder="Kategori baru..." style="flex:1">
          <button type="button" class="income-btn" onclick="addCategoryInline('income')" style="white-space:nowrap;padding:6px 12px">+ Tambah</button></div>
        </div>
        <div class="form-group full"><label>Keterangan (opsional)</label><input type="text" id="f_inc_notes" placeholder="e.g. Gaji bulan Maret 2025"></div>
      </div>
      <div id="formErr" class="form-err"></div>
      <div style="display:flex;gap:8px;margin-top:12px;justify-content:flex-end">
        <button class="btn btn-ghost" onclick="closeModal()">Batal</button>
        <button class="income-btn" onclick="addIncome()">💰 Simpan Pemasukan</button>
      </div>`,

    expense: `
      <div class="form-grid">
        <div class="form-group"><label>Bulan</label><input type="month" id="f_exp_month" value="${curMonth}"></div>
        <div class="form-group"><label>Jumlah (Rp)</label><input type="number" id="f_exp_amount" placeholder="0" min="0" autofocus></div>
        <div class="form-group full">
          <label style="display:flex;align-items:center;justify-content:space-between">
            <span>Kategori Pengeluaran</span>
            <button type="button" onclick="toggleInlineCatManager('expense')" style="font-size:11px;background:none;border:none;color:var(--accent);cursor:pointer;padding:0">+ Kelola</button>
          </label>
          <select id="f_exp_cat">${expCats.map(c => '<option value="' + esc(c) + '">' + esc(c) + '</option>').join('')}</select>
        </div>
        <div id="inlineCatManager_expense" style="display:none" class="form-group full">
          <div id="expenseCatPills_modal" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px">${expensePills()}</div>
          <div style="display:flex;gap:8px"><input type="text" id="newExpenseCat_modal" placeholder="Kategori baru..." style="flex:1">
          <button type="button" class="btn btn-primary" onclick="addCategoryInline('expense')" style="white-space:nowrap;padding:6px 12px">+ Tambah</button></div>
        </div>
        <div class="form-group full"><label>Keterangan (opsional)</label><input type="text" id="f_exp_notes" placeholder="e.g. Belanja mingguan Alfamart"></div>
      </div>
      <div id="formErr" class="form-err"></div>
      <div style="display:flex;gap:8px;margin-top:12px;justify-content:flex-end">
        <button class="btn btn-ghost" onclick="closeModal()">Batal</button>
        <button class="btn btn-primary" onclick="addExpenseEntry()">💸 Simpan Pengeluaran</button>
      </div>`,

    asset: `
      <div class="form-grid">
        <div class="form-group full"><label>Nama Aset</label><input type="text" id="f_aname" placeholder="e.g. BBCA, Bitcoin, Rumah Jakarta" autofocus></div>
        <div class="form-group full"><label>Deskripsi</label><input type="text" id="f_asub" placeholder="e.g. Saham, 25 gram, Properti"></div>
        <div class="form-group"><label>Jenis Aset</label><select id="f_atype">
          <option value="Stock">Saham</option><option value="Crypto">Crypto</option>
          <option value="Property">Properti</option><option value="Gold">Emas / Silver</option>
          <option value="MutualFund">Reksa Dana</option><option value="Bond">Obligasi</option>
          <option value="Cash">Kas / Tabungan</option><option value="Other">Lainnya</option>
        </select></div>
        <div class="form-group"><label>Tanggal Pembelian</label><input type="date" id="f_adate" value="${today}"></div>
        <div class="form-group"><label>Modal Awal (Rp)</label><input type="number" id="f_acost" placeholder="0" min="0"></div>
        <div class="form-group"><label>Nilai Sekarang (Rp)</label><input type="number" id="f_aval" placeholder="0" min="0"></div>
      </div>
      <div id="formErr" class="form-err"></div>
      <div style="display:flex;gap:8px;margin-top:12px;justify-content:flex-end">
        <button class="btn btn-ghost" onclick="closeModal()">Batal</button>
        <button class="btn btn-primary" onclick="addAsset()">Simpan Aset</button>
      </div>`,

    debt: `
      <div class="form-grid">
        <div class="form-group full"><label>Nama Hutang</label><input type="text" id="f_dname" placeholder="e.g. KPR Rumah, Pinjaman KTA" autofocus></div>
        <div class="form-group"><label>Jenis</label><select id="f_dtype">
          <option value="Long-term">Long-term (jangka panjang)</option>
          <option value="Short-term">Short-term (jangka pendek)</option>
          <option value="Installment">Installment (cicilan)</option>
          <option value="Credit">Credit Card</option>
          <option value="Other">Lainnya</option>
        </select></div>
        <div class="form-group"><label>Bunga (%/tahun)</label><input type="number" id="f_dbunga" placeholder="0" step="0.1" min="0"></div>
        <div class="form-group"><label>Total Hutang Awal (Rp)</label><input type="number" id="f_dtotal" placeholder="0" min="0"></div>
        <div class="form-group"><label>Sisa Hutang Saat Ini (Rp)</label><input type="number" id="f_dsisa" placeholder="0" min="0"></div>
        <div class="form-group"><label>Cicilan/Bulan (Rp)</label><input type="number" id="f_dcicilan" placeholder="0" min="0"></div>
        <div class="form-group"><label>Tanggal Jatuh Tempo</label><input type="date" id="f_djatuh"></div>
        <div class="form-group"><label>Tanggal Input</label><input type="date" id="f_ddate" value="${today}"></div>
      </div>
      <div id="formErr" class="form-err"></div>
      <div style="display:flex;gap:8px;margin-top:12px;justify-content:flex-end">
        <button class="btn btn-ghost" onclick="closeModal()">Batal</button>
        <button class="btn btn-primary" onclick="addDebt()">Simpan Hutang</button>
      </div>`,

    goal: `
      <div class="form-grid">
        <div class="form-group full"><label>Nama Goal</label><input type="text" id="f_gname" placeholder="e.g. Dana Pensiun, Liburan Eropa" autofocus></div>
        <div class="form-group"><label>Target (Rp)</label><input type="number" id="f_gtarget" placeholder="0" min="0"></div>
        <div class="form-group"><label>Sudah Terkumpul (Rp)</label><input type="number" id="f_gcurrent" placeholder="0" min="0"></div>
        <div class="form-group"><label>Target Waktu</label><input type="month" id="f_gdeadline"></div>
        <div class="form-group"><label>Warna Progress</label><select id="f_gcolor">
          <option value="#1a6b4a">Hijau</option><option value="#1a5ba6">Biru</option>
          <option value="#5a3fb5">Ungu</option><option value="#c45c1a">Oranye</option>
          <option value="#c23b3b">Merah</option>
        </select></div>
      </div>
      <div id="formErr" class="form-err"></div>
      <div style="display:flex;gap:8px;margin-top:16px;justify-content:flex-end">
        <button class="btn btn-ghost" onclick="closeModal()">Batal</button>
        <button class="btn btn-primary" onclick="addGoal()">Simpan Goal</button>
      </div>`,

    tx: `
      <div class="form-grid">
        <div class="form-group full"><label>Nama Transaksi</label><input type="text" id="f_tname" placeholder="e.g. Makan siang, Gaji, Belanja bulanan" autofocus></div>
        <div class="form-group"><label>Jumlah (Rp)</label><input type="number" id="f_tamt" placeholder="0" min="0"></div>
        <div class="form-group"><label>Jenis</label><select id="f_ttype" onchange="updateTxCat(this.value)"><option value="out">Pengeluaran (−)</option><option value="in">Pemasukan (+)</option></select></div>
        <div class="form-group"><label>Tanggal Transaksi</label><input type="date" id="f_tdate" value="${today}"></div>
        <div class="form-group full"><label>Kategori</label><select id="f_tcat">
          ${getCats().map(c => '<option value="' + esc(c) + '">' + esc(c) + '</option>').join('')}
        </select></div>
        <div class="form-group full"><label>Keterangan (opsional)</label><input type="text" id="f_tnotes" placeholder="Catatan tambahan..."></div>
      </div>
      <div id="formErr" class="form-err"></div>
      <div style="display:flex;gap:8px;margin-top:16px;justify-content:flex-end">
        <button class="btn btn-ghost" onclick="closeModal()">Batal</button>
        <button class="btn btn-primary" onclick="addTx()">Simpan Transaksi</button>
      </div>`,
  };

  clearFormError();
  document.getElementById('modalContent').innerHTML = forms[type] || '';

  // ── Fix #1: Enter key submit ──
  setTimeout(() => {
    const submitBtns = {
      income:  () => addIncome(),
      expense: () => addExpenseEntry(),
      asset:   () => addAsset(),
      debt:    () => addDebt(),
      goal:    () => addGoal(),
      tx:      () => addTx(),
    };
    const fn = submitBtns[type];
    if (fn) {
      document.querySelectorAll('#modalContent input').forEach(inp => {
        inp.addEventListener('keydown', e => {
          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); fn(); }
        });
      });
    }
  }, 0);
}

function closeModal() { document.getElementById('modalOverlay').style.display = 'none'; }
document.getElementById('modalOverlay').addEventListener('click', e => {
  if (e.target === document.getElementById('modalOverlay')) closeModal();
});

// ─── INLINE CATEGORY MANAGEMENT (#3) ─────────────────────────────────────────
function toggleInlineCatManager(type) {
  const el = document.getElementById('inlineCatManager_' + type);
  if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

function _refreshInlineCatSelect(type) {
  const cats = type === 'income' ? getIncomeCats() : getCats();
  const selectId = type === 'income' ? 'f_inc_cat' : 'f_exp_cat';
  const select = document.getElementById(selectId);
  if (select) select.innerHTML = cats.map(c => '<option value="' + esc(c) + '">' + esc(c) + '</option>').join('');
}

function _refreshInlinePills(type) {
  const cats = type === 'income' ? getIncomeCats() : getCats();
  const pillsId = type === 'income' ? 'incomeCatPills_modal' : 'expenseCatPills_modal';
  const el = document.getElementById(pillsId);
  if (el) el.innerHTML = cats.map(c =>
    '<span class="cat-pill">' + esc(c) + '<button class="cat-pill-rm" onclick="removeCategoryInline(\'' + type + '\',\'' + esc(c) + '\')" title="Hapus">×</button></span>'
  ).join('');
}

async function addCategoryInline(type) {
  const inputId = type === 'income' ? 'newIncomeCat_modal' : 'newExpenseCat_modal';
  const name = (document.getElementById(inputId)?.value || '').trim();
  if (!name) return;
  if (S.categories[type].includes(name)) { showToast('Kategori sudah ada.', 'error'); return; }
  S.categories[type].push(name);
  document.getElementById(inputId).value = '';
  _refreshInlinePills(type);
  _refreshInlineCatSelect(type);
  await syncSettings();
  showToast('Kategori "' + name + '" ditambahkan', 'success');
}

async function removeCategoryInline(type, cat) {
  if (S.categories[type].length <= 1) { showToast('Minimal harus ada 1 kategori.', 'warning'); return; }
  S.categories[type] = S.categories[type].filter(c => c !== cat);
  _refreshInlinePills(type);
  _refreshInlineCatSelect(type);
  if (type === 'expense') {
    // Remove the category from each cashflow's expenses, then persist to server
    // so the deleted-category amount doesn't resurface after page reload.
    const affected = S.cashflows.filter(cf => cf.expenses && cat in cf.expenses);
    affected.forEach(cf => { delete cf.expenses[cat]; });
    await Promise.all(affected.map(cf => API.put('/api/cashflows/' + cf.id, cf).catch(() => {})));
  }
  if (type === 'income') {
    // Remove category from incomeBreakdown + recalculate income total
    const affected = S.cashflows.filter(cf => cf.incomeBreakdown && cat in cf.incomeBreakdown);
    affected.forEach(cf => {
      delete cf.incomeBreakdown[cat];
      if (cf.incomeNotes) delete cf.incomeNotes[cat];
      cf.income = Object.values(cf.incomeBreakdown).reduce((a, b) => a + b, 0);
    });
    await Promise.all(affected.map(cf => API.put('/api/cashflows/' + cf.id, cf).catch(() => {})));
  }
  await syncSettings();
  showToast('Kategori "' + cat + '" dihapus', 'success');
}

// Legacy — kept for old calls but now managed inline
async function addCategory(type) { await addCategoryInline(type); }
async function removeCategory(type, cat) { await removeCategoryInline(type, cat); }
function switchCatTab() {}

// ─── AVATAR MENU ─────────────────────────────────────────────────────────────
function toggleAvatarMenu() {
  const menu = document.getElementById('avatarMenu');
  if (!menu) return;
  menu.classList.toggle('open');
  if (menu.classList.contains('open'))
    setTimeout(() => document.addEventListener('click', _closeAvatarOnOutside, { once: true }), 0);
}
function closeAvatarMenu() { document.getElementById('avatarMenu')?.classList.remove('open'); }
function _closeAvatarOnOutside(e) {
  const wrap = document.getElementById('avatarWrap');
  if (wrap && !wrap.contains(e.target)) closeAvatarMenu();
}
