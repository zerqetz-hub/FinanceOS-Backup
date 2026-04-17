'use strict';
// render.debts.js — renderDebts, markDebtLunas, restoreDebt

// ---- DEBTS ----
let _paidDebtOpen = false;
function togglePaidDebts() {
  _paidDebtOpen = !_paidDebtOpen;
  const el = document.getElementById('paidDebtList');
  const icon = document.getElementById('paidDebtToggleIcon');
  if (el) el.style.display = _paidDebtOpen ? 'block' : 'none';
  if (icon) icon.textContent = _paidDebtOpen ? '▾ Sembunyikan' : '▸ Tampilkan';
}

/** Mark a debt as paid and move it to the paid list. */
async function markDebtLunas(id) {
  const d = S.debts.find(x => x.id === id); if (!d) return;
  const ok = await showConfirm(`Tandai "${d.name}" lunas?`, 'Hutang ini akan dipindah ke Hutang Lunas.', 'Tandai Lunas');
  if (!ok) return;
  const _snapDebt = JSON.parse(JSON.stringify(d));
  const paidEntry = {...d, paidDate: new Date().toISOString().slice(0,10)};
  S.debts = S.debts.filter(x => x.id !== id);
  if (!S.paidDebts) S.paidDebts = [];
  S.paidDebts.push(paidEntry);
  renderAll();
  try {
    await API.del(`/api/debts/${id}`);
    await syncPaidDebts();
    flashSave();
    pushCommand(`Lunas: ${d.name}`,
      async () => {
        S.paidDebts = (S.paidDebts||[]).filter(x => x.id !== id);
        S.debts.push(_snapDebt);
        await API.post('/api/debts', _snapDebt);
        await syncPaidDebts();
      },
      async () => {
        S.debts = S.debts.filter(x => x.id !== id);
        S.paidDebts = [...(S.paidDebts||[]).filter(x=>x.id!==id), paidEntry];
        await API.del(`/api/debts/${id}`);
        await syncPaidDebts();
      }
    );
    showToast(`"${esc(d.name)}" ditandai lunas 🎉`, 'success');
  } catch(e) {
    S.debts.push(_snapDebt);
    S.paidDebts = (S.paidDebts||[]).filter(x => x.id !== id);
    renderAll();
    showToast(e?.message || 'Gagal menyimpan ke server', 'error');
  }
}

async function restoreDebt(id) {
  const d = (S.paidDebts||[]).find(x => x.id === id); if (!d) return;
  const {paidDate, ...restored} = d;
  S.paidDebts = S.paidDebts.filter(x => x.id !== id);
  S.debts.push(restored);
  renderAll();
  try {
    await API.post('/api/debts', restored);
    await syncPaidDebts();
    flashSave();
    pushCommand(`Pulihkan hutang: ${d.name}`,
      async () => {
        S.debts = S.debts.filter(x => x.id !== id);
        S.paidDebts = [...(S.paidDebts||[]).filter(x=>x.id!==id), d];
        await API.del(`/api/debts/${id}`);
        await syncPaidDebts();
      },
      async () => {
        S.paidDebts = (S.paidDebts||[]).filter(x => x.id !== id);
        S.debts.push(restored);
        await API.post('/api/debts', restored);
        await syncPaidDebts();
      }
    );
    showToast(`"${esc(d.name)}" dikembalikan ke hutang aktif`, 'success');
  } catch(e) {
    S.debts = S.debts.filter(x => x.id !== id);
    S.paidDebts = [...(S.paidDebts||[]).filter(x=>x.id!==id), d];
    renderAll();
    showToast(e?.message || 'Gagal menyimpan ke server', 'error');
  }
}

/** Render the debts page: metrics, active debts, paid debts, chart. */
function renderDebts() {
  const td = totalDebts(); const tc = totalCicilan();
  const cf = latestCF(); const dti = cf&&cf.income ? (tc/cf.income*100).toFixed(1) : '0.0';
  const DTYPE_C = {'Long-term':'badge-red','Short-term':'badge-amber','Installment':'badge-blue'};
  const paid = S.paidDebts || [];

  document.getElementById('debt-metrics').innerHTML = `
    <div class="card-sm"><div class="metric-label">Total Hutang Aktif</div><div class="metric-value c-red">${fmtS(td)}</div><div class="metric-sub">${S.debts.length} pinjaman aktif</div></div>
    <div class="card-sm"><div class="metric-label">Cicilan / Bulan</div><div class="metric-value">${fmtS(tc)}</div><div class="metric-sub">${dti}% dari income</div></div>
    <div class="card-sm"><div class="metric-label">Debt-to-Income</div><div class="metric-value ${+dti<40?'c-amber':'c-red'}">${dti}%</div><div class="metric-sub">${+dti<40?'Aman < 40%':'Perhatikan!'}</div></div>`;

  if (!S.debts.length) { document.getElementById('debtList').innerHTML='<div class="empty-state"><div class="icon">✅</div>Tidak ada hutang aktif. Bebas hutang!</div>'; }
  else {
    document.getElementById('debtList').innerHTML = S.debts.map(d => {
      const projSisa = getProjectedSisa(d);
      const hasInterest = +d.bunga > 0 && Math.abs(projSisa - +d.sisa) >= 1;
      const paidPct = d.total > 0 ? Math.max(0, Math.round((1 - projSisa / d.total) * 100)) : 0;
      const sisaHtml = hasInterest
        ? `<strong class="c-red">${fmtS(projSisa)}</strong><span style="font-size:10px;color:var(--text3);margin-left:3px">(+bunga)</span>`
        : `<strong class="c-red">${fmtS(d.sisa)}</strong>`;
      return `<div class="debt-item">
        <div class="debt-header">
          <div><div class="debt-name">${esc(d.name)}</div>
            <div class="debt-meta"><span>Cicilan: ${fmtS(d.cicilan)}/bln</span><span>Bunga: ${d.bunga}%/thn</span><span>Jatuh: ${d.jatuh}</span>${d.dateAdded?`<span>Input: ${isoToDisplay(d.dateAdded)}</span>`:''}</div>
          </div>
          <div style="display:flex;align-items:center;gap:8px">
            <span class="badge ${DTYPE_C[d.type]||'badge-blue'}">${d.type}</span>
            <div class="action-menu-wrap">
              <button class="btn-action-menu" onclick="toggleActionMenu('d-${d.id}',event)" title="Opsi">···</button>
              <div class="action-menu" id="am-d-${d.id}">
                <button onclick="closeActionMenu();markDebtLunas('${d.id}')">✅ Tandai Lunas</button>
                <button onclick="closeActionMenu();openBalanceUpdateModal('${d.id}')">📉 Update Saldo</button>
                <button onclick="closeActionMenu();openEditModal('debt','${d.id}')">✏️ Edit</button>
                <button class="danger" onclick="closeActionMenu();del('debt','${d.id}','${esc(d.name)}')">🗑 Hapus</button>
              </div>
            </div>
          </div>
        </div>
        <div style="display:flex;gap:20px;font-size:12px;color:var(--text3);margin-top:4px;flex-wrap:wrap">
          <span>Total: <strong style="color:var(--text)">${fmtS(d.total)}</strong></span>
          <span>Sisa: ${sisaHtml}</span>
          <span>Terbayar: <strong class="c-green">${paidPct}%</strong></span>
        </div>
        <div class="progress-wrap"><div class="progress-bar bar-green" style="width:${paidPct}%"></div></div>
      </div>`;
    }).join('');
  }

  // Paid debts section
  const paidCard = document.getElementById('paidDebtCard');
  if (paidCard) paidCard.style.display = paid.length ? '' : 'none';
  if (paid.length) {
    document.getElementById('paidDebtList').innerHTML = paid.map(d => {
      const pdStr = d.paidDate ? isoToDisplay(d.paidDate) : '—';
      return `<div class="debt-item">
        <div class="debt-header">
          <div><div class="debt-name" style="color:var(--text2)">${esc(d.name)}</div>
            <div class="debt-meta"><span>Total: ${fmtS(d.total)}</span><span>Lunas: ${pdStr}</span></div>
          </div>
          <div style="display:flex;align-items:center;gap:8px">
            <span class="badge badge-green">Lunas</span>
            <div class="row-actions"><button class="btn-edit" onclick="restoreDebt('${d.id}')" title="Kembalikan">↩️</button></div>
          </div>
        </div>
      </div>`;
    }).join('');
    if (_paidDebtOpen) document.getElementById('paidDebtList').style.display = 'block';
  }

  renderDebtHistChart();
}

