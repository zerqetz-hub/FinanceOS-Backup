// ── actions.cashflow.js — cashflow CRUD v5.4
// Fix: income detail tampil saat edit (incomeBreakdown editable seperti expenses)
// Fix: hapus field tanggal input dari cashflow (tidak berguna, #11)
// Fix: tambah field keterangan/notes untuk income & expense (#9)
// Fix: inline category management (#3)
'use strict';

async function addIncome() {
  await withSubmitLock(async () => {
    const month  = v('f_inc_month');
    const cat    = v('f_inc_cat');
    const amount = vn('f_inc_amount');
    const notes  = v('f_inc_notes') || '';
    if (!month || !amount) { showFormError('Bulan dan jumlah wajib diisi.'); return; }
    const existing = S.cashflows.find(c => c.month === month);
    if (existing) {
      const _prev = JSON.parse(JSON.stringify(existing));
      existing.income += amount;
      if (!existing.incomeBreakdown) existing.incomeBreakdown = {};
      existing.incomeBreakdown[cat] = (existing.incomeBreakdown[cat] || 0) + amount;
      if (!existing.incomeNotes) existing.incomeNotes = {};
      if (notes) existing.incomeNotes[cat] = notes;
      const _next = JSON.parse(JSON.stringify(existing));
      closeModal(); renderAll();
      try {
        const _r = await API.put('/api/cashflows/' + existing.id, existing);
        if (_r?.error) throw new Error(_r.error); flashSave();
        pushCommand('Tambah pemasukan ' + cat + ' ' + month,
          async () => { Object.assign(S.cashflows.find(c=>c.id===existing.id)||{},_prev); await API.put('/api/cashflows/'+existing.id,_prev); },
          async () => { Object.assign(S.cashflows.find(c=>c.id===existing.id)||{},_next); await API.put('/api/cashflows/'+existing.id,_next); }
        );
        showToast('Pemasukan ' + cat + ' ditambahkan ke ' + month, 'success');
      } catch(e) { Object.assign(existing, _prev); renderAll(); showToast((e?.message||'Gagal menyimpan ke server'),'error'); }
    } else {
      const id = uid(); const incomeBreakdown = {}; incomeBreakdown[cat] = amount;
      const incomeNotes = {}; if (notes) incomeNotes[cat] = notes;
      const expenses = {}; getCats().forEach(c => expenses[c] = 0);
      const dateAdded = new Date().toISOString().slice(0,10);
      const newCF = { id, month, income: amount, incomeBreakdown, incomeNotes, expenses, expenseNotes:{}, dateAdded };
      S.cashflows.push(newCF); closeModal(); renderAll();
      try {
        const _r = await API.post('/api/cashflows', newCF);
        if (_r?.error) throw new Error(_r.error); flashSave();
        pushCommand('Tambah pemasukan ' + cat + ' ' + month,
          async () => { S.cashflows = S.cashflows.filter(c=>c.id!==id); await API.del('/api/cashflows/'+id); },
          async () => { S.cashflows.push(newCF); await API.post('/api/cashflows', newCF); }
        );
        showToast('Pemasukan ' + cat + ' ditambahkan ke ' + month, 'success');
      } catch(e) { S.cashflows = S.cashflows.filter(c=>c.id!==id); renderAll(); showToast((e?.message||'Gagal menyimpan ke server'),'error'); }
    }
  });
}

async function addExpenseEntry() {
  await withSubmitLock(async () => {
    const month  = v('f_exp_month');
    const cat    = v('f_exp_cat');
    const amount = vn('f_exp_amount');
    const notes  = v('f_exp_notes') || '';
    if (!month || !cat || !amount) { showFormError('Bulan, kategori, dan jumlah wajib diisi.'); return; }
    const existing = S.cashflows.find(c => c.month === month);
    if (existing) {
      const _prev = JSON.parse(JSON.stringify(existing));
      existing.expenses[cat] = (existing.expenses[cat] || 0) + amount;
      if (!existing.expenseNotes) existing.expenseNotes = {};
      if (notes) existing.expenseNotes[cat] = notes;
      const _next = JSON.parse(JSON.stringify(existing));
      closeModal(); renderAll();
      try {
        const _r = await API.put('/api/cashflows/' + existing.id, existing);
        if (_r?.error) throw new Error(_r.error); flashSave();
        pushCommand('Tambah pengeluaran ' + cat + ' ' + month,
          async () => { Object.assign(S.cashflows.find(c=>c.id===existing.id)||{},_prev); await API.put('/api/cashflows/'+existing.id,_prev); },
          async () => { Object.assign(S.cashflows.find(c=>c.id===existing.id)||{},_next); await API.put('/api/cashflows/'+existing.id,_next); }
        );
      } catch(e) { Object.assign(existing, _prev); renderAll(); showToast((e?.message||'Gagal menyimpan ke server'),'error'); }
    } else {
      const id = uid(); const expenses = {}; getCats().forEach(c => expenses[c] = 0); expenses[cat] = amount;
      const expenseNotes = {}; if (notes) expenseNotes[cat] = notes;
      const dateAdded = new Date().toISOString().slice(0,10);
      const newCF = { id, month, income:0, incomeBreakdown:{}, incomeNotes:{}, expenses, expenseNotes, dateAdded };
      S.cashflows.push(newCF); closeModal(); renderAll();
      try {
        const _r = await API.post('/api/cashflows', newCF);
        if (_r?.error) throw new Error(_r.error); flashSave();
        pushCommand('Tambah pengeluaran ' + cat + ' ' + month,
          async () => { S.cashflows = S.cashflows.filter(c=>c.id!==id); await API.del('/api/cashflows/'+id); },
          async () => { S.cashflows.push(newCF); await API.post('/api/cashflows', newCF); }
        );
      } catch(e) { S.cashflows = S.cashflows.filter(c=>c.id!==id); renderAll(); showToast((e?.message||'Gagal menyimpan ke server'),'error'); }
    }
    showToast('Pengeluaran ' + cat + ' ditambahkan ke ' + month, 'success');
  });
}

async function updateCashflow(id) {
  const cf = S.cashflows.find(c => c.id === id); if (!cf) return;
  const _prev = JSON.parse(JSON.stringify(cf));
  cf.month  = v('ef_month') || cf.month;
  // Update income breakdown dari form (cf.income computed from breakdown below)
  if (!cf.incomeBreakdown) cf.incomeBreakdown = {};
  if (!cf.incomeNotes) cf.incomeNotes = {};
  getIncomeCats().forEach(c => {
    const amt = parseFloat(document.getElementById('ef_inc_' + c)?.value) || 0;
    const note = document.getElementById('ef_inc_note_' + c)?.value || '';
    if (amt > 0) { cf.incomeBreakdown[c] = amt; if (note) cf.incomeNotes[c] = note; }
    else { delete cf.incomeBreakdown[c]; delete cf.incomeNotes[c]; }
  });
  // Recalculate total income from breakdown
  const bdownTotal = Object.values(cf.incomeBreakdown).reduce((a,b) => a+b, 0);
  if (bdownTotal > 0) cf.income = bdownTotal;
  // Update expenses
  if (!cf.expenseNotes) cf.expenseNotes = {};
  getCats().forEach(c => {
    cf.expenses[c] = parseFloat(document.getElementById('ef_exp_' + c)?.value) || 0;
    const note = document.getElementById('ef_exp_note_' + c)?.value || '';
    if (note) cf.expenseNotes[c] = note; else delete cf.expenseNotes[c];
  });
  const _next = JSON.parse(JSON.stringify(cf));
  closeModal(); renderAll();
  try {
    const _r = await API.put('/api/cashflows/' + id, cf);
    if (_r?.error) throw new Error(_r.error); flashSave();
    pushCommand('Edit cash flow ' + cf.month,
      async () => { Object.assign(S.cashflows.find(c=>c.id===id)||{},_prev); await API.put('/api/cashflows/'+id,_prev); },
      async () => { Object.assign(S.cashflows.find(c=>c.id===id)||{},_next); await API.put('/api/cashflows/'+id,_next); }
    );
    showToast('Cash flow berhasil diperbarui', 'success');
  } catch(e) { Object.assign(cf, _prev); renderAll(); showToast((e?.message||'Gagal menyimpan ke server'),'error'); }
}

