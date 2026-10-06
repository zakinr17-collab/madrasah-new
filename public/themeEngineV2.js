import JSZip from 'jszip';

const V2_FORMAT = 'madrasah-bisa-theme';
const V2_MAX_ZIP = 4 * 1024 * 1024;
const V2_MAX_ASSET = 2 * 1024 * 1024;
const V2_IMAGE_EXT = new Set(['png','jpg','jpeg','webp']);
let pendingV2 = null;
let runtimeManifest = null;
let menuObserver = null;
let navigateWrapped = false;

const legacy = {
    upload: window.handleThemePackageUpload,
    preview: window.previewPendingTheme,
    apply: window.applyPendingTheme,
    reset: window.resetThemePackage,
    download: window.downloadThemeTemplate,
    applyTheme: window.applyThemePackage,
    clearTheme: window.clearThemePackageVisual,
    selectTheme: window.selectSystemTheme,
    renderSettings: window.renderSettingModule
};

const ICONS = Object.freeze({
    dashboard:'fa-solid fa-chart-line',
    home:'fa-solid fa-house',
    school:'fa-solid fa-school',
    teacher:'fa-solid fa-chalkboard-user',
    students:'fa-solid fa-users',
    schedule:'fa-regular fa-calendar-days',
    attendance:'fa-solid fa-clipboard-user',
    camera:'fa-solid fa-camera-retro',
    exam:'fa-solid fa-file-shield',
    questionBank:'fa-solid fa-book-open',
    grades:'fa-solid fa-star-half-stroke',
    lesson:'fa-solid fa-scroll',
    journal:'fa-solid fa-book-bookmark',
    calendar:'fa-regular fa-calendar-days',
    game:'fa-solid fa-gamepad',
    profile:'fa-solid fa-id-badge',
    settings:'fa-solid fa-sliders',
    chat:'fa-regular fa-comment-dots',
    boss:'fa-solid fa-crown',
    madrasah:'fa-solid fa-building-columns',
    token:'fa-solid fa-coins',
    classLeader:'fa-solid fa-id-card'
});

const ICON_PACKS = Object.freeze({
    professional:{
        dashboard:'dashboard',kelas:'school',guru:'teacher',siswa:'students',jadwal:'schedule',
        absen:'attendance',asesmen:'exam',bank_soal:'questionBank',nilai:'grades',
        modul_ajar:'lesson',modul_ajar_2:'lesson',jurnal:'journal',kalender:'calendar',
        game_edukasi:'game',profil_guru:'profile',setting:'settings',profil_siswa:'home',
        absen_siswa:'camera',asesmen_siswa:'exam',game_edukasi_siswa:'game',
        profil_ketua:'classLeader',absen_ketua:'camera',absen_kelas:'attendance',
        boss_dashboard:'boss',boss_madrasahs:'madrasah',boss_tokens:'token',chat:'chat'
    },
    academic:{
        dashboard:'home',kelas:'school',guru:'teacher',siswa:'students',jadwal:'calendar',
        absen:'attendance',asesmen:'exam',bank_soal:'questionBank',nilai:'grades',
        modul_ajar:'lesson',modul_ajar_2:'lesson',jurnal:'journal',kalender:'schedule',
        game_edukasi:'game',profil_guru:'profile',setting:'settings',profil_siswa:'home',
        absen_siswa:'camera',asesmen_siswa:'exam',game_edukasi_siswa:'game',
        profil_ketua:'classLeader',absen_ketua:'camera',absen_kelas:'attendance',
        boss_dashboard:'boss',boss_madrasahs:'madrasah',boss_tokens:'token',chat:'chat'
    },
    minimal:{
        dashboard:'home',kelas:'school',guru:'profile',siswa:'students',jadwal:'schedule',
        absen:'attendance',asesmen:'exam',bank_soal:'questionBank',nilai:'grades',
        modul_ajar:'lesson',modul_ajar_2:'lesson',jurnal:'journal',kalender:'calendar',
        game_edukasi:'game',profil_guru:'profile',setting:'settings',profil_siswa:'home',
        absen_siswa:'camera',asesmen_siswa:'exam',game_edukasi_siswa:'game',
        profil_ketua:'profile',absen_ketua:'camera',absen_kelas:'attendance',
        boss_dashboard:'home',boss_madrasahs:'madrasah',boss_tokens:'token',chat:'chat'
    }
});
const ICON_ROUTES = new Set(Object.keys(ICON_PACKS.professional));
const GROUPS = Object.freeze({
    boss_dashboard:'Overview',boss_madrasahs:'Operasional',boss_tokens:'Operasional',
    dashboard:'Overview',profil_siswa:'Overview',profil_ketua:'Overview',
    kelas:'Akademik',guru:'Akademik',siswa:'Akademik',jadwal:'Akademik',absen:'Akademik',
    absen_siswa:'Kehadiran',absen_ketua:'Kehadiran',absen_kelas:'Kehadiran',
    asesmen:'Asesmen',asesmen_siswa:'Asesmen',bank_soal:'Asesmen',nilai:'Asesmen',
    modul_ajar:'Pembelajaran',modul_ajar_2:'Pembelajaran',jurnal:'Pembelajaran',
    kalender:'Pembelajaran',game_edukasi:'Pembelajaran',game_edukasi_siswa:'Pembelajaran',
    profil_guru:'Akun & Sistem',setting:'Akun & Sistem',chat:'Akun & Sistem'
});

function esc(v){return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
function hex(v,f){const s=String(v||'').trim();return /^#[0-9a-fA-F]{6}$/.test(s)?s:f;}
function pick(v,a,f){const s=String(v||'').trim();return a.includes(s)?s:f;}
function safePath(v){const s=String(v||'').replace(/\\/g,'/').trim();if(!s||s.startsWith('/')||s.includes('../')||s.includes('/..')||s.includes(':'))return '';return s;}
function isV2(m){return Number(m?.version)===2||Number(m?.engineVersion)===2;}
function overrides(v){
    const out={};
    if(!v||typeof v!=='object'||Array.isArray(v))return out;
    for(const [route,token] of Object.entries(v)){
        if(ICON_ROUTES.has(route)&&ICONS[String(token||'').trim()])out[route]=String(token).trim();
    }
    return out;
}
function normalizeV2(raw){
    if(!raw||typeof raw!=='object'||raw.format!==V2_FORMAT||!isV2(raw))throw new Error('Tema v2 tidak valid.');
    const t=raw.tokens&&typeof raw.tokens==='object'?raw.tokens:{};
    const l=raw.layout&&typeof raw.layout==='object'?raw.layout:{};
    const c=raw.components&&typeof raw.components==='object'?raw.components:{};
    const i=raw.icons&&typeof raw.icons==='object'?raw.icons:{};
    const a=raw.assets&&typeof raw.assets==='object'?raw.assets:{};
    return {
        format:V2_FORMAT,
        version:1,
        engineVersion:2,
        name:String(raw.name||'Tema Kustom v2').slice(0,60),
        author:String(raw.author||'').slice(0,60),
        description:String(raw.description||'').slice(0,180),
        tokens:{
            primary:hex(t.primary,'#0f766e'),accent:hex(t.accent,'#2563eb'),
            background:hex(t.background,'#f8fafc'),surface:hex(t.surface,'#ffffff'),
            muted:hex(t.muted,'#f1f5f9'),text:hex(t.text,'#0f172a'),
            sidebar:hex(t.sidebar,'#0f172a'),sidebarText:hex(t.sidebarText,'#f8fafc'),
            radius:pick(t.radius,['sharp','small','medium','large'],'large'),
            style:pick(t.style,['flat','soft','border'],'soft'),
            font:pick(t.font,['jakarta','system','serif','mono'],'jakarta'),
            iconStyle:pick(t.iconStyle,['solid','minimal'],'minimal')
        },
        layout:{
            sidebar:pick(l.sidebar,['solid','floating','editorial'],'editorial'),
            sidebarWidth:pick(l.sidebarWidth,['compact','standard','wide'],'standard'),
            menuDensity:pick(l.menuDensity,['compact','comfortable','spacious'],'comfortable'),
            menuActive:pick(l.menuActive,['pill','left-accent','block','outline'],'left-accent'),
            iconContainer:pick(l.iconContainer,['none','soft','boxed'],'soft'),
            topbar:pick(l.topbar,['flat','floating','bordered'],'floating'),
            contentDensity:pick(l.contentDensity,['compact','comfortable','spacious'],'comfortable')
        },
        components:{
            cards:pick(c.cards,['soft','bordered','flat','elevated'],'bordered'),
            buttons:pick(c.buttons,['solid','soft','outline'],'solid'),
            forms:pick(c.forms,['filled','outline','minimal'],'outline')
        },
        icons:{pack:pick(i.pack,['professional','academic','minimal'],'academic'),overrides:overrides(i.overrides)},
        assets:{logo:safePath(a.logo),loginBackground:safePath(a.loginBackground),sidebarBackground:safePath(a.sidebarBackground)}
    };
}
function sidebarWidth(v){return ({compact:'244px',standard:'288px',wide:'320px'})[v]||'288px';}
function menuPadding(v){return ({compact:'8px 11px',comfortable:'11px 13px',spacious:'14px 14px'})[v]||'11px 13px';}
function contentPadding(v){return ({compact:'16px',comfortable:'24px',spacious:'32px'})[v]||'24px';}

function ensureStyle(){
    let s=document.getElementById('mbtheme-v2-style');
    if(s)return;
    s=document.createElement('style');s.id='mbtheme-v2-style';
    s.textContent=`
body.mbtheme-v2 #view-container{padding:var(--mb-v2-content-pad)!important}
body.mbtheme-v2 #sidebar{width:var(--mb-v2-sidebar-width)!important}
body.mbtheme-v2 #sidebar-menu{padding:10px!important;display:flex!important;flex-direction:column!important;gap:4px!important}
body.mbtheme-v2 #sidebar-menu .mbv2-item{position:relative!important;width:100%!important;display:flex!important;align-items:center!important;gap:11px!important;padding:var(--mb-v2-menu-pad)!important;border-radius:var(--mb-v2-menu-radius)!important;color:color-mix(in srgb,var(--mb-sidebar-text) 76%,transparent)!important;background:transparent!important;border:1px solid transparent!important;font-size:12px!important;line-height:1.2!important;font-weight:650!important;transition:background-color .16s ease,border-color .16s ease,color .16s ease,transform .16s ease!important}
body.mbtheme-v2 #sidebar-menu .mbv2-item:hover{color:var(--mb-sidebar-text)!important;background:color-mix(in srgb,var(--mb-sidebar-text) 8%,transparent)!important}
body.mbtheme-v2 #sidebar-menu .mbv2-icon{width:18px!important;min-width:18px!important;text-align:center!important;font-size:14px!important;color:color-mix(in srgb,var(--mb-sidebar-text) 72%,var(--mb-primary))!important;transition:all .16s ease!important}
body.mbtheme-v2[data-mbv2-icon='soft'] #sidebar-menu .mbv2-icon{width:32px!important;min-width:32px!important;height:32px!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;border-radius:10px!important;background:color-mix(in srgb,var(--mb-sidebar-text) 7%,transparent)!important}
body.mbtheme-v2[data-mbv2-icon='boxed'] #sidebar-menu .mbv2-icon{width:32px!important;min-width:32px!important;height:32px!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;border-radius:9px!important;border:1px solid color-mix(in srgb,var(--mb-sidebar-text) 14%,transparent)!important;background:color-mix(in srgb,var(--mb-sidebar) 88%,white)!important}
body.mbtheme-v2 #sidebar-menu .mbv2-item.mbv2-active{color:var(--mb-sidebar-text)!important}
body.mbtheme-v2[data-mbv2-active='pill'] #sidebar-menu .mbv2-item.mbv2-active{background:var(--mb-primary)!important;color:white!important;box-shadow:0 8px 20px color-mix(in srgb,var(--mb-primary) 28%,transparent)!important}
body.mbtheme-v2[data-mbv2-active='pill'] #sidebar-menu .mbv2-item.mbv2-active .mbv2-icon{color:white!important}
body.mbtheme-v2[data-mbv2-active='left-accent'] #sidebar-menu .mbv2-item.mbv2-active{background:color-mix(in srgb,var(--mb-sidebar-text) 8%,transparent)!important;color:var(--mb-sidebar-text)!important}
body.mbtheme-v2[data-mbv2-active='left-accent'] #sidebar-menu .mbv2-item.mbv2-active:before{content:'';position:absolute;left:-1px;top:8px;bottom:8px;width:3px;border-radius:4px;background:var(--mb-accent)}
body.mbtheme-v2[data-mbv2-active='left-accent'] #sidebar-menu .mbv2-item.mbv2-active .mbv2-icon{color:var(--mb-accent)!important}
body.mbtheme-v2[data-mbv2-active='block'] #sidebar-menu .mbv2-item.mbv2-active{background:color-mix(in srgb,var(--mb-primary) 26%,var(--mb-sidebar))!important;border-color:color-mix(in srgb,var(--mb-primary) 48%,transparent)!important}
body.mbtheme-v2[data-mbv2-active='outline'] #sidebar-menu .mbv2-item.mbv2-active{border-color:color-mix(in srgb,var(--mb-sidebar-text) 26%,transparent)!important}
body.mbtheme-v2 .mbv2-section{padding:13px 11px 5px!important;margin-top:3px!important;color:color-mix(in srgb,var(--mb-sidebar-text) 45%,transparent)!important;font-size:9px!important;font-weight:800!important;letter-spacing:.14em!important;text-transform:uppercase!important;pointer-events:none!important}
body.mbtheme-v2[data-mbv2-sidebar='editorial'] #sidebar>div:first-child{padding:24px 20px 18px!important;border-bottom:1px solid color-mix(in srgb,var(--mb-sidebar-text) 10%,transparent)!important}
body.mbtheme-v2[data-mbv2-sidebar='editorial'] #nav-school-name{letter-spacing:-.02em!important;font-size:13px!important}
body.mbtheme-v2[data-mbv2-sidebar='editorial'] #user-role-badge{font-size:9px!important;letter-spacing:.16em!important;color:var(--mb-accent)!important}
body.mbtheme-v2[data-mbv2-sidebar='editorial'] #nav-school-logo-container{width:38px!important;height:38px!important;border-radius:10px!important;box-shadow:none!important}
@media(min-width:1024px){body.mbtheme-v2[data-mbv2-sidebar='floating'] #sidebar{top:12px!important;bottom:12px!important;left:12px!important;height:calc(100vh - 24px)!important;border-radius:20px!important;overflow:hidden!important;box-shadow:0 20px 60px rgba(15,23,42,.22)!important;border:1px solid color-mix(in srgb,var(--mb-sidebar-text) 10%,transparent)!important}}
body.mbtheme-v2[data-mbv2-topbar='bordered'] #main-app>div.flex-1>header{box-shadow:none!important;border-bottom:1px solid color-mix(in srgb,var(--mb-text) 12%,transparent)!important}
@media(min-width:768px){body.mbtheme-v2[data-mbv2-topbar='floating'] #main-app>div.flex-1>header{top:12px!important;margin:12px 14px 0!important;border:1px solid color-mix(in srgb,var(--mb-text) 10%,transparent)!important;border-radius:16px!important;height:68px!important;box-shadow:0 10px 28px rgba(15,23,42,.08)!important}}
body.mbtheme-v2[data-mbv2-cards='flat'] #view-container .bg-white{box-shadow:none!important;border-color:transparent!important}
body.mbtheme-v2[data-mbv2-cards='bordered'] #view-container .bg-white{box-shadow:none!important;border:1px solid color-mix(in srgb,var(--mb-text) 12%,transparent)!important}
body.mbtheme-v2[data-mbv2-cards='soft'] #view-container .bg-white{box-shadow:0 8px 26px rgba(15,23,42,.055)!important;border-color:color-mix(in srgb,var(--mb-text) 7%,transparent)!important}
body.mbtheme-v2[data-mbv2-cards='elevated'] #view-container .bg-white{box-shadow:0 16px 42px rgba(15,23,42,.105)!important;border-color:color-mix(in srgb,var(--mb-text) 6%,transparent)!important}
body.mbtheme-v2[data-mbv2-buttons='soft'] .bg-emerald-600{background:color-mix(in srgb,var(--mb-primary) 14%,var(--mb-surface))!important;color:var(--mb-primary)!important;border:1px solid color-mix(in srgb,var(--mb-primary) 25%,transparent)!important;box-shadow:none!important}
body.mbtheme-v2[data-mbv2-buttons='outline'] .bg-emerald-600{background:transparent!important;color:var(--mb-primary)!important;border:1px solid var(--mb-primary)!important;box-shadow:none!important}
body.mbtheme-v2[data-mbv2-forms='filled'] input:not([type=checkbox]):not([type=radio]),body.mbtheme-v2[data-mbv2-forms='filled'] select,body.mbtheme-v2[data-mbv2-forms='filled'] textarea{background:var(--mb-muted)!important;border-color:transparent!important;box-shadow:none!important}
body.mbtheme-v2[data-mbv2-forms='outline'] input:not([type=checkbox]):not([type=radio]),body.mbtheme-v2[data-mbv2-forms='outline'] select,body.mbtheme-v2[data-mbv2-forms='outline'] textarea{background:var(--mb-surface)!important;border-color:color-mix(in srgb,var(--mb-text) 14%,transparent)!important}
body.mbtheme-v2[data-mbv2-forms='minimal'] input:not([type=checkbox]):not([type=radio]),body.mbtheme-v2[data-mbv2-forms='minimal'] select,body.mbtheme-v2[data-mbv2-forms='minimal'] textarea{background:transparent!important;border-width:0 0 1px!important;border-radius:0!important;border-color:color-mix(in srgb,var(--mb-text) 20%,transparent)!important;box-shadow:none!important}`;
    document.head.appendChild(s);
}

function routeOf(btn){
    const o=String(btn?.getAttribute('onclick')||'');
    const m=o.match(/navigateTo\(['"]([^'"]+)['"]\)/);
    if(m)return m[1];
    return /openChatWithAdmin\(/.test(o)?'chat':'';
}
function activeRoute(){return String(window.appState?.currentRoute||localStorage.getItem('madrasah_last_route')||'').trim();}
function iconFor(m,route){
    const override=m.icons?.overrides?.[route];
    if(override&&ICONS[override])return ICONS[override];
    const token=(ICON_PACKS[m.icons?.pack]||ICON_PACKS.professional)[route];
    return ICONS[token]||'';
}
function restoreMenu(){
    const menu=document.getElementById('sidebar-menu');if(!menu)return;
    menu.querySelectorAll('.mbv2-section').forEach(e=>e.remove());
    menu.querySelectorAll('.mbv2-item').forEach(b=>{b.classList.remove('mbv2-item','mbv2-active');b.removeAttribute('data-mbv2-route');});
    menu.querySelectorAll('.mbv2-icon').forEach(i=>{const o=i.dataset.mbv2Original;if(o)i.className=o;else i.classList.remove('mbv2-icon');delete i.dataset.mbv2Original;});
}
function decorateMenu(m){
    const menu=document.getElementById('sidebar-menu');if(!menu||!m)return;
    menu.querySelectorAll('.mbv2-section').forEach(e=>e.remove());
    const active=activeRoute();let last='';
    for(const btn of Array.from(menu.querySelectorAll(':scope > button'))){
        const route=routeOf(btn);if(!route)continue;
        btn.classList.add('mbv2-item');btn.dataset.mbv2Route=route;btn.classList.toggle('mbv2-active',route===active);
        const icon=btn.querySelector('i');
        if(icon){
            if(!icon.dataset.mbv2Original)icon.dataset.mbv2Original=icon.className;
            const cls=iconFor(m,route);icon.className=cls?`${cls} mbv2-icon`:`${icon.className} mbv2-icon`;
        }
        if(m.layout.sidebar==='editorial'){
            const group=GROUPS[route]||'';
            if(group&&group!==last){const label=document.createElement('div');label.className='mbv2-section';label.textContent=group;btn.before(label);last=group;}
        }
    }
}
function updateActive(){
    const active=activeRoute();
    document.querySelectorAll('#sidebar-menu .mbv2-item').forEach(b=>b.classList.toggle('mbv2-active',String(b.dataset.mbv2Route||'')===active));
}
function installObserver(){
    const menu=document.getElementById('sidebar-menu');if(!menu)return;
    if(menuObserver)menuObserver.disconnect();
    menuObserver=new MutationObserver(ms=>{
        if(!runtimeManifest)return;
        const addButton=ms.some(m=>Array.from(m.addedNodes||[]).some(n=>n?.nodeType===1&&(n.tagName==='BUTTON'||n.querySelector?.('button'))));
        if(addButton)requestAnimationFrame(()=>decorateMenu(runtimeManifest));
    });
    menuObserver.observe(menu,{childList:true,subtree:true});
}
function installNavigate(){
    if(navigateWrapped||typeof window.navigateTo!=='function')return;
    const original=window.navigateTo;
    window.navigateTo=function(){const r=original.apply(this,arguments);requestAnimationFrame(updateActive);return r;};
    navigateWrapped=true;
}
function clearV2(){
    runtimeManifest=null;restoreMenu();
    document.body.classList.remove('mbtheme-v2');
    ['data-mbv2-sidebar','data-mbv2-active','data-mbv2-icon','data-mbv2-topbar','data-mbv2-cards','data-mbv2-buttons','data-mbv2-forms'].forEach(a=>document.body.removeAttribute(a));
    ['--mb-v2-sidebar-width','--mb-v2-menu-pad','--mb-v2-menu-radius','--mb-v2-content-pad'].forEach(v=>document.documentElement.style.removeProperty(v));
}
function applyV2(pkg){
    const m=normalizeV2(pkg.manifest);runtimeManifest=m;ensureStyle();
    const r=document.documentElement.style;
    r.setProperty('--mb-v2-sidebar-width',sidebarWidth(m.layout.sidebarWidth));
    r.setProperty('--mb-v2-menu-pad',menuPadding(m.layout.menuDensity));
    r.setProperty('--mb-v2-menu-radius',m.tokens.radius==='sharp'?'3px':m.tokens.radius==='small'?'7px':m.tokens.radius==='medium'?'11px':'14px');
    r.setProperty('--mb-v2-content-pad',contentPadding(m.layout.contentDensity));
    document.body.classList.add('mbtheme-v2');
    document.body.dataset.mbv2Sidebar=m.layout.sidebar;
    document.body.dataset.mbv2Active=m.layout.menuActive;
    document.body.dataset.mbv2Icon=m.layout.iconContainer;
    document.body.dataset.mbv2Topbar=m.layout.topbar;
    document.body.dataset.mbv2Cards=m.components.cards;
    document.body.dataset.mbv2Buttons=m.components.buttons;
    document.body.dataset.mbv2Forms=m.components.forms;
    installNavigate();installObserver();requestAnimationFrame(()=>decorateMenu(m));
}

window.applyThemePackage=function(pkg){
    if(!pkg?.manifest||!isV2(pkg.manifest)){
        clearV2();
        return typeof legacy.applyTheme==='function'?legacy.applyTheme(pkg):undefined;
    }
    const compat={...pkg,manifest:normalizeV2(pkg.manifest)};
    const out=typeof legacy.applyTheme==='function'?legacy.applyTheme(compat):undefined;
    applyV2(compat);return out;
};
window.clearThemePackageVisual=function(){
    clearV2();
    if(typeof legacy.clearTheme==='function')return legacy.clearTheme();
};

async function persist(){
    const res=await fetch('/api/sync-state',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key:'settings',data:window.appState.settings})});
    const d=await res.json();if(!res.ok||d?.success===false)throw new Error(d?.message||'Gagal menyimpan tema.');
}
async function uploadAsset(dataUrl){
    const res=await fetch('/api/theme-assets/upload',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({dataUrl})});
    const d=await res.json();if(!res.ok||!d.success||!d.ref)throw new Error(d.message||'Gagal mengunggah aset tema.');return d.ref;
}
async function releaseAssets(refs){
    const f=(refs||[]).filter(Boolean);if(!f.length)return;
    try{await fetch('/api/theme-assets/release',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({refs:f})});}catch(_){}
}
function refs(pkg){return pkg?.assets?Object.values(pkg.assets).filter(Boolean):[];}

async function readManifestOnly(file){
    if(!file||file.size>V2_MAX_ZIP)return null;
    const zip=await JSZip.loadAsync(file);
    const e=zip.file('theme.json');if(!e)return null;
    const text=await e.async('string');if(text.length>65536)throw new Error('theme.json terlalu besar.');
    return JSON.parse(text);
}
async function parseV2(file){
    if(!file)throw new Error('Pilih file .mbtheme terlebih dahulu.');
    if(file.size>V2_MAX_ZIP)throw new Error('Paket tema maksimal 4 MB.');
    const zip=await JSZip.loadAsync(file);
    const entries=Object.values(zip.files);if(entries.length>30)throw new Error('Paket tema memiliki terlalu banyak file.');
    for(const e of entries){
        const p=safePath(e.name);if(!p||p!==e.name.replace(/\\/g,'/'))throw new Error('Paket mengandung path yang tidak aman.');
        if(e.dir)continue;const ext=p.includes('.')?p.split('.').pop().toLowerCase():'';
        if(p!=='theme.json'&&!V2_IMAGE_EXT.has(ext))throw new Error(`File ${p} tidak diizinkan.`);
    }
    const e=zip.file('theme.json');if(!e)throw new Error('theme.json tidak ditemukan.');
    const raw=JSON.parse(await e.async('string'));const manifest=normalizeV2(raw);const previewAssets={};
    for(const [key,p] of Object.entries(manifest.assets)){
        if(!p)continue;const ae=zip.file(p);if(!ae)throw new Error(`Aset ${p} tidak ditemukan.`);
        const ext=p.split('.').pop().toLowerCase();if(!V2_IMAGE_EXT.has(ext))throw new Error(`Format ${p} tidak diizinkan.`);
        const bytes=await ae.async('uint8array');if(bytes.byteLength>V2_MAX_ASSET)throw new Error(`Aset ${p} lebih dari 2 MB.`);
        const mime=ext==='png'?'image/png':ext==='webp'?'image/webp':'image/jpeg';
        previewAssets[key]=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(new Error('Gagal membaca aset tema.'));r.readAsDataURL(new Blob([bytes],{type:mime}));});
    }
    return {manifest,previewAssets};
}
function status(html,cls='text-slate-600'){const e=document.getElementById('mbtheme-status');if(e)e.innerHTML=`<div class="text-xs ${cls}">${html}</div>`;}

window.handleThemePackageUpload=async function(event){
    pendingV2=null;
    try{
        const file=event.target.files?.[0];const raw=await readManifestOnly(file);
        if(!raw||!isV2(raw)){
            clearV2();
            if(typeof legacy.upload==='function')return legacy.upload(event);
            throw new Error('Format tema tidak didukung.');
        }
        pendingV2=await parseV2(file);
        status(`<b>${esc(pendingV2.manifest.name)}</b> · Theme Engine v2 siap dipratinjau.`,'text-emerald-700');
        const a=document.getElementById('mbtheme-apply-btn'),p=document.getElementById('mbtheme-preview-btn');if(a)a.disabled=false;if(p)p.disabled=false;
    }catch(err){pendingV2=null;status(esc(err.message||err),'text-rose-600');}
};
window.previewPendingTheme=async function(){
    if(!pendingV2){clearV2();return typeof legacy.preview==='function'?legacy.preview():undefined;}
    window.applyThemePackage({manifest:pendingV2.manifest,assets:pendingV2.previewAssets});
    status(`Pratinjau v2 aktif: <b>${esc(pendingV2.manifest.name)}</b>.`,'text-indigo-700');
};
window.applyPendingTheme=async function(){
    if(!pendingV2){return typeof legacy.apply==='function'?legacy.apply():undefined;}
    const btn=document.getElementById('mbtheme-apply-btn');if(btn)btn.disabled=true;
    const old=window.appState?.settings?.themePackage,uploaded={};
    try{
        for(const [k,v] of Object.entries(pendingV2.previewAssets||{}))uploaded[k]=await uploadAsset(v);
        if(!window.appState.settings)window.appState.settings={};
        window.appState.settings.theme='package';
        window.appState.settings.themePackage={manifest:pendingV2.manifest,assets:uploaded,appliedAt:new Date().toISOString()};
        await persist();window.applyThemePackage(window.appState.settings.themePackage);await releaseAssets(refs(old));
        status(`Tema v2 <b>${esc(pendingV2.manifest.name)}</b> berhasil diterapkan.`,'text-emerald-700');pendingV2=null;
    }catch(err){await releaseAssets(Object.values(uploaded));status(esc(err.message||err),'text-rose-600');if(old)window.applyThemePackage(old);else window.clearThemePackageVisual();}
    finally{if(btn)btn.disabled=false;}
};
window.resetThemePackage=async function(){
    pendingV2=null;clearV2();
    if(typeof legacy.reset==='function')return legacy.reset();
};
window.downloadThemeTemplate=async function(){
    const zip=new JSZip();
    zip.file('theme.json',JSON.stringify({
        format:V2_FORMAT,version:2,name:'Nusa Academic Editorial',author:'Madrasah',
        description:'Contoh aman Theme Engine v2.',
        tokens:{primary:'#2f6a5d',accent:'#b88a44',background:'#f4f2ec',surface:'#fffefa',muted:'#eae7df',text:'#17201e',sidebar:'#17211f',sidebarText:'#f7f3ea',radius:'medium',style:'soft',font:'jakarta',iconStyle:'minimal'},
        layout:{sidebar:'editorial',sidebarWidth:'standard',menuDensity:'comfortable',menuActive:'left-accent',iconContainer:'soft',topbar:'floating',contentDensity:'comfortable'},
        components:{cards:'bordered',buttons:'solid',forms:'outline'},
        icons:{pack:'academic',overrides:{dashboard:'dashboard',setting:'settings',asesmen:'exam'}},
        assets:{logo:'',loginBackground:'',sidebarBackground:''}
    },null,2));
    const blob=await zip.generateAsync({type:'blob',compression:'DEFLATE'}),url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download='contoh-theme-engine-v2.mbtheme';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};

function refreshPanel(){
    const panel=document.getElementById('mbtheme-panel');if(!panel)return;
    const h=panel.querySelector('h2'),p=panel.querySelector('h2 + p'),st=document.getElementById('mbtheme-status'),dl=panel.querySelector('button[onclick="downloadThemeTemplate()"]');
    if(h)h.innerHTML='<i class="fa-solid fa-sliders text-indigo-600 mr-2"></i>Theme Engine (.mbtheme)';
    if(p)p.textContent='v2 dapat mengubah sidebar, susunan menu, topbar, kartu, form, density, dan ikon semantik dari allowlist Font Awesome profesional—tanpa menjalankan JS/HTML/CSS dari paket.';
    if(st)st.textContent='Kompatibel dengan tema v1. Tema v2 memakai preset layout/component dan icon token tervalidasi.';
    if(dl)dl.innerHTML='<i class="fa-solid fa-download mr-1"></i>Unduh Contoh v2';
    const badge=panel.querySelector('span.text-\\[10px\\]');
    const current=window.appState?.settings?.themePackage;
    if(badge&&current?.manifest&&isV2(current.manifest))badge.textContent=`Aktif: ${current.manifest.name||'Tema Paket'} · v2`;
}
if(typeof legacy.renderSettings==='function'){
    window.renderSettingModule=function(container){const out=legacy.renderSettings.apply(this,arguments);setTimeout(refreshPanel,20);return out;};
}
if(typeof legacy.selectTheme==='function'){
    window.selectSystemTheme=function(name){if(name!=='package')clearV2();return legacy.selectTheme.apply(this,arguments);};
}

setTimeout(()=>{
    installNavigate();installObserver();refreshPanel();
    const pkg=window.appState?.settings?.themePackage;
    if(window.appState?.settings?.theme==='package'&&pkg?.manifest&&isV2(pkg.manifest))window.applyThemePackage(pkg);
},1350);
