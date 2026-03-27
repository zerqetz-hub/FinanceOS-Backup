// ── actions.transactions.js — transaction CRUD ───────────────────────────────
// @requires api.js, state.js, helpers.js, ui.js, render.js
'use strict';

const CAT_COLORS = ['#1a6b4a','#1a5ba6','#5a3fb5','#c45c1a','#b87614','#c23b3b','#888888'];
const EMOJI_MAP  = {
  Makanan:'🍽️', Transport:'🚗', Hiburan:'🎬', Kesehatan:'🏥',
  Utilities:'⚡', Belanja:'🛒', Gaji:'💰', Freelance:'💻',
  Bisnis:'🏢', Investasi:'📈', Bonus:'🎁', Dividen:'💎', Lainnya:'💳'
};

function _txCatColor(catName, isIn) {
  const allCats = isIn ? getIncomeCats() : getCats();
  const ci = allCats.indexOf(catName);
  return CAT_COLORS[ci >= 0 ? ci % 7 : 6];
}

/** Repopulate the category <select> when transaction type changes (add modal). */
function updateTxCat(type) {
  const sel = document.getElementById('f_tcat'); if (!sel) return;
  sel.innerHTML = (type === 'in' ? getIncomeCats() : getCats())
    .map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
}

/** Repopulate category <select> in the edit modal when type changes. */
function updateEditTxCat(type, id) {
  const allCats = type === 'in' ? getIncomeCats() : getCats();
  const sel = document.getElementById('ef_tcat');
  if (sel) sel.innerHTML = allCats.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
}

async function addTx() {
  await withSubmitLock(async () => {
    const name = v('f_tname').trim(); const amt = vn('f_tamt');
    if (!name||!amt) { showFormError('Nama dan jumlah wajib diisi.'); return; }
    const catSel = v('f_tcat'); const isIn = v('f_ttype') === 'in';
    const catColor = _txCatColor(catSel, isIn);
    const emoji    = EMOJI_MAP[catSel] || (isIn ? '💰' : '💳');
    const dateAdded = v('f_tdate') || new Date().toISOString().slice(0,10);
    const dateStr   = isoToDisplay(dateAdded + 'T00:00:00');
    const id = uid();
    const newT = {id, cat:emoji, name, date:dateStr, amount:isIn?amt:-amt, catColor, catName:catSel, notes:v('f_tnotes')||'', dateAdded};
    S.transactions.unshift(newT); closeModal(); renderAll();
    try {
      const _r = await API.post('/api/transactions', newT);
      if (_r?.error) throw new Error(_r.error); flashSave();
      pushCommand(`Tambah transaksi ${name}`,
        async () => { S.transactions = S.transactions.filter(t => t.id !== id); await API.del(`/api/transactions/${id}`); },
        async () => { S.transactions.unshift(newT); await API.post('/api/transactions', newT); }
      );
      showToast(`Transaksi "${name}" ditambahkan`, 'success');
    } catch(e) { S.transactions = S.transactions.filter(t => t.id !== id); renderAll(); showToast((e?.message || 'Gagal menyimpan ke server'), 'error'); }
  });
}

async function updateTx(id) {
  const t = S.transactions.find(t => t.id === id); if (!t) return;
  const _prev = JSON.parse(JSON.stringify(t));
  const amt = vn('ef_tamt'); const isIn = v('ef_ttype') === 'in'; const catSel = v('ef_tcat');
  t.name    = v('ef_tname').trim() || t.name;
  t.amount  = isIn ? amt : -amt;
  t.catName = catSel;
  t.cat     = EMOJI_MAP[catSel] || (isIn ? '💰' : '💳');
  t.catColor = _txCatColor(catSel, isIn);
  const dr = v('ef_tdate');
  if (dr) { t.dateAdded = dr; t.date = isoToDisplay(dr + 'T00:00:00'); }
  const _next = JSON.parse(JSON.stringify(t));
  closeModal(); renderAll();
  try {
    const _r = await API.put(`/api/transactions/${id}`, t);
    if (_r?.error) throw new Error(_r.error); flashSave();
    pushCommand(`Edit transaksi ${t.name}`,
      async () => { Object.assign(S.transactions.find(x => x.id === id)||{}, _prev); await API.put(`/api/transactions/${id}`, _prev); },
      async () => { Object.assign(S.transactions.find(x => x.id === id)||{}, _next); await API.put(`/api/transactions/${id}`, _next); }
    );
    showToast(`Transaksi "${t.name}" berhasil diperbarui`, 'success');
  } catch(e) { Object.assign(t, _prev); renderAll(); showToast((e?.message || 'Gagal menyimpan ke server'), 'error'); }
}

/** Shortcut to open add transaction modal (dipakai dari dashboard) */
function openAddTxModal() {
  document.getElementById('modalOverlay').style.display = 'flex';
  document.getElementById('modalTitle').textContent = 'Tambah Transaksi';
  const cats = getCats();
  document.getElementById('modalContent').innerHTML = `
    <div class="form-grid">
      <div class="form-group full"><label>Nama Transaksi</label><input type="text" id="f_tname" placeholder="Contoh: Makan siang" autofocus></div>
      <div class="form-group"><label>Jumlah (Rp)</label><input type="number" id="f_tamt" placeholder="0" min="0"></div>
      <div class="form-group"><label>Jenis</label><select id="f_ttype" onchange="updateTxCat(this.value)">
        <option value="out">Pengeluaran (−)</option>
        <option value="in">Pemasukan (+)</option>
      </select></div>
      <div class="form-group"><label>Tanggal</label><input type="date" id="f_tdate" value="${new Date().toISOString().slice(0,10)}"></div>
      <div class="form-group full"><label>Kategori</label><select id="f_tcat">
        ${cats.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('')}
      </select></div>
    </div>
    <div style="display:flex;gap:8px;margin-top:16px;justify-content:flex-end">
      <button class="btn btn-ghost" onclick="closeModal()">Batal</button>
      <button class="btn btn-primary" onclick="addTx()">💾 Simpan</button>
    </div>`;
}
