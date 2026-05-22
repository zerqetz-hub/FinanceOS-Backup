'use strict';

/**
 * database.js — PostgreSQL data layer for KepingUang v5.5.
 *
 * Perubahan v5.5:
 *   - REAL → NUMERIC(20,4) untuk semua kolom finansial
 *   - _applySnapshot: paralel per-entitas
 *   - Settings cache in-memory (TTL 60s)
 *   - Pakai NotFoundError (hapus string-matching fragile)
 */

const { Pool }          = require('pg');
const { NotFoundError } = require('./errors');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 10, idleTimeoutMillis: 30_000, connectionTimeoutMillis: 5_000,
});
pool.on('error', (err) => console.error('PostgreSQL pool error:', err.message));

async function q(sql, params = []) {
  const { rows } = await pool.query(sql, params);
  return rows;
}

async function tx(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (e) { await client.query('ROLLBACK'); throw e; }
  finally { client.release(); }
}

async function ping() { await pool.query('SELECT 1'); }

// ─── SCHEMA ───────────────────────────────────────────────────────────────────
async function initSchema() {
  await tx(async (c) => {
    await c.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);
    await c.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT UNIQUE NOT NULL,
        username TEXT NOT NULL DEFAULT 'Pengguna',
        password_hash TEXT NOT NULL, password_salt TEXT NOT NULL,
        avatar TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        verified BOOLEAN NOT NULL DEFAULT FALSE
      )`);
    await c.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar TEXT`).catch(() => {});

    await c.query(`
      CREATE TABLE IF NOT EXISTS cashflows (
        id TEXT PRIMARY KEY, user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        month TEXT NOT NULL, income NUMERIC(20,4) NOT NULL DEFAULT 0,
        date_added TEXT NOT NULL, UNIQUE (user_id, month)
      )`);
    await c.query(`ALTER TABLE cashflows ALTER COLUMN income TYPE NUMERIC(20,4)`).catch(() => {});

    await c.query(`
      CREATE TABLE IF NOT EXISTS cashflow_expenses (
        cashflow_id TEXT NOT NULL REFERENCES cashflows(id) ON DELETE CASCADE,
        category TEXT NOT NULL, amount NUMERIC(20,4) NOT NULL DEFAULT 0,
        notes TEXT NOT NULL DEFAULT '', PRIMARY KEY (cashflow_id, category)
      )`);
    await c.query(`ALTER TABLE cashflow_expenses ALTER COLUMN amount TYPE NUMERIC(20,4)`).catch(() => {});
    await c.query(`ALTER TABLE cashflow_expenses ADD COLUMN IF NOT EXISTS notes TEXT NOT NULL DEFAULT ''`).catch(() => {});

    await c.query(`
      CREATE TABLE IF NOT EXISTS cashflow_income_bdown (
        cashflow_id TEXT NOT NULL REFERENCES cashflows(id) ON DELETE CASCADE,
        source TEXT NOT NULL, amount NUMERIC(20,4) NOT NULL DEFAULT 0,
        notes TEXT NOT NULL DEFAULT '', PRIMARY KEY (cashflow_id, source)
      )`);
    await c.query(`ALTER TABLE cashflow_income_bdown ALTER COLUMN amount TYPE NUMERIC(20,4)`).catch(() => {});
    await c.query(`ALTER TABLE cashflow_income_bdown ADD COLUMN IF NOT EXISTS notes TEXT NOT NULL DEFAULT ''`).catch(() => {});

    await c.query(`
      CREATE TABLE IF NOT EXISTS assets (
        id TEXT PRIMARY KEY, user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name TEXT NOT NULL, sub TEXT NOT NULL DEFAULT '', type TEXT NOT NULL,
        value NUMERIC(20,4) NOT NULL DEFAULT 0, cost NUMERIC(20,4) NOT NULL DEFAULT 0,
        date_added TEXT NOT NULL
      )`);
    await c.query(`ALTER TABLE assets ALTER COLUMN value TYPE NUMERIC(20,4)`).catch(() => {});
    await c.query(`ALTER TABLE assets ALTER COLUMN cost  TYPE NUMERIC(20,4)`).catch(() => {});

    await c.query(`
      CREATE TABLE IF NOT EXISTS asset_price_history (
        id SERIAL PRIMARY KEY,
        asset_id TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
        date TEXT NOT NULL, price NUMERIC(20,4) NOT NULL, UNIQUE(asset_id, date)
      )`);
    await c.query(`ALTER TABLE asset_price_history ALTER COLUMN price TYPE NUMERIC(20,4)`).catch(() => {});

    await c.query(`
      CREATE TABLE IF NOT EXISTS debts (
        id TEXT PRIMARY KEY, user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name TEXT NOT NULL, type TEXT NOT NULL,
        total NUMERIC(20,4) NOT NULL DEFAULT 0, sisa NUMERIC(20,4) NOT NULL DEFAULT 0,
        bunga NUMERIC(20,4) NOT NULL DEFAULT 0, cicilan NUMERIC(20,4) NOT NULL DEFAULT 0,
        jatuh TEXT NOT NULL DEFAULT '', date_added TEXT NOT NULL
      )`);
    for (const col of ['total','sisa','bunga','cicilan']) {
      await c.query(`ALTER TABLE debts ALTER COLUMN ${col} TYPE NUMERIC(20,4)`).catch(() => {});
    }

    await c.query(`
      CREATE TABLE IF NOT EXISTS debt_balance_history (
        id SERIAL PRIMARY KEY,
        debt_id TEXT NOT NULL REFERENCES debts(id) ON DELETE CASCADE,
        date TEXT NOT NULL, sisa NUMERIC(20,4) NOT NULL, UNIQUE(debt_id, date)
      )`);
    await c.query(`ALTER TABLE debt_balance_history ALTER COLUMN sisa TYPE NUMERIC(20,4)`).catch(() => {});

    await c.query(`
      CREATE TABLE IF NOT EXISTS paid_debts (
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        debt_id TEXT NOT NULL, data TEXT NOT NULL, PRIMARY KEY (user_id, debt_id)
      )`);

    await c.query(`
      CREATE TABLE IF NOT EXISTS goals (
        id TEXT PRIMARY KEY, user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name TEXT NOT NULL, target NUMERIC(20,4) NOT NULL DEFAULT 0,
        current NUMERIC(20,4) NOT NULL DEFAULT 0,
        deadline TEXT NOT NULL DEFAULT '', color TEXT NOT NULL DEFAULT '#1a6b4a',
        date_added TEXT NOT NULL
      )`);
    await c.query(`ALTER TABLE goals ALTER COLUMN target  TYPE NUMERIC(20,4)`).catch(() => {});
    await c.query(`ALTER TABLE goals ALTER COLUMN current TYPE NUMERIC(20,4)`).catch(() => {});

    await c.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY, user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        cat TEXT NOT NULL DEFAULT '', name TEXT NOT NULL, date TEXT NOT NULL,
        amount NUMERIC(20,4) NOT NULL DEFAULT 0,
        cat_color TEXT NOT NULL DEFAULT '#888888', cat_name TEXT NOT NULL DEFAULT '',
        notes TEXT NOT NULL DEFAULT '', date_added TEXT NOT NULL
      )`);
    await c.query(`ALTER TABLE transactions ALTER COLUMN amount TYPE NUMERIC(20,4)`).catch(() => {});
    await c.query(`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS notes TEXT NOT NULL DEFAULT ''`).catch(() => {});

    await c.query(`
      CREATE TABLE IF NOT EXISTS settings (
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        key TEXT NOT NULL, value TEXT NOT NULL, PRIMARY KEY (user_id, key)
      )`);
    await c.query(`
      CREATE TABLE IF NOT EXISTS checkpoints (
        id TEXT PRIMARY KEY, user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        label TEXT, saved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), snapshot JSONB NOT NULL
      )`);
    await c.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        token TEXT PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires_at TIMESTAMPTZ NOT NULL
      )`);

    for (const [n, d] of [
      ['idx_cf_user','cashflows(user_id)'],['idx_cf_month','cashflows(user_id, month)'],
      ['idx_ast_user','assets(user_id)'],['idx_dbt_user','debts(user_id)'],
      ['idx_gol_user','goals(user_id)'],['idx_trx_user','transactions(user_id, date_added DESC)'],
      ['idx_ses_exp','sessions(expires_at)'],
    ]) { await c.query(`CREATE INDEX IF NOT EXISTS ${n} ON ${d}`); }
  });
}

// ─── DEFAULT DATA ─────────────────────────────────────────────────────────────
const DEFAULT_DATA = {
  cashflows:[], assets:[], debts:[], goals:[], transactions:[], paidDebts:[],
  settings:{
    currency:'IDR',
    categories:{
      income: ['Gaji','Freelance','Bisnis','Investasi','Bonus','Dividen','Lainnya'],
      expense:['Makanan','Transport','Hiburan','Kesehatan','Utilities','Belanja','Lainnya'],
    },
    budgets:{Makanan:3500000,Transport:2000000,Hiburan:1500000,
             Kesehatan:1000000,Utilities:1200000,Belanja:2000000,Lainnya:800000},
  },
};

// ─── SETTINGS CACHE ───────────────────────────────────────────────────────────
const _sCache = new Map();
const SCACHE_TTL = 60_000;
const _scGet  = (uid) => { const e = _sCache.get(uid); return (!e||Date.now()>e.exp) ? (_sCache.delete(uid),null) : e.data; };
const _scSet  = (uid, d) => _sCache.set(uid, { data:d, exp: Date.now()+SCACHE_TTL });
const _scDel  = (uid) => _sCache.delete(uid);

// ─── CASHFLOWS ────────────────────────────────────────────────────────────────
async function _assembleCashflows(userId) {
  const rows = await q(
    `SELECT id,month,income,date_added FROM cashflows WHERE user_id=$1 ORDER BY month ASC`, [userId]
  );
  if (!rows.length) return [];
  const ids = rows.map(r=>r.id);
  const [exps,incs] = await Promise.all([
    q(`SELECT cashflow_id,category,amount,COALESCE(notes,'') AS notes FROM cashflow_expenses WHERE cashflow_id=ANY($1)`,[ids]),
    q(`SELECT cashflow_id,source,amount,COALESCE(notes,'') AS notes FROM cashflow_income_bdown WHERE cashflow_id=ANY($1)`,[ids]),
  ]);
  const eM={}, eN={}, iM={}, iN={};
  exps.forEach(e=>{
    if(!eM[e.cashflow_id]){eM[e.cashflow_id]={};eN[e.cashflow_id]={};}
    eM[e.cashflow_id][e.category]=Number(e.amount); eN[e.cashflow_id][e.category]=e.notes;
  });
  incs.forEach(i=>{
    if(!iM[i.cashflow_id]){iM[i.cashflow_id]={};iN[i.cashflow_id]={};}
    iM[i.cashflow_id][i.source]=Number(i.amount); iN[i.cashflow_id][i.source]=i.notes;
  });
  return rows.map(r=>({
    id:r.id, month:r.month, income:Number(r.income),
    incomeBreakdown:iM[r.id]||{}, incomeNotes:iN[r.id]||{},
    expenses:eM[r.id]||{}, expenseNotes:eN[r.id]||{},
    dateAdded:r.date_added,
  }));
}
async function getCashflows(userId) { return _assembleCashflows(userId); }

async function addCashflow(userId, data) {
  await tx(async(c)=>{
    await c.query(
      `INSERT INTO cashflows(id,user_id,month,income,date_added) VALUES($1,$2,$3,$4,$5) ON CONFLICT(user_id,month) DO NOTHING`,
      [data.id,userId,data.month,data.income||0,data.dateAdded||new Date().toISOString().slice(0,10)]
    );
    if(data.expenses) for(const[k,v] of Object.entries(data.expenses))
      await c.query(`INSERT INTO cashflow_expenses(cashflow_id,category,amount,notes) VALUES($1,$2,$3,$4) ON CONFLICT(cashflow_id,category) DO UPDATE SET amount=$3,notes=$4`,
        [data.id,k,v,data.expenseNotes?.[k]||'']);
    if(data.incomeBreakdown) for(const[k,v] of Object.entries(data.incomeBreakdown))
      await c.query(`INSERT INTO cashflow_income_bdown(cashflow_id,source,amount,notes) VALUES($1,$2,$3,$4) ON CONFLICT(cashflow_id,source) DO UPDATE SET amount=$3,notes=$4`,
        [data.id,k,v,data.incomeNotes?.[k]||'']);
  });
}

async function updateCashflow(userId, id, data) {
  await tx(async(c)=>{
    const ck = await c.query(`SELECT id FROM cashflows WHERE id=$1 AND user_id=$2`,[id,userId]);
    if(!ck.rows.length) throw new NotFoundError('Cashflow tidak ditemukan.');
    if(data.income!==undefined) await c.query(`UPDATE cashflows SET income=$1 WHERE id=$2`,[data.income,id]);
    if(data.expenses){
      await c.query(`DELETE FROM cashflow_expenses WHERE cashflow_id=$1`,[id]);
      for(const[k,v] of Object.entries(data.expenses))
        await c.query(`INSERT INTO cashflow_expenses(cashflow_id,category,amount,notes) VALUES($1,$2,$3,$4)`,
          [id,k,v,data.expenseNotes?.[k]||'']);
    }
    if(data.incomeBreakdown){
      await c.query(`DELETE FROM cashflow_income_bdown WHERE cashflow_id=$1`,[id]);
      for(const[k,v] of Object.entries(data.incomeBreakdown))
        await c.query(`INSERT INTO cashflow_income_bdown(cashflow_id,source,amount,notes) VALUES($1,$2,$3,$4)`,
          [id,k,v,data.incomeNotes?.[k]||'']);
    }
  });
}

async function deleteCashflow(userId,id){
  const r=await q(`DELETE FROM cashflows WHERE id=$1 AND user_id=$2 RETURNING id`,[id,userId]);
  if(!r.length) throw new NotFoundError('Cashflow tidak ditemukan.');
}

// ─── ASSETS ───────────────────────────────────────────────────────────────────
async function getAssets(userId){
  const rows=await q(`SELECT id,name,sub,type,value,cost,date_added FROM assets WHERE user_id=$1 ORDER BY date_added`,[userId]);
  if(!rows.length) return [];
  const ids=rows.map(r=>r.id);
  const hist=await q(`SELECT asset_id,date,price FROM asset_price_history WHERE asset_id=ANY($1) ORDER BY date`,[ids]);
  const hM={};
  hist.forEach(h=>{if(!hM[h.asset_id])hM[h.asset_id]=[];hM[h.asset_id].push({date:h.date,value:Number(h.price)});});
  return rows.map(r=>({id:r.id,name:r.name,sub:r.sub,type:r.type,value:Number(r.value),cost:Number(r.cost),priceHistory:hM[r.id]||[],dateAdded:r.date_added}));
}

async function addAsset(userId,data){
  await tx(async(c)=>{
    await c.query(`INSERT INTO assets(id,user_id,name,sub,type,value,cost,date_added) VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
      [data.id,userId,data.name,data.sub||'',data.type,data.value||0,data.cost||0,data.dateAdded||new Date().toISOString().slice(0,10)]);
    if(data.priceHistory?.length) for(const ph of data.priceHistory)
      await c.query(`INSERT INTO asset_price_history(asset_id,date,price) VALUES($1,$2,$3) ON CONFLICT(asset_id,date) DO UPDATE SET price=$3`,
        [data.id,ph.date,ph.price??ph.value??0]);
  });
}

async function updateAsset(userId,id,data){
  await tx(async(c)=>{
    const ck=await c.query(`SELECT id FROM assets WHERE id=$1 AND user_id=$2`,[id,userId]);
    if(!ck.rows.length) throw new NotFoundError('Asset tidak ditemukan.');
    const fs=[],vs=[];let i=1;
    for(const[col,key] of [['name','name'],['sub','sub'],['type','type'],['value','value'],['cost','cost']])
      if(data[key]!==undefined){fs.push(`${col}=$${i++}`);vs.push(data[key]);}
    if(fs.length){vs.push(id);await c.query(`UPDATE assets SET ${fs.join(',')} WHERE id=$${i}`,vs);}
    if(data.priceHistory!==undefined){
      await c.query(`DELETE FROM asset_price_history WHERE asset_id=$1`,[id]);
      for(const ph of data.priceHistory)
        await c.query(`INSERT INTO asset_price_history(asset_id,date,price) VALUES($1,$2,$3)`,[id,ph.date,ph.price??ph.value??0]);
    }
  });
}

async function deleteAsset(userId,id){
  const r=await q(`DELETE FROM assets WHERE id=$1 AND user_id=$2 RETURNING id`,[id,userId]);
  if(!r.length) throw new NotFoundError('Asset tidak ditemukan.');
}

// ─── DEBTS ────────────────────────────────────────────────────────────────────
async function getDebts(userId){
  const rows=await q(`SELECT id,name,type,total,sisa,bunga,cicilan,jatuh,date_added FROM debts WHERE user_id=$1 ORDER BY date_added`,[userId]);
  if(!rows.length) return [];
  const ids=rows.map(r=>r.id);
  const hist=await q(`SELECT debt_id,date,sisa FROM debt_balance_history WHERE debt_id=ANY($1) ORDER BY date`,[ids]);
  const hM={};
  hist.forEach(h=>{if(!hM[h.debt_id])hM[h.debt_id]=[];hM[h.debt_id].push({date:h.date,sisa:Number(h.sisa)});});
  return rows.map(r=>({id:r.id,name:r.name,type:r.type,total:Number(r.total),sisa:Number(r.sisa),bunga:Number(r.bunga),cicilan:Number(r.cicilan),jatuh:r.jatuh,balanceHistory:hM[r.id]||[],dateAdded:r.date_added}));
}

async function addDebt(userId,data){
  await tx(async(c)=>{
    await c.query(`INSERT INTO debts(id,user_id,name,type,total,sisa,bunga,cicilan,jatuh,date_added) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [data.id,userId,data.name,data.type,data.total||0,data.sisa||0,data.bunga||0,data.cicilan||0,data.jatuh||'',data.dateAdded||new Date().toISOString().slice(0,10)]);
    if(data.balanceHistory?.length) for(const bh of data.balanceHistory)
      await c.query(`INSERT INTO debt_balance_history(debt_id,date,sisa) VALUES($1,$2,$3) ON CONFLICT(debt_id,date) DO UPDATE SET sisa=$3`,[data.id,bh.date,bh.sisa]);
  });
}

async function updateDebt(userId,id,data){
  await tx(async(c)=>{
    const ck=await c.query(`SELECT id FROM debts WHERE id=$1 AND user_id=$2`,[id,userId]);
    if(!ck.rows.length) throw new NotFoundError('Debt tidak ditemukan.');
    const fs=[],vs=[];let i=1;
    for(const col of ['name','type','total','sisa','bunga','cicilan','jatuh'])
      if(data[col]!==undefined){fs.push(`${col}=$${i++}`);vs.push(data[col]);}
    if(fs.length){vs.push(id);await c.query(`UPDATE debts SET ${fs.join(',')} WHERE id=$${i}`,vs);}
    if(data.balanceHistory!==undefined){
      await c.query(`DELETE FROM debt_balance_history WHERE debt_id=$1`,[id]);
      for(const bh of data.balanceHistory)
        await c.query(`INSERT INTO debt_balance_history(debt_id,date,sisa) VALUES($1,$2,$3)`,[id,bh.date,bh.sisa]);
    }
  });
}

async function deleteDebt(userId,id){
  const r=await q(`DELETE FROM debts WHERE id=$1 AND user_id=$2 RETURNING id`,[id,userId]);
  if(!r.length) throw new NotFoundError('Debt tidak ditemukan.');
}

// ─── PAID DEBTS ───────────────────────────────────────────────────────────────
async function getPaidDebts(userId){
  const rows=await q(`SELECT data FROM paid_debts WHERE user_id=$1`,[userId]);
  return rows.map(r=>JSON.parse(r.data));
}
async function setPaidDebts(userId,list){
  await tx(async(c)=>{
    await c.query(`DELETE FROM paid_debts WHERE user_id=$1`,[userId]);
    for(const item of list)
      await c.query(`INSERT INTO paid_debts(user_id,debt_id,data) VALUES($1,$2,$3)`,
        [userId,item.id||item,JSON.stringify(item)]);
  });
}

// ─── GOALS ────────────────────────────────────────────────────────────────────
async function getGoals(userId){
  const rows=await q(`SELECT id,name,target,current,deadline,color,date_added FROM goals WHERE user_id=$1 ORDER BY date_added`,[userId]);
  return rows.map(r=>({id:r.id,name:r.name,target:Number(r.target),current:Number(r.current),deadline:r.deadline,color:r.color,dateAdded:r.date_added}));
}
async function addGoal(userId,data){
  await q(`INSERT INTO goals(id,user_id,name,target,current,deadline,color,date_added) VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
    [data.id,userId,data.name,data.target||0,data.current||0,data.deadline||'',data.color||'#1a6b4a',data.dateAdded||new Date().toISOString().slice(0,10)]);
}
async function updateGoal(userId,id,data){
  const ck=await q(`SELECT id FROM goals WHERE id=$1 AND user_id=$2`,[id,userId]);
  if(!ck.length) throw new NotFoundError('Goal tidak ditemukan.');
  const fs=[],vs=[];let i=1;
  for(const col of ['name','target','current','deadline','color'])
    if(data[col]!==undefined){fs.push(`${col}=$${i++}`);vs.push(data[col]);}
  if(fs.length){vs.push(id);await q(`UPDATE goals SET ${fs.join(',')} WHERE id=$${i}`,vs);}
}
async function deleteGoal(userId,id){
  const r=await q(`DELETE FROM goals WHERE id=$1 AND user_id=$2 RETURNING id`,[id,userId]);
  if(!r.length) throw new NotFoundError('Goal tidak ditemukan.');
}

// ─── TRANSACTIONS ─────────────────────────────────────────────────────────────
async function getTransactions(userId,{page=1,limit=20}={}){
  const offset=(page-1)*limit;
  const [rows,cr]=await Promise.all([
    q(`SELECT id,cat,name,date,amount,cat_color,cat_name,COALESCE(notes,'') AS notes,date_added FROM transactions WHERE user_id=$1 ORDER BY date_added DESC LIMIT $2 OFFSET $3`,[userId,limit,offset]),
    q(`SELECT COUNT(*)::int AS total FROM transactions WHERE user_id=$1`,[userId]),
  ]);
  const total=cr[0]?.total||0;
  return{items:rows.map(r=>({id:r.id,cat:r.cat,name:r.name,date:r.date,amount:Number(r.amount),catColor:r.cat_color,catName:r.cat_name,notes:r.notes,dateAdded:r.date_added})),total,page,limit,totalPages:Math.ceil(total/limit)};
}
async function addTransaction(userId,data){
  await q(`INSERT INTO transactions(id,user_id,cat,name,date,amount,cat_color,cat_name,notes,date_added) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [data.id,userId,data.cat||'',data.name,data.date||'',data.amount||0,data.catColor||'#888888',data.catName||'',data.notes||'',data.dateAdded||new Date().toISOString().slice(0,10)]);
}
async function updateTransaction(userId,id,data){
  const ck=await q(`SELECT id FROM transactions WHERE id=$1 AND user_id=$2`,[id,userId]);
  if(!ck.length) throw new NotFoundError('Transaksi tidak ditemukan.');
  const fs=[],vs=[];let i=1;
  for(const[col,key] of [['cat','cat'],['name','name'],['date','date'],['amount','amount'],['cat_color','catColor'],['cat_name','catName'],['notes','notes']])
    if(data[key]!==undefined){fs.push(`${col}=$${i++}`);vs.push(data[key]);}
  if(fs.length){vs.push(id);await q(`UPDATE transactions SET ${fs.join(',')} WHERE id=$${i}`,vs);}
}
async function deleteTransaction(userId,id){
  const r=await q(`DELETE FROM transactions WHERE id=$1 AND user_id=$2 RETURNING id`,[id,userId]);
  if(!r.length) throw new NotFoundError('Transaksi tidak ditemukan.');
}

// ─── SETTINGS (with cache) ────────────────────────────────────────────────────
async function getSettings(userId){
  const cached=_scGet(userId);
  if(cached) return cached;
  const rows=await q(`SELECT key,value FROM settings WHERE user_id=$1`,[userId]);
  if(!rows.length){_scSet(userId,DEFAULT_DATA.settings);return DEFAULT_DATA.settings;}
  const out={...DEFAULT_DATA.settings};
  for(const r of rows){try{out[r.key]=JSON.parse(r.value);}catch{out[r.key]=r.value;}}
  _scSet(userId,out);
  return out;
}
async function updateSettings(userId,data){
  await tx(async(c)=>{
    for(const[k,v] of Object.entries(data))
      await c.query(`INSERT INTO settings(user_id,key,value) VALUES($1,$2,$3) ON CONFLICT(user_id,key) DO UPDATE SET value=$3`,
        [userId,k,JSON.stringify(v)]);
  });
  _scDel(userId);
}

// ─── FULL STATE ───────────────────────────────────────────────────────────────
async function getState(userId){
  const[cf,a,d,g,tx2,pd,st]=await Promise.all([
    getCashflows(userId),getAssets(userId),getDebts(userId),getGoals(userId),
    getTransactions(userId,{page:1,limit:20}),getPaidDebts(userId),getSettings(userId),
  ]);
  return{cashflows:cf,assets:a,debts:d,goals:g,paidDebts:pd,
    transactions:tx2.items,transactionsMeta:{total:tx2.total,page:1,limit:20,totalPages:tx2.totalPages},...st};
}

// ─── RESET ────────────────────────────────────────────────────────────────────
async function resetToDefault(userId){
  await tx(async(c)=>{
    for(const t of ['cashflows','assets','debts','goals','transactions','paid_debts','settings','checkpoints'])
      await c.query(`DELETE FROM ${t} WHERE user_id=$1`,[userId]);
  });
  _scDel(userId);
}

// ─── CHECKPOINT ───────────────────────────────────────────────────────────────
const MAX_CPS=10;

async function createCheckpoint(userId,label){
  // Fetch all transactions for a complete snapshot — getState() is limited to
  // page 1 (20 items), so we override transactions with a full fetch here.
  const [base, txAll] = await Promise.all([
    getState(userId),
    getTransactions(userId, {page:1, limit:100_000}),
  ]);
  const snap = {...base, transactions: txAll.items};
  const id='cp_'+Date.now();
  await tx(async(c)=>{
    const list=await c.query(`SELECT id FROM checkpoints WHERE user_id=$1 ORDER BY saved_at ASC`,[userId]);
    if(list.rows.length>=MAX_CPS) await c.query(`DELETE FROM checkpoints WHERE id=$1`,[list.rows[0].id]);
    await c.query(`INSERT INTO checkpoints(id,user_id,label,snapshot) VALUES($1,$2,$3,$4)`,
      [id,userId,label||null,JSON.stringify(snap)]);
  });
  return{id,label:label||null,savedAt:new Date().toISOString()};
}
async function listCheckpoints(userId){
  const rows=await q(`SELECT id,label,saved_at FROM checkpoints WHERE user_id=$1 ORDER BY saved_at DESC`,[userId]);
  return rows.map(r=>({id:r.id,label:r.label,savedAt:r.saved_at}));
}
async function restoreNamedCheckpoint(userId,id){
  const rows=await q(`SELECT snapshot FROM checkpoints WHERE id=$1 AND user_id=$2`,[id,userId]);
  if(!rows.length) throw new NotFoundError('Checkpoint tidak ditemukan.');
  await _applySnapshot(userId,rows[0].snapshot);
}
async function deleteCheckpoint(userId,id){
  const r=await q(`DELETE FROM checkpoints WHERE id=$1 AND user_id=$2 RETURNING id`,[id,userId]);
  if(!r.length) throw new NotFoundError('Checkpoint tidak ditemukan.');
}

async function _applySnapshot(userId,snapshot){
  const s=typeof snapshot==='string'?JSON.parse(snapshot):snapshot;
  // Seluruh operasi dalam SATU transaksi — jika ada yang gagal, semua di-rollback
  // dan data user tetap utuh (tidak ada data loss partial).
  await tx(async(c)=>{
    // Hapus semua data user (CASCADE tangani child tables)
    for(const t of ['cashflows','assets','debts','goals','transactions','paid_debts','settings','checkpoints'])
      await c.query(`DELETE FROM ${t} WHERE user_id=$1`,[userId]);

    // Cashflows
    for(const cf of (s.cashflows||[])){
      await c.query(
        `INSERT INTO cashflows(id,user_id,month,income,date_added) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING`,
        [cf.id,userId,cf.month,cf.income||0,cf.dateAdded||new Date().toISOString().slice(0,10)]);
      if(cf.expenses) for(const[k,v] of Object.entries(cf.expenses))
        await c.query(`INSERT INTO cashflow_expenses(cashflow_id,category,amount,notes) VALUES($1,$2,$3,$4)`,
          [cf.id,k,v,cf.expenseNotes?.[k]||'']);
      if(cf.incomeBreakdown) for(const[k,v] of Object.entries(cf.incomeBreakdown))
        await c.query(`INSERT INTO cashflow_income_bdown(cashflow_id,source,amount,notes) VALUES($1,$2,$3,$4)`,
          [cf.id,k,v,cf.incomeNotes?.[k]||'']);
    }

    // Assets
    for(const a of (s.assets||[])){
      await c.query(
        `INSERT INTO assets(id,user_id,name,sub,type,value,cost,date_added) VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
        [a.id,userId,a.name,a.sub||'',a.type,a.value||0,a.cost||0,a.dateAdded||new Date().toISOString().slice(0,10)]);
      if(a.priceHistory?.length) for(const ph of a.priceHistory)
        await c.query(`INSERT INTO asset_price_history(asset_id,date,price) VALUES($1,$2,$3)`,
          [a.id,ph.date,ph.price??ph.value??0]);
    }

    // Debts
    for(const d of (s.debts||[])){
      await c.query(
        `INSERT INTO debts(id,user_id,name,type,total,sisa,bunga,cicilan,jatuh,date_added) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [d.id,userId,d.name,d.type,d.total||0,d.sisa||0,d.bunga||0,d.cicilan||0,d.jatuh||'',d.dateAdded||new Date().toISOString().slice(0,10)]);
      if(d.balanceHistory?.length) for(const bh of d.balanceHistory)
        await c.query(`INSERT INTO debt_balance_history(debt_id,date,sisa) VALUES($1,$2,$3)`,
          [d.id,bh.date,bh.sisa]);
    }

    // Goals
    for(const g of (s.goals||[]))
      await c.query(
        `INSERT INTO goals(id,user_id,name,target,current,deadline,color,date_added) VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
        [g.id,userId,g.name,g.target||0,g.current||0,g.deadline||'',g.color||'#1a6b4a',g.dateAdded||new Date().toISOString().slice(0,10)]);

    // Transactions
    for(const t of (s.transactions||[]))
      await c.query(
        `INSERT INTO transactions(id,user_id,cat,name,date,amount,cat_color,cat_name,notes,date_added) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [t.id,userId,t.cat||'',t.name,t.date||'',t.amount||0,t.catColor||'#888888',t.catName||'',t.notes||'',t.dateAdded||new Date().toISOString().slice(0,10)]);

    // Paid debts
    for(const item of (s.paidDebts||[]))
      await c.query(`INSERT INTO paid_debts(user_id,debt_id,data) VALUES($1,$2,$3)`,
        [userId,item.id||item,JSON.stringify(item)]);

    // Settings
    const{cashflows:_c,assets:_a,debts:_d,goals:_g,transactions:_t,paidDebts:_p,transactionsMeta:_tm,...sData}=s;
    for(const[k,v] of Object.entries(sData))
      await c.query(`INSERT INTO settings(user_id,key,value) VALUES($1,$2,$3) ON CONFLICT(user_id,key) DO UPDATE SET value=$3`,
        [userId,k,JSON.stringify(v)]);
  });
  _scDel(userId);
}

// Legacy aliases
async function saveCheckpoint(userId){return createCheckpoint(userId,null);}
async function checkpointInfo(userId){
  const rows=await q(`SELECT saved_at FROM checkpoints WHERE user_id=$1 ORDER BY saved_at DESC LIMIT 1`,[userId]);
  return rows.length?{exists:true,savedAt:rows[0].saved_at}:{exists:false,savedAt:null};
}
async function restoreCheckpoint(userId){
  const rows=await q(`SELECT id FROM checkpoints WHERE user_id=$1 ORDER BY saved_at DESC LIMIT 1`,[userId]);
  if(!rows.length) throw new NotFoundError('Belum ada checkpoint tersimpan.');
  return restoreNamedCheckpoint(userId,rows[0].id);
}

// ─── USERS & SESSIONS ─────────────────────────────────────────────────────────
async function createUser({email,username,passwordHash,passwordSalt}){
  const rows=await q(`INSERT INTO users(email,username,password_hash,password_salt) VALUES($1,$2,$3,$4) RETURNING id,email,username`,
    [email.toLowerCase().trim(),username||'Pengguna',passwordHash,passwordSalt]);
  return rows[0];
}
async function findUserByEmail(email){
  const rows=await q(`SELECT id,email,username,password_hash,password_salt FROM users WHERE email=$1`,[email.toLowerCase().trim()]);
  return rows[0]||null;
}
async function findUserById(id){
  const rows=await q(`SELECT id,email,username,created_at FROM users WHERE id=$1`,[id]);
  return rows[0]||null;
}
async function updateUsername(userId,username){await q(`UPDATE users SET username=$1 WHERE id=$2`,[username,userId]);}
async function updatePassword(userId,hash,salt){await q(`UPDATE users SET password_hash=$1,password_salt=$2 WHERE id=$3`,[hash,salt,userId]);}
async function updateAvatar(userId,avatar){await q(`UPDATE users SET avatar=$1 WHERE id=$2`,[avatar,userId]);}
async function getAvatar(userId){const r=await q(`SELECT avatar FROM users WHERE id=$1`,[userId]);return r[0]?.avatar||null;}
async function deleteUser(userId){await q(`DELETE FROM users WHERE id=$1`,[userId]);}

async function createSession(userId,ttlMs=2*60*60*1000){
  const{randomBytes}=require('crypto');
  const token=randomBytes(32).toString('hex');
  await q(`INSERT INTO sessions(token,user_id,expires_at) VALUES($1,$2,$3)`,[token,userId,new Date(Date.now()+ttlMs)]);
  return token;
}
async function validateSession(token){
  if(!token||!/^[a-f0-9]{64}$/.test(token)) return null;
  const rows=await q(`SELECT user_id FROM sessions WHERE token=$1 AND expires_at>NOW()`,[token]);
  if(!rows.length) return null;
  return rows[0].user_id;
}
// Bersihkan sesi kadaluarsa setiap 10 menit — bukan saat setiap auth request
setInterval(()=>{ q(`DELETE FROM sessions WHERE expires_at<NOW()`).catch(()=>{}); }, 10*60*1000).unref();
async function destroySession(token){await q(`DELETE FROM sessions WHERE token=$1`,[token]);}
async function destroyAllSessionsForUser(userId){await q(`DELETE FROM sessions WHERE user_id=$1`,[userId]);}
async function healthCheck(){await ping();}

module.exports = {
  initSchema,ping,healthCheck,
  getCashflows,addCashflow,updateCashflow,deleteCashflow,
  getAssets,addAsset,updateAsset,deleteAsset,
  getDebts,addDebt,updateDebt,deleteDebt,
  getPaidDebts,setPaidDebts,
  getGoals,addGoal,updateGoal,deleteGoal,
  getTransactions,addTransaction,updateTransaction,deleteTransaction,
  getSettings,updateSettings,getState,resetToDefault,
  saveCheckpoint,checkpointInfo,restoreCheckpoint,
  listCheckpoints,createCheckpoint,restoreNamedCheckpoint,deleteCheckpoint,
  createUser,findUserByEmail,findUserById,updateUsername,deleteUser,
  updateAvatar,getAvatar,updatePassword,
  createSession,validateSession,destroySession,destroyAllSessionsForUser,
  DEFAULT_DATA,
};
