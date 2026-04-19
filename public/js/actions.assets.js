// ── actions.assets.js — asset CRUD + price history v5.4
// Fix #15: bug saat menambah aset — priceHistory key fix (value vs price)
'use strict';

async function addAsset() {
  await withSubmitLock(async () => {
    const name = v('f_aname').trim();
    if (!name) { showFormError('Nama aset wajib diisi.'); return; }
    const id = uid();
    const dateAdded = v('f_adate') || new Date().toISOString().slice(0,10);
    const cost = vn('f_acost');
    const val  = vn('f_aval');
    const today = new Date().toISOString().slice(0,10);
    // Seed price history: start with purchase price at dateAdded.
    // If current value differs from cost and date is different, add today's entry.
    // When dateAdded === today, avoid duplicate-date conflict in DB by updating
    // the single entry's value to the current val instead.
    const priceHistory = [{ date: dateAdded, value: cost }];
    if (val !== cost && val > 0) {
      if (today !== dateAdded) {
        priceHistory.push({ date: today, value: val });
      } else {
        priceHistory[0].value = val; // same date: reflect current value
      }
    }
    const newA = {
      id, name,
      sub: v('f_asub').trim() || '—',
      type: v('f_atype'),
      value: val || cost,
      cost,
      dateAdded,
      priceHistory,
    };
    S.assets.push(newA); closeModal(); renderAll();
    try {
      const _r = await API.post('/api/assets', newA);
      if (_r?.error) throw new Error(_r.error); flashSave();
      pushCommand('Tambah aset ' + name,
        async () => { S.assets = S.assets.filter(a => a.id !== id); await API.del('/api/assets/' + id); },
        async () => { S.assets.push(newA); await API.post('/api/assets', newA); }
      );
      showToast('Aset "' + name + '" ditambahkan', 'success');
    } catch(e) { S.assets = S.assets.filter(a => a.id !== id); renderAll(); showToast((e?.message||'Gagal menyimpan ke server'),'error'); }
  });
}

async function updateAsset(id) {
  const a = S.assets.find(a => a.id === id); if (!a) return;
  const _prev = JSON.parse(JSON.stringify(a));
  a.name = v('ef_aname').trim() || a.name;
  a.sub  = v('ef_asub').trim() || a.sub;
  a.type = v('ef_atype') || a.type;
  a.cost = vn('ef_acost');
  a.dateAdded = v('ef_adate') || a.dateAdded;
  const _next = JSON.parse(JSON.stringify(a));
  closeModal(); renderAll();
  try {
    const _r = await API.put('/api/assets/' + id, a);
    if (_r?.error) throw new Error(_r.error); flashSave();
    pushCommand('Edit aset ' + a.name,
      async () => { Object.assign(S.assets.find(x=>x.id===id)||{},_prev); await API.put('/api/assets/'+id,_prev); },
      async () => { Object.assign(S.assets.find(x=>x.id===id)||{},_next); await API.put('/api/assets/'+id,_next); }
    );
    showToast('Aset "' + a.name + '" berhasil diperbarui', 'success');
  } catch(e) { Object.assign(a, _prev); renderAll(); showToast((e?.message||'Gagal menyimpan ke server'),'error'); }
}

function openPriceUpdateModal(assetId) {
  const a = S.assets.find(x => x.id === assetId); if (!a) return;
  document.getElementById('modalOverlay').style.display = 'flex';
  document.getElementById('modalTitle').textContent = '📈 Update Nilai: ' + a.name;
  const today = new Date().toISOString().slice(0,10);
  const hist = (a.priceHistory || []).slice().sort((x,y) => x.date.localeCompare(y.date));
  const histRows = hist.length
    ? hist.map((h,i) => '<tr><td style="font-size:12px;color:var(--text2)">' + h.date + '</td>' +
        '<td style="font-size:12px;text-align:right">' + fmtS(h.value) + '</td>' +
        '<td style="text-align:right"><button class="btn-delete" onclick="deletePriceEntry(\'' + assetId + '\',' + i + ')" title="Hapus">🗑</button></td></tr>').join('')
    : '<tr><td colspan="3" style="color:var(--text3);font-size:12px;padding:8px 0">Belum ada riwayat nilai</td></tr>';
  document.getElementById('modalContent').innerHTML =
    '<div style="margin-bottom:16px"><div class="section-title" style="margin-bottom:8px">Riwayat Nilai Aset</div>' +
    '<div class="table-wrap" style="max-height:180px;overflow-y:auto"><table><thead><tr><th>Tanggal</th><th class="text-right">Nilai (Rp)</th><th></th></tr></thead><tbody id="priceHistRows">' + histRows + '</tbody></table></div></div>' +
    '<div style="background:var(--surface2);border-radius:var(--radius-sm);padding:14px;margin-bottom:12px">' +
    '<div class="section-title" style="margin-bottom:10px">Tambah Data Nilai Baru</div>' +
    '<div class="form-grid"><div class="form-group"><label>Tanggal Update</label><input type="date" id="ph_date" value="' + today + '"></div>' +
    '<div class="form-group"><label>Nilai Aset (Rp)</label><input type="number" id="ph_value" placeholder="0" min="0" inputmode="decimal" value="' + a.value + '"></div></div></div>' +
    '<div style="display:flex;gap:8px;justify-content:flex-end"><button class="btn btn-ghost" onclick="closeModal()">Tutup</button>' +
    '<button class="btn btn-primary" onclick="savePriceEntry(\'' + assetId + '\')">💾 Tambah Data</button></div>';
  // Enter key
  setTimeout(() => {
    const inp = document.getElementById('ph_value');
    if (inp) inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); savePriceEntry(assetId); } });
  }, 0);
}

async function savePriceEntry(assetId) {
  const a = S.assets.find(x => x.id === assetId); if (!a) return;
  const date = v('ph_date'); const val = vn('ph_value');
  if (!date) { showFormError('Tanggal wajib diisi.'); return; }
  const _prev = JSON.parse(JSON.stringify(a));
  if (!a.priceHistory) a.priceHistory = [];
  a.priceHistory = a.priceHistory.filter(h => h.date !== date);
  a.priceHistory.push({ date, value: val });
  a.priceHistory.sort((x,y) => x.date.localeCompare(y.date));
  a.value = a.priceHistory[a.priceHistory.length - 1].value;
  const _next = JSON.parse(JSON.stringify(a));
  renderAll();
  try {
    const _r = await API.put('/api/assets/' + assetId, a);
    if (_r?.error) throw new Error(_r.error); flashSave();
    pushCommand('Update nilai ' + a.name + ' ' + date,
      async () => { Object.assign(S.assets.find(x=>x.id===assetId)||{},_prev); await API.put('/api/assets/'+assetId,_prev); },
      async () => { Object.assign(S.assets.find(x=>x.id===assetId)||{},_next); await API.put('/api/assets/'+assetId,_next); }
    );
    showToast('Nilai ' + a.name + ' per ' + date + ' disimpan', 'success');
  } catch(e) { Object.assign(a,_prev); renderAll(); showToast((e?.message||'Gagal menyimpan ke server'),'error'); }
  openPriceUpdateModal(assetId);
}

async function deletePriceEntry(assetId, idx) {
  const a = S.assets.find(x => x.id === assetId); if (!a || !a.priceHistory) return;
  const _prev = JSON.parse(JSON.stringify(a));
  a.priceHistory.splice(idx, 1);
  if (a.priceHistory.length) {
    const sorted = [...a.priceHistory].sort((x,y) => x.date.localeCompare(y.date));
    a.value = sorted[sorted.length-1].value;
  } else {
    a.value = a.cost; // no history left — fall back to purchase price
  }
  const _next = JSON.parse(JSON.stringify(a));
  renderAll();
  try {
    const _r = await API.put('/api/assets/' + assetId, a);
    if (_r?.error) throw new Error(_r.error); flashSave();
    pushCommand('Hapus nilai ' + a.name,
      async () => { Object.assign(S.assets.find(x=>x.id===assetId)||{},_prev); await API.put('/api/assets/'+assetId,_prev); },
      async () => { Object.assign(S.assets.find(x=>x.id===assetId)||{},_next); await API.put('/api/assets/'+assetId,_next); }
    );
  } catch(e) { Object.assign(a,_prev); renderAll(); showToast((e?.message||'Gagal menyimpan ke server'),'error'); }
  openPriceUpdateModal(assetId);
}

// ── TOP UP MODAL ──────────────────────────────────────────────────────────────
// Menambah modal (investasi baru) ke aset yang sudah ada.
// Cost naik = jumlah beli, value naik = jumlah beli, priceHistory terupdate.
// Berbeda dari "Update Nilai" yang hanya update harga pasar tanpa menyentuh cost.

function openTopUpModal(assetId) {
  const a = S.assets.find(x => x.id === assetId); if (!a) return;
  document.getElementById('modalOverlay').style.display = 'flex';
  document.getElementById('modalTitle').textContent = '💰 Tambah Modal: ' + a.name;
  document.getElementById('modalContent').innerHTML =
    '<div style="background:var(--surface2);border-radius:var(--radius-sm);padding:12px;margin-bottom:14px;font-size:13px">' +
    '<strong>' + esc(a.name) + '</strong> &nbsp;·&nbsp; Modal saat ini: <strong>' + fmtS(a.cost) +
    '</strong> &nbsp;·&nbsp; Nilai pasar: <strong>' + fmtS(a.value) + '</strong></div>' +
    '<div class="form-grid">' +
    '<div class="form-group"><label>Tanggal Pembelian</label><input type="date" id="tu_date" value="' + new Date().toISOString().slice(0,10) + '"></div>' +
    '<div class="form-group"><label>Jumlah Modal Tambahan (Rp)</label><input type="number" id="tu_amount" placeholder="0" min="1" inputmode="decimal" autofocus></div>' +
    '</div>' +
    '<div style="font-size:12px;color:var(--text3);margin-bottom:14px">Modal dan nilai pasar aset akan naik sejumlah ini. Gunakan <strong>Update Nilai</strong> untuk update harga pasar saja.</div>' +
    '<div style="display:flex;gap:8px;justify-content:flex-end">' +
    '<button class="btn btn-ghost" onclick="closeModal()">Batal</button>' +
    '<button class="btn btn-primary" onclick="executeTopUp(\'' + assetId + '\')">💰 Tambah Modal</button>' +
    '</div>';
  setTimeout(() => {
    const inp = document.getElementById('tu_amount');
    if (inp) inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); executeTopUp(assetId); } });
  }, 0);
}

async function executeTopUp(assetId) {
  const a = S.assets.find(x => x.id === assetId); if (!a) return;
  const amount = vn('tu_amount');
  const date   = v('tu_date') || new Date().toISOString().slice(0,10);
  if (!amount || amount <= 0) { showFormError('Jumlah modal tambahan harus lebih dari 0.'); return; }
  const _prev = JSON.parse(JSON.stringify(a));
  a.cost  += amount;
  a.value += amount;
  if (!a.priceHistory) a.priceHistory = [];
  a.priceHistory = a.priceHistory.filter(h => h.date !== date);
  a.priceHistory.push({ date, value: a.value });
  a.priceHistory.sort((x,y) => x.date.localeCompare(y.date));
  const _next = JSON.parse(JSON.stringify(a));
  closeModal(); renderAll();
  try {
    const _r = await API.put('/api/assets/' + assetId, a);
    if (_r?.error) throw new Error(_r.error); flashSave();
    pushCommand('Top up ' + a.name + ' ' + date,
      async () => { Object.assign(S.assets.find(x=>x.id===assetId)||{},_prev); await API.put('/api/assets/'+assetId,_prev); renderAll(); },
      async () => { Object.assign(S.assets.find(x=>x.id===assetId)||{},_next); await API.put('/api/assets/'+assetId,_next); renderAll(); }
    );
    showToast('Modal ' + a.name + ' ditambah ' + fmtS(amount), 'success');
  } catch(e) { Object.assign(a,_prev); renderAll(); showToast((e?.message||'Gagal menyimpan ke server'),'error'); }
}

// ── TRANSFER DANA ─────────────────────────────────────────────────────────────
// Memindahkan dana dari satu aset ke aset lain (atau aset baru).
// Cost basis source dikurangi secara proporsional sehingga return tidak berubah.

function openTransferModal(assetId) {
  const a = S.assets.find(x => x.id === assetId); if (!a) return;
  document.getElementById('modalOverlay').style.display = 'flex';
  document.getElementById('modalTitle').textContent = '🔄 Transfer Dana: ' + a.name;
  const others = S.assets.filter(x => x.id !== assetId);
  const otherOpts = others.map(x =>
    '<option value="' + x.id + '">' + esc(x.name) + ' (' + fmtS(x.value) + ')</option>'
  ).join('');
  const typeOpts = Object.entries(TYPE_NAMES).map(([k,v]) =>
    '<option value="' + k + '">' + v + '</option>'
  ).join('');
  document.getElementById('modalContent').innerHTML =
    '<div style="background:var(--surface2);border-radius:var(--radius-sm);padding:12px;margin-bottom:14px;font-size:13px">' +
    '<strong>' + esc(a.name) + '</strong> &nbsp;·&nbsp; Nilai: <strong>' + fmtS(a.value) +
    '</strong> &nbsp;·&nbsp; Modal: <strong>' + fmtS(a.cost) + '</strong></div>' +
    '<div class="form-grid"><div class="form-group"><label>Jumlah Transfer (Rp)</label>' +
    '<input type="number" id="tr_amount" placeholder="0" min="1" inputmode="decimal"></div></div>' +
    '<div class="form-group" style="margin-bottom:14px"><label>Tujuan Transfer</label>' +
    '<select id="tr_target_type" onchange="_toggleTransferTarget()">' +
    '<option value="existing">Aset yang sudah ada</option>' +
    '<option value="new">Buat aset baru</option>' +
    '</select></div>' +
    '<div id="tr_existing_wrap">' +
    (others.length
      ? '<div class="form-group"><label>Pilih Aset Tujuan</label><select id="tr_target_id">' + otherOpts + '</select></div>'
      : '<div style="color:var(--text3);font-size:13px;padding:4px 0 8px">Tidak ada aset lain — gunakan opsi "Buat aset baru".</div>') +
    '</div>' +
    '<div id="tr_new_wrap" style="display:none">' +
    '<div class="form-grid">' +
    '<div class="form-group"><label>Nama Aset Baru</label><input type="text" id="tr_new_name" placeholder="Nama aset"></div>' +
    '<div class="form-group"><label>Jenis</label><select id="tr_new_type">' + typeOpts + '</select></div>' +
    '</div></div>' +
    '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px">' +
    '<button class="btn btn-ghost" onclick="closeModal()">Batal</button>' +
    '<button class="btn btn-primary" onclick="executeTransfer(\'' + assetId + '\')">🔄 Transfer</button>' +
    '</div>';
  setTimeout(() => { const inp = document.getElementById('tr_amount'); if (inp) inp.focus(); }, 0);
}

function _toggleTransferTarget() {
  const t = v('tr_target_type');
  const exWrap = document.getElementById('tr_existing_wrap');
  const newWrap = document.getElementById('tr_new_wrap');
  if (exWrap) exWrap.style.display = t === 'existing' ? '' : 'none';
  if (newWrap) newWrap.style.display = t === 'new' ? '' : 'none';
}

async function executeTransfer(sourceId) {
  const source = S.assets.find(x => x.id === sourceId); if (!source) return;
  const amount = vn('tr_amount');
  if (!amount || amount <= 0) { showFormError('Jumlah transfer harus lebih dari 0.'); return; }
  if (amount > source.value) { showFormError('Jumlah transfer melebihi nilai aset (' + fmtS(source.value) + ').'); return; }

  const targetType = v('tr_target_type');
  const today = new Date().toISOString().slice(0,10);

  // Kurangi cost basis source secara proporsional agar return tidak berubah.
  // Math.max(0, ...) mencegah nilai negatif akibat floating-point rounding.
  const costReduction = source.cost > 0 ? source.cost * (amount / source.value) : 0;
  const _prevSource = JSON.parse(JSON.stringify(source));
  source.value = Math.max(0, source.value - amount);
  source.cost  = Math.max(0, source.cost  - costReduction);
  if (!source.priceHistory) source.priceHistory = [];
  source.priceHistory = source.priceHistory.filter(h => h.date !== today);
  source.priceHistory.push({ date: today, value: source.value });
  source.priceHistory.sort((x,y) => x.date.localeCompare(y.date));
  const _nextSource = JSON.parse(JSON.stringify(source));

  let target = null;
  let newTargetId = null;

  if (targetType === 'existing') {
    const targetId = v('tr_target_id');
    if (!targetId) { showFormError('Pilih aset tujuan.'); Object.assign(source, _prevSource); return; }
    target = S.assets.find(x => x.id === targetId);
    if (!target) { showFormError('Aset tujuan tidak ditemukan.'); Object.assign(source, _prevSource); return; }
  } else {
    const newName = (v('tr_new_name') || '').trim();
    if (!newName) { showFormError('Nama aset baru wajib diisi.'); Object.assign(source, _prevSource); return; }
    newTargetId = uid();
    target = { id: newTargetId, name: newName, sub: '—', type: v('tr_new_type') || 'Stock',
                value: 0, cost: 0, dateAdded: today, priceHistory: [] };
    S.assets.push(target);
  }

  const _prevTarget = JSON.parse(JSON.stringify(target));
  target.value += amount;
  target.cost  += costReduction; // cost basis proporsional dari sumber ikut berpindah, bukan nilai pasar
  if (!target.priceHistory) target.priceHistory = [];
  target.priceHistory = target.priceHistory.filter(h => h.date !== today);
  target.priceHistory.push({ date: today, value: target.value });
  target.priceHistory.sort((x,y) => x.date.localeCompare(y.date));
  const _nextTarget = JSON.parse(JSON.stringify(target));
  const targetId = target.id;
  const sourceName = source.name; const targetName = target.name;

  closeModal(); renderAll();

  try {
    const ops = [API.put('/api/assets/' + sourceId, source)];
    ops.push(newTargetId ? API.post('/api/assets', target) : API.put('/api/assets/' + targetId, target));
    const results = await Promise.all(ops);
    if (results.some(r => r?.error)) throw new Error(results.find(r => r?.error)?.error);
    flashSave();
    pushCommand('Transfer ' + sourceName + ' → ' + targetName,
      async () => {
        Object.assign(S.assets.find(x => x.id === sourceId) || {}, _prevSource);
        await API.put('/api/assets/' + sourceId, _prevSource);
        if (newTargetId) {
          S.assets = S.assets.filter(x => x.id !== newTargetId);
          await API.del('/api/assets/' + newTargetId);
        } else {
          Object.assign(S.assets.find(x => x.id === targetId) || {}, _prevTarget);
          await API.put('/api/assets/' + targetId, _prevTarget);
        }
      },
      async () => {
        Object.assign(S.assets.find(x => x.id === sourceId) || {}, _nextSource);
        await API.put('/api/assets/' + sourceId, _nextSource);
        if (newTargetId) {
          const existing = S.assets.find(x => x.id === newTargetId);
          if (existing) Object.assign(existing, _nextTarget); else S.assets.push(_nextTarget);
          await API.post('/api/assets', _nextTarget);
        } else {
          Object.assign(S.assets.find(x => x.id === targetId) || {}, _nextTarget);
          await API.put('/api/assets/' + targetId, _nextTarget);
        }
      }
    );
    showToast('Transfer ' + fmtS(amount) + ' dari "' + esc(sourceName) + '" ke "' + esc(targetName) + '" berhasil 🔄', 'success');
  } catch(e) {
    Object.assign(source, _prevSource);
    if (newTargetId) S.assets = S.assets.filter(x => x.id !== newTargetId);
    else Object.assign(S.assets.find(x => x.id === targetId) || {}, _prevTarget);
    renderAll();
    showToast((e?.message || 'Gagal menyimpan ke server'), 'error');
  }
}
