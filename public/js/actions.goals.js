// ── actions.goals.js — goal CRUD ─────────────────────────────────────────────
// @requires api.js, state.js, helpers.js, ui.js, render.js
'use strict';

async function addGoal() {
  await withSubmitLock(async () => {
    const name = v('f_gname').trim();
    if (!name) { showFormError('Nama goal wajib diisi.'); return; }
    const target = vn('f_gtarget');
    if (!target || target <= 0) { showFormError('Target goal wajib diisi dan harus lebih dari 0.'); return; }
    const id = uid(); const dateAdded = new Date().toISOString().slice(0,10);
    const newG = {id, name, target, current:vn('f_gcurrent'), deadline:v('f_gdeadline')||'', color:v('f_gcolor'), dateAdded};
    S.goals.push(newG); closeModal(); renderAll();
    try {
      const _r = await API.post('/api/goals', newG);
      if (_r?.error) throw new Error(_r.error); flashSave();
      pushCommand(`Tambah goal ${name}`,
        async () => { S.goals = S.goals.filter(g => g.id !== id); await API.del(`/api/goals/${id}`); },
        async () => { S.goals.push(newG); await API.post('/api/goals', newG); }
      );
      showToast(`Goal "${name}" ditambahkan`, 'success');
    } catch(e) { S.goals = S.goals.filter(g => g.id !== id); renderAll(); showToast((e?.message || 'Gagal menyimpan ke server'), 'error'); }
  });
}

async function updateGoal(id) {
  const g = S.goals.find(g => g.id === id); if (!g) return;
  const _prev = JSON.parse(JSON.stringify(g));
  g.name = v('ef_gname').trim() || g.name;
  g.target = vn('ef_gtarget');
  g.current = vn('ef_gcurrent');
  g.deadline = v('ef_gdeadline');
  g.color = v('ef_gcolor') || g.color;
  g.dateAdded = v('ef_gdate') || g.dateAdded;
  const _next = JSON.parse(JSON.stringify(g));
  closeModal(); renderAll();
  try {
    const _r = await API.put(`/api/goals/${id}`, g);
    if (_r?.error) throw new Error(_r.error); flashSave();
    pushCommand(`Edit goal ${g.name}`,
      async () => { Object.assign(S.goals.find(x => x.id === id)||{}, _prev); await API.put(`/api/goals/${id}`, _prev); },
      async () => { Object.assign(S.goals.find(x => x.id === id)||{}, _next); await API.put(`/api/goals/${id}`, _next); }
    );
    showToast(`Goal "${g.name}" berhasil diperbarui`, 'success');
  } catch(e) { Object.assign(g, _prev); renderAll(); showToast((e?.message || 'Gagal menyimpan ke server'), 'error'); }
}
