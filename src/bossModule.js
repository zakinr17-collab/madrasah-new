// Multi-Tenant SaaS & Super Admin (Akun Bos) Module

var appState = window.appState || {};

function isBossRegistrationManager() {
    const role = String(appState.role || appState.currentUser?.role || '').toLowerCase().trim();
    return role === 'bos' || role === 'boss' || role === 'superadmin';
}

async function fetchMadrasahRegistrationPolicy() {
    try {
        const res = await fetch('/api/registration-policy', { cache: 'no-store' });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data || !data.success) throw new Error(data?.message || 'Gagal memuat kebijakan pendaftaran.');
        const policy = {
            mode: ['open', 'invite'].includes(String(data.mode || '').toLowerCase()) ? String(data.mode).toLowerCase() : 'closed',
            inviteRequired: data.inviteRequired === true,
            inviteConfigured: data.inviteConfigured === true
        };
        appState.madrasahRegistrationPolicy = policy;
        return policy;
    } catch (err) {
        appState.madrasahRegistrationPolicy = { mode: 'closed', inviteRequired: false, inviteConfigured: false };
        return appState.madrasahRegistrationPolicy;
    }
}

async function refreshMadrasahRegistrationUi() {
    const policy = await fetchMadrasahRegistrationPolicy();
    const entry = document.getElementById('madrasah-registration-entry');
    if (entry) entry.classList.toggle('hidden', policy.mode === 'closed');
    return policy;
}

// Legacy helper kept for UI compatibility. Never embed or prefill BOSS credentials in browser code.
function fillBosLogin() {
    if (appState.isOfflineMode || window.isOfflineMode) {
        if (window.showToast) window.showToast('Akun Bos (Super Admin) dinonaktifkan pada mode offline.', 'error');
        return;
    }
    if (window.showToast) window.showToast('Masukkan kredensial BOSS yang dikonfigurasi aman pada server.', 'info');
    const userInput = document.getElementById('login-user');
    if (userInput) userInput.focus();
}
window.fillBosLogin = fillBosLogin;

// Modal Register Madrasah Baru
async function openRegisterMadrasahModal() {
    const bossBypass = isBossRegistrationManager();
    const policy = bossBypass
        ? (appState.madrasahRegistrationPolicy || { mode: 'closed', inviteRequired: false, inviteConfigured: false })
        : await fetchMadrasahRegistrationPolicy();

    if (!bossBypass && policy.mode === 'closed') {
        if (window.showToast) window.showToast('Pendaftaran madrasah baru sedang ditutup oleh pengelola platform.', 'info');
        return;
    }

    let modal = document.getElementById('register-madrasah-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'register-madrasah-modal';
        modal.className = 'fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto';
        modal.innerHTML = `
            <div class="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-100 p-6 sm:p-8 space-y-5 animate-in fade-in zoom-in-95 duration-200">
                <div class="flex items-center justify-between border-b border-slate-100 pb-4">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 bg-emerald-100 text-emerald-700 rounded-2xl flex items-center justify-center font-bold text-lg">
                            <i class="fa-solid fa-school"></i>
                        </div>
                        <div>
                            <h3 class="text-base font-bold text-slate-800">Pendaftaran Madrasah Baru</h3>
                            <p class="text-xs text-slate-400">Buat portal khusus untuk madrasah/sekolah Anda</p>
                        </div>
                    </div>
                    <button type="button" onclick="closeRegisterMadrasahModal()" class="w-8 h-8 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 flex items-center justify-center transition">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>

                <form id="register-madrasah-form" onsubmit="submitRegisterMadrasah(event)" class="space-y-4">
                    <div>
                        <label class="block text-xs font-bold uppercase text-slate-500 mb-1">Nama Madrasah / Sekolah *</label>
                        <input type="text" id="reg-madrasah-name" required placeholder="Contoh: MTs Negeri 1 Bandung" class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none">
                    </div>

                    <div class="grid grid-cols-2 gap-3">
                        <div>
                            <label class="block text-xs font-bold uppercase text-slate-500 mb-1">Jenjang *</label>
                            <select id="reg-madrasah-level" class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none">
                                <option value="MI">MI (Madrasah Ibtidaiyah)</option>
                                <option value="MTs" selected>MTs (Madrasah Tsanawiyah)</option>
                                <option value="MA">MA (Madrasah Aliyah)</option>
                                <option value="SD">SD / SMP / SMA</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-xs font-bold uppercase text-slate-500 mb-1">Slug URL Khusus *</label>
                            <input type="text" id="reg-madrasah-slug" required placeholder="mtsn1-bandung" onkeyup="cleanSlugInput(this)" class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-mono font-medium focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none">
                            <span class="text-[10px] text-slate-400 block mt-0.5">Link: /m/<span id="slug-preview" class="font-bold text-emerald-600">mtsn1-bandung</span></span>
                        </div>
                    </div>

                    <div class="border-t border-slate-100 pt-3 space-y-3">
                        <span class="text-xs font-bold uppercase text-slate-600 block">Akun Administrator Madrasah</span>
                        <div>
                            <label class="block text-xs font-medium text-slate-500 mb-1">Nama Lengkap Admin *</label>
                            <input type="text" id="reg-admin-name" required placeholder="Contoh: H. Ahmad Fauzi, S.Pd" class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none">
                        </div>
                        <div class="grid grid-cols-2 gap-3">
                            <div>
                                <label class="block text-xs font-medium text-slate-500 mb-1">Username Admin *</label>
                                <input type="text" id="reg-admin-user" required placeholder="admin_mtsn1" class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none">
                            </div>
                            <div>
                                <label class="block text-xs font-medium text-slate-500 mb-1">Password Admin *</label>
                                <input type="password" id="reg-admin-pass" required placeholder="••••••••" class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none">
                            </div>
                        </div>
                        <div>
                            <label class="block text-xs font-medium text-slate-500 mb-1">Nomor WhatsApp / HP Admin *</label>
                            <input type="tel" id="reg-admin-phone" required placeholder="081234567890" class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none">
                        </div>
                    </div>

                    <div id="reg-invite-code-row" class="hidden bg-indigo-50/70 p-4 rounded-2xl border border-indigo-100 space-y-2">
                        <div class="flex items-center gap-2 text-indigo-800">
                            <i class="fa-solid fa-key text-indigo-600"></i>
                            <span class="text-xs font-bold uppercase tracking-wider">Kode Undangan Pendaftaran</span>
                        </div>
                        <input type="password" id="reg-invite-code" autocomplete="one-time-code" placeholder="Masukkan kode undangan dari pengelola platform" class="w-full px-4 py-2.5 bg-white border border-indigo-200 rounded-2xl text-xs font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none">
                        <p class="text-[10px] text-indigo-600">Kode ini diperlukan karena pendaftaran publik sedang dibatasi.</p>
                    </div>

                    <div class="bg-emerald-50 p-3.5 rounded-2xl border border-emerald-100 flex items-start gap-2.5 text-xs text-emerald-800">
                        <i class="fa-solid fa-gift text-emerald-600 text-sm mt-0.5"></i>
                        <div>
                            <strong class="font-bold">Bonus Pendaftaran:</strong> Pendaftaran gratis dan otomatis mendapatkan <strong>1 Token Ujian Bonus</strong> untuk mencoba fitur CBT.
                        </div>
                    </div>

                    <div class="flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
                        <button type="button" onclick="closeRegisterMadrasahModal()" class="px-4 py-2.5 text-slate-600 hover:bg-slate-100 rounded-2xl text-xs font-semibold transition">Batal</button>
                        <button type="submit" id="btn-submit-reg-madrasah" class="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl text-xs shadow-md shadow-emerald-600/10 transition flex items-center gap-1.5">
                            <i class="fa-solid fa-paper-plane"></i> <span>Daftarkan Sekolah</span>
                        </button>
                    </div>
                </form>
            </div>
        `;
        document.body.appendChild(modal);
    } else {
        modal.classList.remove('hidden');
    }

    const inviteRow = document.getElementById('reg-invite-code-row');
    const inviteInput = document.getElementById('reg-invite-code');
    const needsInvite = !bossBypass && policy.mode === 'invite';
    if (inviteRow) inviteRow.classList.toggle('hidden', !needsInvite);
    if (inviteInput) {
        inviteInput.required = needsInvite;
        if (!needsInvite) inviteInput.value = '';
    }
}

function closeRegisterMadrasahModal() {
    const modal = document.getElementById('register-madrasah-modal');
    if (modal) modal.classList.add('hidden');
}

function cleanSlugInput(input) {
    let val = input.value.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-');
    input.value = val;
    const preview = document.getElementById('slug-preview');
    if (preview) preview.innerText = val || 'nama-sekolah';
}

async function submitRegisterMadrasah(e) {
    if (e) e.preventDefault();
    const name = document.getElementById('reg-madrasah-name').value.trim();
    const level = document.getElementById('reg-madrasah-level').value;
    const slug = document.getElementById('reg-madrasah-slug').value.trim();
    const adminName = document.getElementById('reg-admin-name').value.trim();
    const adminUser = document.getElementById('reg-admin-user').value.trim();
    const adminPass = document.getElementById('reg-admin-pass').value.trim();
    const phone = document.getElementById('reg-admin-phone').value.trim();
    const inviteCode = document.getElementById('reg-invite-code')?.value.trim() || '';
    const needsInvite = !isBossRegistrationManager() && appState.madrasahRegistrationPolicy?.mode === 'invite';

    if (!name || !slug || !adminName || !adminUser || !adminPass) {
        if (window.showToast) window.showToast('Semua field wajib diisi!', 'error');
        return;
    }
    if (needsInvite && !inviteCode) {
        if (window.showToast) window.showToast('Kode undangan wajib diisi untuk mendaftar.', 'error');
        return;
    }

    const btn = document.getElementById('btn-submit-reg-madrasah');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner animate-spin"></i> Memproses...';
    }

    try {
        const res = await fetch('/api/register-madrasah', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, slug, level, adminName, adminUser, adminPass, phone, ...(needsInvite ? { inviteCode } : {}) })
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
            if (window.showToast) window.showToast(data.message || 'Gagal mendaftarkan madrasah.', 'error');
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> <span>Daftarkan Sekolah</span>';
            }
            return;
        }

        closeRegisterMadrasahModal();
        if (window.showToast) window.showToast(data.message || 'Pendaftaran Berhasil!', 'success');

        // Offer prompt to redirect to custom URL /m/slug
        const targetUrl = `/m/${data.madrasah.slug}`;
        if (confirm(`Pendaftaran ${data.madrasah.name} Berhasil!\n\nLink Portal Sekolah: ${window.location.origin}${targetUrl}\n\nIngin membuka Portal Sekolah sekarang?`)) {
            window.location.href = targetUrl;
        }
    } catch (err) {
        if (window.showToast) window.showToast('Gagal terhubung ke server.', 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> <span>Daftarkan Sekolah</span>';
        }
    }
}

window.openRegisterMadrasahModal = openRegisterMadrasahModal;
window.closeRegisterMadrasahModal = closeRegisterMadrasahModal;
window.cleanSlugInput = cleanSlugInput;
window.submitRegisterMadrasah = submitRegisterMadrasah;
window.refreshMadrasahRegistrationUi = refreshMadrasahRegistrationUi;
window.fetchMadrasahRegistrationPolicy = fetchMadrasahRegistrationPolicy;

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { refreshMadrasahRegistrationUi(); });
} else {
    refreshMadrasahRegistrationUi();
}

// Top-Up Token Modal for Madrasah Admin
function openTopUpTokenModal() {
    const tokenPrice = appState.cbtTokenPrice || 5000;
    let modal = document.getElementById('topup-token-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'topup-token-modal';
        document.body.appendChild(modal);
    }
    
    const isOffline = appState.isOfflineMode || window.isOfflineMode;
    const role = String(appState.role || '').toLowerCase().trim();
    const isTeacher = role === 'teacher' || role === 'guru';
    
    modal.className = 'fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto';
    
    if (isTeacher) {
        const teacherName = (appState.currentUser && appState.currentUser.name) || 'Guru';
        const teacherTokens = (typeof window.getActiveMadrasahTokenBalance === 'function')
            ? window.getActiveMadrasahTokenBalance()
            : ((appState.currentUser && appState.currentUser.cbtTokenBalance) || 0);

        modal.innerHTML = `
        <div class="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-100 p-6 sm:p-8 space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div class="flex items-center justify-between border-b border-slate-100 pb-4">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 bg-amber-100 text-amber-800 rounded-2xl flex items-center justify-center font-bold text-lg shadow-sm">
                        <i class="fa-solid fa-coins"></i>
                    </div>
                    <div>
                        <h3 class="text-base font-bold text-slate-800">Top-Up Token Akun Guru</h3>
                        <p class="text-[11px] text-slate-500">${teacherName} | Saldo: <strong class="text-amber-600 font-extrabold">${teacherTokens} Token</strong></p>
                    </div>
                </div>
                <button type="button" onclick="closeTopUpTokenModal()" class="w-8 h-8 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 flex items-center justify-center transition">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>

            <div class="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-4 space-y-2">
                <div class="flex items-center gap-2">
                    <i class="fa-solid fa-circle-info text-amber-600 text-sm"></i>
                    <span class="text-xs font-bold text-amber-900 uppercase tracking-wider">Aktivasi Token Khusus Guru</span>
                </div>
                <p class="text-[11px] text-amber-800/90 leading-relaxed">
                    Setiap akun guru memiliki saldo token terpisah untuk pengawasan live video ujian siswa. Untuk menambah saldo token akun Anda, silakan masukkan <strong>Kode Aktivasi Token</strong> dari Bos Platform di bawah ini.
                </p>
            </div>

            <div class="bg-emerald-50 border border-emerald-100 rounded-2xl p-3.5 space-y-2">
                <div class="flex items-center gap-2">
                    <i class="fa-brands fa-whatsapp text-emerald-600 text-base"></i>
                    <span class="text-xs font-bold text-emerald-800">Hubungi Bos via WhatsApp</span>
                </div>
                <div class="flex items-center gap-2 bg-white rounded-xl p-2.5 border border-emerald-200 shadow-xs">
                    <div class="flex-1 font-mono text-xs font-bold text-slate-800">085746719790</div>
                    <a href="https://wa.me/6285746719790?text=${encodeURIComponent('Halo Admin Bos, saya Guru ' + teacherName + ' ingin minta Kode Aktivasi Token Ujian Guru.')}" target="_blank" class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold flex items-center gap-1 transition">
                        Chat WA <i class="fa-solid fa-arrow-up-right-from-square text-[9px]"></i>
                    </a>
                </div>
            </div>

            <div class="pt-1">
                <div class="flex items-center gap-2 mb-2.5">
                    <div class="w-7 h-7 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center text-xs shadow-xs">
                        <i class="fa-solid fa-key text-[10px]"></i>
                    </div>
                    <h4 class="text-xs font-extrabold text-slate-800 uppercase tracking-wider">Aktivasi Kode Lisensi Guru</h4>
                </div>
                <div class="space-y-2.5">
                    <input type="text" id="offline-activation-key-input" placeholder="Tempel Kode Aktivasi Token di sini..." class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-mono focus:bg-white focus:outline-none focus:border-amber-500 shadow-xs" />
                    <button type="button" onclick="submitOfflineActivationKey()" class="w-full py-2.5 bg-amber-600 hover:bg-amber-700 active:scale-98 text-white font-bold text-xs rounded-2xl transition flex items-center justify-center gap-2 shadow-md shadow-amber-600/10 cursor-pointer">
                        <i class="fa-solid fa-circle-check"></i> Aktivasi Token Sekarang
                    </button>
                </div>
            </div>
        </div>
        `;
        modal.classList.remove('hidden');
        return;
    }

    if (isOffline) {
        modal.innerHTML = `
        <div class="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-100 p-6 sm:p-8 space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div class="flex items-center justify-between border-b border-slate-100 pb-4">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 bg-emerald-100 text-emerald-700 rounded-2xl flex items-center justify-center font-bold text-lg">
                        <i class="fa-solid fa-coins"></i>
                    </div>
                    <div>
                        <h3 class="text-base font-bold text-slate-800">Top-Up Token Luring</h3>
                        <p class="text-[11px] text-slate-500">Isi ulang token via lisensi offline</p>
                    </div>
                </div>
                <button type="button" onclick="closeTopUpTokenModal()" class="w-8 h-8 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 flex items-center justify-center transition">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>

            <div class="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 space-y-3">
                <div class="flex items-center gap-2">
                    <i class="fa-brands fa-whatsapp text-emerald-600 text-lg"></i>
                    <span class="text-xs font-bold text-emerald-800 uppercase tracking-wider">Hubungi Admin / Bos</span>
                </div>
                <p class="text-[11px] text-emerald-700 leading-relaxed">
                    Untuk melakukan isi ulang token pada aplikasi luring (offline) ini, silakan hubungi WhatsApp ke nomor berikut:
                </p>
                <div class="flex items-center gap-2 bg-white rounded-xl p-3 border border-emerald-200 shadow-sm">
                    <div class="flex-1 font-mono text-sm font-bold text-slate-800">085746719790</div>
                    <a href="https://wa.me/6285746719790" target="_blank" class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold flex items-center gap-1 transition">
                        Chat WA <i class="fa-solid fa-arrow-up-right-from-square"></i>
                    </a>
                </div>
                <p class="text-[10px] text-emerald-600 font-semibold italic">Admin akan memberikan Kunci Aktivasi / Kode Lisensi.</p>
            </div>

            <div class="bg-indigo-50 border border-indigo-100 rounded-2xl p-3.5 space-y-1.5">
                <span class="block text-[10px] font-bold text-indigo-700 uppercase tracking-wider">ID Madrasah Anda (Kirim ke WA Bos):</span>
                <div class="flex gap-2">
                    <input type="text" id="offline-my-madrasah-id-field" readonly value="${(appState.currentUser && appState.currentUser.madrasahId) || 'DEFAULT'}" class="flex-1 bg-white border border-indigo-200 rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-indigo-900 focus:outline-none" />
                    <button type="button" onclick="const f=document.getElementById('offline-my-madrasah-id-field'); f.select(); navigator.clipboard.writeText(f.value); window.showToast ? window.showToast('ID Madrasah berhasil disalin!', 'success') : alert('ID disalin!');" class="px-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs rounded-xl font-bold transition flex items-center gap-1 cursor-pointer">
                        <i class="fa-solid fa-copy"></i> Salin
                    </button>
                </div>
            </div>

            <div class="pt-2">
                <div class="flex items-center gap-2 mb-3">
                    <div class="w-7 h-7 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center text-xs shadow-sm">
                        <i class="fa-solid fa-key text-[10px]"></i>
                    </div>
                    <h4 class="text-xs font-extrabold text-slate-800 uppercase tracking-wider">Aktivasi Kunci Lisensi</h4>
                </div>
                <div class="space-y-2">
                    <p class="text-[11px] text-slate-500">Masukkan Kode Aktivasi / Lisensi yang diberikan oleh Admin ke dalam kolom di bawah ini untuk mengisi token secara instan.</p>
                    <div class="flex gap-2">
                        <input type="text" id="offline-activation-key-input" placeholder="Tempel Kode Aktivasi di sini..." class="flex-1 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-[11px] font-mono focus:bg-white focus:outline-none focus:border-amber-500" />
                        <button type="button" onclick="submitOfflineActivationKey()" class="px-4 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-2xl transition flex items-center gap-1.5 shadow-md shadow-amber-600/10 active:scale-95">
                            <i class="fa-solid fa-circle-check"></i> Aktivasi
                        </button>
                    </div>
                </div>
            </div>
        </div>
        `;
    } else {
        modal.innerHTML = `
        <div class="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-100 p-6 sm:p-8 space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div class="flex items-center justify-between border-b border-slate-100 pb-4">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 bg-amber-100 text-amber-700 rounded-2xl flex items-center justify-center font-bold text-lg">
                        <i class="fa-solid fa-coins"></i>
                    </div>
                    <div>
                        <h3 class="text-base font-bold text-slate-800">Top-Up Token Ujian</h3>
                        <p class="text-xs text-slate-500">Harga 1 Token Ujian = <strong class="text-emerald-700 font-extrabold">Rp ${tokenPrice.toLocaleString('id-ID')}</strong></p>
                    </div>
                </div>
                <button type="button" onclick="closeTopUpTokenModal()" class="w-8 h-8 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 flex items-center justify-center transition">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>

            <form id="topup-token-form" onsubmit="submitTopUpTokenRequest(event)" class="space-y-4">
                <div>
                    <label class="block text-xs font-bold uppercase text-slate-500 mb-2">Pilih Paket Token</label>
                    <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <button type="button" onclick="selectTokenPackage(10)" class="token-pkg-btn p-3 bg-slate-50 border border-slate-200 rounded-2xl hover:border-emerald-500 hover:bg-emerald-50/50 text-center transition">
                            <span class="block text-base font-bold text-slate-800">10 Token</span>
                            <span class="block text-[10px] text-emerald-700 font-semibold">Rp ${(10 * tokenPrice).toLocaleString('id-ID')}</span>
                        </button>
                        <button type="button" onclick="selectTokenPackage(20)" class="token-pkg-btn p-3 bg-slate-50 border border-slate-200 rounded-2xl hover:border-emerald-500 hover:bg-emerald-50/50 text-center transition">
                            <span class="block text-base font-bold text-slate-800">20 Token</span>
                            <span class="block text-[10px] text-emerald-700 font-semibold">Rp ${(20 * tokenPrice).toLocaleString('id-ID')}</span>
                        </button>
                        <button type="button" onclick="selectTokenPackage(50)" class="token-pkg-btn p-3 bg-slate-50 border border-slate-200 rounded-2xl hover:border-emerald-500 hover:bg-emerald-50/50 text-center transition">
                            <span class="block text-base font-bold text-slate-800">50 Token</span>
                            <span class="block text-[10px] text-emerald-700 font-semibold">Rp ${(50 * tokenPrice).toLocaleString('id-ID')}</span>
                        </button>
                        <button type="button" onclick="selectTokenPackage(100)" class="token-pkg-btn p-3 bg-slate-50 border border-slate-200 rounded-2xl hover:border-emerald-500 hover:bg-emerald-50/50 text-center transition">
                            <span class="block text-base font-bold text-slate-800">100 Token</span>
                            <span class="block text-[10px] text-emerald-700 font-semibold">Rp ${(100 * tokenPrice).toLocaleString('id-ID')}</span>
                        </button>
                    </div>
                </div>

                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <label class="block text-xs font-bold uppercase text-slate-500 mb-1">Jumlah Token</label>
                        <input type="number" id="topup-quantity" min="1" value="10" oninput="calculateTopupPrice()" required class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-emerald-500">
                    </div>
                    <div>
                        <label class="block text-xs font-bold uppercase text-slate-500 mb-1">Total Biaya (Rp)</label>
                        <input type="text" id="topup-total-price" readonly value="Rp ${(10 * tokenPrice).toLocaleString('id-ID')}" class="w-full px-4 py-2.5 bg-slate-100 border border-slate-200 rounded-2xl text-xs font-extrabold text-emerald-700">
                    </div>
                </div>

                <div class="bg-amber-50 p-4 rounded-2xl border border-amber-200 text-xs space-y-1.5 text-amber-900">
                    <strong class="font-bold flex items-center gap-1.5 text-amber-900">
                        <i class="fa-solid fa-building-columns"></i> Rekening Pembayaran (Transfer Bank / E-Wallet):
                    </strong>
                    <div class="font-mono text-[11px] bg-white p-2.5 rounded-xl border border-amber-200 space-y-0.5">
                        ${(appState.paymentAccounts && appState.paymentAccounts.length > 0 ? appState.paymentAccounts : [
                            { name: 'ShopeePay', number: '081234567890', owner: 'BOS PLATFORM' },
                            { name: 'DANA', number: '081234567890', owner: 'BOS PLATFORM' },
                            { name: 'Bank BRI', number: '0123-01-098765-50-1', owner: 'BOS PLATFORM' }
                        ]).map(acc => `<div><strong>${acc.name}:</strong> ${acc.number} ${acc.owner ? `(a.n. ${acc.owner})` : ''}</div>`).join('')}
                    </div>
                </div>

                <div>
                    <label class="block text-xs font-medium text-slate-500 mb-1">Catatan Bukti Transfer / Nomor Referensi *</label>
                    <textarea id="topup-proof-note" rows="2" placeholder="Contoh: Sudah transfer via BRI a.n. Madrasah Tsanawiyah pada tgl 29 Aug pkl 14:00 (Ref: 981273)" class="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs focus:bg-white focus:ring-2 focus:ring-emerald-500"></textarea>
                </div>

                <div class="flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
                    <button type="button" onclick="closeTopUpTokenModal()" class="px-4 py-2.5 text-slate-600 hover:bg-slate-100 rounded-2xl text-xs font-semibold transition">Batal</button>
                    <button type="submit" id="btn-submit-topup" class="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-2xl text-xs shadow-md shadow-amber-600/10 transition flex items-center gap-1.5">
                        <i class="fa-solid fa-paper-plane"></i> <span>Kirim Permintaan Top-Up</span>
                    </button>
                </div>
            </form>

            <!-- CRYPTOGRAPHIC OFFLINE LICENSE KEY ACTIVATION CARD -->
            <div class="border-t border-slate-100 pt-5 mt-5 space-y-4">
                <div class="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 space-y-2">
                    <span class="block text-[10px] font-bold text-indigo-700 uppercase tracking-wider">ID Madrasah Anda (Kirim ke Admin BOS):</span>
                    <div class="flex gap-2">
                        <input type="text" id="my-madrasah-id-field" readonly value="${(appState.currentUser && appState.currentUser.madrasahId) || 'Belum Terdaftar'}" class="flex-1 bg-white border border-indigo-200 rounded-xl px-3 py-2 text-xs font-mono font-bold text-indigo-900 focus:outline-none" />
                        <button type="button" onclick="const f=document.getElementById('my-madrasah-id-field'); f.select(); navigator.clipboard.writeText(f.value); window.showToast ? window.showToast('ID Madrasah berhasil disalin!', 'success') : alert('ID disalin!');" class="px-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs rounded-xl font-bold transition flex items-center gap-1">
                            <i class="fa-solid fa-copy"></i> Salin
                        </button>
                    </div>
                    <p class="text-[10px] text-slate-500 leading-normal">Kirimkan ID di atas beserta bukti transfer Anda kepada Admin BOS melalui WhatsApp untuk dibuatkan kunci aktivasi token Anda.</p>
                </div>

                <div class="pt-2">
                    <div class="flex items-center gap-2 mb-3">
                        <div class="w-7 h-7 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center text-xs shadow-sm">
                            <i class="fa-solid fa-key text-[10px]"></i>
                        </div>
                        <h4 class="text-xs font-extrabold text-slate-800 uppercase tracking-wider">Aktivasi Token Offline via Kode Lisensi</h4>
                    </div>
                    <div class="space-y-2">
                        <p class="text-[11px] text-slate-500">Jika Anda menginstal secara luring/offline di localhost, silakan transfer terlebih dahulu ke rekening di atas, lalu minta Kode Lisensi/Aktivasi kepada Admin BOS, dan masukkan di bawah ini.</p>
                        <div class="flex gap-2">
                            <input type="text" id="offline-activation-key-input" placeholder="Masukkan Kode Aktivasi..." class="flex-1 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-[11px] font-mono focus:bg-white focus:outline-none focus:border-emerald-500" />
                            <button type="button" onclick="submitOfflineActivationKey()" class="px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-2xl transition flex items-center gap-1.5 shadow-md shadow-emerald-600/10 active:scale-95">
                                <i class="fa-solid fa-circle-check"></i> Aktivasi
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        `;
    }
    modal.classList.remove('hidden');
}

function closeTopUpTokenModal() {
    const modal = document.getElementById('topup-token-modal');
    if (modal) modal.classList.add('hidden');
}

async function submitOfflineActivationKey() {
    const keyInput = document.getElementById('offline-activation-key-input');
    const key = keyInput ? keyInput.value.trim() : '';
    if (!key) {
        if (window.showToast) window.showToast('Silakan masukkan kode aktivasi.', 'error');
        else alert('Silakan masukkan kode aktivasi.');
        return;
    }
    
    const role = String(appState.role || '').toLowerCase().trim();
    const isTeacher = role === 'teacher' || role === 'guru';
    const teacherId = isTeacher ? appState.currentUser?.id : null;

    try {
        const res = await fetch('/api/madrasah/activate-offline-tokens', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ activationKey: key, teacherId })
        });
        const data = await res.json();
        if (data.success) {
            if (window.showToast) window.showToast(data.message, 'success');
            else alert(data.message);
            
            if (isTeacher && typeof data.remainingTokens === 'number') {
                if (appState.currentUser) {
                    appState.currentUser.cbtTokenBalance = data.remainingTokens;
                    if (window.safeSetLocalStorage) window.safeSetLocalStorage('madrasah_current_user', appState.currentUser);
                }
                if (appState.teachers && appState.currentUser) {
                    const tchIdx = appState.teachers.findIndex(t => String(t.id) === String(appState.currentUser.id));
                    if (tchIdx >= 0) {
                        appState.teachers[tchIdx].cbtTokenBalance = data.remainingTokens;
                    }
                }
            } else if (!isTeacher && typeof data.remainingTokens === 'number') {
                const newBalance = Number(data.remainingTokens) || 0;

                // Keep the logged-in admin/session copy in sync with the authoritative server balance.
                if (appState.currentUser) {
                    appState.currentUser.cbtTokenBalance = newBalance;
                    if (window.safeSetLocalStorage) {
                        window.safeSetLocalStorage('madrasah_current_user', appState.currentUser);
                    }
                }

                // Also update the matching madrasah object immediately so every badge/helper sees the same value.
                if (Array.isArray(appState.madrasahs) && appState.madrasahs.length > 0) {
                    const currentMId = appState.currentUser && (appState.currentUser.madrasahId || appState.currentUser.madrasahSlug);
                    let mIdx = appState.madrasahs.findIndex(m =>
                        String(m.id) === String(currentMId) ||
                        String(m.slug) === String(currentMId)
                    );
                    if (mIdx < 0 && appState.madrasahs.length === 1) mIdx = 0;
                    if (mIdx >= 0) {
                        appState.madrasahs[mIdx].cbtTokenBalance = newBalance;
                    }
                    if (window.safeSetLocalStorage) {
                        window.safeSetLocalStorage('madrasah_madrasahs', appState.madrasahs);
                    }
                }
            }

            // Reload the local data
            if (window.loadDataFromServer) {
                await window.loadDataFromServer();
            }
            if (typeof window.updateHeaderTokenBadge === 'function') {
                window.updateHeaderTokenBadge();
            }
            closeTopUpTokenModal();
            return;
        } else {
            const message = data.message || 'Kode aktivasi ditolak oleh server.';
            console.warn('Server activation rejected:', message);
            if (window.showToast) window.showToast(message, 'error');
            else alert(message);
            return;
        }
    } catch (err) {
        console.warn('Network request failed for activation token:', err);
        const message = 'Server lokal tidak dapat dihubungi. Aktivasi token tidak dilakukan agar saldo tidak hanya berubah sementara.';
        if (window.showToast) window.showToast(message, 'error');
        else alert(message);
        return;
    }
}
window.submitOfflineActivationKey = submitOfflineActivationKey;

function selectTokenPackage(qty) {
    const qtyInput = document.getElementById('topup-quantity');
    if (qtyInput) {
        qtyInput.value = qty;
        calculateTopupPrice();
    }
}

function calculateTopupPrice() {
    const qtyInput = document.getElementById('topup-quantity');
    const totalInput = document.getElementById('topup-total-price');
    if (qtyInput && totalInput) {
        const qty = parseInt(qtyInput.value, 10) || 0;
        const tokenPrice = appState.cbtTokenPrice || 5000;
        const total = qty * tokenPrice;
        totalInput.value = 'Rp ' + total.toLocaleString('id-ID');
    }
}

async function submitTopUpTokenRequest(e) {
    if (e) e.preventDefault();
    const qtyInput = document.getElementById('topup-quantity');
    const proofNoteInput = document.getElementById('topup-proof-note');
    const quantity = parseInt(qtyInput ? qtyInput.value : '0', 10);
    const proofNote = proofNoteInput ? proofNoteInput.value.trim() : '';

    if (quantity <= 0) {
        if (window.showToast) window.showToast('Jumlah token harus minimal 1.', 'error');
        return;
    }
    if (!proofNote) {
        if (window.showToast) window.showToast('Catatan bukti transfer wajib diisi!', 'error');
        return;
    }

    const currentMadrasahId = (appState.currentUser && appState.currentUser.madrasahId) || 'default';

    const btn = document.getElementById('btn-submit-topup');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner animate-spin"></i> Memproses...';
    }

    try {
        const res = await fetch('/api/token-requests', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                madrasahId: currentMadrasahId,
                quantity,
                proofNote
            })
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
            if (window.showToast) window.showToast(data.message || 'Gagal mengirim permintaan.', 'error');
            return;
        }

        closeTopUpTokenModal();
        if (window.showToast) window.showToast(data.message || 'Permintaan Top-Up Terkirim!', 'success');
        
        // Refresh server data
        if (typeof window.loadDataFromServer === 'function') {
            window.loadDataFromServer();
        }
    } catch (err) {
        if (window.showToast) window.showToast('Terjadi kesalahan saat menghubungi server.', 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> <span>Kirim Permintaan Top-Up</span>';
        }
    }
}

window.openTopUpTokenModal = openTopUpTokenModal;
window.closeTopUpTokenModal = closeTopUpTokenModal;
window.selectTokenPackage = selectTokenPackage;
window.calculateTopupPrice = calculateTopupPrice;
window.submitTopUpTokenRequest = submitTopUpTokenRequest;

// In-App Modal for Changing CBT Token Price (Akun Bos)
function openChangeCbtTokenPriceModal() {
    const currentPrice = appState.cbtTokenPrice || 5000;
    let modal = document.getElementById('change-token-price-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'change-token-price-modal';
        document.body.appendChild(modal);
    }

    modal.className = 'fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto';
    modal.innerHTML = `
        <div class="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-100 p-6 sm:p-7 space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div class="flex items-center justify-between border-b border-slate-100 pb-4">
                <div class="flex items-center gap-3">
                    <div class="w-11 h-11 bg-amber-100 text-amber-800 rounded-2xl flex items-center justify-center font-black text-xl shadow-sm">
                        <i class="fa-solid fa-tags"></i>
                    </div>
                    <div>
                        <h3 class="text-base font-bold text-slate-800">Atur Harga 1 Token Ujian</h3>
                        <p class="text-xs text-slate-400">Tarif global untuk pembelian seluruh madrasah</p>
                    </div>
                </div>
                <button type="button" onclick="closeChangeCbtTokenPriceModal()" class="w-8 h-8 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 flex items-center justify-center transition">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>

            <form onsubmit="submitChangeCbtTokenPrice(event)" class="space-y-4">
                <div>
                    <label class="block text-xs font-bold uppercase text-slate-500 mb-1">Harga 1 Token Saat Ini</label>
                    <div class="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-extrabold text-slate-700">
                        Rp ${currentPrice.toLocaleString('id-ID')}
                    </div>
                </div>

                <div>
                    <label class="block text-xs font-bold uppercase text-slate-500 mb-1.5">Pilih Preset Cepat atau Ketik Nominal</label>
                    <div class="grid grid-cols-3 gap-2 mb-3">
                        <button type="button" onclick="setTokenPriceInput(2500)" class="px-3 py-2 bg-slate-50 hover:bg-amber-50 hover:border-amber-400 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 transition">Rp 2.500</button>
                        <button type="button" onclick="setTokenPriceInput(5000)" class="px-3 py-2 bg-slate-50 hover:bg-amber-50 hover:border-amber-400 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 transition">Rp 5.000</button>
                        <button type="button" onclick="setTokenPriceInput(7500)" class="px-3 py-2 bg-slate-50 hover:bg-amber-50 hover:border-amber-400 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 transition">Rp 7.500</button>
                        <button type="button" onclick="setTokenPriceInput(10000)" class="px-3 py-2 bg-slate-50 hover:bg-amber-50 hover:border-amber-400 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 transition">Rp 10.000</button>
                        <button type="button" onclick="setTokenPriceInput(15000)" class="px-3 py-2 bg-slate-50 hover:bg-amber-50 hover:border-amber-400 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 transition">Rp 15.000</button>
                        <button type="button" onclick="setTokenPriceInput(20000)" class="px-3 py-2 bg-slate-50 hover:bg-amber-50 hover:border-amber-400 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 transition">Rp 20.000</button>
                    </div>

                    <label class="block text-xs font-bold uppercase text-slate-500 mb-1">Nominal Baru (Rp) *</label>
                    <div class="relative">
                        <span class="absolute left-4 top-3 text-slate-400 font-bold text-xs">Rp</span>
                        <input type="number" id="input-new-token-price" min="0" step="500" value="${currentPrice}" required class="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-black text-slate-800 focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none">
                    </div>
                </div>

                <div class="p-3 bg-amber-50 rounded-2xl border border-amber-100 text-xs text-amber-900 flex items-start gap-2">
                    <i class="fa-solid fa-circle-info text-amber-600 mt-0.5"></i>
                    <span>Harga baru ini otomatis berlaku pada formulir Top-Up Token di seluruh portal madrasah.</span>
                </div>

                <div class="flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
                    <button type="button" onclick="closeChangeCbtTokenPriceModal()" class="px-4 py-2.5 text-slate-600 hover:bg-slate-100 rounded-2xl text-xs font-semibold transition">Batal</button>
                    <button type="submit" id="btn-save-token-price" class="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-2xl text-xs shadow-md shadow-amber-600/20 transition flex items-center gap-1.5 cursor-pointer">
                        <i class="fa-solid fa-floppy-disk"></i> <span>Simpan Harga Baru</span>
                    </button>
                </div>
            </form>
        </div>
    `;
    modal.classList.remove('hidden');
}

function closeChangeCbtTokenPriceModal() {
    const modal = document.getElementById('change-token-price-modal');
    if (modal) modal.classList.add('hidden');
}

function setTokenPriceInput(val) {
    const el = document.getElementById('input-new-token-price');
    if (el) el.value = val;
}

async function submitChangeCbtTokenPrice(e) {
    if (e) e.preventDefault();
    const el = document.getElementById('input-new-token-price');
    const newPrice = parseInt(el ? el.value : '0', 10);
    if (isNaN(newPrice) || newPrice < 0) {
        if (window.showToast) window.showToast('Nominal harga tidak valid!', 'error');
        return;
    }

    const btn = document.getElementById('btn-save-token-price');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner animate-spin"></i> Menyimpan...';
    }

    try {
        const res = await fetch('/api/cbt-token-price', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ price: newPrice })
        });
        const data = await res.json();
        if (data.success) {
            appState.cbtTokenPrice = data.price;
            closeChangeCbtTokenPriceModal();
            if (window.showToast) window.showToast(data.message || 'Harga token berhasil diubah!', 'success');
            renderBossDashboard(document.getElementById('view-container'), appState.activeBossTab || 'tokens');
        } else {
            if (window.showToast) window.showToast(data.message || 'Gagal mengubah harga.', 'error');
        }
    } catch(err) {
        if (window.showToast) window.showToast('Gagal terhubung ke server.', 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> <span>Simpan Harga Baru</span>';
        }
    }
}

function changeCbtTokenPrice() {
    openChangeCbtTokenPriceModal();
}
window.openChangeCbtTokenPriceModal = openChangeCbtTokenPriceModal;
window.closeChangeCbtTokenPriceModal = closeChangeCbtTokenPriceModal;
window.setTokenPriceInput = setTokenPriceInput;
window.submitChangeCbtTokenPrice = submitChangeCbtTokenPrice;
window.changeCbtTokenPrice = changeCbtTokenPrice;

// In-App Modal for Editing Madrasah Token Balance (Akun Bos)
function openEditMadrasahTokenModal(madrasahId, madrasahName, currentBalance) {
    let modal = document.getElementById('edit-madrasah-token-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'edit-madrasah-token-modal';
        document.body.appendChild(modal);
    }

    modal.className = 'fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto';
    modal.innerHTML = `
        <div class="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-100 p-6 sm:p-7 space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div class="flex items-center justify-between border-b border-slate-100 pb-4">
                <div class="flex items-center gap-3">
                    <div class="w-11 h-11 bg-purple-100 text-purple-800 rounded-2xl flex items-center justify-center font-black text-xl shadow-sm">
                        <i class="fa-solid fa-sliders"></i>
                    </div>
                    <div>
                        <h3 class="text-base font-bold text-slate-800">Edit Saldo Token Ujian</h3>
                        <p class="text-xs text-slate-400 truncate max-w-[220px]">${madrasahName}</p>
                    </div>
                </div>
                <button type="button" onclick="closeEditMadrasahTokenModal()" class="w-8 h-8 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 flex items-center justify-center transition">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>

            <form onsubmit="submitEditMadrasahTokenBalance(event, '${madrasahId}')" class="space-y-4">
                <div class="p-3 bg-purple-50/70 border border-purple-100 rounded-2xl flex items-center justify-between">
                    <div>
                        <span class="text-[10px] uppercase font-bold text-purple-700 block">Saldo Saat Ini</span>
                        <span class="text-lg font-black text-purple-950">${currentBalance} Token</span>
                    </div>
                    <div class="w-8 h-8 rounded-xl bg-purple-200 text-purple-800 flex items-center justify-center text-sm">
                        <i class="fa-solid fa-coins"></i>
                    </div>
                </div>

                <div>
                    <label class="block text-xs font-bold uppercase text-slate-500 mb-1.5">Shortcut Tambah / Kurang Cepat</label>
                    <div class="grid grid-cols-4 gap-1.5 mb-3">
                        <button type="button" onclick="adjustEditTokenInput(${currentBalance}, 5)" class="px-2 py-1.5 bg-slate-50 hover:bg-purple-50 hover:border-purple-300 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 transition">+5</button>
                        <button type="button" onclick="adjustEditTokenInput(${currentBalance}, 10)" class="px-2 py-1.5 bg-slate-50 hover:bg-purple-50 hover:border-purple-300 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 transition">+10</button>
                        <button type="button" onclick="adjustEditTokenInput(${currentBalance}, 20)" class="px-2 py-1.5 bg-slate-50 hover:bg-purple-50 hover:border-purple-300 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 transition">+20</button>
                        <button type="button" onclick="adjustEditTokenInput(${currentBalance}, 50)" class="px-2 py-1.5 bg-slate-50 hover:bg-purple-50 hover:border-purple-300 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 transition">+50</button>
                    </div>

                    <label class="block text-xs font-bold uppercase text-slate-500 mb-1">Set Total Saldo Baru (Token) *</label>
                    <input type="number" id="input-edit-token-balance" min="0" value="${currentBalance}" required class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-black text-slate-800 focus:bg-white focus:ring-2 focus:ring-purple-500 focus:outline-none">
                </div>

                <div class="flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
                    <button type="button" onclick="closeEditMadrasahTokenModal()" class="px-4 py-2.5 text-slate-600 hover:bg-slate-100 rounded-2xl text-xs font-semibold transition">Batal</button>
                    <button type="submit" id="btn-save-edit-token" class="px-5 py-2.5 bg-purple-700 hover:bg-purple-800 text-white font-bold rounded-2xl text-xs shadow-md shadow-purple-700/20 transition flex items-center gap-1.5 cursor-pointer">
                        <i class="fa-solid fa-check"></i> <span>Simpan Saldo</span>
                    </button>
                </div>
            </form>
        </div>
    `;
    modal.classList.remove('hidden');
}

function closeEditMadrasahTokenModal() {
    const modal = document.getElementById('edit-madrasah-token-modal');
    if (modal) modal.classList.add('hidden');
}

function adjustEditTokenInput(current, delta) {
    const el = document.getElementById('input-edit-token-balance');
    if (el) {
        const val = parseInt(el.value, 10) || current;
        el.value = Math.max(0, val + delta);
    }
}

async function submitEditMadrasahTokenBalance(e, madrasahId) {
    if (e) e.preventDefault();
    const el = document.getElementById('input-edit-token-balance');
    const newBalance = parseInt(el ? el.value : '0', 10);
    if (isNaN(newBalance) || newBalance < 0) {
        if (window.showToast) window.showToast('Saldo token tidak valid!', 'error');
        return;
    }

    const btn = document.getElementById('btn-save-edit-token');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner animate-spin"></i> Menyimpan...';
    }

    try {
        const res = await fetch(`/api/madrasahs/${madrasahId}/update-tokens`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ newBalance })
        });
        const data = await res.json();
        if (data.success) {
            if (data.madrasah && appState.madrasahs) {
                const idx = appState.madrasahs.findIndex(m => String(m.id) === String(madrasahId) || String(m.slug) === String(madrasahId));
                if (idx !== -1) {
                    appState.madrasahs[idx] = data.madrasah;
                }
            }
            closeEditMadrasahTokenModal();
            if (window.showToast) window.showToast(data.message || 'Saldo token berhasil diperbarui!', 'success');
            renderBossDashboard(document.getElementById('view-container'), 'madrasahs');
        } else {
            if (window.showToast) window.showToast(data.message || 'Gagal memperbarui saldo.', 'error');
        }
    } catch(err) {
        if (window.showToast) window.showToast('Gagal memperbarui saldo.', 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-check"></i> <span>Simpan Saldo</span>';
        }
    }
}

function editMadrasahTokenBalance(madrasahId, madrasahName, currentBalance) {
    openEditMadrasahTokenModal(madrasahId, madrasahName, currentBalance);
}
window.openEditMadrasahTokenModal = openEditMadrasahTokenModal;
window.closeEditMadrasahTokenModal = closeEditMadrasahTokenModal;
window.adjustEditTokenInput = adjustEditTokenInput;
window.submitEditMadrasahTokenBalance = submitEditMadrasahTokenBalance;
window.editMadrasahTokenBalance = editMadrasahTokenBalance;

// In-App Modal for Approving Token Request (Akun Bos)
function openApproveTokenRequestModal(reqId, defaultQty, madrasahName) {
    let modal = document.getElementById('approve-token-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'approve-token-modal';
        document.body.appendChild(modal);
    }

    modal.className = 'fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto';
    modal.innerHTML = `
        <div class="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-100 p-6 sm:p-7 space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div class="flex items-center justify-between border-b border-slate-100 pb-4">
                <div class="flex items-center gap-3">
                    <div class="w-11 h-11 bg-emerald-100 text-emerald-800 rounded-2xl flex items-center justify-center font-black text-xl shadow-sm">
                        <i class="fa-solid fa-circle-check"></i>
                    </div>
                    <div>
                        <h3 class="text-base font-bold text-slate-800">Setujui Permintaan Top-Up</h3>
                        <p class="text-xs text-slate-400 truncate max-w-[220px]">${madrasahName}</p>
                    </div>
                </div>
                <button type="button" onclick="closeApproveTokenRequestModal()" class="w-8 h-8 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 flex items-center justify-center transition">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>

            <form onsubmit="submitApproveTokenRequest(event, '${reqId}', '${madrasahName}')" class="space-y-4">
                <div>
                    <label class="block text-xs font-bold uppercase text-slate-500 mb-1">Jumlah Token yang Disetujui *</label>
                    <input type="number" id="input-approve-qty" min="1" value="${defaultQty}" required class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-black text-slate-800 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none">
                    <span class="text-[11px] text-slate-400 block mt-1">Anda dapat menyesuaikan jumlah token jika pembayaran lebih/kurang.</span>
                </div>

                <div class="p-3 bg-emerald-50 rounded-2xl border border-emerald-100 text-xs text-emerald-900 flex items-start gap-2">
                    <i class="fa-solid fa-coins text-emerald-600 mt-0.5"></i>
                    <span>Token ini akan otomatis ditambahkan ke saldo madrasah pemohon seketika.</span>
                </div>

                <div class="flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
                    <button type="button" onclick="closeApproveTokenRequestModal()" class="px-4 py-2.5 text-slate-600 hover:bg-slate-100 rounded-2xl text-xs font-semibold transition">Batal</button>
                    <button type="submit" id="btn-submit-approve-token" class="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl text-xs shadow-md shadow-emerald-600/20 transition flex items-center gap-1.5 cursor-pointer">
                        <i class="fa-solid fa-check"></i> <span>Setujui & Tambah Token</span>
                    </button>
                </div>
            </form>
        </div>
    `;
    modal.classList.remove('hidden');
}

function closeApproveTokenRequestModal() {
    const modal = document.getElementById('approve-token-modal');
    if (modal) modal.classList.add('hidden');
}

async function submitApproveTokenRequest(e, reqId, madrasahName) {
    if (e) e.preventDefault();
    const el = document.getElementById('input-approve-qty');
    const qty = parseInt(el ? el.value : '0', 10);
    if (isNaN(qty) || qty <= 0) {
        if (window.showToast) window.showToast('Jumlah token tidak valid!', 'error');
        return;
    }

    const btn = document.getElementById('btn-submit-approve-token');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner animate-spin"></i> Memproses...';
    }

    try {
        const res = await fetch(`/api/token-requests/${reqId}/approve`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ approvedQuantity: qty })
        });
        const data = await res.json();
        if (data.success) {
            closeApproveTokenRequestModal();
            if (window.showToast) window.showToast(data.message || `Top-Up +${qty} token berhasil disetujui!`, 'success');
            renderBossDashboard(document.getElementById('view-container'), 'tokens');
        } else {
            if (window.showToast) window.showToast(data.message || 'Gagal menyetujui.', 'error');
        }
    } catch(err) {
        if (window.showToast) window.showToast('Gagal terhubung ke server.', 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-check"></i> <span>Setujui & Tambah Token</span>';
        }
    }
}

function approveTokenRequest(reqId, qty, madrasahName) {
    openApproveTokenRequestModal(reqId, qty, madrasahName);
}
function editAndApproveTokenRequest(reqId, defaultQty, madrasahName) {
    openApproveTokenRequestModal(reqId, defaultQty, madrasahName);
}
window.openApproveTokenRequestModal = openApproveTokenRequestModal;
window.closeApproveTokenRequestModal = closeApproveTokenRequestModal;
window.submitApproveTokenRequest = submitApproveTokenRequest;
window.approveTokenRequest = approveTokenRequest;
window.editAndApproveTokenRequest = editAndApproveTokenRequest;

// In-App Modal for Rejecting Token Request (Akun Bos)
function openRejectTokenRequestModal(reqId, madrasahName) {
    let modal = document.getElementById('reject-token-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'reject-token-modal';
        document.body.appendChild(modal);
    }

    modal.className = 'fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto';
    modal.innerHTML = `
        <div class="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-100 p-6 sm:p-7 space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div class="text-center space-y-3">
                <div class="w-14 h-14 bg-rose-100 text-rose-600 rounded-3xl flex items-center justify-center text-2xl mx-auto shadow-sm">
                    <i class="fa-solid fa-triangle-exclamation"></i>
                </div>
                <h3 class="text-base font-bold text-slate-800">Tolak Permintaan Top-Up?</h3>
                <p class="text-xs text-slate-500 leading-relaxed">
                    Yakin ingin menolak permohonan isi ulang token dari <strong class="text-slate-800">${madrasahName}</strong>? Permintaan ini akan ditandai sebagai ditolak.
                </p>
            </div>

            <div class="flex items-center justify-center gap-3 border-t border-slate-100 pt-4">
                <button type="button" onclick="closeRejectTokenRequestModal()" class="px-5 py-2.5 text-slate-600 hover:bg-slate-100 rounded-2xl text-xs font-semibold transition">Batal</button>
                <button type="button" onclick="submitRejectTokenRequest('${reqId}')" id="btn-submit-reject-token" class="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-2xl text-xs shadow-md shadow-rose-600/20 transition flex items-center gap-1.5 cursor-pointer">
                    <i class="fa-solid fa-xmark"></i> <span>Ya, Tolak Permintaan</span>
                </button>
            </div>
        </div>
    `;
    modal.classList.remove('hidden');
}

function closeRejectTokenRequestModal() {
    const modal = document.getElementById('reject-token-modal');
    if (modal) modal.classList.add('hidden');
}

async function submitRejectTokenRequest(reqId) {
    const btn = document.getElementById('btn-submit-reject-token');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner animate-spin"></i> Menolak...';
    }

    try {
        const res = await fetch(`/api/token-requests/${reqId}/reject`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        const data = await res.json();
        if (data.success) {
            closeRejectTokenRequestModal();
            if (window.showToast) window.showToast(data.message || 'Permintaan Top-Up telah ditolak.', 'info');
            renderBossDashboard(document.getElementById('view-container'), 'tokens');
        }
    } catch(err) {
        if (window.showToast) window.showToast('Gagal terhubung ke server.', 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-xmark"></i> <span>Ya, Tolak Permintaan</span>';
        }
    }
}

function rejectTokenRequest(reqId, madrasahName) {
    openRejectTokenRequestModal(reqId, madrasahName);
}
window.openRejectTokenRequestModal = openRejectTokenRequestModal;
window.closeRejectTokenRequestModal = closeRejectTokenRequestModal;
window.submitRejectTokenRequest = submitRejectTokenRequest;
window.rejectTokenRequest = rejectTokenRequest;

// Render Dashboard Bos (Super Admin)
async function renderBossDashboard(container, initialTab = 'tokens') {
    if (!container) return;

    // Fetch latest data from server to ensure fresh state
    try {
        const res = await fetch('/api/all-data');
        const data = await res.json();
        if (data.success) {
            if (data.madrasahs) appState.madrasahs = data.madrasahs;
            if (data.tokenRequests) appState.tokenRequests = data.tokenRequests;
            if (data.cbtTokenPrice) appState.cbtTokenPrice = data.cbtTokenPrice;
        }
    } catch(e) {}

    const madrasahs = appState.madrasahs || [];
    const tokenRequests = appState.tokenRequests || [];
    const tokenPrice = appState.cbtTokenPrice || 5000;

    const totalMadrasah = madrasahs.length;
    const pendingRequests = tokenRequests.filter(r => r.status === 'pending');
    const approvedRequests = tokenRequests.filter(r => r.status === 'approved');
    const totalApprovedTokens = approvedRequests.reduce((acc, curr) => acc + (curr.approvedQuantity || curr.quantity || 0), 0);
    const totalOmset = totalApprovedTokens * tokenPrice;

    container.innerHTML = `
        <div class="space-y-6 max-w-6xl mx-auto pb-12">
            <!-- Header Banner -->
            <div class="bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 text-white p-6 sm:p-8 rounded-3xl shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6 border border-purple-800/30">
                <div class="space-y-2">
                    <div class="inline-flex items-center gap-2 px-3 py-1 bg-amber-400/20 text-amber-300 rounded-full text-xs font-bold border border-amber-400/30">
                        <i class="fa-solid fa-crown text-amber-400"></i> Akun Bos (Super Admin Platform)
                    </div>
                    <h1 class="text-2xl sm:text-3xl font-extrabold tracking-tight">Manajemen Multi-Madrasah & Token CBT</h1>
                    <p class="text-xs sm:text-sm text-purple-200/80">Kelola pendaftaran sekolah, persetujuan top-up token, dan saldo token ujian seluruh madrasah</p>
                </div>

                <div class="flex items-center gap-3">
                    <button type="button" onclick="changeCbtTokenPrice()" class="px-3.5 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-2xl text-xs shadow-md shadow-amber-500/20 transition flex items-center gap-1.5 cursor-pointer">
                        <i class="fa-solid fa-pen-to-square"></i> <span>Edit Harga Token</span>
                    </button>
                    <button type="button" onclick="openRegisterMadrasahModal()" class="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-2xl text-xs shadow-lg shadow-emerald-500/20 transition flex items-center gap-2 cursor-pointer">
                        <i class="fa-solid fa-plus"></i> <span>Daftar Madrasah Baru</span>
                    </button>
                    <button type="button" onclick="renderBossDashboard(document.getElementById('view-container'), appState.activeBossTab || 'tokens')" class="px-3.5 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-2xl text-xs transition cursor-pointer">
                        <i class="fa-solid fa-rotate mr-1"></i> Refresh
                    </button>
                </div>
            </div>

            <!-- Stats Overview Grid -->
            <div class="grid grid-cols-2 md:grid-cols-5 gap-3">
                <div class="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm space-y-1">
                    <div class="flex items-center justify-between text-slate-400">
                        <span class="text-[11px] font-bold uppercase tracking-wider text-slate-500">Madrasah</span>
                        <div class="w-7 h-7 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center font-bold text-xs">
                            <i class="fa-solid fa-school"></i>
                        </div>
                    </div>
                    <div class="text-xl font-extrabold text-slate-800">${totalMadrasah} <span class="text-xs font-medium text-slate-400">Sekolah</span></div>
                </div>

                <div class="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm space-y-1">
                    <div class="flex items-center justify-between text-slate-400">
                        <span class="text-[11px] font-bold uppercase tracking-wider text-slate-500">Harga Token</span>
                        <div class="w-7 h-7 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center font-bold text-xs">
                            <i class="fa-solid fa-tag"></i>
                        </div>
                    </div>
                    <div class="text-xl font-extrabold text-purple-700">Rp ${tokenPrice.toLocaleString('id-ID')}</div>
                </div>

                <div class="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm space-y-1">
                    <div class="flex items-center justify-between text-slate-400">
                        <span class="text-[11px] font-bold uppercase tracking-wider text-slate-500">Pending</span>
                        <div class="w-7 h-7 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center font-bold text-xs">
                            <i class="fa-solid fa-clock-rotate-left"></i>
                        </div>
                    </div>
                    <div class="text-xl font-extrabold text-amber-600">${pendingRequests.length} <span class="text-xs font-medium text-slate-400">Req</span></div>
                </div>

                <div class="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm space-y-1">
                    <div class="flex items-center justify-between text-slate-400">
                        <span class="text-[11px] font-bold uppercase tracking-wider text-slate-500">Token Terjual</span>
                        <div class="w-7 h-7 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center font-bold text-xs">
                            <i class="fa-solid fa-coins"></i>
                        </div>
                    </div>
                    <div class="text-xl font-extrabold text-emerald-600">${totalApprovedTokens.toLocaleString('id-ID')}</div>
                </div>

                <div class="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm space-y-1 col-span-2 md:col-span-1">
                    <div class="flex items-center justify-between text-slate-400">
                        <span class="text-[11px] font-bold uppercase tracking-wider text-slate-500">Omset Platform</span>
                        <div class="w-7 h-7 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center font-bold text-xs">
                            <i class="fa-solid fa-wallet"></i>
                        </div>
                    </div>
                    <div class="text-lg font-extrabold text-purple-800 truncate">Rp ${totalOmset.toLocaleString('id-ID')}</div>
                </div>
            </div>

            <!-- Tab Buttons -->
            <div class="flex items-center justify-between border-b border-slate-200 pb-2 flex-wrap gap-2">
                <div class="flex items-center gap-2 flex-wrap">
                    <button type="button" onclick="switchBossTab('tokens')" id="boss-tab-tokens" class="boss-tab-btn px-5 py-3 rounded-2xl text-xs font-bold transition flex items-center gap-2 ${initialTab === 'tokens' ? 'bg-purple-900 text-white shadow-md shadow-purple-900/10' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'}">
                        <i class="fa-solid fa-file-invoice-dollar"></i>
                        <span>Permintaan Top-Up Token</span>
                        ${pendingRequests.length > 0 ? `<span class="px-2 py-0.5 bg-amber-400 text-slate-900 text-[10px] font-black rounded-full">${pendingRequests.length}</span>` : ''}
                    </button>
                    <button type="button" onclick="switchBossTab('madrasahs')" id="boss-tab-madrasahs" class="boss-tab-btn px-5 py-3 rounded-2xl text-xs font-bold transition flex items-center gap-2 ${initialTab === 'madrasahs' ? 'bg-purple-900 text-white shadow-md shadow-purple-900/10' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'}">
                        <i class="fa-solid fa-building-columns"></i>
                        <span>Daftar Madrasah & Saldo Token</span>
                        <span class="px-2 py-0.5 bg-slate-200 text-slate-700 text-[10px] font-bold rounded-full">${madrasahs.length}</span>
                    </button>
                    <button type="button" onclick="switchBossTab('payment')" id="boss-tab-payment" class="boss-tab-btn px-5 py-3 rounded-2xl text-xs font-bold transition flex items-center gap-2 ${initialTab === 'payment' ? 'bg-purple-900 text-white shadow-md shadow-purple-900/10' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'}">
                        <i class="fa-solid fa-wallet"></i>
                        <span>Pengaturan Pembayaran</span>
                    </button>
                    <button type="button" onclick="switchBossTab('registration')" id="boss-tab-registration" class="boss-tab-btn px-5 py-3 rounded-2xl text-xs font-bold transition flex items-center gap-2 ${initialTab === 'registration' ? 'bg-purple-900 text-white shadow-md shadow-purple-900/10' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'}">
                        <i class="fa-solid fa-user-shield"></i>
                        <span>Pengaturan Pendaftaran</span>
                    </button>
                </div>
                <button type="button" onclick="renderBossDashboard(document.getElementById('view-container'), appState.activeBossTab || 'tokens')" class="px-4 py-3 bg-purple-50 hover:bg-purple-100 text-purple-900 font-bold rounded-2xl text-xs transition flex items-center gap-2 border border-purple-200 cursor-pointer shadow-sm" title="Refresh daftar madrasah dan permintaan top-up">
                    <i class="fa-solid fa-rotate"></i> <span>Refresh Data</span>
                </button>
            </div>

            <!-- Tab Content Container -->
            <div id="boss-tab-content">
                <!-- Dynamically loaded -->
            </div>
        </div>
    `;

    appState.activeBossTab = initialTab;
    switchBossTab(initialTab);
}

function switchBossTab(tabName) {
    appState.activeBossTab = tabName;
    document.querySelectorAll('.boss-tab-btn').forEach(btn => {
        btn.className = 'boss-tab-btn px-5 py-3 rounded-2xl text-xs font-bold transition flex items-center gap-2 bg-white text-slate-600 hover:bg-slate-100 border border-slate-200';
    });
    const activeBtn = document.getElementById(`boss-tab-${tabName}`);
    if (activeBtn) {
        activeBtn.className = 'boss-tab-btn px-5 py-3 rounded-2xl text-xs font-bold transition flex items-center gap-2 bg-purple-900 text-white shadow-md shadow-purple-900/10';
    }

    const contentDiv = document.getElementById('boss-tab-content');
    if (!contentDiv) return;

    if (tabName === 'tokens') {
        renderBossTokenRequestsTab(contentDiv);
    } else if (tabName === 'madrasahs') {
        renderBossMadrasahsTab(contentDiv);
    } else if (tabName === 'payment') {
        renderBossPaymentTab(contentDiv);
    } else if (tabName === 'registration') {
        renderBossRegistrationTab(contentDiv);
    }
}

function renderBossTokenRequestsTab(container) {
    const requests = appState.tokenRequests || [];
    const sorted = [...requests].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    let html = `
        <!-- CRYPTOGRAPHIC OFFLINE KEY GENERATOR SECTION -->
        <div class="mb-6 bg-slate-50 border border-slate-200/80 rounded-3xl p-5 shadow-sm">
            <div class="flex items-center gap-3 mb-4">
                <div class="w-10 h-10 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center text-sm font-bold shadow-sm">
                    <i class="fa-solid fa-key"></i>
                </div>
                <div>
                    <h3 class="text-xs font-bold uppercase text-slate-800 tracking-wider">Hasilkan Kunci Aktivasi Luring (Offline CBT License)</h3>
                    <p class="text-[11px] text-slate-500">Gunakan fitur ini untuk membuat kode aktivasi jika madrasah menginstal secara luring/offline di localhost. Setelah mereka transfer, buatkan kode ini untuk mereka masukkan luring.</p>
                </div>
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3 items-end">
                <div>
                    <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">Jumlah Token</label>
                    <input type="number" id="offline-act-qty" value="50" min="1" class="w-full bg-white border border-slate-200 rounded-2xl p-2.5 text-xs text-slate-800 focus:outline-none focus:border-emerald-500 transition" />
                </div>
                <div>
                    <button type="button" onclick="generateOfflineActivationKey()" class="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold p-2.5 text-xs rounded-2xl shadow-sm transition flex items-center justify-center gap-2">
                        <i class="fa-solid fa-wand-magic-sparkles"></i> Hasilkan Kunci Aktivasi
                    </button>
                </div>
            </div>
            
            <div id="offline-act-result" class="mt-4 hidden">
                <label class="block text-[10px] font-bold text-emerald-700 uppercase mb-1">Kode Aktivasi Berhasil Dibuat (Salin & Kirim ke Madrasah):</label>
                <div class="flex gap-2">
                    <input type="text" id="offline-act-key-field" readonly class="flex-1 bg-emerald-50 border border-emerald-200 rounded-2xl p-3 text-[11px] font-mono text-emerald-800 focus:outline-none" />
                    <button type="button" onclick="copyOfflineActivationKey()" class="px-5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-2xl transition flex items-center gap-1">
                        <i class="fa-solid fa-copy text-xs"></i> Salin Kode
                    </button>
                </div>
            </div>
        </div>
    `;

    if (requests.length === 0) {
        html += `
            <div class="bg-white rounded-3xl p-12 text-center border border-slate-100 space-y-3 shadow-sm">
                <div class="w-16 h-16 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto text-2xl">
                    <i class="fa-solid fa-inbox"></i>
                </div>
                <h3 class="text-base font-bold text-slate-700">Belum Ada Permintaan Top-Up Token</h3>
                <p class="text-xs text-slate-400 max-w-md mx-auto">Ketika admin madrasah mengajukan pembelian token dari menu CBT, rincian permintaan akan muncul di sini.</p>
            </div>
        `;
    } else {
        html += `
            <div class="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                <div class="p-5 border-b border-slate-100 flex items-center justify-between">
                    <div>
                        <h2 class="text-base font-bold text-slate-800">Daftar Permintaan Top-Up Token Ujian</h2>
                        <p class="text-xs text-slate-400">Setujui atau edit jumlah token yang dikirim ke akun madrasah setelah verifikasi pembayaran</p>
                    </div>
                </div>

                <div class="overflow-x-auto">
                    <table class="w-full text-left border-collapse text-xs">
                        <thead>
                            <tr class="bg-slate-50/80 border-b border-slate-100 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                                <th class="p-4">Tanggal</th>
                                <th class="p-4">Madrasah</th>
                                <th class="p-4">Jumlah Token</th>
                                <th class="p-4">Total Biaya</th>
                                <th class="p-4">Catatan / Bukti TF</th>
                                <th class="p-4">Status</th>
                                <th class="p-4 text-center">Aksi / Verifikasi</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-100">
                            ${sorted.map(req => {
                                const dateStr = req.createdAt ? new Date(req.createdAt).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : '-';
                                const statusBadge = req.status === 'approved'
                                    ? `<span class="px-2.5 py-1 bg-emerald-100 text-emerald-800 font-bold rounded-full text-[10px]"><i class="fa-solid fa-check mr-1"></i>Disetujui (+${req.approvedQuantity || req.quantity})</span>`
                                    : req.status === 'rejected'
                                    ? `<span class="px-2.5 py-1 bg-rose-100 text-rose-800 font-bold rounded-full text-[10px]"><i class="fa-solid fa-xmark mr-1"></i>Ditolak</span>`
                                    : `<span class="px-2.5 py-1 bg-amber-100 text-amber-800 font-bold rounded-full text-[10px] animate-pulse"><i class="fa-solid fa-hourglass-half mr-1"></i>Menunggu</span>`;

                                return `
                                    <tr class="hover:bg-slate-50/50 transition">
                                        <td class="p-4 text-slate-500 font-mono text-[11px]">${dateStr}</td>
                                        <td class="p-4 font-bold text-slate-800">
                                            <div>${req.madrasahName || 'Madrasah'}</div>
                                            <span class="text-[10px] text-slate-400 font-normal">ID: ${req.madrasahId}</span>
                                        </td>
                                        <td class="p-4 font-extrabold text-amber-600 text-sm">${req.quantity} Token</td>
                                        <td class="p-4 font-extrabold text-slate-800">Rp ${(req.totalPrice || req.quantity * 5000).toLocaleString('id-ID')}</td>
                                        <td class="p-4 text-slate-600 max-w-xs">
                                            <div class="bg-slate-50 p-2 rounded-xl border border-slate-200/80 text-[11px] font-mono whitespace-pre-wrap">${req.proofNote || 'Tidak ada catatan'}</div>
                                        </td>
                                        <td class="p-4">${statusBadge}</td>
                                        <td class="p-4 text-center">
                                            ${req.status === 'pending' ? `
                                                <div class="flex items-center justify-center gap-1.5">
                                                    <button type="button" onclick="openApproveTokenRequestModal('${req.id}', ${req.quantity}, '${(req.madrasahName || 'Madrasah').replace(/'/g, "\\'")}')" class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] rounded-xl shadow-sm transition">
                                                        <i class="fa-solid fa-check mr-1"></i> Setujui
                                                    </button>
                                                    <button type="button" onclick="openApproveTokenRequestModal('${req.id}', ${req.quantity}, '${(req.madrasahName || 'Madrasah').replace(/'/g, "\\'")}')" class="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] rounded-xl shadow-sm transition" title="Edit jumlah token lalu setujui">
                                                        <i class="fa-solid fa-pen"></i>
                                                    </button>
                                                    <button type="button" onclick="openRejectTokenRequestModal('${req.id}', '${(req.madrasahName || 'Madrasah').replace(/'/g, "\\'")}')" class="px-2.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-[11px] rounded-xl shadow-sm transition" title="Tolak">
                                                        <i class="fa-solid fa-xmark"></i>
                                                    </button>
                                                </div>
                                            ` : `
                                                <span class="text-[11px] text-slate-400 italic">Selesai</span>
                                            `}
                                        </td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    container.innerHTML = html;
}


// --- OFFLINE MADRASAH LICENSE MANAGEMENT ---
async function generateOfflineMadrasahLicense() {
    const btn = document.getElementById('btn-generate-offline-madrasah-license');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner animate-spin"></i> Membuat Key...'; }
    try {
        const res = await fetch('/api/boss/generate-offline-madrasah-license', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) { if (window.showToast) window.showToast(data.message || 'Gagal membuat key lisensi offline.', 'error'); return; }
        const field = document.getElementById('offline-madrasah-license-key');
        const idField = document.getElementById('offline-madrasah-license-id');
        if (field) field.value = data.activationKey || '';
        if (idField) idField.textContent = data.licenseId || '-';
        const result = document.getElementById('offline-madrasah-license-result');
        if (result) result.classList.remove('hidden');
        if (window.showToast) window.showToast('Key lisensi madrasah offline berhasil dibuat.', 'success');
    } catch (err) { if (window.showToast) window.showToast('Server BOSS tidak dapat dihubungi.', 'error'); }
    finally { if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-key"></i> Buat Key Aktivasi'; } }
}
function copyOfflineMadrasahLicenseKey() {
    const field = document.getElementById('offline-madrasah-license-key');
    if (!field || !field.value) return;
    try { navigator.clipboard.writeText(field.value); if (window.showToast) window.showToast('Key aktivasi berhasil disalin.', 'success'); }
    catch (_) { field.select(); document.execCommand('copy'); }
}
async function renameMadrasahFromBoss(madrasahId, currentName) {
    const name = prompt('Nama madrasah:', currentName || '');
    if (name === null) return;
    const clean = String(name).trim();
    if (!clean) { if (window.showToast) window.showToast('Nama madrasah tidak boleh kosong.', 'error'); return; }
    try {
        const res = await fetch('/api/madrasahs/' + encodeURIComponent(madrasahId) + '/update', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: clean })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) { if (window.showToast) window.showToast(data.message || 'Gagal mengganti nama madrasah.', 'error'); return; }
        const idx = (appState.madrasahs || []).findIndex(m => String(m.id) === String(madrasahId) || String(m.slug) === String(madrasahId));
        if (idx >= 0) appState.madrasahs[idx] = { ...appState.madrasahs[idx], ...(data.madrasah || {}), name: clean };
        if (window.showToast) window.showToast('Nama madrasah berhasil diperbarui.', 'success');
        renderBossDashboard(document.getElementById('view-container'), 'madrasahs');
    } catch (_) { if (window.showToast) window.showToast('Gagal terhubung ke server.', 'error'); }
}
window.generateOfflineMadrasahLicense = generateOfflineMadrasahLicense;
window.copyOfflineMadrasahLicenseKey = copyOfflineMadrasahLicenseKey;
window.renameMadrasahFromBoss = renameMadrasahFromBoss;

function renderBossMadrasahsTab(container) {
    const madrasahs = appState.madrasahs || [];

    container.innerHTML = `
        <div class="mb-5 bg-indigo-50 border border-indigo-100 rounded-3xl p-5 shadow-sm">
            <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div><div class="flex items-center gap-2 text-indigo-900 font-extrabold text-sm"><i class="fa-solid fa-key"></i> Aktivasi Madrasah Offline</div><p class="text-[11px] text-indigo-700 mt-1 max-w-2xl">Buat key khusus untuk instalasi offline. Setelah Admin memasukkan key dan melakukan sinkronisasi saat internet tersedia, madrasah otomatis masuk ke daftar.</p></div>
                <button type="button" id="btn-generate-offline-madrasah-license" onclick="generateOfflineMadrasahLicense()" class="shrink-0 px-4 py-2.5 bg-indigo-700 hover:bg-indigo-800 text-white rounded-2xl text-xs font-bold shadow-sm transition flex items-center gap-2"><i class="fa-solid fa-key"></i> Buat Key Aktivasi</button>
            </div>
            <div id="offline-madrasah-license-result" class="hidden mt-4 bg-white border border-indigo-100 rounded-2xl p-3"><div class="flex items-center justify-between gap-2 mb-2"><span class="text-[10px] uppercase font-bold text-slate-500">License ID</span><span id="offline-madrasah-license-id" class="font-mono font-bold text-indigo-800 text-[11px]">-</span></div><div class="flex gap-2"><input id="offline-madrasah-license-key" readonly class="flex-1 min-w-0 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-[10px] font-mono text-slate-700"><button type="button" onclick="copyOfflineMadrasahLicenseKey()" class="px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-bold"><i class="fa-solid fa-copy"></i> Salin</button></div></div>
        </div>
        <div class="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden space-y-4 p-5">
            <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-3 border-b border-slate-100">
                <div>
                    <h2 class="text-base font-bold text-slate-800">Daftar Madrasah Terdaftar</h2>
                    <p class="text-xs text-slate-400">Total ${madrasahs.length} sekolah terhubung di platform ini (Kelola status, hapus, atau lihat data akun)</p>
                </div>

                <div class="w-full sm:w-auto flex items-center gap-2">
                    <input type="text" id="search-madrasah-input" onkeyup="filterMadrasahTable()" placeholder="Cari sekolah/admin..." class="px-4 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium focus:outline-none focus:bg-white focus:ring-2 focus:ring-purple-500 w-full sm:w-64">
                </div>
            </div>

            <div class="overflow-x-auto">
                <table id="table-madrasah" class="w-full text-left border-collapse text-xs">
                    <thead>
                        <tr class="bg-slate-50/80 border-b border-slate-100 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                            <th class="p-3.5">Nama Madrasah & Status</th>
                            <th class="p-3.5">Jenjang</th>
                            <th class="p-3.5">URL Portal</th>
                            <th class="p-3.5">Administrator</th>
                            <th class="p-3.5">Saldo Token</th>
                            <th class="p-3.5 text-center">Aksi Manajemen</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100">
                        ${madrasahs.map(m => {
                            const portalUrl = m.slug === 'default' ? '/' : `/m/${m.slug}`;
                            const safeName = (m.name || '').replace(/'/g, "\\'");
                            const isActive = m.isActive !== false;
                            const statusBadge = isActive 
                                ? `<span class="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-md text-[9px] font-bold">AKTIF</span>` 
                                : `<span class="px-2 py-0.5 bg-rose-100 text-rose-800 rounded-md text-[9px] font-bold">NONAKTIF</span>`;

                            return `
                                <tr class="hover:bg-slate-50/50 transition">
                                    <td class="p-3.5 font-bold text-slate-800">
                                        <div class="flex items-center gap-2">
                                            <div class="w-7 h-7 bg-emerald-100 text-emerald-700 rounded-lg flex items-center justify-center font-bold text-xs">
                                                <i class="fa-solid fa-school"></i>
                                            </div>
                                            <div>
                                                <div>${m.name}</div>
                                                <div class="mt-0.5">${statusBadge}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td class="p-3.5 font-semibold text-slate-600">${m.level || 'MTs'}</td>
                                    <td class="p-3.5">
                                        <a href="${portalUrl}" target="_blank" class="px-2.5 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 font-mono font-bold rounded-xl text-[11px] inline-flex items-center gap-1">
                                            <span>${portalUrl}</span> <i class="fa-solid fa-up-right-from-square text-[9px]"></i>
                                        </a>
                                    </td>
                                    <td class="p-3.5 font-medium text-slate-700">
                                        <div>${m.adminName || 'Admin'}</div>
                                        <span class="text-[10px] text-slate-400 font-mono">user: ${m.adminUser || 'admin'}</span>
                                    </td>
                                    <td class="p-3.5">
                                        <span class="px-3 py-1 bg-amber-50 border border-amber-200 text-amber-900 font-extrabold rounded-xl text-xs inline-flex items-center gap-1">
                                            <i class="fa-solid fa-coins text-amber-500"></i> ${m.cbtTokenBalance || 0}
                                        </span>
                                    </td>
                                    <td class="p-3.5 text-center">
                                        <div class="flex items-center justify-center gap-1.5 flex-wrap">
                                            <button type="button" onclick="openManageMadrasahModal('${m.id}')" class="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-[10px] transition shadow-sm inline-flex items-center gap-1 cursor-pointer" title="Kelola akun guru & siswa">
                                                <i class="fa-solid fa-users-gear"></i> Kelola
                                            </button>
                                            <button type="button" onclick="renameMadrasahFromBoss('${m.id}', '${safeName}')" class="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-[10px] transition shadow-sm inline-flex items-center gap-1 cursor-pointer" title="Ganti nama madrasah"><i class="fa-solid fa-pen"></i> Rename</button>
                                            <button type="button" onclick="openEditMadrasahTokenModal('${m.id}', '${safeName}', ${m.cbtTokenBalance || 0})" class="px-2.5 py-1.5 bg-purple-700 hover:bg-purple-800 text-white font-bold rounded-xl text-[10px] transition shadow-sm inline-flex items-center gap-1 cursor-pointer" title="Edit saldo token">
                                                <i class="fa-solid fa-coins"></i> Token
                                            </button>
                                            <button type="button" onclick="toggleMadrasahStatus('${m.id}')" class="px-2.5 py-1.5 ${isActive ? 'bg-amber-600 hover:bg-amber-700' : 'bg-emerald-600 hover:bg-emerald-700'} text-white font-bold rounded-xl text-[10px] transition shadow-sm inline-flex items-center gap-1 cursor-pointer" title="${isActive ? 'Nonaktifkan madrasah' : 'Aktifkan madrasah'}">
                                                <i class="fa-solid ${isActive ? 'fa-ban' : 'fa-check'}"></i> ${isActive ? 'Nonaktifkan' : 'Aktifkan'}
                                            </button>
                                            <button type="button" onclick="deleteMadrasah('${m.id}', '${safeName}')" class="px-2.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-[10px] transition shadow-sm inline-flex items-center gap-1 cursor-pointer" title="Hapus madrasah">
                                                <i class="fa-solid fa-trash-can"></i> Hapus
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

async function renderBossRegistrationTab(container) {
    if (!container) return;
    container.innerHTML = `
        <div class="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 text-center text-slate-500">
            <i class="fa-solid fa-spinner animate-spin mr-2"></i> Memuat kebijakan pendaftaran...
        </div>
    `;
    const policy = await fetchMadrasahRegistrationPolicy();
    const mode = policy.mode || 'closed';
    container.innerHTML = `
        <div class="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-6">
            <div class="border-b border-slate-100 pb-4">
                <h2 class="text-base font-bold text-slate-800 flex items-center gap-2">
                    <i class="fa-solid fa-user-shield text-purple-700"></i>
                    <span>Pengaturan Pendaftaran Madrasah Baru</span>
                </h2>
                <p class="text-xs text-slate-400 mt-1">Kontrol siapa yang dapat membuat tenant/madrasah baru dari halaman login. Pengaturan ini berlaku global untuk seluruh platform.</p>
            </div>

            <form onsubmit="saveMadrasahRegistrationPolicy(event)" class="space-y-5">
                <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <label class="cursor-pointer p-4 rounded-2xl border ${mode === 'closed' ? 'border-rose-300 bg-rose-50 ring-1 ring-rose-200' : 'border-slate-200 bg-slate-50'}">
                        <div class="flex items-start gap-3">
                            <input type="radio" name="registration_mode" value="closed" ${mode === 'closed' ? 'checked' : ''} onchange="toggleBossRegistrationInviteField()" class="mt-1">
                            <div>
                                <div class="text-xs font-extrabold text-slate-800">Ditutup</div>
                                <p class="text-[11px] text-slate-500 mt-1">Tombol daftar disembunyikan dan endpoint publik menolak pendaftaran.</p>
                            </div>
                        </div>
                    </label>
                    <label class="cursor-pointer p-4 rounded-2xl border ${mode === 'open' ? 'border-emerald-300 bg-emerald-50 ring-1 ring-emerald-200' : 'border-slate-200 bg-slate-50'}">
                        <div class="flex items-start gap-3">
                            <input type="radio" name="registration_mode" value="open" ${mode === 'open' ? 'checked' : ''} onchange="toggleBossRegistrationInviteField()" class="mt-1">
                            <div>
                                <div class="text-xs font-extrabold text-slate-800">Terbuka</div>
                                <p class="text-[11px] text-slate-500 mt-1">Tombol daftar tampil dan pendaftaran publik dapat dilakukan tanpa kode.</p>
                            </div>
                        </div>
                    </label>
                    <label class="cursor-pointer p-4 rounded-2xl border ${mode === 'invite' ? 'border-indigo-300 bg-indigo-50 ring-1 ring-indigo-200' : 'border-slate-200 bg-slate-50'}">
                        <div class="flex items-start gap-3">
                            <input type="radio" name="registration_mode" value="invite" ${mode === 'invite' ? 'checked' : ''} onchange="toggleBossRegistrationInviteField()" class="mt-1">
                            <div>
                                <div class="text-xs font-extrabold text-slate-800">Kode Undangan</div>
                                <p class="text-[11px] text-slate-500 mt-1">Tombol daftar tampil, tetapi pendaftar wajib memiliki kode dari BOSS.</p>
                            </div>
                        </div>
                    </label>
                </div>

                <div id="boss-registration-invite-box" class="${mode === 'invite' ? '' : 'hidden'} p-4 rounded-2xl bg-indigo-50/70 border border-indigo-100 space-y-2">
                    <label class="block text-xs font-bold text-indigo-900">Kode Undangan Baru</label>
                    <input type="password" id="boss-registration-invite-code" autocomplete="new-password" placeholder="${policy.inviteConfigured ? 'Kosongkan jika tetap memakai kode yang tersimpan' : 'Minimal 6 karakter'}" class="w-full px-4 py-2.5 bg-white border border-indigo-200 rounded-2xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    <p class="text-[10px] text-indigo-700">${policy.inviteConfigured ? 'Kode undangan sudah tersimpan aman dalam bentuk hash. Isi kolom hanya jika ingin menggantinya.' : 'Belum ada kode undangan tersimpan. Isi kode sebelum menyimpan mode ini.'}</p>
                </div>

                <div class="flex items-center justify-between gap-3 pt-4 border-t border-slate-100 flex-wrap">
                    <div class="text-[11px] text-slate-500">
                        <i class="fa-solid fa-circle-info mr-1"></i>
                        BOSS tetap dapat menambahkan madrasah dari dashboard walaupun pendaftaran publik ditutup.
                    </div>
                    <button type="submit" id="btn-save-registration-policy" class="px-5 py-2.5 bg-purple-900 hover:bg-purple-800 text-white font-bold text-xs rounded-2xl shadow-sm transition flex items-center gap-2 cursor-pointer">
                        <i class="fa-solid fa-floppy-disk"></i> Simpan Kebijakan
                    </button>
                </div>
            </form>
        </div>
    `;
}

function toggleBossRegistrationInviteField() {
    const selected = document.querySelector('input[name="registration_mode"]:checked');
    const box = document.getElementById('boss-registration-invite-box');
    if (box) box.classList.toggle('hidden', !selected || selected.value !== 'invite');
}

async function saveMadrasahRegistrationPolicy(e) {
    if (e) e.preventDefault();
    const selected = document.querySelector('input[name="registration_mode"]:checked');
    const mode = selected ? selected.value : 'closed';
    const inviteCode = document.getElementById('boss-registration-invite-code')?.value.trim() || '';
    const btn = document.getElementById('btn-save-registration-policy');

    if (mode === 'invite' && !inviteCode && !appState.madrasahRegistrationPolicy?.inviteConfigured) {
        if (window.showToast) window.showToast('Isi kode undangan sebelum mengaktifkan mode Kode Undangan.', 'error');
        return;
    }

    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner animate-spin"></i> Menyimpan...';
    }
    try {
        const res = await fetch('/api/registration-policy', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mode, ...(inviteCode ? { inviteCode } : {}) })
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.success) {
            if (window.showToast) window.showToast(data?.message || 'Gagal menyimpan kebijakan pendaftaran.', 'error');
            return;
        }
        appState.madrasahRegistrationPolicy = data.policy;
        if (window.showToast) window.showToast(data.message || 'Kebijakan pendaftaran tersimpan.', 'success');
        await refreshMadrasahRegistrationUi();
        await renderBossRegistrationTab(document.getElementById('boss-tab-content'));
    } catch (err) {
        if (window.showToast) window.showToast('Gagal terhubung ke server.', 'error');
    } finally {
        if (btn && document.body.contains(btn)) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Simpan Kebijakan';
        }
    }
}

function renderBossPaymentTab(container) {
    const paymentAccounts = appState.paymentAccounts || [
        { id: '1', name: 'ShopeePay', number: '081234567890', owner: 'BOS PLATFORM' },
        { id: '2', name: 'DANA', number: '081234567890', owner: 'BOS PLATFORM' },
        { id: '3', name: 'Bank BRI', number: '0123-01-098765-50-1', owner: 'BOS PLATFORM' },
        { id: '4', name: 'Bank Mandiri', number: '130-00-9876543-2', owner: 'BOS PLATFORM' }
    ];

    container.innerHTML = `
        <div class="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-6">
            <div class="border-b border-slate-100 pb-4 flex items-center justify-between">
                <div>
                    <h2 class="text-base font-bold text-slate-800">Pengaturan Rekening Pembayaran Top-Up Token</h2>
                    <p class="text-xs text-slate-400">Atur nomor rekening e-wallet (ShopeePay, DANA, OVO) atau bank yang akan otomatis tampil di modal top-up token akun Admin Madrasah.</p>
                </div>
                <button type="button" onclick="addPaymentAccountRow()" class="px-4 py-2 bg-purple-900 hover:bg-purple-800 text-white font-bold text-xs rounded-2xl shadow-sm transition flex items-center gap-1.5 cursor-pointer">
                    <i class="fa-solid fa-plus"></i> Tambah Rekening
                </button>
            </div>

            <form onsubmit="submitPaymentSettings(event)" class="space-y-4">
                <div id="payment-accounts-list" class="space-y-3">
                    ${paymentAccounts.map((acc, idx) => `
                        <div class="payment-row grid grid-cols-1 sm:grid-cols-12 gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-200/80 items-center">
                            <div class="sm:col-span-3">
                                <label class="block text-[10px] font-bold uppercase text-slate-400 mb-1">Nama Layanan / Bank</label>
                                <input type="text" name="acc_name" value="${acc.name || ''}" placeholder="Cth: ShopeePay / DANA / BCA" required class="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800">
                            </div>
                            <div class="sm:col-span-4">
                                <label class="block text-[10px] font-bold uppercase text-slate-400 mb-1">Nomor Rekening / No. HP</label>
                                <input type="text" name="acc_number" value="${acc.number || ''}" placeholder="Cth: 081234567890" required class="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800">
                            </div>
                            <div class="sm:col-span-4">
                                <label class="block text-[10px] font-bold uppercase text-slate-400 mb-1">Atas Nama (a.n.)</label>
                                <input type="text" name="acc_owner" value="${acc.owner || ''}" placeholder="Cth: PT BOS PLATFORM" class="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800">
                            </div>
                            <div class="sm:col-span-1 flex items-end justify-center pt-5">
                                <button type="button" onclick="this.closest('.payment-row').remove()" class="w-9 h-9 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl flex items-center justify-center transition" title="Hapus rekening">
                                    <i class="fa-solid fa-trash-can text-xs"></i>
                                </button>
                            </div>
                        </div>
                    `).join('')}
                </div>

                <div class="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                    <button type="submit" class="px-6 py-3 bg-purple-900 hover:bg-purple-800 text-white font-bold text-xs rounded-2xl shadow-md transition flex items-center gap-2 cursor-pointer">
                        <i class="fa-solid fa-floppy-disk"></i> Simpan Pengaturan Pembayaran
                    </button>
                </div>
            </form>
        </div>
    `;
}

function addPaymentAccountRow() {
    const list = document.getElementById('payment-accounts-list');
    if (!list) return;
    const div = document.createElement('div');
    div.className = 'payment-row grid grid-cols-1 sm:grid-cols-12 gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-200/80 items-center animate-in fade-in duration-200';
    div.innerHTML = `
        <div class="sm:col-span-3">
            <label class="block text-[10px] font-bold uppercase text-slate-400 mb-1">Nama Layanan / Bank</label>
            <input type="text" name="acc_name" value="" placeholder="Cth: ShopeePay / DANA / BCA" required class="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800">
        </div>
        <div class="sm:col-span-4">
            <label class="block text-[10px] font-bold uppercase text-slate-400 mb-1">Nomor Rekening / No. HP</label>
            <input type="text" name="acc_number" value="" placeholder="Cth: 081234567890" required class="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800">
        </div>
        <div class="sm:col-span-4">
            <label class="block text-[10px] font-bold uppercase text-slate-400 mb-1">Atas Nama (a.n.)</label>
            <input type="text" name="acc_owner" value="" placeholder="Cth: PT BOS PLATFORM" class="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800">
        </div>
        <div class="sm:col-span-1 flex items-end justify-center pt-5">
            <button type="button" onclick="this.closest('.payment-row').remove()" class="w-9 h-9 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl flex items-center justify-center transition" title="Hapus rekening">
                <i class="fa-solid fa-trash-can text-xs"></i>
            </button>
        </div>
    `;
    list.appendChild(div);
}

async function submitPaymentSettings(e) {
    e.preventDefault();
    const rows = document.querySelectorAll('.payment-row');
    const paymentAccounts = [];
    rows.forEach((row, idx) => {
        const name = row.querySelector('input[name="acc_name"]').value.trim();
        const number = row.querySelector('input[name="acc_number"]').value.trim();
        const owner = row.querySelector('input[name="acc_owner"]').value.trim();
        if (name && number) {
            paymentAccounts.push({ id: 'acc_' + (idx + 1), name, number, owner });
        }
    });

    try {
        const res = await fetch('/api/payment-settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ paymentAccounts })
        });
        const data = await res.json();
        if (data.success) {
            appState.paymentAccounts = data.paymentAccounts;
            alert(data.message || 'Pengaturan pembayaran berhasil disimpan!');
        } else {
            alert(data.message || 'Gagal menyimpan pengaturan.');
        }
    } catch (err) {
        console.error(err);
        alert('Terjadi kesalahan jaringan.');
    }
}

async function deleteMadrasah(madrasahId, madrasahName) {
    if (!confirm(`Apakah Anda yakin ingin menghapus madrasah "${madrasahName}" beserta seluruh data terkait? Tindakan ini tidak dapat dibatalkan.`)) {
        return;
    }
    try {
        const res = await fetch(`/api/madrasahs/${encodeURIComponent(madrasahId)}`, {
            method: 'DELETE'
        });
        const data = await res.json();
        if (data.success) {
            appState.madrasahs = (appState.madrasahs || []).filter(m => String(m.id) !== String(madrasahId) && String(m.slug) !== String(madrasahId));
            alert(data.message || 'Madrasah berhasil dihapus.');
            renderBossMadrasahsTab(document.getElementById('boss-tab-content'));
        } else {
            alert(data.message || 'Gagal menghapus madrasah.');
        }
    } catch (err) {
        console.error(err);
        alert('Terjadi kesalahan jaringan.');
    }
}

async function toggleMadrasahStatus(madrasahId) {
    try {
        const res = await fetch(`/api/madrasahs/${encodeURIComponent(madrasahId)}/toggle-status`, {
            method: 'POST'
        });
        const data = await res.json();
        if (data.success) {
            const idx = (appState.madrasahs || []).findIndex(m => String(m.id) === String(madrasahId) || String(m.slug) === String(madrasahId));
            if (idx >= 0 && data.madrasah) {
                appState.madrasahs[idx] = data.madrasah;
            }
            renderBossMadrasahsTab(document.getElementById('boss-tab-content'));
        } else {
            alert(data.message || 'Gagal mengubah status madrasah.');
        }
    } catch (err) {
        console.error(err);
        alert('Terjadi kesalahan jaringan.');
    }
}

function openManageMadrasahModal(madrasahId) {
    const madrasah = (appState.madrasahs || []).find(m => String(m.id) === String(madrasahId) || String(m.slug) === String(madrasahId)) || {};
    const teachers = (appState.teachers || []).filter(t => String(t.madrasahId) === String(madrasah.id) || String(t.madrasahSlug) === String(madrasah.slug) || (madrasah.id === 'default' && (!t.madrasahId || t.madrasahId === 'default')));
    const students = (appState.students || []).filter(s => String(s.madrasahId) === String(madrasah.id) || String(s.madrasahSlug) === String(madrasah.slug) || (madrasah.id === 'default' && (!s.madrasahId || s.madrasahId === 'default')));

    let modal = document.getElementById('manage-madrasah-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'manage-madrasah-modal';
        document.body.appendChild(modal);
    }

    modal.className = 'fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto';
    modal.innerHTML = `
        <div class="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-100 p-6 sm:p-8 space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div class="flex items-center justify-between border-b border-slate-100 pb-4">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 bg-purple-100 text-purple-700 rounded-2xl flex items-center justify-center font-bold text-lg">
                        <i class="fa-solid fa-school"></i>
                    </div>
                    <div>
                        <h3 class="text-base font-bold text-slate-800">Kelola Madrasah: ${madrasah.name || 'Madrasah'}</h3>
                        <p class="text-xs text-slate-400">Jenjang: ${madrasah.level || 'MA'} | Portal: /m/${madrasah.slug || 'default'}</p>
                    </div>
                </div>
                <button type="button" onclick="closeManageMadrasahModal()" class="w-8 h-8 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 flex items-center justify-center transition">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>

            <div class="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
                <!-- Admin info card -->
                <div class="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-2">
                    <h4 class="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                        <i class="fa-solid fa-user-shield text-purple-600"></i> Akun Administrator Madrasah
                    </h4>
                    <div class="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                        <div>
                            <span class="text-[10px] text-slate-400 block">Nama Admin</span>
                            <strong class="text-slate-800">${madrasah.adminName || 'Administrator'}</strong>
                        </div>
                        <div>
                            <span class="text-[10px] text-slate-400 block">Username / Password</span>
                            <span class="font-mono text-slate-700">${madrasah.adminUser || 'admin'} / ${madrasah.adminPass || '...'}</span>
                        </div>
                        <div>
                            <span class="text-[10px] text-slate-400 block">Kontak WA</span>
                            <span class="font-mono text-slate-700">${madrasah.phone || '-'}</span>
                        </div>
                    </div>
                </div>

                <!-- Teachers list -->
                <div class="space-y-2">
                    <h4 class="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center justify-between">
                        <span class="flex items-center gap-1.5"><i class="fa-solid fa-chalkboard-user text-emerald-600"></i> Daftar Guru (${teachers.length})</span>
                    </h4>
                    <div class="bg-white rounded-2xl border border-slate-200 overflow-hidden max-h-48 overflow-y-auto">
                        ${teachers.length === 0 ? `
                            <div class="p-6 text-center text-xs text-slate-400">Belum ada akun guru terdaftar di madrasah ini.</div>
                        ` : `
                            <table class="w-full text-left text-xs border-collapse">
                                <thead class="bg-slate-50 text-[10px] uppercase text-slate-400 border-b border-slate-200">
                                    <tr>
                                        <th class="p-2.5">Nama Guru / NIP</th>
                                        <th class="p-2.5">Username</th>
                                        <th class="p-2.5">Mapel</th>
                                        <th class="p-2.5 text-right">Saldo Token</th>
                                    </tr>
                                </thead>
                                <tbody class="divide-y divide-slate-100">
                                    ${teachers.map(t => `
                                        <tr>
                                            <td class="p-2.5 font-bold text-slate-800">${t.name} <span class="block text-[10px] font-normal text-slate-400">NIP: ${t.nip || '-'}</span></td>
                                            <td class="p-2.5 font-mono text-slate-600">${t.username}</td>
                                            <td class="p-2.5 text-slate-600">${Array.isArray(t.mapel) ? t.mapel.join(', ') : (t.mapel || '-')}</td>
                                            <td class="p-2.5 text-right">
                                                <button type="button" onclick="editTeacherTokenBalance('${t.id}', '${(t.name||'Guru').replace(/'/g, "\\'")}', ${t.cbtTokenBalance || 0})" class="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 font-extrabold rounded-xl text-[10px] transition inline-flex items-center gap-1 cursor-pointer" title="Klik untuk edit token guru">
                                                    <i class="fa-solid fa-coins text-amber-500"></i>
                                                    <span>${t.cbtTokenBalance || 0} Token</span>
                                                    <i class="fa-solid fa-pen text-[9px] text-amber-600 ml-0.5"></i>
                                                </button>
                                            </td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        `}
                    </div>
                </div>

                <!-- Students list -->
                <div class="space-y-2">
                    <h4 class="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center justify-between">
                        <span class="flex items-center gap-1.5"><i class="fa-solid fa-user-graduate text-blue-600"></i> Daftar Siswa (${students.length})</span>
                    </h4>
                    <div class="bg-white rounded-2xl border border-slate-200 overflow-hidden max-h-48 overflow-y-auto">
                        ${students.length === 0 ? `
                            <div class="p-6 text-center text-xs text-slate-400">Belum ada akun siswa terdaftar di madrasah ini.</div>
                        ` : `
                            <table class="w-full text-left text-xs border-collapse">
                                <thead class="bg-slate-50 text-[10px] uppercase text-slate-400 border-b border-slate-200">
                                    <tr>
                                        <th class="p-2.5">Nama Siswa / NIS</th>
                                        <th class="p-2.5">Kelas</th>
                                        <th class="p-2.5">Username</th>
                                    </tr>
                                </thead>
                                <tbody class="divide-y divide-slate-100">
                                    ${students.map(s => `
                                        <tr>
                                            <td class="p-2.5 font-bold text-slate-800">${s.name} <span class="block text-[10px] font-normal text-slate-400">NIS: ${s.nis || '-'}</span></td>
                                            <td class="p-2.5 font-semibold text-slate-600">${s.className || s.kelas || '-'}</td>
                                            <td class="p-2.5 font-mono text-slate-600">${s.username}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        `}
                    </div>
                </div>
            </div>

            <div class="flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
                <button type="button" onclick="closeManageMadrasahModal()" class="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-2xl text-xs transition">Tutup</button>
            </div>
        </div>
    `;
    modal.classList.remove('hidden');
}

function closeManageMadrasahModal() {
    const modal = document.getElementById('manage-madrasah-modal');
    if (modal) modal.classList.add('hidden');
}

function filterMadrasahTable() {
    const input = document.getElementById('search-madrasah-input');
    const filter = input ? input.value.toLowerCase() : '';
    const table = document.getElementById('table-madrasah');
    if (!table) return;
    const trs = table.querySelectorAll('tbody tr');
    trs.forEach(tr => {
        const text = tr.innerText.toLowerCase();
        tr.style.display = text.includes(filter) ? '' : 'none';
    });
}

async function generateOfflineActivationKey() {
    const qty = parseInt(document.getElementById('offline-act-qty').value, 10);
    if (isNaN(qty) || qty <= 0) {
        alert('Silakan masukkan jumlah token yang valid.');
        return;
    }
    try {
        const res = await fetch('/api/boss/generate-activation-key', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ quantity: qty })
        });
        const data = await res.json();
        if (data.success) {
            document.getElementById('offline-act-key-field').value = data.activationKey;
            document.getElementById('offline-act-result').classList.remove('hidden');
        } else {
            alert(data.message || 'Gagal menghasilkan kunci. Pastikan LICENSE_PRIVATE_KEY sudah dikonfigurasi di server online.');
        }
    } catch (err) {
        console.error(err);
        alert('Gagal menghasilkan kunci aktivasi offline.');
    }
}

function copyOfflineActivationKey() {
    const field = document.getElementById('offline-act-key-field');
    field.select();
    field.setSelectionRange(0, 99999);
    try {
        navigator.clipboard.writeText(field.value);
        alert('Kode aktivasi offline berhasil disalin ke clipboard!');
    } catch (err) {
        alert('Gagal menyalin otomatis, silakan salin teks secara manual.');
    }
}

async function editTeacherTokenBalance(teacherId, teacherName, currentBalance) {
    const val = prompt(`Edit Saldo Token Ujian untuk Guru: ${teacherName}`, currentBalance);
    if (val === null) return;
    const newBal = parseInt(val, 10);
    if (isNaN(newBal) || newBal < 0) {
        alert('Jumlah token tidak valid.');
        return;
    }
    try {
        const res = await fetch(`/api/teachers/${teacherId}/tokens`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cbtTokenBalance: newBal })
        });
        const data = await res.json();
        if (data.success) {
            if (window.showToast) window.showToast(data.message, 'success');
            else alert(data.message);
            if (window.loadDataFromServer) await window.loadDataFromServer();
            const tch = (appState.teachers || []).find(t => String(t.id) === String(teacherId));
            if (tch && tch.madrasahId) {
                openManageMadrasahModal(tch.madrasahId);
            }
        } else {
            alert(data.message || 'Gagal mengubah token guru.');
        }
    } catch (e) {
        console.error(e);
        alert('Terjadi kesalahan jaringan.');
    }
}

window.renderBossDashboard = renderBossDashboard;
window.switchBossTab = switchBossTab;
window.filterMadrasahTable = filterMadrasahTable;
window.renderBossPaymentTab = renderBossPaymentTab;
window.renderBossRegistrationTab = renderBossRegistrationTab;
window.toggleBossRegistrationInviteField = toggleBossRegistrationInviteField;
window.saveMadrasahRegistrationPolicy = saveMadrasahRegistrationPolicy;
window.addPaymentAccountRow = addPaymentAccountRow;
window.submitPaymentSettings = submitPaymentSettings;
window.deleteMadrasah = deleteMadrasah;
window.toggleMadrasahStatus = toggleMadrasahStatus;
window.openManageMadrasahModal = openManageMadrasahModal;
window.closeManageMadrasahModal = closeManageMadrasahModal;
window.generateOfflineActivationKey = generateOfflineActivationKey;
window.copyOfflineActivationKey = copyOfflineActivationKey;
window.editTeacherTokenBalance = editTeacherTokenBalance;
