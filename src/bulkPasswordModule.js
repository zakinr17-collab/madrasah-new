// ===========================================================================
// RESET PASSWORD SISWA MASSAL + KARTU AKUN
// - Pilih siswa (checkbox yang ada) atau satu kelas penuh
// - Mode: password seragam (admin tentukan) ATAU auto-generate unik per siswa
// - Hasil: daftar kredensial + tombol cetak kartu akun
// ===========================================================================

window.openBulkResetPasswordModal = function () {
  document.getElementById('bulk-reset-pw-modal')?.remove();
  const classes = window.appState?.classes || [];
  const modal = document.createElement('div');
  modal.id = 'bulk-reset-pw-modal';
  modal.className = 'fixed inset-0 z-[80] bg-black/50 flex items-center justify-center p-4';
  modal.innerHTML = `
    <div class="bg-white w-full max-w-lg rounded-3xl shadow-2xl p-5 space-y-4 max-h-[90vh] overflow-y-auto">
      <div class="flex items-center justify-between">
        <h3 class="text-base font-extrabold text-slate-800"><i class="fa-solid fa-key mr-2 text-amber-500"></i>Reset Password Siswa Massal</h3>
        <button onclick="document.getElementById('bulk-reset-pw-modal').remove()" class="w-8 h-8 rounded-lg hover:bg-slate-100 text-slate-500 cursor-pointer"><i class="fa-solid fa-xmark"></i></button>
      </div>
      <p class="text-xs text-slate-500">Pilih sumber siswa: pakai centang di tabel (kalau ada) atau satu kelas penuh.</p>
      <div>
        <label class="text-xs font-bold text-slate-600 block mb-1">Sumber siswa</label>
        <select id="brpw-source" class="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm">
          <option value="checked">Siswa yang dicentang di tabel</option>
          <option value="class">Satu kelas penuh</option>
        </select>
      </div>
      <div id="brpw-class-wrap" class="hidden">
        <label class="text-xs font-bold text-slate-600 block mb-1">Kelas</label>
        <select id="brpw-class" class="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm">
          ${classes.map(c => `<option value="${c.id}">${c.name || c.className || c.id}</option>`).join('')}
        </select>
      </div>
      <div>
        <label class="text-xs font-bold text-slate-600 block mb-1">Mode password</label>
        <div class="space-y-2">
          <label class="flex items-start gap-2 p-3 border border-slate-200 rounded-xl cursor-pointer hover:border-amber-300">
            <input type="radio" name="brpw-mode" value="uniform" checked class="mt-0.5">
            <span class="text-xs"><b>Password seragam</b> — semua siswa terpilih dapat password yang sama (boss tentukan sendiri).</span>
          </label>
          <label class="flex items-start gap-2 p-3 border border-slate-200 rounded-xl cursor-pointer hover:border-amber-300">
            <input type="radio" name="brpw-mode" value="generate" class="mt-0.5">
            <span class="text-xs"><b>Auto-generate unik</b> — setiap siswa dapat password acak berbeda (10 karakter, lebih aman). Disarankan.</span>
          </label>
        </div>
      </div>
      <div id="brpw-uniform-wrap">
        <label class="text-xs font-bold text-slate-600 block mb-1">Password seragam (min. 8 karakter)</label>
        <input id="brpw-password" type="text" placeholder="mis. kelas7aman2026" class="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm font-mono">
      </div>
      <div class="bg-amber-50 border border-amber-200 rounded-xl p-3 text-[11px] text-amber-800">
        <i class="fa-solid fa-triangle-exclamation mr-1"></i>Password lama siswa terpilih akan langsung diganti. Kartu akun akan muncul setelah proses selesai — siapkan printer/cetak PDF.
      </div>
      <div class="flex justify-end gap-2">
        <button onclick="document.getElementById('bulk-reset-pw-modal').remove()" class="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer">Batal</button>
        <button onclick="window.runBulkResetPassword()" class="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold cursor-pointer"><i class="fa-solid fa-rotate mr-1"></i>Reset Sekarang</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  modal.querySelector('#brpw-source').addEventListener('change', (e) => {
    modal.querySelector('#brpw-class-wrap').classList.toggle('hidden', e.target.value !== 'class');
  });
  modal.querySelectorAll('input[name="brpw-mode"]').forEach(r => r.addEventListener('change', () => {
    const mode = modal.querySelector('input[name="brpw-mode"]:checked').value;
    modal.querySelector('#brpw-uniform-wrap').classList.toggle('hidden', mode !== 'uniform');
  }));
};

window.runBulkResetPassword = async function () {
  const modal = document.getElementById('bulk-reset-pw-modal');
  const source = modal.querySelector('#brpw-source').value;
  const mode = modal.querySelector('input[name="brpw-mode"]:checked').value;
  const uniformPw = modal.querySelector('#brpw-password').value.trim();
  let ids = [];
  if (source === 'checked') {
    ids = Array.from(document.querySelectorAll('.student-page-checkbox:checked')).map(cb => cb.value);
    if (ids.length === 0) { showToast('Tidak ada siswa yang dicentang di tabel.', 'error'); return; }
  } else {
    const classId = modal.querySelector('#brpw-class').value;
    ids = (window.appState?.students || []).filter(s => String(s.classId) === String(classId)).map(s => s.id);
    if (ids.length === 0) { showToast('Kelas itu belum punya siswa.', 'error'); return; }
  }
  if (mode === 'uniform' && uniformPw.length < 8) { showToast('Password seragam minimal 8 karakter.', 'error'); return; }
  const btn = modal.querySelector('button[onclick="window.runBulkResetPassword()"]');
  btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1"></i>Memproses…';
  try {
    const res = await fetch('/api/admin/reset-student-passwords-bulk', {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, mode, password: mode === 'uniform' ? uniformPw : undefined }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.message || 'Gagal reset password.');
    window.showBulkResetResult(data.credentials || [], data.updated);
    modal.remove();
    showToast(`${data.updated} password siswa direset.`, 'success');
  } catch (e) {
    showToast(e.message || 'Gagal reset password.', 'error');
    btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-rotate mr-1"></i>Reset Sekarang';
  }
};

window.showBulkResetResult = function (credentials, updated) {
  document.getElementById('brpw-result-modal')?.remove();
  const modal = document.createElement('div');
  modal.id = 'brpw-result-modal';
  modal.className = 'fixed inset-0 z-[80] bg-black/50 flex items-center justify-center p-4';
  const rows = credentials.map(c => `
    <tr class="border-b border-slate-100">
      <td class="px-2 py-1.5">${c.name}</td>
      <td class="px-2 py-1.5 font-mono text-[11px]">${c.nis || '-'}</td>
      <td class="px-2 py-1.5 font-mono text-[11px]">${c.username}</td>
      <td class="px-2 py-1.5 font-mono text-[11px] font-bold text-emerald-700">${c.password}</td>
    </tr>`).join('');
  modal.innerHTML = `
    <div class="bg-white w-full max-w-2xl rounded-3xl shadow-2xl p-5 space-y-3 max-h-[90vh] flex flex-col">
      <div class="flex items-center justify-between">
        <h3 class="text-base font-extrabold text-slate-800"><i class="fa-solid fa-id-card mr-2 text-emerald-600"></i>Kartu Akun (${updated} siswa)</h3>
        <button onclick="document.getElementById('brpw-result-modal').remove()" class="w-8 h-8 rounded-lg hover:bg-slate-100 text-slate-500 cursor-pointer"><i class="fa-solid fa-xmark"></i></button>
      </div>
      <p class="text-xs text-slate-500">Password hanya ditampilkan <b>sekali ini</b>. Cetak atau salin sekarang.</p>
      <div class="overflow-auto border border-slate-200 rounded-xl max-h-[50vh]">
        <table class="w-full text-xs">
          <thead class="bg-slate-50 sticky top-0"><tr class="text-left text-slate-500">
            <th class="px-2 py-2">Nama</th><th class="px-2 py-2">NIS</th><th class="px-2 py-2">Username</th><th class="px-2 py-2">Password</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <div class="flex justify-end gap-2">
        <button onclick="window.copyBulkCredentials()" class="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"><i class="fa-solid fa-copy mr-1"></i>Salin Teks</button>
        <button onclick="window.printBulkCredentials()" class="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold cursor-pointer"><i class="fa-solid fa-print mr-1"></i>Cetak Kartu</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  modal.dataset.credentials = JSON.stringify(credentials);
};

window.copyBulkCredentials = function () {
  const modal = document.getElementById('brpw-result-modal');
  const creds = JSON.parse(modal.dataset.credentials || '[]');
  const text = creds.map(c => `${c.name} | NIS ${c.nis || '-'} | username: ${c.username} | password: ${c.password}`).join('\n');
  navigator.clipboard.writeText(text).then(() => showToast('Kredensial disalin ke clipboard.', 'success')).catch(() => showToast('Gagal menyalin.', 'error'));
};

window.printBulkCredentials = function () {
  const modal = document.getElementById('brpw-result-modal');
  const creds = JSON.parse(modal.dataset.credentials || '[]');
  const school = window.appState?.settings?.schoolName || 'Madrasah';
  const cards = creds.map(c => `
    <div class="card">
      <div class="school">${school}</div>
      <div class="title">Kartu Akun Siswa</div>
      <div class="row"><span>Nama</span><b>${c.name}</b></div>
      <div class="row"><span>NIS</span><b>${c.nis || '-'}</b></div>
      <div class="row"><span>Username</span><b>${c.username}</b></div>
      <div class="row"><span>Password</span><b>${c.password}</b></div>
    </div>`).join('');
  const w = window.open('', '_blank');
  w.document.write(`<!DOCTYPE html><html><head><title>Kartu Akun Siswa</title><style>
    body { font-family: Arial, sans-serif; padding: 16px; }
    .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
    .card { border: 1.5px solid #333; border-radius: 10px; padding: 10px 14px; page-break-inside: avoid; }
    .school { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #555; }
    .title { font-size: 14px; font-weight: bold; margin: 2px 0 8px; border-bottom: 1px dashed #999; padding-bottom: 6px; }
    .row { display: flex; justify-content: space-between; font-size: 12px; padding: 2px 0; }
    .row span { color: #666; }
    @media print { .no-print { display: none; } }
  </style></head><body>
  <button class="no-print" onclick="window.print()" style="margin-bottom:12px;padding:8px 16px;cursor:pointer;">🖨️ Cetak</button>
  <div class="grid">${cards}</div>
  <script>window.print();<\/script></body></html>`);
  w.document.close();
};

// ===========================================================================
// LAPORAN KECURANGAN (admin) — rekap pelanggaran lintas ujian
// ===========================================================================
window.openCheatingReportModal = async function () {
  document.getElementById('cheat-report-modal')?.remove();
  const modal = document.createElement('div');
  modal.id = 'cheat-report-modal';
  modal.className = 'fixed inset-0 z-[80] bg-black/50 flex items-center justify-center p-4';
  modal.innerHTML = `<div class="bg-white w-full max-w-2xl rounded-3xl shadow-2xl p-5 space-y-3 max-h-[90vh] flex flex-col">
    <div class="flex items-center justify-between">
      <h3 class="text-base font-extrabold text-slate-800"><i class="fa-solid fa-clipboard-list mr-2 text-rose-600"></i>Laporan Kecurangan Ujian</h3>
      <button onclick="document.getElementById('cheat-report-modal').remove()" class="w-8 h-8 rounded-lg hover:bg-slate-100 text-slate-500 cursor-pointer"><i class="fa-solid fa-xmark"></i></button>
    </div>
    <div id="cheat-report-body" class="flex-1 overflow-y-auto text-sm text-slate-500 py-6 text-center"><i class="fa-solid fa-spinner fa-spin text-lg"></i><p class="mt-2">Memuat…</p></div>
    <div class="flex justify-end gap-2">
      <button onclick="window.printCheatingReport()" class="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold cursor-pointer"><i class="fa-solid fa-print mr-1"></i>Cetak</button>
    </div>
  </div>`;
  document.body.appendChild(modal);
  try {
    const res = await fetch('/api/exam-violations/summary', { credentials: 'include' });
    const data = await res.json();
    const body = document.getElementById('cheat-report-body');
    if (!data.success) throw new Error(data.message || 'Gagal memuat.');
    window.__cheatReportData = data;
    if (!data.total) {
      body.innerHTML = `<div class="text-center py-10 text-slate-400"><i class="fa-solid fa-shield-halved text-emerald-500 text-3xl"></i><p class="font-bold text-slate-600 mt-2">Belum ada pelanggaran tercatat</p></div>`;
      return;
    }
    const topRows = (data.topStudents || []).map((t, i) => `
      <tr class="border-b border-slate-100">
        <td class="px-2 py-1.5">${i + 1}. ${t.studentName || '?'}</td>
        <td class="px-2 py-1.5">${t.className || '-'}</td>
        <td class="px-2 py-1.5 text-center font-bold ${t.count >= 5 ? 'text-rose-600' : ''}">${t.count}</td>
        <td class="px-2 py-1.5 text-[11px] text-slate-500">${Object.entries(t.reasons || {}).map(([r, n]) => `${r} (${n}x)`).join(', ').slice(0, 120)}</td>
      </tr>`).join('');
    body.innerHTML = `
      <p class="text-xs text-slate-500 mb-2">Total <b>${data.total}</b> pelanggaran tercatat. 20 siswa terbanyak:</p>
      <table class="w-full text-xs"><thead class="bg-slate-50"><tr class="text-left text-slate-500">
        <th class="px-2 py-2">Siswa</th><th class="px-2 py-2">Kelas</th><th class="px-2 py-2 text-center">Total</th><th class="px-2 py-2">Jenis Pelanggaran</th>
      </tr></thead><tbody>${topRows}</tbody></table>`;
  } catch (e) {
    document.getElementById('cheat-report-body').innerHTML = `<p class="text-rose-500 text-xs">Gagal memuat laporan.</p>`;
  }
};

window.printCheatingReport = function () {
  const data = window.__cheatReportData;
  if (!data) return;
  const school = window.appState?.settings?.schoolName || 'Madrasah';
  const rows = (data.topStudents || []).map((t, i) => `<tr><td>${i + 1}</td><td>${t.studentName || '?'}</td><td>${t.className || '-'}</td><td style="text-align:center">${t.count}</td><td>${Object.entries(t.reasons || {}).map(([r, n]) => `${r} (${n}x)`).join('; ')}</td></tr>`).join('');
  const w = window.open('', '_blank');
  w.document.write(`<!DOCTYPE html><html><head><title>Laporan Kecurangan</title><style>
    body{font-family:Arial;padding:24px}h1{font-size:16px}h2{font-size:13px;color:#555}
    table{width:100%;border-collapse:collapse;font-size:11px;margin-top:8px}
    th,td{border:1px solid #999;padding:5px}th{background:#f1f5f9}
  </style></head><body>
  <h1>LAPORAN KECURANGAN UJIAN — ${school}</h1>
  <h2>Total pelanggaran tercatat: ${data.total} &bull; Dicetak: ${new Date().toLocaleString('id-ID')}</h2>
  <table><thead><tr><th>No</th><th>Siswa</th><th>Kelas</th><th>Total</th><th>Jenis Pelanggaran</th></tr></thead><tbody>${rows}</tbody></table>
  <script>window.print();<\/script></body></html>`);
  w.document.close();
};

// ===========================================================================
// BAGIKAN BANK SOAL ke guru lain (admin) — guru yang dibagikan bisa melihat
// dan memakai bank soal tersebut (via sharedTeacherIds di group).
// ===========================================================================
window.openShareBankModal = function (groupId, code, sharedIdsJson) {
  document.getElementById('share-bank-modal')?.remove();
  let sharedIds = [];
  try { sharedIds = JSON.parse(sharedIdsJson || '[]'); } catch (e) {}
  const teachers = window.appState?.teachers || [];
  const rows = teachers.map(t => `
    <label class="flex items-center gap-3 p-2.5 hover:bg-slate-50 rounded-xl cursor-pointer border border-transparent hover:border-slate-200">
      <input type="checkbox" class="share-bank-tcb w-4 h-4" value="${t.id}" ${sharedIds.includes(String(t.id)) ? 'checked' : ''}>
      <div class="flex-1">
        <p class="text-xs font-bold text-slate-700">${t.name || t.username}</p>
        <p class="text-[10px] text-slate-400">${t.mapel || ''} ${t.username ? '• @' + t.username : ''}</p>
      </div>
    </label>`).join('');
  const modal = document.createElement('div');
  modal.id = 'share-bank-modal';
  modal.className = 'fixed inset-0 z-[80] bg-black/50 flex items-center justify-center p-4';
  modal.innerHTML = `
    <div class="bg-white w-full max-w-md rounded-3xl shadow-2xl p-5 space-y-3 max-h-[90vh] flex flex-col">
      <div class="flex items-center justify-between">
        <h3 class="text-base font-extrabold text-slate-800"><i class="fa-solid fa-share-nodes mr-2 text-violet-600"></i>Bagikan Bank "${code}"</h3>
        <button onclick="document.getElementById('share-bank-modal').remove()" class="w-8 h-8 rounded-lg hover:bg-slate-100 text-slate-500 cursor-pointer"><i class="fa-solid fa-xmark"></i></button>
      </div>
      <p class="text-xs text-slate-500">Centang guru yang boleh <b>melihat & memakai</b> bank soal ini. Guru lain tidak melihat bank ini.</p>
      <div class="flex-1 overflow-y-auto border border-slate-200 rounded-xl p-2 max-h-[45vh]">${rows || '<p class="text-xs text-slate-400 text-center py-6">Belum ada data guru.</p>'}</div>
      <div class="flex justify-end gap-2">
        <button onclick="document.getElementById('share-bank-modal').remove()" class="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer">Batal</button>
        <button onclick="window.saveBankShare('${groupId}')" class="px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold cursor-pointer"><i class="fa-solid fa-check mr-1"></i>Simpan</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
};

window.saveBankShare = async function (groupId) {
  const ids = Array.from(document.querySelectorAll('.share-bank-tcb:checked')).map(cb => cb.value);
  try {
    const res = await fetch(`/api/question-bank-groups/${encodeURIComponent(groupId)}/share`, {
      method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teacherIds: ids }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.message || 'Gagal menyimpan berbagi.');
    document.getElementById('share-bank-modal')?.remove();
    showToast(`Berbagi bank soal disimpan (${ids.length} guru).`, 'success');
    loadQuestionBankFromServer?.().then(() => renderQuestionBankModule(document.getElementById('view-container')));
  } catch (e) {
    showToast(e.message || 'Gagal menyimpan berbagi.', 'error');
  }
};
