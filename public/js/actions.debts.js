// ── actions.debts.js — debt CRUD + balance history ───────────────────────────
// @requires api.js, state.js, helpers.js, ui.js, render.js
'use strict';

async function addDebt() {
  await withSubmitLock(async () => {
    const name = v('f_dname').trim();
    if (!name) { showFormError('Nama hutang wajib diisi.'); return; }
    const id = uid(); const dateAdded = v('f_ddate') || new Date().toISOString().slice(0,10);
    const total = vn('f_dtotal'); const sisa = vn('f_dsisa');
    const balanceHistory = [{date: dateAdded, sisa: total}];
    if (sisa !== total) balanceHistory.push({date: new Date().toISOString().slice(0,10), sisa});
    const newD = {id, name, type:v('f_dtype'), total, sisa, bunga:vn('f_dbunga'), cicilan:vn('f_dcicilan'), jatuh:v('f_djatuh')||'—', dateAdded, balanceHistory};
    S.debts.push(newD); closeModal(); renderAll();
    try {
      const _r = await API.post('/api/debts', newD);
      if (_r?.error) throw new Error(_r.error); flashSave();
      pushCommand(`Tambah hutang ${name}`,
        async () => { S.debts = S.debts.filter(d => d.id !== id); await API.del(`/api/debts/${id}`); },
        async () => { S.debts.push(newD); await API.post('/api/debts', newD); }
      );
      showToast(`Hutang "${name}" ditambahkan`, 'success');
    } catch(e) { S.debts = S.debts.filter(d => d.id !== id); renderAll(); showToast((e?.message || 'Gagal menyimpan ke server'), 'error'); }
  });
}

async function updateDebt(id) {
  const d = S.debts.find(d => d.id === id); if (!d) return;
  const _prev = JSON.parse(JSON.stringify(d));
  d.name = v('ef_dname').trim() || d.name; d.type = v('ef_dtype') || d.type;
  d.bunga = vn('ef_dbunga'); d.total = vn('ef_dtotal');
  d.cicilan = vn('ef_dcicilan'); d.jatuh = v('ef_djatuh') || d.jatuh;
  d.dateAdded = v('ef_ddate') || d.dateAdded;
  const _next = JSON.parse(JSON.stringify(d));
  closeModal(); renderAll();
  try {
    const _r = await API.put(`/api/debts/${id}`, d);
    if (_r?.error) throw new Error(_r.error); flashSave();
    pushCommand(`Edit hutang ${d.name}`,
      async () => { Object.assign(S.debts.find(x => x.id === id)||{}, _prev); await API.put(`/api/debts/${id}`, _prev); },
      async () => { Object.assign(S.debts.find(x => x.id === id)||{}, _next); await API.put(`/api/debts/${id}`, _next); }
    );
    showToast(`Hutang "${d.name}" berhasil diperbarui`, 'success');
  } catch(e) { Object.assign(d, _prev); renderAll(); showToast((e?.message || 'Gagal menyimpan ke server'), 'error'); }
}

function openBalanceUpdateModal(debtId) {
  const d = S.debts.find(x => x.id === debtId); if (!d) return;
  document.getElementById('modalOverlay').style.display = 'flex';
  document.getElementById('modalTitle').textContent = `📉 Update Saldo: ${d.name}`;
  const today = new Date().toISOString().slice(0,10);
  const hist = (d.balanceHistory || []).slice().sort((x,y) => x.date.localeCompare(y.date));
  const histRows = hist.length
    ? hist.map((h,i) => `<tr>
        <td style="font-size:12px;color:var(--text2)">${h.date}</td>
        <td style="font-size:12px;text-align:right;color:var(--red)">${fmtS(h.sisa)}</td>
        <td style="text-align:right"><button class="btn-delete" onclick="deleteBalanceEntry('${debtId}',${i})" title="Hapus">🗑</button></td>
      </tr>`).join('')
    : '<tr><td colspan="3" style="color:var(--text3);font-size:12px;padding:8px 0">Belum ada riwayat saldo</td></tr>';
  document.getElementById('modalContent').innerHTML = `
    <div style="margin-bottom:16px">
      <div class="section-title" style="margin-bottom:8px">Riwayat Sisa Hutang</div>
      <div class="table-wrap" style="max-height:180px;overflow-y:auto">
        <table><thead><tr><th>Tanggal</th><th class="text-right">Sisa (Rp)</th><th></th></tr></thead>
        <tbody id="balHistRows">${histRows}</tbody></table>
      </div>
    </div>
    <div style="background:var(--surface2);border-radius:var(--radius-sm);padding:14px;margin-bottom:12px">
      <div class="section-title" style="margin-bottom:10px">Tambah Data Saldo Baru</div>
      <div class="form-grid">
        <div class="form-group"><label>Tanggal Update</label><input type="date" id="bh_date" value="${today}"></div>
        <div class="form-group"><label>Sisa Hutang (Rp)</label><input type="number" id="bh_sisa" placeholder="0" min="0" value="${d.sisa}"></div>
      </div>
    </div>
    <div style="display:flex;gap:8px;justify-content:flex-end">
      <button class="btn btn-ghost" onclick="closeModal()">Tutup</button>
      <button class="btn btn-primary" onclick="saveBalanceEntry('${debtId}')">💾 Tambah Data</button>
    </div>`;
}

async function saveBalanceEntry(debtId) {
  const d = S.debts.find(x => x.id === debtId); if (!d) return;
  const date = v('bh_date'); const sisa = vn('bh_sisa');
  if (!date) { showFormError('Tanggal wajib diisi.'); return; }
  const _prev = JSON.parse(JSON.stringify(d));
  if (!d.balanceHistory) d.balanceHistory = [];
  d.balanceHistory = d.balanceHistory.filter(h => h.date !== date);
  d.balanceHistory.push({date, sisa});
  d.balanceHistory.sort((x,y) => x.date.localeCompare(y.date));
  d.sisa = d.balanceHistory[d.balanceHistory.length - 1].sisa;
  const _next = JSON.parse(JSON.stringify(d));
  renderAll();
  try {
    const _r = await API.put(`/api/debts/${debtId}`, d);
    if (_r?.error) throw new Error(_r.error); flashSave();
    pushCommand(`Update saldo ${d.name} ${date}`,
      async () => { Object.assign(S.debts.find(x=>x.id===debtId)||{},_prev); await API.put(`/api/debts/${debtId}`,_prev); },
      async () => { Object.assign(S.debts.find(x=>x.id===debtId)||{},_next); await API.put(`/api/debts/${debtId}`,_next); }
    );
    showToast(`Saldo ${d.name} per ${date} disimpan`, 'success');
  } catch(e) { Object.assign(d,_prev); renderAll(); showToast((e?.message||'Gagal menyimpan ke server'),'error'); }
  openBalanceUpdateModal(debtId);
}

async function deleteBalanceEntry(debtId, idx) {
  const d = S.debts.find(x => x.id === debtId); if (!d || !d.balanceHistory) return;
  const _prev = JSON.parse(JSON.stringify(d));
  d.balanceHistory.splice(idx, 1);
  if (d.balanceHistory.length) {
    const sorted = [...d.balanceHistory].sort((x,y) => x.date.localeCompare(y.date));
    d.sisa = sorted[sorted.length-1].sisa;
  }
  const _next = JSON.parse(JSON.stringify(d));
  renderAll();
  try {
    const _r = await API.put(`/api/debts/${debtId}`, d);
    if (_r?.error) throw new Error(_r.error); flashSave();
    pushCommand(`Hapus saldo ${d.name}`,
      async () => { Object.assign(S.debts.find(x=>x.id===debtId)||{},_prev); await API.put(`/api/debts/${debtId}`,_prev); },
      async () => { Object.assign(S.debts.find(x=>x.id===debtId)||{},_next); await API.put(`/api/debts/${debtId}`,_next); }
    );
  } catch(e) { Object.assign(d,_prev); renderAll(); showToast((e?.message||'Gagal menyimpan ke server'),'error'); }
  openBalanceUpdateModal(debtId);
}
