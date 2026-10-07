var appState = window.appState || {};

function sortStudentsByNis(studentsList) {
    if (!Array.isArray(studentsList)) return [];
    return [...studentsList].sort((a, b) => {
        const nameA = String(a.name || '').trim().toLowerCase();
        const nameB = String(b.name || '').trim().toLowerCase();
        if (nameA !== nameB) {
            return nameA.localeCompare(nameB, 'id', { sensitivity: 'base' });
        }
        const nisA = String(a.nis || a.no_urut || a.id || '').trim();
        const nisB = String(b.nis || b.no_urut || b.id || '').trim();
        return nisA.localeCompare(nisB, undefined, { numeric: true, sensitivity: 'base' });
    });
}
window.sortStudentsByNis = sortStudentsByNis;

// Helper to compress base64 images so they don't bloat localStorage or cause 413 payload too large
window.compressBase64Image = async (dataUrl, maxWidth = 800, maxHeight = 800, quality = 0.85) => {
    if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image')) return dataUrl;
    if (dataUrl.length < 30000) return dataUrl; // already small enough
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let w = img.width;
            let h = img.height;
            if (w > maxWidth || h > maxHeight) {
                if (w > h) {
                    h = Math.round((h * maxWidth) / w);
                    w = maxWidth;
                } else {
                    w = Math.round((w * maxHeight) / h);
                    h = maxHeight;
                }
            }
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, w, h);
            try {
                const compressed = canvas.toDataURL('image/jpeg', quality);
                resolve(compressed);
            } catch (e) {
                resolve(dataUrl);
            }
        };
        img.onerror = () => resolve(dataUrl);
        img.src = dataUrl;
    });
};

// Google Drive is connected only from Settings.
// Learning/Materi consumes this tenant-scoped connection but never starts OAuth itself.
async function refreshGoogleDriveSettingsStatus() {
    const statusBadge = document.getElementById('google-drive-settings-status');
    const detail = document.getElementById('google-drive-settings-detail');
    const button = document.getElementById('google-drive-connect-button');
    if (!statusBadge || !detail || !button) return;

    const offlineMode = window.isOfflineMode === true || appState?.isOfflineMode === true;
    if (offlineMode) {
        statusBadge.className = 'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600';
        statusBadge.innerHTML = '<i class="fa-solid fa-hard-drive"></i>Mode Offline';
        detail.textContent = 'PDF disimpan di komputer lokal. Google Drive tidak diperlukan pada mode offline.';
        button.classList.add('hidden');
        return;
    }

    button.classList.remove('hidden');
    statusBadge.className = 'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-500';
    statusBadge.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>Memeriksa';
    detail.textContent = 'Memeriksa koneksi Google Drive untuk madrasah ini...';
    button.disabled = true;

    try {
        const response = await fetch('/api/google-drive/status', {
            method: 'GET',
            headers: { 'Accept': 'application/json' }
        });
        const data = await response.json().catch(() => null);
        if (!response.ok || !data?.success) {
            throw new Error(data?.message || 'Status Google Drive tidak dapat diperiksa.');
        }

        if (data.connected) {
            statusBadge.className = 'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-700';
            statusBadge.innerHTML = '<i class="fa-solid fa-circle-check"></i>Terhubung';
            const folderName = String(data.folderName || 'Madrasah Bisa').trim();
            detail.textContent = 'PDF Materi Pembelajaran akan disimpan ke Google Drive madrasah ini' + (folderName ? ' (folder: ' + folderName + ').' : '.');
            button.innerHTML = '<i class="fa-brands fa-google-drive mr-1"></i>Hubungkan Ulang';
        } else {
            statusBadge.className = 'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-700';
            statusBadge.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i>Belum Terhubung';
            detail.textContent = data.oauthConfigured === false
                ? 'Konfigurasi OAuth Google Drive di server belum lengkap.'
                : 'Hubungkan Google Drive sekali. Setelah itu guru dapat mengunggah PDF Materi tanpa proses OAuth lagi.';
            button.innerHTML = '<i class="fa-brands fa-google-drive mr-1"></i>Hubungkan Google Drive';
        }

        button.disabled = !data.canConnectGoogleDrive;
        if (!data.canConnectGoogleDrive) {
            button.title = 'Hanya administrator madrasah yang dapat menghubungkan Google Drive.';
        } else {
            button.removeAttribute('title');
        }
    } catch (error) {
        console.error('[Google Drive] Status check failed:', error);
        statusBadge.className = 'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-100 text-rose-700';
        statusBadge.innerHTML = '<i class="fa-solid fa-circle-xmark"></i>Status Gagal';
        detail.textContent = error?.message || 'Status Google Drive tidak dapat diperiksa.';
        button.disabled = false;
    }
}
window.refreshGoogleDriveSettingsStatus = refreshGoogleDriveSettingsStatus;

async function connectGoogleDriveOAuth(button) {
    const btn = button || null;
    const originalHtml = btn ? btn.innerHTML : '';
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1"></i>Membuka Google...';
    }
    try {
        const response = await fetch('/api/google-drive/oauth/start', {
            method: 'GET',
            headers: { 'Accept': 'application/json' }
        });
        const data = await response.json().catch(() => null);
        if (!response.ok || !data?.success || !data?.authorizationUrl) {
            throw new Error(data?.message || 'Gagal memulai koneksi Google Drive.');
        }
        window.location.href = data.authorizationUrl;
    } catch (error) {
        console.error('[Google Drive OAuth] Start failed:', error);
        if (typeof showToast === 'function') showToast(error?.message || 'Gagal menghubungkan Google Drive.', 'error');
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = originalHtml;
        }
    }
}
window.connectGoogleDriveOAuth = connectGoogleDriveOAuth;

// Settings, Geofencing, Class Leader, Assessment & Data Sync Module

function renderSettingModule(container) {
    appState.tempLogo = appState.settings.schoolLogo || 'fa-moon';
    container.innerHTML = `
        <div class="space-y-6 max-w-4xl pb-8 mx-auto">
            <div class="bg-white p-6 sm:p-8 rounded-3xl shadow-sm border border-slate-100 space-y-6">
                <div>
                    <h1 class="text-xl sm:text-2xl font-bold text-slate-800">Pengaturan Sistem & Konfigurasi</h1>
                    <p class="text-xs text-slate-400 mt-0.5">Kelola nama sekolah, logo, geotagging, dan akun pengguna</p>
                </div>


                <!-- Google Drive OAuth: canonical connection surface for online PDF storage -->
                <div class="border-t border-slate-100 pt-6">
                    <div id="google-drive-settings-card" class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl border border-blue-100 bg-blue-50/60">
                        <div class="flex items-start gap-3 min-w-0">
                            <div class="w-10 h-10 rounded-xl bg-white border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                                <i class="fa-brands fa-google-drive text-lg"></i>
                            </div>
                            <div class="min-w-0">
                                <div class="flex flex-wrap items-center gap-2">
                                    <h2 class="text-base font-bold text-slate-800">Google Drive Materi Pembelajaran</h2>
                                    <span id="google-drive-settings-status" class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-500">
                                        <i class="fa-solid fa-spinner fa-spin"></i>Memeriksa
                                    </span>
                                </div>
                                <p id="google-drive-settings-detail" class="text-xs text-slate-500 mt-1 leading-relaxed">
                                    Memeriksa koneksi Google Drive untuk madrasah ini...
                                </p>
                            </div>
                        </div>
                        <button id="google-drive-connect-button" type="button" onclick="connectGoogleDriveOAuth(this)"
                            class="shrink-0 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold shadow-sm transition">
                            <i class="fa-brands fa-google-drive mr-1"></i>Hubungkan Google Drive
                        </button>
                    </div>
                </div>
                <div class="border-t border-slate-100 pt-6">
                    <h2 class="text-base font-bold text-slate-800 mb-2">Lokasi Geotagging Sekolah</h2>
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div><label class="block text-xs uppercase text-slate-500 mb-1">Latitude</label><input type="number" step="any" id="school-latitude" class="w-full px-4 py-2.5 bg-slate-50 border rounded-2xl text-xs font-mono" placeholder="-6.2000"></div>
                        <div><label class="block text-xs uppercase text-slate-500 mb-1">Longitude</label><input type="number" step="any" id="school-longitude" class="w-full px-4 py-2.5 bg-slate-50 border rounded-2xl text-xs font-mono" placeholder="106.8166"></div>
                        <div><label class="block text-xs uppercase text-slate-500 mb-1">Radius (Meter)</label><input type="number" id="geofence-radius" class="w-full px-4 py-2.5 bg-slate-50 border rounded-2xl text-xs" placeholder="100"></div>
                    </div>
                    <div class="flex gap-2 mt-4">
                        <button type="button" onclick="useCurrentSchoolLocation()" class="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs font-semibold"><i class="fa-solid fa-location-crosshairs mr-1"></i>Gunakan Lokasi Saya</button>
                        <button type="button" onclick="saveSchoolLocationSettings()" class="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-semibold"><i class="fa-solid fa-floppy-disk mr-1"></i>Simpan Lokasi</button>
                    </div>
                </div>

                <div class="border-t border-slate-100 pt-6">
                    <h2 class="text-base font-bold text-slate-800 mb-1">Logo Madrasah</h2>
                    <p class="text-xs text-slate-400 mb-4">Pilih ikon dari preset, gunakan URL gambar, atau unggah logo kustom untuk dipasang di sidebar</p>

                    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <!-- Preview Logo -->
                        <div class="flex flex-col items-center justify-center p-6 bg-slate-50 rounded-3xl border border-slate-200">
                            <span class="text-xs font-semibold uppercase text-slate-400 mb-3">Preview Logo</span>
                            <div id="settings-logo-preview-container" class="w-16 h-16 bg-emerald-600 text-white rounded-2xl flex items-center justify-center text-3xl font-bold shadow-lg overflow-hidden">
                                <!-- Loaded dynamically -->
                            </div>
                            <span id="settings-logo-type-label" class="text-[11px] text-slate-500 mt-3 font-semibold">Tipe: Ikon</span>
                        </div>

                        <!-- Pilihan Ikon Preset -->
                        <div class="space-y-2 md:col-span-2">
                            <label class="block text-xs font-bold uppercase text-slate-500 mb-1">Pilih Ikon Preset</label>
                            <div class="grid grid-cols-3 sm:grid-cols-6 gap-2">
                                <button type="button" onclick="selectPresetLogoIcon('fa-moon')" class="preset-logo-btn p-3 bg-white border rounded-2xl hover:bg-slate-50 transition flex flex-col items-center gap-1">
                                    <i class="fa-solid fa-moon text-lg text-emerald-600"></i>
                                    <span class="text-[10px] text-slate-500">Bulan</span>
                                </button>
                                <button type="button" onclick="selectPresetLogoIcon('fa-mosque')" class="preset-logo-btn p-3 bg-white border rounded-2xl hover:bg-slate-50 transition flex flex-col items-center gap-1">
                                    <i class="fa-solid fa-mosque text-lg text-emerald-600"></i>
                                    <span class="text-[10px] text-slate-500">Masjid</span>
                                </button>
                                <button type="button" onclick="selectPresetLogoIcon('fa-book-open')" class="preset-logo-btn p-3 bg-white border rounded-2xl hover:bg-slate-50 transition flex flex-col items-center gap-1">
                                    <i class="fa-solid fa-book-open text-lg text-emerald-600"></i>
                                    <span class="text-[10px] text-slate-500">Buku</span>
                                </button>
                                <button type="button" onclick="selectPresetLogoIcon('fa-graduation-cap')" class="preset-logo-btn p-3 bg-white border rounded-2xl hover:bg-slate-50 transition flex flex-col items-center gap-1">
                                    <i class="fa-solid fa-graduation-cap text-lg text-emerald-600"></i>
                                    <span class="text-[10px] text-slate-500">Toga</span>
                                </button>
                                <button type="button" onclick="selectPresetLogoIcon('fa-star')" class="preset-logo-btn p-3 bg-white border rounded-2xl hover:bg-slate-50 transition flex flex-col items-center gap-1">
                                    <i class="fa-solid fa-star text-lg text-emerald-600"></i>
                                    <span class="text-[10px] text-slate-500">Bintang</span>
                                </button>
                                <button type="button" onclick="selectPresetLogoIcon('fa-landmark')" class="preset-logo-btn p-3 bg-white border rounded-2xl hover:bg-slate-50 transition flex flex-col items-center gap-1">
                                    <i class="fa-solid fa-landmark text-lg text-emerald-600"></i>
                                    <span class="text-[10px] text-slate-500">Kubah</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                        <!-- URL Input -->
                        <div>
                            <label class="block text-xs font-semibold uppercase text-slate-500 mb-1">Atau Gunakan URL Gambar</label>
                            <div class="flex gap-2">
                                <input type="url" id="settings-logo-url" class="flex-1 px-4 py-2.5 bg-slate-50 border rounded-2xl text-xs" placeholder="https://example.com/logo.png" oninput="handleLogoURLInput(this.value)">
                                <button type="button" onclick="clearCustomLogo()" class="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl text-xs font-semibold transition">Reset</button>
                            </div>
                        </div>

                        <!-- File Upload -->
                        <div>
                            <label class="block text-xs font-semibold uppercase text-slate-500 mb-1">Atau Unggah File Gambar (PNG/JPG)</label>
                            <div class="relative flex items-center justify-center border border-dashed border-slate-200 rounded-2xl p-2 hover:border-emerald-500 transition cursor-pointer" id="logo-dropzone" onclick="document.getElementById('logo-file-input')?.click()">
                                <input type="file" id="logo-file-input" accept="image/*" class="hidden" onchange="handleLogoFileUpload(event)">
                                <div class="text-center py-1">
                                    <i class="fa-solid fa-cloud-arrow-up text-slate-400 text-sm mb-0.5 animate-bounce"></i>
                                    <p class="text-[10px] text-slate-500 font-semibold">Klik untuk pilih gambar</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Logo Shape and Background controls -->
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 border-t border-slate-100 pt-4">
                        <div>
                            <label class="block text-xs font-bold uppercase text-slate-500 mb-2">Bentuk Sudut Logo</label>
                            <select id="settings-logo-shape" onchange="updateSettingsLogoPreview()" class="w-full px-4 py-2.5 bg-slate-50 border rounded-2xl text-xs font-semibold text-slate-700">
                                <option value="rounded-xl" ${(appState.settings.schoolLogoShape || 'rounded-xl') === 'rounded-xl' ? 'selected' : ''}>Lengkung Sedang (Rounded XL - Default)</option>
                                <option value="rounded-2xl" ${(appState.settings.schoolLogoShape || 'rounded-xl') === 'rounded-2xl' ? 'selected' : ''}>Lengkung Halus (Rounded 2XL)</option>
                                <option value="rounded-3xl" ${(appState.settings.schoolLogoShape || 'rounded-xl') === 'rounded-3xl' ? 'selected' : ''}>Bulat Sempurna (Rounded 3XL)</option>
                                <option value="rounded-full" ${(appState.settings.schoolLogoShape || 'rounded-xl') === 'rounded-full' ? 'selected' : ''}>Lingkaran Penuh (Circle)</option>
                                <option value="shape-pentagon" ${(appState.settings.schoolLogoShape || 'rounded-xl') === 'shape-pentagon' ? 'selected' : ''}>Segi 5 (Pentagon / Segilima)</option>
                                <option value="shape-star" ${(appState.settings.schoolLogoShape || 'rounded-xl') === 'shape-star' ? 'selected' : ''}>Bintang 5 Sudut (Star Badge)</option>
                                <option value="shape-hexagon" ${(appState.settings.schoolLogoShape || 'rounded-xl') === 'shape-hexagon' ? 'selected' : ''}>Segi 6 (Hexagon / Segienam)</option>
                                <option value="shape-octagon" ${(appState.settings.schoolLogoShape || 'rounded-xl') === 'shape-octagon' ? 'selected' : ''}>Segi 8 Islam (Rub el Hizb / Octagon)</option>
                                <option value="shape-shield" ${(appState.settings.schoolLogoShape || 'rounded-xl') === 'shape-shield' ? 'selected' : ''}>Perisai Lambang (Shield / Lencana)</option>
                                <option value="shape-dome" ${(appState.settings.schoolLogoShape || 'rounded-xl') === 'shape-dome' ? 'selected' : ''}>Kubah Masjid (Dome / Arch)</option>
                                <option value="rounded-tl-[24px] rounded-br-[24px]" ${(appState.settings.schoolLogoShape || 'rounded-xl') === 'rounded-tl-[24px] rounded-br-[24px]' ? 'selected' : ''}>Bentuk Daun Simetris (Leaf Shape)</option>
                                <option value="rounded-tr-[24px] rounded-bl-[24px]" ${(appState.settings.schoolLogoShape || 'rounded-xl') === 'rounded-tr-[24px] rounded-bl-[24px]' ? 'selected' : ''}>Bentuk Ketupat Sudut (Rhombus Variant)</option>
                                <option value="rounded-none" ${(appState.settings.schoolLogoShape || 'rounded-xl') === 'rounded-none' ? 'selected' : ''}>Kotak Tajam (Square)</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-xs font-bold uppercase text-slate-500 mb-2">Warna Latar Logo</label>
                            <div class="flex items-center space-x-3 bg-slate-50 p-2 border rounded-2xl">
                                <input type="color" id="settings-logo-bg" value="${appState.settings.schoolLogoBg || '#059669'}" oninput="updateSettingsLogoPreview()" class="w-10 h-8 p-0 border border-slate-200 rounded-xl cursor-pointer bg-transparent">
                                <span id="settings-logo-bg-hex" class="text-xs font-mono font-bold text-slate-600">${appState.settings.schoolLogoBg || '#059669'}</span>
                                <div class="flex gap-1.5 flex-wrap">
                                    <button type="button" onclick="setQuickLogoColor('#059669', 'bg')" class="w-5 h-5 rounded-full bg-[#059669] border border-white shadow-xs hover:scale-110 transition cursor-pointer" title="Emerald"></button>
                                    <button type="button" onclick="setQuickLogoColor('#ffffff', 'bg')" class="w-5 h-5 rounded-full bg-[#ffffff] border border-slate-200 shadow-xs hover:scale-110 transition cursor-pointer" title="White"></button>
                                </div>
                            </div>
                        </div>
                        <div>
                            <label class="block text-xs font-bold uppercase text-slate-500 mb-2">Warna Ikon/Teks Logo</label>
                            <div class="flex items-center space-x-3 bg-slate-50 p-2 border rounded-2xl">
                                <input type="color" id="settings-logo-color" value="${appState.settings.schoolLogoColor || '#ffffff'}" oninput="updateSettingsLogoPreview()" class="w-10 h-8 p-0 border border-slate-200 rounded-xl cursor-pointer bg-transparent">
                                <span id="settings-logo-color-hex" class="text-xs font-mono font-bold text-slate-600">${appState.settings.schoolLogoColor || '#ffffff'}</span>
                                <div class="flex gap-1.5 flex-wrap">
                                    <button type="button" onclick="setQuickLogoColor('#ffffff', 'color')" class="w-5 h-5 rounded-full bg-[#ffffff] border border-slate-200 shadow-xs hover:scale-110 transition cursor-pointer" title="White"></button>
                                    <button type="button" onclick="setQuickLogoColor('#059669', 'color')" class="w-5 h-5 rounded-full bg-[#059669] border border-white shadow-xs hover:scale-110 transition cursor-pointer" title="Emerald"></button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <form onsubmit="saveSettings(event)" class="space-y-6 border-t pt-6 text-xs sm:text-sm">
                    <!-- Tema Tampilan & Gaya Desain -->
                    <div class="space-y-4">
                        <div>
                            <h2 class="text-base font-bold text-slate-800">Tema Tampilan & Gaya Desain</h2>
                            <p class="text-xs text-slate-400 mt-0.5">Pilih tema warna preset premium atau rancang kustomisasi tampilan Anda sendiri secara instan</p>
                        </div>

                        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                            <!-- Emerald Klasik -->
                            <button type="button" id="theme-btn-emerald" onclick="selectSystemTheme('emerald')" class="theme-card-btn p-3 rounded-2xl border text-left transition relative flex flex-col justify-between h-24 bg-white hover:bg-slate-50 border-slate-200">
                                <div class="flex justify-between items-center w-full">
                                    <span class="text-xs font-bold text-slate-700">Emerald</span>
                                    <div class="w-3 h-3 rounded-full bg-emerald-600"></div>
                                </div>
                                <div class="flex gap-1">
                                    <div class="w-4 h-4 rounded-md bg-emerald-600"></div>
                                    <div class="w-4 h-4 rounded-md bg-emerald-100"></div>
                                    <div class="w-8 h-4 rounded-md bg-slate-100"></div>
                                </div>
                            </button>

                            <!-- Blue Ocean -->
                            <button type="button" id="theme-btn-blue" onclick="selectSystemTheme('blue')" class="theme-card-btn p-3 rounded-2xl border text-left transition relative flex flex-col justify-between h-24 bg-white hover:bg-slate-50 border-slate-200">
                                <div class="flex justify-between items-center w-full">
                                    <span class="text-xs font-bold text-slate-700">Blue Ocean</span>
                                    <div class="w-3 h-3 rounded-full bg-blue-600"></div>
                                </div>
                                <div class="flex gap-1">
                                    <div class="w-4 h-4 rounded-md bg-blue-600"></div>
                                    <div class="w-4 h-4 rounded-md bg-blue-100"></div>
                                    <div class="w-8 h-4 rounded-md bg-slate-100"></div>
                                </div>
                            </button>

                            <!-- Purple Royal -->
                            <button type="button" id="theme-btn-purple" onclick="selectSystemTheme('purple')" class="theme-card-btn p-3 rounded-2xl border text-left transition relative flex flex-col justify-between h-24 bg-white hover:bg-slate-50 border-slate-200">
                                <div class="flex justify-between items-center w-full">
                                    <span class="text-xs font-bold text-slate-700">Royal Purple</span>
                                    <div class="w-3 h-3 rounded-full bg-violet-600"></div>
                                </div>
                                <div class="flex gap-1">
                                    <div class="w-4 h-4 rounded-md bg-violet-600"></div>
                                    <div class="w-4 h-4 rounded-md bg-violet-100"></div>
                                    <div class="w-8 h-4 rounded-md bg-slate-100"></div>
                                </div>
                            </button>

                            <!-- Sunset Rose -->
                            <button type="button" id="theme-btn-rose" onclick="selectSystemTheme('rose')" class="theme-card-btn p-3 rounded-2xl border text-left transition relative flex flex-col justify-between h-24 bg-white hover:bg-slate-50 border-slate-200">
                                <div class="flex justify-between items-center w-full">
                                    <span class="text-xs font-bold text-slate-700">Sunset Rose</span>
                                    <div class="w-3 h-3 rounded-full bg-rose-600"></div>
                                </div>
                                <div class="flex gap-1">
                                    <div class="w-4 h-4 rounded-md bg-rose-600"></div>
                                    <div class="w-4 h-4 rounded-md bg-rose-100"></div>
                                    <div class="w-8 h-4 rounded-md bg-slate-100"></div>
                                </div>
                            </button>

                            <!-- Midnight Retro -->
                            <button type="button" id="theme-btn-midnight" onclick="selectSystemTheme('midnight')" class="theme-card-btn p-3 rounded-2xl border text-left transition relative flex flex-col justify-between h-24 bg-white hover:bg-slate-50 border-slate-200">
                                <div class="flex justify-between items-center w-full">
                                    <span class="text-xs font-bold text-slate-700">Midnight</span>
                                    <div class="w-3 h-3 rounded-full bg-slate-800"></div>
                                </div>
                                <div class="flex gap-1">
                                    <div class="w-4 h-4 rounded-md bg-slate-800"></div>
                                    <div class="w-4 h-4 rounded-md bg-slate-200"></div>
                                    <div class="w-8 h-4 rounded-md bg-slate-100"></div>
                                </div>
                            </button>

                            <!-- Custom Builder Button -->
                            <button type="button" id="theme-btn-custom" onclick="selectSystemTheme('custom')" class="theme-card-btn p-3 rounded-2xl border text-left transition relative flex flex-col justify-between h-24 bg-white hover:bg-slate-50 border-slate-200">
                                <div class="flex justify-between items-center w-full">
                                    <span class="text-xs font-bold text-slate-700">Tema Kustom</span>
                                    <div class="w-3 h-3 rounded-full bg-gradient-to-tr from-emerald-500 via-blue-500 to-rose-500"></div>
                                </div>
                                <div class="text-[10px] text-slate-400 font-semibold leading-tight">Rancang warna, sudut, & gaya sendiri</div>
                            </button>
                        </div>

                        <!-- Custom Theme panel -->
                        <div id="custom-theme-builder" class="hidden p-5 bg-slate-50 border border-slate-200 rounded-3xl space-y-4">
                            <div class="border-b border-slate-200/60 pb-2">
                                <h3 class="text-xs font-bold uppercase text-slate-500 tracking-wider">Kustomisasi Tema Tampilan</h3>
                            </div>
                            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <!-- Warna Utama -->
                                <div class="space-y-2">
                                    <label class="block text-xs font-bold text-slate-600 uppercase tracking-wider">Warna Utama</label>
                                    <div class="flex items-center space-x-3">
                                        <input type="color" id="theme-custom-color" value="#059669" oninput="handleCustomColorChange(this.value)" class="w-12 h-10 p-0 border border-slate-300 rounded-xl cursor-pointer">
                                        <span id="theme-custom-color-hex" class="text-xs font-mono font-bold text-slate-600">#059669</span>
                                    </div>
                                    <!-- Quick color dots -->
                                    <div class="flex flex-wrap gap-1.5 mt-2">
                                        <button type="button" onclick="setQuickCustomColor('#0d9488')" class="w-5 h-5 rounded-full bg-teal-600 border border-white shadow-sm" title="Teal"></button>
                                        <button type="button" onclick="setQuickCustomColor('#2563eb')" class="w-5 h-5 rounded-full bg-blue-600 border border-white shadow-sm" title="Blue"></button>
                                        <button type="button" onclick="setQuickCustomColor('#4f46e5')" class="w-5 h-5 rounded-full bg-indigo-600 border border-white shadow-sm" title="Indigo"></button>
                                        <button type="button" onclick="setQuickCustomColor('#7c3aed')" class="w-5 h-5 rounded-full bg-violet-600 border border-white shadow-sm" title="Violet"></button>
                                        <button type="button" onclick="setQuickCustomColor('#db2777')" class="w-5 h-5 rounded-full bg-pink-600 border border-white shadow-sm" title="Pink"></button>
                                        <button type="button" onclick="setQuickCustomColor('#ea580c')" class="w-5 h-5 rounded-full bg-orange-600 border border-white shadow-sm" title="Orange"></button>
                                        <button type="button" onclick="setQuickCustomColor('#eab308')" class="w-5 h-5 rounded-full bg-yellow-500 border border-white shadow-sm" title="Yellow"></button>
                                        <button type="button" onclick="setQuickCustomColor('#0f172a')" class="w-5 h-5 rounded-full bg-slate-900 border border-white shadow-sm" title="Slate"></button>
                                    </div>
                                </div>

                                <!-- Bentuk Sudut (Border Radius) -->
                                <div class="space-y-2">
                                    <label class="block text-xs font-bold text-slate-600 uppercase tracking-wider">Bentuk Sudut & Tombol</label>
                                    <select id="theme-custom-radius" onchange="handleCustomRadiusChange(this.value)" class="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-2xl text-xs font-semibold text-slate-700">
                                        <option value="sharp">Sangat Tajam (Sharp - 0px)</option>
                                        <option value="small">Sedikit Bulat (Small - 6px)</option>
                                        <option value="medium">Sedang (Medium - 12px)</option>
                                        <option value="large">Sangat Bulat (Large - 16px - Default)</option>
                                        <option value="pill">Kapsul (Pill - 9999px)</option>
                                    </select>
                                    <p class="text-[10px] text-slate-400">Menyesuaikan semua tombol, kartu, input, dan panel menu.</p>
                                </div>

                                <!-- Gaya Desain (Layout Style) -->
                                <div class="space-y-2">
                                    <label class="block text-xs font-bold text-slate-600 uppercase tracking-wider">Efek Gaya Tampilan</label>
                                    <select id="theme-custom-style" onchange="handleCustomStyleChange(this.value)" class="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-2xl text-xs font-semibold text-slate-700">
                                        <option value="flat">Flat Bersih & Elegan (Clean Flat)</option>
                                        <option value="glow">Soft Glow (Efek Bercahaya Lembut)</option>
                                        <option value="border">Retro Neubrutalism (Garis Tebal Klasik)</option>
                                    </select>
                                    <p class="text-[10px] text-slate-400">Menambahkan karakteristik visual seperti bayangan lembut atau garis luar tebal.</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="border-t border-slate-100 pt-6 space-y-4">
                        <h3 class="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                            <i class="fa-solid fa-shield-halved text-emerald-600"></i>
                            <span>Pengaturan Wajib Keamanan Absensi (GPS & Foto Selfie)</span>
                        </h3>
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div class="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                                <div>
                                    <span class="block text-xs font-bold text-slate-800">Wajib GPS / Geofencing</span>
                                    <span class="text-[11px] text-slate-500">Jika wajib, lokasi diluar radius gagal absen. Jika tidak, tetap bisa absen.</span>
                                </div>
                                <label class="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" id="set-require-gps" ${(appState.settings.requireGps !== false) ? 'checked' : ''} class="sr-only peer">
                                    <div class="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                                </label>
                            </div>
                            <div class="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                                <div>
                                    <span class="block text-xs font-bold text-slate-800">Wajib Foto Selfie</span>
                                    <span class="text-[11px] text-slate-500">Jika wajib, siswa harus mengambil selfie. Jika tidak, foto opsional.</span>
                                </div>
                                <label class="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" id="set-require-selfie" ${(appState.settings.requireSelfie !== false) ? 'checked' : ''} class="sr-only peer">
                                    <div class="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                                </label>
                            </div>
                            <div class="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                                <div>
                                    <span class="block text-xs font-bold text-slate-800">Pilih Tanggal Absensi Guru</span>
                                    <span class="text-[11px] text-slate-500">Jika aktif, guru bebas memilih tanggal absen manual dari akunnya.</span>
                                </div>
                                <label class="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" id="set-teacher-allow-date-picker" ${(appState.settings.teacherAllowDatePicker === true || appState.settings.teacherAllowDatePicker === 'true') ? 'checked' : ''} class="sr-only peer">
                                    <div class="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                                </label>
                            </div>
                        </div>
                    </div>

                    <div class="border-t border-slate-100 pt-6 space-y-2">
                        <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider">Teks Berjalan (Running Text Dashboard)</label>
                        <p class="text-[11px] text-slate-400">Pesan ini akan berjalan otomatis di bagian atas dashboard utama.</p>
                        <input type="text" id="set-running-text" value="${appState.settings.runningText || 'Selamat Datang di Portal Sistem Informasi Madrasah Terintegrasi! Tetap Semangat Berprestasi.'}" class="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-semibold" placeholder="Ketik teks berjalan di sini...">
                    </div>

                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t pt-4">
                        <div><label class="block text-xs font-semibold uppercase text-slate-500 mb-1">Nama Madrasah</label><input type="text" id="set-school" value="${appState.settings.schoolName || 'Madrasah Aliyah'}" required class="w-full px-4 py-3 bg-slate-50 border rounded-2xl"></div>
                        <div><label class="block text-xs font-semibold uppercase text-slate-500 mb-1">Administrator</label><input type="text" id="set-admin-name" value="${appState.settings.adminName || 'Administrator'}" required class="w-full px-4 py-3 bg-slate-50 border rounded-2xl"></div>
                    </div>

                    <div class="border-t border-slate-100 pt-6 space-y-4">
                        <div class="flex items-center justify-between p-4 bg-blue-50/50 rounded-2xl border border-blue-100">
                            <div>
                                <h4 class="font-bold text-slate-700 text-sm">Fitur Chat Admin - Siswa</h4>
                                <p class="text-[11px] text-slate-500 mt-1">Aktifkan fitur chat untuk menghubungkan Admin dan Siswa secara langsung.</p>
                            </div>
                            <label class="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" id="set-chat-enabled" ${(appState.settings.chatEnabled === true) ? 'checked' : ''} class="sr-only peer">
                                <div class="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                            </label>
                        </div>
                    </div>

                    <div class="border-t border-slate-100 pt-6 space-y-4">
                        <h3 class="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                            <i class="fa-solid fa-toggle-on text-emerald-600"></i>
                            <span>Tampilan Menu Siswa</span>
                        </h3>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            ${[
                                ['set-student-attendance-enabled', 'attendance', 'Absensi Siswa', 'Absen selfie/GPS dan absensi kelas ketua kelas.'],
                                ['set-learning-enabled', 'learning', 'Belajar / Materi', 'Materi pembelajaran yang dipublikasikan guru.'],
                                ['set-student-cbt-enabled', 'cbt', 'CBT dan LKPD', 'Jadwal ujian, asesmen CBT, dan LKPD interaktif.'],
                                ['set-student-games-enabled', 'games', 'Game Edukasi', 'Game pembelajaran untuk siswa.']
                            ].map(([id, key, title, desc]) => {
                                const featureMap = appState.settings.studentFeatures || {};
                                const checked = featureMap[key] === undefined ? true : featureMap[key] !== false;
                                return `
                                    <div class="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-2xl gap-3">
                                        <div>
                                            <span class="block text-xs font-bold text-slate-800">${title}</span>
                                            <span class="text-[11px] text-slate-500">${desc}</span>
                                        </div>
                                        <label class="relative inline-flex items-center cursor-pointer shrink-0">
                                            <input type="checkbox" id="${id}" ${checked ? 'checked' : ''} class="sr-only peer">
                                            <div class="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                                        </label>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>

                    <div class="border-t border-slate-100 pt-6 space-y-4">
                        <div class="flex items-center justify-between p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100 gap-4">
                            <div>
                                <h4 class="font-bold text-slate-700 text-sm">Spotlight Video Live Monitoring Admin</h4>
                                <p class="text-[11px] text-slate-500 mt-1">Jika aktif, admin dapat membuka satu Video Live siswa dari tombol pada kartu monitoring. Grid tetap memakai foto sehingga lebih hemat token dan bandwidth.</p>
                            </div>
                            <label class="relative inline-flex items-center cursor-pointer shrink-0">
                                <input type="checkbox" id="set-admin-livecam-enabled" ${(appState.settings.adminLivecamEnabled !== false) ? 'checked' : ''} class="sr-only peer">
                                <div class="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                            </label>
                        </div>
                    </div>

                    <!-- Konfigurasi LiveKit SFU (WebRTC Server) -->
                    <div class="border-t border-slate-100 pt-6 space-y-4">
                        <h3 class="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                            <i class="fa-solid fa-server text-emerald-600"></i>
                            <span>Konfigurasi LiveKit SFU (WebRTC Server)</span>
                        </h3>
                        <p class="text-[11px] text-slate-500 leading-relaxed">
                            Aktifkan server streaming WebRTC berbasis SFU (LiveKit) untuk monitoring video ujian CBT yang stabil, hemat bandwidth, andal, dan mampu menembus firewall/NAT. Jika tidak dikonfigurasi, sistem otomatis menggunakan WebRTC P2P default + Live Snapshots.
                        </p>
                        <div class="grid grid-cols-1 gap-4">
                            <div>
                                <label class="block text-xs font-semibold text-slate-500 mb-1">LiveKit Server URL (wss://...)</label>
                                <input type="text" id="set-livekit-url" value="${appState.settings.livekitUrl || ''}" class="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-semibold" placeholder="Contoh: wss://my-livekit-project.livekit.cloud">
                            </div>
                            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label class="block text-xs font-semibold text-slate-500 mb-1">LiveKit API Key</label>
                                    <input type="text" id="set-livekit-api-key" value="${appState.settings.livekitApiKey || ''}" class="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-semibold" placeholder="Contoh: APIxxxxxxxxxxxx">
                                </div>
                                <div>
                                    <label class="block text-xs font-semibold text-slate-500 mb-1">LiveKit API Secret</label>
                                    <input type="password" id="set-livekit-api-secret" value="${appState.settings.livekitApiSecret || ''}" class="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-semibold" placeholder="Masukkan API Secret">
                                </div>
                            </div>

                            <div class="mt-2 pt-4 border-t border-slate-100">
                                <h4 class="text-xs font-bold text-slate-700 flex items-center gap-1.5 mb-2">
                                    <i class="fa-solid fa-earth-americas text-emerald-600"></i>
                                    <span>Konfigurasi Custom TURN/STUN Server Fallback (Optional)</span>
                                </h4>
                                <div class="grid grid-cols-1 gap-4">
                                    <div>
                                        <label class="block text-xs font-semibold text-slate-500 mb-1">TURN Server URL (turn:...)</label>
                                        <input type="text" id="set-turn-url" value="${appState.settings.turnUrl || ''}" class="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-semibold" placeholder="Contoh: turn:turn.relay.metered.ca:443?transport=tcp">
                                    </div>
                                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                            <label class="block text-xs font-semibold text-slate-500 mb-1">TURN Username</label>
                                            <input type="text" id="set-turn-username" value="${appState.settings.turnUsername || ''}" class="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-semibold" placeholder="Username untuk TURN server">
                                        </div>
                                        <div>
                                            <label class="block text-xs font-semibold text-slate-500 mb-1">TURN Password / Credential</label>
                                            <input type="password" id="set-turn-credential" value="${appState.settings.turnCredential || ''}" class="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-semibold" placeholder="Password/Credential untuk TURN server">
                                        </div>
                                    </div>
                                    <div class="flex items-center space-x-2.5 pt-1">
                                        <input type="checkbox" id="set-disable-public-stun" ${appState.settings.disablePublicStun ? 'checked' : ''} class="w-4 h-4 text-emerald-600 border-slate-200 rounded focus:ring-emerald-500 cursor-pointer">
                                        <label for="set-disable-public-stun" class="text-xs sm:text-sm font-semibold text-slate-600 cursor-pointer select-none">
                                            Nonaktifkan STUN Server Publik (Sangat disarankan jika ujian 100% offline / lokal tanpa internet)
                                        </label>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="flex justify-end pt-3">
                        <button type="submit" class="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-2xl shadow transition text-xs sm:text-sm">Simpan Pengaturan Utama</button>
                    </div>
                </form>
            </div>

            <!-- Login Page Customization Card -->
            <div class="bg-white p-6 sm:p-8 rounded-3xl shadow-sm border border-slate-100 space-y-6">
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                    <div>
                        <h2 class="text-xl sm:text-2xl font-bold text-slate-800 flex items-center gap-2.5">
                            <i class="fa-solid fa-paintbrush text-emerald-600"></i>
                            <span>Kustomisasi Tampilan Halaman Login</span>
                        </h2>
                        <p class="text-xs text-slate-400 mt-0.5">Atur tata letak logo, posisi, teks, tema latar belakang, serta pengumuman pada halaman depan portal login.</p>
                    </div>
                    <button type="button" onclick="previewLoginPageCustomization()" class="px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold rounded-2xl border border-emerald-200 text-xs transition flex items-center space-x-1.5 shrink-0 cursor-pointer">
                        <i class="fa-solid fa-eye text-xs"></i>
                        <span>Pratinjau Halaman Login</span>
                    </button>
                </div>

                <form onsubmit="saveLoginCustomization(event)" class="space-y-6">
                    <!-- Section 1: Logo & Alignment -->
                    <div class="space-y-3">
                        <h3 class="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                            <i class="fa-solid fa-icons text-emerald-600"></i>
                            <span>1. Logo & Tata Letak Header</span>
                        </h3>
                        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div>
                                <label class="block text-xs font-semibold text-slate-600 mb-1">Posisi Logo Login</label>
                                <select id="login-set-logo-pos" class="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-semibold text-slate-700">
                                    <option value="center" ${(appState.settings.loginConfig?.logoPosition || 'center') === 'center' ? 'selected' : ''}>Tengah (Center)</option>
                                    <option value="left" ${(appState.settings.loginConfig?.logoPosition || 'center') === 'left' ? 'selected' : ''}>Kiri (Left)</option>
                                    <option value="right" ${(appState.settings.loginConfig?.logoPosition || 'center') === 'right' ? 'selected' : ''}>Kanan (Right)</option>
                                    <option value="hidden" ${(appState.settings.loginConfig?.logoPosition || 'center') === 'hidden' ? 'selected' : ''}>Sembunyikan Logo</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-xs font-semibold text-slate-600 mb-1">Ukuran Logo</label>
                                <select id="login-set-logo-size" class="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-semibold text-slate-700">
                                    <option value="small" ${(appState.settings.loginConfig?.logoSize || 'medium') === 'small' ? 'selected' : ''}>Kecil (40px)</option>
                                    <option value="medium" ${(appState.settings.loginConfig?.logoSize || 'medium') === 'medium' ? 'selected' : ''}>Sedang (56px - Standar)</option>
                                    <option value="large" ${(appState.settings.loginConfig?.logoSize || 'medium') === 'large' ? 'selected' : ''}>Besar (80px)</option>
                                    <option value="xlarge" ${(appState.settings.loginConfig?.logoSize || 'medium') === 'xlarge' ? 'selected' : ''}>Sangat Besar (112px)</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-xs font-semibold text-slate-600 mb-1">Bentuk Frame Logo</label>
                                <select id="login-set-logo-shape" class="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-semibold text-slate-700">
                                    <option value="rounded-2xl" ${(appState.settings.loginConfig?.logoShape || 'rounded-2xl') === 'rounded-2xl' ? 'selected' : ''}>Lengkung Halus (Rounded 2XL)</option>
                                    <option value="rounded-xl" ${(appState.settings.loginConfig?.logoShape || 'rounded-2xl') === 'rounded-xl' ? 'selected' : ''}>Lengkung Sedang (Rounded XL)</option>
                                    <option value="rounded-full" ${(appState.settings.loginConfig?.logoShape || 'rounded-2xl') === 'rounded-full' ? 'selected' : ''}>Lingkaran Penuh (Circle)</option>
                                    <option value="shape-pentagon" ${(appState.settings.loginConfig?.logoShape || 'rounded-2xl') === 'shape-pentagon' ? 'selected' : ''}>Segi 5 (Pentagon / Segilima)</option>
                                    <option value="shape-star" ${(appState.settings.loginConfig?.logoShape || 'rounded-2xl') === 'shape-star' ? 'selected' : ''}>Bintang 5 Sudut (Star Badge)</option>
                                    <option value="shape-hexagon" ${(appState.settings.loginConfig?.logoShape || 'rounded-2xl') === 'shape-hexagon' ? 'selected' : ''}>Segi 6 (Hexagon / Segienam)</option>
                                    <option value="shape-octagon" ${(appState.settings.loginConfig?.logoShape || 'rounded-2xl') === 'shape-octagon' ? 'selected' : ''}>Segi 8 Islam (Rub el Hizb / Octagon)</option>
                                    <option value="shape-shield" ${(appState.settings.loginConfig?.logoShape || 'rounded-2xl') === 'shape-shield' ? 'selected' : ''}>Perisai Lambang (Shield / Lencana)</option>
                                    <option value="shape-dome" ${(appState.settings.loginConfig?.logoShape || 'rounded-2xl') === 'shape-dome' ? 'selected' : ''}>Kubah Masjid (Dome / Arch)</option>
                                    <option value="rounded-none" ${(appState.settings.loginConfig?.logoShape || 'rounded-2xl') === 'rounded-none' ? 'selected' : ''}>Kotak Tajam (Square)</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <!-- Section 2: Background & Theme Style -->
                    <div class="space-y-3 border-t border-slate-100 pt-5">
                        <h3 class="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                            <i class="fa-solid fa-palette text-emerald-600"></i>
                            <span>2. Tema Latar Belakang & Gaya Kartu</span>
                        </h3>
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label class="block text-xs font-semibold text-slate-600 mb-1">Gaya Tema Background</label>
                                <select id="login-set-bg-style" onchange="toggleCustomLoginBgColor(this.value)" class="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-semibold text-slate-700">
                                    <option value="default" ${(appState.settings.loginConfig?.bgStyle || 'default') === 'default' ? 'selected' : ''}>Slate Clean + Dot Pattern (Default)</option>
                                    <option value="emerald-gradient" ${(appState.settings.loginConfig?.bgStyle || 'default') === 'emerald-gradient' ? 'selected' : ''}>Emerald Islami Modern (Gradiasi Hijau Gelap)</option>
                                    <option value="dark-luxury" ${(appState.settings.loginConfig?.bgStyle || 'default') === 'dark-luxury' ? 'selected' : ''}>Dark Luxury Elegant (Gelap Premium)</option>
                                    <option value="deep-navy" ${(appState.settings.loginConfig?.bgStyle || 'default') === 'deep-navy' ? 'selected' : ''}>Deep Navy Professional (Biru Navy Malam)</option>
                                    <option value="warm-amber" ${(appState.settings.loginConfig?.bgStyle || 'default') === 'warm-amber' ? 'selected' : ''}>Warm Sunset (Krem & Amber Hangat)</option>
                                    <option value="clean-white" ${(appState.settings.loginConfig?.bgStyle || 'default') === 'clean-white' ? 'selected' : ''}>Minimalist White (Putih Bersih)</option>
                                    <option value="custom" ${(appState.settings.loginConfig?.bgStyle || 'default') === 'custom' ? 'selected' : ''}>Warna Gradiasi Kustom</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-xs font-semibold text-slate-600 mb-1">Gaya Kartu Form Login</label>
                                <select id="login-set-card-style" class="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-semibold text-slate-700">
                                    <option value="shadow-emerald" ${(appState.settings.loginConfig?.cardStyle || 'shadow-emerald') === 'shadow-emerald' ? 'selected' : ''}>Soft Emerald Shadow (Standar)</option>
                                    <option value="glassmorphism" ${(appState.settings.loginConfig?.cardStyle || 'shadow-emerald') === 'glassmorphism' ? 'selected' : ''}>Glassmorphism (Efek Kaca Buram Transparan)</option>
                                    <option value="border-bold" ${(appState.settings.loginConfig?.cardStyle || 'shadow-emerald') === 'border-bold' ? 'selected' : ''}>Neubrutalism (Garis Tebal Hitam)</option>
                                    <option value="flat-clean" ${(appState.settings.loginConfig?.cardStyle || 'shadow-emerald') === 'flat-clean' ? 'selected' : ''}>Flat Minimalis (Bersih & Rapi)</option>
                                </select>
                            </div>
                        </div>

                        <div id="login-custom-bg-container" class="${(appState.settings.loginConfig?.bgStyle || 'default') === 'custom' ? '' : 'hidden'} space-y-1.5 pt-2">
                            <label class="block text-xs font-semibold text-slate-600">Kode CSS Background Kustom (Color/Gradient)</label>
                            <input type="text" id="login-set-custom-bg" value="${(appState.settings.loginConfig?.customBg || 'linear-gradient(135deg, #0f172a 0%, #064e3b 100%)').replace(/"/g, '&quot;')}" class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-mono" placeholder="linear-gradient(135deg, #0f172a, #1e293b)">
                        </div>
                    </div>

                    <!-- Section 3: Custom Text Fields -->
                    <div class="space-y-4 border-t border-slate-100 pt-5">
                        <h3 class="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                            <i class="fa-solid fa-font text-emerald-600"></i>
                            <span>3. Pengaturan Teks Halaman Login</span>
                        </h3>

                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label class="block text-xs font-semibold text-slate-600 mb-1">Judul Utama Login</label>
                                <input type="text" id="login-set-title" value="${(appState.settings.loginConfig?.title !== undefined ? appState.settings.loginConfig.title : 'Selamat Datang Kembali').replace(/"/g, '&quot;')}" class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold" placeholder="Selamat Datang Kembali">
                            </div>
                            <div>
                                <label class="block text-xs font-semibold text-slate-600 mb-1">Sub-judul / Petunjuk Login</label>
                                <input type="text" id="login-set-subtitle" value="${(appState.settings.loginConfig?.subtitle !== undefined ? appState.settings.loginConfig.subtitle : 'Silakan masukkan username dan password Anda untuk masuk ke sistem.').replace(/"/g, '&quot;')}" class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium" placeholder="Silakan masukkan username dan password Anda...">
                            </div>
                        </div>

                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label class="block text-xs font-semibold text-slate-600 mb-1">Teks Tombol Masuk</label>
                                <input type="text" id="login-set-button-text" value="${(appState.settings.loginConfig?.buttonText !== undefined ? appState.settings.loginConfig.buttonText : 'Masuk Portal').replace(/"/g, '&quot;')}" class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold" placeholder="Masuk Portal">
                            </div>
                            <div>
                                <label class="block text-xs font-semibold text-slate-600 mb-1">Teks Hak Cipta / Footer</label>
                                <input type="text" id="login-set-footer-text" value="${(appState.settings.loginConfig?.footerText !== undefined ? appState.settings.loginConfig.footerText : 'zeinsgroup · Portal Administrasi Madrasah').replace(/"/g, '&quot;')}" class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium" placeholder="zeinsgroup · Portal Administrasi Madrasah">
                            </div>
                        </div>

                        <div>
                            <label class="block text-xs font-semibold text-slate-600 mb-1">Pengumuman / Banner Informasi di Halaman Login (Opsional)</label>
                            <input type="text" id="login-set-notice-text" value="${(appState.settings.loginConfig?.noticeText || '').replace(/"/g, '&quot;')}" class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-semibold text-amber-700" placeholder="Contoh: Ujian CBT Semester Genap Telah Dibuka. Harap Cek NIS/NIP Masing-Masing.">
                            <p class="text-[10px] text-slate-400 mt-1">Jika diisi, banner pengumuman berwarna akan ditampilkan di atas formulir login. Kosongkan jika tidak ingin menampilkan banner.</p>
                        </div>
                    </div>

                    <!-- Section 4: Showcase Panel Desktop Settings -->
                    <div class="space-y-4 border-t border-slate-100 pt-5">
                        <div class="flex items-center justify-between">
                            <h3 class="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                                <i class="fa-solid fa-desktop text-emerald-600"></i>
                                <span>4. Panel Informasi Samping (Desktop Showcase)</span>
                            </h3>
                            <label class="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" id="login-set-show-panel" ${(appState.settings.loginConfig?.showLeftPanel !== false) ? 'checked' : ''} class="sr-only peer">
                                <div class="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                                <span class="ml-2 text-xs font-bold text-slate-700">Tampilkan Panel Samping</span>
                            </label>
                        </div>

                        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div>
                                <label class="block text-xs font-semibold text-slate-600 mb-1">Label Badge Panel</label>
                                <input type="text" id="login-set-panel-badge" value="${(appState.settings.loginConfig?.panelBadge !== undefined ? appState.settings.loginConfig.panelBadge : 'Sistem Manajemen Modern').replace(/"/g, '&quot;')}" class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold" placeholder="Sistem Manajemen Modern">
                            </div>
                            <div class="sm:col-span-2">
                                <label class="block text-xs font-semibold text-slate-600 mb-1">Judul Utama Panel Samping</label>
                                <input type="text" id="login-set-panel-title" value="${(appState.settings.loginConfig?.panelTitle !== undefined ? appState.settings.loginConfig.panelTitle : 'Mengelola Administrasi & Ujian CBT Secara Presisi').replace(/"/g, '&quot;')}" class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold" placeholder="Mengelola Administrasi & Ujian CBT...">
                            </div>
                        </div>

                        <div>
                            <label class="block text-xs font-semibold text-slate-600 mb-1">Deskripsi Ringkas Panel Samping</label>
                            <textarea id="login-set-panel-desc" rows="2" class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium">${(appState.settings.loginConfig?.panelDesc !== undefined ? appState.settings.loginConfig.panelDesc : 'Platform khusus madrasah untuk mengotomatisasi daftar hadir berbasis geolokasi, monitoring ujian waktu nyata (CBT), penyusunan modul ajar berbasis AI, serta pengolahan nilai rapor digital dalam satu ekosistem terpadu yang andal.').replace(/</g, '&lt;')}</textarea>
                        </div>
                    </div>

                    <div class="flex justify-end pt-4 border-t border-slate-100">
                        <button type="submit" class="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl shadow-lg shadow-emerald-600/20 transition text-xs sm:text-sm flex items-center space-x-2 cursor-pointer">
                            <i class="fa-solid fa-floppy-disk"></i>
                            <span>Simpan Pengaturan Halaman Login</span>
                        </button>
                    </div>
                </form>
            </div>

            <!-- Account Settings Card -->
            <div class="bg-white p-6 sm:p-8 rounded-3xl shadow-sm border border-slate-100 space-y-6">
                <div>
                    <h2 class="text-xl sm:text-2xl font-bold text-slate-800">Pengaturan Akun & Peran Pengguna</h2>
                    <p class="text-xs text-slate-400 mt-0.5">Cari akun guru atau murid untuk mengubah peran (Guru, Murid, Ketua Kelas)</p>
                </div>

                <div class="space-y-4">
                    <!-- Search bar -->
                    <div class="relative">
                        <i class="fa-solid fa-magnifying-glass absolute left-3.5 top-3.5 text-slate-400 text-xs"></i>
                        <input type="text" id="account-search-input" oninput="searchUserAccounts(this.value)" placeholder="Cari nama, NIS, NIP, atau username..." class="w-full pl-9 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm" autocomplete="off">
                    </div>

                    <!-- Search results list -->
                    <div id="account-results-list" class="space-y-2 max-h-80 overflow-y-auto pr-1">
                        <!-- Populated dynamically -->
                    </div>
                </div>
            </div>

            <!-- Database Connection Test Card -->
            <div class="bg-white p-6 sm:p-8 rounded-3xl shadow-sm border border-slate-100 space-y-4">
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                    <div>
                        <h2 class="text-xl sm:text-2xl font-bold text-slate-800 flex items-center gap-2.5">
                            <i class="fa-solid fa-server text-indigo-600"></i>
                            <span>Status Koneksi & Kapasitas Penyimpanan</span>
                        </h2>
                        <p class="text-xs text-slate-400 mt-0.5">Periksa koneksi, kapasitas Cloud SQL, ukuran database, serta pemakaian kuota Cloudinary.</p>
                    </div>
                    <div class="flex flex-wrap gap-2">
                        <button type="button" onclick="checkDatabaseConnection()" class="px-4 py-2.5 bg-slate-600 hover:bg-slate-700 text-white text-xs font-bold rounded-xl shadow transition flex items-center gap-2 cursor-pointer">
                            <i class="fa-solid fa-circle-info"></i>
                            <span>Cek Status</span>
                        </button>
                        <button type="button" onclick="forceSyncCloudToLocal()" class="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow transition flex items-center gap-2 cursor-pointer" title="Paksa server lokal terhubung ke Cloud SQL dan unduh semua data terbaru ke local_store.json">
                            <i class="fa-solid fa-cloud-arrow-down"></i>
                            <span>Tarik & Sinkronkan Data Cloud</span>
                        </button>
                        <button type="button" onclick="forceSyncCloudinaryPhotos()" class="px-4 py-2.5 bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold rounded-xl shadow transition flex items-center gap-2 cursor-pointer" title="Bangun ulang mapping dari aset yang benar-benar ada di Cloudinary dan buang mapping foto yang sudah basi">
                            <i class="fa-solid fa-images"></i>
                            <span>Sinkronkan Foto Cloudinary</span>
                        </button>
                        <button type="button" id="repair-cloudinary-missing-btn" onclick="repairMissingCloudinaryPhotos()" class="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow transition flex items-center gap-2 cursor-pointer" title="Audit foto profil, riwayat foto, absensi siswa/guru, dan gambar soal; upload sumber lokal yang belum ada di Cloudinary">
                            <i class="fa-solid fa-cloud-arrow-up"></i>
                            <span>Periksa & Upload Foto Hilang</span>
                        </button>
                    </div>
                </div>
                <div id="db-connection-test-result">
                    <div class="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 flex items-center justify-between">
                        <span>Klik tombol <strong>"Cek Status"</strong> di atas untuk memeriksa koneksi dan kapasitas penyimpanan saat ini.</span>
                    </div>
                </div>
            </div>

            <!-- Backup & Restore System Data Card -->
            <div class="bg-white p-6 sm:p-8 rounded-3xl shadow-sm border border-slate-100 space-y-6">
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                    <div>
                        <h2 class="text-xl sm:text-2xl font-bold text-slate-800 flex items-center gap-2.5">
                            <i class="fa-solid fa-database text-emerald-600"></i>
                            <span>Backup & Restore Data Sistem</span>
                        </h2>
                        <p class="text-xs text-slate-400 mt-0.5">Cadangkan seluruh data madrasah (murid, guru, kelas, jadwal, CBT, dll) atau pulihkan dari file cadangan sebelumnya.</p>
                    </div>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <!-- Backup Box -->
                    <div class="p-5 bg-emerald-50/60 border border-emerald-100 rounded-2xl space-y-3">
                        <div class="flex items-center gap-2.5 text-emerald-800 font-bold text-sm">
                            <i class="fa-solid fa-download text-lg text-emerald-600"></i>
                            <span>Cadangkan Data (Backup)</span>
                        </div>
                        <p class="text-xs text-slate-600 leading-relaxed">
                            Unduh file JSON berisi basis data sistem sesuai komponen yang dipilih. Centang komponen yang ingin dicadangkan.
                        </p>

                        <div class="space-y-2 py-2 border-t border-b border-emerald-100 my-2">
                            <div class="flex items-center justify-between mb-2">
                                <span class="text-[11px] font-bold text-emerald-900 uppercase tracking-wider">Pilih Komponen Backup:</span>
                                <button type="button" onclick="toggleAllBackupCheckboxes()" class="text-[10px] bg-emerald-100 text-emerald-700 hover:bg-emerald-200 px-2.5 py-1 rounded-lg font-semibold transition">Pilih Semua / Batal</button>
                            </div>
                            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-700" id="backup-checkbox-container">
                                <label class="flex items-center gap-2 cursor-pointer select-none">
                                    <input type="checkbox" id="backup-cb-students" checked class="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4">
                                    <span>Siswa, Guru & Kelas</span>
                                </label>
                                <label class="flex items-center gap-2 cursor-pointer select-none">
                                    <input type="checkbox" id="backup-cb-attendance" checked class="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4">
                                    <span>Absensi Siswa & Guru</span>
                                </label>
                                <label class="flex items-center gap-2 cursor-pointer select-none">
                                    <input type="checkbox" id="backup-cb-photos" checked class="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4">
                                    <span>Foto / Selfie Absensi</span>
                                </label>
                                <label class="flex items-center gap-2 cursor-pointer select-none">
                                    <input type="checkbox" id="backup-cb-academics" checked class="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4">
                                    <span>Jadwal & Mata Pelajaran</span>
                                </label>
                                <label class="flex items-center gap-2 cursor-pointer select-none">
                                    <input type="checkbox" id="backup-cb-cbt" checked class="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4">
                                    <span>CBT, Ujian & Nilai</span>
                                </label>
                                <label class="flex items-center gap-2 cursor-pointer select-none">
                                    <input type="checkbox" id="backup-cb-lessonPlans" checked class="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4">
                                    <span>Modul Ajar & Jurnal</span>
                                </label>
                                <label class="flex items-center gap-2 cursor-pointer select-none sm:col-span-2">
                                    <input type="checkbox" id="backup-cb-settings" checked class="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4">
                                    <span>Pengaturan Sistem & Konfigurasi</span>
                                </label>
                            </div>
                        </div>

                        <div class="pt-1">
                            <button type="button" onclick="backupSystemData()" class="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow transition flex items-center gap-2 cursor-pointer">
                                <i class="fa-solid fa-file-export"></i>
                                <span>Download Backup Data (.json)</span>
                            </button>
                        </div>
                    </div>

                    <!-- Restore Box -->
                    <div class="p-5 bg-blue-50/60 border border-blue-100 rounded-2xl space-y-3">
                        <div class="flex items-center gap-2.5 text-blue-800 font-bold text-sm">
                            <i class="fa-solid fa-upload text-lg text-blue-600"></i>
                            <span>Pulihkan Data (Restore)</span>
                        </div>
                        <p class="text-xs text-slate-600 leading-relaxed">
                            Unggah file backup JSON sebelumnya untuk memulihkan data madrasah ke dalam sistem. Centang komponen yang ingin dipulihkan.
                        </p>

                        <div class="space-y-2 py-2 border-t border-b border-blue-100 my-2">
                            <div class="flex items-center justify-between mb-2">
                                <span class="text-[11px] font-bold text-blue-900 uppercase tracking-wider">Pilih Komponen Restore:</span>
                                <button type="button" onclick="toggleAllRestoreCheckboxes()" class="text-[10px] bg-blue-100 text-blue-700 hover:bg-blue-200 px-2.5 py-1 rounded-lg font-semibold transition">Pilih Semua / Batal</button>
                            </div>
                            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-700" id="restore-checkbox-container">
                                <label class="flex items-center gap-2 cursor-pointer select-none">
                                    <input type="checkbox" id="restore-cb-students" checked class="rounded text-blue-600 focus:ring-blue-500 w-4 h-4">
                                    <span>Siswa, Guru & Kelas</span>
                                </label>
                                <label class="flex items-center gap-2 cursor-pointer select-none">
                                    <input type="checkbox" id="restore-cb-attendance" checked class="rounded text-blue-600 focus:ring-blue-500 w-4 h-4">
                                    <span>Absensi Siswa & Guru</span>
                                </label>
                                <label class="flex items-center gap-2 cursor-pointer select-none">
                                    <input type="checkbox" id="restore-cb-photos" checked class="rounded text-blue-600 focus:ring-blue-500 w-4 h-4">
                                    <span>Foto / Selfie Absensi</span>
                                </label>
                                <label class="flex items-center gap-2 cursor-pointer select-none">
                                    <input type="checkbox" id="restore-cb-academics" checked class="rounded text-blue-600 focus:ring-blue-500 w-4 h-4">
                                    <span>Jadwal & Mata Pelajaran</span>
                                </label>
                                <label class="flex items-center gap-2 cursor-pointer select-none">
                                    <input type="checkbox" id="restore-cb-cbt" checked class="rounded text-blue-600 focus:ring-blue-500 w-4 h-4">
                                    <span>CBT, Ujian & Nilai</span>
                                </label>
                                <label class="flex items-center gap-2 cursor-pointer select-none">
                                    <input type="checkbox" id="restore-cb-lessonPlans" checked class="rounded text-blue-600 focus:ring-blue-500 w-4 h-4">
                                    <span>Modul Ajar & Jurnal</span>
                                </label>
                                <label class="flex items-center gap-2 cursor-pointer select-none">
                                    <input type="checkbox" id="restore-cb-settings" checked class="rounded text-blue-600 focus:ring-blue-500 w-4 h-4">
                                    <span>Pengaturan Sistem & Konfigurasi</span>
                                </label>
                            </div>
                        </div>

                        <div class="pt-1 flex flex-wrap items-center gap-2">
                            <label class="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow transition flex items-center gap-2 cursor-pointer">
                                <i class="fa-solid fa-file-import"></i>
                                <span>Pilih File Backup (.json)</span>
                                <input type="file" id="restore-file-input" accept=".json" class="hidden" onchange="restoreSystemData(event)">
                            </label>
                        </div>
                        <p class="text-xs text-amber-800 bg-amber-50 p-2.5 rounded-xl border border-amber-200 mt-2 flex items-start gap-2">
                            <i class="fa-solid fa-circle-info text-amber-600 mt-0.5"></i>
                            <span><strong>Info Foto:</strong> Ya! Foto profil siswa/guru serta foto selfie absensi <strong>ikut tersimpan & terestore</strong> otomatis dari file backup JSON.</span>
                        </p>
                    </div>
                </div>
            </div>

            <!-- Optimasi Penyimpanan Cloud (Pembersihan Foto Pintar) -->
            <div class="bg-white p-6 sm:p-8 rounded-3xl shadow-sm border border-slate-100 space-y-6 mt-6">
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                    <div>
                        <h2 class="text-xl sm:text-2xl font-bold text-slate-800 flex items-center gap-2.5">
                            <i class="fa-solid fa-wand-magic-sparkles text-indigo-600"></i>
                            <span>Pembersihan Foto Pintar (Smart Cleanup)</span>
                        </h2>
                        <p class="text-xs text-slate-400 mt-0.5">Rapikan Cloudinary per ID pengguna: pertahankan 1 foto profil aktif dan 1 foto absensi terbaru setiap siswa/guru, lalu hapus foto riwayat dan absensi ekstra yang sudah tidak dipakai.</p>
                    </div>
                </div>

                <div class="p-5 bg-indigo-50/60 border border-indigo-100 rounded-2xl space-y-4">
                    <div class="flex items-center gap-2.5 text-indigo-800 font-bold text-sm">
                        <i class="fa-solid fa-shield-halved text-lg text-indigo-600"></i>
                        <span>Aturan Pembersihan Cerdas</span>
                    </div>
                    <p class="text-xs text-slate-600 leading-relaxed">
                        Sistem bekerja berdasarkan <strong>ID siswa/guru</strong>. Setiap orang mempertahankan <strong>1 foto profil aktif + 1 foto absensi terbaru</strong>. Foto profil riwayat dan foto absensi lainnya dilepas dari data lama dan aset Cloudinary dihapus bila tidak dipakai di tempat lain. <strong>Data teks absensi tetap dipertahankan.</strong>
                    </p>

                    <div class="pt-2 flex flex-col gap-3">
                        <div class="flex flex-wrap items-center gap-4">
                            <button type="button" onclick="runSmartPhotoCleanup()" class="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow transition flex items-center gap-2 cursor-pointer">
                                <i class="fa-solid fa-broom"></i>
                                <span>Jalankan Pembersihan Sekarang</span>
                            </button>
                            <button type="button" onclick="runTeacherPhotoCleanup()" class="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow transition flex items-center gap-2 cursor-pointer">
                                <i class="fa-solid fa-user-slash"></i>
                                <span>Bersihkan Khusus Foto Absen Guru</span>
                            </button>
                        </div>
                        <div id="cleanup-status-container" class="hidden transition-all duration-300">
                        </div>
                    </div>
                </div>
            </div>


        </div>
    `;
    loadSchoolLocationSettings();
    updateSettingsLogoPreview();
    searchUserAccounts('');
    refreshGoogleDriveSettingsStatus();    setTimeout(() => {
        if (window.updateThemeSelectionUI) {
            window.updateThemeSelectionUI();
        }
    }, 50);
}

function searchUserAccounts(query = '') {
    const resultsContainer = document.getElementById('account-results-list');
    if (!resultsContainer) return;

    const kw = query.toLowerCase().trim();

    if (kw === '') {
        resultsContainer.innerHTML = `
            <div class="text-center py-8 bg-slate-50 rounded-2xl border border-slate-100 text-slate-400 text-xs font-medium">
                Silakan ketik nama, NIS, NIP, atau username pada kolom pencarian untuk menampilkan daftar akun.
            </div>
        `;
        return;
    }

    // Build combined list
    const teachersList = (appState.teachers || []).map(t => ({
        ...t,
        type: 'teacher',
        roleLabel: 'Guru',
        badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200',
        ident: t.nip || 'Guru'
    }));

    const studentsList = (appState.students || []).map(s => {
        const isLeader = s.role === 'class_leader' || s.role === 'ketua_kelas';
        return {
            ...s,
            type: isLeader ? 'class_leader' : 'student',
            roleLabel: isLeader ? 'Ketua Kelas' : 'Murid',
            badgeColor: isLeader ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-slate-50 text-slate-700 border-slate-200',
            ident: s.nis || 'Murid'
        };
    });

    const allUsers = [...teachersList, ...studentsList];

    let filtered = allUsers;
    if (kw) {
        filtered = allUsers.filter(u =>
            (u.name && String(u.name).toLowerCase().includes(kw)) ||
            (u.username && String(u.username).toLowerCase().includes(kw)) ||
            (u.ident && String(u.ident).toLowerCase().includes(kw))
        );
    }

    if (filtered.length === 0) {
        resultsContainer.innerHTML = `
            <div class="text-center py-8 bg-slate-50 rounded-2xl border border-slate-100 text-slate-400 text-xs">
                Tidak ada pengguna yang cocok dengan pencarian Anda.
            </div>
        `;
        return;
    }

    resultsContainer.innerHTML = filtered.map(u => {
        // Safe string escape for name
        const escapedName = (u.name || '').replace(/'/g, "\\'");
        return `
            <div class="flex items-center justify-between p-4 bg-white hover:bg-slate-50/80 border border-slate-100 rounded-2xl shadow-sm transition">
                <div class="flex items-center space-x-3">
                    <div class="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 font-bold font-mono">
                        ${u.name ? u.name.charAt(0).toUpperCase() : '?'}
                    </div>
                    <div>
                        <h4 class="text-xs sm:text-sm font-bold text-slate-800">${u.name}</h4>
                        <p class="text-[10px] sm:text-xs text-slate-400 font-medium">Username: <span class="font-mono text-slate-600">${u.username}</span> | NIP/NIS: <span class="font-mono text-slate-600">${u.ident}</span></p>
                    </div>
                </div>
                <div class="flex items-center space-x-2">
                    <span class="px-2.5 py-1 text-[10px] font-bold uppercase rounded-lg border ${u.badgeColor}">${u.roleLabel}</span>
                    <button type="button" onclick="openResetPasswordModal('${u.id}', '${u.type}')" class="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold rounded-xl transition flex items-center space-x-1">
                        <i class="fa-solid fa-key text-[10px]"></i><span>Reset Password</span>
                    </button>
                    <button type="button" onclick="openEditRoleModal('${u.id}', '${u.type}', '${escapedName}')" class="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-semibold rounded-xl transition flex items-center space-x-1">
                        <i class="fa-solid fa-user-gear text-[10px]"></i><span>Edit Peran</span>
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

function escapeAccountHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[ch]));
}

function generateAdminTemporaryPassword() {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
    const bytes = new Uint32Array(14);
    if (window.crypto && window.crypto.getRandomValues) window.crypto.getRandomValues(bytes);
    else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 0xffffffff);
    let result = 'Mb#';
    for (let i = 0; i < bytes.length; i++) result += alphabet[bytes[i] % alphabet.length];
    return result;
}

function openResetPasswordModal(userId, currentType) {
    const modal = document.getElementById('modal-container');
    if (!modal) return;
    const source = currentType === 'teacher' ? (appState.teachers || []) : (appState.students || []);
    const user = source.find(item => String(item.id) === String(userId));
    if (!user) {
        showToast('Akun tidak ditemukan.', 'error');
        return;
    }
    const generated = generateAdminTemporaryPassword();
    modal.innerHTML = `
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fade-in">
            <div class="bg-white w-full max-w-md rounded-3xl shadow-2xl p-6 space-y-4">
                <div class="flex justify-between items-center">
                    <h3 class="font-bold text-slate-800">Reset Password Akun</h3>
                    <button type="button" onclick="closeModal()"><i class="fa-solid fa-xmark text-lg"></i></button>
                </div>
                <div class="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-800">
                    Password lama tidak dapat ditampilkan karena disimpan sebagai hash. Admin dapat menetapkan password baru dan melihatnya sekali setelah reset.
                </div>
                <div>
                    <p class="text-xs text-slate-400 font-semibold uppercase">Akun</p>
                    <p class="text-sm font-bold text-slate-800">${escapeAccountHtml(user.name || user.username || user.id)}</p>
                    <p class="text-xs font-mono text-slate-500">${escapeAccountHtml(user.username || '')}</p>
                </div>
                <div class="space-y-2">
                    <label class="block text-xs font-bold uppercase text-slate-500">Password Baru</label>
                    <div class="flex gap-2">
                        <input id="admin-reset-password-input" type="text" value="${escapeAccountHtml(generated)}" autocomplete="new-password" class="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-mono">
                        <button type="button" onclick="document.getElementById('admin-reset-password-input').value = generateAdminTemporaryPassword()" class="px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-semibold">Acak</button>
                    </div>
                    <p class="text-[10px] text-slate-400">Password hanya terlihat pada proses reset ini dan tidak disimpan sebagai plaintext.</p>
                </div>
                <div class="flex justify-end space-x-2 pt-2">
                    <button type="button" onclick="closeModal()" class="px-4 py-2 bg-slate-100 rounded-xl text-xs font-semibold">Batal</button>
                    <button type="button" onclick="resetAndShowUserPassword('${escapeAccountHtml(userId)}', '${escapeAccountHtml(currentType)}')" class="px-4 py-2 bg-rose-600 text-white rounded-xl text-xs font-bold hover:bg-rose-700">Reset Password</button>
                </div>
            </div>
        </div>`;
}

async function resetAndShowUserPassword(userId, currentType) {
    const input = document.getElementById('admin-reset-password-input');
    const newPassword = input ? String(input.value || '').trim() : '';
    if (newPassword.length < 8) {
        showToast('Password baru minimal 8 karakter.', 'error');
        return;
    }
    const endpoint = currentType === 'teacher'
        ? `/api/teachers/${encodeURIComponent(userId)}`
        : `/api/students/${encodeURIComponent(userId)}`;
    try {
        const response = await fetch(endpoint, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: newPassword })
        });
        let data = null;
        try { data = await response.json(); } catch (_) {}
        if (!response.ok || !data || data.success === false) {
            throw new Error((data && data.message) || `HTTP ${response.status}`);
        }

        const modal = document.getElementById('modal-container');
        if (modal) {
            modal.innerHTML = `
                <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fade-in">
                    <div class="bg-white w-full max-w-md rounded-3xl shadow-2xl p-6 space-y-4">
                        <div class="text-center space-y-2">
                            <i class="fa-solid fa-circle-check text-emerald-600 text-3xl"></i>
                            <h3 class="font-bold text-slate-800">Password Berhasil Direset</h3>
                            <p class="text-xs text-slate-500">Salin password ini sekarang. Setelah modal ditutup, password lama tidak dapat ditampilkan kembali.</p>
                        </div>
                        <div class="p-4 bg-slate-900 text-white rounded-2xl font-mono text-center text-sm break-all" id="admin-reset-password-result">${escapeAccountHtml(newPassword)}</div>
                        <div class="flex justify-center gap-2">
                            <button type="button" onclick="copyAdminResetPassword()" class="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold">Salin Password</button>
                            <button type="button" onclick="closeModal()" class="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold">Tutup</button>
                        </div>
                    </div>
                </div>`;
        }
        if (currentType !== 'teacher') {
            try {
                const source = appState.students || [];
                const student = source.find(item => String(item.id) === String(userId));
                const existing = JSON.parse(sessionStorage.getItem('cbt_print_credentials') || '[]');
                const map = new Map();
                (Array.isArray(existing) ? existing : []).forEach(c => {
                    if (c?.studentId) map.set(String(c.studentId), c);
                });
                map.set(String(userId), {
                    studentId: String(userId),
                    username: student?.username || '',
                    temporaryPassword: newPassword
                });
                sessionStorage.setItem('cbt_print_credentials', JSON.stringify(Array.from(map.values())));
            } catch (_) {}
        }
        showToast('Password akun berhasil direset.', 'success');
    } catch (err) {
        showToast('Gagal reset password: ' + err.message, 'error');
    }
}

async function copyAdminResetPassword() {
    const el = document.getElementById('admin-reset-password-result');
    if (!el) return;
    try {
        await navigator.clipboard.writeText(el.textContent || '');
        showToast('Password disalin.', 'success');
    } catch (_) {
        showToast('Tidak dapat menyalin otomatis. Silakan salin manual.', 'error');
    }
}

function openEditRoleModal(userId, currentType, userName) {
    const modal = document.getElementById('modal-container');
    if (!modal) return;

    modal.innerHTML = `
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fade-in">
            <div class="bg-white w-full max-w-sm rounded-3xl shadow-2xl p-6 space-y-4">
                <div class="flex justify-between items-center">
                    <h3 class="font-bold text-slate-800">Ubah Peran Pengguna</h3>
                    <button type="button" onclick="closeModal()"><i class="fa-solid fa-xmark text-lg"></i></button>
                </div>
                <div class="space-y-1">
                    <p class="text-xs text-slate-400 font-semibold uppercase">Nama Pengguna</p>
                    <p class="text-sm font-bold text-slate-800">${userName}</p>
                </div>

                <div class="space-y-2">
                    <label class="block text-xs font-bold uppercase text-slate-500">Pilih Peran Baru</label>
                    <select id="new-user-role-select" class="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-semibold">
                        <option value="teacher" ${currentType === 'teacher' ? 'selected' : ''}>Guru (Dewan Guru)</option>
                        <option value="student" ${currentType === 'student' ? 'selected' : ''}>Murid (Siswa Biasa)</option>
                        <option value="class_leader" ${currentType === 'class_leader' ? 'selected' : ''}>Ketua Kelas (Akses Absensi Kelas)</option>
                    </select>
                </div>

                <div class="flex justify-end space-x-2 pt-2">
                    <button type="button" onclick="closeModal()" class="px-4 py-2 bg-slate-100 rounded-xl text-xs font-semibold hover:bg-slate-200 transition">Batal</button>
                    <button type="button" onclick="saveUserRole('${userId}')" class="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 shadow transition">Simpan Peran</button>
                </div>
            </div>
        </div>
    `;
}

async function saveUserRole(userId) {
    const selectEl = document.getElementById('new-user-role-select');
    if (!selectEl) return;
    const newRole = selectEl.value;

    try {
        const response = await fetch('/api/users/change-role', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, newRole })
        });

        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.message || 'Gagal mengubah peran.');

        showToast(data.message || 'Peran pengguna berhasil diperbarui!', 'success');
        closeModal();

        // Refresh local data from server
        await loadDataFromServer();

        // Refresh account search results list
        const searchInput = document.getElementById('account-search-input');
        const kw = searchInput ? searchInput.value : '';
        searchUserAccounts(kw);
    } catch (err) {
        showToast(err.message, 'error');
    }
}

function selectPresetLogoIcon(iconClass) {
    appState.tempLogo = iconClass;
    updateSettingsLogoPreview();
}

function handleLogoURLInput(url) {
    if (url.trim()) {
        appState.tempLogo = url.trim();
        updateSettingsLogoPreview();
    }
}

function handleLogoFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        appState.tempLogo = e.target.result;
        updateSettingsLogoPreview();
    };
    reader.readAsDataURL(file);
}

function clearCustomLogo() {
    appState.tempLogo = 'fa-moon';
    const urlInput = document.getElementById('settings-logo-url');
    if (urlInput) urlInput.value = '';
    const fileInput = document.getElementById('logo-file-input');
    if (fileInput) fileInput.value = '';
    updateSettingsLogoPreview();
}

function setQuickLogoColor(hexColor, type = 'bg') {
    const inputId = type === 'bg' ? 'settings-logo-bg' : 'settings-logo-color';
    const input = document.getElementById(inputId);
    if (input) {
        input.value = hexColor;
        updateSettingsLogoPreview();
    }
}

function updateSettingsLogoPreview() {
    const previewContainer = document.getElementById('settings-logo-preview-container');
    const typeLabel = document.getElementById('settings-logo-type-label');
    if (!previewContainer) return;

    const shapeSelect = document.getElementById('settings-logo-shape');
    const bgInput = document.getElementById('settings-logo-bg');
    const bgHexSpan = document.getElementById('settings-logo-bg-hex');
    const colorInput = document.getElementById('settings-logo-color');
    const colorHexSpan = document.getElementById('settings-logo-color-hex');

    const shape = shapeSelect ? shapeSelect.value : (appState.settings.schoolLogoShape || 'rounded-xl');
    const bg = bgInput ? bgInput.value : (appState.settings.schoolLogoBg || '#059669');
    const color = colorInput ? colorInput.value : (appState.settings.schoolLogoColor || '#ffffff');

    if (bgHexSpan && bgInput) {
        bgHexSpan.innerText = bg;
    }
    if (colorHexSpan && colorInput) {
        colorHexSpan.innerText = color;
    }

    // Reset classes
    previewContainer.className = "w-16 h-16 flex items-center justify-center text-3xl font-bold shadow-lg overflow-hidden transition-all duration-200";
    previewContainer.style.color = color;

    // Apply shape via applyLogoShape helper
    if (window.applyLogoShape) {
        window.applyLogoShape(previewContainer, shape);
    } else if (shape.includes(' ')) {
        shape.split(' ').forEach(cls => {
            if (cls.trim()) previewContainer.classList.add(cls.trim());
        });
    } else {
        previewContainer.classList.add(shape);
    }

    // Apply background color style
    previewContainer.style.backgroundColor = bg;

    const logo = appState.tempLogo || appState.settings.schoolLogo || 'fa-moon';
    if (logo.startsWith('data:image/') || logo.startsWith('http://') || logo.startsWith('https://')) {
        previewContainer.innerHTML = `<img src="${logo}" class="w-full h-full object-cover" referrerPolicy="no-referrer" alt="Logo">`;
        typeLabel.innerText = 'Tipe: Gambar';

        const urlInput = document.getElementById('settings-logo-url');
        if (urlInput && (logo.startsWith('http://') || logo.startsWith('https://'))) {
            urlInput.value = logo;
        }
    } else {
        previewContainer.innerHTML = `<i class="fa-solid ${logo}"></i>`;
        typeLabel.innerText = 'Tipe: Ikon';
    }
}

function saveSettings(e) {
    e.preventDefault();
    appState.settings.schoolName = document.getElementById('set-school').value;
    appState.settings.adminName = document.getElementById('set-admin-name').value;
    const runningTextEl = document.getElementById('set-running-text');
    if (runningTextEl) {
        appState.settings.runningText = runningTextEl.value.trim();
    }
    const chatEnabledEl = document.getElementById('set-chat-enabled');
    if (chatEnabledEl) {
        appState.settings.chatEnabled = chatEnabledEl.checked;
    }
    const adminLivecamEnabledEl = document.getElementById('set-admin-livecam-enabled');
    if (adminLivecamEnabledEl) {
        appState.settings.adminLivecamEnabled = adminLivecamEnabledEl.checked;
        if (!adminLivecamEnabledEl.checked && typeof window.closeStudentLivecamFocus === 'function') {
            window.closeStudentLivecamFocus();
        }
    }

    appState.settings.studentFeatures = {
        ...(appState.settings.studentFeatures || {}),
        attendance: document.getElementById('set-student-attendance-enabled')?.checked !== false,
        learning: document.getElementById('set-learning-enabled')?.checked !== false,
        cbt: document.getElementById('set-student-cbt-enabled')?.checked !== false,
        games: document.getElementById('set-student-games-enabled')?.checked !== false
    };
    appState.settings.learningModuleEnabled = appState.settings.studentFeatures.learning !== false;
    appState.settings.gameModuleEnabled = appState.settings.studentFeatures.games !== false;
    if (appState.tempLogo) {
        appState.settings.schoolLogo = appState.tempLogo;
    }

    const shapeSelect = document.getElementById('settings-logo-shape');
    const bgInput = document.getElementById('settings-logo-bg');
    const colorInput = document.getElementById('settings-logo-color');
    const requireGpsEl = document.getElementById('set-require-gps');
    const requireSelfieEl = document.getElementById('set-require-selfie');

    if (shapeSelect) {
        appState.settings.schoolLogoShape = shapeSelect.value;
    }
    if (bgInput) {
        appState.settings.schoolLogoBg = bgInput.value;
    }
    if (colorInput) {
        appState.settings.schoolLogoColor = colorInput.value;
    }
    if (requireGpsEl) {
        appState.settings.requireGps = requireGpsEl.checked;
    }
    if (requireSelfieEl) {
        appState.settings.requireSelfie = requireSelfieEl.checked;
    }

    const teacherAllowDatePickerEl = document.getElementById('set-teacher-allow-date-picker');
    if (teacherAllowDatePickerEl) {
        appState.settings.teacherAllowDatePicker = teacherAllowDatePickerEl.checked;
    }

    const lkUrlEl = document.getElementById('set-livekit-url');
    const lkKeyEl = document.getElementById('set-livekit-api-key');
    const lkSecEl = document.getElementById('set-livekit-api-secret');
    if (lkUrlEl) appState.settings.livekitUrl = lkUrlEl.value.trim();
    if (lkKeyEl) appState.settings.livekitApiKey = lkKeyEl.value.trim();
    if (lkSecEl) appState.settings.livekitApiSecret = lkSecEl.value.trim();

    const turnUrlEl = document.getElementById('set-turn-url');
    const turnUserEl = document.getElementById('set-turn-username');
    const turnCredEl = document.getElementById('set-turn-credential');
    const disablePublicStunEl = document.getElementById('set-disable-public-stun');
    if (turnUrlEl) appState.settings.turnUrl = turnUrlEl.value.trim();
    if (turnUserEl) appState.settings.turnUsername = turnUserEl.value.trim();
    if (turnCredEl) appState.settings.turnCredential = turnCredEl.value.trim();
    if (disablePublicStunEl) appState.settings.disablePublicStun = disablePublicStunEl.checked;

    saveState('settings');

    const schoolNameEl = document.getElementById('nav-school-name');
    if (schoolNameEl) schoolNameEl.innerText = appState.settings.schoolName;

    if (window.updateSchoolLogoUI) {
        window.updateSchoolLogoUI();
    }
    showToast('Pengaturan sistem berhasil disimpan!', 'success');
}

async function loadSchoolLocationSettings() {
    try {
        const response = await fetch('/api/system-settings/location');
        const data = await response.json();
        if (response.ok && data.success && data.settings) {
            const latEl = document.getElementById('school-latitude');
            const lngEl = document.getElementById('school-longitude');
            const radEl = document.getElementById('geofence-radius');
            if (latEl) latEl.value = data.settings.schoolLatitude;
            if (lngEl) lngEl.value = data.settings.schoolLongitude;
            if (radEl) radEl.value = data.settings.geofenceRadius;
        }
    } catch (err) {}
}

function useCurrentSchoolLocation() {
    if (!navigator.geolocation) { showToast('Geolocation tidak didukung.', 'error'); return; }
    navigator.geolocation.getCurrentPosition(pos => {
        const latEl = document.getElementById('school-latitude');
        const lngEl = document.getElementById('school-longitude');
        if (latEl) latEl.value = pos.coords.latitude;
        if (lngEl) lngEl.value = pos.coords.longitude;
        showToast('Lokasi GPS berhasil digunakan!', 'success');
    });
}

async function saveSchoolLocationSettings() {
    const schoolLatitude = document.getElementById('school-latitude')?.value;
    const schoolLongitude = document.getElementById('school-longitude')?.value;
    const geofenceRadius = document.getElementById('geofence-radius')?.value;

    try {
        await fetch('/api/system-settings/location', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ schoolLatitude, schoolLongitude, geofenceRadius })
        });
        showToast('Lokasi geotagging sekolah disimpan!', 'success');
    } catch (err) {
        showToast('Gagal menyimpan lokasi.', 'error');
    }
}



// Attendance Recap Module
function updateAdminAttendanceDate(newDate) {
    if (!newDate) return;
    appState.activeAttendanceDate = newDate;
    refreshStudentAttendanceView();
}
window.updateAdminAttendanceDate = updateAdminAttendanceDate;

async function clearAllAttendanceRecords() {
    // Legacy UI entry now delegates to the safe Cloudinary Smart Cleanup.
    // It must never delete historical attendance text rows.
    if (typeof window.runSmartPhotoCleanup === 'function') {
        return window.runSmartPhotoCleanup();
    }
    showToast('Buka Pengaturan > Smart Cleanup untuk menjalankan pembersihan foto aman.', 'info');
}
window.clearAllAttendanceRecords = clearAllAttendanceRecords;

function refreshStudentAttendanceView() {
    const scrollPos = window.scrollY;
    const contentArea = document.getElementById('attendance-content-area') || document.getElementById('view-container');
    if (contentArea) {
        renderStudentAttendanceAdminOnly(contentArea);
    }
    window.scrollTo(0, scrollPos);
}

function handleAttendanceSearchInput(val) {
    appState.activeAttendanceSearch = val;
    refreshStudentAttendanceView();
    const inputEl = document.getElementById('attendance-search-input');
    if (inputEl) {
        inputEl.focus();
        inputEl.setSelectionRange(inputEl.value.length, inputEl.value.length);
    }
}

function renderStudentAttendanceAdminOnly(container) {
    let classes = appState.classes || [];

    // Available subjects list (for teacher: filter by teacher's mapel)
    let availableSubjects = appState.subjects || [];
    if (appState.role === 'teacher') {
        const currentTeacher = (appState.teachers || []).find(t => String(t.id) === String(appState.currentUser?.id)) || appState.currentUser;
        const rawMapels = Array.isArray(currentTeacher?.mapel) ? currentTeacher.mapel : (currentTeacher?.mapel ? [currentTeacher.mapel] : []);
        if (rawMapels.length > 0) {
            const matchedSubs = availableSubjects.filter(sub => {
                return rawMapels.some(m => {
                    const mStr = String(m).toLowerCase().trim();
                    const subName = String(sub.name || '').toLowerCase().trim();
                    const subCode = String(sub.code || '').toLowerCase().trim();
                    const subId = String(sub.id || '').toLowerCase().trim();
                    return mStr === subName || mStr === subCode || mStr === subId || subName.includes(mStr) || mStr.includes(subName);
                });
            });
            if (matchedSubs.length > 0) {
                availableSubjects = matchedSubs;
            }
        }
    }

    let selectedSubjectId = appState.activeAttendanceSubjectId;
    if (!selectedSubjectId) {
        selectedSubjectId = 'ALL';
        appState.activeAttendanceSubjectId = 'ALL';
    }

    let selectedClassId = appState.activeAttendanceClassId;
    if (!selectedClassId) {
        selectedClassId = 'ALL';
        appState.activeAttendanceClassId = 'ALL';
    }

    const todayIso = new Date().toISOString().split('T')[0];
    let selectedDate = appState.activeAttendanceDate || todayIso;
    appState.activeAttendanceDate = selectedDate;

    const searchKeyword = appState.activeAttendanceSearch || '';

    let students = [];
    if (selectedClassId === 'ALL') {
        students = appState.students || [];
    } else if (selectedClassId) {
        students = (appState.students || []).filter(s => {
            const sClass = String(s.classId || s.class_id || '');
            if (sClass === String(selectedClassId)) return true;
            if (selectedClassId === 'C1' && sClass === '4') return true;
            if (selectedClassId === 'C4' && sClass === '4') return true;
            return false;
        });
    }

    if (searchKeyword.trim() !== '') {
        const kw = searchKeyword.toLowerCase();
        students = students.filter(s => (s.name && String(s.name).toLowerCase().includes(kw)) || (s.nis && String(s.nis).toLowerCase().includes(kw)));
    }
    students = sortStudentsByNis(students);

    const totalAttendanceRecords = (appState.attendance || []).length;
    const dailyRecordsCount = (appState.attendance || []).filter(a => String(a.date).substring(0, 10) === selectedDate).length;

    container.innerHTML = `
        <div class="space-y-6">
            <div class="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 class="text-xl sm:text-2xl font-bold text-slate-800">Rekapitulasi Kehadiran Murid</h1>
                    <p class="text-xs text-slate-400 mt-1">Pantau kehadiran siswa per mata pelajaran, foto selfie, dan lokasi GPS secara real-time</p>
                </div>
            </div>

            <div class="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col sm:flex-row flex-wrap items-center gap-4">
                <div class="w-full sm:w-60">
                    <label class="block text-xs uppercase font-semibold text-slate-500 mb-1">Pilih Kelas</label>
                    <select onchange="appState.activeAttendanceClassId = this.value; appState.activeAttendanceSearch = ''; refreshStudentAttendanceView();" class="w-full px-4 py-2.5 bg-slate-50 border rounded-2xl text-sm font-semibold">
                        <option value="">-- Pilih Kelas --</option>
                        <option value="ALL" ${selectedClassId === 'ALL' ? 'selected' : ''}>-- Semua Siswa / Semua Kelas --</option>
                        ${classes.map(c => `<option value="${c.id}" ${selectedClassId === c.id ? 'selected' : ''}>${c.name}</option>`).join('')}
                    </select>
                </div>
                <div class="w-full sm:w-64">
                    <label class="block text-xs uppercase font-semibold text-slate-500 mb-1">Pilih Mata Pelajaran</label>
                    <select onchange="appState.activeAttendanceSubjectId = this.value; refreshStudentAttendanceView();" class="w-full px-4 py-2.5 bg-slate-50 border rounded-2xl text-sm font-semibold">
                        <option value="ALL" ${selectedSubjectId === 'ALL' || !selectedSubjectId ? 'selected' : ''}>-- Semua Mapel / Sesi --</option>
                        ${availableSubjects.map(s => `<option value="${s.id}" ${String(selectedSubjectId) === String(s.id) ? 'selected' : ''}>${s.name}</option>`).join('')}
                    </select>
                </div>
                <div class="w-full sm:w-60">
                    <label class="block text-xs uppercase font-semibold text-slate-500 mb-1">Tanggal Absensi</label>
                    <div class="relative">
                        <input type="date" id="attendance-date-picker" value="${selectedDate}" onchange="updateAdminAttendanceDate(this.value)" class="w-full pl-3 pr-10 py-2.5 bg-slate-50 border rounded-2xl text-xs font-semibold focus:bg-white focus:ring-1 focus:ring-emerald-500">
                        <span class="absolute right-3.5 top-3.5 text-slate-400 pointer-events-none text-xs">
                            <i class="fa-solid fa-calendar-day"></i>
                        </span>
                    </div>
                </div>
                ${selectedClassId ? `
                    <div class="w-full sm:flex-1 min-w-[200px]">
                        <label class="block text-xs uppercase font-semibold text-slate-500 mb-1">Cari Nama / NIS Siswa</label>
                        <div class="relative">
                            <i class="fa-solid fa-magnifying-glass absolute left-3.5 top-3.5 text-slate-400 text-xs"></i>
                            <input type="text" id="attendance-search-input" value="${searchKeyword}" oninput="handleAttendanceSearchInput(this.value)" placeholder="Ketik nama atau NIS siswa..." class="w-full pl-9 pr-4 py-2.5 bg-slate-50 border rounded-2xl text-xs sm:text-sm">
                        </div>
                    </div>
                ` : ''}
            </div>

            ${!selectedClassId ? `
                <div class="bg-white p-12 rounded-3xl text-center text-slate-400 text-sm border border-slate-100">Silakan pilih kelas terlebih dahulu.</div>
            ` : `
                ${(() => {
                    let liveHadirCount = 0;
                    let liveIzinCount = 0;
                    let liveSakitCount = 0;
                    let liveAlpaCount = 0;
                    let liveBelumCount = 0;
                    students.forEach(st => {
                        const att = (appState.attendance || []).slice().reverse().find(a => {
                            const sameStudent = (
                                String(a.studentId) === String(st.id) ||
                                (a.studentId && st.id && String(a.studentId).toLowerCase().trim() === String(st.id).toLowerCase().trim()) ||
                                (a.studentId && st.nis && String(a.studentId).toLowerCase().trim() === String(st.nis).toLowerCase().trim()) ||
                                (a.studentId && st.name && String(a.studentId).toLowerCase().trim() === String(st.name).toLowerCase().trim()) ||
                                (a.studentId && st.username && String(a.studentId).toLowerCase().trim() === String(st.username).toLowerCase().trim())
                            );
                            const sameDate = String(a.date).substring(0, 10) === selectedDate;
                            let sameSubject = true;
                            if (selectedSubjectId && selectedSubjectId !== 'ALL') {
                                sameSubject = (String(a.subjectId || '') === String(selectedSubjectId) || !a.subjectId || String(a.subjectId) === 'ALL');
                            }
                            return sameStudent && sameDate && sameSubject;
                        });
                        const stStatus = att ? att.status : 'BELUM ABSEN';
                        if (stStatus === 'HADIR') liveHadirCount++;
                        else if (stStatus === 'IZIN') liveIzinCount++;
                        else if (stStatus === 'SAKIT') liveSakitCount++;
                        else if (stStatus === 'ALPA') liveAlpaCount++;
                        else liveBelumCount++;
                    });
                    return `
                        <!-- Live Stats Bar -->
                        <div class="grid grid-cols-2 sm:grid-cols-5 gap-3">
                            <div class="bg-emerald-50 border border-emerald-200/80 p-3 rounded-2xl flex items-center justify-between shadow-xs">
                                <div class="flex items-center gap-2">
                                    <div class="w-8 h-8 bg-emerald-600 text-white rounded-xl flex items-center justify-center text-xs font-bold shadow-xs">✓</div>
                                    <div>
                                        <div class="text-[11px] font-bold text-emerald-950">Hadir (H)</div>
                                        <div class="text-[9px] text-emerald-600 font-medium">Presensi Masuk</div>
                                    </div>
                                </div>
                                <span class="text-lg font-black text-emerald-700 font-mono">${liveHadirCount}</span>
                            </div>
                            <div class="bg-blue-50 border border-blue-200/80 p-3 rounded-2xl flex items-center justify-between shadow-xs">
                                <div class="flex items-center gap-2">
                                    <div class="w-8 h-8 bg-blue-600 text-white rounded-xl flex items-center justify-center text-xs font-bold shadow-xs">I</div>
                                    <div>
                                        <div class="text-[11px] font-bold text-blue-950">Izin (I)</div>
                                        <div class="text-[9px] text-blue-600 font-medium">Surat Izin</div>
                                    </div>
                                </div>
                                <span class="text-lg font-black text-blue-700 font-mono">${liveIzinCount}</span>
                            </div>
                            <div class="bg-amber-50 border border-amber-200/80 p-3 rounded-2xl flex items-center justify-between shadow-xs">
                                <div class="flex items-center gap-2">
                                    <div class="w-8 h-8 bg-amber-600 text-white rounded-xl flex items-center justify-center text-xs font-bold shadow-xs">S</div>
                                    <div>
                                        <div class="text-[11px] font-bold text-amber-950">Sakit (S)</div>
                                        <div class="text-[9px] text-amber-600 font-medium">Surat Dokter</div>
                                    </div>
                                </div>
                                <span class="text-lg font-black text-amber-700 font-mono">${liveSakitCount}</span>
                            </div>
                            <div class="bg-rose-50 border border-rose-200/80 p-3 rounded-2xl flex items-center justify-between shadow-xs">
                                <div class="flex items-center gap-2">
                                    <div class="w-8 h-8 bg-rose-600 text-white rounded-xl flex items-center justify-center text-xs font-bold shadow-xs">A</div>
                                    <div>
                                        <div class="text-[11px] font-bold text-rose-950">Alpa (A)</div>
                                        <div class="text-[9px] text-rose-600 font-medium">Tanpa Ket.</div>
                                    </div>
                                </div>
                                <span class="text-lg font-black text-rose-700 font-mono">${liveAlpaCount}</span>
                            </div>
                            <div class="bg-slate-50 border border-slate-200 p-3 rounded-2xl flex items-center justify-between shadow-xs col-span-2 sm:col-span-1">
                                <div class="flex items-center gap-2">
                                    <div class="w-8 h-8 bg-slate-500 text-white rounded-xl flex items-center justify-center text-xs font-bold shadow-xs">-</div>
                                    <div>
                                        <div class="text-[11px] font-bold text-slate-800">Belum Hadir</div>
                                        <div class="text-[9px] text-slate-500 font-medium">Belum Absen</div>
                                    </div>
                                </div>
                                <span class="text-lg font-black text-slate-700 font-mono">${liveBelumCount}</span>
                            </div>
                        </div>
                    `;
                })()}

                <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 bg-slate-50/90 p-4 rounded-3xl border border-slate-200 shadow-xs">
                    <div class="text-xs text-slate-700 font-medium flex items-center gap-2">
                        <i class="fa-solid fa-circle-info text-emerald-600 text-base shrink-0"></i>
                        <span>Pilih status kehadiran atau gunakan tombol cepat untuk pembaruan massal.</span>
                    </div>
                    <div class="flex flex-wrap items-center gap-2 shrink-0">
                        <button type="button" onclick="refreshStudentAttendanceData(this)" class="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 active:scale-95 text-white font-bold rounded-2xl text-xs shadow-xs transition cursor-pointer flex items-center gap-1.5">
                            <i class="fa-solid fa-arrows-rotate"></i>
                            <span>Refresh</span>
                        </button>
                        <button type="button" onclick="markAllStudentsUnmarked()" class="px-3.5 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-2xl text-xs shadow-xs transition cursor-pointer flex items-center gap-1.5">
                            <i class="fa-solid fa-times-circle"></i>
                            <span>Belum Absen Semua</span>
                        </button>
                        <button type="button" onclick="markAllStudentsPresent()" class="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl text-xs shadow-xs transition cursor-pointer flex items-center gap-1.5">
                            <i class="fa-solid fa-check-double"></i>
                            <span>Hadir Semua</span>
                        </button>
                        <button type="button" onclick="openPrintAttendanceModal()" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl text-xs shadow-md shadow-indigo-600/20 transition cursor-pointer flex items-center gap-1.5">
                            <i class="fa-solid fa-print"></i>
                            <span>Cetak Rekap Absensi</span>
                        </button>
                    </div>
                </div>
                <div class="bg-white rounded-3xl shadow-sm border overflow-hidden">
                    <div class="overflow-x-auto">
                        <table class="w-full text-left border-collapse min-w-[700px]">
                            <thead>
                                <tr class="bg-slate-50 text-xs font-semibold text-slate-500 uppercase border-b">
                                    <th class="p-4 w-16 text-center">No</th>
                                    <th class="p-4">NIS</th>
                                    <th class="p-4 text-center w-20">Foto Profil</th>
                                    <th class="p-4">Nama Murid</th>
                                    <th class="p-4 text-center">Status</th>
                                    <th class="p-4 text-center">Foto Selfie</th>
                                    <th class="p-4">GPS Geotagging</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y text-sm">
                                ${students.map((st, idx) => {
                                    const att = (appState.attendance || []).slice().reverse().find(a => {
                                        const sameStudent = (
                                            String(a.studentId) === String(st.id) ||
                                            (a.studentId && st.id && String(a.studentId).toLowerCase().trim() === String(st.id).toLowerCase().trim()) ||
                                            (a.studentId && st.nis && String(a.studentId).toLowerCase().trim() === String(st.nis).toLowerCase().trim()) ||
                                            (a.studentId && st.name && String(a.studentId).toLowerCase().trim() === String(st.name).toLowerCase().trim()) ||
                                            (a.studentId && st.username && String(a.studentId).toLowerCase().trim() === String(st.username).toLowerCase().trim())
                                        );
                                        const sameDate = String(a.date).substring(0, 10) === selectedDate;
                                        let sameSubject = true;
                                        if (selectedSubjectId && selectedSubjectId !== 'ALL') {
                                            sameSubject = (String(a.subjectId || '') === String(selectedSubjectId) || !a.subjectId || String(a.subjectId) === 'ALL');
                                        } else {
                                            sameSubject = true;
                                        }
                                        return sameStudent && sameDate && sameSubject;
                                    });
                                    const status = att ? att.status : 'BELUM ABSEN';
                                    const profilePhotoHtml = st.photo
                                        ? `<img src="${window.getPhotoHtmlSrc ? window.getPhotoHtmlSrc(st.photo) : ''}" class="w-10 h-10 rounded-full object-cover border border-emerald-200 shadow-xs mx-auto cursor-pointer hover:scale-110 transition ring-2 ring-emerald-500/20" onclick="showPhotoPopup('${st.photo}', 'Foto Profil - ${st.name}')" referrerPolicy="no-referrer" alt="Foto Profil" title="Klik untuk memperbesar Foto Profil">`
                                        : `<div class="w-10 h-10 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-200 mx-auto font-bold text-xs shadow-xs" title="Belum ada foto profil">${(st.name || 'S').charAt(0).toUpperCase()}</div>`;

                                    return `
                                        <tr class="hover:bg-slate-50/50">
                                            <td class="p-4 text-center font-mono text-xs">${idx + 1}</td>
                                            <td class="p-4 font-mono text-xs font-bold text-emerald-700">${st.nis}</td>
                                            <td class="p-4 text-center">${profilePhotoHtml}</td>
                                            <td class="p-4 font-semibold text-slate-800">${st.name}</td>
                                            <td class="p-4 text-center">
                                                <select onchange="updateStudentAttendanceAdmin(decodeURIComponent('${encodeURIComponent(String(st.id || ''))}'), '${selectedDate}', this.value, decodeURIComponent('${encodeURIComponent(att && att.id ? String(att.id) : '')}'), this)" class="px-2.5 py-1.5 border rounded-xl text-xs font-bold cursor-pointer transition shadow-xs ${status === 'HADIR' ? 'bg-emerald-50 text-emerald-700 border-emerald-300' : (status === 'IZIN' ? 'bg-blue-50 text-blue-700 border-blue-300' : (status === 'SAKIT' ? 'bg-amber-50 text-amber-700 border-amber-300' : (status === 'ALPA' ? 'bg-rose-50 text-rose-700 border-rose-300' : 'bg-slate-50 text-slate-600 border-slate-200')))}">
                                                    <option value="BELUM ABSEN" ${status === 'BELUM ABSEN' || status === 'BELUM HADIR' ? 'selected' : ''}>BELUM HADIR</option>
                                                    <option value="HADIR" ${status === 'HADIR' ? 'selected' : ''}>HADIR</option>
                                                    <option value="IZIN" ${status === 'IZIN' ? 'selected' : ''}>IZIN</option>
                                                    <option value="SAKIT" ${status === 'SAKIT' ? 'selected' : ''}>SAKIT</option>
                                                    <option value="ALPA" ${status === 'ALPA' ? 'selected' : ''}>ALPA</option>
                                                </select>
                                            </td>
                                            <td class="p-4 text-center">${att && att.photo ? `<img src="${window.getPhotoHtmlSrc ? window.getPhotoHtmlSrc(att.photo) : ''}" class="w-10 h-10 rounded-full object-cover border border-slate-200 shadow-sm mx-auto cursor-pointer hover:scale-105 transition ring-2 ring-emerald-500/20" onclick="showStudentAttendancePhotoModal('${att.photo.replace(/'/g, "\\'")}', '${st.id}', '${st.name.replace(/'/g, "\\'")}', '${att.date || selectedDate}', '${st.nis || ''}')" referrerPolicy="no-referrer" alt="Foto">` : `<span class="text-xs text-slate-400 italic">No Photo</span>`}</td>
                                            <td class="p-4 font-mono text-xs text-slate-600">${att ? att.location || '-6.2000, 106.8166' : '-'}</td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            `}
        </div>
    `;
}

function showStudentAttendancePhotoModal(photoUrl, studentId, studentName, date, nis) {
    const modal = document.getElementById('modal-container');
    if (!modal) return;

    const st = (appState.students || []).find(s => String(s.id) === String(studentId) || (nis && String(s.nis) === String(nis)) || (studentName && s.name === studentName)) || { id: studentId, name: studentName, nis: nis, photo: '' };
    const isCurrentProfile = Boolean(st.photo && st.photo === photoUrl);

    modal.innerHTML = `
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 animate-in fade-in zoom-in duration-200">
            <div class="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[92vh]">
                <!-- Header -->
                <div class="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
                    <div class="flex items-center gap-2.5">
                        <div class="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-sm border border-emerald-500/30">
                            <i class="fa-solid fa-camera"></i>
                        </div>
                        <div>
                            <h3 class="text-sm font-bold leading-tight">Foto Selfie Absensi Siswa</h3>
                            <p class="text-[11px] text-slate-400 font-mono">${date || 'Tanggal Absensi'}</p>
                        </div>
                    </div>
                    <button type="button" onclick="closeModal()" class="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition cursor-pointer" title="Tutup">
                        <i class="fa-solid fa-xmark text-sm"></i>
                    </button>
                </div>

                <!-- Body / Photo Card -->
                <div class="p-6 space-y-4 overflow-y-auto">
                    <!-- Photo Display -->
                    <div class="relative rounded-2xl overflow-hidden bg-slate-900 border border-slate-200 shadow-inner flex items-center justify-center group min-h-[260px] max-h-[360px]">
                        <img src="${window.getPhotoHtmlSrc ? window.getPhotoHtmlSrc(photoUrl) : ''}" class="w-full h-full max-h-[360px] object-contain" referrerPolicy="no-referrer" alt="Selfie Absensi">
                        <div class="absolute bottom-2 left-2 right-2 px-3 py-1.5 bg-slate-950/70 backdrop-blur-md rounded-xl text-white text-[11px] flex items-center justify-between">
                            <span class="flex items-center gap-1.5 font-medium"><i class="fa-solid fa-clock text-emerald-400"></i> ${date || '-'}</span>
                            <span class="text-slate-300 text-[10px]">Foto Selfie Absensi</span>
                        </div>
                    </div>
                </div>

                <!-- Footer Actions -->
                <div class="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-center">
                    <div id="attendance-photo-action-btn" class="w-full flex justify-center">
                        ${isCurrentProfile ? `
                            <span class="px-4 py-2.5 bg-emerald-50 text-emerald-700 font-bold rounded-2xl text-xs border border-emerald-200 flex items-center gap-1.5">
                                <i class="fa-solid fa-circle-check text-emerald-600 text-sm"></i> Sedang Digunakan Sebagai Foto Profil
                            </span>
                        ` : `
                            <button type="button" onclick="setAttendancePhotoAsStudentProfile('${st.id}', '${photoUrl.replace(/'/g, "\\'")}', '${date}')" class="w-full py-3 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold rounded-2xl text-xs shadow-md shadow-emerald-600/20 transition flex items-center justify-center gap-2 cursor-pointer">
                                <i class="fa-solid fa-user-check"></i> Jadikan Foto Profil
                            </button>
                        `}
                    </div>
                </div>
            </div>
        </div>
    `;
    modal.classList.remove('hidden');
}
window.showStudentAttendancePhotoModal = showStudentAttendancePhotoModal;

async function setAttendancePhotoAsStudentProfile(studentId, photoUrl, dateStr) {
    try {
        const btnContainer = document.getElementById('attendance-photo-action-btn');
        if (btnContainer) {
            btnContainer.innerHTML = `
                <button type="button" disabled class="px-5 py-2.5 bg-emerald-600/80 text-white font-bold rounded-2xl text-xs flex items-center gap-2 cursor-wait">
                    <i class="fa-solid fa-spinner fa-spin"></i> Menyimpan...
                </button>
            `;
        }

        const stIdx = (appState.students || []).findIndex(s => String(s.id) === String(studentId));
        if (stIdx < 0) {
            showToast('Data siswa tidak ditemukan.', 'error');
            return;
        }

        const student = appState.students[stIdx];
        const prevPhoto = student.photo || '';
        let photoHistory = Array.isArray(student.photoHistory) ? [...student.photoHistory] : [];

        // Save previous photo to history if not yet recorded
        if (prevPhoto && !photoHistory.some(h => (typeof h === 'string' ? h : h.photo) === prevPhoto)) {
            photoHistory.unshift({
                photo: prevPhoto,
                date: student.photoUpdated || new Date().toISOString().split('T')[0],
                type: 'initial',
                label: 'Foto Sebelumnya'
            });
        }

        // Add attendance photo to history if not present
        if (!photoHistory.some(h => (typeof h === 'string' ? h : h.photo) === photoUrl)) {
            photoHistory.unshift({
                photo: photoUrl,
                date: dateStr || new Date().toISOString().split('T')[0],
                type: 'attendance',
                label: `Foto Absensi (${dateStr || 'Hari Ini'})`
            });
        }

        const response = await fetch(`/api/students/${encodeURIComponent(studentId)}/set-profile-photo`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                photo: photoUrl,
                source: 'attendance',
                date: dateStr || new Date().toISOString().split('T')[0],
                label: `Foto Absensi (${dateStr || 'Hari Ini'})`
            })
        });

        const resData = await response.json();
        if (!response.ok || !resData.success) {
            throw new Error(resData.error || resData.message || 'Gagal mengubah foto profil.');
        }

        // Update local app state
        appState.students[stIdx].photo = photoUrl;
        appState.students[stIdx].photoHistory = resData.student?.photoHistory || photoHistory;
        appState.students[stIdx].photoUpdated = dateStr || new Date().toISOString().split('T')[0];

        if (appState.currentUser && String(appState.currentUser.id) === String(studentId)) {
            appState.currentUser.photo = photoUrl;
            appState.currentUser.photoHistory = appState.students[stIdx].photoHistory;
            if (window.persistCurrentUser) appState.currentUser = window.persistCurrentUser(appState.currentUser) || appState.currentUser;
        }

        try {
            localStorage.setItem('madrasah_students', JSON.stringify(appState.students));
        } catch (e) {}

        showToast(`Foto absensi berhasil dijadikan foto profil untuk ${student.name}!`, 'success');

        // Update action button in modal
        if (btnContainer) {
            btnContainer.innerHTML = `
                <span class="px-4 py-2.5 bg-emerald-50 text-emerald-700 font-bold rounded-2xl text-xs border border-emerald-200 flex items-center gap-1.5">
                    <i class="fa-solid fa-circle-check text-emerald-600 text-sm"></i> Sedang Digunakan Sebagai Foto Profil
                </span>
            `;
        }

        // Refresh current view in background
        const container = document.getElementById('view-container');
        if (container) {
            if (window.renderAttendanceModule && appState.currentView === 'attendance') {
                renderAttendanceModule(container);
            } else if (window.renderStudentProfile && appState.currentView === 'student_profile') {
                renderStudentProfile(container);
            } else if (window.renderStudentModule && appState.currentView === 'students') {
                renderStudentModule(container);
            }
        }
    } catch (err) {
        console.error('Gagal set foto profil dari absensi:', err);
        showToast(err.message || 'Gagal mengubah foto profil.', 'error');
        if (document.getElementById('attendance-photo-action-btn')) {
            document.getElementById('attendance-photo-action-btn').innerHTML = `
                <button type="button" onclick="setAttendancePhotoAsStudentProfile('${studentId}', '${photoUrl.replace(/'/g, "\\'")}', '${dateStr}')" class="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl text-xs transition flex items-center gap-2 cursor-pointer">
                    <i class="fa-solid fa-user-check"></i> Coba Lagi
                </button>
            `;
        }
    }
}
window.setAttendancePhotoAsStudentProfile = setAttendancePhotoAsStudentProfile;

async function reloadAuthoritativeAttendance(payload = null) {
    if (payload && Array.isArray(payload.attendance)) {
        appState.attendance = payload.attendance;
    } else {
        const response = await fetch('/api/attendance', { cache: 'no-store' });
        const data = await response.json().catch(() => null);
        if (!response.ok || !data || !data.success || !Array.isArray(data.attendance)) {
            throw new Error((data && data.message) || 'Gagal memuat ulang data absensi dari server.');
        }
        appState.attendance = data.attendance;
    }
    safeSetLocalStorage('madrasah_attendance', appState.attendance);
    return appState.attendance;
}

async function markAllStudentsPresent() {
    const selectedClassId = appState.activeAttendanceClassId;
    const selectedSubjectId = appState.activeAttendanceSubjectId || 'ALL';
    const todayIso = new Date().toISOString().split('T')[0];
    let selectedDate = appState.activeAttendanceDate || todayIso;
    if (selectedDate === 'undefined') selectedDate = todayIso;

    let students = [];
    if (selectedClassId === 'ALL') {
        students = appState.students || [];
    } else if (selectedClassId) {
        students = (appState.students || []).filter(s => String(s.classId || s.class_id) === String(selectedClassId));
    }

    const searchKeyword = appState.activeAttendanceSearch || '';
    if (searchKeyword.trim() !== '') {
        const kw = searchKeyword.toLowerCase();
        students = students.filter(s => (s.name && String(s.name).toLowerCase().includes(kw)) || (s.nis && String(s.nis).toLowerCase().includes(kw)));
    }

    if (!students || students.length === 0) {
        showToast('Tidak ada siswa untuk ditandai hadir.', 'warning');
        return;
    }

    const bulkItems = [];
    let alreadyAttendedCount = 0;

    students.forEach(st => {
        const studentId = st.id;
        const classId = st.classId || st.class_id || selectedClassId;
        const subId = (selectedSubjectId && selectedSubjectId !== 'ALL') ? selectedSubjectId : '';

        const existingAtt = (appState.attendance || []).find(a => {
            const sameStudent = (
                String(a.studentId) === String(st.id) ||
                (a.studentId && st.id && String(a.studentId).toLowerCase().trim() === String(st.id).toLowerCase().trim()) ||
                (a.studentId && st.nis && String(a.studentId).toLowerCase().trim() === String(st.nis).toLowerCase().trim()) ||
                (a.studentId && st.name && String(a.studentId).toLowerCase().trim() === String(st.name).toLowerCase().trim()) ||
                (a.studentId && st.username && String(a.studentId).toLowerCase().trim() === String(st.username).toLowerCase().trim())
            );
            const sameDate = String(a.date).substring(0, 10) === selectedDate;
            const sameSubject = selectedSubjectId && selectedSubjectId !== 'ALL'
                ? (String(a.subjectId || '') === String(selectedSubjectId) || !a.subjectId || String(a.subjectId) === 'ALL')
                : true;
            return sameStudent && sameDate && sameSubject;
        });

        if (existingAtt) {
            alreadyAttendedCount++;
            return;
        }

        bulkItems.push({
            studentId,
            classId,
            subjectId: subId,
            date: selectedDate,
            status: 'HADIR',
            location: 'Input Admin',
            photo: '',
            note: 'Input Admin'
        });
    });

    if (bulkItems.length === 0) {
        showToast(`Seluruh siswa (${alreadyAttendedCount} siswa) sudah memiliki data absensi. Tidak ada data yang ditimpa sehingga foto & lokasi tetap aman.`, 'info');
        return;
    }

    try {
        const response = await fetch('/api/attendance/bulk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items: bulkItems })
        });
        const data = await response.json().catch(() => null);
        if (!response.ok || !data || !data.success) {
            throw new Error((data && data.message) || 'Gagal menyimpan absensi massal.');
        }

        await reloadAuthoritativeAttendance();

        if (alreadyAttendedCount > 0) {
            showToast(`Berhasil menandai ${bulkItems.length} siswa yang belum absen menjadi HADIR. (${alreadyAttendedCount} siswa yang sudah absen tetap aman dengan foto & GPS aslinya).`, 'success');
        } else {
            showToast(`Berhasil menandai ${bulkItems.length} siswa menjadi HADIR!`, 'success');
        }
    } catch (err) {
        console.error('Gagal menyimpan absensi massal:', err);
        showToast(err.message || 'Gagal menyimpan absensi massal.', 'error');
    }

    refreshStudentAttendanceView();
}

async function refreshStudentAttendanceData(btn) {
    let originalHtml = "";
    if (btn) {
        originalHtml = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = `<i class="fa-solid fa-arrows-rotate animate-spin"></i><span>Menyinkronkan...</span>`;
    }
    try {
        const [stRes, attRes] = await Promise.all([
            fetch('/api/students').then(r => r.json()).catch(() => ({ success: false })),
            fetch('/api/attendance').then(r => r.json()).catch(() => ({ success: false }))
        ]);
        if (stRes && stRes.success && Array.isArray(stRes.students)) {
            appState.students = stRes.students;
        }
        if (attRes && attRes.success && Array.isArray(attRes.attendance)) {
            appState.attendance = attRes.attendance;
        }
        if (typeof showToast !== 'undefined') {
            showToast("Data absensi berhasil diperbarui!", "success");
        } else if (window.showToast) {
            window.showToast("Data absensi berhasil diperbarui!", "success");
        }
    } catch (e) {
        console.error("Gagal memperbarui data absensi:", e);
        if (typeof showToast !== 'undefined') {
            showToast("Gagal memperbarui data absensi!", "error");
        } else if (window.showToast) {
            window.showToast("Gagal memperbarui data absensi!", "error");
        }
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = originalHtml;
        }
        refreshStudentAttendanceView();
    }
}

async function markAllStudentsUnmarked() {
    const selectedClassId = appState.activeAttendanceClassId;
    const selectedSubjectId = appState.activeAttendanceSubjectId || 'ALL';
    const todayIso = new Date().toISOString().split('T')[0];
    let selectedDate = appState.activeAttendanceDate || todayIso;
    if (selectedDate === 'undefined') selectedDate = todayIso;

    let students = [];
    if (selectedClassId === 'ALL') {
        students = appState.students || [];
    } else if (selectedClassId) {
        students = (appState.students || []).filter(s => String(s.classId || s.class_id) === String(selectedClassId));
    }

    const searchKeyword = appState.activeAttendanceSearch || '';
    if (searchKeyword.trim() !== '') {
        const kw = searchKeyword.toLowerCase();
        students = students.filter(s => (s.name && String(s.name).toLowerCase().includes(kw)) || (s.nis && String(s.nis).toLowerCase().includes(kw)));
    }

    if (!students || students.length === 0) {
        showToast('Tidak ada siswa untuk ditandai belum absen.', 'warning');
        return;
    }

    try {
        const studentIds = students.map(s => s.id || s.nis).filter(Boolean);
        const response = await fetch('/api/attendance/reset', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                classId: selectedClassId,
                subjectId: selectedSubjectId,
                date: selectedDate,
                studentIds
            })
        });
        const data = await response.json().catch(() => null);
        if (!response.ok || !data || !data.success) {
            throw new Error((data && data.message) || 'Gagal mereset absensi di server.');
        }

        await reloadAuthoritativeAttendance();
        showToast(`Berhasil mereset status ${students.length} siswa menjadi BELUM ABSEN!`, 'success');
    } catch (err) {
        console.error('Gagal reset absensi:', err);
        showToast(err.message || 'Gagal mereset absensi.', 'error');
    }

    refreshStudentAttendanceView();
}

async function updateStudentAttendanceAdmin(studentId, dateStr, newStatus, attendanceId = '', selectEl = null) {
    const student = (appState.students || []).find(s =>
        String(s.id) === String(studentId) ||
        (s.nis && String(s.nis) === String(studentId)) ||
        (s.name && s.name === studentId)
    );
    const studentName = student ? student.name : studentId;
    const classId = student ? (student.classId || student.class_id) : '';
    const selectedSubjectId = appState.activeAttendanceSubjectId || 'ALL';

    if (selectEl) selectEl.disabled = true;
    try {
        const response = await fetch('/api/attendance/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                attendanceId: attendanceId || '',
                studentId: student ? (student.id || studentId) : studentId,
                classId,
                date: dateStr,
                status: newStatus,
                subjectId: selectedSubjectId
            })
        });
        const data = await response.json().catch(() => null);
        if (!response.ok || !data || !data.success) {
            throw new Error((data && data.message) || 'Gagal mengubah status absensi.');
        }

        await reloadAuthoritativeAttendance(data);
        const isReset = newStatus === 'BELUM ABSEN' || newStatus === 'BELUM HADIR' || !newStatus;
        showToast(`Status absensi ${studentName} diubah menjadi ${isReset ? 'BELUM HADIR' : newStatus}`, 'success');
    } catch (err) {
        console.error('Gagal mengubah status absensi:', err);
        showToast(err.message || 'Gagal mengubah status absensi.', 'error');
    } finally {
        if (selectEl) selectEl.disabled = false;
        refreshStudentAttendanceView();
    }
}

function renderAttendanceModule(container) {
    if (!container) container = document.getElementById('view-container');

    // Auto-refresh students & attendance data from server in background
    Promise.all([
        fetch('/api/students').then(r => r.json()).catch(() => ({ success: false })),
        fetch('/api/attendance').then(r => r.json()).catch(() => ({ success: false }))
    ]).then(([stRes, attRes]) => {
        let needsRerender = false;
        if (stRes && stRes.success && Array.isArray(stRes.students)) {
            appState.students = stRes.students;
            needsRerender = true;
        }
        if (attRes && attRes.success && Array.isArray(attRes.attendance)) {
            appState.attendance = attRes.attendance;
            needsRerender = true;
        }
        if (needsRerender) {
            const activeContent = document.getElementById('attendance-content-area');
            if (activeContent) {
                const currentSubTab = appState.activeAttendanceSubTab || 'murid';
                if (currentSubTab === 'guru' && typeof renderTeacherAttendanceAdmin === 'function') {
                    renderTeacherAttendanceAdmin(activeContent);
                } else {
                    renderStudentAttendanceAdminOnly(activeContent);
                }
            }
        }
    }).catch(() => {});

    const role = String(appState.role || '').toLowerCase().trim();
    if (role === 'admin') {
        const subTab = appState.activeAttendanceSubTab || 'murid';
        container.innerHTML = `
            <div class="space-y-6 pb-8 animate-fade-in">
                <!-- Navigation Tabs with elegant high contrast design -->
                <div class="flex border-b border-slate-200 gap-6">
                    <button type="button" onclick="appState.activeAttendanceSubTab = 'murid'; renderAttendanceModule(document.getElementById('view-container'))" class="pb-3 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 transition cursor-pointer ${subTab === 'murid' ? 'border-emerald-600 text-emerald-600 font-extrabold' : 'border-transparent text-slate-400 hover:text-slate-600'}" id="btn-tab-murid">
                        <i class="fa-solid fa-user-graduate"></i> Absensi Murid (Siswa)
                    </button>
                    <button type="button" onclick="appState.activeAttendanceSubTab = 'guru'; renderAttendanceModule(document.getElementById('view-container'))" class="pb-3 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 transition cursor-pointer ${subTab === 'guru' ? 'border-emerald-600 text-emerald-600 font-extrabold' : 'border-transparent text-slate-400 hover:text-slate-600'}" id="btn-tab-guru">
                        <i class="fa-solid fa-chalkboard-user"></i> Absensi Dewan Guru
                    </button>
                </div>

                <div id="attendance-content-area" class="min-h-[400px]"></div>
            </div>
        `;
        const contentArea = document.getElementById('attendance-content-area');
        if (subTab === 'guru') {
            if (typeof renderTeacherAttendanceAdmin === 'function') {
                renderTeacherAttendanceAdmin(contentArea);
            } else {
                contentArea.innerHTML = `<div class="bg-white p-12 rounded-3xl text-center text-slate-400 text-sm border">Modul Absensi Guru Belum Dimuat.</div>`;
            }
        } else {
            renderStudentAttendanceAdminOnly(contentArea);
        }
    } else {
        container.innerHTML = `
            <div class="space-y-6 pb-8 animate-fade-in">
                <div id="attendance-content-area" class="min-h-[400px]"></div>
            </div>
        `;
        const contentArea = document.getElementById('attendance-content-area');
        renderStudentAttendanceAdminOnly(contentArea);
    }
}

function getAttendanceStatusInfo(rawStatus) {
    if (!rawStatus) return { type: 'NONE', symbolText: '-', symbolHtmlWord: '<span style="color: #94a3b8;">-</span>', symbolHtmlPrint: '<span style="color: #94a3b8;">-</span>', label: 'Belum Absen' };
    const s = String(rawStatus).trim().toUpperCase();
    if (s === 'HADIR' || s === 'H' || s === 'PRESENT') {
        return {
            type: 'HADIR',
            symbolText: '✓',
            symbolHtmlWord: '<span style="color: #15803d; font-weight: bold; font-size: 10.5pt;">&#10004;</span>',
            symbolHtmlPrint: '<span style="color: #15803d; font-weight: bold; font-size: 10pt;">✓</span>',
            label: 'Hadir'
        };
    }
    if (s === 'IZIN' || s === 'I' || s === 'IJIN' || s === 'PERMIT') {
        return {
            type: 'IZIN',
            symbolText: 'I',
            symbolHtmlWord: '<span style="color: #1d4ed8; font-weight: bold; font-size: 10pt;">I</span>',
            symbolHtmlPrint: '<span style="color: #1d4ed8; font-weight: bold; font-size: 9.5pt;">I</span>',
            label: 'Izin'
        };
    }
    if (s === 'SAKIT' || s === 'S' || s === 'SICK') {
        return {
            type: 'SAKIT',
            symbolText: 'S',
            symbolHtmlWord: '<span style="color: #b45309; font-weight: bold; font-size: 10pt;">S</span>',
            symbolHtmlPrint: '<span style="color: #b45309; font-weight: bold; font-size: 9.5pt;">S</span>',
            label: 'Sakit'
        };
    }
    if (s === 'ALPA' || s === 'A' || s === 'ALPHA' || s === 'TIDAK HADIR' || s === 'ABSENT') {
        return {
            type: 'ALPA',
            symbolText: 'A',
            symbolHtmlWord: '<span style="color: #b91c1c; font-weight: bold; font-size: 10pt;">A</span>',
            symbolHtmlPrint: '<span style="color: #b91c1c; font-weight: bold; font-size: 9.5pt;">A</span>',
            label: 'Alpa'
        };
    }
    return { type: 'NONE', symbolText: '-', symbolHtmlWord: '<span style="color: #94a3b8;">-</span>', symbolHtmlPrint: '<span style="color: #94a3b8;">-</span>', label: 'Belum Absen' };
}

function getAttendanceRecapData(targetMonth) {
    const selectedClassId = appState.activeAttendanceClassId || '';
    const selectedSubjectId = appState.activeAttendanceSubjectId || 'ALL';
    const searchKeyword = appState.activeAttendanceSearch || '';

    const currentSubObj = (appState.subjects || []).find(s => String(s.id) === String(selectedSubjectId));
    const subjectLabel = currentSubObj ? currentSubObj.name : (selectedSubjectId === 'ALL' ? 'Semua Mata Pelajaran' : 'Mapel');

    let students = [];
    let classNameLabel = 'Semua Kelas';
    let homeroomTeacherName = 'Wali Kelas';

    if (selectedClassId === 'ALL') {
        students = appState.students || [];
        classNameLabel = 'Semua Kelas';
    } else if (selectedClassId) {
        const clsObj = (appState.classes || []).find(c => String(c.id) === String(selectedClassId));
        classNameLabel = clsObj ? clsObj.name : 'Kelas';
        if (clsObj && clsObj.teacherId) {
            const tObj = (appState.teachers || []).find(t => String(t.id) === String(clsObj.teacherId));
            if (tObj) homeroomTeacherName = tObj.name;
        }
        students = (appState.students || []).filter(s => String(s.classId || s.class_id) === String(selectedClassId));
    }

    if (searchKeyword.trim() !== '') {
        const kw = searchKeyword.toLowerCase();
        students = students.filter(s => (s.name && String(s.name).toLowerCase().includes(kw)) || (s.nis && String(s.nis).toLowerCase().includes(kw)));
    }
    students = sortStudentsByNis(students);

    // Determine days in month
    const [yearStr, monthStr] = targetMonth.split('-');
    const year = parseInt(yearStr, 10) || new Date().getFullYear();
    const month = parseInt(monthStr, 10) || (new Date().getMonth() + 1);
    const daysInMonth = new Date(year, month, 0).getDate();

    const indonesianMonths = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    const monthNameIndo = `${indonesianMonths[month - 1] || 'Bulan'} ${year}`;

    const allAttendance = appState.attendance || [];
    const monthAttendance = allAttendance.filter(a => {
        if (!a || !a.date) return false;
        const matchMonth = String(a.date).substring(0, 7) === targetMonth;
        let matchSub = true;
        if (selectedSubjectId && selectedSubjectId !== 'ALL') {
            matchSub = String(a.subjectId || '') === String(selectedSubjectId) || !a.subjectId || String(a.subjectId) === 'ALL';
        }
        return matchMonth && matchSub;
    });

    // Initialize daily counts for footer
    const dayStats = {};
    for (let d = 1; d <= daysInMonth; d++) {
        dayStats[d] = { hadir: 0, izin: 0, sakit: 0, alpa: 0 };
    }

    let grandTotalHadir = 0;
    let grandTotalIzin = 0;
    let grandTotalSakit = 0;
    let grandTotalAlpa = 0;

    const studentRows = students.map((st, idx) => {
        const studentAtts = monthAttendance.filter(a => {
            return (
                String(a.studentId) === String(st.id) ||
                (a.studentId && st.id && String(a.studentId).toLowerCase().trim() === String(st.id).toLowerCase().trim()) ||
                (a.studentId && st.nis && String(a.studentId).toLowerCase().trim() === String(st.nis).toLowerCase().trim()) ||
                (a.studentId && st.name && String(a.studentId).toLowerCase().trim() === String(st.name).toLowerCase().trim()) ||
                (a.studentId && st.username && String(a.studentId).toLowerCase().trim() === String(st.username).toLowerCase().trim())
            );
        });

        let countH = 0;
        let countI = 0;
        let countS = 0;
        let countA = 0;

        const dayValues = [];

        for (let d = 1; d <= daysInMonth; d++) {
            const dayStr = String(d).padStart(2, '0');
            const fullDateStr = `${targetMonth}-${dayStr}`;
            const att = studentAtts.slice().reverse().find(a => String(a.date).substring(0, 10) === fullDateStr);

            const statusInfo = getAttendanceStatusInfo(att ? att.status : null);
            if (statusInfo.type === 'HADIR') {
                countH++;
                dayStats[d].hadir++;
                grandTotalHadir++;
            } else if (statusInfo.type === 'IZIN') {
                countI++;
                dayStats[d].izin++;
                grandTotalIzin++;
            } else if (statusInfo.type === 'SAKIT') {
                countS++;
                dayStats[d].sakit++;
                grandTotalSakit++;
            } else if (statusInfo.type === 'ALPA') {
                countA++;
                dayStats[d].alpa++;
                grandTotalAlpa++;
            }

            dayValues.push({
                day: d,
                fullDate: fullDateStr,
                statusInfo,
                att
            });
        }

        const totalRecorded = countH + countI + countS + countA;
        const percentage = totalRecorded > 0 ? Math.round((countH / totalRecorded) * 100) : '-';

        return {
            no: idx + 1,
            student: st,
            dayValues,
            countH,
            countI,
            countS,
            countA,
            totalRecorded,
            percentage,
            lastPhotoAtt: studentAtts.filter(a => a.photo && a.photo.trim() !== '').sort((a, b) => new Date(b.date) - new Date(a.date))[0] || null
        };
    });

    const totalStudents = students.length;
    const totalAllRecorded = grandTotalHadir + grandTotalIzin + grandTotalSakit + grandTotalAlpa;
    const overallClassPercent = totalAllRecorded > 0 ? Math.round((grandTotalHadir / totalAllRecorded) * 100) : '-';

    return {
        targetMonth,
        monthNameIndo,
        year,
        daysInMonth,
        classNameLabel,
        subjectLabel,
        homeroomTeacherName,
        students,
        studentRows,
        dayStats,
        grandTotalHadir,
        grandTotalIzin,
        grandTotalSakit,
        grandTotalAlpa,
        totalStudents,
        overallClassPercent,
        settings: appState.settings || {}
    };
}

function openPrintAttendanceModal() {
    const modal = document.getElementById('modal-container');
    const currentMonth = new Date().toISOString().substring(0, 7);
    const selectedClassId = appState.activeAttendanceClassId || '';
    const clsObj = (appState.classes || []).find(c => String(c.id) === String(selectedClassId));
    const className = clsObj ? clsObj.name : (selectedClassId === 'ALL' ? 'Semua Kelas' : 'Pilih Kelas Terlebih Dahulu');

    modal.innerHTML = `
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
            <div class="bg-white w-full max-w-md rounded-3xl shadow-2xl p-6 space-y-4 border border-slate-100">
                <div class="flex justify-between items-center pb-3 border-b border-slate-100">
                    <div class="flex items-center gap-2.5">
                        <div class="w-9 h-9 bg-indigo-100 text-indigo-700 rounded-xl flex items-center justify-center">
                            <i class="fa-solid fa-print"></i>
                        </div>
                        <div>
                            <h3 class="font-bold text-slate-800 text-sm">Cetak Rekapitulasi Absensi</h3>
                            <p class="text-[11px] text-slate-400">Kelas: <span class="font-semibold text-slate-700">${className}</span></p>
                        </div>
                    </div>
                    <button type="button" onclick="closeModal()" class="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition cursor-pointer">
                        <i class="fa-solid fa-xmark text-sm"></i>
                    </button>
                </div>

                <div class="space-y-4">
                    <div class="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80">
                        <label class="block text-[11px] uppercase font-bold text-slate-600 mb-1.5 flex items-center gap-1.5">
                            <i class="fa-regular fa-calendar text-indigo-600"></i>
                            <span>Pilih Bulan Rekapitulasi</span>
                        </label>
                        <input type="month" id="print-att-month" value="${currentMonth}" class="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    </div>

                    <div class="bg-indigo-50/70 p-3 rounded-2xl border border-indigo-100 text-[11px] text-indigo-900 space-y-1">
                        <div class="font-bold flex items-center gap-1.5 text-indigo-950">
                            <i class="fa-solid fa-circle-check text-indigo-600"></i>
                            <span>Fitur Rekap Lengkap:</span>
                        </div>
                        <p class="text-indigo-800/90 leading-relaxed pl-4">
                            Mencantumkan simbol kehadiran presisi (<strong>✓</strong> Hadir, <strong>I</strong> Izin, <strong>S</strong> Sakit, <strong>A</strong> Alpa), total akumulasi per siswa, rekap harian kelas, serta kolom persentase resmi.
                        </p>
                    </div>

                    <div class="space-y-2.5 pt-1">
                        <button type="button" onclick="executeDirectPrintAttendance()" class="w-full py-3 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white font-bold rounded-2xl text-xs shadow-md shadow-indigo-600/20 transition flex items-center justify-center gap-2 cursor-pointer">
                            <i class="fa-solid fa-print text-sm"></i>
                            <span>Cetak Langsung / Simpan PDF (Landscape)</span>
                        </button>

                        <button type="button" onclick="executePrintAttendance(true)" class="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-bold rounded-2xl text-xs shadow-xs transition flex items-center justify-center gap-2 cursor-pointer">
                            <i class="fa-solid fa-file-word text-sm"></i>
                            <span>Cetak Word (.doc) + Lampiran Foto Selfie</span>
                        </button>

                        <button type="button" onclick="executePrintAttendance(false)" class="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-2xl text-xs transition flex items-center justify-center gap-2 cursor-pointer">
                            <i class="fa-regular fa-file-word text-sm text-slate-600"></i>
                            <span>Cetak Word (.doc) Format Ringkas (Tanpa Foto)</span>
                        </button>

                        <button type="button" onclick="executeExportExcelAttendance()" class="w-full py-2.5 bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 font-bold rounded-2xl text-xs transition flex items-center justify-center gap-2 cursor-pointer">
                            <i class="fa-solid fa-file-excel text-sm text-teal-600"></i>
                            <span>Ekspor Data Rekap Excel (.xlsx)</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function executeDirectPrintAttendance() {
    const targetMonth = document.getElementById('print-att-month')?.value || new Date().toISOString().substring(0, 7);
    const data = getAttendanceRecapData(targetMonth);

    let headersHtml = '';
    for (let d = 1; d <= data.daysInMonth; d++) {
        headersHtml += `<th style="width: 22px; text-align: center; border: 1px solid #475569; font-size: 8pt; padding: 2px 1px; background-color: #f1f5f9;">${d}</th>`;
    }

    let rowsHtml = '';
    data.studentRows.forEach((r) => {
        let daysCells = '';
        r.dayValues.forEach(dv => {
            const sym = dv.statusInfo.symbolHtmlPrint;
            daysCells += `<td style="border: 1px solid #64748b; text-align: center; padding: 2px 1px; font-size: 8pt;">${sym}</td>`;
        });

        rowsHtml += `
            <tr>
                <td style="border: 1px solid #64748b; padding: 3px 2px; text-align: center; font-size: 8.5pt;">${r.no}</td>
                <td style="border: 1px solid #64748b; padding: 3px 4px; font-size: 8.5pt; font-family: monospace; white-space: nowrap;">${r.student.nis || '-'}</td>
                <td style="border: 1px solid #64748b; padding: 3px 4px; font-weight: bold; font-size: 8.5pt; text-align: left; white-space: nowrap;">${r.student.name || '-'}</td>
                ${daysCells}
                <td style="border: 1px solid #64748b; text-align: center; font-weight: bold; font-size: 8.5pt; color: #b45309; background-color: #fffbeb;">${r.countS}</td>
                <td style="border: 1px solid #64748b; text-align: center; font-weight: bold; font-size: 8.5pt; color: #1d4ed8; background-color: #eff6ff;">${r.countI}</td>
                <td style="border: 1px solid #64748b; text-align: center; font-weight: bold; font-size: 8.5pt; color: #b91c1c; background-color: #fef2f2;">${r.countA}</td>
            </tr>
        `;
    });

    // Daily totals footer (S, I, A only)
    let footerSakitCells = '';
    let footerIzinCells = '';
    let footerAlpaCells = '';

    for (let d = 1; d <= data.daysInMonth; d++) {
        footerSakitCells += `<td style="border: 1px solid #64748b; text-align: center; font-weight: bold; font-size: 7.5pt; color: #b45309; background-color: #fffbeb;">${data.dayStats[d].sakit || 0}</td>`;
        footerIzinCells += `<td style="border: 1px solid #64748b; text-align: center; font-weight: bold; font-size: 7.5pt; color: #1d4ed8; background-color: #eff6ff;">${data.dayStats[d].izin || 0}</td>`;
        footerAlpaCells += `<td style="border: 1px solid #64748b; text-align: center; font-weight: bold; font-size: 7.5pt; color: #b91c1c; background-color: #fef2f2;">${data.dayStats[d].alpa || 0}</td>`;
    }

    const footersHtml = `
        <tr style="background-color: #f8fafc; font-weight: bold;">
            <td colspan="3" style="border: 1px solid #64748b; padding: 3px 6px; text-align: right; font-size: 8pt; color: #b45309;">Jumlah Sakit (S) :</td>
            ${footerSakitCells}
            <td style="border: 1px solid #64748b; text-align: center; font-weight: bold; font-size: 8.5pt; color: #b45309; background-color: #fef3c7;">${data.grandTotalSakit}</td>
            <td style="border: 1px solid #64748b; text-align: center; font-size: 8pt; color: #94a3b8;">-</td>
            <td style="border: 1px solid #64748b; text-align: center; font-size: 8pt; color: #94a3b8;">-</td>
        </tr>
        <tr style="background-color: #f8fafc; font-weight: bold;">
            <td colspan="3" style="border: 1px solid #64748b; padding: 3px 6px; text-align: right; font-size: 8pt; color: #1d4ed8;">Jumlah Izin (I) :</td>
            ${footerIzinCells}
            <td style="border: 1px solid #64748b; text-align: center; font-size: 8pt; color: #94a3b8;">-</td>
            <td style="border: 1px solid #64748b; text-align: center; font-weight: bold; font-size: 8.5pt; color: #1d4ed8; background-color: #dbeafe;">${data.grandTotalIzin}</td>
            <td style="border: 1px solid #64748b; text-align: center; font-size: 8pt; color: #94a3b8;">-</td>
        </tr>
        <tr style="background-color: #f8fafc; font-weight: bold;">
            <td colspan="3" style="border: 1px solid #64748b; padding: 3px 6px; text-align: right; font-size: 8pt; color: #b91c1c;">Jumlah Alpa (A) :</td>
            ${footerAlpaCells}
            <td style="border: 1px solid #64748b; text-align: center; font-size: 8pt; color: #94a3b8;">-</td>
            <td style="border: 1px solid #64748b; text-align: center; font-size: 8pt; color: #94a3b8;">-</td>
            <td style="border: 1px solid #64748b; text-align: center; font-weight: bold; font-size: 8.5pt; color: #b91c1c; background-color: #fee2e2;">${data.grandTotalAlpa}</td>
        </tr>
    `;

    const printHtml = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>Rekapitulasi Absensi ${data.classNameLabel} - ${data.monthNameIndo}</title>
            <style>
                @page {
                    size: landscape;
                    margin: 8mm 6mm;
                }
                @media print {
                    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                    .no-print { display: none !important; }
                }
                body {
                    font-family: 'Times New Roman', Times, serif;
                    margin: 0;
                    padding: 8px 12px;
                    color: #0f172a;
                    background-color: #ffffff;
                }
                .kop-container {
                    text-align: center;
                    border-bottom: 3px double #000000;
                    padding-bottom: 6px;
                    margin-bottom: 10px;
                }
                .kop-line1 { font-size: 11pt; font-weight: bold; text-transform: uppercase; margin: 0; }
                .kop-line2 { font-size: 13pt; font-weight: 900; text-transform: uppercase; margin: 2px 0; color: #047857; }
                .kop-line3 { font-size: 8.5pt; font-style: italic; color: #334155; margin: 0; }
                .meta-table { width: 100%; margin-bottom: 8px; font-size: 9pt; border-collapse: collapse; }
                .meta-table td { padding: 2px 4px; }
                table.rekap-table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 8pt;
                    table-layout: auto;
                }
                table.rekap-table th, table.rekap-table td {
                    border: 1px solid #475569;
                    padding: 2.5px 2px;
                }
                table.rekap-table th {
                    background-color: #f1f5f9;
                    font-weight: bold;
                    color: #0f172a;
                    text-align: center;
                }
                .legend-box {
                    margin-top: 12px;
                    display: flex;
                    justify-content: space-between;
                    font-size: 8pt;
                }
                .legend-table {
                    border-collapse: collapse;
                    font-size: 8pt;
                }
                .legend-table td {
                    padding: 2px 6px;
                    border: 1px solid #94a3b8;
                }
                .sig-box {
                    width: 100%;
                    margin-top: 20px;
                    display: flex;
                    justify-content: space-between;
                    font-size: 9pt;
                    page-break-inside: avoid;
                }
                .sig-col {
                    text-align: center;
                    width: 250px;
                }
            </style>
        </head>
        <body>
            <div class="no-print" style="background: #e0e7ff; color: #3730a3; padding: 8px 16px; border-radius: 8px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center;">
                <span style="font-family: sans-serif; font-size: 12px; font-weight: bold;">Dokumen Rekapitulasi Siap Dicetak (Format Landscape)</span>
                <div>
                    <button onclick="window.print()" style="background: #4f46e5; color: #ffffff; border: none; padding: 6px 14px; border-radius: 6px; font-weight: bold; cursor: pointer; font-family: sans-serif; font-size: 12px;">Cetak Dokumen</button>
                    <button onclick="window.close()" style="background: #94a3b8; color: #ffffff; border: none; padding: 6px 14px; border-radius: 6px; font-weight: bold; cursor: pointer; font-family: sans-serif; font-size: 12px; margin-left: 6px;">Tutup</button>
                </div>
            </div>

            <div class="kop-container">
                <div class="kop-line1">${data.settings.kopLine1 || 'KEMENTERIAN AGAMA REPUBLIK INDONESIA'}</div>
                <div class="kop-line2">${data.settings.schoolName || 'MADRASAH ALIYAH'}</div>
                <div class="kop-line3">${data.settings.schoolAddress || 'Alamat Madrasah'} ${data.settings.schoolPhone ? '| Telp: ' + data.settings.schoolPhone : ''}</div>
            </div>

            <table class="meta-table">
                <tr>
                    <td style="width: 50%;"><strong>REKAPITULASI PRESENSI SISWA BULANAN</strong></td>
                    <td style="text-align: right;"><strong>Bulan:</strong> ${data.monthNameIndo}</td>
                </tr>
                <tr>
                    <td><strong>Kelas:</strong> ${data.classNameLabel} &nbsp;&nbsp;|&nbsp;&nbsp; <strong>Mata Pelajaran:</strong> ${data.subjectLabel}</td>
                    <td style="text-align: right;"><strong>Tahun Pelajaran:</strong> ${data.settings.academicYear || (data.year + '/' + (data.year + 1))}</td>
                </tr>
            </table>

            <table class="rekap-table">
                <thead>
                    <tr>
                        <th rowspan="2" style="width: 25px;">No</th>
                        <th rowspan="2" style="width: 55px;">NIS</th>
                        <th rowspan="2" style="width: 140px; text-align: left; padding-left: 4px;">Nama Siswa</th>
                        <th colspan="${data.daysInMonth}">Tanggal Presensi (1 s/d ${data.daysInMonth})</th>
                        <th colspan="3" style="background-color: #e2e8f0;">Total Rekap</th>
                    </tr>
                    <tr>
                        ${headersHtml}
                        <th style="width: 22px; background-color: #fef3c7; color: #b45309;">S</th>
                        <th style="width: 22px; background-color: #dbeafe; color: #1d4ed8;">I</th>
                        <th style="width: 22px; background-color: #fee2e2; color: #b91c1c;">A</th>
                    </tr>
                </thead>
                <tbody>
                    ${rowsHtml}
                </tbody>
                <tfoot>
                    ${footersHtml}
                </tfoot>
            </table>

            <div class="legend-box">
                <div style="width: 58%;">
                    <div style="font-weight: bold; margin-bottom: 3px; font-size: 8pt;">KETERANGAN SIMBOL ABSENSI:</div>
                    <table class="legend-table">
                        <tr>
                            <td style="background-color: #f0fdf4; font-weight: bold; color: #15803d; text-align: center; width: 25px;">✓</td>
                            <td><strong>Hadir:</strong> Siswa hadir mengikuti kegiatan belajar</td>
                            <td style="background-color: #fffbeb; font-weight: bold; color: #b45309; text-align: center; width: 25px;">S</td>
                            <td><strong>Sakit:</strong> Siswa berhalangan dengan surat sakit</td>
                        </tr>
                        <tr>
                            <td style="background-color: #eff6ff; font-weight: bold; color: #1d4ed8; text-align: center; width: 25px;">I</td>
                            <td><strong>Izin:</strong> Siswa berhalangan dengan surat izin</td>
                            <td style="background-color: #fef2f2; font-weight: bold; color: #b91c1c; text-align: center; width: 25px;">A</td>
                            <td><strong>Alpa:</strong> Siswa tidak hadir tanpa keterangan</td>
                        </tr>
                    </table>
                </div>
                <div style="width: 38%; background-color: #f8fafc; border: 1px solid #cbd5e1; padding: 4px 8px; border-radius: 4px;">
                    <div style="font-weight: bold; margin-bottom: 2px;">RINGKASAN AKUMULASI KELAS:</div>
                    <table style="width: 100%; font-size: 7.5pt; border-collapse: collapse;">
                        <tr>
                            <td>Jumlah Siswa: <strong>${data.totalStudents} Siswa</strong></td>
                            <td>Total Sakit (S): <strong style="color: #b45309;">${data.grandTotalSakit} kali</strong></td>
                        </tr>
                        <tr>
                            <td>Total Izin (I): <strong style="color: #1d4ed8;">${data.grandTotalIzin} kali</strong></td>
                            <td>Total Alpa (A): <strong style="color: #b91c1c;">${data.grandTotalAlpa} kali</strong></td>
                        </tr>
                    </table>
                </div>
            </div>

            <div class="sig-box">
                <div class="sig-col">
                    <div>Mengetahui,</div>
                    <div style="font-weight: bold;">Kepala Madrasah</div>
                    <div style="height: 45px;"></div>
                    <div style="font-weight: bold; text-decoration: underline;">${data.settings.headmaster || 'Kepala Madrasah'}</div>
                    <div style="font-size: 8pt; color: #475569;">${data.settings.headmasterNip ? 'NIP. ' + data.settings.headmasterNip : ''}</div>
                </div>
                <div class="sig-col">
                    <div>${data.settings.schoolCity || 'Madrasah'}, ${new Date().getDate()} ${data.monthNameIndo}</div>
                    <div style="font-weight: bold;">Wali Kelas / Guru Pengampu</div>
                    <div style="height: 45px;"></div>
                    <div style="font-weight: bold; text-decoration: underline;">${data.homeroomTeacherName}</div>
                    <div style="font-size: 8pt; color: #475569;">NIP. .................................................</div>
                </div>
            </div>

            <script>
                window.onload = function() {
                    setTimeout(function() {
                        window.print();
                    }, 400);
                };
            </script>
        </body>
        </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
        printWindow.document.open();
        printWindow.document.write(printHtml);
        printWindow.document.close();
        closeModal();
        showToast('Jendela cetak rekap absensi berhasil dibuka!', 'success');
    } else {
        // Fallback using iframe if popup is blocked
        const printIframe = document.createElement('iframe');
        printIframe.style.position = 'fixed';
        printIframe.style.right = '0';
        printIframe.style.bottom = '0';
        printIframe.style.width = '0';
        printIframe.style.height = '0';
        printIframe.style.border = '0';
        document.body.appendChild(printIframe);
        printIframe.contentWindow.document.open();
        printIframe.contentWindow.document.write(printHtml);
        printIframe.contentWindow.document.close();
        setTimeout(() => {
            printIframe.contentWindow.focus();
            printIframe.contentWindow.print();
            setTimeout(() => { document.body.removeChild(printIframe); }, 2000);
        }, 500);
        closeModal();
        showToast('Memulai proses cetak rekap absensi...', 'success');
    }
}

function executePrintAttendance(includePhoto) {
    const targetMonth = document.getElementById('print-att-month')?.value || new Date().toISOString().substring(0, 7);
    const data = getAttendanceRecapData(targetMonth);

    let headersHtml = '';
    for (let d = 1; d <= data.daysInMonth; d++) {
        headersHtml += `<th style="width: 24px; text-align: center; border: 1px solid #cbd5e1; font-size: 8.5pt; padding: 3px 1px; background-color: #f1f5f9;">${d}</th>`;
    }

    let rowsHtml = '';
    data.studentRows.forEach((r) => {
        let daysCells = '';
        r.dayValues.forEach(dv => {
            const sym = dv.statusInfo.symbolHtmlWord;
            daysCells += `<td style="border: 1px solid #cbd5e1; text-align: center; padding: 3px 1px; font-size: 8.5pt;">${sym}</td>`;
        });

        rowsHtml += `
            <tr>
                <td style="border: 1px solid #cbd5e1; padding: 4px 2px; text-align: center; font-size: 9pt;">${r.no}</td>
                <td style="border: 1px solid #cbd5e1; padding: 4px; font-size: 9pt; white-space: nowrap;">${r.student.nis || '-'}</td>
                <td style="border: 1px solid #cbd5e1; padding: 4px; font-weight: bold; font-size: 9pt; white-space: nowrap; text-align: left;">${r.student.name || '-'}</td>
                ${daysCells}
                <td style="border: 1px solid #cbd5e1; text-align: center; font-weight: bold; font-size: 9pt; color: #b45309; background-color: #fffbeb;">${r.countS}</td>
                <td style="border: 1px solid #cbd5e1; text-align: center; font-weight: bold; font-size: 9pt; color: #1d4ed8; background-color: #eff6ff;">${r.countI}</td>
                <td style="border: 1px solid #cbd5e1; text-align: center; font-weight: bold; font-size: 9pt; color: #b91c1c; background-color: #fef2f2;">${r.countA}</td>
            </tr>
        `;
    });

    // Daily totals footer (S, I, A only)
    let footerSakitCells = '';
    let footerIzinCells = '';
    let footerAlpaCells = '';

    for (let d = 1; d <= data.daysInMonth; d++) {
        footerSakitCells += `<td style="border: 1px solid #cbd5e1; text-align: center; font-weight: bold; font-size: 8pt; color: #b45309; background-color: #fffbeb;">${data.dayStats[d].sakit || 0}</td>`;
        footerIzinCells += `<td style="border: 1px solid #cbd5e1; text-align: center; font-weight: bold; font-size: 8pt; color: #1d4ed8; background-color: #eff6ff;">${data.dayStats[d].izin || 0}</td>`;
        footerAlpaCells += `<td style="border: 1px solid #cbd5e1; text-align: center; font-weight: bold; font-size: 8pt; color: #b91c1c; background-color: #fef2f2;">${data.dayStats[d].alpa || 0}</td>`;
    }

    const footersHtml = `
        <tr style="background-color: #f8fafc; font-weight: bold;">
            <td colspan="3" style="border: 1px solid #cbd5e1; padding: 4px 6px; text-align: right; font-size: 8.5pt; color: #b45309;">Jumlah Sakit (S) :</td>
            ${footerSakitCells}
            <td style="border: 1px solid #cbd5e1; text-align: center; font-weight: bold; font-size: 9pt; color: #b45309; background-color: #fef3c7;">${data.grandTotalSakit}</td>
            <td style="border: 1px solid #cbd5e1; text-align: center; font-size: 8.5pt; color: #94a3b8;">-</td>
            <td style="border: 1px solid #cbd5e1; text-align: center; font-size: 8.5pt; color: #94a3b8;">-</td>
        </tr>
        <tr style="background-color: #f8fafc; font-weight: bold;">
            <td colspan="3" style="border: 1px solid #cbd5e1; padding: 4px 6px; text-align: right; font-size: 8.5pt; color: #1d4ed8;">Jumlah Izin (I) :</td>
            ${footerIzinCells}
            <td style="border: 1px solid #cbd5e1; text-align: center; font-size: 8.5pt; color: #94a3b8;">-</td>
            <td style="border: 1px solid #cbd5e1; text-align: center; font-weight: bold; font-size: 9pt; color: #1d4ed8; background-color: #dbeafe;">${data.grandTotalIzin}</td>
            <td style="border: 1px solid #cbd5e1; text-align: center; font-size: 8.5pt; color: #94a3b8;">-</td>
        </tr>
        <tr style="background-color: #f8fafc; font-weight: bold;">
            <td colspan="3" style="border: 1px solid #cbd5e1; padding: 4px 6px; text-align: right; font-size: 8.5pt; color: #b91c1c;">Jumlah Alpa (A) :</td>
            ${footerAlpaCells}
            <td style="border: 1px solid #cbd5e1; text-align: center; font-size: 8.5pt; color: #94a3b8;">-</td>
            <td style="border: 1px solid #cbd5e1; text-align: center; font-size: 8.5pt; color: #94a3b8;">-</td>
            <td style="border: 1px solid #cbd5e1; text-align: center; font-weight: bold; font-size: 9pt; color: #b91c1c; background-color: #fee2e2;">${data.grandTotalAlpa}</td>
        </tr>
    `;

    let photosHtml = '';
    if (includePhoto) {
        let photoCards = '';
        data.studentRows.forEach((r) => {
            if (r.lastPhotoAtt && r.lastPhotoAtt.photo) {
                photoCards += `
                    <div style="display: inline-block; width: 130px; text-align: center; margin: 8px; vertical-align: top; border: 1px solid #cbd5e1; padding: 6px; border-radius: 6px; background: #ffffff;">
                        <img src="${window.getPhotoHtmlSrc ? window.getPhotoHtmlSrc(r.lastPhotoAtt.photo) : ''}" width="110" height="130" style="object-fit: cover; border-radius: 4px; margin-bottom: 4px;" />
                        <div style="font-size: 9pt; font-weight: bold; color: #1e293b; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${r.student.name}</div>
                        <div style="font-size: 8pt; color: #64748b;">${r.student.nis || '-'}</div>
                        <div style="font-size: 7.5pt; color: #94a3b8; margin-top: 2px;">Absen: ${String(r.lastPhotoAtt.date).substring(0, 10)}</div>
                    </div>
                `;
            }
        });

        if (photoCards) {
            photosHtml = `
                <br style="page-break-before: always;" />
                <h3 style="margin-top: 30px; text-align: left; color: #1e293b; font-size: 11pt; border-bottom: 1px solid #94a3b8; padding-bottom: 4px;">LAMPIRAN FOTO ABSENSI TERAKHIR SISWA (BULAN: ${data.monthNameIndo})</h3>
                <div style="margin-top: 10px; text-align: left;">
                    ${photoCards}
                </div>
            `;
        }
    }

    const htmlContent = `
        <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
        <head>
            <meta charset='utf-8'>
            <title>Rekap Absensi Bulanan</title>
            <!--[if gte mso 9]>
            <xml>
                <w:WordDocument>
                    <w:View>Print</w:View>
                    <w:Zoom>100</w:Zoom>
                    <w:DoNotOptimizeForBrowser/>
                </w:WordDocument>
            </xml>
            <![endif]-->
            <style>
                @page Section1 {
                    size: 841.7pt 595.7pt;
                    mso-page-orientation: landscape;
                    margin: 1.5cm 1cm 1.5cm 1cm;
                }
                div.Section1 {
                    page: Section1;
                }
                body { font-family: 'Times New Roman', Times, serif; margin: 0; color: #000000; }
                .kop { text-align: center; border-bottom: 3px double #000000; padding-bottom: 6px; margin-bottom: 12px; }
                .kop h2 { margin: 0; font-size: 13pt; text-transform: uppercase; }
                .kop h1 { margin: 2px 0; font-size: 15pt; text-transform: uppercase; color: #065f46; font-weight: bold; }
                .kop p { margin: 0; font-size: 9pt; font-style: italic; color: #334155; }
                table.meta { width: 100%; border-collapse: collapse; margin-bottom: 8px; font-size: 10pt; }
                table.rekap { width: 100%; border-collapse: collapse; margin-top: 5px; table-layout: fixed; }
                table.rekap th { background-color: #f1f5f9; color: #000000; border: 1px solid #cbd5e1; padding: 4px 2px; font-size: 8.5pt; text-align: center; }
                table.rekap td { border: 1px solid #cbd5e1; padding: 3px 2px; font-size: 8.5pt; }
            </style>
        </head>
        <body>
        <div class="Section1">
            <div class="kop">
                <h2>${data.settings.kopLine1 || 'KEMENTERIAN AGAMA REPUBLIK INDONESIA'}</h2>
                <h1>${data.settings.schoolName || 'MADRASAH ALIYAH'}</h1>
                <p>${data.settings.schoolAddress || 'Alamat Madrasah'} ${data.settings.schoolPhone ? '| Telp: ' + data.settings.schoolPhone : ''}</p>
            </div>

            <table class="meta">
                <tr>
                    <td style="width: 60%;"><strong>REKAPITULASI PRESENSI KEHADIRAN SISWA</strong></td>
                    <td style="text-align: right;"><strong>Bulan:</strong> ${data.monthNameIndo}</td>
                </tr>
                <tr>
                    <td><strong>Kelas:</strong> ${data.classNameLabel} &nbsp;&nbsp;|&nbsp;&nbsp; <strong>Mapel:</strong> ${data.subjectLabel}</td>
                    <td style="text-align: right;"><strong>Tahun Pelajaran:</strong> ${data.settings.academicYear || (data.year + '/' + (data.year + 1))}</td>
                </tr>
            </table>

            <table class="rekap">
                <thead>
                    <tr>
                        <th rowspan="2" style="width: 25px;">No</th>
                        <th rowspan="2" style="width: 60px;">NIS</th>
                        <th rowspan="2" style="width: 140px; text-align: left; padding-left: 4px;">Nama Siswa</th>
                        <th colspan="${data.daysInMonth}">Tanggal Presensi Bulan ${data.monthNameIndo}</th>
                        <th colspan="3" style="background-color: #e2e8f0;">Total Rekap</th>
                    </tr>
                    <tr>
                        ${headersHtml}
                        <th style="width: 22px; background-color: #fef3c7; color: #b45309;">S</th>
                        <th style="width: 22px; background-color: #dbeafe; color: #1d4ed8;">I</th>
                        <th style="width: 22px; background-color: #fee2e2; color: #b91c1c;">A</th>
                    </tr>
                </thead>
                <tbody>
                    ${rowsHtml}
                </tbody>
                <tfoot>
                    ${footersHtml}
                </tfoot>
            </table>

            <!-- Legend & Stats Summary in Word -->
            <table style="width: 100%; border-collapse: collapse; margin-top: 14px; font-size: 8.5pt;">
                <tr>
                    <td style="width: 55%; vertical-align: top; border: 1px solid #cbd5e1; padding: 6px; background-color: #fcfcfc;">
                        <strong>KETERANGAN SIMBOL KEHADIRAN:</strong><br/>
                        <span style="color: #15803d; font-weight: bold;">✓</span> : Hadir (Siswa hadir mengikuti pembelajaran)<br/>
                        <span style="color: #b45309; font-weight: bold;">S</span> : Sakit (Siswa memiliki surat keterangan sakit)<br/>
                        <span style="color: #1d4ed8; font-weight: bold;">I</span> : Izin (Siswa memiliki surat izin)<br/>
                        <span style="color: #b91c1c; font-weight: bold;">A</span> : Alpa (Siswa tidak hadir tanpa keterangan)
                    </td>
                    <td style="width: 5%;"></td>
                    <td style="width: 40%; vertical-align: top; border: 1px solid #cbd5e1; padding: 6px; background-color: #f8fafc;">
                        <strong>RINGKASAN AKUMULASI KELAS:</strong><br/>
                        Total Siswa: <b>${data.totalStudents} Siswa</b><br/>
                        Total Sakit (S): <b style="color: #b45309;">${data.grandTotalSakit}</b> | Total Izin (I): <b style="color: #1d4ed8;">${data.grandTotalIzin}</b><br/>
                        Total Alpa (A): <b style="color: #b91c1c;">${data.grandTotalAlpa}</b>
                    </td>
                </tr>
            </table>

            <!-- Signature Table in Word -->
            <table style="width: 100%; border-collapse: collapse; margin-top: 25px; font-size: 9.5pt;">
                <tr>
                    <td style="width: 50%; text-align: center; vertical-align: top;">
                        Mengetahui,<br/>
                        <b>Kepala Madrasah</b><br/><br/><br/><br/>
                        <u><b>${data.settings.headmaster || 'Kepala Madrasah'}</b></u><br/>
                        <span style="font-size: 8.5pt;">${data.settings.headmasterNip ? 'NIP. ' + data.settings.headmasterNip : ''}</span>
                    </td>
                    <td style="width: 50%; text-align: center; vertical-align: top;">
                        ${data.settings.schoolCity || 'Madrasah'}, ${new Date().getDate()} ${data.monthNameIndo}<br/>
                        <b>Wali Kelas / Guru Pengampu</b><br/><br/><br/><br/>
                        <u><b>${data.homeroomTeacherName}</b></u><br/>
                        <span style="font-size: 8.5pt;">NIP. .................................................</span>
                    </td>
                </tr>
            </table>

            ${photosHtml}
        </div>
        </body>
        </html>
    `;

    const blob = new Blob(['\ufeff' + htmlContent], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Rekap_Absensi_${data.classNameLabel.replace(/\s+/g, '_')}_${targetMonth}.doc`;
    a.click();
    closeModal();
    showToast('Rekapitulasi Word (.doc) berhasil diunduh (Rekap S, I, A)!', 'success');
}

function executeExportExcelAttendance() {
    const targetMonth = document.getElementById('print-att-month')?.value || new Date().toISOString().substring(0, 7);
    const data = getAttendanceRecapData(targetMonth);

    if (!window.XLSX) {
        showToast('Library XLSX belum termuat, silakan gunakan Cetak Word atau Print.', 'error');
        return;
    }

    const rows = [];
    rows.push([data.settings.kopLine1 || 'KEMENTERIAN AGAMA REPUBLIK INDONESIA']);
    rows.push([data.settings.schoolName || 'MADRASAH ALIYAH']);
    rows.push([`REKAPITULASI PRESENSI SISWA BULANAN - ${data.monthNameIndo}`]);
    rows.push([`Kelas: ${data.classNameLabel}`, `Mapel: ${data.subjectLabel}`, `Tahun Pelajaran: ${data.settings.academicYear || ''}`]);
    rows.push([]); // blank row

    // Table Header (Sakit, Izin, Alpa only)
    const headerRow = ['No', 'NIS', 'Nama Siswa'];
    for (let d = 1; d <= data.daysInMonth; d++) {
        headerRow.push(String(d));
    }
    headerRow.push('Sakit (S)', 'Izin (I)', 'Alpa (A)');
    rows.push(headerRow);

    // Student rows
    data.studentRows.forEach(r => {
        const studentRow = [r.no, r.student.nis || '-', r.student.name || '-'];
        r.dayValues.forEach(dv => {
            studentRow.push(dv.statusInfo.symbolText);
        });
        studentRow.push(r.countS, r.countI, r.countA);
        rows.push(studentRow);
    });

    // Summary rows (S, I, A only)
    const sakitRow = ['', '', 'Jumlah Sakit (S)'];
    const izinRow = ['', '', 'Jumlah Izin (I)'];
    const alpaRow = ['', '', 'Jumlah Alpa (A)'];

    for (let d = 1; d <= data.daysInMonth; d++) {
        sakitRow.push(data.dayStats[d].sakit || 0);
        izinRow.push(data.dayStats[d].izin || 0);
        alpaRow.push(data.dayStats[d].alpa || 0);
    }
    sakitRow.push(data.grandTotalSakit, '-', '-');
    izinRow.push('-', data.grandTotalIzin, '-');
    alpaRow.push('-', '-', data.grandTotalAlpa);

    rows.push(sakitRow);
    rows.push(izinRow);
    rows.push(alpaRow);

    rows.push([]);
    rows.push(['KETERANGAN SIMBOL:']);
    rows.push(['✓ = Hadir', 'S = Sakit', 'I = Izin', 'A = Alpa (Tanpa Keterangan)', '- = Libur / Belum Absen']);
    rows.push([]);
    rows.push([`Total Siswa: ${data.totalStudents}`, `Total Sakit (S): ${data.grandTotalSakit}`, `Total Izin (I): ${data.grandTotalIzin}`, `Total Alpa (A): ${data.grandTotalAlpa}`]);

    const ws = XLSX.utils.aoa_to_sheet(rows);

    // Set column widths
    const cols = [{ wch: 4 }, { wch: 12 }, { wch: 26 }];
    for (let d = 1; d <= data.daysInMonth; d++) {
        cols.push({ wch: 3.5 });
    }
    cols.push({ wch: 10 }, { wch: 10 }, { wch: 10 });
    ws['!cols'] = cols;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Rekap Absensi');
    XLSX.writeFile(wb, `Rekap_Absensi_${data.classNameLabel.replace(/\s+/g, '_')}_${targetMonth}.xlsx`);

    closeModal();
    showToast('Rekapitulasi Excel (.xlsx) berhasil diunduh!', 'success');
}

// Class Leader Functions
function renderClassLeaderDashboard(container) {
    const currentUser = appState.currentUser || {};
    const leader = appState.students.find(s => String(s.id) === String(currentUser.id)) || currentUser;
    const currentClass = appState.classes.find(c => String(c.id) === String(leader.classId || leader.class_id));

    container.innerHTML = `
        <div class="space-y-6 pb-8">
            <div class="bg-gradient-to-r from-amber-500 to-orange-500 p-6 rounded-3xl shadow-sm text-white">
                <div class="flex items-center gap-4">
                    <div class="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center"><i class="fa-solid fa-crown text-2xl"></i></div>
                    <div>
                        <span class="text-xs font-semibold bg-white/20 px-3 py-1 rounded-full">Dashboard Ketua Kelas</span>
                        <h1 class="text-xl sm:text-2xl font-bold mt-2">Selamat Datang, ${leader.name || 'Ketua Kelas'}</h1>
                        <p class="text-xs text-white/80 mt-1">${currentClass ? currentClass.name : 'Kelas Anda'}</p>
                    </div>
                </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button type="button" onclick="navigateTo('absen_kelas')" class="p-5 bg-amber-50 hover:bg-amber-100 border border-amber-100 rounded-2xl text-left transition">
                    <div class="w-11 h-11 bg-amber-500 text-white rounded-xl flex items-center justify-center mb-3"><i class="fa-solid fa-clipboard-check"></i></div>
                    <p class="font-bold text-slate-800">Absensi Kelas</p>
                    <p class="text-xs text-slate-500 mt-1">Kelola dan kirim rekap absensi anggota kelas.</p>
                </button>

                <button type="button" onclick="navigateTo('profil_siswa')" class="p-5 bg-blue-50 hover:bg-blue-100 border border-blue-100 rounded-2xl text-left transition">
                    <div class="w-11 h-11 bg-blue-500 text-white rounded-xl flex items-center justify-center mb-3"><i class="fa-solid fa-user"></i></div>
                    <p class="font-bold text-slate-800">Profil Saya</p>
                    <p class="text-xs text-slate-500 mt-1">Lihat dan edit profil akun Anda.</p>
                </button>
            </div>
        </div>
    `;
}

function filterClassLeaderSubjects(query) {
    const container = document.getElementById('class-leader-subject-search-results');
    if (!container) return;
    const subjects = appState.subjects || [];
    const q = (query || '').toLowerCase().trim();
    const filtered = subjects.filter(s => s.name.toLowerCase().includes(q));

    const hiddenInput = document.getElementById('select-class-leader-subject');
    const currentSelectedId = hiddenInput ? hiddenInput.value : '';

    if (filtered.length === 0) {
        container.innerHTML = `<div class="p-4 text-center text-xs text-slate-400 font-medium">Mata pelajaran tidak ditemukan.</div>`;
        return;
    }

    container.innerHTML = filtered.map(s => {
        const isSelected = String(currentSelectedId) === String(s.id);
        return `
            <div onclick="selectClassLeaderSubject('${s.id}', '${s.name.replace(/'/g, "\\'")}')" class="p-3 rounded-xl border text-sm font-semibold flex items-center justify-between cursor-pointer transition ${isSelected ? 'bg-amber-600 text-white border-amber-600 shadow-sm' : 'bg-white text-slate-700 border-slate-200 hover:bg-amber-50 hover:border-amber-300'}">
                <span class="flex items-center gap-2.5">
                    <i class="fa-solid fa-book-bookmark ${isSelected ? 'text-white' : 'text-amber-500'}"></i>
                    <span>${s.name}</span>
                </span>
                ${isSelected ? '<i class="fa-solid fa-circle-check text-white"></i>' : '<i class="fa-solid fa-chevron-right text-xs text-slate-300"></i>'}
            </div>
        `;
    }).join('');
}

function selectClassLeaderSubject(id, name) {
    const hiddenInput = document.getElementById('select-class-leader-subject');
    const searchInput = document.getElementById('input-search-class-leader-subject');
    if (hiddenInput) hiddenInput.value = id;
    if (searchInput) searchInput.value = name;
    filterClassLeaderSubjects(name);
}

function confirmClassLeaderSubject() {
    const hiddenInput = document.getElementById('select-class-leader-subject');
    let val = hiddenInput ? hiddenInput.value : '';
    const searchInput = document.getElementById('input-search-class-leader-subject');
    const typedText = searchInput ? searchInput.value.trim().toLowerCase() : '';

    if (!val && typedText) {
        const subjects = appState.subjects || [];
        const matched = subjects.find(s => s.name.toLowerCase() === typedText) || subjects.find(s => s.name.toLowerCase().includes(typedText));
        if (matched) {
            val = matched.id;
        }
    }

    if (!val) {
        showToast('Pilih atau ketik mata pelajaran terlebih dahulu!', 'error');
        return;
    }
    appState.activeClassLeaderAttendanceSubjectId = val;
    renderClassLeaderAttendance(document.getElementById('view-container'));
}

function renderClassLeaderAttendance(container) {
    if (!container) container = document.getElementById('view-container');
    const currentUser = appState.currentUser || {};
    const classStudents = appState.students.filter(s => String(s.classId || s.class_id) === String(currentUser.classId || currentUser.class_id));
    const today = new Date().toISOString().split('T')[0];
    const selectedSubjectId = appState.activeClassLeaderAttendanceSubjectId || '';

    if (!selectedSubjectId) {
        container.innerHTML = `
            <div class="space-y-6 max-w-xl mx-auto pb-8 animate-fade-in">
                <!-- Back to Dashboard Header -->
                <div class="flex items-center justify-between pb-3 border-b border-slate-200/60 mb-2">
                    <button type="button" onclick="window.studentGoBackToDashboard && window.studentGoBackToDashboard()" class="flex items-center gap-2 text-slate-600 hover:text-slate-850 transition font-bold text-xs sm:text-sm cursor-pointer">
                        <i class="fa-solid fa-arrow-left"></i>
                        <span>Kembali ke Dashboard Utama</span>
                    </button>
                    <span class="text-xs font-bold text-slate-400">Absensi Mapel</span>
                </div>

                <div class="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 space-y-6 text-center">
                    <div class="w-16 h-16 bg-amber-100 text-amber-600 rounded-2xl mx-auto flex items-center justify-center text-2xl shadow">
                        <i class="fa-solid fa-crown"></i>
                    </div>
                    <div>
                        <span class="px-3 py-1 bg-amber-50 text-amber-700 rounded-full text-xs font-semibold">Absensi Ketua Kelas</span>
                        <h1 class="text-xl sm:text-2xl font-bold text-slate-800 mt-2">Pilih Mata Pelajaran</h1>
                        <p class="text-xs text-slate-400 mt-1">Cari dan pilih mata pelajaran sebelum mengisi absensi anggota kelas hari ini.</p>
                    </div>

                    <div class="text-left space-y-3">
                        <label class="block text-xs uppercase font-semibold text-slate-500">Cari Mata Pelajaran</label>
                        <div class="relative">
                            <i class="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm"></i>
                            <input type="text" id="input-search-class-leader-subject" oninput="filterClassLeaderSubjects(this.value)" placeholder="Ketik nama mapel (cth: Matematika, Fikih)..." class="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500">
                        </div>
                        <input type="hidden" id="select-class-leader-subject" value="">

                        <div id="class-leader-subject-search-results" class="max-h-56 overflow-y-auto space-y-2 border border-slate-100 rounded-2xl p-2 bg-slate-50/50">
                            <!-- Filtered subject items rendered here -->
                        </div>
                    </div>

                    <button type="button" onclick="confirmClassLeaderSubject()" class="w-full py-3.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-2xl text-sm shadow transition flex items-center justify-center space-x-2 cursor-pointer">
                        <i class="fa-solid fa-circle-check"></i><span>OKE & Buka Absensi Kelas</span>
                    </button>
                </div>
            </div>
        `;
        setTimeout(() => {
            filterClassLeaderSubjects('');
        }, 50);
        return;
    }

    const currentSubject = (appState.subjects || []).find(s => String(s.id) === String(selectedSubjectId));
    const subjectName = currentSubject ? currentSubject.name : 'Mata Pelajaran';

    container.innerHTML = `
        <div class="space-y-6 pb-8 max-w-2xl mx-auto animate-fade-in">
            <!-- Back to Dashboard Header -->
            <div class="flex items-center justify-between pb-3 border-b border-slate-200/60 mb-2">
                <button type="button" onclick="window.studentGoBackToDashboard && window.studentGoBackToDashboard()" class="flex items-center gap-2 text-slate-600 hover:text-slate-850 transition font-bold text-xs sm:text-sm cursor-pointer">
                    <i class="fa-solid fa-arrow-left"></i>
                    <span>Kembali ke Dashboard Utama</span>
                </button>
                <span class="text-xs font-bold text-slate-400">Absensi Kelas</span>
            </div>

            <div class="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex items-center justify-between">
                <div>
                    <span class="px-3 py-1 bg-amber-50 text-amber-700 rounded-full text-xs font-semibold">Panel Ketua Kelas</span>
                    <h1 class="text-xl sm:text-2xl font-bold text-slate-800 mt-2">Absensi Kelas</h1>
                    <p class="text-xs text-slate-500 font-bold mt-0.5">Mapel: <span class="text-amber-600">${subjectName}</span></p>
                </div>
                <button type="button" onclick="appState.activeClassLeaderAttendanceSubjectId = ''; renderClassLeaderAttendance(document.getElementById('view-container'));" class="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-1.5">
                    <i class="fa-solid fa-arrows-rotate"></i><span>Ganti Mapel</span>
                </button>
            </div>

            <div class="bg-white p-6 rounded-3xl shadow-sm border space-y-4">
                <div class="space-y-2">
                    ${classStudents.map(st => {
                        const existingAtt = (appState.attendance || []).find(a =>
                            (String(a.studentId) === String(st.id) || a.studentId === st.name) &&
                            String(a.date).substring(0, 10) === today &&
                            String(a.subjectId || '') === String(selectedSubjectId)
                        );
                        const currentStatus = existingAtt ? existingAtt.status : 'HADIR';
                        return `
                            <div class="flex justify-between items-center p-3 bg-slate-50 rounded-2xl text-xs">
                                <div>
                                    <span class="font-semibold text-slate-800 block">${st.name}</span>
                                    <span class="text-[10px] text-slate-400">NIS: ${st.nis || '-'}</span>
                                </div>
                                <select data-student-id="${st.id}" class="class-leader-att-status px-3 py-1.5 bg-white border rounded-xl font-semibold text-emerald-700 cursor-pointer">
                                    <option value="HADIR" ${currentStatus === 'HADIR' ? 'selected' : ''}>HADIR</option>
                                    <option value="IZIN" ${currentStatus === 'IZIN' ? 'selected' : ''}>IZIN</option>
                                    <option value="SAKIT" ${currentStatus === 'SAKIT' ? 'selected' : ''}>SAKIT</option>
                                    <option value="ALPA" ${currentStatus === 'ALPA' ? 'selected' : ''}>ALPA</option>
                                </select>
                            </div>
                        `;
                    }).join('')}
                </div>
                <button type="button" onclick="submitClassAttendance()" class="w-full py-3 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-2xl text-xs shadow transition flex items-center justify-center gap-2 cursor-pointer">
                    <i class="fa-solid fa-paper-plane"></i><span>Kirim Absensi Kelas (${subjectName})</span>
                </button>
            </div>
        </div>
    `;
}

async function submitClassAttendance() {
    const selects = document.querySelectorAll('.class-leader-att-status');
    const today = new Date().toISOString().split('T')[0];
    const subjectId = appState.activeClassLeaderAttendanceSubjectId || '';
    const currentUser = appState.currentUser || {};
    const classId = currentUser.classId || currentUser.class_id || '';

    const items = [];
    selects.forEach(select => {
        const studentId = select.dataset.studentId;
        const status = select.value;
        const student = (appState.students || []).find(s => String(s.id) === String(studentId));
        const studentClassId = student ? (student.classId || student.class_id) : classId;
        items.push({
            studentId,
            classId: studentClassId,
            subjectId,
            date: today,
            status,
            location: 'Input Ketua Kelas',
            photo: '',
            note: 'Ketua Kelas'
        });
    });

    if (items.length === 0) return;

    try {
        const res = await fetch('/api/attendance/bulk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items })
        });
        const data = await res.json();
        if (data.success) {
            if (!Array.isArray(appState.attendance)) appState.attendance = [];
            items.forEach(item => {
                const idx = appState.attendance.findIndex(a =>
                    String(a.studentId) === String(item.studentId) &&
                    String(a.date).substring(0, 10) === today &&
                    String(a.subjectId || '') === String(subjectId)
                );
                const completeItem = {
                    id: 'ATT_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
                    ...item
                };
                if (idx !== -1) {
                    appState.attendance[idx] = { ...appState.attendance[idx], ...item };
                } else {
                    appState.attendance.push(completeItem);
                }
            });
            safeSetLocalStorage('madrasah_attendance', appState.attendance);
            if (typeof saveState === 'function') saveState('attendance');
            showToast('Absensi kelas berhasil dikirim!', 'success');
        } else {
            showToast('Gagal mengirim absensi kelas.', 'error');
        }
    } catch (err) {
        console.error(err);
        showToast('Terjadi kesalahan saat mengirim absensi kelas.', 'error');
    }
}

// Data Server Loader
async function loadDataFromServer() {
    try {
        const queryParams = new URLSearchParams();
        const activeMId = (appState.currentUser && (appState.currentUser.madrasahId || appState.currentUser.madrasahSlug)) || window.__activeTenant?.id || window.__activeTenant?.slug;
        if (activeMId && activeMId !== 'default' && activeMId !== 'BOSS') {
            queryParams.set('madrasahId', activeMId);
        }
        if (appState.role) {
            queryParams.set('role', appState.role);
        }
        const queryString = queryParams.toString();
        const url = '/api/all-data' + (queryString ? `?${queryString}` : '');
        const response = await fetch(url, {
            headers: {
                'x-user-role': appState.role || ''
            }
        });
        if (!response.ok) throw new Error('Bulk API response failed');
        const res = await response.json();

        if (res.success) {
            if (res.teachers) {
                appState.teachers = res.teachers;
                safeSetLocalStorage('madrasah_teachers', appState.teachers);
                if (appState.currentUser && (appState.role === 'teacher' || appState.role === 'guru')) {
                    const matchedT = (res.teachers || []).find(t => String(t.id) === String(appState.currentUser.id) || String(t.username) === String(appState.currentUser.username) || String(t.nip) === String(appState.currentUser.nip));
                    if (matchedT) {
                        appState.currentUser.cbtTokenBalance = typeof matchedT.cbtTokenBalance === 'number' ? matchedT.cbtTokenBalance : 0;
                        safeSetLocalStorage('madrasah_current_user', appState.currentUser);
                    }
                }
            }
            if (res.students) {
                appState.students = typeof sortStudentsByNis === 'function' ? sortStudentsByNis(res.students) : res.students;
                safeSetLocalStorage('madrasah_students', appState.students);
            }
            if (res.classes) appState.classes = res.classes;
            if (res.subjects) appState.subjects = res.subjects;
            if (res.attendance) {
                appState.attendance = res.attendance;
                safeSetLocalStorage('madrasah_attendance', appState.attendance);
            }
            if (res.questionBankGroups) appState.questionBankGroups = res.questionBankGroups;
            if (res.questions) appState.questionBank = res.questions;
            if (res.schedules) {
                appState.schedules = res.schedules;
                safeSetLocalStorage('madrasah_schedules', appState.schedules);
            }
            if (res.savedRosters) {
                appState.savedRosters = res.savedRosters;
                safeSetLocalStorage('madrasah_savedRosters', appState.savedRosters);
            }
            if (res.timeSlots && Array.isArray(res.timeSlots) && res.timeSlots.length > 0) {
                appState.timeSlots = res.timeSlots;
                safeSetLocalStorage('madrasah_timeSlots', appState.timeSlots);
            }
            if (res.kbmDuration) {
                appState.kbmDuration = res.kbmDuration;
                safeSetLocalStorage('madrasah_kbmDuration', appState.kbmDuration);
            }
            if (res.exams) appState.exams = res.exams;
            if (res.lkpdList) {
                // Full LKPD payload stays in RAM/server; do not duplicate it in localStorage.
                appState.lkpdList = res.lkpdList;
            }
            if (res.rooms) appState.rooms = res.rooms;
            if (res.journals) appState.journals = res.journals;
            if (res.gradeCategories && Array.isArray(res.gradeCategories)) {
                appState.gradeCategories = res.gradeCategories;
                safeSetLocalStorage('madrasah_gradeCategories', appState.gradeCategories);
            }
            if (res.generatedExams) appState.generatedExams = res.generatedExams;
            if (res.settings) {
                appState.settings = res.settings;
                if (window.applyLoginCustomization) window.applyLoginCustomization();
                if (window.applyThemePackage && appState.settings.theme === 'package' && appState.settings.themePackage) {
                    window.applyThemePackage(appState.settings.themePackage);
                }
            }
            if (res.lessonPlans !== undefined) appState.lessonPlans = window.normalizeLessonPlanCollection ? window.normalizeLessonPlanCollection(res.lessonPlans) : (Array.isArray(res.lessonPlans) ? res.lessonPlans : []);
            if (Array.isArray(res.importGroups)) {
                appState.importGroups = res.importGroups;
                appState._importGroupsLoaded = true;
                try { localStorage.removeItem('madrasah_import_groups'); } catch (_) {}
            }
            if (res.grades) {
                appState.grades = res.grades;
                safeSetLocalStorage('madrasah_grades', appState.grades);
            }
            if (res.customGradeColumns) {
                appState.customGradeColumns = res.customGradeColumns;
                safeSetLocalStorage('madrasah_customGradeColumns', appState.customGradeColumns);
            }
            if (res.teacherAttendance) {
                appState.teacherAttendance = res.teacherAttendance;
                safeSetLocalStorage('madrasah_teacher_attendance', appState.teacherAttendance);
            }
            if (res.madrasahs) {
                const incomingMadrasahs = Array.isArray(res.madrasahs) ? res.madrasahs : [];
                appState.madrasahs = incomingMadrasahs.map(m => {
                    const existingM = (appState.madrasahs || []).find(oldM =>
                        String(oldM.id) === String(m.id) ||
                        (m.slug && String(oldM.slug) === String(m.slug))
                    );
                    if (typeof m.cbtTokenBalance !== 'number' && existingM && typeof existingM.cbtTokenBalance === 'number') {
                        return { ...m, cbtTokenBalance: existingM.cbtTokenBalance };
                    }
                    return m;
                });
                safeSetLocalStorage('madrasah_madrasahs', appState.madrasahs);
                if (appState.currentUser && (appState.role === 'admin' || appState.role === 'administrator')) {
                    const currentMId = appState.currentUser.madrasahId || appState.currentUser.madrasahSlug || 'default';
                    const matchedM = appState.madrasahs.find(m =>
                        String(m.id) === String(currentMId) ||
                        String(m.slug) === String(currentMId)
                    );
                    if (matchedM && typeof matchedM.cbtTokenBalance === 'number') {
                        appState.currentUser.cbtTokenBalance = matchedM.cbtTokenBalance;
                        safeSetLocalStorage('madrasah_current_user', appState.currentUser);
                    }
                }
            }
            if (res.tokenRequests) {
                appState.tokenRequests = res.tokenRequests;
            }
            if (res.cbtTokenPrice !== undefined) {
                appState.cbtTokenPrice = res.cbtTokenPrice;
            }
            if (typeof window.updateHeaderTokenBadge === 'function') {
                window.updateHeaderTokenBadge();
            }
        } else {
            throw new Error('Bulk API failed');
        }

        // Re-render current view if app is logged in
        const lastRoute = localStorage.getItem('madrasah_last_route') || 'dashboard';
        if (window.navigateTo && document.getElementById('main-app') && !document.getElementById('main-app').classList.contains('hidden')) {
            window.navigateTo(lastRoute);
        }
        return true;
    } catch (err) {
        console.warn('Fallback ke parallel loading karena:', err);
        // Fallback to parallel requests if /api/all-data failed (highly unlikely but safe)
        try {
            const [tchRes, stdRes, clsRes, subRes, attRes, grpRes, qRes, schRes, examRes, roomRes, jourRes, catRes, genExRes, setRes, lpRes, grdRes, tAttRes] = await Promise.all([
                fetch('/api/teachers').then(r => r.json()).catch(() => ({ success: false })),
                fetch('/api/students').then(r => r.json()).catch(() => ({ success: false })),
                fetch('/api/classes').then(r => r.json()).catch(() => ({ success: false })),
                fetch('/api/subjects').then(r => r.json()).catch(() => ({ success: false })),
                fetch('/api/attendance').then(r => r.json()).catch(() => ({ success: false })),
                fetch('/api/question-bank-groups').then(r => r.json()).catch(() => ({ success: false })),
                fetch('/api/questions').then(r => r.json()).catch(() => ({ success: false })),
                fetch('/api/schedules').then(r => r.json()).catch(() => ({ success: false })),
                fetch('/api/exams').then(r => r.json()).catch(() => ({ success: false })),
                fetch('/api/rooms').then(r => r.json()).catch(() => ({ success: false })),
                fetch('/api/journals').then(r => r.json()).catch(() => ({ success: false })),
                fetch('/api/grade-categories').then(r => r.json()).catch(() => ({ success: false })),
                fetch('/api/generated-exams').then(r => r.json()).catch(() => ({ success: false })),
                fetch('/api/settings').then(r => r.json()).catch(() => ({ success: false })),
                fetch('/api/lesson-plans').then(r => r.json()).catch(() => ({ success: false })),
                fetch('/api/grades').then(r => r.json()).catch(() => ({ success: false })),
                fetch('/api/teacher-attendance').then(r => r.json()).catch(() => ({ success: false }))
            ]);

            if (tchRes.success) appState.teachers = tchRes.teachers;
            if (stdRes.success) appState.students = typeof sortStudentsByNis === 'function' ? sortStudentsByNis(stdRes.students) : stdRes.students;
            if (clsRes.success) appState.classes = clsRes.classes;
            if (subRes.success) appState.subjects = subRes.subjects;
            if (attRes.success) appState.attendance = attRes.attendance;
            if (grpRes.success) appState.questionBankGroups = grpRes.groups;
            if (qRes.success) appState.questionBank = qRes.questions;
            if (schRes.success) appState.schedules = schRes.schedules;
            if (examRes.success) appState.exams = examRes.exams;
            if (roomRes.success) appState.rooms = roomRes.rooms;
            if (jourRes.success) appState.journals = jourRes.journals;
            if (catRes.success && (catRes.gradeCategories || catRes.categories)) {
                appState.gradeCategories = catRes.gradeCategories || catRes.categories;
                safeSetLocalStorage('madrasah_gradeCategories', appState.gradeCategories);
            }
            if (genExRes.success) appState.generatedExams = genExRes.generatedExams;
            if (setRes.success && setRes.settings) {
                appState.settings = setRes.settings;
                if (window.applyLoginCustomization) window.applyLoginCustomization();
            }
            if (lpRes.success) appState.lessonPlans = window.normalizeLessonPlanCollection ? window.normalizeLessonPlanCollection(lpRes) : (Array.isArray(lpRes.data) ? lpRes.data : (lpRes.lessonPlans || []));
            if (grdRes.success) appState.grades = grdRes.grades;
            if (tAttRes.success) appState.teacherAttendance = tAttRes.teacherAttendance;

            // Public settings alone must never make an authenticated session look loaded.
            const fallbackAuthenticatedResponses = [tchRes, stdRes, clsRes, subRes, attRes, grpRes, qRes, schRes, examRes, roomRes, jourRes, catRes, genExRes, lpRes, grdRes, tAttRes];
            if (!fallbackAuthenticatedResponses.some(item => item && item.success === true)) return false;

            const lastRoute = localStorage.getItem('madrasah_last_route') || 'dashboard';
            if (window.navigateTo && document.getElementById('main-app') && !document.getElementById('main-app').classList.contains('hidden')) {
                window.navigateTo(lastRoute);
            }
            return true;
        } catch(fallbackErr) {
            console.log('Mode lokal aktif.');
            return false;
        }
    }
}

// Theme Switcher Functions
function updateThemeSelectionUI() {
    const selectedTheme = (appState.settings && appState.settings.theme) || 'emerald';

    // Clear styles first
    document.querySelectorAll('.theme-card-btn').forEach(btn => {
        btn.classList.remove('ring-2', 'ring-offset-2', 'border-emerald-600', 'ring-emerald-500', 'border-blue-600', 'ring-blue-500', 'border-violet-600', 'ring-violet-500', 'border-rose-600', 'ring-rose-500', 'border-slate-800', 'ring-slate-700');
        btn.classList.add('border-slate-200');
    });

    // Highlight active card
    const activeBtn = document.getElementById(`theme-btn-${selectedTheme}`);
    if (activeBtn) {
        activeBtn.classList.remove('border-slate-200');
        const colorRingClass = selectedTheme === 'emerald' ? 'ring-emerald-500 border-emerald-600' :
                               selectedTheme === 'blue' ? 'ring-blue-500 border-blue-600' :
                               selectedTheme === 'purple' ? 'ring-violet-500 border-violet-600' :
                               selectedTheme === 'rose' ? 'ring-rose-500 border-rose-600' :
                               selectedTheme === 'midnight' ? 'ring-slate-700 border-slate-800' : 'ring-emerald-500 border-emerald-600';
        activeBtn.classList.add('ring-2', 'ring-offset-2', ...colorRingClass.split(' '));
    }

    // Toggle customizer
    const customBuilder = document.getElementById('custom-theme-builder');
    if (customBuilder) {
        if (selectedTheme === 'custom') {
            customBuilder.classList.remove('hidden');
            const custom = (appState.settings && appState.settings.customTheme) || {
                primaryColor: '#059669',
                borderRadius: 'large',
                designStyle: 'flat'
            };

            const colorInput = document.getElementById('theme-custom-color');
            const colorHex = document.getElementById('theme-custom-color-hex');
            const radiusSelect = document.getElementById('theme-custom-radius');
            const styleSelect = document.getElementById('theme-custom-style');

            if (colorInput) colorInput.value = custom.primaryColor || '#059669';
            if (colorHex) colorHex.innerText = custom.primaryColor || '#059669';
            if (radiusSelect) radiusSelect.value = custom.borderRadius || 'large';
            if (styleSelect) styleSelect.value = custom.designStyle || 'flat';
        } else {
            customBuilder.classList.add('hidden');
        }
    }
}

function selectSystemTheme(themeName) {
    if (!appState.settings) appState.settings = {};
    appState.settings.theme = themeName;

    if (window.applyTheme) {
        window.applyTheme();
    }

    updateThemeSelectionUI();
}

function handleCustomColorChange(colorHex) {
    if (!appState.settings) appState.settings = {};
    if (!appState.settings.customTheme) {
        appState.settings.customTheme = {};
    }
    appState.settings.customTheme.primaryColor = colorHex;

    const hexLabel = document.getElementById('theme-custom-color-hex');
    if (hexLabel) hexLabel.innerText = colorHex;

    if (window.applyTheme) {
        window.applyTheme();
    }
}

function setQuickCustomColor(colorHex) {
    const colorInput = document.getElementById('theme-custom-color');
    if (colorInput) colorInput.value = colorHex;

    handleCustomColorChange(colorHex);
}

function handleCustomRadiusChange(radius) {
    if (!appState.settings) appState.settings = {};
    if (!appState.settings.customTheme) {
        appState.settings.customTheme = {};
    }
    appState.settings.customTheme.borderRadius = radius;

    if (window.applyTheme) {
        window.applyTheme();
    }
}

function handleCustomStyleChange(style) {
    if (!appState.settings) appState.settings = {};
    if (!appState.settings.customTheme) {
        appState.settings.customTheme = {};
    }
    appState.settings.customTheme.designStyle = style;

    if (window.applyTheme) {
        window.applyTheme();
    }
}

async function checkDatabaseConnection() {
    const statusResultEl = document.getElementById('db-connection-test-result');
    if (statusResultEl) {
        statusResultEl.innerHTML = `<div class="p-3 bg-blue-50 text-blue-700 rounded-xl text-xs flex items-center gap-2"><i class="fa-solid fa-spinner fa-spin"></i><span>Sedang menguji koneksi dan membaca kapasitas penyimpanan...</span></div>`;
    }

    try {
        const res = await fetch('/api/db-status');
        const text = await res.text();
        let data;
        try {
            data = JSON.parse(text);
        } catch (e) {
            if (statusResultEl) {
                statusResultEl.innerHTML = `<div class="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs"><div class="font-bold mb-1">Respons diagnostik tidak valid</div><p class="text-[11px] text-slate-600">Status HTTP ${res.status}. Periksa log backend.</p></div>`;
            }
            return;
        }

        if (!res.ok) {
            if (statusResultEl) {
                statusResultEl.innerHTML = `<div class="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs"><div class="font-bold mb-1">Diagnostik ditolak</div><p class="text-[11px] text-slate-600">${data?.message || 'Anda tidak memiliki izin membuka status penyimpanan.'}</p></div>`;
            }
            return;
        }

        if (statusResultEl) {
            const mode = String(data.mode || '').toLowerCase() === 'offline' ? 'offline' : 'online';
            const sqlObj = data.sql || { connected: false, message: 'Tidak terbaca' };
            const jsonObj = data.json || { connected: false, message: 'Tidak terbaca' };
            const cloudinaryObj = data.cloudinary || { connected: false, message: 'Tidak terbaca' };
            const isAllOk = data.connected === true;

            const safeText = (value) => String(value ?? '')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');

            const formatBytes = (value) => {
                const bytes = Number(value);
                if (!Number.isFinite(bytes) || bytes < 0) return '-';
                if (bytes < 1024) return Math.round(bytes) + ' B';
                if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0) + ' KB';
                if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
                return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
            };

            const formatCredit = (value) => {
                const num = Number(value);
                return Number.isFinite(num) ? num.toFixed(2) : '-';
            };

            const healthInfo = (health) => {
                const key = String(health || 'unknown').toLowerCase();
                if (key === 'safe') return { label: 'AMAN', badge: 'bg-emerald-100 text-emerald-700', bar: 'bg-emerald-500' };
                if (key === 'attention') return { label: 'PERHATIAN', badge: 'bg-amber-100 text-amber-700', bar: 'bg-amber-500' };
                if (key === 'high') return { label: 'HAMPIR PENUH', badge: 'bg-orange-100 text-orange-700', bar: 'bg-orange-500' };
                if (key === 'critical') return { label: 'KRITIS', badge: 'bg-rose-100 text-rose-700', bar: 'bg-rose-500' };
                return { label: 'BELUM TERBACA', badge: 'bg-slate-100 text-slate-600', bar: 'bg-slate-400' };
            };

            const progressBar = (percent, health) => {
                const raw = Number(percent);
                if (!Number.isFinite(raw)) return '';
                const value = Math.max(0, Math.min(100, raw));
                const meta = healthInfo(health);
                return `
                    <div class="space-y-1.5">
                        <div class="flex justify-between text-[10px] text-slate-500">
                            <span>Pemakaian</span>
                            <span class="font-bold text-slate-700">${raw.toFixed(1)}%</span>
                        </div>
                        <div class="h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div class="h-full ${meta.bar} rounded-full transition-all duration-300" style="width:${value}%"></div>
                        </div>
                    </div>`;
            };

            const infoRow = (label, value, strong = false) => `
                <div class="flex items-center justify-between gap-3 py-1">
                    <span class="text-[10px] text-slate-500">${safeText(label)}</span>
                    <span class="text-[10px] ${strong ? 'font-extrabold text-slate-800' : 'font-semibold text-slate-700'} text-right">${safeText(value)}</span>
                </div>`;

            const renderSqlCapacity = (capacity) => {
                if (!capacity || typeof capacity !== 'object') return '';
                const meta = healthInfo(capacity.health);
                const hasPlatform = capacity.diskUsedBytes != null || capacity.diskLimitBytes != null;
                const rows = [
                    capacity.databaseName ? infoRow('Database aktif', capacity.databaseName) : '',
                    capacity.databaseBytes != null ? infoRow('Ukuran database Madrasah Bisa', formatBytes(capacity.databaseBytes), true) : '',
                    capacity.instanceId ? infoRow('Instance Cloud SQL', capacity.instanceId) : '',
                    capacity.region ? infoRow('Region', capacity.region) : '',
                    capacity.tier ? infoRow('Tier', capacity.tier) : '',
                    capacity.diskUsedBytes != null ? infoRow('Disk terpakai', formatBytes(capacity.diskUsedBytes), true) : '',
                    capacity.diskLimitBytes != null ? infoRow('Kapasitas disk saat ini', formatBytes(capacity.diskLimitBytes)) : '',
                    capacity.remainingBytes != null ? infoRow('Sisa disk saat ini', formatBytes(capacity.remainingBytes), true) : '',
                    capacity.autoResize != null ? infoRow('Auto Increase', capacity.autoResize ? 'AKTIF' : 'NONAKTIF') : '',
                    capacity.autoResizeLimitBytes != null ? infoRow('Batas Auto Increase', formatBytes(capacity.autoResizeLimitBytes)) : ''
                ].filter(Boolean).join('');

                return `
                    <div class="mt-2 p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl space-y-2">
                        <div class="flex items-center justify-between gap-2">
                            <span class="text-[10px] font-extrabold uppercase tracking-wider text-indigo-800">Kapasitas Cloud SQL</span>
                            ${hasPlatform ? `<span class="px-2 py-0.5 rounded-full text-[9px] font-black ${meta.badge}">${meta.label}</span>` : ''}
                        </div>
                        <div class="divide-y divide-indigo-100/70">${rows}</div>
                        ${progressBar(capacity.usedPercent, capacity.health)}
                        ${capacity.note ? `<p class="text-[10px] text-amber-700 bg-amber-50 border border-amber-100 p-2 rounded-lg"><i class="fa-solid fa-triangle-exclamation mr-1"></i>${safeText(capacity.note)}</p>` : ''}
                        ${!hasPlatform && capacity.databaseBytes != null ? '<p class="text-[10px] text-slate-500">Ukuran database berhasil dibaca. Kapasitas disk instance memerlukan akses Cloud SQL Admin/Cloud Monitoring.</p>' : ''}
                    </div>`;
            };

            const renderCloudinaryCapacity = (capacity) => {
                if (!capacity || typeof capacity !== 'object') return '';
                if (capacity.available === false && !capacity.storageBytes && capacity.creditLimit == null) {
                    return capacity.note
                        ? `<p class="mt-2 text-[10px] text-amber-700 bg-amber-50 border border-amber-100 p-2 rounded-lg"><i class="fa-solid fa-triangle-exclamation mr-1"></i>Kapasitas Cloudinary belum terbaca: ${safeText(capacity.note)}</p>`
                        : '';
                }
                const meta = healthInfo(capacity.health);
                const rows = [
                    capacity.plan ? infoRow('Plan', capacity.plan) : '',
                    capacity.storageBytes != null ? infoRow('Storage digunakan', formatBytes(capacity.storageBytes), true) : '',
                    capacity.creditUsed != null ? infoRow('Credit terpakai', formatCredit(capacity.creditUsed)) : '',
                    capacity.creditLimit != null ? infoRow('Total kuota credit', formatCredit(capacity.creditLimit)) : '',
                    capacity.creditRemaining != null ? infoRow('Sisa credit', formatCredit(capacity.creditRemaining), true) : '',
                    capacity.storageCredits != null ? infoRow('Credit untuk storage', formatCredit(capacity.storageCredits)) : '',
                    capacity.bandwidthCredits != null ? infoRow('Credit untuk bandwidth', formatCredit(capacity.bandwidthCredits)) : '',
                    capacity.transformationCredits != null ? infoRow('Credit transformasi', formatCredit(capacity.transformationCredits)) : ''
                ].filter(Boolean).join('');

                return `
                    <div class="mt-2 p-3 bg-sky-50/50 border border-sky-100 rounded-xl space-y-2">
                        <div class="flex items-center justify-between gap-2">
                            <span class="text-[10px] font-extrabold uppercase tracking-wider text-sky-800">Kapasitas Cloudinary</span>
                            <span class="px-2 py-0.5 rounded-full text-[9px] font-black ${meta.badge}">${meta.label}</span>
                        </div>
                        <div class="divide-y divide-sky-100/70">${rows}</div>
                        ${progressBar(capacity.creditPercent, capacity.health)}
                        <p class="text-[9px] text-slate-400">Catatan: sisa credit bukan sama dengan sisa GB. Storage, bandwidth, dan transformasi memakai kumpulan credit Cloudinary yang sama.</p>
                    </div>`;
            };

            const renderIcon = (isOk) => isOk
                ? `<i class="fa-solid fa-circle-check text-emerald-500 text-base"></i>`
                : `<i class="fa-solid fa-circle-xmark text-rose-500 text-base"></i>`;
            const renderBadge = (isOk) => isOk
                ? `<span class="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold">ONLINE</span>`
                : `<span class="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 text-[10px] font-bold">OFFLINE</span>`;

            const serviceCard = (number, title, obj, kind = '') => `
                <div class="p-3 rounded-xl hover:bg-slate-50/50 transition duration-150 border border-slate-100">
                    <div class="flex items-start gap-3">
                        <div class="mt-0.5">${renderIcon(obj.connected)}</div>
                        <div class="flex-1 space-y-0.5 min-w-0">
                            <div class="flex items-center justify-between gap-2">
                                <span class="font-bold text-slate-800 text-xs">${number}. ${safeText(title)}</span>
                                ${renderBadge(obj.connected)}
                            </div>
                            <p class="text-[11px] text-slate-600">${safeText(obj.message || '')}</p>
                            ${obj.details ? `<p class="text-[10px] text-slate-400 font-mono bg-slate-50 p-1.5 rounded border border-slate-100/60 overflow-x-auto whitespace-pre-wrap">${safeText(obj.details)}</p>` : ''}
                        </div>
                    </div>
                    ${kind === 'sql' ? renderSqlCapacity(obj.capacity) : ''}
                    ${kind === 'cloudinary' ? renderCloudinaryCapacity(obj.capacity) : ''}
                </div>`;

            const cards = mode === 'online'
                ? [
                    serviceCard(1, 'Database SQL (Google Cloud SQL)', sqlObj, 'sql'),
                    serviceCard(2, 'Cloudinary (Penyimpanan Media)', cloudinaryObj, 'cloudinary')
                  ].join('')
                : [
                    serviceCard(1, 'Database PostgreSQL Lokal', sqlObj, 'sql'),
                    serviceCard(2, 'Local File System (local_store.json)', jsonObj)
                  ].join('');

            statusResultEl.innerHTML = `
                <div class="space-y-4 animate-in fade-in duration-300">
                    <div class="p-4 ${isAllOk ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-rose-50 border-rose-200 text-rose-900'} border rounded-2xl text-xs space-y-1 shadow-sm">
                        <div class="font-bold flex items-center gap-2 text-sm">
                            <i class="fa-solid ${isAllOk ? 'fa-circle-check text-emerald-600' : 'fa-circle-xmark text-rose-600'}"></i>
                            <span>${mode === 'online' ? 'Status Penyimpanan Online' : 'Status Penyimpanan Offline'}</span>
                        </div>
                        <p class="text-slate-700">${safeText(data.message || (isAllOk ? 'Layanan utama terhubung.' : 'Ada layanan utama yang belum terhubung.'))}</p>
                    </div>
                    <div class="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm space-y-3.5">
                        <h4 class="text-xs font-bold text-slate-700 tracking-wide uppercase">Layanan & Kapasitas</h4>
                        ${cards}
                    </div>
                    <p class="text-[10px] text-slate-400">Firebase Firestore tidak digunakan sebagai backend aktif. Local JSON hanya diperiksa pada mode offline. Metrik Cloud SQL dapat tertunda beberapa menit dari kondisi aktual.</p>
                </div>`;
        }
    } catch (err) {
        if (statusResultEl) {
            statusResultEl.replaceChildren();
            const box = document.createElement('div');
            box.className = 'p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs';
            const title = document.createElement('div');
            title.className = 'font-bold mb-1';
            title.textContent = 'Gagal menghubungi server diagnostik';
            const detail = document.createElement('p');
            detail.className = 'text-slate-700';
            detail.textContent = String(err?.message || err || 'Kesalahan tidak diketahui');
            box.append(title, detail);
            statusResultEl.appendChild(box);
        }
    }
}
async function forceSyncCloudToLocal() {
    const statusResultEl = document.getElementById('db-connection-test-result');
    if (statusResultEl) {
        statusResultEl.innerHTML = `<div class="p-4 bg-indigo-50 border border-indigo-200 text-indigo-800 rounded-2xl text-xs flex flex-col gap-2 animate-pulse">
            <div class="font-bold flex items-center gap-2">
                <i class="fa-solid fa-spinner fa-spin text-sm"></i>
                <span>Sedang Menghubungkan & Mengunduh Data Cloud...</span>
            </div>
            <p class="text-slate-600 text-[11px]">Sistem sedang menguji ulang koneksi, memanggil seluruh tabel di Google Cloud SQL, dan mengganti data lokal dengan versi cloud terbaru...</p>
        </div>`;
    }
    try {
        const res = await fetch('/api/db-pull-cloud', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        const data = await res.json();

        if (data.success) {
            if (statusResultEl) {
                statusResultEl.innerHTML = `
                    <div class="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs space-y-1">
                        <div class="font-bold flex items-center gap-2"><i class="fa-solid fa-circle-check text-emerald-600 text-sm"></i><span>Koneksi & Sinkronisasi Berhasil!</span></div>
                        <p class="text-slate-600">${data.message}</p>
                        <div class="mt-2 text-slate-500 bg-emerald-100/40 p-2 rounded-xl text-[11px] grid grid-cols-2 gap-x-4 gap-y-1">
                            <span>• Guru terunduh: <strong>${data.details.teachersCount} orang</strong></span>
                            <span>• Siswa terunduh: <strong>${data.details.studentsCount} orang</strong></span>
                            <span>• Kelas terunduh: <strong>${data.details.classesCount} kelas</strong></span>
                            <span>• Absensi terunduh: <strong>${data.details.attendanceCount} records</strong></span>
                        </div>
                        <p class="text-[11px] text-emerald-700 font-semibold mt-1">💡 Tips: Halaman Anda akan disegarkan dalam 2 detik untuk menerapkan data baru.</p>
                    </div>
                `;
            }
            showToast('Sinkronisasi data cloud berhasil!', 'success');

            setTimeout(async () => {
                if (window.loadDataFromServer) {
                    await window.loadDataFromServer();
                } else {
                    window.location.reload();
                }
            }, 2500);

        } else {
            if (statusResultEl) {
                statusResultEl.innerHTML = `
                    <div class="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs space-y-1">
                        <div class="font-bold flex items-center gap-2"><i class="fa-solid fa-circle-xmark text-rose-600 text-sm"></i><span>Sinkronisasi Gagal</span></div>
                        <p class="text-slate-700"><strong>Penyebab:</strong> ${data.message || 'Gagal memproses data dari Cloud SQL.'}</p>
                        <p class="text-slate-500 text-[11px] mt-1">💡 Tips: Pastikan konfigurasi database di menu Pengaturan AI Studio sudah benar dan status koneksi database aktif.</p>
                    </div>
                `;
            }
        }
    } catch (err) {
        if (statusResultEl) {
            statusResultEl.innerHTML = `
                <div class="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs space-y-1">
                    <div class="font-bold flex items-center gap-2"><i class="fa-solid fa-circle-xmark text-rose-600 text-sm"></i><span>Gagal Menghubungi Server</span></div>
                    <p class="text-slate-700">${err.message || String(err)}</p>
                </div>
            `;
        }
    }
}

async function forceSyncCloudinaryPhotos() {
    const statusResultEl = document.getElementById('db-connection-test-result');
    if (statusResultEl) {
        statusResultEl.innerHTML = `<div class="p-4 bg-sky-50 border border-sky-200 text-sky-800 rounded-2xl text-xs flex flex-col gap-2 animate-pulse">
            <div class="font-bold flex items-center gap-2">
                <i class="fa-solid fa-spinner fa-spin text-sm"></i>
                <span>Sedang Menghubungkan & Memindai Foto di Cloudinary...</span>
            </div>
            <p class="text-slate-600 text-[11px]">Sistem sedang mengunduh daftar lengkap aset gambar di Cloudinary, memetakan kembali foto profil seluruh siswa dan guru, serta menyimpannya secara permanen ke database PostgreSQL...</p>
        </div>`;
    }
    try {
        const res = await fetch('/api/cloudinary/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        const data = await res.json();
        if (data.success) {
            if (statusResultEl) {
                statusResultEl.innerHTML = `
                    <div class="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs space-y-1 animate-in fade-in">
                        <div class="font-bold flex items-center gap-2"><i class="fa-solid fa-circle-check text-emerald-600 text-sm"></i><span>Sinkronisasi Foto Cloudinary Berhasil!</span></div>
                        <p class="text-slate-600">${data.message}</p>
                        <div class="mt-2 text-slate-500 bg-emerald-100/40 p-2 rounded-xl text-[11px]">
                            <span>• Total foto terpetakan di Cloudinary & Database: <strong>${data.result.mapped} foto</strong></span>
                        </div>
                        <p class="text-[11px] text-emerald-700 font-semibold mt-1">💡 Tips: Foto profil siswa dan guru kini sudah aktif kembali dan dapat ditampilkan tanpa kendala.</p>
                    </div>
                `;
            }
            if (window.showToast) {
                window.showToast('Foto profil Cloudinary berhasil disinkronkan!', 'success');
            }
        } else {
            if (statusResultEl) {
                statusResultEl.innerHTML = `
                    <div class="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs space-y-1">
                        <div class="font-bold flex items-center gap-2"><i class="fa-solid fa-circle-xmark text-rose-600 text-sm"></i><span>Sinkronisasi Cloudinary Gagal</span></div>
                        <p class="text-slate-700"><strong>Penyebab:</strong> ${data.message || 'Gagal memproses aset Cloudinary.'}</p>
                    </div>
                `;
            }
        }
    } catch (err) {
        if (statusResultEl) {
            statusResultEl.innerHTML = `
                <div class="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs space-y-1">
                    <div class="font-bold flex items-center gap-2"><i class="fa-solid fa-circle-xmark text-rose-600 text-sm"></i><span>Gagal Menghubungi Server</span></div>
                    <p class="text-slate-700">${err.message || String(err)}</p>
                </div>
            `;
        }
    }
}
window.forceSyncCloudinaryPhotos = forceSyncCloudinaryPhotos;


async function repairMissingCloudinaryPhotos() {
    const statusResultEl = document.getElementById('db-connection-test-result');
    const button = document.getElementById('repair-cloudinary-missing-btn');
    if (button) button.disabled = true;

    if (statusResultEl) {
        statusResultEl.innerHTML = `<div class="p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl text-xs flex flex-col gap-2 animate-pulse">
            <div class="font-bold flex items-center gap-2">
                <i class="fa-solid fa-spinner fa-spin text-sm"></i>
                <span>Memeriksa aset Cloudinary & mencari foto yang belum ter-backup...</span>
            </div>
            <p class="text-slate-600 text-[11px]">Foto yang sudah benar-benar ada di Cloudinary akan dilewati. Foto yang belum ada akan di-upload dari penyimpanan lokal bila sumber filenya masih tersedia.</p>
        </div>`;
    }

    try {
        const res = await fetch('/api/cloudinary/repair-missing', { method: 'POST' });
        const data = await res.json();
        if (!res.ok || !data.success) {
            throw new Error(data.message || 'Gagal memeriksa foto Cloudinary.');
        }

        const result = data.result || {};
        const missingWarning = Number(result.missingSource || 0) > 0
            ? `<p class="text-[11px] text-amber-700 font-semibold mt-2">⚠ ${result.missingSource} foto tidak ada di Cloudinary dan sumber file lokalnya juga tidak tersedia, sehingga tidak dapat di-upload ulang.</p>`
            : `<p class="text-[11px] text-emerald-700 font-semibold mt-2">✓ Semua foto yang dapat diperiksa memiliki backup Cloudinary atau berhasil di-upload.</p>`;

        if (statusResultEl) {
            statusResultEl.innerHTML = `<div class="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs space-y-2">
                <div class="font-bold flex items-center gap-2"><i class="fa-solid fa-circle-check text-emerald-600"></i><span>Pemeriksaan & Backup Foto Selesai</span></div>
                <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-slate-600">
                    <div class="bg-white/70 border rounded-xl p-2">Diperiksa: <strong>${result.checked || 0}</strong></div>
                    <div class="bg-white/70 border rounded-xl p-2">Sudah ada: <strong>${result.alreadyExists || 0}</strong></div>
                    <div class="bg-white/70 border rounded-xl p-2">Di-upload: <strong>${result.uploaded || 0}</strong></div>
                    <div class="bg-white/70 border rounded-xl p-2">Gagal: <strong>${result.failed || 0}</strong></div>
                </div>
                ${missingWarning}
            </div>`;
        }

        if (window.showToast) {
            window.showToast(`Cloudinary diperiksa: ${result.uploaded || 0} foto baru di-upload.`, 'success');
        }
    } catch (err) {
        if (statusResultEl) {
            statusResultEl.innerHTML = `<div class="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs">
                <div class="font-bold mb-1"><i class="fa-solid fa-circle-xmark mr-1"></i>Pemeriksaan Cloudinary Gagal</div>
                <p class="text-slate-700">${err?.message || String(err)}</p>
            </div>`;
        }
        if (window.showToast) window.showToast(err?.message || 'Pemeriksaan Cloudinary gagal.', 'error');
    } finally {
        if (button) button.disabled = false;
    }
}
window.repairMissingCloudinaryPhotos = repairMissingCloudinaryPhotos;

function toggleAllBackupCheckboxes() {
    const container = document.getElementById('backup-checkbox-container');
    if (!container) return;
    const checkboxes = container.querySelectorAll('input[type="checkbox"]');
    const allChecked = Array.from(checkboxes).every(cb => cb.checked);
    checkboxes.forEach(cb => cb.checked = !allChecked);
}

function toggleAllRestoreCheckboxes() {
    const container = document.getElementById('restore-checkbox-container');
    if (!container) return;
    const checkboxes = container.querySelectorAll('input[type="checkbox"]');
    const allChecked = Array.from(checkboxes).every(cb => cb.checked);
    checkboxes.forEach(cb => cb.checked = !allChecked);
}

async function backupSystemData() {
    const btn = document.querySelector('button[onclick="backupSystemData()"]');
    const originalContent = btn ? btn.innerHTML : '';
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> <span>Mempersiapkan data...</span>`;
    }
    try {
        const schoolName = (appState.settings && appState.settings.schoolName) || 'Madrasah Aliyah';
        const dateStr = new Date().toISOString().split('T')[0];

        const cbStudents = document.getElementById('backup-cb-students');
        const cbAttendance = document.getElementById('backup-cb-attendance');
        const cbPhotos = document.getElementById('backup-cb-photos');
        const cbAcademics = document.getElementById('backup-cb-academics');
        const cbCbt = document.getElementById('backup-cb-cbt');
        const cbLessonPlans = document.getElementById('backup-cb-lessonPlans');
        const cbSettings = document.getElementById('backup-cb-settings');

        const incStudents = cbStudents ? cbStudents.checked : true;
        const incAttendance = cbAttendance ? cbAttendance.checked : true;
        const incPhotos = cbPhotos ? cbPhotos.checked : true;
        const incAcademics = cbAcademics ? cbAcademics.checked : true;
        const incCbt = cbCbt ? cbCbt.checked : true;
        const incLessonPlans = cbLessonPlans ? cbLessonPlans.checked : true;
        const incSettings = cbSettings ? cbSettings.checked : true;

        // BACKUP_SAFE_RASTER_V1:
        // Only embed image formats that the restore/photo pipeline can safely persist.
        // Missing /api/photos assets return an SVG placeholder; never serialize that
        // placeholder as a restorable photo.
        const BACKUP_SAFE_IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
        const BACKUP_MAX_IMAGE_BYTES = 10 * 1024 * 1024;
        let skippedBackupImages = 0;

        const normalizeInlineBackupImage = (value) => {
            const raw = String(value || '');
            if (!raw.startsWith('data:image/')) return raw;
            const match = raw.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=\r\n]+)$/i);
            if (!match) {
                skippedBackupImages++;
                return '';
            }
            try {
                const declaredMime = match[1].toLowerCase();
                if (!BACKUP_SAFE_IMAGE_MIME.has(declaredMime)) {
                    skippedBackupImages++;
                    return '';
                }
                const binary = atob(match[2].replace(/\s+/g, ''));
                if (!binary.length || binary.length > BACKUP_MAX_IMAGE_BYTES) {
                    skippedBackupImages++;
                    return '';
                }
                const byte = (idx) => binary.charCodeAt(idx) & 0xff;
                const actualMime =
                    binary.length >= 3 && byte(0) === 0xff && byte(1) === 0xd8 && byte(2) === 0xff
                        ? 'image/jpeg'
                        : binary.length >= 8 && byte(0) === 0x89 && byte(1) === 0x50 && byte(2) === 0x4e && byte(3) === 0x47 &&
                          byte(4) === 0x0d && byte(5) === 0x0a && byte(6) === 0x1a && byte(7) === 0x0a
                            ? 'image/png'
                            : binary.length >= 12 && binary.slice(0, 4) === 'RIFF' && binary.slice(8, 12) === 'WEBP'
                                ? 'image/webp'
                                : '';
                if (!actualMime || actualMime !== declaredMime) {
                    skippedBackupImages++;
                    return '';
                }
                return raw;
            } catch (_) {
                skippedBackupImages++;
                return '';
            }
        };

        const imageUrlToBase64 = async (url) => {
            if (!url) return '';
            if (url.startsWith('data:image/')) return normalizeInlineBackupImage(url);
            try {
                const response = await fetch(url, { cache: 'no-store' });
                if (!response.ok) return url;
                const blob = await response.blob();
                const mime = String(blob.type || '').split(';')[0].toLowerCase();
                if ((mime && !BACKUP_SAFE_IMAGE_MIME.has(mime)) || !blob.size || blob.size > BACKUP_MAX_IMAGE_BYTES) {
                    skippedBackupImages++;
                    console.warn(`Backup melewati gambar yang tidak didukung/terlalu besar: ${url}`);
                    return '';
                }
                return new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(normalizeInlineBackupImage(reader.result));
                    reader.onerror = reject;
                    reader.readAsDataURL(blob);
                });
            } catch (e) {
                console.warn(`Failed to convert image url to base64: ${url}`, e);
                return url;
            }
        };

        // Helper to process array of items containing photos in batches
        const processPhotosInArray = async (arr, key, incPhotos, label) => {
            if (!Array.isArray(arr)) return [];
            if (!incPhotos) {
                return arr.map(item => ({ ...item, [key]: '' }));
            }
            const results = [];
            const limit = 15;
            for (let i = 0; i < arr.length; i += limit) {
                if (btn) {
                    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> <span>Mencadangkan ${label} (${Math.round((i / arr.length) * 100)}%)...</span>`;
                }
                const batch = arr.slice(i, i + limit);
                const batchPromises = batch.map(async (item) => {
                    if (!item) return item;
                    let processedItem = item;
                    if (item[key]) {
                        const base64 = await imageUrlToBase64(item[key]);
                        processedItem = { ...item, [key]: base64 };
                    }
                    if (key === 'photo' && Array.isArray(item.photoHistory)) {
                        const photoHistory = await Promise.all(item.photoHistory.map(async (entry) => {
                            if (typeof entry === 'string') return await imageUrlToBase64(entry);
                            if (entry && typeof entry === 'object' && entry.photo) {
                                return { ...entry, photo: await imageUrlToBase64(entry.photo) };
                            }
                            return entry;
                        }));
                        processedItem = { ...processedItem, photoHistory };
                    }
                    return processedItem;
                });
                const processedBatch = await Promise.all(batchPromises);
                results.push(...processedBatch);
            }
            return results;
        };

        // Process arrays with actual base64 photos when incPhotos is checked
        const studentsList = incStudents ? await processPhotosInArray(appState.students || [], 'photo', incPhotos, 'Foto Siswa') : [];
        const teachersList = incStudents ? await processPhotosInArray(appState.teachers || [], 'photo', incPhotos, 'Foto Guru') : [];
        const attendanceList = incAttendance ? await processPhotosInArray(appState.attendance || [], 'photo', incPhotos, 'Foto Absen') : [];
        const teacherAttendanceList = incAttendance ? await processPhotosInArray(appState.teacherAttendance || [], 'photo', incPhotos, 'Foto Absen Guru') : [];
        // Gambar soal adalah bagian dari konten CBT dan harus ikut tersedia saat offline.
        const questionsList = incCbt ? await processPhotosInArray(appState.questionBank || [], 'imageUrl', true, 'Gambar Soal') : [];

        // Build backup payload with selected components
        const isOfflineBackupMode = (window.isOfflineMode === true || appState.isOfflineMode === true);
        const backupData = {
            version: '2.2',
            timestamp: new Date().toISOString(),
            schoolName: schoolName,
            students: studentsList,
            teachers: teachersList,
            classes: incStudents ? (appState.classes || []) : [],
            subjects: incAcademics ? (appState.subjects || []) : [],
            schedules: incAcademics ? (appState.schedules || []) : [],
            attendance: attendanceList,
            teacherAttendance: teacherAttendanceList,
            questionBankGroups: incCbt ? (appState.questionBankGroups || []) : [],
            questions: questionsList,
            exams: incCbt ? (appState.exams || []) : [],
            rooms: incAcademics ? (appState.rooms || []) : [],
            journals: incLessonPlans ? (appState.journals || []) : [],
            gradeCategories: incCbt ? (appState.gradeCategories || []) : [],
            generatedExams: incCbt ? (appState.generatedExams || []) : [],
            lessonPlans: incLessonPlans ? (appState.lessonPlans || []) : [],
            grades: incCbt ? (appState.grades || []) : [],
            settings: incSettings ? (appState.settings || {}) : {},
            schoolLocationSettings: incSettings ? (appState.schoolLocationSettings || {}) : {},
            ...(isOfflineBackupMode ? { localStorageDump: {} } : {})
        };

        // Disaster-recovery backup: merge tenant-scoped credential hashes from the server.
        // appState intentionally excludes password fields.
        if (incStudents) {
            if (btn) btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> <span>Mengamankan credential akun...</span>`;
            const credentialResponse = await fetch('/api/system/backup-credentials', {
                method: 'GET',
                headers: { 'Accept': 'application/json' },
                cache: 'no-store'
            });
            let credentialData = null;
            try { credentialData = await credentialResponse.json(); } catch (_) {}
            if (!credentialResponse.ok || !credentialData || credentialData.success === false) {
                const detail = credentialData && credentialData.message ? credentialData.message : `HTTP ${credentialResponse.status}`;
                throw new Error('Gagal mengambil credential backup: ' + detail);
            }

            const mergeAuth = (list, credentials) => {
                const byId = new Map((credentials || []).map(c => [String(c.id || ''), c]));
                const byUsername = new Map((credentials || []).filter(c => c.username).map(c => [String(c.username).toLowerCase(), c]));
                return (list || []).map(item => {
                    const record = byId.get(String(item.id || '')) || byUsername.get(String(item.username || '').toLowerCase());
                    return record && record.authHash ? { ...item, password: record.authHash } : item;
                });
            };

            backupData.students = mergeAuth(backupData.students, credentialData.students);
            backupData.teachers = mergeAuth(backupData.teachers, credentialData.teachers);
            backupData.credentialBackup = {
                version: credentialData.version || 'credential-backup-v1',
                hashOnly: true,
                studentCount: Array.isArray(credentialData.students) ? credentialData.students.length : 0,
                teacherCount: Array.isArray(credentialData.teachers) ? credentialData.teachers.length : 0,
                missingStudents: Number(credentialData.missingStudents || 0),
                missingTeachers: Number(credentialData.missingTeachers || 0)
            };
        }

        // Browser cache is not part of an online/Cloud Run backup.
        // Keep the legacy dump only for true offline installations.
        if (incSettings && isOfflineBackupMode) {
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith('madrasah_')) {
                    backupData.localStorageDump[key] = localStorage.getItem(key);
                    backupData[key] = localStorage.getItem(key); // offline backwards compatibility
                }
            }
        }

        if (btn) {
            btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> <span>Membuat File JSON...</span>`;
        }

        const jsonStr = JSON.stringify(backupData, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const downloadAnchor = document.createElement('a');
        const cleanSchool = schoolName.replace(/[^a-zA-Z0-9]/g, '_');
        downloadAnchor.href = url;
        downloadAnchor.download = `Backup_${cleanSchool}_${dateStr}.json`;
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();

        setTimeout(() => {
            document.body.removeChild(downloadAnchor);
            URL.revokeObjectURL(url);
        }, 100);

        if (window.showToast) {
            const skippedText = skippedBackupImages > 0
                ? ` ${skippedBackupImages} gambar placeholder/invalid dilewati agar file tetap dapat direstore dengan aman.`
                : '';
            window.showToast('Backup data sistem berhasil diunduh!' + skippedText, skippedBackupImages > 0 ? 'warning' : 'success');
        }
    } catch (e) {
        console.error(e);
        if (window.showToast) {
            window.showToast('Gagal mencadangkan data: ' + e.message, 'error');
        }
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = originalContent;
        }
    }
}

async function restoreSystemData(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    try {
        const text = await file.text();
        const data = JSON.parse(text);

        if (!data || typeof data !== 'object') {
            throw new Error('Format file backup tidak valid.');
        }

        const legacyDump = (data.localStorageDump && typeof data.localStorageDump === 'object' && !Array.isArray(data.localStorageDump))
            ? data.localStorageDump
            : {};

        const getArray = (key, legacyKeys = []) => {
            if (Array.isArray(data[key])) return data[key];
            if (typeof data[key] === 'string') {
                try {
                    const parsed = JSON.parse(data[key]);
                    if (Array.isArray(parsed)) return parsed;
                } catch (e) {}
            }
            for (const lk of legacyKeys) {
                const candidate = data[lk] !== undefined ? data[lk] : legacyDump[lk];
                if (Array.isArray(candidate)) return candidate;
                if (typeof candidate === 'string') {
                    try {
                        const parsed = JSON.parse(candidate);
                        if (Array.isArray(parsed)) return parsed;
                    } catch (e) {}
                }
            }
            return null;
        };

        const getObject = (key, legacyKeys = []) => {
            if (data[key] && typeof data[key] === 'object') return data[key];
            if (typeof data[key] === 'string') {
                try {
                    const parsed = JSON.parse(data[key]);
                    if (parsed && typeof parsed === 'object') return parsed;
                } catch (e) {}
            }
            for (const lk of legacyKeys) {
                const candidate = data[lk] !== undefined ? data[lk] : legacyDump[lk];
                if (candidate && typeof candidate === 'object') return candidate;
                if (typeof candidate === 'string') {
                    try {
                        const parsed = JSON.parse(candidate);
                        if (parsed && typeof parsed === 'object') return parsed;
                    } catch (e) {}
                }
            }
            return null;
        };

        const restored = {
            students: getArray('students', ['madrasah_students']),
            teachers: getArray('teachers', ['madrasah_teachers']),
            classes: getArray('classes', ['madrasah_classes']),
            subjects: getArray('subjects', ['madrasah_subjects']),
            exams: getArray('exams', ['madrasah_exams']),
            schedules: getArray('schedules', ['madrasah_schedules']),
            attendance: getArray('attendance', ['madrasah_attendance']),
            teacherAttendance: getArray('teacherAttendance', ['madrasah_teacher_attendance', 'madrasah_teacherAttendance']),
            questions: getArray('questions', ['madrasah_questions', 'questionBank', 'madrasah_questionBank']),
            questionBankGroups: getArray('questionBankGroups', ['madrasah_questionBankGroups', 'madrasah_question_groups']),
            rooms: getArray('rooms', ['madrasah_rooms']),
            journals: getArray('journals', ['madrasah_journals']),
            gradeCategories: getArray('gradeCategories', ['madrasah_grade_categories', 'madrasah_gradeCategories']),
            generatedExams: getArray('generatedExams', ['madrasah_generated_exams', 'madrasah_generatedExams']),
            lessonPlans: getArray('lessonPlans', ['madrasah_lessonPlans', 'madrasah_lesson_plans']),
            grades: getArray('grades', ['madrasah_grades']),
            settings: getObject('settings', ['madrasah_settings']),
            schoolLocationSettings: getObject('schoolLocationSettings', ['madrasah_schoolLocationSettings'])
        };

        let studentCount = restored.students ? restored.students.length : 0;
        let teacherCount = restored.teachers ? restored.teachers.length : 0;
        let classCount = restored.classes ? restored.classes.length : 0;
        let examCount = restored.exams ? restored.exams.length : 0;
        const missingStudentCredentialCount = restored.students ? restored.students.filter(item => !item || !item.password).length : 0;
        const missingTeacherCredentialCount = restored.teachers ? restored.teachers.filter(item => !item || !item.password).length : 0;
        const missingCredentialCount = missingStudentCredentialCount + missingTeacherCredentialCount;

        const cbStudents = document.getElementById('restore-cb-students');
        const cbAttendance = document.getElementById('restore-cb-attendance');
        const cbPhotos = document.getElementById('restore-cb-photos');
        const cbAcademics = document.getElementById('restore-cb-academics');
        const cbCbt = document.getElementById('restore-cb-cbt');
        const cbLessonPlans = document.getElementById('restore-cb-lessonPlans');
        const cbSettings = document.getElementById('restore-cb-settings');

        const incStudents = cbStudents ? cbStudents.checked : true;
        const incAttendance = cbAttendance ? cbAttendance.checked : true;
        const incPhotos = cbPhotos ? cbPhotos.checked : true;
        const incAcademics = cbAcademics ? cbAcademics.checked : true;
        const incCbt = cbCbt ? cbCbt.checked : true;
        const incLessonPlans = cbLessonPlans ? cbLessonPlans.checked : true;
        const incSettings = cbSettings ? cbSettings.checked : true;
        const isOfflineRestoreMode = (window.isOfflineMode === true || appState.isOfflineMode === true);

        const messageHtml = `
            <div class="space-y-3 text-left">
                <p class="font-bold text-slate-800 text-sm">Apakah Anda yakin ingin memulihkan (restore) data sistem sesuai komponen yang dipilih?</p>
                <div class="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 space-y-1">
                    ${incStudents ? `<p>• Murid: <strong>${studentCount}</strong></p><p>• Guru: <strong>${teacherCount}</strong></p><p>• Kelas: <strong>${classCount}</strong></p>` : ''}
                    ${incCbt ? `<p>• Ujian CBT: <strong>${examCount}</strong></p>` : ''}
                    ${data.timestamp ? `<p>• Waktu Backup: <strong>${new Date(data.timestamp).toLocaleString('id-ID')}</strong></p>` : ''}
                </div>
                ${incStudents && missingCredentialCount > 0 ? `<p class="text-xs text-amber-700 font-semibold bg-amber-50 border border-amber-200 rounded-xl p-2.5">⚠ Backup ini tidak memiliki credential untuk <strong>${missingCredentialCount}</strong> akun. Data tetap dapat dipulihkan, tetapi akun baru tersebut perlu di-reset password oleh admin.</p>` : ''}
                <p class="text-xs text-rose-600 font-semibold">Tindakan ini akan memulihkan data ke server dan memperbarui aplikasi.</p>
            </div>
        `;

        showConfirmModal(messageHtml, async () => {
            try {
                const preservePhoto = (newItem, oldList) => {
                    if (incPhotos) return newItem.photo || '';
                    const oldItem = oldList.find(i => String(i.id) === String(newItem.id));
                    return oldItem ? (oldItem.photo || '') : '';
                };

                const optimizeAttendanceList = async (list, oldList) => {
                    if (!Array.isArray(list)) return list;
                    const optimized = [];
                    for (const item of list) {
                        const originalPhoto = preservePhoto(item, oldList);
                        if (incPhotos && originalPhoto && typeof originalPhoto === 'string' && originalPhoto.startsWith('data:image')) {
                            const compressedPhoto = await window.compressBase64Image(originalPhoto);
                            optimized.push({ ...item, photo: compressedPhoto });
                        } else {
                            optimized.push({ ...item, photo: originalPhoto });
                        }
                    }
                    return optimized;
                };

                const optimizedAttendance = incAttendance ? await optimizeAttendanceList(restored.attendance || data.attendance, appState.attendance || []) : appState.attendance;
                const optimizedTeacherAttendance = incAttendance ? await optimizeAttendanceList(restored.teacherAttendance || data.teacherAttendance, appState.teacherAttendance || []) : appState.teacherAttendance;

                const processPersonList = async (list, oldList) => {
                    if (!Array.isArray(list)) return list;
                    const processed = [];
                    for (const item of list) {
                        const originalPhoto = preservePhoto(item, oldList);
                        if (incPhotos && originalPhoto && typeof originalPhoto === 'string' && originalPhoto.startsWith('data:image')) {
                            const compressedPhoto = await window.compressBase64Image(originalPhoto);
                            processed.push({ ...item, photo: compressedPhoto });
                        } else {
                            processed.push({ ...item, photo: originalPhoto });
                        }
                    }
                    return processed;
                };

                // Prepare clean restore payload for server
                const restorePayload = {};
                if (data.timestamp) restorePayload.timestamp = data.timestamp;
                if (data.version) restorePayload.version = data.version;

                if (incStudents) {
                    restorePayload.students = await processPersonList(restored.students || data.students, appState.students || []);
                    restorePayload.teachers = await processPersonList(restored.teachers || data.teachers, appState.teachers || []);
                    restorePayload.classes = restored.classes || data.classes;
                }
                if (incAcademics) {
                    restorePayload.subjects = restored.subjects || data.subjects;
                    restorePayload.schedules = restored.schedules || data.schedules;
                    restorePayload.rooms = restored.rooms || data.rooms;
                }
                if (incAttendance) {
                    restorePayload.attendance = optimizedAttendance;
                    restorePayload.teacherAttendance = optimizedTeacherAttendance;
                }
                if (incCbt) {
                    restorePayload.questions = restored.questions || data.questions;
                    restorePayload.questionBankGroups = restored.questionBankGroups || data.questionBankGroups;
                    restorePayload.exams = restored.exams || data.exams;
                    restorePayload.gradeCategories = restored.gradeCategories || data.gradeCategories;
                    restorePayload.generatedExams = restored.generatedExams || data.generatedExams;
                    restorePayload.grades = restored.grades || data.grades;
                }
                if (incLessonPlans) {
                    restorePayload.journals = restored.journals || data.journals;
                    restorePayload.lessonPlans = restored.lessonPlans || data.lessonPlans;
                }
                if (incSettings) {
                    restorePayload.settings = restored.settings || data.settings;
                    restorePayload.schoolLocationSettings = restored.schoolLocationSettings || data.schoolLocationSettings;
                }

                const componentsToSync = [
                    incStudents ? ['students', 'madrasah_students', restorePayload.students] : null,
                    incStudents ? ['teachers', 'madrasah_teachers', restorePayload.teachers] : null,
                    incStudents ? ['classes', 'madrasah_classes', restorePayload.classes] : null,
                    incAcademics ? ['subjects', 'madrasah_subjects', restorePayload.subjects] : null,
                    incCbt ? ['exams', 'madrasah_exams', restorePayload.exams] : null,
                    incAcademics ? ['schedules', 'madrasah_schedules', restorePayload.schedules] : null,
                    incAttendance ? ['attendance', 'madrasah_attendance', restorePayload.attendance] : null,
                    incAttendance ? ['teacherAttendance', 'madrasah_teacher_attendance', restorePayload.teacherAttendance] : null,
                    incCbt ? ['questions', 'madrasah_questions', restorePayload.questions] : null,
                    incCbt ? ['questionBankGroups', 'madrasah_questionBankGroups', restorePayload.questionBankGroups] : null,
                    incAcademics ? ['rooms', 'madrasah_rooms', restorePayload.rooms] : null,
                    incLessonPlans ? ['journals', 'madrasah_journals', restorePayload.journals] : null,
                    incCbt ? ['gradeCategories', 'madrasah_grade_categories', restorePayload.gradeCategories] : null,
                    incCbt ? ['generatedExams', 'madrasah_generated_exams', restorePayload.generatedExams] : null,
                    incLessonPlans ? ['lessonPlans', 'madrasah_lessonPlans', restorePayload.lessonPlans] : null,
                    incCbt ? ['grades', 'madrasah_grades', restorePayload.grades] : null,
                    incSettings ? ['settings', 'madrasah_settings', restorePayload.settings] : null,
                    incSettings ? ['schoolLocationSettings', 'madrasah_schoolLocationSettings', restorePayload.schoolLocationSettings] : null
                ].filter(Boolean);

                // Restore through the dedicated server API. Online/Cloud Run must fail closed:
                // a failed authoritative write must never be converted into a fake success toast.
                let serverRestored = false;
                let mergedServerData = null;
                let serverRestoreError = null;

                const parseRestoreResponse = async (response, label) => {
                    let json = null;
                    try { json = await response.json(); } catch (_) {}
                    if (!response.ok || !json || json.success === false) {
                        const detail = json && json.message ? json.message : `HTTP ${response.status}`;
                        throw new Error(`${label}: ${detail}`);
                    }
                    return json;
                };

                const uploadRestoreChunks = async (payloadString) => {
                    const chunkSize = 500000;
                    const uploadId = `restore_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
                    const totalChunks = Math.ceil(payloadString.length / chunkSize);
                    for (let i = 0; i < totalChunks; i++) {
                        const chunkData = payloadString.slice(i * chunkSize, (i + 1) * chunkSize);
                        const response = await fetch('/api/system/restore/chunk', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ uploadId, chunkData, chunkIndex: i, totalChunks })
                        });
                        const json = await parseRestoreResponse(response, `Restore bagian ${i + 1}/${totalChunks} gagal`);
                        if (json.merged) mergedServerData = json.merged;
                    }
                    serverRestored = true;
                };

                try {
                    const payloadString = JSON.stringify(restorePayload);
                    if (payloadString.length > 500000) {
                        await uploadRestoreChunks(payloadString);
                    } else {
                        const response = await fetch('/api/system/restore', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: payloadString
                        });
                        if (response.status === 413) {
                            await uploadRestoreChunks(payloadString);
                        } else {
                            const json = await parseRestoreResponse(response, 'Restore server gagal');
                            if (json.merged) mergedServerData = json.merged;
                            serverRestored = true;
                        }
                    }
                } catch (err) {
                    serverRestoreError = err;
                    console.warn('Server restore error:', err);
                }

                if (!serverRestored) {
                    if (!isOfflineRestoreMode) {
                        throw serverRestoreError || new Error('Restore Cloud Run gagal disimpan ke server.');
                    }

                    // Offline-only compatibility fallback. Every write is verified; one failure
                    // aborts the restore instead of reporting success with partial data.
                    for (const [key, lsKey, val] of componentsToSync) {
                        if (val === undefined || val === null) continue;
                        const response = await fetch('/api/sync-state', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ key, data: val })
                        });
                        let json = null;
                        try { json = await response.json(); } catch (_) {}
                        if (!response.ok || (json && json.success === false)) {
                            throw new Error((json && json.message) || `Gagal menyimpan komponen ${key}.`);
                        }
                    }
                    serverRestored = true;
                }

                if (isOfflineRestoreMode) {
                    // Offline installations still need browser/local cache for continuity.
                    for (const [key, lsKey, val] of componentsToSync) {
                        let finalVal = val;
                        if (mergedServerData && mergedServerData[key] !== undefined) finalVal = mergedServerData[key];
                        if (finalVal === undefined || finalVal === null) continue;
                        if (key === 'students') appState[key] = sortStudentsByNis(finalVal);
                        else appState[key] = finalVal;
                        if (key === 'questions') appState.questionBank = finalVal;
                        if (window.safeSetLocalStorage) window.safeSetLocalStorage(lsKey, appState[key]);
                        else {
                            try { localStorage.setItem(lsKey, JSON.stringify(appState[key])); } catch (_) {}
                        }
                        if (lsKey === 'madrasah_questionBankGroups') {
                            if (window.safeSetLocalStorage) window.safeSetLocalStorage('madrasah_question_groups', finalVal);
                            else {
                                try { localStorage.setItem('madrasah_question_groups', JSON.stringify(finalVal)); } catch (_) {}
                            }
                        }
                    }
                } else {
                    // Cloud Run: never duplicate restored server datasets into localStorage.
                    // Remove legacy/stale caches and reload authoritative data from the server.
                    if (typeof window.purgeOnlineServerAuthoritativeCaches === 'function') {
                        window.purgeOnlineServerAuthoritativeCaches();
                    } else {
                        for (const [, lsKey] of componentsToSync) {
                            try { localStorage.removeItem(lsKey); } catch (_) {}
                        }
                        try { localStorage.removeItem('madrasah_question_groups'); } catch (_) {}
                    }

                    if (typeof window.loadDataFromServer === 'function') {
                        await window.loadDataFromServer();
                    } else if (mergedServerData) {
                        for (const [key, , val] of componentsToSync) {
                            const finalVal = mergedServerData[key] !== undefined ? mergedServerData[key] : val;
                            if (finalVal === undefined || finalVal === null) continue;
                            if (key === 'students') appState.students = sortStudentsByNis(finalVal);
                            else appState[key] = finalVal;
                            if (key === 'questions') appState.questionBank = finalVal;
                        }
                    }
                }

                if (window.showToast) {
                    const skippedRestoreImages = Number(mergedServerData?.restoreImageSummary?.skippedInvalid || 0);
                    const offlineMessage = skippedRestoreImages > 0
                        ? `Data berhasil dipulihkan. ${skippedRestoreImages} gambar placeholder/invalid dilewati; data lainnya tetap dipulihkan. Memuat ulang sistem...`
                        : 'Data berhasil dipulihkan! Memuat ulang sistem...';
                    window.showToast(isOfflineRestoreMode ? offlineMessage : 'Restore Cloud Run berhasil disimpan ke server dan data telah dimuat ulang dari sumber utama.', skippedRestoreImages > 0 ? 'warning' : 'success');
                }
                setTimeout(() => {
                    window.location.reload();
                }, 1200);
            } catch (err) {
                if (window.showToast) window.showToast('Gagal memulihkan: ' + err.message, 'error');
            }
        });
    } catch (err) {
        if (window.showToast) window.showToast('Gagal membaca file: ' + err.message, 'error');
    } finally {
        event.target.value = '';
    }
}

// Login Page Customization Functions
function toggleCustomLoginBgColor(val) {
    const container = document.getElementById('login-custom-bg-container');
    if (container) {
        if (val === 'custom') {
            container.classList.remove('hidden');
        } else {
            container.classList.add('hidden');
        }
    }
}

function readLoginCustomizationForm() {
    const logoPos = document.getElementById('login-set-logo-pos')?.value || 'center';
    const logoSize = document.getElementById('login-set-logo-size')?.value || 'medium';
    const logoShape = document.getElementById('login-set-logo-shape')?.value || 'rounded-2xl';
    const bgStyle = document.getElementById('login-set-bg-style')?.value || 'default';
    const cardStyle = document.getElementById('login-set-card-style')?.value || 'shadow-emerald';
    const customBg = document.getElementById('login-set-custom-bg')?.value || 'linear-gradient(135deg, #0f172a 0%, #064e3b 100%)';
    const title = document.getElementById('login-set-title')?.value || 'Selamat Datang Kembali';
    const subtitle = document.getElementById('login-set-subtitle')?.value || '';
    const buttonText = document.getElementById('login-set-button-text')?.value || 'Masuk Portal';
    const footerText = document.getElementById('login-set-footer-text')?.value || 'zeinsgroup · Portal Administrasi Madrasah';
    const noticeText = document.getElementById('login-set-notice-text')?.value || '';
    const showLeftPanel = document.getElementById('login-set-show-panel')?.checked ?? true;
    const panelBadge = document.getElementById('login-set-panel-badge')?.value || 'Sistem Manajemen Modern';
    const panelTitle = document.getElementById('login-set-panel-title')?.value || '';
    const panelDesc = document.getElementById('login-set-panel-desc')?.value || '';

    return {
        logoPosition: logoPos,
        logoSize: logoSize,
        logoShape: logoShape,
        bgStyle: bgStyle,
        cardStyle: cardStyle,
        customBg: customBg,
        title: title,
        subtitle: subtitle,
        buttonText: buttonText,
        footerText: footerText,
        noticeText: noticeText,
        showLeftPanel: showLeftPanel,
        panelBadge: panelBadge,
        panelTitle: panelTitle,
        panelDesc: panelDesc
    };
}

function saveLoginCustomization(e) {
    if (e) e.preventDefault();
    if (!appState.settings) appState.settings = {};

    appState.settings.loginConfig = readLoginCustomizationForm();

    saveState('settings');

    if (window.applyLoginCustomization) {
        window.applyLoginCustomization();
    }

    if (e) {
        showToast('Pengaturan halaman login berhasil disimpan!', 'success');
    }
}

function closeLoginPageCustomizationPreview() {
    document.getElementById('login-customization-preview')?.remove();
    document.body.classList.remove('overflow-hidden');
}

function previewLoginPageCustomization() {
    const loginContainer = document.getElementById('login-container');
    if (!loginContainer) {
        showToast('Pratinjau halaman login tidak tersedia.', 'error');
        return;
    }

    closeLoginPageCustomizationPreview();

    // PREVIEW_SESSION_ISOLATION_V1: render the unsaved draft into a detached,
    // inert copy. Never hide the authenticated app, persist settings, clear the
    // current user, or expose a live login form from the admin session.
    if (!appState.settings) appState.settings = {};
    const hadSavedConfig = Object.prototype.hasOwnProperty.call(appState.settings, 'loginConfig');
    const savedConfig = appState.settings.loginConfig;
    let previewSurface;
    try {
        appState.settings.loginConfig = readLoginCustomizationForm();
        if (window.applyLoginCustomization) window.applyLoginCustomization();
        previewSurface = loginContainer.cloneNode(true);
    } finally {
        if (hadSavedConfig) appState.settings.loginConfig = savedConfig;
        else delete appState.settings.loginConfig;
        if (window.applyLoginCustomization) window.applyLoginCustomization();
    }

    previewSurface.id = 'login-customization-preview-surface';
    previewSurface.classList.remove('hidden');
    previewSurface.setAttribute('inert', '');
    previewSurface.querySelectorAll('[id]').forEach(el => el.removeAttribute('id'));
    previewSurface.querySelectorAll('form').forEach(form => {
        form.removeAttribute('onsubmit');
        form.reset();
    });
    previewSurface.querySelectorAll('input, button, select, textarea, a').forEach(el => {
        el.setAttribute('tabindex', '-1');
        el.removeAttribute('onclick');
        if ('disabled' in el) el.disabled = true;
    });

    const overlay = document.createElement('div');
    overlay.id = 'login-customization-preview';
    overlay.className = 'fixed inset-0 z-[200] overflow-y-auto bg-slate-950/80 p-3 sm:p-6';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Pratinjau halaman login');

    const toolbar = document.createElement('div');
    toolbar.className = 'sticky top-0 z-20 mb-3 flex items-center justify-between gap-3 rounded-2xl bg-amber-400 px-4 py-3 text-slate-950 shadow-xl';
    const label = document.createElement('strong');
    label.className = 'text-xs sm:text-sm';
    label.textContent = 'PRATINJAU HALAMAN LOGIN — perubahan belum disimpan';
    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800';
    closeButton.textContent = 'Tutup Pratinjau';
    closeButton.addEventListener('click', closeLoginPageCustomizationPreview);
    toolbar.append(label, closeButton);

    overlay.append(toolbar, previewSurface);
    document.body.appendChild(overlay);
    document.body.classList.add('overflow-hidden');
    closeButton.focus();
    showToast('Pratinjau dibuka tanpa mengubah sesi atau menyimpan pengaturan.', 'info');
}

async function runSmartPhotoCleanup() {
    const btn = document.querySelector('button[onclick="runSmartPhotoCleanup()"]');
    const statusContainer = document.getElementById('cleanup-status-container');

    if (statusContainer) {
        statusContainer.classList.remove('hidden');
        statusContainer.innerHTML = `
            <div class="flex items-center gap-2 text-xs font-semibold px-4 py-2.5 rounded-xl bg-indigo-100/80 text-indigo-800 animate-pulse border border-indigo-200">
                <i class="fa-solid fa-spinner fa-spin"></i>
                <span>Sedang menganalisis dan memproses pembersihan foto pintar...</span>
            </div>
        `;
    }
    if (btn) btn.disabled = true;

    try {
        const res = await fetch('/api/admin/cleanup-photos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        const data = await res.json();

        if (data.success) {
            showToast(data.message, 'success');
            if (statusContainer) {
                const deleted = data.deletedCount || 0;
                const remaining = data.remainingCount || 0;
                const det = data.details || {};

                statusContainer.innerHTML = `
                    <div class="p-4 bg-white border border-indigo-100 rounded-2xl shadow-xs space-y-3">
                        <div class="flex items-center justify-between gap-2 border-b border-slate-100 pb-2">
                            <div class="flex items-center gap-2 text-emerald-700 font-bold text-xs sm:text-sm">
                                <i class="fa-solid fa-circle-check text-emerald-600 text-base"></i>
                                <span>Hasil Pembersihan Foto Pintar</span>
                            </div>
                            <span class="text-[10px] text-slate-400 font-mono">Baru saja selesai</span>
                        </div>
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            <div class="flex items-center justify-between p-3 rounded-xl bg-rose-50/80 border border-rose-100">
                                <div>
                                    <p class="text-[11px] font-medium text-rose-600">Aset Foto Ekstra Terhapus</p>
                                    <p class="text-xs text-rose-500">Selain profil aktif &amp; absensi terbaru</p>
                                </div>
                                <span class="text-lg font-black text-rose-700 font-mono">${deleted}</span>
                            </div>
                            <div class="flex items-center justify-between p-3 rounded-xl bg-emerald-50/80 border border-emerald-100">
                                <div>
                                    <p class="text-[11px] font-medium text-emerald-700">Foto Masih Tersimpan</p>
                                    <p class="text-xs text-emerald-600">Profil &amp; absensi aktif terlindungi</p>
                                </div>
                                <span class="text-lg font-black text-emerald-800 font-mono">${remaining}</span>
                            </div>
                        </div>
                        ${det.studentProfilePhotos !== undefined ? `
                            <div class="text-[11px] text-slate-500 flex flex-wrap gap-x-4 gap-y-1 pt-1 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                                <span><i class="fa-solid fa-user-graduate text-emerald-600 mr-1"></i>Foto Profil Siswa: <b>${det.studentProfilePhotos || 0}</b></span>
                                <span><i class="fa-solid fa-chalkboard-user text-indigo-600 mr-1"></i>Foto Profil Guru: <b>${det.teacherProfilePhotos || 0}</b></span>
                                <span><i class="fa-solid fa-camera text-blue-600 mr-1"></i>Foto Absensi Aktif: <b>${(det.studentAttendancePhotos || 0) + (det.teacherAttendancePhotos || 0)}</b></span>
                            </div>
                        ` : ''}
                    </div>
                `;
            }
            if (window.loadDataFromServer) {
                await window.loadDataFromServer();
            }
        } else {
            showToast(data.message || 'Gagal melakukan pembersihan.', 'error');
            if (statusContainer) statusContainer.classList.add('hidden');
        }
    } catch (err) {
        console.error("Cleanup request failed:", err);
        showToast('Gagal terhubung ke server untuk pembersihan.', 'error');
        if (statusContainer) statusContainer.classList.add('hidden');
    } finally {
        if (btn) btn.disabled = false;
    }
}

async function runTeacherPhotoCleanup() {
    if (!confirm("Apakah Anda yakin ingin merapikan foto guru?\n\nSistem akan:\n1. Menyisakan 1 foto profil aktif setiap guru.\n2. Menyisakan 1 foto absensi terbaru setiap guru.\n3. Menghapus referensi foto riwayat/absensi ekstra dan aset Cloudinary yang tidak lagi dipakai.\n\nData teks absensi tidak dihapus. Lanjutkan?")) return;

    const btn = document.querySelector('button[onclick="runTeacherPhotoCleanup()"]');
    const statusContainer = document.getElementById('cleanup-status-container');

    if (statusContainer) {
        statusContainer.classList.remove('hidden');
        statusContainer.innerHTML = `
            <div class="flex items-center gap-2 text-xs font-semibold px-4 py-2.5 rounded-xl bg-rose-100 text-rose-800 animate-pulse border border-rose-200">
                <i class="fa-solid fa-spinner fa-spin"></i>
                <span>Sedang memeriksa dan membersihkan foto absensi guru lama...</span>
            </div>
        `;
    }
    if (btn) btn.disabled = true;

    try {
        const res = await fetch('/api/admin/cleanup-teacher-photos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        const data = await res.json();

        if (data.success) {
            showToast(data.message, 'success');
            if (statusContainer) {
                statusContainer.innerHTML = `
                    <div class="p-4 bg-white border border-rose-100 rounded-2xl shadow-xs space-y-2">
                        <div class="flex items-center justify-between border-b pb-2">
                            <span class="text-xs font-bold text-rose-800">Status Pembersihan Foto Guru</span>
                            <span class="px-2 py-0.5 bg-rose-100 text-rose-800 text-[10px] font-bold rounded-full">Selesai</span>
                        </div>
                        <p class="text-xs text-slate-600">${data.message}</p>
                    </div>
                `;
            }
            if (window.loadDataFromServer) {
                await window.loadDataFromServer();
            }
        } else {
            showToast(data.message || 'Gagal membersihkan foto guru', 'error');
            if (statusContainer) statusContainer.classList.add('hidden');
        }
    } catch (e) {
        console.warn('Gagal membersihkan foto guru:', e);
        showToast('Terjadi kesalahan jaringan.', 'error');
        if (statusContainer) statusContainer.classList.add('hidden');
    } finally {
        if (btn) btn.disabled = false;
    }
}

// Window Globals
window.renderSettingModule = renderSettingModule;
window.saveLoginCustomization = saveLoginCustomization;
window.toggleCustomLoginBgColor = toggleCustomLoginBgColor;
window.previewLoginPageCustomization = previewLoginPageCustomization;
window.closeLoginPageCustomizationPreview = closeLoginPageCustomizationPreview;
window.saveSettings = saveSettings;
window.loadSchoolLocationSettings = loadSchoolLocationSettings;
window.useCurrentSchoolLocation = useCurrentSchoolLocation;
window.saveSchoolLocationSettings = saveSchoolLocationSettings;
window.renderAttendanceModule = renderAttendanceModule;
window.renderStudentAttendanceAdminOnly = renderStudentAttendanceAdminOnly;
window.markAllStudentsPresent = markAllStudentsPresent;
window.updateStudentAttendanceAdmin = updateStudentAttendanceAdmin;
window.handleAttendanceSearchInput = handleAttendanceSearchInput;
window.refreshStudentAttendanceView = refreshStudentAttendanceView;
window.openPrintAttendanceModal = openPrintAttendanceModal;
window.executePrintAttendance = executePrintAttendance;
window.executeDirectPrintAttendance = executeDirectPrintAttendance;
window.executeExportExcelAttendance = executeExportExcelAttendance;
window.getAttendanceStatusInfo = getAttendanceStatusInfo;
window.getAttendanceRecapData = getAttendanceRecapData;
window.renderClassLeaderDashboard = renderClassLeaderDashboard;
window.renderClassLeaderAttendance = renderClassLeaderAttendance;
window.filterClassLeaderSubjects = filterClassLeaderSubjects;
window.selectClassLeaderSubject = selectClassLeaderSubject;
window.confirmClassLeaderSubject = confirmClassLeaderSubject;
window.submitClassAttendance = submitClassAttendance;
window.loadDataFromServer = loadDataFromServer;
window.toggleAllBackupCheckboxes = toggleAllBackupCheckboxes;
window.toggleAllRestoreCheckboxes = toggleAllRestoreCheckboxes;
window.backupSystemData = backupSystemData;
window.restoreSystemData = restoreSystemData;

// Theme Selection
window.updateThemeSelectionUI = updateThemeSelectionUI;
window.selectSystemTheme = selectSystemTheme;
window.handleCustomColorChange = handleCustomColorChange;
window.setQuickCustomColor = setQuickCustomColor;
window.handleCustomRadiusChange = handleCustomRadiusChange;
window.handleCustomStyleChange = handleCustomStyleChange;

// Logo helper functions
window.setQuickLogoColor = setQuickLogoColor;
window.selectPresetLogoIcon = selectPresetLogoIcon;
window.handleLogoURLInput = handleLogoURLInput;
window.handleLogoFileUpload = handleLogoFileUpload;
window.clearCustomLogo = clearCustomLogo;
window.updateSettingsLogoPreview = updateSettingsLogoPreview;

// Account Settings helper functions
window.searchUserAccounts = searchUserAccounts;
window.openEditRoleModal = openEditRoleModal;
window.saveUserRole = saveUserRole;
window.openResetPasswordModal = openResetPasswordModal;
window.resetAndShowUserPassword = resetAndShowUserPassword;
window.generateAdminTemporaryPassword = generateAdminTemporaryPassword;
window.copyAdminResetPassword = copyAdminResetPassword;


// Automatically expose functions and state to window for global inline handlers
Object.assign(window, {
  renderSettingModule,
  saveLoginCustomization,
  toggleCustomLoginBgColor,
  previewLoginPageCustomization,
  closeLoginPageCustomizationPreview,
  searchUserAccounts,
  openEditRoleModal,
  saveUserRole,
  openResetPasswordModal,
  resetAndShowUserPassword,
  generateAdminTemporaryPassword,
  copyAdminResetPassword,
  selectPresetLogoIcon,
  setQuickLogoColor,
  handleLogoURLInput,
  handleLogoFileUpload,
  clearCustomLogo,
  updateSettingsLogoPreview,
  saveSettings,
  loadSchoolLocationSettings,
  useCurrentSchoolLocation,
  saveSchoolLocationSettings,
  handleAttendanceSearchInput,
  refreshStudentAttendanceView,
  renderAttendanceModule,
  renderStudentAttendanceAdminOnly,
  updateStudentAttendanceAdmin,
  markAllStudentsPresent,
  refreshStudentAttendanceData,
  markAllStudentsUnmarked,
  openPrintAttendanceModal,
  executePrintAttendance,
  executeDirectPrintAttendance,
  executeExportExcelAttendance,
  getAttendanceStatusInfo,
  getAttendanceRecapData,
  renderClassLeaderDashboard,
  renderClassLeaderAttendance,
  confirmClassLeaderSubject,
  submitClassAttendance,
  loadDataFromServer,
  updateThemeSelectionUI,
  selectSystemTheme,
  handleCustomColorChange,
  setQuickCustomColor,
  handleCustomRadiusChange,
  handleCustomStyleChange,
  checkDatabaseConnection,
  forceSyncCloudToLocal,
  toggleAllBackupCheckboxes,
  toggleAllRestoreCheckboxes,
  backupSystemData,
  restoreSystemData,
  runSmartPhotoCleanup,
  runTeacherPhotoCleanup,
  showStudentAttendancePhotoModal,
  setAttendancePhotoAsStudentProfile
});
window.runSmartPhotoCleanup = runSmartPhotoCleanup;
window.runTeacherPhotoCleanup = runTeacherPhotoCleanup;
window.markAllStudentsUnmarked = markAllStudentsUnmarked;
window.refreshStudentAttendanceData = refreshStudentAttendanceData;
window.showStudentAttendancePhotoModal = showStudentAttendancePhotoModal;
window.setAttendancePhotoAsStudentProfile = setAttendancePhotoAsStudentProfile;
