'use strict';
// lib/excel.export.js — generates multi-sheet Excel workbook from user data

const ExcelJS = require('exceljs');

// ── formatting helpers ────────────────────────────────────────────────────────

function fmtNum(n) { return isNaN(n) ? 0 : Number(n) || 0; }

function mLabel(monthStr) {
  if (!monthStr || monthStr.length < 7) return monthStr || '';
  const [y, m] = monthStr.split('-');
  const MONTHS = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
  return `${MONTHS[parseInt(m, 10) - 1] || m} ${y}`;
}

function isoToDisplay(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ── style helpers ─────────────────────────────────────────────────────────────

const GREEN_FILL  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A6B4A' } };
const BLUE_FILL   = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A5BA6' } };
const RED_FILL    = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC23B3B' } };
const AMBER_FILL  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFB87614' } };
const LGREY_FILL  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F5' } };
const LGREEN_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F5EE' } };
const LRED_FILL   = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFDF0F0' } };
const WHITE_FILL  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };

function applyHeaderRow(row, fill) {
  row.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
  row.fill = fill || GREEN_FILL;
  row.alignment = { vertical: 'middle', horizontal: 'center' };
  row.height = 22;
  row.eachCell(cell => {
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF999999' } },
      bottom: { style: 'thin', color: { argb: 'FF999999' } },
      left: { style: 'thin', color: { argb: 'FF999999' } },
      right: { style: 'thin', color: { argb: 'FF999999' } },
    };
  });
}

function applyDataRow(row, even) {
  row.fill = even ? LGREY_FILL : WHITE_FILL;
  row.height = 18;
  row.eachCell(cell => {
    cell.border = {
      top: { style: 'hair', color: { argb: 'FFDDDDDD' } },
      bottom: { style: 'hair', color: { argb: 'FFDDDDDD' } },
      left: { style: 'hair', color: { argb: 'FFDDDDDD' } },
      right: { style: 'hair', color: { argb: 'FFDDDDDD' } },
    };
  });
}

function applyTotalRow(row, fill) {
  row.font = { bold: true, size: 10 };
  row.fill = fill || LGREEN_FILL;
  row.height = 20;
  row.eachCell(cell => {
    cell.border = {
      top: { style: 'medium', color: { argb: 'FF888888' } },
      bottom: { style: 'medium', color: { argb: 'FF888888' } },
    };
  });
}

const IDR = '#,##0';

// ── Sheet 1: Cash Flow ────────────────────────────────────────────────────────

function buildCashFlowSheet(wb, cashflows) {
  const ws = wb.addWorksheet('Cash Flow', { views: [{ state: 'frozen', ySplit: 2 }] });

  const sortedCF = [...cashflows].sort((a, b) => a.month.localeCompare(b.month));

  // Collect all unique income and expense categories across all months
  const incCats = new Set();
  const expCats = new Set();
  sortedCF.forEach(cf => {
    if (cf.incomeBreakdown) Object.keys(cf.incomeBreakdown).forEach(k => incCats.add(k));
    if (cf.expenses) Object.keys(cf.expenses).forEach(k => expCats.add(k));
  });
  const incArr = [...incCats];
  const expArr = [...expCats];

  // Title row
  ws.mergeCells(1, 1, 1, 4 + incArr.length + expArr.length);
  const titleCell = ws.getCell(1, 1);
  titleCell.value = 'LAPORAN CASH FLOW';
  titleCell.font = { bold: true, size: 13, color: { argb: 'FF1A6B4A' } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(1).height = 28;

  // Header row
  const headers = [
    'Bulan', 'Total Income', ...incArr.map(c => `Income: ${c}`),
    'Total Pengeluaran', ...expArr.map(c => `Pengeluaran: ${c}`),
    'Saldo Bersih', 'Saving Rate',
  ];
  const headerRow = ws.addRow(headers);
  applyHeaderRow(headerRow);

  // Data rows
  sortedCF.forEach((cf, i) => {
    const totalInc = fmtNum(cf.income);
    const totalExp = Object.values(cf.expenses || {}).reduce((s, v) => s + fmtNum(v), 0);
    const saldo    = totalInc - totalExp;
    const savRate  = totalInc > 0 ? (saldo / totalInc * 100) : 0;

    const row = ws.addRow([
      mLabel(cf.month),
      totalInc,
      ...incArr.map(c => fmtNum((cf.incomeBreakdown || {})[c])),
      totalExp,
      ...expArr.map(c => fmtNum((cf.expenses || {})[c])),
      saldo,
      savRate / 100,
    ]);
    applyDataRow(row, i % 2 === 1);

    // Format income cols green
    const incStartCol = 2;
    for (let c = incStartCol; c <= 2 + incArr.length; c++) {
      row.getCell(c).numFmt = IDR;
    }
    // Format expense cols red-ish
    const expStartCol = 3 + incArr.length;
    for (let c = expStartCol; c <= expStartCol + expArr.length; c++) {
      row.getCell(c).numFmt = IDR;
    }
    // Saldo col
    const saldoCell = row.getCell(4 + incArr.length + expArr.length);
    saldoCell.numFmt = IDR;
    saldoCell.font = { bold: true, color: { argb: saldo >= 0 ? 'FF1A6B4A' : 'FFC23B3B' } };
    // Saving rate
    const srCell = row.getCell(5 + incArr.length + expArr.length);
    srCell.numFmt = '0.0%';
    srCell.font = { color: { argb: savRate >= 20 ? 'FF1A6B4A' : 'FFB87614' } };
  });

  // Total row
  if (sortedCF.length > 0) {
    const totInc  = sortedCF.reduce((s, cf) => s + fmtNum(cf.income), 0);
    const totExp  = sortedCF.reduce((s, cf) => s + Object.values(cf.expenses || {}).reduce((a, v) => a + fmtNum(v), 0), 0);
    const totSaldo = totInc - totExp;
    const avgSR   = totInc > 0 ? (totSaldo / totInc) : 0;

    const totRow = ws.addRow([
      'TOTAL',
      totInc,
      ...incArr.map(c => sortedCF.reduce((s, cf) => s + fmtNum((cf.incomeBreakdown || {})[c]), 0)),
      totExp,
      ...expArr.map(c => sortedCF.reduce((s, cf) => s + fmtNum((cf.expenses || {})[c]), 0)),
      totSaldo,
      avgSR,
    ]);
    applyTotalRow(totRow);
    const numCols = headers.length;
    for (let c = 2; c <= numCols - 1; c++) totRow.getCell(c).numFmt = IDR;
    totRow.getCell(numCols).numFmt = '0.0%';
  }

  // Column widths
  ws.getColumn(1).width = 14;
  ws.getColumn(2).width = 16;
  for (let i = 3; i <= 2 + incArr.length; i++) ws.getColumn(i).width = 18;
  ws.getColumn(3 + incArr.length).width = 18;
  for (let i = 4 + incArr.length; i <= 3 + incArr.length + expArr.length; i++) ws.getColumn(i).width = 18;
  ws.getColumn(4 + incArr.length + expArr.length).width = 16;
  ws.getColumn(5 + incArr.length + expArr.length).width = 13;
}

// ── Sheet 2: Aset & Net Worth ─────────────────────────────────────────────────

function buildAssetSheet(wb, assets) {
  const ws = wb.addWorksheet('Aset & Net Worth', { views: [{ state: 'frozen', ySplit: 2 }] });

  // Title
  ws.mergeCells(1, 1, 1, 8);
  const titleCell = ws.getCell(1, 1);
  titleCell.value = 'PORTOFOLIO ASET & NET WORTH';
  titleCell.font = { bold: true, size: 13, color: { argb: 'FF1A5BA6' } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(1).height = 28;

  // Header
  const headerRow = ws.addRow(['Nama Aset', 'Kategori', 'Sub / Keterangan', 'Modal (Cost)', 'Nilai Pasar', 'PnL (Rp)', 'Return (%)', 'Tanggal Input']);
  applyHeaderRow(headerRow, BLUE_FILL);

  // Group by type
  const types = {};
  assets.forEach(a => {
    if (!types[a.type]) types[a.type] = [];
    types[a.type].push(a);
  });

  const TYPE_NAMES = {
    saham: 'Saham', reksadana: 'Reksa Dana', crypto: 'Crypto / Aset Digital',
    obligasi: 'Obligasi', properti: 'Properti', emas: 'Emas', tabungan: 'Tabungan / Deposito', lainnya: 'Lainnya',
  };

  let rowIdx = 0;
  let grandTotalCost = 0, grandTotalValue = 0;

  Object.entries(types).forEach(([type, items]) => {
    const typeName = TYPE_NAMES[type] || type;
    const typeTotalCost  = items.reduce((s, a) => s + fmtNum(a.cost), 0);
    const typeTotalValue = items.reduce((s, a) => s + fmtNum(a.value), 0);
    grandTotalCost  += typeTotalCost;
    grandTotalValue += typeTotalValue;

    // Type sub-header
    const subHeaderRow = ws.addRow([typeName, '', '', typeTotalCost, typeTotalValue, typeTotalValue - typeTotalCost, typeTotalCost ? (typeTotalValue - typeTotalCost) / typeTotalCost : 0, '']);
    subHeaderRow.font = { bold: true, size: 10, color: { argb: 'FF1A5BA6' } };
    subHeaderRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F0FB' } };
    subHeaderRow.height = 20;
    subHeaderRow.getCell(4).numFmt = IDR;
    subHeaderRow.getCell(5).numFmt = IDR;
    subHeaderRow.getCell(6).numFmt = IDR;
    subHeaderRow.getCell(7).numFmt = '0.00%';

    items.forEach((a, i) => {
      const pnl = fmtNum(a.value) - fmtNum(a.cost);
      const ret = fmtNum(a.cost) > 0 ? pnl / fmtNum(a.cost) : 0;
      const row = ws.addRow([
        a.name, typeName, a.sub || '',
        fmtNum(a.cost), fmtNum(a.value), pnl, ret,
        isoToDisplay(a.dateAdded),
      ]);
      applyDataRow(row, rowIdx % 2 === 1);
      row.getCell(4).numFmt = IDR;
      row.getCell(5).numFmt = IDR;
      row.getCell(6).numFmt = IDR;
      row.getCell(6).font = { color: { argb: pnl >= 0 ? 'FF1A6B4A' : 'FFC23B3B' } };
      row.getCell(7).numFmt = '0.00%';
      row.getCell(7).font = { color: { argb: ret >= 0 ? 'FF1A6B4A' : 'FFC23B3B' } };
      rowIdx++;
    });
  });

  // Grand total
  const grandPnl = grandTotalValue - grandTotalCost;
  const grandRet = grandTotalCost > 0 ? grandPnl / grandTotalCost : 0;
  const totRow = ws.addRow(['TOTAL PORTOFOLIO', '', '', grandTotalCost, grandTotalValue, grandPnl, grandRet, '']);
  applyTotalRow(totRow, LGREEN_FILL);
  totRow.getCell(4).numFmt = IDR;
  totRow.getCell(5).numFmt = IDR;
  totRow.getCell(6).numFmt = IDR;
  totRow.getCell(6).font = { bold: true, color: { argb: grandPnl >= 0 ? 'FF1A6B4A' : 'FFC23B3B' } };
  totRow.getCell(7).numFmt = '0.00%';
  totRow.getCell(7).font = { bold: true, color: { argb: grandRet >= 0 ? 'FF1A6B4A' : 'FFC23B3B' } };

  // Column widths
  [24, 14, 20, 16, 16, 16, 13, 14].forEach((w, i) => { ws.getColumn(i + 1).width = w; });
}

// ── Sheet 3: Hutang ───────────────────────────────────────────────────────────

function buildDebtSheet(wb, debts, paidDebts) {
  const ws = wb.addWorksheet('Hutang', { views: [{ state: 'frozen', ySplit: 2 }] });

  // Title
  ws.mergeCells(1, 1, 1, 9);
  const titleCell = ws.getCell(1, 1);
  titleCell.value = 'RINCIAN HUTANG';
  titleCell.font = { bold: true, size: 13, color: { argb: 'FFC23B3B' } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(1).height = 28;

  const headerRow = ws.addRow(['Nama', 'Jenis', 'Total Pinjaman', 'Sisa Hutang', 'Bunga (%/thn)', 'Cicilan/Bulan', 'Jatuh Tempo', 'Terbayar (%)', 'Status']);
  applyHeaderRow(headerRow, RED_FILL);

  const activeDebts = [...debts];
  const allDebts = [
    ...activeDebts.map(d => ({ ...d, _status: 'Aktif' })),
    ...(paidDebts || []).map(d => ({ ...d, _status: 'Lunas' })),
  ];

  let totalActive = 0, totalCicilan = 0;

  allDebts.forEach((d, i) => {
    const paidPct = fmtNum(d.total) > 0 ? Math.max(0, (1 - fmtNum(d.sisa) / fmtNum(d.total)) * 100) : 0;
    const row = ws.addRow([
      d.name,
      d.type || '—',
      fmtNum(d.total),
      fmtNum(d.sisa),
      fmtNum(d.bunga),
      fmtNum(d.cicilan),
      d.jatuh || '—',
      paidPct / 100,
      d._status,
    ]);
    applyDataRow(row, i % 2 === 1);
    row.getCell(3).numFmt = IDR;
    row.getCell(4).numFmt = IDR;
    row.getCell(4).font = { color: { argb: 'FFC23B3B' } };
    row.getCell(5).numFmt = '0.00';
    row.getCell(6).numFmt = IDR;
    row.getCell(8).numFmt = '0.0%';
    row.getCell(9).font = { color: { argb: d._status === 'Lunas' ? 'FF1A6B4A' : 'FFC23B3B' }, bold: d._status === 'Lunas' };

    if (d._status === 'Aktif') {
      totalActive  += fmtNum(d.sisa);
      totalCicilan += fmtNum(d.cicilan);
    }
  });

  if (activeDebts.length > 0) {
    const totRow = ws.addRow(['TOTAL AKTIF', '', '', totalActive, '', totalCicilan, '', '', '']);
    applyTotalRow(totRow, LRED_FILL);
    totRow.getCell(4).numFmt = IDR;
    totRow.getCell(4).font = { bold: true, color: { argb: 'FFC23B3B' } };
    totRow.getCell(6).numFmt = IDR;
    totRow.getCell(6).font = { bold: true };
  }

  [24, 14, 16, 16, 14, 16, 13, 13, 10].forEach((w, i) => { ws.getColumn(i + 1).width = w; });
}

// ── Sheet 4: Goals ────────────────────────────────────────────────────────────

function buildGoalsSheet(wb, goals) {
  const ws = wb.addWorksheet('Goals', { views: [{ state: 'frozen', ySplit: 2 }] });

  ws.mergeCells(1, 1, 1, 7);
  const titleCell = ws.getCell(1, 1);
  titleCell.value = 'TARGET KEUANGAN (GOALS)';
  titleCell.font = { bold: true, size: 13, color: { argb: 'FF5A3FB5' } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(1).height = 28;

  const headerRow = ws.addRow(['Nama Goal', 'Target', 'Terkumpul', 'Sisa', 'Progres (%)', 'Deadline', 'Tanggal Dibuat']);
  applyHeaderRow(headerRow, { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF5A3FB5' } });

  goals.forEach((g, i) => {
    const target  = fmtNum(g.target);
    const current = fmtNum(g.current);
    const sisa    = Math.max(0, target - current);
    const pct     = target > 0 ? Math.min(1, current / target) : 0;
    const row = ws.addRow([
      g.name, target, current, sisa, pct,
      g.deadline || '—',
      isoToDisplay(g.dateAdded),
    ]);
    applyDataRow(row, i % 2 === 1);
    row.getCell(2).numFmt = IDR;
    row.getCell(3).numFmt = IDR;
    row.getCell(4).numFmt = IDR;
    row.getCell(5).numFmt = '0.0%';
    row.getCell(5).font = { color: { argb: pct >= 1 ? 'FF1A6B4A' : 'FF1A5BA6' } };
  });

  [28, 16, 16, 16, 13, 13, 16].forEach((w, i) => { ws.getColumn(i + 1).width = w; });
}

// ── Sheet 5: Transaksi ────────────────────────────────────────────────────────

function buildTransactionSheet(wb, transactions) {
  const ws = wb.addWorksheet('Transaksi', { views: [{ state: 'frozen', ySplit: 2 }] });

  ws.mergeCells(1, 1, 1, 5);
  const titleCell = ws.getCell(1, 1);
  titleCell.value = 'RIWAYAT TRANSAKSI';
  titleCell.font = { bold: true, size: 13, color: { argb: 'FF333333' } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(1).height = 28;

  const headerRow = ws.addRow(['Tanggal', 'Tipe', 'Kategori', 'Jumlah', 'Catatan']);
  applyHeaderRow(headerRow, { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF444444' } });

  const sorted = [...transactions].sort((a, b) => {
    const da = a.date_added || a.dateAdded || '';
    const db2 = b.date_added || b.dateAdded || '';
    return db2.localeCompare(da);
  });

  sorted.forEach((tx, i) => {
    const isInc = (tx.type || '').toLowerCase().includes('income') || (tx.type || '').toLowerCase().includes('pemasukan');
    const amt = fmtNum(tx.amount);
    const row = ws.addRow([
      isoToDisplay(tx.date_added || tx.dateAdded),
      tx.type || '—',
      tx.category || '—',
      amt,
      tx.note || tx.notes || '',
    ]);
    applyDataRow(row, i % 2 === 1);
    row.getCell(4).numFmt = IDR;
    row.getCell(4).font = { color: { argb: isInc ? 'FF1A6B4A' : 'FFC23B3B' } };
  });

  [14, 14, 18, 16, 36].forEach((w, i) => { ws.getColumn(i + 1).width = w; });
}

// ── Main export function ──────────────────────────────────────────────────────

async function generateExcel(data) {
  const wb = new ExcelJS.Workbook();
  wb.creator    = 'KepingUang';
  wb.created    = new Date();
  wb.properties.date1904 = false;

  const cashflows    = data.cashflows    || [];
  const assets       = data.assets       || [];
  const debts        = data.debts        || [];
  const paidDebts    = data.paidDebts    || [];
  const goals        = data.goals        || [];
  const transactions = data.transactions || [];

  buildCashFlowSheet(wb, cashflows);
  buildAssetSheet(wb, assets);
  buildDebtSheet(wb, debts, paidDebts);
  buildGoalsSheet(wb, goals);
  buildTransactionSheet(wb, transactions);

  return wb;
}

module.exports = { generateExcel };
