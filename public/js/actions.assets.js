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
    '<div class="form-group"><label>Nilai Aset (Rp)</label><input type="number" id="ph_value" placeholder="0" min="0" value="' + a.value + '"></div></div></div>' +
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
