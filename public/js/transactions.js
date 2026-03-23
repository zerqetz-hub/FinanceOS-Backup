// ── transactions.js — pagination untuk daftar transaksi ─────────────────────
// @requires api.js (API), state.js (S), helpers.js (fmt, esc), ui.js (showToast)
'use strict';

let _txPage  = 1;
let _txTotal = 0;
let _txLimit = 20;
let _txLoading = false;

/** Reset pagination saat section transactions pertama kali dibuka */
function resetTxPagination() {
  _txPage  = 1;
  _txTotal = S.transactionsMeta?.total || S.transactions?.length || 0;
  _txLimit = 20;
}

/** Apakah masih ada halaman berikutnya? */
function hasTxMore() {
  return _txPage * _txLimit < _txTotal;
}

/** Load halaman transaksi berikutnya dan tambahkan ke S.transactions */
async function loadMoreTransactions() {
  if (_txLoading || !hasTxMore()) return;
  _txLoading = true;

  const btn = document.getElementById('txLoadMoreBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Memuat...'; }

  try {
    _txPage++;
    const res = await API.get(`/api/transactions?page=${_txPage}&limit=${_txLimit}`);
    if (res.items) {
      // Gabungkan tanpa duplikat
      const existingIds = new Set(S.transactions.map(t => t.id));
      const newItems = res.items.filter(t => !existingIds.has(t.id));
      S.transactions = [...S.transactions, ...newItems];
      _txTotal = res.total;
    }
    // Re-render hanya bagian transaksi
    renderTransactions();
  } catch (e) {
    showToast('Gagal memuat transaksi: ' + e.message, 'error');
    _txPage--;
  } finally {
    _txLoading = false;
  }
}

/** Render tombol "Muat lebih banyak" di bawah daftar transaksi */
function renderTxLoadMore() {
  const container = document.getElementById('txLoadMoreContainer');
  if (!container) return;

  const shown = S.transactions?.length || 0;

  if (hasTxMore()) {
    const remaining = _txTotal - shown;
    container.innerHTML = `
      <div style="text-align:center;padding:16px 0">
        <button id="txLoadMoreBtn" onclick="loadMoreTransactions()"
          class="btn btn-ghost" style="font-size:13px">
          Muat ${Math.min(remaining, _txLimit)} transaksi lagi
          <span style="opacity:.6;margin-left:4px">(${shown} dari ${_txTotal})</span>
        </button>
      </div>`;
  } else if (_txTotal > _txLimit) {
    container.innerHTML = `
      <div style="text-align:center;padding:12px 0;font-size:13px;opacity:.5">
        Semua ${_txTotal} transaksi ditampilkan
      </div>`;
  } else {
    container.innerHTML = '';
  }
}
