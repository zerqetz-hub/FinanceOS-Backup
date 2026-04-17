// ── actions.edit-modal.js — edit modal dispatcher ────────────────────────────
// @requires api.js, state.js, helpers.js, ui.js
// @requires actions.cashflow.js, actions.assets.js, actions.debts.js,
//           actions.goals.js, actions.transactions.js
'use strict';

function openEditModal(type, id) {
  document.getElementById('modalOverlay').style.display = 'flex';
  const TITLES = {cashflow:'Edit Data Cash Flow', asset:'Edit Aset', debt:'Edit Hutang', goal:'Edit Goal', tx:'Edit Transaksi'};
  document.getElementById('modalTitle').textContent = TITLES[type] || 'Edit Data';
  let content = '';

  if (type === 'cashflow') {
    const cf = S.cashflows.find(c => c.id === id); if (!cf) return;
    // Income breakdown fields — same style as expense
    const incCats = getIncomeCats();
    const incFields = incCats.map(c =>
      `<div class="form-group"><label>${esc(c)} (Rp)</label>
       <input type="number" id="ef_inc_${esc(c)}" value="${(cf.incomeBreakdown&&cf.incomeBreakdown[c])||0}" min="0">
       <input type="text" id="ef_inc_note_${esc(c)}" value="${esc((cf.incomeNotes&&cf.incomeNotes[c])||'')}" placeholder="Catatan..." style="margin-top:4px;font-size:12px;color:var(--text2)">
       </div>`
    ).join('');
    // Expense breakdown fields
    const expFields = getCats().map(c =>
      `<div class="form-group"><label>${esc(c)} (Rp)</label>
       <input type="number" id="ef_exp_${esc(c)}" value="${cf.expenses[c]||0}" min="0">
       <input type="text" id="ef_exp_note_${esc(c)}" value="${esc((cf.expenseNotes&&cf.expenseNotes[c])||'')}" placeholder="Catatan..." style="margin-top:4px;font-size:12px;color:var(--text2)">
       </div>`
    ).join('');
    content = `<div class="form-grid">
      <div class="form-group"><label>Bulan</label><input type="month" id="ef_month" value="${cf.month}"></div>
      <div class="form-group"><label>Tanggal Input</label><input type="date" id="ef_date" value="${cf.dateAdded||''}"></div>
      <div class="form-group full"><label style="font-size:13px;font-weight:600;color:var(--text)">Pemasukan per Sumber</label></div>
      ${incFields}
      <div class="form-group full" style="border-top:1px solid var(--border);padding-top:12px;margin-top:4px"><label style="font-size:13px;font-weight:600;color:var(--text)">Pengeluaran per Kategori</label></div>
      ${expFields}
    </div>
    <div style="display:flex;gap:8px;margin-top:16px;justify-content:flex-end">
      <button class="btn btn-ghost" onclick="closeModal()">Batal</button>
      <button class="btn btn-primary" onclick="updateCashflow('${id}')">💾 Simpan Perubahan</button></div>`;

  } else if (type === 'asset') {
    const a = S.assets.find(a => a.id === id); if (!a) return;
    content = `<div class="form-grid">
      <div class="form-group full"><label>Nama Aset</label><input type="text" id="ef_aname" value="${esc(a.name)}"></div>
      <div class="form-group full"><label>Deskripsi</label><input type="text" id="ef_asub" value="${esc(a.sub||'')}"></div>
      <div class="form-group"><label>Jenis Aset</label><select id="ef_atype">
        <option value="Stock" ${a.type==='Stock'?'selected':''}>Saham</option>
        <option value="Crypto" ${a.type==='Crypto'?'selected':''}>Crypto</option>
        <option value="Property" ${a.type==='Property'?'selected':''}>Properti</option>
        <option value="Gold" ${a.type==='Gold'?'selected':''}>Emas / Silver</option>
        <option value="MutualFund" ${a.type==='MutualFund'?'selected':''}>Reksa Dana</option>
        <option value="Bond" ${a.type==='Bond'?'selected':''}>Obligasi</option>
        <option value="Cash" ${a.type==='Cash'?'selected':''}>Kas / Tabungan</option>
        <option value="Other" ${a.type==='Other'?'selected':''}>Lainnya</option>
      </select></div>
      <div class="form-group"><label>Tanggal Pembelian</label><input type="date" id="ef_adate" value="${a.dateAdded||''}"></div>
      <div class="form-group"><label>Modal Awal (Rp)</label><input type="number" id="ef_acost" value="${a.cost}" min="0"></div>
      <div class="form-group"><div style="font-size:12px;font-weight:500;color:var(--text2);margin-bottom:4px">Nilai Terkini</div>
        <div style="font-size:14px;font-weight:600;color:var(--accent);padding:8px 0">${fmtS(a.value)}</div>
        <div style="font-size:11px;color:var(--text3)">Dikelola via 📈 Update Harga</div></div>
    </div>
    <div style="display:flex;gap:8px;margin-top:16px;justify-content:flex-end">
      <button class="btn btn-ghost" onclick="closeModal()">Batal</button>
      <button class="btn btn-primary" onclick="updateAsset('${id}')">💾 Simpan Perubahan</button></div>`;

  } else if (type === 'debt') {
    const d = S.debts.find(d => d.id === id); if (!d) return;
    content = `<div class="form-grid">
      <div class="form-group full"><label>Nama Hutang</label><input type="text" id="ef_dname" value="${esc(d.name)}"></div>
      <div class="form-group"><label>Jenis</label><select id="ef_dtype">
        <option value="Long-term" ${d.type==='Long-term'?'selected':''}>Long-term (jangka panjang)</option>
        <option value="Short-term" ${d.type==='Short-term'?'selected':''}>Short-term (jangka pendek)</option>
        <option value="Installment" ${d.type==='Installment'?'selected':''}>Installment (cicilan)</option>
        <option value="Credit" ${d.type==='Credit'?'selected':''}>Credit Card</option>
        <option value="Other" ${d.type==='Other'?'selected':''}>Lainnya</option>
      </select></div>
      <div class="form-group"><label>Bunga (%/tahun)</label><input type="number" id="ef_dbunga" value="${d.bunga}" step="0.1" min="0"></div>
      <div class="form-group"><label>Total Hutang (Rp)</label><input type="number" id="ef_dtotal" value="${d.total}" min="0"></div>
      <div class="form-group"><div style="font-size:12px;font-weight:500;color:var(--text2);margin-bottom:4px">Sisa Hutang</div>
        <div style="font-size:14px;font-weight:600;color:var(--red);padding:8px 0">${fmtS(d.sisa)}</div>
        <div style="font-size:11px;color:var(--text3)">Dikelola via 📉 Update Saldo</div></div>
      <div class="form-group"><label>Cicilan/Bulan (Rp)</label><input type="number" id="ef_dcicilan" value="${d.cicilan}" min="0"></div>
      <div class="form-group"><label>Jatuh Tempo</label><input type="date" id="ef_djatuh" value="${d.jatuh&&d.jatuh!=='—'?d.jatuh:''}"></div>
      <div class="form-group"><label>Tanggal Input</label><input type="date" id="ef_ddate" value="${d.dateAdded||''}"></div>
    </div>
    <div style="display:flex;gap:8px;margin-top:16px;justify-content:flex-end">
      <button class="btn btn-ghost" onclick="closeModal()">Batal</button>
      <button class="btn btn-primary" onclick="updateDebt('${id}')">💾 Simpan Perubahan</button></div>`;

  } else if (type === 'goal') {
    const g = S.goals.find(g => g.id === id); if (!g) return;
    content = `<div class="form-grid">
      <div class="form-group full"><label>Nama Goal</label><input type="text" id="ef_gname" value="${esc(g.name)}"></div>
      <div class="form-group"><label>Target (Rp)</label><input type="number" id="ef_gtarget" value="${g.target}" min="0"></div>
      <div class="form-group"><label>Terkumpul (Rp)</label><input type="number" id="ef_gcurrent" value="${g.current}" min="0"></div>
      <div class="form-group"><label>Target Waktu</label><input type="month" id="ef_gdeadline" value="${g.deadline||''}"></div>
      <div class="form-group"><label>Warna</label><select id="ef_gcolor">
        <option value="#1a6b4a" ${g.color==='#1a6b4a'?'selected':''}>Hijau</option>
        <option value="#1a5ba6" ${g.color==='#1a5ba6'?'selected':''}>Biru</option>
        <option value="#5a3fb5" ${g.color==='#5a3fb5'?'selected':''}>Ungu</option>
        <option value="#c45c1a" ${g.color==='#c45c1a'?'selected':''}>Oranye</option>
        <option value="#c23b3b" ${g.color==='#c23b3b'?'selected':''}>Merah</option>
      </select></div>
      <div class="form-group"><label>Tanggal Mulai</label><input type="date" id="ef_gdate" value="${g.dateAdded||''}"></div>
    </div>
    <div style="display:flex;gap:8px;margin-top:16px;justify-content:flex-end">
      <button class="btn btn-ghost" onclick="closeModal()">Batal</button>
      <button class="btn btn-primary" onclick="updateGoal('${id}')">💾 Simpan Perubahan</button></div>`;

  } else if (type === 'tx') {
    const t = S.transactions.find(t => t.id === id); if (!t) return;
    const isIn = t.amount > 0; const allCats = isIn ? getIncomeCats() : getCats();
    const catName = t.catName || 'Lainnya';
    content = `<div class="form-grid">
      <div class="form-group full"><label>Nama Transaksi</label><input type="text" id="ef_tname" value="${esc(t.name)}"></div>
      <div class="form-group"><label>Jumlah (Rp)</label><input type="number" id="ef_tamt" value="${Math.abs(t.amount)}" min="0"></div>
      <div class="form-group"><label>Jenis</label><select id="ef_ttype" onchange="updateEditTxCat(this.value,'${id}')">
        <option value="out" ${!isIn?'selected':''}>Pengeluaran (−)</option>
        <option value="in" ${isIn?'selected':''}>Pemasukan (+)</option>
      </select></div>
      <div class="form-group"><label>Tanggal</label><input type="date" id="ef_tdate" value="${t.dateAdded||''}"></div>
      <div class="form-group full"><label>Kategori</label><select id="ef_tcat">
        ${allCats.map(c => `<option value="${esc(c)}" ${c===catName?'selected':''}>${esc(c)}</option>`).join('')}
      </select></div>
      <div class="form-group full"><label>Catatan</label><input type="text" id="ef_tnotes" value="${esc(t.notes||'')}"></div>
    </div>
    <div style="display:flex;gap:8px;margin-top:16px;justify-content:flex-end">
      <button class="btn btn-ghost" onclick="closeModal()">Batal</button>
      <button class="btn btn-primary" onclick="updateTx('${id}')">💾 Simpan Perubahan</button></div>`;
  }
  document.getElementById('modalContent').innerHTML = content;
}
