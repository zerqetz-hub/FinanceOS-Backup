// ── checkpoint.js — save/restore checkpoints and multi-snapshot manager ──────
// @requires api.js (API), state.js (syncPaidDebts), ui.js (showToast)
'use strict';

/** Load single-checkpoint info from server and update navbar UI. */
async function loadCheckpointInfo() {
  try {
    const info = await API.get('/api/checkpoint/info');
    _updateCheckpointUI(info.exists, info.savedAt);
  } catch (e) {}
}

/** Update the checkpoint timestamp label and Restore button state.
 * @param {boolean} exists
 * @param {string|null} savedAt - ISO timestamp. */
function _updateCheckpointUI(exists, savedAt) {
  const meta = document.getElementById('checkpointMeta');
  const btn  = document.getElementById('restoreBtn');
  if (exists && savedAt) {
    const d     = new Date(savedAt);
    const label = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
                + ' ' + d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    if (meta) meta.textContent = label;
    if (btn)  btn.disabled = false;
  } else {
    if (meta) meta.textContent = 'Belum ada save';
    if (btn)  btn.disabled = true;
  }
}

/** Flush WAL + copy DB file to checkpoint. Updates navbar UI on success. */
async function saveCheckpoint() {
  const labelInput = document.getElementById('cpLabelInput');
  const label = labelInput ? labelInput.value.trim() : '';
  const saveBtn = document.getElementById('cpSaveBtn');
  if (saveBtn) { saveBtn.textContent = '⏳...'; saveBtn.disabled = true; }
  const btn = document.querySelector('.save-checkpoint-btn');
  if (btn) btn.disabled = true;
  try {
    await syncPaidDebts();
    const res = await API.post('/api/checkpoint/save', { label });
    _updateCheckpointUI(true, res.savedAt);
    showToast('💾 Checkpoint tersimpan — ' + new Date(res.savedAt).toLocaleTimeString('id-ID'), 'success');
  } catch (e) {
    showToast('⚠️ Gagal menyimpan checkpoint');
  } finally {
    if (btn) { btn.textContent = '💾 Save'; btn.disabled = false; }
  }
}

/** Restore database from the latest single checkpoint, then reload. */
async function restoreCheckpoint() {
  const ok = await showConfirm('Kembalikan ke save terakhir?', 'Perubahan setelah save terakhir akan hilang.');
  if (!ok) return;
  try {
    await API.post('/api/checkpoint/restore', {});
    showToast('↩ Data dikembalikan ke checkpoint terakhir');
    setTimeout(() => location.reload(), 1000);
  } catch (e) {
    showToast('⚠️ ' + (e.message || 'Gagal restore checkpoint'));
  }
}

// ─── MULTI-SNAPSHOT MODAL ────────────────────────────────────────────────────
/** Open the multi-snapshot manager modal and load the snapshot list. */
function openCheckpointModal() {
  document.getElementById('cpModal').style.display = 'flex';
  _loadCPList();
}

/** Close the multi-snapshot manager modal. */
function closeCPModal() {
  document.getElementById('cpModal').style.display = 'none';
}

/** Fetch and render the snapshot list inside the manager modal. Uses DOM API to prevent XSS on snapshot labels. */
async function _loadCPList() {
  const el = document.getElementById('cpList');
  el.innerHTML = '<div style="color:var(--text3);font-size:13px;padding:8px 0">Memuat...</div>';
  try {
    const list = await API.get('/api/checkpoints');
    if (!list.length) {
      el.innerHTML = '<div class="empty-state" style="padding:20px 0"><div class="icon">💾</div>Belum ada snapshot tersimpan</div>';
      return;
    }
    // Use DOM API — cp.label is user-supplied text, never injected via innerHTML
    el.innerHTML = '';
    list.forEach(cp => {
      const d   = new Date(cp.savedAt);
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border)';

      const info = document.createElement('div');
      info.style.cssText = 'flex:1;min-width:0';

      const lblEl = document.createElement('span');
      if (cp.label) {
        lblEl.style.fontWeight = '500';
        lblEl.textContent = cp.label;
      } else {
        lblEl.style.cssText = 'color:var(--text3);font-style:italic';
        lblEl.textContent = 'Tanpa nama';
      }

      const metaEl = document.createElement('div');
      metaEl.style.cssText = 'font-size:11px;color:var(--text3);margin-top:2px';
      metaEl.textContent = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
        + ' ' + d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

      info.appendChild(lblEl);
      info.appendChild(metaEl);

      const restoreBtn = document.createElement('button');
      restoreBtn.textContent = '↩ Restore';
      restoreBtn.style.cssText = 'padding:5px 11px;background:var(--accent-light);color:var(--accent);border:1px solid var(--accent);border-radius:6px;font-size:12px;font-weight:500;cursor:pointer;white-space:nowrap';
      restoreBtn.onclick = () => doRestoreCP(cp.id);

      const delBtn = document.createElement('button');
      delBtn.textContent = '✕';
      delBtn.title = 'Hapus';
      delBtn.style.cssText = 'padding:5px 9px;background:none;color:var(--text3);border:1px solid var(--border);border-radius:6px;font-size:12px;cursor:pointer';
      delBtn.onclick = () => doDeleteCP(cp.id);

      row.appendChild(info);
      row.appendChild(restoreBtn);
      row.appendChild(delBtn);
      el.appendChild(row);
    });
  } catch (e) {
    el.innerHTML = `<div style="color:var(--red);font-size:13px;padding:8px 0">Gagal memuat: ${e.message}</div>`;
  }
}

/** Create a new named snapshot from the label input, then refresh the list. */
async function doCreateCP() {
  const label = document.getElementById('cpLabelInput').value.trim();
  try {
    await syncPaidDebts();
    const res = await API.post('/api/checkpoints', { label });
    if (res.ok) {
      document.getElementById('cpLabelInput').value = '';
      showToast(`💾 Snapshot "${label || 'Tanpa nama'}" tersimpan`, 'success');
      _updateCheckpointUI(true, res.checkpoint.savedAt);
      _loadCPList();
    }
  } catch { showToast('⚠️ Gagal menyimpan snapshot'); }
}

/** Restore from a specific named snapshot by id, then close modal and reload.
 * @param {string} id */
async function doRestoreCP(id) {
  const ok = await showConfirm('Restore ke snapshot ini?', 'Semua perubahan setelah snapshot akan hilang.', 'Restore');
  if (!ok) return;
  try {
    await API.post(`/api/checkpoints/${id}/restore`, {});
    showToast('↩ Data dikembalikan ke snapshot');
    closeCPModal();
    setTimeout(() => location.reload(), 800);
  } catch (e) { showToast('⚠️ ' + (e.message || 'Gagal restore')); }
}

/** Permanently delete a named snapshot by id.
 * @param {string} id */
async function doDeleteCP(id) {
  const ok = await showConfirm('Hapus snapshot ini?', 'Snapshot ini tidak dapat dipulihkan kembali.', 'Hapus');
  if (!ok) return;
  try {
    await API.del(`/api/checkpoints/${id}`);
    showToast('🗑️ Snapshot dihapus', 'success');
    _loadCPList();
  } catch { showToast('⚠️ Gagal menghapus snapshot'); }
}
