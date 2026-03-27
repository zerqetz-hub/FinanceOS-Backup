// ── profile.js — halaman profil lengkap v5.5 ──────────────────────────────
// @requires api.js (API), ui.js (showToast, closeModal), state.js (S)
'use strict';

// ─── RENDER HALAMAN PROFIL ───────────────────────────────────────────────────

async function renderProfile() {
  const el = document.getElementById('page-profile');
  if (!el) return;

  // Tampilkan loading sementara
  el.innerHTML = `<div style="padding:40px;text-align:center;color:var(--text3);font-size:14px">Memuat profil...</div>`;

  let me = {};
  try { me = await API.get('/api/auth/me'); } catch {}

  const name    = me.username || 'Pengguna';
  const email   = me.email    || '';
  const initial = name.charAt(0).toUpperCase();
  const joined  = me.createdAt ? new Date(me.createdAt).toLocaleDateString('id-ID', { year:'numeric', month:'long', day:'numeric' }) : '—';

  el.innerHTML = `
    <div style="max-width:600px;margin:0 auto">
      <div class="page-title">Profil &amp; Pengaturan</div>
      <div class="page-subtitle" style="margin-bottom:28px">Kelola akun dan preferensi kamu</div>

      <!-- KARTU IDENTITAS -->
      <div class="card" style="margin-bottom:20px">
        <div style="display:flex;align-items:center;gap:20px">
          <!-- Avatar -->
          <div id="profileAvatarWrap" style="position:relative;flex-shrink:0">
            <div id="profileAvatar" style="
              width:72px;height:72px;border-radius:50%;
              background:var(--accent-light,#e8f5ee);
              display:flex;align-items:center;justify-content:center;
              font-size:26px;font-weight:600;color:var(--accent);
              cursor:pointer;overflow:hidden;
              background-size:cover;background-position:center;
              border:2px solid var(--border);position:relative
            " onclick="openAvatarPicker()" title="Klik untuk ganti foto">
              <span id="profileAvatarInitial">${initial}</span>
            </div>
            <div onclick="openAvatarPicker()" style="
              position:absolute;bottom:0;right:0;
              width:22px;height:22px;border-radius:50%;
              background:var(--accent);color:#fff;
              display:flex;align-items:center;justify-content:center;
              cursor:pointer;border:2px solid var(--surface);font-size:11px
            " title="Ganti foto">✏️</div>
          </div>
          <!-- Info -->
          <div style="flex:1;min-width:0">
            <div id="profileNameDisplay" style="font-size:18px;font-weight:600;color:var(--text);margin-bottom:3px">${esc(name)}</div>
            <div style="font-size:13px;color:var(--text2);margin-bottom:6px">${esc(email)}</div>
            <div style="font-size:12px;color:var(--text3)">Bergabung ${joined}</div>
          </div>
          <!-- Tombol ganti nama -->
          <button class="btn btn-ghost" onclick="toggleRenameForm()" style="flex-shrink:0;font-size:13px">✏️ Ganti Nama</button>
        </div>

        <!-- Form ganti username (hidden by default) -->
        <div id="renameForm" style="display:none;margin-top:16px;padding-top:16px;border-top:1px solid var(--border)">
          <div class="form-grid">
            <div class="form-group full">
              <label>Username Baru</label>
              <input type="text" id="renameInput" value="${esc(name)}" placeholder="Nama tampilan" maxlength="40">
            </div>
          </div>
          <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:10px">
            <button class="btn btn-ghost" onclick="toggleRenameForm()">Batal</button>
            <button class="btn btn-primary" onclick="submitRename()">💾 Simpan Nama</button>
          </div>
        </div>
      </div>

      <!-- KEAMANAN -->
      <div class="card" style="margin-bottom:20px">
        <div style="font-size:13px;font-weight:600;color:var(--text);margin-bottom:14px">🔒 Keamanan</div>
        <div style="display:flex;align-items:center;justify-content:space-between">
          <div>
            <div style="font-size:14px;color:var(--text2)">Password</div>
            <div style="font-size:12px;color:var(--text3)">Ganti password akun kamu secara berkala</div>
          </div>
          <button class="btn btn-ghost" onclick="openChangePwModal()" style="font-size:13px">🔑 Ganti Password</button>
        </div>
      </div>

      <!-- DATA -->
      <div class="card" style="margin-bottom:20px">
        <div style="font-size:13px;font-weight:600;color:var(--text);margin-bottom:14px">📂 Data Keuangan</div>
        <div style="display:flex;flex-direction:column;gap:14px">
          <!-- Download -->
          <div style="display:flex;align-items:center;justify-content:space-between">
            <div>
              <div style="font-size:14px;color:var(--text2)">Unduh Data</div>
              <div style="font-size:12px;color:var(--text3)">Ekspor semua data ke file JSON</div>
            </div>
            <button class="btn btn-ghost" onclick="downloadData()" style="font-size:13px">⬇️ Unduh JSON</button>
          </div>
          <!-- Reset -->
          <div style="border-top:1px solid var(--border);padding-top:14px;display:flex;align-items:center;justify-content:space-between">
            <div>
              <div style="font-size:14px;color:var(--text2)">Reset Data</div>
              <div style="font-size:12px;color:var(--text3)">Hapus semua data keuangan, mulai dari awal</div>
            </div>
            <button class="btn btn-ghost" onclick="confirmResetData()" style="font-size:13px;color:var(--red,#c23b3b);border-color:var(--red,#c23b3b)">🗑 Reset Data</button>
          </div>
        </div>
      </div>

      <!-- DANGER ZONE -->
      <div class="card" style="margin-bottom:20px;border-color:rgba(194,59,59,.3)">
        <div style="font-size:13px;font-weight:600;color:var(--red,#c23b3b);margin-bottom:14px">⚠️ Danger Zone</div>
        <div style="display:flex;align-items:center;justify-content:space-between">
          <div>
            <div style="font-size:14px;color:var(--text2)">Hapus Akun</div>
            <div style="font-size:12px;color:var(--text3)">Permanen — semua data kamu akan dihapus selamanya</div>
          </div>
          <button class="btn" onclick="openDeleteAccountModal()"
            style="font-size:13px;background:#c23b3b;color:#fff;border:none;padding:7px 14px;border-radius:6px;cursor:pointer">
            Hapus Akun
          </button>
        </div>
      </div>

      <!-- LOGOUT -->
      <div style="text-align:center;padding-bottom:32px">
        <button class="btn" onclick="authLogout()"
          style="font-size:14px;color:var(--red,#c23b3b);border-color:var(--red,#c23b3b);padding:9px 28px">
          <svg style="width:13px;height:13px;margin-right:6px;vertical-align:-1px" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2H3a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/><polyline points="11 11 14 8 11 5"/><line x1="14" y1="8" x2="6" y2="8"/></svg>Keluar dari Akun
        </button>
      </div>
    </div>`;

  // Load avatar jika ada
  if (me.avatar) _applyAvatarToProfile(me.avatar);
}

// ─── AVATAR ───────────────────────────────────────────────────────────────────

function openAvatarPicker() {
  const input = document.createElement('input');
  input.type   = 'file';
  input.accept = 'image/jpeg,image/png,image/webp';
  input.onchange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 500 * 1024) { showToast('Ukuran foto maksimal 500KB.', 'error'); return; }
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64 = ev.target.result;
      try {
        const res = await API.put('/api/auth/avatar', { avatar: base64 });
        if (res.error) { showToast(res.error, 'error'); return; }
        _applyAvatarToProfile(base64);
        _applyAvatarToHeader(base64);
        showToast('Foto profil diperbarui.', 'success');
      } catch (e) { showToast('Gagal upload foto: ' + e.message, 'error'); }
    };
    reader.readAsDataURL(file);
  };
  input.click();
}

function _applyAvatarToProfile(src) {
  const av = document.getElementById('profileAvatar');
  const init = document.getElementById('profileAvatarInitial');
  if (!av) return;
  if (src) {
    av.style.backgroundImage   = `url('${src}')`;
    av.style.backgroundSize    = 'cover';
    av.style.backgroundPosition = 'center';
    if (init) init.style.opacity = '0';
  } else {
    av.style.backgroundImage = '';
    if (init) init.style.opacity = '1';
  }
}

function _applyAvatarToHeader(src) {
  const btn    = document.getElementById('avatarBtn');
  const initEl = document.getElementById('avatarInitial');
  if (!btn) return;
  if (src) {
    btn.style.backgroundImage    = `url('${src}')`;
    btn.style.backgroundSize     = 'cover';
    btn.style.backgroundPosition = 'center';
    if (initEl) initEl.style.opacity = '0';
  } else {
    btn.style.backgroundImage = '';
    if (initEl) initEl.style.opacity = '1';
  }
}

/** Load avatar dari server saat boot */
async function loadAvatar() {
  try {
    const me = await API.get('/api/auth/me');
    if (me.avatar) _applyAvatarToHeader(me.avatar);
  } catch {}
}

// ─── RENAME ───────────────────────────────────────────────────────────────────

function toggleRenameForm() {
  const form = document.getElementById('renameForm');
  if (!form) return;
  const visible = form.style.display !== 'none';
  form.style.display = visible ? 'none' : 'block';
  if (!visible) setTimeout(() => document.getElementById('renameInput')?.focus(), 50);
}

async function submitRename() {
  const input = document.getElementById('renameInput');
  const name  = input?.value?.trim();
  if (!name || name.length < 1)  { showToast('Nama tidak boleh kosong.', 'error'); return; }
  if (name.length > 40)           { showToast('Nama maksimal 40 karakter.', 'error'); return; }
  try {
    const res = await API.put('/api/auth/username', { username: name });
    if (res.error) { showToast(res.error, 'error'); return; }
    // Update tampilan
    const nameDisplay = document.getElementById('profileNameDisplay');
    if (nameDisplay) nameDisplay.textContent = name;
    const initEl = document.getElementById('profileAvatarInitial');
    if (initEl) initEl.textContent = name.charAt(0).toUpperCase();
    // Update header avatar initial
    const headerInit = document.getElementById('avatarInitial');
    if (headerInit) headerInit.textContent = name.charAt(0).toUpperCase();
    const nameMenu = document.getElementById('avatarMenuName');
    if (nameMenu) nameMenu.textContent = name;
    toggleRenameForm();
    showToast('Username berhasil diperbarui.', 'success');
  } catch (e) { showToast('Gagal: ' + e.message, 'error'); }
}

// ─── DATA ─────────────────────────────────────────────────────────────────────

function downloadData() {
  const a = document.createElement('a');
  a.href     = '/api/auth/export';
  a.download = 'kepinguang-data.json';
  a.click();
  showToast('Mengunduh data...', 'success');
}

async function confirmResetData() {
  const ok = await showConfirm(
    'Reset semua data?',
    'Tindakan ini akan menghapus semua cash flow, aset, hutang, goals, dan transaksi. Tidak bisa dibatalkan.',
    'Reset'
  );
  if (!ok) return;
  try {
    await API.post('/api/reset', {});
    await loadStore();
    renderAll();
    showToast('Data berhasil direset.', 'success');
  } catch (e) { showToast('Gagal reset: ' + e.message, 'error'); }
}

// ─── GANTI PASSWORD ───────────────────────────────────────────────────────────

function openChangePwModal() {
  document.getElementById('modalOverlay').style.display = 'flex';
  document.getElementById('modalTitle').textContent = 'Ganti Password';
  document.getElementById('modalContent').innerHTML = `
    <div class="form-grid">
      <div class="form-group full">
        <label>Password Lama</label>
        <input type="password" id="cp_old" placeholder="Password saat ini" autocomplete="current-password">
      </div>
      <div class="form-group full">
        <label>Password Baru</label>
        <input type="password" id="cp_new" placeholder="Min 8 karakter, huruf + angka" autocomplete="new-password">
      </div>
      <div class="form-group full">
        <label>Konfirmasi Password Baru</label>
        <input type="password" id="cp_new2" placeholder="Ulangi password baru" autocomplete="new-password">
      </div>
      <div class="form-group full" id="cp_err" style="color:var(--red);font-size:13px;display:none"></div>
    </div>
    <div style="display:flex;gap:8px;margin-top:16px;justify-content:flex-end">
      <button class="btn btn-ghost" onclick="closeModal()">Batal</button>
      <button class="btn btn-primary" id="cpSubmitBtn" onclick="submitChangePw()">🔑 Ganti Password</button>
    </div>`;
  setTimeout(() => document.getElementById('cp_old')?.focus(), 50);
}

async function submitChangePw() {
  const errEl  = document.getElementById('cp_err');
  const oldPw  = document.getElementById('cp_old').value;
  const newPw  = document.getElementById('cp_new').value;
  const newPw2 = document.getElementById('cp_new2').value;
  const show   = msg => { errEl.textContent = msg; errEl.style.display = 'block'; };
  const btn    = document.getElementById('cpSubmitBtn');
  if (!oldPw)               return show('Masukkan password lama.');
  if (newPw.length < 8)     return show('Password baru minimal 8 karakter.');
  if (!/[A-Za-z]/.test(newPw)) return show('Password baru harus mengandung huruf.');
  if (!/[0-9]/.test(newPw))    return show('Password baru harus mengandung angka.');
  if (newPw !== newPw2)     return show('Konfirmasi password tidak cocok.');
  btn.disabled = true; btn.textContent = 'Menyimpan...';
  try {
    const res = await API.put('/api/auth/password', { oldPassword: oldPw, newPassword: newPw });
    if (res.error) { show(res.error); btn.disabled = false; btn.textContent = '🔑 Ganti Password'; return; }
    closeModal();
    showToast('Password berhasil diganti. Silakan login kembali.', 'success');
    setTimeout(() => authLogout(), 1500);
  } catch (e) {
    show('Gagal: ' + e.message);
    btn.disabled = false; btn.textContent = '🔑 Ganti Password';
  }
}

// ─── HAPUS AKUN ───────────────────────────────────────────────────────────────

function openDeleteAccountModal() {
  closeAvatarMenu();
  document.getElementById('modalOverlay').style.display = 'flex';
  document.getElementById('modalTitle').textContent = 'Hapus Akun';
  document.getElementById('modalContent').innerHTML = `
    <div style="background:rgba(194,59,59,.08);border:1px solid rgba(194,59,59,.3);border-radius:8px;padding:14px 16px;margin-bottom:16px;font-size:14px;color:var(--red,#c23b3b)">
      ⚠️ Tindakan ini <strong>permanen</strong> dan tidak bisa dibatalkan.<br>
      Semua data keuangan, aset, hutang, goals, dan transaksi akan dihapus selamanya.
    </div>
    <div class="form-grid">
      <div class="form-group full">
        <label>Konfirmasi Password</label>
        <input type="password" id="del_pw" placeholder="Masukkan password untuk konfirmasi" autocomplete="current-password">
      </div>
      <div class="form-group full" id="del_err" style="color:var(--red);font-size:13px;display:none"></div>
    </div>
    <div style="display:flex;gap:8px;margin-top:16px;justify-content:flex-end">
      <button class="btn btn-ghost" onclick="closeModal()">Batal</button>
      <button class="btn" id="delSubmitBtn" onclick="submitDeleteAccount()"
        style="background:#c23b3b;color:#fff;border:none;padding:8px 16px;border-radius:6px;cursor:pointer;font-size:14px">
        Hapus Akun Saya
      </button>
    </div>`;
  setTimeout(() => document.getElementById('del_pw')?.focus(), 50);
}

async function submitDeleteAccount() {
  const errEl = document.getElementById('del_err');
  const pw    = document.getElementById('del_pw').value;
  const btn   = document.getElementById('delSubmitBtn');
  const show  = msg => { errEl.textContent = msg; errEl.style.display = 'block'; };
  if (!pw) return show('Masukkan password untuk konfirmasi.');
  btn.disabled = true; btn.textContent = 'Menghapus...';
  try {
    const res = await fetch('/api/auth/account', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pw }),
    });
    const data = await res.json();
    if (data.error) { show(data.error); btn.disabled = false; btn.textContent = 'Hapus Akun Saya'; return; }
    closeModal();
    showToast('Akun berhasil dihapus. Sampai jumpa!', 'success');
    setTimeout(() => location.reload(), 1500);
  } catch (e) {
    show('Gagal: ' + e.message);
    btn.disabled = false; btn.textContent = 'Hapus Akun Saya';
  }
}
