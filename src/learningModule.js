// Madrasah Bisa - Materi / Belajar
// Isolated learning layer. Reuses lessonPlans for material persistence and links to existing LKPD/CBT.
// It intentionally does not alter CBT session/recovery/answer hot paths.

const STUDENT_ROLES = new Set(['student', 'siswa', 'class_leader', 'ketua_kelas']);
const STAFF_ROLES = new Set(['teacher', 'guru', 'admin', 'administrator', 'bos', 'superadmin']);
const LEARNING_QUEUE_KEY = 'madrasah_learning_progress_queue_v2';
const LEGACY_LEARNING_QUEUE_KEY = 'madrasah_learning_progress_queue_v1';
const LEARNING_CHECKPOINT_SECONDS = 12;

function learningState() { return window.appState || {}; }
function learningRole() {
    const state = learningState();
    return String(state.role || state.currentUser?.role || '').toLowerCase();
}
function learningEsc(value) {
    const raw = String(value === undefined || value === null ? '' : value);
    return typeof window.escapeHtml === 'function'
        ? window.escapeHtml(raw)
        : raw.replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}
function learningAttr(value) { return learningEsc(value).replace(/`/g, '&#96;'); }
function learningInlineArg(value) {
    return learningAttr(JSON.stringify(String(value === undefined || value === null ? '' : value))
        .replace(/</g, '\\u003c')
        .replace(/>/g, '\\u003e')
        .replace(/&/g, '\\u0026'));
}
function learningToast(message, type = 'info') {
    if (typeof window.showToast === 'function') window.showToast(message, type);
    else console.log(message);
}
function featureEnabled(key) {
    const settings = learningState().settings || {};
    const map = settings.studentFeatures || {};
    const defaults = { attendance: true, learning: true, cbt: true, games: true };
    if (key === 'learning' && settings.learningModuleEnabled === false) return false;
    if (key === 'games' && settings.gameModuleEnabled === false) return false;
    return map[key] === undefined ? defaults[key] !== false : map[key] !== false;
}
function currentStudentId() {
    const state = learningState();
    return String(state.currentUser?.id || '');
}
function learningSessionIdentity() {
    const state = learningState();
    const user = state.currentUser || {};
    const role = learningRole();
    const studentId = String(user.id || '').trim();
    const tenantId = String(
        user.madrasahId ||
        user.madrasahSlug ||
        window.__activeTenant?.id ||
        window.__activeTenant?.slug ||
        'default'
    ).trim() || 'default';
    const authToken = typeof window.getStoredAuthToken === 'function'
        ? String(window.getStoredAuthToken() || '').trim()
        : String(user.token || '').trim();
    return {
        role,
        studentId,
        tenantId,
        authenticatedStudent: Boolean(authToken && studentId && STUDENT_ROLES.has(role))
    };
}
function learningQueueStorageKey() {
    const identity = learningSessionIdentity();
    if (!identity.authenticatedStudent) return '';
    return `${LEARNING_QUEUE_KEY}:${encodeURIComponent(identity.tenantId)}:${encodeURIComponent(identity.studentId)}`;
}
function canSyncLearningProgress() {
    const identity = learningSessionIdentity();
    return identity.authenticatedStudent && (typeof navigator === 'undefined' || navigator.onLine !== false);
}
function progressForMaterial(materialId) {
    const state = learningState();
    const ownId = currentStudentId();
    const rows = Array.isArray(state.learningProgress) ? state.learningProgress : [];
    return rows.find(row => String(row.materialId || '') === String(materialId) && String(row.studentId || '') === ownId) || null;
}
function isCompleted(materialId) {
    const progress = progressForMaterial(materialId);
    return Boolean(progress && (progress.status === 'completed' || Number(progress.progressPercent || 0) >= 100));
}
function materialLocked(material) {
    const prereq = Array.isArray(material?.prerequisiteMaterialIds) ? material.prerequisiteMaterialIds : [];
    return prereq.some(id => !isCompleted(id));
}
function learningPolicy(material) {
    const policy = material?.engagementPolicy || {};
    return {
        minActiveSeconds: Math.max(0, Math.min(3600, Number(policy.minActiveSeconds ?? material?.minActiveSeconds ?? 45) || 0)),
        requireAllBlocks: policy.requireAllBlocks === false ? false : true
    };
}
function materialBlockIds(material) {
    return (Array.isArray(material?.blocks) ? material.blocks : [])
        .map((block, index) => String(block.id || `block_${index + 1}`));
}
function engagementReady(material) {
    const tracker = learningState().__activeLearningTracker;
    if (!tracker || String(tracker.materialId) !== String(material?.id || '')) return { ready: false, message: 'Buka materi terlebih dahulu.' };
    const policy = learningPolicy(material);
    const activeSeconds = trackerActiveSeconds(tracker);
    if (activeSeconds < policy.minActiveSeconds) {
        return { ready: false, message: `Baca materi minimal ${policy.minActiveSeconds} detik aktif sebelum lanjut.` };
    }
    if (policy.requireAllBlocks) {
        const required = materialBlockIds(material);
        const seen = new Set(Array.from(tracker.viewedBlockIds || []).map(String));
        if (required.length > 0 && !required.every(id => seen.has(id))) {
            return { ready: false, message: 'Lihat semua bagian materi terlebih dahulu.' };
        }
    }
    return { ready: true };
}
function trackerActiveSeconds(tracker) {
    if (!tracker) return 0;
    const live = tracker.active && !document.hidden ? Date.now() - tracker.lastStartedAt : 0;
    return Math.floor((tracker.activeMs + Math.max(0, live)) / 1000);
}
function learningProgressSnapshot(material) {
    return material?.progress || progressForMaterial(material?.id) || null;
}
function mergeLearningProgressSnapshot(base, payload, pendingSync = false) {
    const previous = base && typeof base === 'object' ? base : {};
    const incoming = payload && typeof payload === 'object' ? payload : {};
    const previousCompleted = previous.status === 'completed' || Number(previous.progressPercent || 0) >= 100;
    const incomingCompleted = incoming.status === 'completed' || Number(incoming.progressPercent || 0) >= 100;
    const viewedBlockIds = Array.from(new Set([
        ...(Array.isArray(previous.viewedBlockIds) ? previous.viewedBlockIds : []),
        ...(Array.isArray(incoming.viewedBlockIds) ? incoming.viewedBlockIds : [])
    ].map(value => String(value || '').trim()).filter(Boolean)));
    return {
        ...previous,
        ...incoming,
        materialId: String(incoming.materialId || previous.materialId || ''),
        studentId: String(previous.studentId || currentStudentId()),
        status: previousCompleted || incomingCompleted ? 'completed' : 'in_progress',
        progressPercent: previousCompleted || incomingCompleted
            ? 100
            : Math.max(Number(previous.progressPercent || 0), Number(incoming.progressPercent || 0), 10),
        activeSeconds: Math.max(Number(previous.activeSeconds || 0), Number(incoming.activeSeconds || 0)),
        viewedBlockIds,
        updatedAt: new Date().toISOString(),
        pendingSync
    };
}
function replaceLearningProgressSnapshot(snapshot) {
    if (!snapshot?.materialId) return;
    const state = learningState();
    const ownId = currentStudentId();
    const rows = Array.isArray(state.learningProgress) ? state.learningProgress : [];
    state.learningProgress = rows.filter(row =>
        !(String(row.materialId || '') === String(snapshot.materialId) &&
          String(row.studentId || ownId) === ownId)
    );
    state.learningProgress.push(snapshot);
    const material = (window.__learningMaterials || []).find(item => String(item.id) === String(snapshot.materialId));
    if (material) material.progress = snapshot;
}
function checkpointPayloadForTracker(tracker) {
    const previous = progressForMaterial(tracker?.materialId);
    return {
        materialId: tracker?.materialId,
        status: 'in_progress',
        progressPercent: Math.max(10, Number(previous?.progressPercent || 0)),
        activeSeconds: trackerActiveSeconds(tracker),
        viewedBlockIds: tracker ? Array.from(tracker.viewedBlockIds || []) : []
    };
}
async function checkpointLearningTracker(tracker, options = {}) {
    if (!tracker?.materialId) return null;
    const previous = progressForMaterial(tracker.materialId);
    if (previous && (previous.status === 'completed' || Number(previous.progressPercent || 0) >= 100)) return previous;
    const payload = checkpointPayloadForTracker(tracker);
    const fingerprint = `${payload.activeSeconds}|${payload.viewedBlockIds.map(String).sort().join(',')}`;
    if (!options.force && fingerprint === tracker.lastCheckpointFingerprint) return previous;
    if (tracker.checkpointInFlight && !options.force) return previous;
    tracker.lastCheckpointFingerprint = fingerprint;
    tracker.lastCheckpointSeconds = payload.activeSeconds;
    if (options.keepalive) queueLearningProgress(payload);
    tracker.checkpointInFlight = true;
    try {
        return await postLearningProgress(payload, { silent: true, keepalive: options.keepalive === true });
    } finally {
        tracker.checkpointInFlight = false;
    }
}
function stopLearningTracker(options = {}) {
    const tracker = learningState().__activeLearningTracker;
    if (!tracker) return;
    if (tracker.active) tracker.activeMs += Math.max(0, Date.now() - tracker.lastStartedAt);
    tracker.active = false;
    if (options.checkpoint !== false) {
        void checkpointLearningTracker(tracker, { force: true, keepalive: true });
    }
    if (tracker.interval) window.clearInterval(tracker.interval);
    if (tracker.observer) tracker.observer.disconnect();
    window.removeEventListener('scroll', tracker.onScroll, true);
    window.removeEventListener('focus', tracker.onFocus);
    window.removeEventListener('blur', tracker.onBlur);
    window.removeEventListener('pagehide', tracker.onPageHide);
    document.removeEventListener('visibilitychange', tracker.onVisibility);
    learningState().__activeLearningTracker = null;
}
function startLearningTracker(material) {
    stopLearningTracker();
    const savedProgress = learningProgressSnapshot(material) || {};
    const savedActiveSeconds = Math.max(0, Number(savedProgress.activeSeconds || 0));
    const tracker = {
        materialId: String(material.id),
        activeMs: savedActiveSeconds * 1000,
        lastStartedAt: Date.now(),
        active: !document.hidden && document.hasFocus(),
        viewedBlockIds: new Set(Array.isArray(savedProgress.viewedBlockIds) ? savedProgress.viewedBlockIds.map(String) : []),
        lastCheckpointSeconds: savedActiveSeconds,
        lastCheckpointFingerprint: '',
        checkpointInFlight: false,
        observer: null,
        onScroll: null,
        onFocus: null,
        onBlur: null,
        onVisibility: null,
        onPageHide: null
    };
    const pause = (persist = true) => {
        if (tracker.active) {
            tracker.activeMs += Math.max(0, Date.now() - tracker.lastStartedAt);
            tracker.active = false;
        }
        if (persist) void checkpointLearningTracker(tracker, { force: true, keepalive: true });
    };
    const resume = () => {
        if (tracker.active || document.hidden || !document.hasFocus()) return;
        tracker.lastStartedAt = Date.now();
        tracker.active = true;
    };
    const markVisibleBlocks = () => {
        document.querySelectorAll('[data-learning-block-id]').forEach(el => {
            const rect = el.getBoundingClientRect();
            const visible = rect.top < window.innerHeight * 0.85 && rect.bottom > window.innerHeight * 0.15;
            if (visible) tracker.viewedBlockIds.add(String(el.getAttribute('data-learning-block-id') || ''));
        });
        updateEngagementUi(material);
    };
    tracker.onScroll = () => window.requestAnimationFrame(markVisibleBlocks);
    tracker.onFocus = resume;
    tracker.onBlur = () => pause(true);
    tracker.onVisibility = () => document.hidden ? pause(true) : resume();
    tracker.onPageHide = () => pause(true);
    window.addEventListener('scroll', tracker.onScroll, true);
    window.addEventListener('focus', tracker.onFocus);
    window.addEventListener('blur', tracker.onBlur);
    window.addEventListener('pagehide', tracker.onPageHide);
    document.addEventListener('visibilitychange', tracker.onVisibility);
    if ('IntersectionObserver' in window) {
        tracker.observer = new IntersectionObserver(entries => {
            entries.forEach(entry => {
                if (entry.isIntersecting && entry.intersectionRatio >= 0.55) {
                    tracker.viewedBlockIds.add(String(entry.target.getAttribute('data-learning-block-id') || ''));
                }
            });
            updateEngagementUi(material);
        }, { threshold: [0.55] });
        document.querySelectorAll('[data-learning-block-id]').forEach(el => tracker.observer.observe(el));
    }
    learningState().__activeLearningTracker = tracker;
    markVisibleBlocks();
    updateEngagementUi(material);
    tracker.interval = window.setInterval(() => {
        updateEngagementUi(material);
        const currentSeconds = trackerActiveSeconds(tracker);
        if (currentSeconds - tracker.lastCheckpointSeconds >= LEARNING_CHECKPOINT_SECONDS) {
            void checkpointLearningTracker(tracker);
        }
    }, 1000);
}
window.stopLearningTrackerForNavigation = function() {
    stopLearningTracker({ checkpoint: true });
};

function learningCompletionPayload(material) {
    const tracker = learningState().__activeLearningTracker;
    return {
        materialId: material.id,
        status: 'completed',
        progressPercent: 100,
        activeSeconds: trackerActiveSeconds(tracker),
        viewedBlockIds: tracker ? Array.from(tracker.viewedBlockIds || []) : []
    };
}
function updateEngagementUi(material) {
    const tracker = learningState().__activeLearningTracker;
    if (!tracker || String(tracker.materialId) !== String(material?.id || '')) return;
    const policy = learningPolicy(material);
    const activeSeconds = trackerActiveSeconds(tracker);
    const required = materialBlockIds(material);
    const seenCount = required.filter(id => tracker.viewedBlockIds.has(id)).length;
    const ready = engagementReady(material).ready;
    const button = document.getElementById('learning-complete-button');
    if (button) {
        button.disabled = !ready;
        button.classList.toggle('opacity-60', !ready);
        button.classList.toggle('cursor-not-allowed', !ready);
    }
    const status = document.getElementById('learning-engagement-status');
    if (status) {
        status.textContent = `Aktif membaca ${Math.min(activeSeconds, policy.minActiveSeconds)}/${policy.minActiveSeconds} detik` +
            (policy.requireAllBlocks ? ` â¢ bagian terlihat ${seenCount}/${required.length || 1}` : '');
    }
}
function readLearningProgressQueue() {
    const key = learningQueueStorageKey();
    if (!key) return [];
    try {
        const parsed = JSON.parse(localStorage.getItem(key) || '[]');
        return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
        return [];
    }
}
function writeLearningProgressQueue(rows) {
    const key = learningQueueStorageKey();
    if (!key) return;
    try {
        localStorage.setItem(key, JSON.stringify((Array.isArray(rows) ? rows : []).slice(-200)));
    } catch (_) {}
}
function quarantineLegacyLearningProgressQueue() {
    // V1 used one global queue for every tenant/account. Never auto-submit it because
    // the original rows cannot be trusted to belong to the currently authenticated tenant.
    try {
        const legacy = localStorage.getItem(LEGACY_LEARNING_QUEUE_KEY);
        if (!legacy) return;
        const quarantineKey = LEGACY_LEARNING_QUEUE_KEY + '_quarantined';
        if (!localStorage.getItem(quarantineKey)) localStorage.setItem(quarantineKey, legacy);
        localStorage.removeItem(LEGACY_LEARNING_QUEUE_KEY);
    } catch (_) {}
}
function queueLearningProgress(payload) {
    const identity = learningSessionIdentity();
    if (!identity.authenticatedStudent) return;
    const rows = readLearningProgressQueue();
    const existingIndex = rows.findIndex(item => String(item?.materialId || '') === String(payload?.materialId || ''));
    const existing = existingIndex >= 0 ? rows[existingIndex] : null;
    const merged = {
        ...mergeLearningProgressSnapshot(existing, payload, true),
        studentId: identity.studentId,
        tenantId: identity.tenantId,
        queuedAt: Date.now()
    };
    if (existingIndex >= 0) rows[existingIndex] = merged;
    else rows.push(merged);
    writeLearningProgressQueue(rows);
}
function clearQueuedLearningProgress(materialId) {
    const rows = readLearningProgressQueue();
    if (!rows.length) return;
    writeLearningProgressQueue(rows.filter(item => String(item?.materialId || '') !== String(materialId || '')));
}
async function flushLearningProgressQueue() {
    const identity = learningSessionIdentity();
    if (!identity.authenticatedStudent || !canSyncLearningProgress()) return;
    const queue = readLearningProgressQueue();
    if (!queue.length) return;

    const remaining = [];
    for (let index = 0; index < queue.length; index++) {
        const item = queue[index];
        // Defensive isolation: even a manually modified queue may never submit another user's progress.
        if (String(item?.studentId || identity.studentId) !== identity.studentId) continue;
        if (item?.tenantId && String(item.tenantId) !== identity.tenantId) continue;
        try {
            const response = await fetch('/api/learning/progress', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    materialId: item.materialId,
                    status: item.status,
                    progressPercent: item.progressPercent,
                    activeSeconds: item.activeSeconds,
                    viewedBlockIds: item.viewedBlockIds
                })
            });
            const data = await response.json().catch(() => ({}));
            if (response.status === 401 || response.status === 403) {
                // Preserve this and all later rows, but stop retrying until a new valid session/online event.
                remaining.push(...queue.slice(index));
                break;
            }
            if (!response.ok || data.success === false) remaining.push(item);
            else if (data.progress) replaceLearningProgressSnapshot(data.progress);
        } catch (_) {
            remaining.push(...queue.slice(index));
            break;
        }
    }
    writeLearningProgressQueue(remaining);
}

async function loadLearningMaterials() {
    const response = await fetch('/api/learning/materials', { cache: 'no-store' });
    const data = await response.json();
    if (!response.ok || data.success === false) throw new Error(data.message || 'Gagal memuat materi.');
    const state = learningState();
    state.learningProgress = Array.isArray(data.progress) ? data.progress : (state.learningProgress || []);
    state.lessonPlans = Array.isArray(data.materials) ? data.materials : (state.lessonPlans || []);
    return Array.isArray(data.materials) ? data.materials : [];
}
async function loadLearningLinks() {
    const [lkpdResponse, examResponse] = await Promise.all([
        fetch('/api/lkpds', { cache: 'no-store' }).then(r => r.json()).catch(() => ({})),
        fetch('/api/exams', { cache: 'no-store' }).then(r => r.json()).catch(() => ({}))
    ]);
    const links = {
        lkpds: lkpdResponse.lkpdList || lkpdResponse.data || [],
        exams: examResponse.exams || examResponse.data || []
    };
    const state = learningState();
    state.lkpdList = Array.isArray(links.lkpds) ? links.lkpds : [];
    state.exams = Array.isArray(links.exams) ? links.exams : [];
    return links;
}
async function postLearningProgress(payload, options = {}) {
    const state = learningState();
    const identity = learningSessionIdentity();
    if (!identity.authenticatedStudent) {
        return { rejected: true, message: 'Progress materi hanya disimpan untuk sesi siswa yang sudah tervalidasi.' };
    }
    const previous = progressForMaterial(payload.materialId);
    const previousCompleted = previous && (previous.status === 'completed' || Number(previous.progressPercent || 0) >= 100);
    if (previousCompleted && payload.status !== 'completed' && Number(payload.progressPercent || 0) < 100) {
        return previous;
    }

    const optimistic = {
        ...mergeLearningProgressSnapshot(previous, payload, true),
        id: previous?.id || `local_${payload.materialId}_${Date.now()}`
    };
    replaceLearningProgressSnapshot(optimistic);

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        queueLearningProgress(payload);
        return optimistic;
    }

    try {
        const response = await fetch('/api/learning/progress', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            keepalive: options.keepalive === true
        });
        const data = await response.json();
        if (!response.ok || data.success === false) {
            const error = new Error(data.message || 'Progress belum tersimpan.');
            error.noOfflineQueue = response.status >= 400 && response.status < 500;
            throw error;
        }
        if (data.progress) replaceLearningProgressSnapshot(data.progress);
        clearQueuedLearningProgress(payload.materialId);
        return data.progress || optimistic;
    } catch (err) {
        if (err && err.noOfflineQueue) {
            if (previous) replaceLearningProgressSnapshot(previous);
            else {
                state.learningProgress = (state.learningProgress || []).filter(row =>
                    !(String(row.materialId || '') === String(payload.materialId) &&
                      String(row.studentId || '') === currentStudentId())
                );
            }
            if (!options.silent) learningToast(err.message || 'Progress ditolak server.', 'error');
            return { rejected: true, message: err.message || 'Progress ditolak server.' };
        }
        queueLearningProgress(payload);
        return optimistic;
    }
}
function learningAssetSrc(url) {
    const raw = String(url || '').trim();
    if (!raw) return '';
    try {
        const parsed = new URL(raw, window.location.origin);
        // Cloudinary image/video assets are already delivered securely by Cloudinary.
        // Do not proxy them through /api/learning-assets/serve: that endpoint can reject
        // otherwise valid delivery URLs with HTTP 400. Google Drive PDFs use their own route.
        if (
            parsed.protocol === 'https:' &&
            parsed.hostname === 'res.cloudinary.com' &&
            parsed.pathname.includes('/madrasah_learning_assets/')
        ) {
            if (/^\/raw\/upload\/v\d+\/madrasah_learning_assets\//i.test(parsed.pathname) && /\.pdf$/i.test(parsed.pathname)) {
                return '/api/learning-assets/inline-pdf?url=' + encodeURIComponent(raw);
            }
            return raw;
        }
    } catch (_) {}
    return raw;
}
async function hydrateProtectedLearningPdfs() {
    const frames = Array.from(document.querySelectorAll('iframe[data-learning-pdf-src]'));
    for (const frame of frames) {
        const source = String(frame.getAttribute('data-learning-pdf-src') || '').trim();
        if (!source || frame.dataset.loaded === '1') continue;
        frame.dataset.loaded = '1';
        try {
            const authToken = typeof window.getStoredAuthToken === 'function'
                ? String(window.getStoredAuthToken() || '').trim()
                : '';
            const headers = authToken
                ? { 'Authorization': 'Bearer ' + authToken, 'X-Auth-Token': authToken }
                : {};
            let requestSource = source;
            if (authToken && /^\/api\/learning-assets\/(?:drive-pdf|inline-pdf)(?:\?|$)/i.test(source)) {
                const separator = source.includes('?') ? '&' : '?';
                requestSource = source + separator + 'auth=' + encodeURIComponent(authToken);
            }
            const response = await fetch(requestSource, { cache: 'no-store', headers });
            if (!response.ok) throw new Error('HTTP ' + response.status);
            const blob = await response.blob();
            if (!blob || !blob.size) throw new Error('PDF kosong.');
            const objectUrl = URL.createObjectURL(blob);
            frame.src = objectUrl;
            frame.addEventListener('load', () => { try { URL.revokeObjectURL(objectUrl); } catch (_) {} }, { once: true });
        } catch (err) {
            frame.removeAttribute('src');
            const parent = frame.parentElement;
            if (parent) {
                const notice = document.createElement('div');
                notice.className = 'p-5 text-center text-sm font-bold text-rose-700 bg-rose-50 border-t border-rose-100';
                notice.textContent = 'PDF belum dapat ditampilkan. Silakan muat ulang halaman.';
                parent.appendChild(notice);
            }
            console.warn('[Learning PDF] Gagal memuat PDF terlindungi:', err);
        }
    }
}
// Embed only known YouTube URLs; arbitrary external links remain links to avoid
// cross-origin iframe injection. Offline installations still need internet for YouTube.
function learningYoutubeEmbedUrl(value) {
    try {
        const u = new URL(String(value || ''));
        if (u.protocol !== 'https:') return '';
        const host = u.hostname.toLowerCase();
        let id = '';
        if (host === 'youtu.be' || host === 'www.youtu.be') id = u.pathname.split('/')[1] || '';
        else if (['youtube.com', 'www.youtube.com', 'm.youtube.com'].includes(host)) {
            if (u.pathname === '/watch') id = u.searchParams.get('v') || '';
            else if (/^\/(shorts|embed|live)\/[^/]+/.test(u.pathname)) id = u.pathname.split('/')[2] || '';
        }
        if (!/^[A-Za-z0-9_-]{11}$/.test(id)) return '';
        return 'https://www.youtube-nocookie.com/embed/' + id + '?rel=0&playsinline=1';
    } catch (_) { return ''; }
}

function renderMaterialBlocks(blocks = []) {
    return blocks.map((block, index) => {
        const type = String(block.type || 'text').toLowerCase();
        const blockId = learningAttr(block.id || `block_${index + 1}`);
        if (type === 'text') {
            return `<div data-learning-block-id="${blockId}" class="whitespace-pre-wrap text-sm leading-7 text-slate-700">${learningEsc(block.content || block.text || '')}</div>`;
        }
        if (type === 'image') {
            const url = String(block.url || '');
            if (!url) return '';
            const assetSrc = learningAssetSrc(url);
            const name = learningEsc(block.name || 'Gambar materi');
            return `<figure data-learning-block-id="${blockId}" class="rounded-2xl border border-slate-100 bg-slate-50 p-3 overflow-hidden"><img src="${learningAttr(assetSrc)}" alt="${learningAttr(block.name || 'Gambar materi')}" loading="lazy" class="w-full max-h-[560px] object-contain rounded-xl bg-white"><figcaption class="mt-2 px-1 text-xs text-slate-500 font-semibold">${name}</figcaption></figure>`;
        }
        if (type === 'pdf') {
            const url = String(block.url || '');
            const driveFileId = String(block.driveFileId || '').trim();
            if (!url && !driveFileId) return '';
            const name = learningEsc(block.name || 'Materi PDF');
            const pdfSrc = learningAssetSrc(url);
            const protectedPdfSrc = driveFileId
                ? `/api/learning-assets/drive-pdf?id=${encodeURIComponent(driveFileId)}`
                : (/^\/api\/learning-assets\/inline-pdf(?:\?|$)/i.test(pdfSrc) ? pdfSrc : '');
            const frameSrc = protectedPdfSrc ? 'about:blank' : pdfSrc;
            const frameData = protectedPdfSrc ? ` data-learning-pdf-src="${learningAttr(protectedPdfSrc)}"` : '';
            return `<section data-learning-block-id="${blockId}" class="rounded-2xl border border-slate-200 overflow-hidden bg-white">
                <div class="p-3 bg-rose-50 border-b border-rose-100">
                    <div class="text-xs font-black text-rose-700"><i class="fa-solid fa-file-pdf mr-2"></i>PDF</div>
                    <div class="text-xs text-slate-600 truncate mt-0.5">${name}</div>
                </div>
                <iframe src="${learningAttr(frameSrc)}"${frameData} title="${learningAttr(block.name || 'Materi PDF')}" class="block w-full h-[700px] md:h-[820px] bg-slate-50" loading="eager"></iframe>
            </section>`;
        }
        if (type === 'video') {
            const url = String(block.url || '');
            if (!/^https?:\/\//i.test(url)) return '';
            const mime = String(block.mime || '').toLowerCase();
            const directVideo = /^video\/(mp4|webm|ogg)$/i.test(mime) || /\.(mp4|webm|ogv)(?:[?#]|$)/i.test(url);
            if (directVideo) {
                const assetSrc = learningAssetSrc(url);
                return `<section data-learning-block-id="${blockId}" class="rounded-2xl border border-slate-200 overflow-hidden bg-white"><div class="p-3 bg-violet-50 border-b border-violet-100"><div class="text-xs font-black text-violet-700"><i class="fa-solid fa-circle-play mr-2"></i>VIDEO PEMBELAJARAN</div><div class="text-xs text-slate-600 truncate mt-0.5">${learningEsc(block.name || 'Video materi')}</div></div><video controls playsinline preload="metadata" class="block w-full max-h-[720px] bg-black" src="${learningAttr(assetSrc)}">Browser Anda tidak mendukung pemutaran video.</video></section>`;
            }
            const youtubeEmbed = learningYoutubeEmbedUrl(url);
            if (youtubeEmbed) return `<section data-learning-block-id="${blockId}" class="rounded-2xl overflow-hidden border border-slate-200 bg-slate-950"><div class="p-3 text-xs font-bold text-white">Video Pembelajaran</div><iframe src="${learningAttr(youtubeEmbed)}" title="Video pembelajaran" allow="autoplay; encrypted-media; picture-in-picture" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen class="block w-full aspect-video bg-black"></iframe></section>`;
            return `<div data-learning-block-id="${blockId}"><a href="${learningAttr(url)}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold"><i class="fa-solid fa-arrow-up-right-from-square"></i>Buka Video</a></div>`;
        }
        if (type === 'link') {
            const url = String(block.url || '');
            if (!/^https?:\/\//i.test(url)) return '';
            return `<div data-learning-block-id="${blockId}"><a href="${learningAttr(url)}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold"><i class="fa-solid fa-arrow-up-right-from-square"></i>Buka Sumber</a></div>`;
        }
        return '';
    }).join('');
}
function learningEditorAssets() {
    if (!Array.isArray(window.__learningEditorAssets)) window.__learningEditorAssets = [];
    return window.__learningEditorAssets;
}
function safeBlocksFromForm() {
    const blocks = [{ type: 'text', content: document.getElementById('learning-content')?.value || '' }];
    for (const asset of learningEditorAssets()) {
        if (!asset || !['image', 'pdf', 'video'].includes(String(asset.type || ''))) continue;
        const hasUrl = Boolean(String(asset.url || '').trim());
        const hasPdfRef = String(asset.type || '').toLowerCase() === 'pdf' && (Boolean(String(asset.driveFileId || '').trim()) || hasUrl);
        if (!hasUrl && !hasPdfRef) continue;
        blocks.push({
            type: String(asset.type),
            url: String(asset.url || ''),
            driveFileId: String(asset.driveFileId || ''),
            name: String(asset.name || (asset.type === 'pdf' ? 'Materi PDF' : asset.type === 'video' ? 'Video materi' : 'Gambar materi')),
            mime: String(asset.mime || '')
        });
    }
    const videoUrl = document.getElementById('learning-video')?.value?.trim() || '';
    const resourceUrl = document.getElementById('learning-resource')?.value?.trim() || '';
    if (videoUrl) blocks.push({ type: 'video', url: videoUrl });
    if (resourceUrl) blocks.push({ type: 'link', url: resourceUrl });
    return blocks;
}
function readLearningAssetFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('File gagal dibaca.'));
        reader.readAsDataURL(file);
    });
}
function renderLearningEditorAssets() {
    const container = document.getElementById('learning-assets-list');
    if (!container) return;
    const assets = learningEditorAssets();
    if (assets.length === 0) {
        container.innerHTML = '<div class="p-4 text-center text-xs text-slate-400 border border-dashed rounded-xl">Belum ada gambar atau PDF yang disisipkan.</div>';
        return;
    }
    container.innerHTML = assets.map((asset, index) => {
        const isPdf = asset.type === 'pdf';
        const isVideo = asset.type === 'video';
        const preview = asset.preview || asset.url || '';
        const icon = isPdf
            ? '<div class="w-16 h-16 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center text-2xl"><i class="fa-solid fa-file-pdf"></i></div>'
            : isVideo
                ? '<div class="w-16 h-16 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center text-2xl"><i class="fa-solid fa-video"></i></div>'
                : `<img src="${learningAttr(preview)}" alt="" class="w-16 h-16 rounded-xl object-cover bg-slate-100 border">`;
        return `
            <div class="flex items-center gap-3 p-3 rounded-2xl border border-slate-100 bg-white">
                ${icon}
                <div class="min-w-0 flex-1">
                    <div class="text-xs font-bold text-slate-800 truncate">${learningEsc(asset.name || (isPdf ? 'Materi PDF' : 'Gambar materi'))}</div>
                    <div class="text-[10px] text-slate-400 mt-1">${isPdf ? 'PDF' : isVideo ? 'Video' : 'Gambar'}${asset.pending ? ' â¢ siap diunggah saat disimpan' : ' â¢ tersimpan'}</div>
                </div>
                <div class="flex items-center gap-1">
                    <button type="button" onclick="moveLearningEditorAsset(${index}, -1)" ${index === 0 ? 'disabled' : ''} class="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 disabled:opacity-30" title="Naik"><i class="fa-solid fa-arrow-up text-[10px]"></i></button>
                    <button type="button" onclick="moveLearningEditorAsset(${index}, 1)" ${index === assets.length - 1 ? 'disabled' : ''} class="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 disabled:opacity-30" title="Turun"><i class="fa-solid fa-arrow-down text-[10px]"></i></button>
                    <button type="button" onclick="removeLearningEditorAsset(${index})" class="w-8 h-8 rounded-lg bg-rose-50 text-rose-600" title="Hapus"><i class="fa-solid fa-trash-can text-[10px]"></i></button>
                </div>
            </div>`;
    }).join('');
}
window.handleLearningAssetSelection = async function(input) {
    const files = Array.from(input?.files || []);
    if (files.length === 0) return;
    const assets = learningEditorAssets();
    for (const file of files) {
        const mime = String(file.type || '').toLowerCase();
        const fileName = String(file.name || '');
        const isImage = ['image/jpeg', 'image/png', 'image/webp'].includes(mime);
        // Sebagian browser/HP mengirim file.type kosong untuk PDF. Ekstensi hanya
        // dipakai untuk identifikasi di sisi UI; server tetap memverifikasi signature %PDF-.
        const isPdf = mime === 'application/pdf' || /\.pdf$/i.test(fileName);
        const isVideo = ['video/mp4', 'video/webm', 'video/ogg'].includes(mime);
        if (!isImage && !isPdf && !isVideo) {
            learningToast(`${file.name}: hanya JPG, PNG, WebP, PDF, MP4, WebM, atau OGG yang didukung.`, 'warning');
            continue;
        }
        const limit = isPdf ? 15 * 1024 * 1024 : isVideo ? 18 * 1024 * 1024 : 10 * 1024 * 1024;
        if (!Number(file.size || 0)) {
            learningToast(`${file.name}: file kosong atau tidak dapat dibaca.`, 'warning');
            continue;
        }
        if (Number(file.size || 0) > limit) {
            learningToast(`${file.name}: ukuran maksimal ${isPdf ? '15 MB' : isVideo ? '18 MB' : '10 MB'}.`, 'warning');
            continue;
        }
        try {
            if (isPdf) {
                // PDF tetap berupa File/Blob sampai tombol Simpan ditekan.
                // Hindari Base64/JSON agar payload tidak membesar.
                assets.push({
                    type: 'pdf',
                    name: file.name || 'Materi.pdf',
                    mime: 'application/pdf',
                    file,
                    data: '',
                    preview: '',
                    pending: true,
                    url: ''
                });
                continue;
            }

            const data = await readLearningAssetFile(file);
            assets.push({
                type: isVideo ? 'video' : 'image',
                name: file.name || (isVideo ? 'Video materi' : 'Gambar materi'),
                mime,
                data,
                preview: isImage ? data : '',
                pending: true,
                url: ''
            });
        } catch (err) {
            learningToast(err.message || `${file.name}: gagal dibaca.`, 'error');
        }
    }
    if (input) input.value = '';
    renderLearningEditorAssets();
    window.renderLearningSelectedClasses();
};
window.removeLearningEditorAsset = function(index) {
    const assets = learningEditorAssets();
    if (index < 0 || index >= assets.length) return;
    assets.splice(index, 1);
    renderLearningEditorAssets();
};
window.moveLearningEditorAsset = function(index, delta) {
    const assets = learningEditorAssets();
    const target = index + Number(delta || 0);
    if (index < 0 || target < 0 || index >= assets.length || target >= assets.length) return;
    const [item] = assets.splice(index, 1);
    assets.splice(target, 0, item);
    renderLearningEditorAssets();
};
async function ensureLearningGoogleDriveReadyForPdf() {
    const localOfflineMode = learningState().isOfflineMode === true || window.isOfflineMode === true;
    if (localOfflineMode) return true;

    const response = await fetch('/api/google-drive/status', {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.success) {
        throw new Error(data?.message || 'Status Google Drive tidak dapat diperiksa.');
    }
    if (!data.connected) {
        throw new Error(
            data.oauthConfigured === false
                ? 'Google Drive belum siap karena konfigurasi OAuth server belum lengkap. Hubungi administrator.'
                : 'Google Drive belum terhubung untuk madrasah ini. Administrator harus menghubungkannya melalui menu Pengaturan → Google Drive Materi Pembelajaran.'
        );
    }
    return true;
}

async function parseLearningUploadResponse(response, assetName) {
    const raw = await response.text();
    let data = {};
    if (raw) {
        try { data = JSON.parse(raw); } catch (_) { data = {}; }
    }
    const hasAssetLocation = Boolean(data?.asset?.url || data?.asset?.driveFileId);
    if (!response.ok || data.success === false || !hasAssetLocation) {
        let fallback = `Gagal mengunggah ${assetName || 'lampiran'}.`;
        if (response.status === 413) fallback = `${assetName || 'PDF'} terlalu besar. Batas PDF adalah 15 MB.`;
        else if (response.status === 415) fallback = `${assetName || 'File'} bukan PDF yang valid atau formatnya tidak didukung.`;
        else if (response.status === 401 || response.status === 403) fallback = 'Sesi login tidak memiliki izin untuk mengunggah materi.';
        else if (response.status === 428) fallback = 'Google Drive belum terhubung.';
        else if (response.status === 503 && data?.code === 'GOOGLE_DRIVE_SERVER_CONFIG_REQUIRED') fallback = 'Konfigurasi Google Drive OAuth pada server belum lengkap.';
        else if (response.status >= 500) fallback = `Server gagal menyimpan ${assetName || 'lampiran'}.`;
        throw new Error(data.message || fallback);
    }
    return data;
}

async function rollbackLearningUploadedAssets(uploadedAssets = []) {
    for (const asset of uploadedAssets) {
        const url = String(asset?.url || '').trim();
        const driveFileId = String(asset?.driveFileId || '').trim();
        if (!url && !driveFileId) continue;
        try {
            await fetch('/api/learning/assets', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify({ url, driveFileId })
            });
        } catch (_) {
            // Audit/cleanup server tetap dapat menemukan orphan bila jaringan putus.
        }
    }
}

async function uploadPendingLearningAssets() {
    const assets = learningEditorAssets();
    const uploadedNow = [];
    const localOfflineMode = learningState().isOfflineMode === true || window.isOfflineMode === true;
    const hasPendingPdf = assets.some((asset) => asset?.pending && asset?.type === 'pdf' && asset?.file instanceof Blob);

    if (!localOfflineMode && hasPendingPdf) {
        await ensureLearningGoogleDriveReadyForPdf();
    }

    for (let i = 0; i < assets.length; i++) {
        const asset = assets[i];
        if (!asset?.pending) continue;

        if (!localOfflineMode && typeof navigator !== 'undefined' && navigator.onLine === false) {
            throw new Error('Koneksi internet terputus. Lampiran tetap tersimpan di editor; sambungkan internet lalu tekan Simpan/Publikasikan lagi.');
        }

        let response;
        try {
            if (asset.type === 'pdf' && asset.file instanceof Blob) {
                const endpoint = `/api/learning/assets/pdf?name=${encodeURIComponent(asset.name || 'Materi.pdf')}`;
                response = await fetch(endpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/pdf',
                        'Accept': 'application/json'
                    },
                    body: asset.file
                });
            } else {
                response = await fetch('/api/learning/assets', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                    body: JSON.stringify({ name: asset.name, data: asset.data })
                });
            }
        } catch (err) {
            if (!localOfflineMode && typeof navigator !== 'undefined' && navigator.onLine === false) {
                throw new Error('Koneksi internet terputus saat mengunggah lampiran. File tetap ada di editor dan dapat dicoba lagi setelah koneksi kembali.');
            }
            throw err;
        }

        const data = await parseLearningUploadResponse(response, asset.name);
        assets[i] = {
            type: data.asset.type,
            name: data.asset.name || asset.name,
            url: data.asset.url || '',
            driveFileId: data.asset.driveFileId || '',
            mime: data.asset.mime || asset.mime || '',
            pending: false,
            preview: data.asset.type === 'image' ? data.asset.url : ''
        };
        uploadedNow.push({ url: assets[i].url, driveFileId: assets[i].driveFileId, type: assets[i].type });
        renderLearningEditorAssets();
    }
    return uploadedNow;
}

window.renderLearningTeacher = async function(container) {
    closeLearningSplitDock();
    stopLearningTracker();
    if (!container) return;
    container.innerHTML = '<div class="p-8 text-center text-slate-400"><i class="fa-solid fa-spinner fa-spin mr-2"></i>Memuat materi...</div>';
    try {
        const [materials, links] = await Promise.all([loadLearningMaterials(), loadLearningLinks()]);
        const orderedMaterials = [...materials].sort((a, b) => {
            const aCreated = Date.parse(a?.createdAt || '');
            const bCreated = Date.parse(b?.createdAt || '');
            if (!Number.isFinite(aCreated) && !Number.isFinite(bCreated)) return 0;
            if (!Number.isFinite(aCreated)) return 1;
            if (!Number.isFinite(bCreated)) return -1;
            return bCreated - aCreated;
        });
        window.__learningLinks = links;
        window.__learningMaterials = orderedMaterials;
        const cards = orderedMaterials.map(material => {
            const linkedLkpd = links.lkpds.find(item => String(item.id) === String(material.lkpdId || ''));
            const linkedExam = links.exams.find(item => String(item.id) === String(material.examId || ''));
            const lkpdDraft = linkedLkpd && ['inactive', 'draft'].includes(String(linkedLkpd.status || '').toLowerCase());
            const examDraft = linkedExam && ['inactive', 'draft'].includes(String(linkedExam.status || '').toLowerCase());
            return `
            <div class="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-4">
                <div class="flex items-start justify-between gap-3">
                    <div>
                        <div class="text-[10px] font-bold uppercase tracking-wider text-emerald-600">${learningEsc(material.subjectName || material.subjectId || 'Materi')}</div>
                        <h3 class="font-black text-slate-800 mt-1">${learningEsc(material.title)}</h3>
                        <p class="text-xs text-slate-500 mt-1">${learningEsc(material.topic || '')}</p>
                    </div>
                    <span class="px-2 py-1 rounded-lg text-[10px] font-bold ${material.status === 'published' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}">${material.status === 'published' ? 'Terbit' : 'Draft'}</span>
                </div>
                <div class="flex flex-wrap gap-2">
                    <button type="button" onclick="openLearningMaterial(${learningInlineArg(material.id)}, true)" class="px-3 py-2 rounded-xl bg-slate-100 text-xs font-bold">Lihat</button>
                    <button type="button" onclick="showLearningEditorById(${learningInlineArg(material.id)})" class="px-3 py-2 rounded-xl bg-blue-50 text-blue-700 text-xs font-bold">Edit</button>
                    <button type="button" onclick="openLearningMonitor(${learningInlineArg(material.id)})" class="px-3 py-2 rounded-xl bg-violet-50 text-violet-700 text-xs font-bold"><i class="fa-solid fa-chart-line mr-1"></i>Monitoring</button>
                    ${material.lkpdId ? `<button type="button" onclick="openLearningLinkedActivityEditor('lkpd', ${learningInlineArg(material.lkpdId)})" class="px-3 py-2 rounded-xl ${lkpdDraft ? 'bg-amber-50 text-amber-700' : 'bg-cyan-50 text-cyan-700'} text-xs font-bold"><i class="fa-solid fa-clipboard-list mr-1"></i>${lkpdDraft ? 'Lengkapi Draft LKPD' : 'Kelola LKPD'}</button>` : ''}
                    ${material.examId ? `<button type="button" onclick="openLearningLinkedActivityEditor('exam', ${learningInlineArg(material.examId)})" class="px-3 py-2 rounded-xl ${examDraft ? 'bg-amber-50 text-amber-700' : 'bg-indigo-50 text-indigo-700'} text-xs font-bold"><i class="fa-solid fa-file-circle-check mr-1"></i>${examDraft ? 'Lengkapi & Aktifkan Asesmen' : 'Kelola Asesmen'}</button>` : ''}
                    <button type="button" onclick="deleteLearningMaterial(${learningInlineArg(material.id)})" class="px-3 py-2 rounded-xl bg-rose-50 text-rose-700 text-xs font-bold"><i class="fa-solid fa-trash-can mr-1"></i>Hapus</button>
                </div>
            </div>
        `;
        }).join('');
        container.innerHTML = `
            <div class="max-w-6xl mx-auto space-y-5 pb-10">
                <div class="flex items-center justify-between gap-3">
                    <div>
                        <h1 class="text-2xl font-black text-slate-900">Materi Pembelajaran</h1>
                        <p class="text-xs text-slate-500 mt-1">Materi dapat diteruskan ke LKPD dan/atau asesmen tanpa menggandakan engine.</p>
                    </div>
                    <button type="button" onclick="showLearningEditor()" class="px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-bold"><i class="fa-solid fa-plus mr-1"></i>Buat Materi</button>
                </div>
                <div class="grid md:grid-cols-2 xl:grid-cols-3 gap-4">${cards || '<div class="col-span-full p-10 text-center bg-white rounded-2xl border text-slate-400 text-sm">Belum ada materi.</div>'}</div>
            </div>`;
    } catch (err) {
        container.innerHTML = `<div class="p-8 text-center text-rose-600">${learningEsc(err.message || 'Gagal memuat materi.')}</div>`;
    }
};

function normalizeLearningClassTargets(values) {
    const source = Array.isArray(values) ? values : [];
    const unique = Array.from(new Set(source.map(value => String(value || '').trim()).filter(Boolean)));
    if (unique.some(value => value.toUpperCase() === 'ALL')) return ['ALL'];
    return unique;
}
function learningMaterialClassTargets(material) {
    const fromClasses = Array.isArray(material?.classes) ? material.classes : [];
    const fallback = material?.classId ? [material.classId] : [];
    const targets = normalizeLearningClassTargets(fromClasses.length ? fromClasses : fallback);
    return targets.length ? targets : ['ALL'];
}
window.renderLearningSelectedClasses = function() {
    const container = document.getElementById('learning-selected-classes');
    if (!container) return;
    const state = learningState();
    const selected = normalizeLearningClassTargets(window.__learningSelectedClasses || []);
    window.__learningSelectedClasses = selected;
    if (!selected.length) {
        container.innerHTML = '<span class="text-[11px] text-slate-400 italic">Belum ada kelas dipilih.</span>';
        return;
    }
    const classMap = new Map((state.classes || []).map(cls => [String(cls.id), cls]));
    container.innerHTML = selected.map(id => {
        const label = id === 'ALL' ? 'Semua Kelas' : (classMap.get(String(id))?.name || classMap.get(String(id))?.code || id);
        return `<span class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-bold">${learningEsc(label)}<button type="button" onclick="removeLearningClass(${learningInlineArg(id)})" class="w-4 h-4 inline-flex items-center justify-center rounded-full hover:bg-emerald-100" aria-label="Hapus kelas">&times;</button></span>`;
    }).join('');
};
window.addLearningClass = function(value = null) {
    const picker = document.getElementById('learning-class');
    const selectedValue = String(value || picker?.value || '').trim();
    if (!selectedValue) return;
    let selected = normalizeLearningClassTargets(window.__learningSelectedClasses || []);
    if (selectedValue === 'ALL') selected = ['ALL'];
    else {
        selected = selected.filter(id => id !== 'ALL');
        if (!selected.includes(selectedValue)) selected.push(selectedValue);
    }
    window.__learningSelectedClasses = selected;
    if (picker) picker.value = '';
    window.renderLearningSelectedClasses();
};
window.removeLearningClass = function(value) {
    const target = String(value || '');
    window.__learningSelectedClasses = normalizeLearningClassTargets(window.__learningSelectedClasses || []).filter(id => id !== target);
    window.renderLearningSelectedClasses();
};
window.showLearningEditorById = function(id) {
    const material = (window.__learningMaterials || []).find(item => String(item.id) === String(id));
    if (material) window.showLearningEditor(material);
};
window.showLearningEditor = async function(existing = null) {
    const state = learningState();
    const links = window.__learningLinks || await loadLearningLinks();
    const material = existing || {};
    const subjects = Array.isArray(state.subjects) ? state.subjects : [];
    const classes = Array.isArray(state.classes) ? state.classes : [];
    window.__learningSelectedClasses = learningMaterialClassTargets(material);
    const classOpts = ['<option value="">Pilih kelas...</option>', '<option value="ALL">Semua Kelas</option>', ...classes.map(cls =>
        `<option value="${learningAttr(cls.id)}">${learningEsc(cls.name || cls.code || cls.id)}</option>`
    )].join('');
    const subjectOpts = ['<option value="">Pilih Mapel</option>', ...subjects.map(subject =>
        `<option value="${learningAttr(subject.id)}" ${String(material.subjectId || '') === String(subject.id) ? 'selected' : ''}>${learningEsc(subject.name || subject.id)}</option>`
    )].join('');
    const lkpdOpts = [
        '<option value="">Tanpa LKPD</option>',
        '<option value="__CREATE_DRAFT__">+ Buat draft LKPD otomatis</option>',
        ...links.lkpds.map(lkpd =>
            `<option value="${learningAttr(lkpd.id)}" ${String(material.lkpdId || '') === String(lkpd.id) ? 'selected' : ''}>${learningEsc(lkpd.title || lkpd.name || lkpd.id)}${['inactive', 'draft'].includes(String(lkpd.status || '').toLowerCase()) ? ' (Draft)' : ''}</option>`
        )
    ].join('');
    const selectedScheduleId = String(material.scheduleId || material.examId || '');
    const examOpts = [
        '<option value="">Tanpa Jadwal Asesmen</option>',
        '<option value="__CREATE_DRAFT__">+ Buat draft jadwal asesmen otomatis</option>',
        ...links.exams.filter(ex => ex.recordType !== 'EVENT').map(schedule =>
            `<option value="${learningAttr(schedule.id)}" ${selectedScheduleId === String(schedule.id) ? 'selected' : ''}>${learningEsc(schedule.title || schedule.name || schedule.id)} â ${learningEsc(schedule.date || 'Tanpa tanggal')} ${learningEsc(schedule.startTime || '')}${['inactive', 'draft'].includes(String(schedule.status || '').toLowerCase()) ? ' (Draft)' : ''}</option>`
        )
    ].join('');
    const textBlock = (material.blocks || []).find(block => block.type === 'text')?.content || material.content || '';
    const video = (material.blocks || []).find(block => block.type === 'video')?.url || '';
    const resource = (material.blocks || []).find(block => block.type === 'link')?.url || '';
    window.__learningEditorAssets = (material.blocks || [])
        .filter(block => ['image', 'pdf', 'video'].includes(String(block.type || '').toLowerCase()))
        .map(block => ({
            type: String(block.type || '').toLowerCase(),
            name: String(block.name || (block.type === 'pdf' ? 'Materi PDF' : block.type === 'video' ? 'Video materi' : 'Gambar materi')),
            url: String(block.url || ''),
            driveFileId: String(block.driveFileId || ''),
            mime: String(block.mime || ''),
            pending: false,
            preview: String(block.type || '').toLowerCase() === 'image' ? String(block.url || '') : ''
        }));
    const policy = learningPolicy(material);
    document.body.insertAdjacentHTML('beforeend', `
        <div id="learning-editor-modal" class="fixed inset-0 z-[120] bg-slate-950/70 backdrop-blur-sm p-4 overflow-y-auto">
            <div class="max-w-3xl mx-auto my-6 bg-white rounded-3xl p-6 shadow-2xl space-y-4">
                <div class="flex justify-between gap-3">
                    <div><h2 class="text-xl font-black">${material.id ? 'Edit' : 'Buat'} Materi</h2><p class="text-xs text-slate-500">Hubungkan aktivitas yang sudah ada atau buat draft baru yang tetap tersembunyi dari siswa sampai guru mengaktifkannya.</p></div>
                    <button type="button" onclick="document.getElementById('learning-editor-modal')?.remove()" class="w-9 h-9 rounded-xl bg-slate-100">x</button>
                </div>
                <input id="learning-id" type="hidden" value="${learningAttr(material.id || '')}">
                <div class="grid md:grid-cols-2 gap-3">
                    <label class="text-xs font-bold">Judul<input id="learning-title" value="${learningAttr(material.title || '')}" class="mt-1 w-full p-3 border rounded-xl font-normal"></label>
                    <label class="text-xs font-bold">Topik<input id="learning-topic" value="${learningAttr(material.topic || '')}" class="mt-1 w-full p-3 border rounded-xl font-normal"></label>
                    <label class="text-xs font-bold">Mapel<select id="learning-subject" class="mt-1 w-full p-3 border rounded-xl font-normal bg-white">${subjectOpts}</select></label>
                    <div class="text-xs font-bold">
                        <div>Kelas Target</div>
                        <div class="mt-1 flex gap-2">
                            <select id="learning-class" class="min-w-0 flex-1 p-3 border rounded-xl font-normal bg-white">${classOpts}</select>
                            <button type="button" onclick="addLearningClass()" class="shrink-0 px-3 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold"><i class="fa-solid fa-plus mr-1"></i>Tambah Kelas</button>
                        </div>
                        <div id="learning-selected-classes" class="mt-2 flex flex-wrap gap-2"></div>
                        <div class="mt-1 text-[10px] font-normal text-slate-400">Pilih satu atau beberapa kelas. Memilih Semua Kelas akan menggantikan pilihan kelas individual.</div>
                    </div>
                </div>
                <label class="text-xs font-bold block">Isi Materi<textarea id="learning-content" rows="10" class="mt-1 w-full p-3 border rounded-xl font-normal" placeholder="Tulis materi pembelajaran...">${learningEsc(textBlock)}</textarea></label>
                <div class="p-4 rounded-2xl bg-blue-50/60 border border-blue-100 space-y-3">
                    <div class="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <div class="font-bold text-sm text-slate-800">Sisipkan Gambar / PDF / Video</div>
                            <div class="text-[11px] text-slate-500 mt-1">Pilih langsung dari HP/PC. Gambar maks. 10 MB, PDF maks. 15 MB, video maks. 18 MB. File akan tampil langsung di materi.</div>
                        </div>
                        <button type="button" onclick="document.getElementById('learning-asset-input')?.click()" class="px-3.5 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-bold"><i class="fa-solid fa-paperclip mr-1"></i>Tambah File</button>
                        <input id="learning-asset-input" type="file" multiple accept="image/jpeg,image/png,image/webp,application/pdf,video/mp4,video/webm,video/ogg" class="hidden" onchange="handleLearningAssetSelection(this)">
                    </div>
                    <div id="learning-assets-list" class="space-y-2"></div>
                </div>
                <div class="grid md:grid-cols-2 gap-3">
                    <label class="text-xs font-bold">Video/tautan video<input id="learning-video" value="${learningAttr(video)}" class="mt-1 w-full p-3 border rounded-xl font-normal" placeholder="https://..."></label>
                    <label class="text-xs font-bold">Sumber/PDF/link<input id="learning-resource" value="${learningAttr(resource)}" class="mt-1 w-full p-3 border rounded-xl font-normal" placeholder="https://..."></label>
                </div>
                <div class="p-4 rounded-2xl bg-slate-50">
                    <div class="font-bold text-sm mb-3">Aktivitas setelah materi</div>
                    <div class="grid md:grid-cols-2 gap-3">
                        <label class="text-xs font-bold">LKPD<select id="learning-lkpd" class="mt-1 w-full p-3 border rounded-xl font-normal bg-white">${lkpdOpts}</select></label>
                        <label class="text-xs font-bold">Jadwal Asesmen/CBT (yang dikunci)<select id="learning-exam" class="mt-1 w-full p-3 border rounded-xl font-normal bg-white">${examOpts}</select></label>
                    </div>
                    <label class="mt-3 block text-xs font-bold text-slate-700">Mode Penyajian Aktivitas
                        <select id="learning-display-mode" class="mt-1 w-full p-3 border rounded-xl font-normal bg-white">
                            <option value="sequential" ${material.learningDisplayMode !== 'split' ? 'selected' : ''}>Bertahap (standar)</option>
                            <option value="split" ${material.learningDisplayMode === 'split' ? 'selected' : ''}>Interaktif (materi berdampingan dengan latihan)</option>
                        </select>
                        <span class="block font-normal text-[11px] text-slate-500 mt-1">Khusus pembelajaran terbuka. Sesi, nilai, kamera dan monitoring tetap ditangani modul CBT/LKPD asli.</span>
                    </label>
                    <label class="mt-3 flex items-start gap-2 text-xs font-bold text-amber-900 bg-amber-50 border border-amber-200 p-3 rounded-xl">
                        <input id="learning-exam-reference" type="checkbox" ${material.allowExamReference === true ? 'checked' : ''} class="mt-0.5 rounded">
                        <span>Izinkan materi saat CBT latihan / open-book
                            <span class="block mt-1 text-[11px] font-normal text-amber-800">Aktif hanya jika Mode Interaktif dipilih. Jangan aktifkan untuk ujian tertutup/resmi; monitoring, kamera dan durasi tetap berjalan.</span>
                        </span>
                    </label>
                    <label class="mt-3 flex items-center gap-2 text-xs font-bold text-slate-600"><input id="learning-require-complete" type="checkbox" ${material.requiresCompletionForLinks === false ? '' : 'checked'} class="rounded">Kunci LKPD/asesmen sampai materi ditandai selesai</label>
                </div>
                <div class="p-4 rounded-2xl bg-emerald-50 border border-emerald-100">
                    <div class="font-bold text-sm mb-3 text-emerald-900">Syarat materi dianggap dipelajari</div>
                    <div class="grid md:grid-cols-2 gap-3">
                        <label class="text-xs font-bold text-emerald-900">Minimal baca aktif, detik<input id="learning-min-active-seconds" type="number" min="0" max="3600" step="5" value="${learningAttr(policy.minActiveSeconds)}" class="mt-1 w-full p-3 border border-emerald-100 rounded-xl font-normal bg-white"></label>
                        <label class="mt-7 flex items-center gap-2 text-xs font-bold text-emerald-900"><input id="learning-require-all-blocks" type="checkbox" ${policy.requireAllBlocks ? 'checked' : ''} class="rounded">Wajib semua bagian materi terlihat</label>
                    </div>
                </div>
                <div class="flex justify-end gap-2">
                    <button type="button" onclick="saveLearningMaterial('draft')" class="px-4 py-2.5 bg-slate-100 rounded-xl text-xs font-bold">Simpan Draft</button>
                    <button type="button" onclick="saveLearningMaterial('published')" class="px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-bold">Publikasikan</button>
                </div>
            </div>
        </div>`);
    renderLearningEditorAssets();
};
window.saveLearningMaterial = async function(status) {
    const idEl = document.getElementById('learning-id');
    let id = idEl?.value || '';
    if (!id) {
        const randomPart = (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function')
            ? globalThis.crypto.randomUUID().replace(/-/g, '').slice(0, 12)
            : Math.random().toString(36).slice(2, 14);
        id = `MAT_WEB_${Date.now()}_${randomPart}`;
        if (idEl) idEl.value = id;
    }

    const title = document.getElementById('learning-title')?.value?.trim() || '';
    if (!title) return learningToast('Judul materi wajib diisi.', 'warning');

    const saveButtons = Array.from(document.querySelectorAll('#learning-editor-modal button[onclick^="saveLearningMaterial"]'));
    saveButtons.forEach(button => {
        button.disabled = true;
        button.classList.add('opacity-60', 'cursor-wait');
    });

    let uploadedThisSave = [];
    let materialSaveRejected = false;
    try {
        uploadedThisSave = await uploadPendingLearningAssets();

        const subjectId = document.getElementById('learning-subject')?.value || '';
        const subjectName = (learningState().subjects || []).find(subject => String(subject.id) === String(subjectId))?.name || '';
        const selectedClasses = normalizeLearningClassTargets(window.__learningSelectedClasses || []);
        if (!selectedClasses.length) throw new Error('Pilih minimal satu kelas target atau Semua Kelas.');
        const classId = selectedClasses[0] || 'ALL';
        const lkpdSelection = document.getElementById('learning-lkpd')?.value || '';
        const examSelection = document.getElementById('learning-exam')?.value || '';
        const payload = {
            id,
            title,
            topic: document.getElementById('learning-topic')?.value?.trim() || '',
            subjectId,
            subjectName,
            classId,
            classes: selectedClasses,
            blocks: safeBlocksFromForm(),
            lkpdId: lkpdSelection === '__CREATE_DRAFT__' ? '' : lkpdSelection,
            examId: examSelection === '__CREATE_DRAFT__' ? '' : examSelection,
            scheduleId: examSelection === '__CREATE_DRAFT__' ? '' : examSelection,
            createLkpdDraft: lkpdSelection === '__CREATE_DRAFT__',
            createExamDraft: examSelection === '__CREATE_DRAFT__',
            learningDisplayMode: document.getElementById('learning-display-mode')?.value === 'split' ? 'split' : 'sequential',
            allowExamReference: document.getElementById('learning-display-mode')?.value === 'split' && document.getElementById('learning-exam-reference')?.checked === true,
            requiresCompletionForLinks: document.getElementById('learning-require-complete')?.checked !== false,
            engagementPolicy: {
                minActiveSeconds: Math.max(0, Math.min(3600, Number(document.getElementById('learning-min-active-seconds')?.value || 0) || 0)),
                requireAllBlocks: document.getElementById('learning-require-all-blocks')?.checked !== false
            },
            status
        };

        const response = await fetch('/api/learning/materials', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || data.success === false) {
            materialSaveRejected = true;
            throw new Error(data.message || 'Gagal menyimpan materi.');
        }

        // The backend must persist the selected display mode. A successful POST
        // alone is insufficient: older servers may silently drop unknown fields.
        // Verify without deleting or resubmitting anything if persistence fails.
        let modePersistenceWarning = '';
        try {
            const verifyResponse = await fetch('/api/learning/materials', { cache: 'no-store' });
            if (!verifyResponse.ok) throw new Error('Tidak dapat membaca ulang materi.');
            const verifyData = await verifyResponse.json();
            const persisted = (Array.isArray(verifyData.materials) ? verifyData.materials : [])
                .find(item => String(item.id) === String(id));
            if (!persisted) throw new Error('Materi yang baru disimpan tidak ditemukan.');
            const expectedMode = payload.learningDisplayMode;
            const actualMode = persisted.learningDisplayMode === 'split' ? 'split' : 'sequential';
            if (expectedMode !== actualMode ||
                Boolean(persisted.allowExamReference) !== Boolean(payload.allowExamReference)) {
                modePersistenceWarning = 'Materi tersimpan, tetapi pengaturan Mode Interaktif/izin CBT open-book tidak tersimpan sesuai pilihan guru. Periksa API sebelum fitur digunakan.';
            }
        } catch (verificationError) {
            modePersistenceWarning = 'Materi dikirim ke server, tetapi mode penyajian belum dapat diverifikasi: ' + (verificationError.message || 'Kesalahan pembacaan ulang.');
        }
        document.getElementById('learning-editor-modal')?.remove();
        window.__learningEditorAssets = [];
        window.__learningSelectedClasses = [];
        window.__learningLinks = null;
        const created = [];
        if (data.createdDrafts?.lkpdId) created.push('draft LKPD');
        if (data.createdDrafts?.examId) created.push('draft asesmen');
        const baseMessage = status === 'published' ? 'Materi dipublikasikan.' : 'Draft materi disimpan.';
        if (modePersistenceWarning) {
            learningToast(modePersistenceWarning, 'warning');
            window.alert(modePersistenceWarning);
        } else {
            learningToast(created.length ? `${baseMessage} ${created.join(' dan ')} dibuat dan belum terlihat oleh siswa.` : baseMessage, 'success');
        }
        window.renderLearningTeacher(document.getElementById('view-container'));
    } catch (err) {
        if (materialSaveRejected && uploadedThisSave.length) {
            await rollbackLearningUploadedAssets(uploadedThisSave);
            uploadedThisSave = [];
        }
        learningToast(err.message || 'Gagal menyimpan materi.', 'error');
        saveButtons.forEach(button => {
            button.disabled = false;
            button.classList.remove('opacity-60', 'cursor-wait');
        });
    }
};
window.openLearningLinkedActivityEditor = async function(kind, id) {
    try {
        const links = await loadLearningLinks();
        window.__learningLinks = links;
        if (kind === 'lkpd') {
            const found = links.lkpds.find(item => String(item.id) === String(id));
            if (!found) return learningToast('LKPD tertaut tidak ditemukan.', 'warning');
            if (typeof window.openCreateLkpdModal === 'function') return window.openCreateLkpdModal(id);
            return learningToast('Editor LKPD belum siap.', 'warning');
        }
        const found = links.exams.find(item => String(item.id) === String(id));
        if (!found) return learningToast('Asesmen tertaut tidak ditemukan.', 'warning');
        if (typeof window.openExamModal === 'function') return window.openExamModal(id);
        learningToast('Editor asesmen belum siap.', 'warning');
    } catch (err) {
        learningToast(err.message || 'Gagal membuka aktivitas tertaut.', 'error');
    }
};

window.deleteLearningMaterial = async function(id) {
    if (!confirm('Hapus materi ini? Progress siswa untuk materi ini juga akan dihapus.')) return;
    try {
        const response = await fetch('/api/learning/materials/' + encodeURIComponent(id), { method: 'DELETE' });
        const data = await response.json();
        if (!response.ok || data.success === false) throw new Error(data.message || 'Gagal menghapus materi.');
        learningToast('Materi dihapus.', 'success');
        window.renderLearningTeacher(document.getElementById('view-container'));
    } catch (err) {
        learningToast(err.message || 'Gagal menghapus materi.', 'error');
    }
};

window.renderLearningStudent = async function(container) {
    closeLearningSplitDock();
    stopLearningTracker();
    if (!container) return;
    if (!featureEnabled('learning')) {
        learningToast('Menu Belajar sedang dinonaktifkan.', 'info');
        return;
    }
    container.innerHTML = '<div class="p-8 text-center text-slate-400"><i class="fa-solid fa-spinner fa-spin mr-2"></i>Memuat pembelajaran...</div>';
    await flushLearningProgressQueue();
    try {
        const materials = await loadLearningMaterials();
        window.__learningMaterials = materials;
        const cards = materials.map(material => {
            const progress = material.progress || progressForMaterial(material.id) || {};
            const completed = progress.status === 'completed' || Number(progress.progressPercent || 0) >= 100;
            const locked = material.locked === true || materialLocked(material);
            return `
                <button type="button" onclick="openLearningMaterial(${learningInlineArg(material.id)})" class="text-left bg-white p-5 rounded-2xl border ${locked ? 'border-slate-100 opacity-75' : 'border-slate-100 hover:border-emerald-200'} shadow-sm transition">
                    <div class="flex justify-between gap-3">
                        <div class="text-[10px] font-bold uppercase text-emerald-600">${learningEsc(material.subjectName || material.subjectId || 'Materi')}</div>
                        <span class="text-[10px] font-bold ${completed ? 'text-emerald-700' : locked ? 'text-slate-400' : 'text-amber-600'}">${completed ? 'Selesai' : locked ? 'Terkunci' : 'Belum selesai'}</span>
                    </div>
                    <div class="font-black text-slate-800 mt-1">${learningEsc(material.title)}</div>
                    <div class="text-xs text-slate-500 mt-1">${learningEsc(material.topic || '')}</div>
                    <div class="mt-4 h-2 rounded-full bg-slate-100 overflow-hidden"><div class="h-full bg-emerald-500" style="width:${Math.max(0, Math.min(100, Number(progress.progressPercent || 0)))}%"></div></div>
                </button>`;
        }).join('');
        container.innerHTML = `
            <div class="max-w-5xl mx-auto space-y-5 pb-10">
                <div><h1 class="text-2xl font-black text-slate-900">Belajar</h1><p class="text-xs text-slate-500 mt-1">Pelajari materi, lanjutkan LKPD, lalu asesmen sesuai arahan guru.</p></div>
                <div class="grid md:grid-cols-2 gap-4">${cards || '<div class="col-span-full p-10 text-center bg-white rounded-2xl border text-slate-400 text-sm">Belum ada materi yang dipublikasikan untuk kelasmu.</div>'}</div>
            </div>`;
    } catch (err) {
        container.innerHTML = `<div class="p-8 text-center text-rose-600">${learningEsc(err.message || 'Gagal memuat materi.')}</div>`;
    }
};
window.openLearningMaterial = async function(id, staffPreview = false) {
    stopLearningTracker();
    let material = (window.__learningMaterials || []).find(item => String(item.id) === String(id));
    if (!material) material = (await loadLearningMaterials()).find(item => String(item.id) === String(id));
    if (!material) return learningToast('Materi tidak ditemukan.', 'error');
    if (!staffPreview && materialLocked(material)) return learningToast('Selesaikan materi prasyarat terlebih dahulu.', 'info');
    const container = document.getElementById('view-container');
    if (!container) return;
    const existingProgress = staffPreview ? null : (learningProgressSnapshot(material) || progressForMaterial(material.id));
    const alreadyCompleted = Boolean(existingProgress && (existingProgress.status === 'completed' || Number(existingProgress.progressPercent || 0) >= 100));
    if (!staffPreview && !alreadyCompleted) {
        await postLearningProgress({
            materialId: material.id,
            status: 'viewed',
            progressPercent: Math.max(10, Number(existingProgress?.progressPercent || 0)),
            activeSeconds: Number(existingProgress?.activeSeconds || 0),
            viewedBlockIds: Array.isArray(existingProgress?.viewedBlockIds) ? existingProgress.viewedBlockIds : []
        }, { silent: true });
    }
    const completed = staffPreview ? false : isCompleted(material.id);
    const currentProgress = staffPreview ? null : (progressForMaterial(material.id) || existingProgress);
    if (currentProgress) material.progress = currentProgress;
    const policy = learningPolicy(material);
    container.innerHTML = `
        <div class="max-w-3xl mx-auto pb-12">
            <button type="button" onclick="navigateTo('${staffPreview ? 'learning_teacher' : 'learning_student'}')" class="inline-flex items-center gap-2 px-4 py-2.5 mb-4 rounded-xl border border-slate-200 bg-white text-sm font-black text-slate-700 shadow-sm hover:bg-slate-50 hover:border-slate-300 transition"><i class="fa-solid fa-arrow-left"></i><span>Kembali ke Materi Ajar</span></button>
            <article class="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 sm:p-8">
                <div class="text-xs font-bold uppercase text-emerald-600">${learningEsc(material.subjectName || material.subjectId || 'Materi')}</div>
                <h1 class="text-2xl font-black text-slate-900 mt-1">${learningEsc(material.title)}</h1>
                <p class="text-sm text-slate-500 mt-1">${learningEsc(material.topic || '')}</p>
                <div class="mt-7 space-y-5">${renderMaterialBlocks(material.blocks || [])}</div>
                ${!staffPreview ? `<div class="mt-8 pt-6 border-t">
                    ${!completed ? `<div id="learning-engagement-status" class="mb-3 text-center text-xs font-bold text-slate-500">Aktif membaca ${Math.min(Number(currentProgress?.activeSeconds || 0), policy.minActiveSeconds)}/${policy.minActiveSeconds} detik${policy.requireAllBlocks ? ' â¢ bagian terlihat ' + (Array.isArray(currentProgress?.viewedBlockIds) ? currentProgress.viewedBlockIds.length : 0) + '/' + Math.max(1, materialBlockIds(material).length) : ''}</div>` : ''}
                    <button id="learning-complete-button" type="button" ${completed ? 'disabled aria-disabled="true"' : ''} onclick="completeLearningMaterial(${learningInlineArg(material.id)})" class="w-full py-3 rounded-2xl ${completed ? 'bg-emerald-50 text-emerald-700' : 'bg-emerald-600 text-white'} font-black text-sm">${completed ? 'Materi telah dipelajari' : 'Saya Sudah Mempelajari Materi'}</button>
                    <div id="learning-next-actions" class="mt-3">${completed ? learningNextActions(material) : ''}</div>
                </div>` : ''}
            </article>
        </div>`;
    void hydrateProtectedLearningPdfs();
    if (!staffPreview && !completed) startLearningTracker(material);
};
window.completeLearningMaterial = async function(id) {
    const material = (window.__learningMaterials || []).find(item => String(item.id) === String(id));
    if (!material) return;
    const ready = engagementReady(material);
    if (!ready.ready) return learningToast(ready.message || 'Selesaikan syarat baca materi terlebih dahulu.', 'info');
    const progress = await postLearningProgress(learningCompletionPayload(material));
    if (progress?.rejected) return;
    stopLearningTracker({ checkpoint: false });
    const actionContainer = document.getElementById('learning-next-actions');
    if (actionContainer) actionContainer.innerHTML = learningNextActions(material);
    const button = document.getElementById('learning-complete-button');
    if (button) {
        button.disabled = true;
        button.setAttribute('aria-disabled', 'true');
        button.removeAttribute('onclick');
        button.classList.remove('opacity-60', 'cursor-not-allowed');
        button.classList.add('bg-emerald-50', 'text-emerald-700');
        button.textContent = 'Materi telah dipelajari';
    }
    learningToast(progress?.pendingSync ? 'Progress disimpan sementara dan akan disinkronkan saat online.' : 'Materi ditandai selesai.', 'success');
};
function learningNextActions(material) {
    if (material.requiresCompletionForLinks !== false && !isCompleted(material.id)) {
        return '<div class="text-center text-xs text-slate-500 font-bold py-3">Tandai materi selesai untuk membuka aktivitas lanjutan.</div>';
    }
    const actions = [];
    const readiness = material.linkedActivities || {};
    if (material.lkpdId) {
        actions.push(readiness.lkpdReady === false
            ? '<div class="w-full mt-2 py-3 px-4 rounded-2xl bg-amber-50 text-amber-700 font-bold text-xs text-center"><i class="fa-solid fa-clock mr-2"></i>LKPD sedang disiapkan guru</div>'
            : `<button type="button" onclick="openLinkedLearningLkpd(${learningInlineArg(material.lkpdId)}, ${learningInlineArg(material.id)})" class="w-full mt-2 py-3 rounded-2xl bg-blue-600 text-white font-bold text-sm"><i class="fa-solid fa-clipboard-list mr-2"></i>Lanjut Kerjakan LKPD</button>`);
    }
    if (material.examId) {
        actions.push(readiness.examReady === false
            ? '<div class="w-full mt-2 py-3 px-4 rounded-2xl bg-amber-50 text-amber-700 font-bold text-xs text-center"><i class="fa-solid fa-clock mr-2"></i>Asesmen sedang disiapkan guru</div>'
            : `<button type="button" onclick="openLinkedLearningExam(${learningInlineArg(material.examId)}, ${learningInlineArg(material.id)})" class="w-full mt-2 py-3 rounded-2xl bg-violet-600 text-white font-bold text-sm"><i class="fa-solid fa-file-circle-check mr-2"></i>Lanjut ke Asesmen</button>`);
    }
    return actions.join('') || '<div class="text-center text-xs text-emerald-700 font-bold py-3">Pembelajaran selesai</div>';
}

/**
 * Optional companion study dock. This is a presentation-only layer: answers,
 * camera, proctoring, session timers and scores remain owned by CBT/LKPD.
 * No new iframe is used for the activity, avoiding a second assessment session.
 */
function closeLearningSplitDock() {
    window.__learningPendingCbtReference = null;
    window.__learningPendingLkpdReference = null;
    document.getElementById('learning-split-dock')?.remove();
    document.getElementById('learning-split-dock-style')?.remove();
    document.body.classList.remove('learning-split-active');
}
window.closeLearningSplitDock = closeLearningSplitDock;
window.toggleLearningSplitDock = function() {
    const dock = document.getElementById('learning-split-dock');
    if (!dock) return;
    const body = dock.querySelector('[data-learning-dock-body]');
    const button = dock.querySelector('[data-learning-dock-toggle]');
    if (!body || !button) return;
    const collapsed = body.classList.toggle('hidden');
    dock.classList.toggle('learning-dock-collapsed', collapsed);
    document.body.classList.toggle('learning-split-active', !collapsed);
    button.textContent = collapsed ? 'Tampilkan materi' : 'Perkecil materi';
};
function openLearningSplitDock(materialId, activityLabel) {
    closeLearningSplitDock();
    const material = (window.__learningMaterials || []).find(row => String(row.id) === String(materialId));
    if (!material || material.learningDisplayMode !== 'split') return;
    if (!Array.isArray(material.blocks) || !material.blocks.length) return;
    const style = document.createElement('style');
    style.id = 'learning-split-dock-style';
    style.textContent = `
      body.learning-split-active #view-container { width:59%; margin-left:41%; max-width:none; }
      #learning-split-dock { position:fixed; top:68px; left:10px; width:calc(41vw - 20px); height:calc(100dvh - 80px); z-index:30; background:#fff; border:1px solid #cbd5e1; box-shadow:0 12px 36px #0f172a44; border-radius:16px; display:flex; flex-direction:column; overflow:hidden; }
      body.learning-split-active #learning-split-dock { z-index:30; }
      body:not(.learning-split-active) #learning-split-dock { z-index:30; }
      body.learning-split-active #view-container > * { max-width:100%; }
      #learning-split-dock button { cursor:pointer; }
      #learning-split-dock [data-learning-dock-body] { flex:1; overflow:auto; padding:12px; overscroll-behavior:contain; }
      #learning-split-dock iframe { max-width:100%; }
      #learning-split-dock video { max-height:44vh; }
      #learning-split-dock.learning-dock-collapsed { height:auto; width:auto; max-width:calc(100vw - 20px); }
      @media(max-width:800px) { body.learning-split-active #view-container { width:100%; margin-left:0; padding-bottom:min(49dvh,470px); } #learning-split-dock {top:auto;bottom:12px;left:8px;width:calc(100vw - 16px);height:min(48dvh,460px);} }
      @media(min-width:801px) { body.learning-split-active #view-container { padding-right:8px; } }
      #learning-split-dock iframe { height:min(64vh,700px)!important; }
    `;
    document.head.appendChild(style);
    document.body.insertAdjacentHTML('beforeend', `
      <aside id="learning-split-dock" data-learning-material-id="${learningAttr(material.id)}" data-learning-companion-kind="${learningAttr(activityLabel)}" role="complementary" aria-label="Materi pendamping ${learningAttr(activityLabel)}">
        <div class="p-3 border-b bg-emerald-50 flex flex-wrap items-center justify-between gap-2">
          <div class="min-w-0"><div class="text-[10px] font-bold text-emerald-700">MATERI + ${learningEsc(activityLabel)}</div>
          <div class="text-xs font-black text-slate-800 truncate">${learningEsc(material.title || 'Materi')}</div></div>
          <div class="flex items-center gap-2">
            <button type="button" data-learning-dock-toggle onclick="toggleLearningSplitDock()" class="text-[11px] px-2 py-1 border rounded-lg bg-white">Perkecil materi</button>
            <button type="button" onclick="closeLearningSplitDock()" aria-label="Tutup panel materi" class="text-xl px-2">&times;</button>
          </div>
        </div>
        <div data-learning-dock-body class="space-y-4">${renderMaterialBlocks(material.blocks || [])}</div>
      </aside>`);
    document.body.classList.add('learning-split-active');
    void hydrateProtectedLearningPdfs();
}

window.openLinkedLearningLkpd = async function(lkpdId, materialId = null) {
    if (!featureEnabled('cbt')) return learningToast('Menu CBT/LKPD sedang dinonaktifkan.', 'info');
    if (!Array.isArray(learningState().lkpdList) || !learningState().lkpdList.some(item => String(item.id) === String(lkpdId))) {
        const data = await fetch('/api/lkpds', { cache: 'no-store' }).then(r => r.json()).catch(() => ({}));
        if (data.lkpdList) learningState().lkpdList = data.lkpdList;
    }
    const found = (learningState().lkpdList || []).find(item => String(item.id) === String(lkpdId));
    if (!found) return learningToast('LKPD belum diaktifkan oleh guru.', 'info');
    // Open the reference only after LKPD confirms its student worksheet is mounted.
    window.__learningPendingLkpdReference = null;
    if (typeof window.openStudentLkpdWorksheetModal === 'function') {
        const linkedMaterial = (window.__learningMaterials || []).find(row => String(row.id) === String(materialId));
        if (linkedMaterial?.learningDisplayMode === 'split' && String(linkedMaterial.lkpdId) === String(lkpdId) &&
            currentStudentId()) {
            window.__learningPendingLkpdReference = {
                lkpdId: String(lkpdId), materialId: String(materialId),
                studentId: currentStudentId(), createdAt: Date.now()
            };
        }
        window.openStudentLkpdWorksheetModal(lkpdId, currentStudentId());
    } else window.navigateTo('asesmen_siswa');
};
window.openLinkedLearningExam = async function(examId, materialId = null) {
    if (!featureEnabled('cbt')) return learningToast('Menu CBT sedang dinonaktifkan.', 'info');
    if (!Array.isArray(learningState().exams) || !learningState().exams.some(item => String(item.id) === String(examId))) {
        const data = await fetch('/api/exams', { cache: 'no-store' }).then(r => r.json()).catch(() => ({}));
        if (data.exams) learningState().exams = data.exams;
    }
    const found = (learningState().exams || []).find(item => String(item.id) === String(examId));
    if (!found) return learningToast('Asesmen belum diaktifkan oleh guru.', 'info');
    // Store only a short-lived, student-scoped request. No material is visible
    // until the CBT module has authenticated/started and rendered its active screen.
    window.__learningPendingCbtReference = null;
    if (materialId) {
        const selected = (window.__learningMaterials || []).find(row => String(row.id) === String(materialId));
        if (selected?.learningDisplayMode === 'split' && selected.allowExamReference === true &&
            String(selected.examId || '') === String(examId) && currentStudentId()) {
            window.__learningPendingCbtReference = {
                examId: String(examId),
                materialId: String(materialId),
                studentId: currentStudentId(),
                createdAt: Date.now()
            };
        }
    }
    if (typeof window.confirmStartStudentExam === 'function') window.confirmStartStudentExam(examId);
    else if (typeof window.startStudentExam === 'function') window.startStudentExam(examId);
    else window.navigateTo('asesmen_siswa');
};

/**
 * LKPD student route invokes this after a real worksheet is mounted and the
 * active session is set; unsuccessful/preview starts never display the reference.
 */
window.onLearningLkpdScreenReady = function(lkpdId, studentId) {
    const pending = window.__learningPendingLkpdReference;
    if (!pending) return;
    if (Date.now() - pending.createdAt > 180000 || pending.studentId !== currentStudentId() ||
        String(studentId) !== pending.studentId || String(lkpdId) !== pending.lkpdId) {
        window.__learningPendingLkpdReference = null;
        return;
    }
    const material = (window.__learningMaterials || []).find(row => String(row.id) === pending.materialId);
    if (!material || material.learningDisplayMode !== 'split' || String(material.lkpdId) !== pending.lkpdId) {
        window.__learningPendingLkpdReference = null;
        return;
    }
    openLearningSplitDock(pending.materialId, 'LKPD');
    window.__learningPendingLkpdReference = null;
};
window.onLearningLkpdSessionEnded = function() {
    window.__learningPendingLkpdReference = null;
    if (document.getElementById('learning-split-dock')?.getAttribute('data-learning-companion-kind') === 'LKPD') {
        closeLearningSplitDock();
    }
};

/**
 * The CBT module calls this only after it has rendered an ACTIVE, unblocked
 * exam screen. It does not start a CBT session or bypass CBT permission checks.
 */
window.onLearningCbtScreenReady = function(examId) {
    const pending = window.__learningPendingCbtReference;
    if (!pending) return;
    if (Date.now() - pending.createdAt > 180000 || pending.studentId !== currentStudentId()) {
        window.__learningPendingCbtReference = null;
        return;
    }
    if (String(examId) !== pending.examId) return;
    const material = (window.__learningMaterials || []).find(row => String(row.id) === pending.materialId);
    if (!material || material.learningDisplayMode !== 'split' || material.allowExamReference !== true ||
        String(material.examId || '') !== pending.examId) {
        window.__learningPendingCbtReference = null;
        return;
    }
    // openLearningSplitDock clears the pending request, preventing duplicate media
    // mounts on subsequent question renders and preserving current playback.
    openLearningSplitDock(pending.materialId, 'CBT');
};
window.onLearningCbtSessionEnded = function() {
    window.__learningPendingCbtReference = null;
    if (document.getElementById('learning-split-dock')?.getAttribute('data-learning-companion-kind') === 'CBT') {
        closeLearningSplitDock();
    }
};
// A trusted embedded PDF/video counts as in-page interaction only when the
// companion belongs to the currently active, explicitly allowed CBT.
window.isTrustedLearningReferenceFocus = function(examId) {
    const dock = document.getElementById('learning-split-dock');
    if (!dock || dock.getAttribute('data-learning-companion-kind') !== 'CBT' || document.hidden) return false;
    const active = document.activeElement;
    if (!active || active.tagName !== 'IFRAME' || !dock.contains(active)) return false;
    const context = dock.getAttribute('data-learning-material-id');
    const material = (window.__learningMaterials || []).find(row => String(row.id) === String(context));
    return Boolean(material && material.allowExamReference === true &&
        material.learningDisplayMode === 'split' && String(material.examId) === String(examId));
};

window.openLearningMonitor = async function(id) {
    const container = document.getElementById('view-container');
    const material = (window.__learningMaterials || []).find(item => String(item.id) === String(id));
    if (!container || !material) return;
    container.innerHTML = '<div class="p-8 text-center text-slate-400"><i class="fa-solid fa-spinner fa-spin mr-2"></i>Memuat monitoring...</div>';
    try {
        const data = await fetch('/api/learning/progress?materialId=' + encodeURIComponent(id), { cache: 'no-store' }).then(r => r.json());
        if (data.success === false) throw new Error(data.message || 'Gagal memuat monitoring.');
        const rows = data.rows || [];
        container.innerHTML = `
            <div class="max-w-6xl mx-auto space-y-5 pb-10">
                <button type="button" onclick="navigateTo('learning_teacher')" class="text-xs font-bold text-slate-500"><i class="fa-solid fa-arrow-left mr-1"></i>Kembali</button>
                <div class="bg-white rounded-3xl border p-6">
                    <h1 class="text-xl font-black">Monitoring ${learningEsc(material.title)}</h1>
                    <div class="grid sm:grid-cols-3 gap-3 mt-5">
                        <div class="p-4 rounded-2xl bg-slate-50"><div class="text-xs text-slate-500">Siswa Target</div><div class="text-2xl font-black">${rows.length}</div></div>
                        <div class="p-4 rounded-2xl bg-emerald-50"><div class="text-xs text-emerald-700">Selesai</div><div class="text-2xl font-black text-emerald-800">${rows.filter(row => row.status === 'completed' || Number(row.progressPercent || 0) >= 100).length}</div></div>
                        <div class="p-4 rounded-2xl bg-amber-50"><div class="text-xs text-amber-700">Belum Selesai</div><div class="text-2xl font-black text-amber-800">${rows.filter(row => row.status !== 'completed' && Number(row.progressPercent || 0) < 100).length}</div></div>
                    </div>
                    <div class="mt-5 overflow-x-auto border rounded-2xl">
                        <table class="w-full text-xs">
                            <thead class="bg-slate-50 text-slate-500 uppercase"><tr><th class="p-3 text-left">Siswa</th><th class="p-3 text-left">NIS</th><th class="p-3 text-left">Status</th><th class="p-3 text-left">Progress</th><th class="p-3 text-left">Baca Aktif</th><th class="p-3 text-left">Bagian</th><th class="p-3 text-left">Update</th></tr></thead>
                            <tbody>${rows.map(row => `<tr class="border-t"><td class="p-3 font-bold text-slate-800">${learningEsc(row.studentName)}</td><td class="p-3 text-slate-500">${learningEsc(row.nis || '-')}</td><td class="p-3">${learningEsc(row.status)}</td><td class="p-3">${Number(row.progressPercent || 0)}%</td><td class="p-3">${Math.floor(Number(row.activeSeconds || 0))} detik</td><td class="p-3">${Number(row.viewedBlockCount || 0)}</td><td class="p-3 text-slate-500">${learningEsc(row.updatedAt || '-')}</td></tr>`).join('') || '<tr><td colspan="7" class="p-8 text-center text-slate-400">Belum ada siswa target.</td></tr>'}</tbody>
                        </table>
                    </div>
                </div>
            </div>`;
    } catch (err) {
        container.innerHTML = `<div class="p-8 text-center text-rose-600">${learningEsc(err.message || 'Gagal memuat monitoring.')}</div>`;
    }
};

function injectLearningMenus() {
    const role = learningRole();
    const sidebar = document.getElementById('sidebar-menu') || document.querySelector('aside nav') || document.querySelector('#sidebar nav');
    if (!sidebar || sidebar.querySelector('[data-learning-menu]')) return;
    if (STUDENT_ROLES.has(role) && featureEnabled('learning')) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.dataset.learningMenu = '1';
        btn.className = 'w-full flex items-center space-x-3 px-3.5 py-3 rounded-2xl hover:bg-slate-800 transition text-left';
        btn.innerHTML = '<i class="fa-solid fa-book-open-reader w-5 text-blue-400"></i><span>Belajar</span>';
        btn.onclick = () => window.navigateTo('learning_student');
        const cbtButton = Array.from(sidebar.querySelectorAll('button')).find(button => /CBT|Ujian/i.test(button.textContent || ''));
        sidebar.insertBefore(btn, cbtButton || sidebar.firstChild?.nextSibling || null);
    } else if (STAFF_ROLES.has(role)) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.dataset.learningMenu = '1';
        btn.className = 'w-full flex items-center space-x-3 px-3.5 py-3 rounded-2xl hover:bg-slate-800 transition text-left';
        btn.innerHTML = '<i class="fa-solid fa-book-open w-5 text-emerald-400"></i><span>Materi Pembelajaran</span>';
        btn.onclick = () => window.navigateTo('learning_teacher');
        const modulButton = Array.from(sidebar.querySelectorAll('button')).find(button => /Modul Ajar/i.test(button.textContent || ''));
        sidebar.insertBefore(btn, modulButton || null);
    }
}

const originalNavigateTo = window.navigateTo;
if (typeof originalNavigateTo === 'function' && !window.__learningNavigateWrapped) {
    window.__learningNavigateWrapped = true;
    window.navigateTo = function(route, ...args) {
        const routeText = String(route || '');
        if (routeText === 'learning_student') return window.renderLearningStudent(document.getElementById('view-container'));
        if (routeText === 'learning_teacher') return window.renderLearningTeacher(document.getElementById('view-container'));
        if (STUDENT_ROLES.has(learningRole())) {
            if ((/game/i.test(routeText) && !featureEnabled('games')) ||
                (/cbt|asesmen|lkpd/i.test(routeText) && !featureEnabled('cbt')) ||
                (/absen/i.test(routeText) && !featureEnabled('attendance'))) {
                learningToast('Menu ini sedang dinonaktifkan oleh administrator.', 'info');
                return;
            }
        }
        // Companion content may remain while navigating between assessment screens,
        // but must never leak into unrelated modules or another student's workspace.
        if (!['asesmen_siswa', 'lkpd_worksheet'].includes(routeText)) closeLearningSplitDock();
        const result = originalNavigateTo.call(this, route, ...args);
        setTimeout(injectLearningMenus, 0);
        return result;
    };
}

window.setStudentFeatureVisibility = async function(feature, enabled) {
    if (!['attendance', 'learning', 'cbt', 'games'].includes(feature)) return;
    const state = learningState();
    state.settings = state.settings || {};
    state.settings.studentFeatures = { ...(state.settings.studentFeatures || {}), [feature]: Boolean(enabled) };
    if (feature === 'learning') state.settings.learningModuleEnabled = Boolean(enabled);
    if (feature === 'games') state.settings.gameModuleEnabled = Boolean(enabled);
    try {
        const response = await fetch('/api/settings', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ settings: state.settings })
        });
        const data = await response.json();
        if (!response.ok || data.success === false) throw new Error(data.message || 'Gagal menyimpan pengaturan.');
        if (data.settings) state.settings = data.settings;
        learningToast('Pengaturan menu siswa disimpan.', 'success');
    } catch (err) {
        learningToast(err.message || 'Gagal menyimpan pengaturan.', 'error');
    }
};

window.addEventListener('madrasah:session-ready', () => {
    quarantineLegacyLearningProgressQueue();
    injectLearningMenus();
    if (STUDENT_ROLES.has(learningRole())) void flushLearningProgressQueue();
});
window.addEventListener('online', () => {
    if (STUDENT_ROLES.has(learningRole())) void flushLearningProgressQueue();
});
setTimeout(() => { injectLearningMenus(); }, 0);
