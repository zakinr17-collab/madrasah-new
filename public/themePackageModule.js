import JSZip from 'jszip';

const MBTHEME_FORMAT = 'madrasah-bisa-theme';
const MBTHEME_MAX_ZIP = 4 * 1024 * 1024;
const MBTHEME_MAX_ASSET = 2 * 1024 * 1024;
const MBTHEME_ALLOWED_IMAGE_EXT = new Set(['png', 'jpg', 'jpeg', 'webp']);
let pendingThemePackage = null;

function esc(value) {
    return String(value ?? '').replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
}
function validHex(value, fallback) {
    const s = String(value || '').trim();
    return /^#[0-9a-fA-F]{6}$/.test(s) ? s : fallback;
}
function enumValue(value, allowed, fallback) {
    const s = String(value || '').trim();
    return allowed.includes(s) ? s : fallback;
}
function safePath(value) {
    const s = String(value || '').replace(/\\/g, '/').trim();
    if (!s || s.startsWith('/') || s.includes('../') || s.includes('/..') || s.includes(':')) return '';
    return s;
}
function normalizeManifest(raw) {
    if (!raw || typeof raw !== 'object') throw new Error('theme.json tidak valid.');
    if (raw.format !== MBTHEME_FORMAT || Number(raw.version) !== 1) throw new Error('Format tema tidak didukung. Gunakan format madrasah-bisa-theme versi 1.');
    const tokens = raw.tokens && typeof raw.tokens === 'object' ? raw.tokens : {};
    const assets = raw.assets && typeof raw.assets === 'object' ? raw.assets : {};
    return {
        format: MBTHEME_FORMAT,
        version: 1,
        name: String(raw.name || 'Tema Kustom').slice(0, 60),
        author: String(raw.author || '').slice(0, 60),
        description: String(raw.description || '').slice(0, 180),
        tokens: {
            primary: validHex(tokens.primary, '#0f766e'),
            accent: validHex(tokens.accent, '#2563eb'),
            background: validHex(tokens.background, '#f8fafc'),
            surface: validHex(tokens.surface, '#ffffff'),
            muted: validHex(tokens.muted, '#f1f5f9'),
            text: validHex(tokens.text, '#0f172a'),
            sidebar: validHex(tokens.sidebar, '#0f172a'),
            sidebarText: validHex(tokens.sidebarText, '#f8fafc'),
            radius: enumValue(tokens.radius, ['sharp','small','medium','large'], 'large'),
            style: enumValue(tokens.style, ['flat','soft','border'], 'soft'),
            font: enumValue(tokens.font, ['jakarta','system','serif','mono'], 'jakarta'),
            iconStyle: enumValue(tokens.iconStyle, ['solid','minimal'], 'solid')
        },
        assets: {
            logo: safePath(assets.logo),
            loginBackground: safePath(assets.loginBackground),
            sidebarBackground: safePath(assets.sidebarBackground)
        }
    };
}
function radiusPx(name) { return ({sharp:'2px',small:'6px',medium:'12px',large:'18px'})[name] || '18px'; }
function fontStack(name) {
    if (name === 'serif') return "Georgia, 'Times New Roman', serif";
    if (name === 'mono') return "ui-monospace, SFMono-Regular, Menlo, monospace";
    if (name === 'system') return "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    return "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
}
function resolveAssetUrl(value) {
    if (!value) return '';
    return String(value);
}
function ensureThemeStyle() {
    let style = document.getElementById('mbtheme-runtime-style');
    if (!style) {
        style = document.createElement('style');
        style.id = 'mbtheme-runtime-style';
        style.textContent = `
body.mbtheme-active{background:var(--mb-bg)!important;color:var(--mb-text);font-family:var(--mb-font)!important}
body.mbtheme-active #sidebar{background-color:var(--mb-sidebar)!important;color:var(--mb-sidebar-text)!important;background-image:var(--mb-sidebar-image,none)!important;background-size:cover!important;background-position:center!important}
body.mbtheme-active #sidebar a,body.mbtheme-active #sidebar button,body.mbtheme-active #sidebar span{color:inherit}
body.mbtheme-active header,body.mbtheme-active .bg-white{background-color:var(--mb-surface)!important}
body.mbtheme-active .bg-slate-50,body.mbtheme-active .bg-slate-100{background-color:var(--mb-muted)!important}
body.mbtheme-active .bg-emerald-600,body.mbtheme-active .bg-emerald-700,body.mbtheme-active .hover\\:bg-emerald-700:hover{background-color:var(--mb-primary)!important}
body.mbtheme-active .text-emerald-600,body.mbtheme-active .text-emerald-700,body.mbtheme-active .text-emerald-800{color:var(--mb-primary)!important}
body.mbtheme-active .border-emerald-200,body.mbtheme-active .border-emerald-500,body.mbtheme-active .border-emerald-600{border-color:var(--mb-primary)!important}
body.mbtheme-active button:not(.rounded-full),body.mbtheme-active input:not([type=checkbox]):not([type=radio]),body.mbtheme-active select,body.mbtheme-active textarea,body.mbtheme-active .rounded-xl,body.mbtheme-active .rounded-2xl,body.mbtheme-active .rounded-3xl{border-radius:var(--mb-radius)!important}
body.mbtheme-active[data-mb-style='border'] .bg-white{box-shadow:none!important;border-width:2px!important;border-color:color-mix(in srgb,var(--mb-text) 18%,transparent)!important}
body.mbtheme-active[data-mb-style='flat'] .bg-white{box-shadow:none!important}
body.mbtheme-active[data-mb-style='soft'] .bg-white{box-shadow:0 10px 30px rgba(15,23,42,.07)}
body.mbtheme-active[data-mb-icons='minimal'] .fa-solid{opacity:.78;filter:saturate(.65)}
body.mbtheme-active #login-container{background-color:var(--mb-bg)!important;background-image:var(--mb-login-image,none)!important;background-size:cover!important;background-position:center!important}
body.mbtheme-active #login-left-panel,body.mbtheme-active #login-right-panel{background-color:color-mix(in srgb,var(--mb-surface) 94%,transparent)!important}
body.mbtheme-active.mbtheme-has-logo #login-logo-box,body.mbtheme-active.mbtheme-has-logo #login-left-logo-box{background-image:var(--mb-logo-image)!important;background-size:cover!important;background-position:center!important}
body.mbtheme-active.mbtheme-has-logo #login-logo-box>*,body.mbtheme-active.mbtheme-has-logo #login-left-logo-box>*{opacity:0!important}
`;
        document.head.appendChild(style);
    }
}
function clearThemePackageVisual() {
    document.body.classList.remove('mbtheme-active','mbtheme-has-logo');
    document.body.removeAttribute('data-mb-style');
    document.body.removeAttribute('data-mb-icons');
    ['--mb-primary','--mb-accent','--mb-bg','--mb-surface','--mb-muted','--mb-text','--mb-sidebar','--mb-sidebar-text','--mb-radius','--mb-font','--mb-login-image','--mb-sidebar-image','--mb-logo-image'].forEach(k=>document.documentElement.style.removeProperty(k));
}
function applyThemePackage(pkg) {
    if (!pkg || !pkg.manifest) { clearThemePackageVisual(); return; }
    ensureThemeStyle();
    const m = normalizeManifest(pkg.manifest);
    const t = m.tokens;
    const a = pkg.assets || {};
    const root = document.documentElement.style;
    root.setProperty('--mb-primary', t.primary); root.setProperty('--mb-accent', t.accent);
    root.setProperty('--mb-bg', t.background); root.setProperty('--mb-surface', t.surface); root.setProperty('--mb-muted', t.muted);
    root.setProperty('--mb-text', t.text); root.setProperty('--mb-sidebar', t.sidebar); root.setProperty('--mb-sidebar-text', t.sidebarText);
    root.setProperty('--mb-radius', radiusPx(t.radius)); root.setProperty('--mb-font', fontStack(t.font));
    const loginBg = resolveAssetUrl(a.loginBackground); const sidebarBg = resolveAssetUrl(a.sidebarBackground); const logo = resolveAssetUrl(a.logo);
    root.setProperty('--mb-login-image', loginBg ? `url("${loginBg.replace(/"/g,'')}")` : 'none');
    root.setProperty('--mb-sidebar-image', sidebarBg ? `url("${sidebarBg.replace(/"/g,'')}")` : 'none');
    root.setProperty('--mb-logo-image', logo ? `url("${logo.replace(/"/g,'')}")` : 'none');
    document.body.classList.add('mbtheme-active');
    document.body.classList.toggle('mbtheme-has-logo', Boolean(logo));
    document.body.dataset.mbStyle = t.style; document.body.dataset.mbIcons = t.iconStyle;
}
window.applyThemePackage = applyThemePackage;
window.clearThemePackageVisual = clearThemePackageVisual;

async function persistThemeSettings() {
    const response = await fetch('/api/sync-state', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ key: 'settings', data: window.appState.settings })
    });
    const data = await response.json();
    if (!response.ok || data?.success === false) throw new Error(data?.message || 'Gagal menyimpan pengaturan tema.');
}
async function uploadThemeAsset(dataUrl) {
    const res = await fetch('/api/theme-assets/upload', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({dataUrl}) });
    const data = await res.json();
    if (!res.ok || !data.success || !data.ref) throw new Error(data.message || 'Gagal mengunggah aset tema.');
    return data.ref;
}
async function releaseThemeAssets(refs) {
    const filtered = (refs || []).filter(Boolean);
    if (!filtered.length) return;
    try { await fetch('/api/theme-assets/release', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({refs:filtered})}); } catch (_) {}
}
function getPackageAssetRefs(pkg) { return pkg?.assets ? Object.values(pkg.assets).filter(Boolean) : []; }

async function parseThemeFile(file) {
    if (!file) throw new Error('Pilih file .mbtheme terlebih dahulu.');
    if (file.size > MBTHEME_MAX_ZIP) throw new Error('Paket tema maksimal 4 MB.');
    const zip = await JSZip.loadAsync(file);
    const entries = Object.values(zip.files);
    if (entries.length > 30) throw new Error('Paket tema memiliki terlalu banyak file.');
    for (const entry of entries) {
        const path = safePath(entry.name);
        if (!path || path !== entry.name.replace(/\\/g,'/')) throw new Error('Paket mengandung path yang tidak aman.');
        if (entry.dir) continue;
        const ext = path.includes('.') ? path.split('.').pop().toLowerCase() : '';
        if (path !== 'theme.json' && !MBTHEME_ALLOWED_IMAGE_EXT.has(ext)) throw new Error(`File ${path} tidak diizinkan. Hanya theme.json dan PNG/JPG/WebP.`);
    }
    const manifestEntry = zip.file('theme.json');
    if (!manifestEntry) throw new Error('theme.json tidak ditemukan di root paket.');
    const manifestText = await manifestEntry.async('string');
    if (manifestText.length > 65536) throw new Error('theme.json terlalu besar.');
    const manifest = normalizeManifest(JSON.parse(manifestText));
    const previewAssets = {};
    for (const [key,path] of Object.entries(manifest.assets)) {
        if (!path) continue;
        const entry = zip.file(path);
        if (!entry) throw new Error(`Aset ${path} yang disebut theme.json tidak ditemukan.`);
        const ext = path.split('.').pop().toLowerCase();
        if (!MBTHEME_ALLOWED_IMAGE_EXT.has(ext)) throw new Error(`Format aset ${path} tidak diizinkan.`);
        const bytes = await entry.async('uint8array');
        if (bytes.byteLength > MBTHEME_MAX_ASSET) throw new Error(`Aset ${path} lebih dari 2 MB.`);
        const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
        const blob = new Blob([bytes], {type:mime});
        previewAssets[key] = await new Promise((resolve,reject)=>{ const r=new FileReader(); r.onload=()=>resolve(r.result); r.onerror=()=>reject(new Error('Gagal membaca aset tema.')); r.readAsDataURL(blob); });
    }
    return {manifest, previewAssets};
}

function themeStatus(html, cls='text-slate-600') {
    const el = document.getElementById('mbtheme-status'); if (el) el.innerHTML = `<div class="text-xs ${cls}">${html}</div>`;
}
async function handleThemePackageUpload(event) {
    try {
        pendingThemePackage = await parseThemeFile(event.target.files?.[0]);
        themeStatus(`<b>${esc(pendingThemePackage.manifest.name)}</b> siap dipratinjau.`, 'text-emerald-700');
        const applyBtn = document.getElementById('mbtheme-apply-btn'); if (applyBtn) applyBtn.disabled = false;
        const previewBtn = document.getElementById('mbtheme-preview-btn'); if (previewBtn) previewBtn.disabled = false;
    } catch (err) {
        pendingThemePackage = null; themeStatus(esc(err.message || err), 'text-rose-600');
    }
}
async function previewPendingTheme() {
    if (!pendingThemePackage) return;
    applyThemePackage({manifest:pendingThemePackage.manifest, assets:pendingThemePackage.previewAssets});
    themeStatus(`Pratinjau aktif: <b>${esc(pendingThemePackage.manifest.name)}</b>. Klik Terapkan untuk menyimpan.`, 'text-indigo-700');
}
async function applyPendingTheme() {
    if (!pendingThemePackage) return;
    const btn = document.getElementById('mbtheme-apply-btn'); if (btn) btn.disabled = true;
    const oldPkg = window.appState?.settings?.themePackage;
    const uploaded = {};
    try {
        for (const [key,dataUrl] of Object.entries(pendingThemePackage.previewAssets || {})) uploaded[key] = await uploadThemeAsset(dataUrl);
        if (!window.appState.settings) window.appState.settings = {};
        window.appState.settings.theme = 'package';
        window.appState.settings.themePackage = { manifest: pendingThemePackage.manifest, assets: uploaded, appliedAt: new Date().toISOString() };
        await persistThemeSettings();
        applyThemePackage(window.appState.settings.themePackage);
        await releaseThemeAssets(getPackageAssetRefs(oldPkg));
        themeStatus(`Tema <b>${esc(pendingThemePackage.manifest.name)}</b> berhasil diterapkan dan tersimpan.`, 'text-emerald-700');
        pendingThemePackage = null;
    } catch (err) {
        await releaseThemeAssets(Object.values(uploaded));
        themeStatus(esc(err.message || err), 'text-rose-600');
        if (oldPkg) applyThemePackage(oldPkg); else clearThemePackageVisual();
    } finally { if (btn) btn.disabled = false; }
}
async function resetThemePackage() {
    const oldPkg = window.appState?.settings?.themePackage;
    if (!window.appState?.settings) return;
    delete window.appState.settings.themePackage;
    window.appState.settings.theme = 'emerald';
    try {
        await persistThemeSettings();
        clearThemePackageVisual();
        if (window.applyTheme) window.applyTheme();
        await releaseThemeAssets(getPackageAssetRefs(oldPkg));
        themeStatus('Tema paket dinonaktifkan. Tema Emerald bawaan aktif.', 'text-emerald-700');
    } catch (err) { if (oldPkg) { window.appState.settings.themePackage = oldPkg; window.appState.settings.theme = 'package'; applyThemePackage(oldPkg); } themeStatus(esc(err.message || err), 'text-rose-600'); }
}
async function downloadThemeTemplate() {
    const zip = new JSZip();
    zip.file('theme.json', JSON.stringify({
        format:MBTHEME_FORMAT,version:1,name:'Akademik Modern',author:'Madrasah',description:'Contoh tema aman Madrasah Bisa',
        tokens:{primary:'#0f766e',accent:'#2563eb',background:'#f8fafc',surface:'#ffffff',muted:'#f1f5f9',text:'#0f172a',sidebar:'#0f172a',sidebarText:'#f8fafc',radius:'medium',style:'flat',font:'jakarta',iconStyle:'minimal'},
        assets:{logo:'',loginBackground:'',sidebarBackground:''}
    }, null, 2));
    const blob = await zip.generateAsync({type:'blob',compression:'DEFLATE'});
    const url = URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='contoh-akademik-modern.mbtheme'; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
}
window.handleThemePackageUpload = handleThemePackageUpload;
window.previewPendingTheme = previewPendingTheme;
window.applyPendingTheme = applyPendingTheme;
window.resetThemePackage = resetThemePackage;
window.downloadThemeTemplate = downloadThemeTemplate;

function mountThemePanel(container) {
    if (!container || document.getElementById('mbtheme-panel')) return;
    const root = container.querySelector('.space-y-6') || container;
    const current = window.appState?.settings?.themePackage;
    const panel = document.createElement('div'); panel.id='mbtheme-panel'; panel.className='bg-white p-6 sm:p-8 rounded-3xl shadow-sm border border-slate-100 space-y-4';
    panel.innerHTML = `
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div><h2 class="text-base font-bold text-slate-800"><i class="fa-solid fa-box-open text-indigo-600 mr-2"></i>Tema Paket (.mbtheme)</h2><p class="text-xs text-slate-500 mt-1">Impor tampilan deklaratif tanpa menjalankan JS/HTML/CSS dari paket. Aset gambar disimpan ke Cloudinary.</p></div>
        <span class="text-[10px] px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold">${current ? 'Aktif: '+esc(current.manifest?.name||'Tema Paket') : 'Belum aktif'}</span>
      </div>
      <div class="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
        <input id="mbtheme-file" type="file" accept=".mbtheme,.zip,application/zip" onchange="handleThemePackageUpload(event)" class="block w-full text-xs text-slate-600 file:mr-3 file:px-3 file:py-2 file:border-0 file:rounded-xl file:bg-indigo-600 file:text-white file:font-bold">
        <div class="flex flex-wrap gap-2">
          <button id="mbtheme-preview-btn" type="button" disabled onclick="previewPendingTheme()" class="px-3 py-2 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs font-bold disabled:opacity-40"><i class="fa-solid fa-eye mr-1"></i>Pratinjau</button>
          <button id="mbtheme-apply-btn" type="button" disabled onclick="applyPendingTheme()" class="px-3 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold disabled:opacity-40"><i class="fa-solid fa-check mr-1"></i>Terapkan</button>
          <button type="button" onclick="resetThemePackage()" class="px-3 py-2 rounded-xl bg-slate-200 text-slate-700 text-xs font-bold"><i class="fa-solid fa-rotate-left mr-1"></i>Kembali ke Bawaan</button>
          <button type="button" onclick="downloadThemeTemplate()" class="px-3 py-2 rounded-xl bg-white text-slate-700 border border-slate-200 text-xs font-bold"><i class="fa-solid fa-download mr-1"></i>Unduh Contoh .mbtheme</button>
        </div>
        <div id="mbtheme-status" class="min-h-5 text-xs text-slate-500">Format v1 mendukung warna, radius, gaya, font, ikon minimal/solid, serta logo/login/sidebar background PNG/JPG/WebP.</div>
      </div>`;
    root.appendChild(panel);
}

const originalRenderSetting = window.renderSettingModule;
if (typeof originalRenderSetting === 'function') {
    window.renderSettingModule = function(container) { const out = originalRenderSetting.apply(this, arguments); setTimeout(()=>mountThemePanel(container),0); return out; };
}
const originalSelectTheme = window.selectSystemTheme;
if (typeof originalSelectTheme === 'function') {
    window.selectSystemTheme = function(name) {
        const oldPkg = window.appState?.settings?.themePackage;
        if (name !== 'package') {
            clearThemePackageVisual();
            if (window.appState?.settings && oldPkg) delete window.appState.settings.themePackage;
        }
        const result = originalSelectTheme.apply(this, arguments);
        if (name !== 'package' && oldPkg) {
            Promise.resolve()
                .then(() => persistThemeSettings())
                .then(() => releaseThemeAssets(getPackageAssetRefs(oldPkg)))
                .catch(err => console.warn('Gagal membersihkan aset tema lama:', err));
        }
        return result;
    };
}
setTimeout(()=>{ if (window.appState?.settings?.theme === 'package' && window.appState.settings.themePackage) applyThemePackage(window.appState.settings.themePackage); },1200);
