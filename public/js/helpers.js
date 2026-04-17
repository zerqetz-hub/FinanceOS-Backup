// ── helpers.js — currency system, formatters, constants, utilities ───────────
// Fix v5.4: Currency hanya IDR & USD. Terminologi "saldo" konsisten.
'use strict';

let _rates = { USD: 16000 };

async function refreshRates() {
  try {
    const r = await fetch('https://open.er-api.com/v6/latest/USD', { signal: AbortSignal.timeout(5000) });
    if (!r.ok) return;
    const data = await r.json();
    const idr  = data?.rates?.IDR;
    if (!idr || idr < 1000) return;
    _rates.USD = idr;
  } catch {}
}

const CURRENCY_META = {
  IDR: { symbol: 'Rp', flag: '🇮🇩', decimals: 0, locale: 'id-ID' },
  USD: { symbol: '$',  flag: '🇺🇸', decimals: 2, locale: 'en-US' },
};

function _toDisplay(idrAmount) {
  const cur = S.currency || 'IDR';
  return cur === 'IDR' ? idrAmount : idrAmount / (_rates[cur] || 16000);
}

const fmt = n => {
  const cur = S.currency || 'IDR';
  const meta = CURRENCY_META[cur] || CURRENCY_META.IDR;
  const val  = _toDisplay(n);
  if (cur === 'IDR') return 'Rp ' + Math.round(val).toLocaleString('id-ID');
  return meta.symbol + val.toLocaleString(meta.locale, { minimumFractionDigits: meta.decimals, maximumFractionDigits: meta.decimals });
};

const fmtS = n => {
  const cur  = S.currency || 'IDR';
  const meta = CURRENCY_META[cur] || CURRENCY_META.IDR;
  const val  = _toDisplay(n);
  const abs  = Math.abs(val);
  const sign = val < 0 ? '-' : '';
  if (cur === 'IDR') {
    if (abs >= 1e9) return sign + 'Rp ' + (abs / 1e9).toFixed(2) + 'M';
    if (abs >= 1e6) return sign + 'Rp ' + (abs / 1e6).toFixed(1) + 'jt';
    return sign + 'Rp ' + Math.round(abs).toLocaleString('id-ID');
  }
  if (abs >= 1e6) return sign + meta.symbol + (abs / 1e6).toFixed(2) + 'M';
  if (abs >= 1e3) return sign + meta.symbol + (abs / 1e3).toFixed(1) + 'k';
  return sign + meta.symbol + val.toFixed(meta.decimals);
};

function _updateCurrencyBtn() {
  const cur  = S.currency || 'IDR';
  const meta = CURRENCY_META[cur] || CURRENCY_META.IDR;
  const btn  = document.getElementById('currencyBtn');
  if (btn) btn.textContent = meta.flag + ' ' + cur;
}

async function toggleCurrency() {
  S.currency = (S.currency === 'IDR') ? 'USD' : 'IDR';
  _updateCurrencyBtn();
  renderAll();
  await syncSettings();
  showToast('Mata uang: ' + S.currency);
  if (S.currency === 'USD') { await refreshRates(); renderAll(); }
}

// Computed helpers
const sortedCF     = () => [...S.cashflows].sort((a, b) => a.month.localeCompare(b.month));
const latestCF     = () => { const s = sortedCF(); return s.length ? s[s.length - 1] : null; };
const cfExp        = cf => cf ? Object.values(cf.expenses || {}).reduce((a, b) => a + b, 0) : 0;
const cfSaldo      = cf => cf ? (cf.income - cfExp(cf)) : 0;
const totalAssets  = () => S.assets.reduce((s, a) => s + a.value, 0);
const totalDebts   = () => S.debts.reduce((s, d) => s + getProjectedSisa(d), 0);
const netWorth     = () => totalAssets() - totalDebts();
const avgMonthExp  = () => !S.cashflows.length ? 0 : S.cashflows.reduce((s, cf) => s + cfExp(cf), 0) / S.cashflows.length;
const efTarget     = () => avgMonthExp() * 6;
const efSaved      = () => S.assets.filter(a => a.type === 'Cash').reduce((s, a) => s + a.value, 0);
const totalCicilan = () => S.debts.reduce((s, d) => s + d.cicilan, 0);
const investAssets    = () => S.assets.filter(a => a.type !== 'Cash');
const totalInvestVal  = () => investAssets().reduce((s, a) => s + a.value, 0);
const totalInvestCost = () => investAssets().reduce((s, a) => s + a.cost, 0);

const pctChg = (a, b) => a === 0 ? '0.0%' : ((b - a) / Math.abs(a) * 100).toFixed(1) + '%';
const uid    = () => crypto.randomUUID();
const MNAMES = ['','Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agt','Sep','Okt','Nov','Des'];
const mLabel = m => { const [y, mo] = m.split('-'); return MNAMES[+mo] + ' ' + y; };
const getCats       = () => S.categories?.expense || ['Makanan','Transport','Hiburan','Kesehatan','Utilities','Belanja','Lainnya'];
const getIncomeCats = () => S.categories?.income  || ['Gaji','Freelance','Bisnis','Investasi','Bonus','Dividen','Lainnya'];

const EXP_COLORS   = ['#1a6b4a','#1a5ba6','#5a3fb5','#c45c1a','#b87614','#c23b3b','#888888'];
const ASSET_COLORS = ['#1a5ba6','#c45c1a','#1a6b4a','#b87614','#5a3fb5','#c23b3b','#888888'];
const TYPE_NAMES   = { Stock:'Saham', Crypto:'Kripto', Property:'Properti', Gold:'Emas', MutualFund:'Reksa Dana', Cash:'Kas & Tabungan', Bond:'Obligasi', Other:'Lainnya' };

const v  = id => { const el = document.getElementById(id); return el ? el.value : ''; };
const vn = id => parseFloat(v(id)) || 0;
const esc = s => String(s).replace(/&/g,'&amp;').replace(/'/g,'&#39;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const isoToDisplay = iso => iso ? new Date(iso + 'T00:00:00').toLocaleDateString('id-ID', { day:'numeric', month:'short', year:'numeric' }) : '';

function getProjectedSisa(debt) {
  if (!debt.bunga || +debt.bunga === 0 || !debt.sisa) return +debt.sisa || 0;
  const history = (debt.balanceHistory || []).slice().sort((a, b) => a.date.localeCompare(b.date));
  const last = history.length ? history[history.length - 1] : null;
  if (!last) return +debt.sisa || 0;
  const lastDate = new Date(last.date + 'T00:00:00');
  const today = new Date();
  const months = (today.getFullYear() - lastDate.getFullYear()) * 12 + (today.getMonth() - lastDate.getMonth());
  if (months <= 0) return +last.sisa || 0;
  return +last.sisa * Math.pow(1 + (+debt.bunga / 100 / 12), months);
}

async function withSubmitLock(fn) {
  const btn = document.querySelector('#modalContent button.btn-primary, #modalContent button.income-btn');
  if (btn) { btn.disabled = true; btn.classList.add('btn-loading'); }
  try { await fn(); }
  finally { if (btn) { btn.disabled = false; btn.classList.remove('btn-loading'); } }
}
