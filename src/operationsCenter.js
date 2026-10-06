// Operations Center V1
(function () {
    'use strict';

    const TAB_META = [
        ['health', 'Kesehatan Sistem', 'fa-heart-pulse'],
        ['audit', 'Audit Log', 'fa-shield-halved'],
        ['deployments', 'Versi & Rollback', 'fa-code-branch'],
        ['notifications', 'Notifikasi & Pengumuman', 'fa-bell'],
        ['permissions', 'Izin & Role', 'fa-user-lock'],
        ['backup', 'Backup Integrity', 'fa-box-archive'],
        ['storage', 'Smart Storage', 'fa-hard-drive'],
        ['proctor', 'Mode Proktor', 'fa-user-shield'],
        ['analytics', 'Analitik', 'fa-chart-line']
    ];
    let currentTab = 'health';
    let lastConfig = null;
    let bellPoll = null;
    let lastNotificationRows = [];

    function state() { return window.appState || {}; }
    function role() { return String(state().role || state().currentUser?.role || '').toLowerCase(); }
    function isAdmin() { return ['admin', 'administrator', 'bos', 'boss', 'superadmin'].includes(role()); }
    function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c])); }
    function attr(v) { return esc(v).replace(/\x60/g, '&#096;'); }
    function fmtBytes(v) {
        const n = Number(v || 0);
        if (!Number.isFinite(n) || n <= 0) return '0 B';
        const u = ['B','KB','MB','GB','TB']; let x=n, i=0;
        while (x >= 1024 && i < u.length - 1) { x /= 1024; i++; }
        return (i === 0 ? Math.round(x) : x.toFixed(x >= 10 ? 1 : 2)) + ' ' + u[i];
    }
    function fmtDate(v) {
        if (!v) return '-';
        const d = new Date(v);
        return Number.isNaN(d.getTime()) ? esc(v) : d.toLocaleString('id-ID');
    }
    function notify(msg, type='info') {
        if (window.showToast) window.showToast(msg, type);
        else alert(msg);
    }
    async function api(url, options={}) {
        const res = await fetch(url, { cache:'no-store', ...options, headers:{ 'Content-Type':'application/json', ...(options.headers || {}) } });
        const data = await res.json().catch(() => ({ success:false, message:'Respons server tidak valid.' }));
        if (!res.ok || data.success === false) throw new Error(data.message || ('HTTP ' + res.status));
        return data;
    }
    function loading(text='Memuat data...') {
        return '<div class="bg-white border border-slate-100 rounded-3xl p-10 text-center text-slate-400"><i class="fa-solid fa-spinner fa-spin mr-2"></i>'+esc(text)+'</div>';
    }
    function errorCard(err) {
        return '<div class="bg-rose-50 border border-rose-200 rounded-3xl p-5 text-rose-700 text-sm"><i class="fa-solid fa-triangle-exclamation mr-2"></i>'+esc(err?.message || err || 'Terjadi kesalahan')+'</div>';
    }
    function metric(label, value, icon='fa-circle-info', sub='') {
        return '<div class="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm"><div class="flex items-center gap-3"><div class="w-10 h-10 rounded-2xl bg-slate-100 text-slate-700 flex items-center justify-center"><i class="fa-solid '+icon+'"></i></div><div><p class="text-[10px] uppercase tracking-wider text-slate-400 font-bold">'+esc(label)+'</p><p class="text-xl font-black text-slate-900">'+esc(value)+'</p></div></div>'+(sub?'<p class="text-[11px] text-slate-500 mt-3">'+esc(sub)+'</p>':'')+'</div>';
    }
    function clientExamNotifications() {
        const now=Date.now(), r=role(), user=state().currentUser||{}, classId=String(user.classId||user.class_id||''), list=Array.isArray(state().exams)?state().exams:[];
        const studentRole=['student','siswa','murid','class_leader','ketua_kelas'].includes(r);
        return list.map(ex=>{
            if(!ex || String(ex.recordType||'').toUpperCase()==='EVENT' || String(ex.status||'Active').toLowerCase()==='draft') return null;
            const date=String(ex.date||'').trim(), time=String(ex.startTime||'07:30').trim();
            if(!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{1,2}:\d{2}/.test(time)) return null;
            if(studentRole){
                const classes=Array.isArray(ex.classes)?ex.classes.map(x=>String(x)):[];
                if(classes.length && !classes.includes('ALL') && (!classId || !classes.includes(classId))) return null;
            }
            const start=new Date(date+'T'+(time.length===5?time+':00':time));
            const startMs=start.getTime(); if(!Number.isFinite(startMs)) return null;
            const diff=startMs-now; if(diff<0 || diff>60*60*1000) return null;
            const mins=Math.max(1,Math.ceil(diff/60000));
            return {id:'GEN_EXAM_'+String(ex.id||date+'_'+time),type:'info',title:'Ujian akan dimulai',message:String(ex.title||ex.subject||'Ujian')+' dimulai sekitar '+mins+' menit lagi ('+time+').',createdAt:new Date(now).toISOString(),read:false,source:'exam_schedule',targetRoute:'exam_schedule'};
        }).filter(Boolean);
    }
    function normalizeNotificationRows(rows) {
        const localRead=generatedReadIds(), map=new Map();
        for(const item of [...clientExamNotifications(),...(Array.isArray(rows)?rows:[])]){
            if(!item||!item.id) continue;
            if(String(item.targetRoute||'').trim()==='ops_backup') continue;
            const row=String(item.id).startsWith('GEN_')&&localRead.has(String(item.id))?{...item,read:true}:item;
            if(!map.has(String(row.id))) map.set(String(row.id),row);
        }
        return Array.from(map.values()).sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||''))).slice(0,100);
    }
    function followOpsNotification(row) {
        const target=String(row?.targetRoute||'').trim();
        if(!target) return false;
        document.getElementById('ops-notification-panel')?.remove();
        if(target==='exam_schedule'){
            if(['student','siswa','murid','class_leader','ketua_kelas'].includes(role())) {
                if(window.navigateTo) window.navigateTo('asesmen_siswa');
            } else {
                state().lastAssessmentSubTab='jadwal';
                if(window.navigateTo) window.navigateTo('asesmen');
            }
            return true;
        }
        if(target==='exam_evaluation'||target==='ops_recovery'){
            if(['student','siswa','murid','class_leader','ketua_kelas'].includes(role())) {
                if(window.navigateTo) window.navigateTo('asesmen_siswa');
            } else {
                state().lastAssessmentSubTab='evaluasi';
                state().activeMonitoringExamId=null;
                if(window.navigateTo) window.navigateTo('asesmen');
            }
            return true;
        }
        const tabMap={ops_health:'health',ops_storage:'storage',ops_permissions:'permissions',ops_analytics:'analytics'};
        const tab=tabMap[target];
        if(tab){
            currentTab=tab;
            if(window.navigateTo) window.navigateTo('operations');
            return true;
        }
        return false;
    }

    function allowed(tab) {
        if (isAdmin()) return true;
        if (tab === 'notifications') return false;
        const p = lastConfig?.roles?.[role()] || {};
        return p[tab] === true || (tab === 'proctor' && p.proctor);
    }
    async function ensureConfig() {
        try { const d = await api('/api/ops/config'); lastConfig = d.config || {}; }
        catch (_) { lastConfig = {}; }
        return lastConfig;
    }

    async function renderOperationsCenter(container, preferredTab) {
        if (!container) return;
        const r = role();
        if (['student','murid','class_leader','ketua_kelas'].includes(r)) {
            container.innerHTML = '<div class="max-w-xl mx-auto bg-white border rounded-3xl p-8 text-center"><i class="fa-solid fa-lock text-3xl text-slate-400 mb-3"></i><h2 class="font-bold text-slate-800">Pusat Operasi khusus petugas</h2><p class="text-xs text-slate-500 mt-2">Notifikasi Anda tetap tersedia melalui ikon lonceng.</p></div>';
            return;
        }
        await ensureConfig();
        const permittedTabs = TAB_META.filter(([id]) => allowed(id));
        if (!permittedTabs.length) {
            container.innerHTML = '<div class="max-w-xl mx-auto bg-white border rounded-3xl p-8 text-center"><i class="fa-solid fa-lock text-3xl text-slate-400 mb-3"></i><h2 class="font-bold text-slate-800">Belum ada fitur operasional yang diizinkan</h2><p class="text-xs text-slate-500 mt-2">Notifikasi tetap tersedia melalui ikon lonceng.</p></div>';
            return;
        }
        if (preferredTab && allowed(preferredTab)) currentTab = preferredTab;
        if (!permittedTabs.some(([id]) => id === currentTab)) currentTab = permittedTabs[0][0];

        const tabs = permittedTabs.map(([id,label,icon]) =>
            '<button type="button" data-ops-tab="'+id+'" onclick="switchOperationsTab(\''+id+'\')" class="ops-tab px-4 py-2.5 rounded-2xl text-xs font-bold border transition '+(currentTab===id?'bg-slate-900 text-white border-slate-900':'bg-white text-slate-600 border-slate-200 hover:bg-slate-50')+'"><i class="fa-solid '+icon+' mr-2"></i>'+label+'</button>'
        ).join('');

        container.innerHTML = '<div class="max-w-7xl mx-auto space-y-5 pb-10">'+
            '<div class="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4"><div><div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-50 text-cyan-700 text-[10px] uppercase font-black tracking-wider"><i class="fa-solid fa-shield"></i> Operations Center</div><h1 class="text-2xl font-black text-slate-900 mt-2">Pusat Operasi Madrasah Bisa</h1><p class="text-xs text-slate-500 mt-1">Monitoring, recovery, audit, penyimpanan dan analitik tanpa mengubah data inti secara sembarangan.</p></div><button onclick="refreshOperationsTab()" class="px-4 py-2.5 rounded-2xl bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-bold"><i class="fa-solid fa-rotate mr-2"></i>Refresh</button></div>'+
            '<div class="flex flex-wrap gap-2">'+tabs+'</div>'+
            '<div id="ops-content">'+loading()+'</div></div>';
        await loadTab(currentTab);
    }

    async function switchTab(tab) {
        if (!allowed(tab)) return notify('Akun ini tidak memiliki izin fitur tersebut.', 'warning');
        currentTab = tab;
        document.querySelectorAll('.ops-tab').forEach(btn => {
            const active = btn.getAttribute('data-ops-tab') === tab;
            btn.className='ops-tab px-4 py-2.5 rounded-2xl text-xs font-bold border transition '+(active?'bg-slate-900 text-white border-slate-900':'bg-white text-slate-600 border-slate-200 hover:bg-slate-50');
        });
        await loadTab(tab);
    }

    async function loadTab(tab) {
        const box=document.getElementById('ops-content'); if(!box) return;
        box.innerHTML=loading();
        try {
            if (tab==='health') return renderHealth(box);
            if (tab==='audit') return renderAudit(box);
            if (tab==='deployments') return renderDeployments(box);
            if (tab==='notifications') return renderNotifications(box);
            if (tab==='permissions') return renderPermissions(box);
            if (tab==='backup') return renderBackup(box);
            if (tab==='storage') return renderStorage(box);
            if (tab==='proctor') return renderProctor(box);
            if (tab==='analytics') return renderAnalytics(box);
        } catch (e) { box.innerHTML=errorCard(e); }
    }

    async function renderHealth(box) {
        const [h, db] = await Promise.all([api('/api/ops/health'), api('/api/db-status').catch(()=>null)]);
        const rt=h.runtime||{}, cbt=h.cbt||{}, dep=h.deployment||{};
        box.innerHTML='<div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">'+
            metric('Runtime', String(rt.mode||'-').toUpperCase(), 'fa-server', rt.cloudRun?'Cloud Run':'Local/Offline')+
            metric('Cloud SQL', rt.sqlReady?'Sehat':'Perlu cek', 'fa-database', rt.dbSource||'')+
            metric('Realtime', String((rt.sseClients||0)+(rt.websocketClients||0))+' klien', 'fa-tower-broadcast', 'SSE '+(rt.sseClients||0)+' · WS '+(rt.websocketClients||0))+
            metric('CBT Aktif', cbt.activeAttempts||0, 'fa-file-shield', 'Blocked '+(cbt.blockedAttempts||0)+' · Out '+(cbt.outOfTab||0))+
            metric('Memori RSS', fmtBytes(rt.rssBytes), 'fa-memory')+
            metric('Heap', fmtBytes(rt.heapUsedBytes), 'fa-microchip')+
            metric('Versi', dep.version||'-', 'fa-code-branch', dep.revision||'')+
            metric('Cloudinary', rt.cloudinaryConfigured?'Configured':'Belum lengkap', 'fa-cloud')+'</div>'+
            (db?'<div class="mt-5 bg-white border rounded-3xl p-5"><h3 class="font-black text-slate-800 mb-3">Diagnostik Storage</h3><div class="grid md:grid-cols-2 gap-3 text-xs"><div class="p-4 rounded-2xl bg-slate-50"><b>SQL:</b> '+esc(db.sql?.message||'-')+'<br><span class="text-slate-500">'+esc(db.sql?.details||'')+'</span></div><div class="p-4 rounded-2xl bg-slate-50"><b>Cloudinary:</b> '+esc(db.cloudinary?.message||'-')+'<br><span class="text-slate-500">'+esc(db.cloudinary?.details||'')+'</span></div></div></div>':'');
    }

    async function renderAudit(box) {
        const d=await api('/api/ops/audit?limit=250'), rows=d.logs||[];
        box.innerHTML='<div class="bg-white border rounded-3xl overflow-hidden"><div class="p-5 border-b flex justify-between"><div><h3 class="font-black text-slate-800">Audit Aktivitas</h3><p class="text-xs text-slate-400">'+rows.length+' event terbaru</p></div></div><div class="overflow-auto max-h-[65vh]"><table class="w-full text-xs"><thead class="sticky top-0 bg-slate-50"><tr><th class="p-3 text-left">Waktu</th><th class="p-3 text-left">Akun</th><th class="p-3 text-left">Aksi</th><th class="p-3 text-left">Status</th><th class="p-3 text-left">Durasi</th></tr></thead><tbody>'+rows.map(x=>'<tr class="border-t"><td class="p-3 whitespace-nowrap">'+fmtDate(x.at)+'</td><td class="p-3"><b>'+esc(x.username||x.userId)+'</b><br><span class="text-slate-400">'+esc(x.role)+'</span></td><td class="p-3"><span class="font-mono">'+esc(x.method)+'</span> '+esc(x.path)+'</td><td class="p-3">'+esc(x.statusCode)+'</td><td class="p-3">'+esc(x.durationMs)+' ms</td></tr>').join('')+'</tbody></table></div></div>';
    }

    async function renderDeployments(box) {
        const d=await api('/api/ops/deployments'), cur=d.current||{}, hist=d.history||[];
        box.innerHTML='<div class="grid lg:grid-cols-3 gap-4">'+metric('Versi Aktif',cur.version||'-','fa-code-branch',cur.revision||'')+metric('Mode',cur.mode||'-','fa-server','Uptime '+Math.floor((cur.uptimeSeconds||0)/60)+' menit')+metric('Commit',cur.commit||'Tidak disediakan platform','fa-code-commit')+'</div>'+
            '<div class="mt-5 bg-white border rounded-3xl p-5"><div class="flex flex-wrap justify-between gap-3"><div><h3 class="font-black">Checkpoint Deployment</h3><p class="text-xs text-slate-500">Rollback tidak dijalankan otomatis dari runtime agar tidak merusak data/traffic.</p></div><button onclick="createDeploymentCheckpoint()" class="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold">Simpan Checkpoint</button></div><div class="mt-4 space-y-2">'+(hist.length?hist.map(x=>'<div class="p-4 rounded-2xl bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3"><div><b>'+esc(x.label||x.version)+'</b><div class="text-[11px] text-slate-500">'+fmtDate(x.createdAt)+' · '+esc(x.revision||'')+'</div></div><button onclick="requestDeploymentRollback(\''+attr(x.id)+'\')" class="px-3 py-2 rounded-xl border text-xs font-bold text-amber-700 bg-amber-50">Minta Rollback</button></div>').join(''):'<p class="text-xs text-slate-400">Belum ada checkpoint.</p>')+'</div></div>';
    }
    async function createDeploymentCheckpoint() {
        await api('/api/ops/deployments/checkpoint',{method:'POST',body:JSON.stringify({label:'Stable '+new Date().toLocaleString('id-ID')})}); notify('Checkpoint tersimpan.','success'); loadTab('deployments');
    }
    async function requestDeploymentRollback(id) {
        if(!confirm('Catat permintaan rollback ke checkpoint ini? Kode tidak akan diganti otomatis.')) return;
        const d=await api('/api/ops/deployments/rollback-request',{method:'POST',body:JSON.stringify({checkpointId:id})}); notify(d.message||'Permintaan rollback dicatat.','success'); loadTab('deployments');
    }

    async function renderNotifications(box) {
        const d=await api('/api/ops/notifications'), rows=normalizeNotificationRows(d.notifications||[]);
        lastNotificationRows=rows;
        const compose=isAdmin()?'<div class="bg-white border rounded-3xl p-5 mb-4"><h3 class="font-black mb-3">Kirim Pengumuman</h3><div class="grid md:grid-cols-3 gap-3"><input id="ops-note-title" class="px-4 py-2.5 border rounded-2xl text-xs" placeholder="Judul"><input id="ops-note-message" class="px-4 py-2.5 border rounded-2xl text-xs md:col-span-2" placeholder="Pesan"></div><div class="mt-3 flex flex-wrap gap-2"><select id="ops-note-target" class="px-3 py-2 border rounded-xl text-xs"><option value="all">Semua</option><option value="teacher">Guru</option><option value="student">Siswa</option><option value="admin">Admin</option></select><select id="ops-note-route" class="px-3 py-2 border rounded-xl text-xs"><option value="">Tanpa tujuan klik</option><option value="exam_schedule">Jadwal Ujian</option><option value="exam_evaluation">Evaluasi CBT</option><option value="ops_health">Kesehatan Sistem</option><option value="ops_storage">Smart Storage</option></select><button onclick="sendOpsNotification()" class="px-4 py-2 bg-cyan-600 text-white rounded-xl text-xs font-bold">Kirim</button></div></div>':'';
        box.innerHTML=compose+'<div class="space-y-2">'+(rows.length?rows.map(x=>'<button onclick="readOpsNotification(\''+attr(x.id)+'\')" class="w-full text-left bg-white border rounded-2xl p-4 '+(!x.read?'border-cyan-300':'border-slate-100')+'"><div class="flex justify-between gap-3"><div><b class="text-sm text-slate-800">'+esc(x.title)+'</b><p class="text-xs text-slate-500 mt-1">'+esc(x.message)+'</p>'+(x.targetRoute?'<span class="inline-block mt-2 text-[10px] font-bold text-cyan-700">Klik untuk membuka tujuan →</span>':'')+'</div><span class="text-[10px] text-slate-400 whitespace-nowrap">'+fmtDate(x.createdAt)+'</span></div></button>').join(''):'<div class="p-8 text-center text-slate-400">Tidak ada notifikasi.</div>')+'</div>';
    }
    async function sendOpsNotification() {
        const title=document.getElementById('ops-note-title')?.value.trim(), message=document.getElementById('ops-note-message')?.value.trim(), target=document.getElementById('ops-note-target')?.value, targetRoute=document.getElementById('ops-note-route')?.value||'';
        if(!title||!message) return notify('Judul dan pesan wajib diisi.','warning');
        const targetRoles=target==='all'?[]:(target==='teacher'?['teacher','guru']:(target==='student'?['student','class_leader']:[target]));
        await api('/api/ops/notifications',{method:'POST',body:JSON.stringify({title,message,targetRoles,targetRoute,type:'info'})}); notify('Notifikasi dikirim.','success'); refreshOpsBell(); loadTab('notifications');
    }
    async function renderPermissions(box) {
        const d=await api('/api/ops/config'), cfg=d.config||{}, perms=['health','audit','deployments','notifications','permissions','backup','storage','proctor','analytics'], roles=['admin','teacher','guru','student','class_leader'];
        box.innerHTML='<div class="bg-white border rounded-3xl p-5 overflow-auto"><h3 class="font-black mb-1">Matriks Izin Operasional</h3><p class="text-xs text-slate-500 mb-4">Izin ini hanya mengatur Pusat Operasi; RBAC inti aplikasi tetap dilindungi server.</p><table class="w-full text-xs"><thead><tr><th class="p-2 text-left">Role</th>'+perms.map(p=>'<th class="p-2 text-center capitalize">'+p+'</th>').join('')+'</tr></thead><tbody>'+roles.map(r=>'<tr class="border-t"><td class="p-2 font-bold">'+r+'</td>'+perms.map(p=>'<td class="p-2 text-center"><input type="checkbox" data-ops-role="'+r+'" data-ops-perm="'+p+'" '+(cfg.roles?.[r]?.[p]?'checked':'')+' '+(r==='admin'&&(p==='permissions'||p==='audit')?'disabled':'')+'></td>').join('')+'</tr>').join('')+'</tbody></table><div class="mt-4 grid md:grid-cols-3 gap-3"><label class="text-xs">Retensi orphan (hari)<input id="ops-retention" type="number" min="1" max="90" value="'+esc(cfg.retentionDays||7)+'" class="block mt-1 w-full border rounded-xl px-3 py-2"></label><label class="text-xs">Peringatan token ≤<input id="ops-token-threshold" type="number" min="0" value="'+esc(cfg.tokenLowThreshold||5)+'" class="block mt-1 w-full border rounded-xl px-3 py-2"></label><div class="flex items-end"><button onclick="saveOpsPermissions()" class="w-full px-4 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold">Simpan Izin</button></div></div></div>';
    }
    async function saveOpsPermissions() {
        const roles={}; document.querySelectorAll('[data-ops-role]').forEach(el=>{const r=el.dataset.opsRole,p=el.dataset.opsPerm;roles[r]=roles[r]||{};roles[r][p]=el.checked;});
        const d=await api('/api/ops/config',{method:'PUT',body:JSON.stringify({roles,retentionDays:Number(document.getElementById('ops-retention')?.value||7),tokenLowThreshold:Number(document.getElementById('ops-token-threshold')?.value||5)})});
        lastConfig=d.config; notify('Matriks izin tersimpan.','success');
    }

    async function renderBackup(box) {
        const d=await api('/api/ops/backup/verifications'), rows=d.verifications||[];
        box.innerHTML='<div class="bg-white border rounded-3xl p-5"><div class="flex flex-wrap gap-3 justify-between"><div><h3 class="font-black">Backup Integrity Check</h3><p class="text-xs text-slate-500">Memeriksa struktur, duplikasi ID, hash credential, ukuran dan checksum SHA-256.</p></div><div class="flex gap-2"><button onclick="verifyCurrentBackup()" class="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold">Verifikasi Data Aktif</button><label class="px-4 py-2 bg-slate-100 rounded-xl text-xs font-bold cursor-pointer">Cek File JSON<input type="file" accept=".json,application/json" class="hidden" onchange="verifyBackupFile(event)"></label></div></div><div class="mt-4 space-y-2">'+(rows.length?rows.map(x=>'<div class="p-4 rounded-2xl '+(x.valid?'bg-emerald-50':'bg-rose-50')+'"><div class="flex justify-between"><b>'+(x.valid?'VALID':'PERLU CEK')+'</b><span class="text-[10px]">'+fmtDate(x.checkedAt)+'</span></div><p class="text-xs mt-1">Checksum: <span class="font-mono break-all">'+esc(x.sha256)+'</span></p><p class="text-xs mt-1">'+(x.issues?.length?esc(x.issues.join('; ')):'Tidak ditemukan masalah struktur.')+'</p></div>').join(''):'<p class="text-xs text-slate-400">Belum ada hasil verifikasi.</p>')+'</div></div>';
    }
    async function verifyCurrentBackup() {
        const d=await api('/api/ops/backup/verify',{method:'POST',body:'{}'}); notify(d.verification?.valid?'Backup aktif valid.':'Ditemukan catatan pada backup.',d.verification?.valid?'success':'warning'); loadTab('backup');
    }
    async function verifyBackupFile(event) {
        const file=event.target.files?.[0]; if(!file) return;
        try { const obj=JSON.parse(await file.text()); const d=await api('/api/ops/backup/verify',{method:'POST',body:JSON.stringify({backup:obj})}); notify(d.verification?.valid?'File backup valid.':'File backup perlu diperiksa.',d.verification?.valid?'success':'warning'); loadTab('backup'); }
        catch(e){ notify('File JSON tidak valid: '+e.message,'error'); }
    }

    async function renderStorage(box) {
        const d=await api('/api/ops/storage/scan'), s=d.storage||{}, cats=s.categories||[], orphans=s.orphanCandidates||[];
        box.innerHTML='<div class="grid md:grid-cols-4 gap-4">'+metric('Mode',s.mode||'-','fa-hard-drive')+metric('Managed Assets',s.referencedManagedAssets||0,'fa-image')+metric('Upload Lokal',s.uploadFiles||0,'fa-folder',fmtBytes(s.uploadBytes))+metric('Orphan Aman',orphans.length,'fa-broom','Retensi '+(s.retentionDays||7)+' hari')+'</div><div class="mt-5 grid lg:grid-cols-2 gap-4"><div class="bg-white border rounded-3xl p-5"><h3 class="font-black mb-3">Ukuran Data per Modul</h3>'+cats.map(x=>'<div class="flex justify-between py-2 border-b text-xs"><span>'+esc(x.name)+' <span class="text-slate-400">('+esc(x.records)+')</span></span><b>'+fmtBytes(x.approxBytes)+'</b></div>').join('')+'</div><div class="bg-white border rounded-3xl p-5"><div class="flex justify-between"><div><h3 class="font-black">Kandidat Orphan</h3><p class="text-[11px] text-slate-500">Cloudinary tidak pernah dihapus otomatis.</p></div>'+(s.mode==='offline'&&orphans.length?'<button onclick="cleanupSelectedOrphans()" class="px-3 py-2 bg-rose-50 text-rose-700 rounded-xl text-xs font-bold">Hapus Terpilih</button>':'')+'</div><div class="mt-3 max-h-80 overflow-auto">'+(orphans.length?orphans.map(x=>'<label class="flex items-center gap-3 py-2 border-b text-xs"><input type="checkbox" data-orphan-id="'+attr(x.id)+'"><span class="flex-1 break-all">'+esc(x.id)+'</span><b>'+fmtBytes(x.bytes)+'</b></label>').join(''):'<p class="text-xs text-slate-400 py-4">Tidak ada orphan yang melewati masa aman.</p>')+'</div></div></div>';
    }
    async function cleanupSelectedOrphans() {
        const ids=Array.from(document.querySelectorAll('[data-orphan-id]:checked')).map(x=>x.dataset.orphanId); if(!ids.length)return notify('Pilih file orphan terlebih dahulu.','warning');if(!confirm('Hapus '+ids.length+' file orphan lokal?'))return;
        const d=await api('/api/ops/storage/cleanup',{method:'POST',body:JSON.stringify({ids})});notify(d.deleted+' file dihapus.','success');loadTab('storage');
    }

    async function renderProctor(box) {
        const d=await api('/api/ops/proctors'), rows=d.assignments||[];
        const form=isAdmin()?'<div class="bg-white border rounded-3xl p-5 mb-4"><h3 class="font-black mb-3">Tunjuk Proktor Ujian</h3><div class="grid md:grid-cols-4 gap-3"><select id="ops-proctor-teacher" class="border rounded-xl px-3 py-2 text-xs"><option value="">Pilih guru</option>'+((d.teachers||[]).map(x=>'<option value="'+attr(x.id)+'">'+esc(x.name||x.nip)+'</option>').join(''))+'</select><select id="ops-proctor-exam" class="border rounded-xl px-3 py-2 text-xs md:col-span-2"><option value="">Pilih ujian</option>'+((d.exams||[]).map(x=>'<option value="'+attr(x.id)+'">'+esc(x.title)+'</option>').join(''))+'</select><div class="flex gap-2"><input id="ops-proctor-hours" type="number" min="1" max="48" value="6" class="w-20 border rounded-xl px-3 py-2 text-xs"><button onclick="assignProctor()" class="flex-1 bg-slate-900 text-white rounded-xl text-xs font-bold">Tugaskan</button></div></div></div>':'';
        box.innerHTML=form+'<div class="bg-white border rounded-3xl p-5"><h3 class="font-black">Penugasan Proktor Aktif</h3><p class="text-xs text-slate-500 mt-1">Proktor hanya mendapat monitoring gambar, pesan, dan unblock; livecam tetap admin-only.</p><div class="mt-4 space-y-2">'+(rows.length?rows.map(x=>'<div class="p-4 bg-slate-50 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3"><div><b>'+esc(x.teacherName||x.teacherId)+'</b> → '+esc(x.examName||x.examId)+'<div class="text-[10px] text-slate-400">'+fmtDate(x.startsAt)+' s/d '+fmtDate(x.endsAt)+'</div></div>'+(isAdmin()?'<button onclick="revokeProctor(\''+attr(x.id)+'\')" class="px-3 py-2 bg-rose-50 text-rose-700 rounded-xl text-xs font-bold">Cabut</button>':'')+'</div>').join(''):'<p class="text-xs text-slate-400">Belum ada penugasan.</p>')+'</div></div>';
    }
    async function assignProctor() {
        const teacherId=document.getElementById('ops-proctor-teacher')?.value, examId=document.getElementById('ops-proctor-exam')?.value, hours=Number(document.getElementById('ops-proctor-hours')?.value||6);
        if(!teacherId||!examId)return notify('Pilih guru dan ujian.','warning');
        await api('/api/ops/proctors',{method:'POST',body:JSON.stringify({teacherId,examId,hours})});notify('Proktor ditugaskan.','success');loadTab('proctor');
    }
    async function revokeProctor(id) { if(!confirm('Cabut penugasan proktor ini?'))return;await api('/api/ops/proctors/'+encodeURIComponent(id),{method:'DELETE'});notify('Penugasan dicabut.','success');loadTab('proctor'); }

    async function renderAnalytics(box) {
        const d=await api('/api/ops/analytics'), a=d.analytics||{};
        box.innerHTML='<div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">'+metric('Siswa',a.students||0,'fa-user-graduate')+metric('Guru',a.teachers||0,'fa-chalkboard-user')+metric('Kehadiran',a.attendanceRate==null?'-':a.attendanceRate+'%','fa-clipboard-check',String(a.attendanceRecords||0)+' record')+metric('Rata-rata Nilai',a.averageGrade==null?'-':a.averageGrade,'fa-star',String(a.gradeRecords||0)+' record')+metric('Ujian',a.exams||0,'fa-file-shield')+metric('Attempt Aktif',a.activeAttempts||0,'fa-person-running')+metric('Blocked',a.blockedAttempts||0,'fa-ban')+metric('Pelanggaran Tab',a.tabSwitchViolations||0,'fa-arrow-right-from-bracket')+metric('LKPD',a.lkpd||0,'fa-clipboard-list')+metric('Progress Materi',a.learningProgressRecords||0,'fa-book-open-reader')+'</div>';
    }

    function generatedReadIds() {
        try { return new Set(JSON.parse(sessionStorage.getItem('ops_generated_read') || '[]')); } catch(_) { return new Set(); }
    }
    function saveGeneratedRead(id) {
        const s=generatedReadIds(); s.add(id); sessionStorage.setItem('ops_generated_read',JSON.stringify(Array.from(s).slice(-100)));
    }
    async function readOpsNotification(id) {
        const row=lastNotificationRows.find(x=>String(x.id)===String(id))||null;
        if(String(id).startsWith('GEN_')) saveGeneratedRead(id);
        else await api('/api/ops/notifications/'+encodeURIComponent(id)+'/read',{method:'POST',body:'{}'}).catch(()=>{});
        await refreshOpsBell();
        if(row&&followOpsNotification(row)) return;
        if(currentTab==='notifications') loadTab('notifications');
    }
    async function refreshOpsBell() {
        const btn=document.getElementById('ops-notification-btn'), badge=document.getElementById('ops-notification-badge'); if(!btn||!badge||!state().currentUser)return;
        try {
            const d=await api('/api/ops/notifications'), rows=normalizeNotificationRows(d.notifications||[]), unread=rows.filter(x=>!x.read).length;
            lastNotificationRows=rows; badge.textContent=String(unread); badge.classList.toggle('hidden',unread===0); btn._opsRows=rows;
        } catch(_) {}
    }
    function toggleOpsNotifications() {
        let panel=document.getElementById('ops-notification-panel');
        if(panel){panel.remove();return;}
        const btn=document.getElementById('ops-notification-btn'), rows=btn?._opsRows||[];
        panel=document.createElement('div'); panel.id='ops-notification-panel'; panel.className='fixed right-4 top-20 z-[80] w-[min(92vw,380px)] max-h-[70vh] overflow-auto bg-white border border-slate-200 rounded-3xl shadow-2xl p-3';
        panel.innerHTML='<div class="flex items-center justify-between px-2 py-2"><b class="text-sm">Notifikasi</b>'+(isAdmin()?'<button onclick="navigateTo(\'operations\');document.getElementById(\'ops-notification-panel\')?.remove()" class="text-[11px] text-cyan-700 font-bold">Kelola Pengumuman</button>':'')+'</div>'+(rows.length?rows.slice(0,20).map(x=>'<button onclick="readOpsNotification(\''+attr(x.id)+'\')" class="w-full text-left p-3 rounded-2xl hover:bg-slate-50 '+(!x.read?'bg-cyan-50/60':'')+'"><b class="text-xs">'+esc(x.title)+'</b><p class="text-[11px] text-slate-500 mt-1">'+esc(x.message)+'</p>'+(x.targetRoute?'<span class="text-[10px] text-cyan-700 font-bold">Buka tujuan →</span>':'')+'</button>').join(''):'<div class="p-6 text-center text-xs text-slate-400">Tidak ada notifikasi.</div>');
        document.body.appendChild(panel);
    }
    function closeOpsNotificationsOnOutsideClick(event) {
        const panel=document.getElementById('ops-notification-panel');
        if(!panel) return;
        const btn=document.getElementById('ops-notification-btn');
        const target=event?.target;
        if(target && (panel.contains(target) || (btn && btn.contains(target)))) return;
        panel.remove();
    }
    function installBell() {
        const area=document.getElementById('header-right-area'); if(!area||document.getElementById('ops-notification-btn'))return;
        const btn=document.createElement('button'); btn.id='ops-notification-btn'; btn.type='button'; btn.className='relative w-10 h-10 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center'; btn.title='Notifikasi'; btn.innerHTML='<i class="fa-regular fa-bell"></i><span id="ops-notification-badge" class="hidden absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-rose-600 text-white text-[9px] font-black flex items-center justify-center">0</span>'; btn.onclick=toggleOpsNotifications;
        const logout=document.getElementById('header-logout-box'); area.insertBefore(btn,logout||null); refreshOpsBell();
    }
    function ensureBellLoop() {
        installBell();
        if(bellPoll)return;
        bellPoll=setInterval(()=>{if(state().currentUser){installBell();refreshOpsBell();}},60000);
    }

    window.renderOperationsCenter=renderOperationsCenter;
    window.switchOperationsTab=switchTab;
    window.refreshOperationsTab=()=>loadTab(currentTab);
    window.createDeploymentCheckpoint=createDeploymentCheckpoint;
    window.requestDeploymentRollback=requestDeploymentRollback;
    window.sendOpsNotification=sendOpsNotification;
    window.readOpsNotification=readOpsNotification;
    window.saveOpsPermissions=saveOpsPermissions;
    window.verifyCurrentBackup=verifyCurrentBackup;
    window.verifyBackupFile=verifyBackupFile;
    window.cleanupSelectedOrphans=cleanupSelectedOrphans;
    window.assignProctor=assignProctor;
    window.revokeProctor=revokeProctor;
    window.refreshOpsBell=refreshOpsBell;
    window.toggleOpsNotifications=toggleOpsNotifications;
    window.installOpsNotificationBell=installBell;

    document.addEventListener('click', closeOpsNotificationsOnOutsideClick, true);
    setTimeout(ensureBellLoop, 500);
    window.addEventListener('madrasah:runtime-ready',()=>setTimeout(ensureBellLoop,500));
})();
