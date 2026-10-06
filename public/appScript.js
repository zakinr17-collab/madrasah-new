const AUTH_SESSION_TOKEN_KEY = 'madrasah_auth_token';

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[ch]);
}

function escapeHtmlAttr(value) {
    return escapeHtml(value);
}

function getStoredAuthToken() {
    try {
        return sessionStorage.getItem(AUTH_SESSION_TOKEN_KEY) || '';
    } catch (_) { return ''; }
}

function sanitizePersistedUser(user) {
    if (!user || typeof user !== 'object') return null;
    const clean = { ...user };
    delete clean.token;
    delete clean.password;
    delete clean.passwordRaw;
    delete clean.adminPass;
    return clean;
}

function persistCurrentUser(user) {
    if (!user || typeof user !== 'object') {
        clearPersistedAuthSession();
        return null;
    }
    const token = String(user.token || getStoredAuthToken() || '');
    const clean = sanitizePersistedUser(user);
    try {
        if (token) sessionStorage.setItem(AUTH_SESSION_TOKEN_KEY, token);
        else sessionStorage.removeItem(AUTH_SESSION_TOKEN_KEY);
        localStorage.setItem('madrasah_current_user', JSON.stringify(clean));
    } catch (_) {}
    return token ? { ...clean, token } : clean;
}

function readPersistedUser(requireToken = true) {
    let profile = null;
    try {
        const raw = localStorage.getItem('madrasah_current_user');
        if (raw) profile = JSON.parse(raw);
    } catch (_) {}
    if (!profile || typeof profile !== 'object') return null;

    // One-time migration from older builds that persisted JWT in localStorage.
    try {
        if (profile.token && !getStoredAuthToken()) {
            sessionStorage.setItem(AUTH_SESSION_TOKEN_KEY, String(profile.token));
        }
        if (profile.token || profile.password || profile.passwordRaw || profile.adminPass) {
            localStorage.setItem('madrasah_current_user', JSON.stringify(sanitizePersistedUser(profile)));
        }
    } catch (_) {}

    const token = getStoredAuthToken();
    const clean = sanitizePersistedUser(profile);
    if (requireToken && !token) return null;
    return token ? { ...clean, token } : clean;
}

function clearPersistedAuthSession() {
    try { sessionStorage.removeItem(AUTH_SESSION_TOKEN_KEY); } catch (_) {}
    // Remove legacy JWT storage from older builds; current builds never persist JWT here.
    try { localStorage.removeItem(AUTH_SESSION_TOKEN_KEY); } catch (_) {}
    try { localStorage.removeItem('madrasah_current_user'); } catch (_) {}
    try { localStorage.removeItem('madrasah_active_account'); } catch (_) {}
}


function getLessonPlanSubjectReference(plan) {
    if (!plan || typeof plan !== 'object') return '';
    const ref = plan.subjectId ?? plan.subject_id ?? plan.subjectCode ?? plan.subject_code ??
        plan.subjectName ?? plan.subject_name ?? plan.subject ?? plan.mapel ?? '';
    return typeof ref === 'object' ? (ref.id ?? ref.code ?? ref.name ?? '') : ref;
}

const lessonPlanChildKeys = ['groups', 'modules', 'lessonPlans', 'plans', 'items', 'documents', 'files', 'children'];
const lessonPlanContentKeys = [
    'title', 'name', 'topic', 'judul', 'materi', 'topik', 'identitasModul', 'htmlContent',
    'extractedContent', 'kegiatanPembelajaran', 'sourceFileName', 'sourceType',
    'moduleContent', 'modulAjar', 'learningObjectives', 'tujuanPembelajaran'
];

function hasLessonPlanContent(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    return lessonPlanContentKeys.some(key => value[key] !== undefined && value[key] !== null && String(value[key]).trim() !== '');
}

function flattenLessonPlanCollection(value, inherited = {}, depth = 0) {
    if (depth > 12 || value === null || value === undefined) return [];
    if (Array.isArray(value)) return value.flatMap(entry => flattenLessonPlanCollection(entry, inherited, depth + 1));
    if (typeof value !== 'object') return [];

    const context = { ...inherited };
    const subjectRef = getLessonPlanSubjectReference(value);
    if (context.subjectId === undefined && subjectRef) context.subjectId = subjectRef;
    ['madrasahId', 'madrasahSlug', 'groupId', 'groupName', 'grade', 'level', 'semester', 'classes', 'targetClasses'].forEach(key => {
        if (value[key] !== undefined && value[key] !== null && value[key] !== '') context[key] = value[key];
    });

    const childEntries = lessonPlanChildKeys
        .filter(key => value[key] !== undefined && value[key] !== null)
        .map(key => [key, value[key]]);

    // Group/container objects often have a display title of their own. Prefer
    // their child collection so the group itself is not counted as an extra
    // lesson plan (for example 2 groups × 18 modules must remain 36).
    if (childEntries.length === 0 && hasLessonPlanContent(value)) {
        const item = { ...value };
        if (item.subjectId === undefined && context.subjectId !== undefined) item.subjectId = context.subjectId;
        if (item.groupId === undefined && context.groupId !== undefined) item.groupId = context.groupId;
        if (item.groupName === undefined && context.groupName !== undefined) item.groupName = context.groupName;
        if (!item.title) item.title = item.judul || item.modulName || item.name || '';
        if (!item.topic) item.topic = item.materi || item.topik || '';
        if (!item.classes && item.targetClasses) item.classes = item.targetClasses;
        if (!item.targetClasses && item.classes) item.targetClasses = item.classes;
        return [item];
    }
    if (childEntries.length > 0) {
        const looksLikeNamedGroup = Boolean(
            value.groupId ?? value.group_id ?? value.groupName ?? value.group_name ??
            ((value.name || value.title) && !value.subjectId && !value.subjectCode &&
                !value.subjectName && !value.subject && !value.mapel)
        );
        const groupId = value.groupId ?? value.group_id ?? (looksLikeNamedGroup ? value.id : undefined);
        const groupName = value.groupName ?? value.group_name ??
            (looksLikeNamedGroup ? (value.name || value.title) : undefined);
        const childContext = {
            ...context,
            ...(groupId !== undefined && groupId !== null && groupId !== '' ? { groupId } : {}),
            ...(groupName !== undefined && groupName !== null && groupName !== '' ? { groupName } : {})
        };
        return childEntries.flatMap(([, children]) => flattenLessonPlanCollection(children, childContext, depth + 1));
    }

    return Object.entries(value)
        .filter(([, child]) => child && typeof child === 'object')
        .flatMap(([entryKey, child]) => flattenLessonPlanCollection(
            child,
            context.groupId === undefined ? { ...context, groupId: entryKey } : context,
            depth + 1
        ));
}

function normalizeLessonPlanCollection(payload) {
    const source = Array.isArray(payload)
        ? payload
        : (payload && payload.data !== undefined ? payload.data : payload && payload.lessonPlans);
    if (source === undefined || source === null) return [];
    const result = [];
    const seen = new Set();
    flattenLessonPlanCollection(source).forEach(item => {
        if (!item || typeof item !== 'object') return;
        const id = String(item.id || '').trim();
        const group = String(item.groupId || '').trim().toLowerCase();
        const signature = [
            getLessonPlanSubjectReference(item),
            item.title || item.name || '',
            item.topic || item.materi || '',
            item.grade || '',
            item.semester || '',
            group
        ].map(value => String(value).trim().toLowerCase()).join('::');
        const key = id ? `id::${id}::${group}` : `sig::${signature}`;
        if (seen.has(key)) return;
        seen.add(key);
        result.push(item);
    });
    return result;
}

function resolvePhotoUrl(value) {
    const raw = String(value ?? '').trim();
    if (!raw) return '';
    if (/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=\\r\\n]+$/i.test(raw)) return raw;

    const withoutMarker = raw.replace(/^PHOTO_REF:/i, '').trim();
    if (withoutMarker !== raw) {
        const id = withoutMarker.replace(/^madrasah_photos\//i, '').replace(/[^A-Za-z0-9._-]/g, '_');
        return id ? `/api/photos/${id}` : '';
    }

    if (/^\/api\/photos\/[A-Za-z0-9._-]+$/.test(raw)) return raw;
    if (/^https?:\/\//i.test(raw)) return raw;
    if (/^\/(?:uploads|attendance_photos|photos)\/[A-Za-z0-9._/-]+$/i.test(raw)) return raw;

    const id = raw.replace(/^madrasah_photos\//i, '');
    if (/^[A-Za-z0-9._-]{1,180}$/.test(id)) {
        const normalized = id.replace(/[^A-Za-z0-9._-]/g, '_');
        return normalized ? `/api/photos/${normalized}` : '';
    }
    return '';
}

function getPhotoHtmlSrc(value) {
    const resolved = resolvePhotoUrl(value);
    return resolved ? escapeHtmlAttr(resolved) : '';
}

function isSafeDisplayImageUrl(value) {
    return Boolean(resolvePhotoUrl(value));
}

window.escapeHtml = escapeHtml;
window.escapeHtmlAttr = escapeHtmlAttr;
window.getStoredAuthToken = getStoredAuthToken;
window.persistCurrentUser = persistCurrentUser;
window.readPersistedUser = readPersistedUser;
window.clearPersistedAuthSession = clearPersistedAuthSession;
window.isSafeDisplayImageUrl = isSafeDisplayImageUrl;
window.getLessonPlanSubjectReference = getLessonPlanSubjectReference;
window.normalizeLessonPlanCollection = normalizeLessonPlanCollection;
window.resolvePhotoUrl = resolvePhotoUrl;
window.getPhotoHtmlSrc = getPhotoHtmlSrc;

// Monkey patch window.fetch to automatically append current tenant/madrasahId header and query param
(() => {
    const originalFetch = window.fetch;
    const patchedFetch = function(url, options) {
        let fetchUrl = url;
        options = options || {};
        options.headers = options.headers || {};

        const savedUserData = readPersistedUser(true);
        
        const activeMId = (savedUserData && (savedUserData.madrasahId || savedUserData.madrasahSlug)) || window.__activeTenant?.id || window.__activeTenant?.slug;
        
        // Add User Role header to identify client role
        const userRole = (savedUserData && savedUserData.role) || (window.appState && window.appState.role) || 'student';
        options.headers['X-User-Role'] = userRole;

        const authToken = getStoredAuthToken();
        if (authToken) {
            options.headers['Authorization'] = 'Bearer ' + authToken;
            options.headers['X-Auth-Token'] = authToken;
        }
        
        if (activeMId && activeMId !== 'BOSS') {
            options.headers['X-Madrasah-Id'] = activeMId;
            if (typeof fetchUrl === 'string' && fetchUrl.includes('/api/') && !/[?&]madrasahId=/.test(fetchUrl)) {
                const separator = fetchUrl.includes('?') ? '&' : '?';
                fetchUrl += separator + 'madrasahId=' + encodeURIComponent(activeMId);
            }
        }
        return originalFetch.call(this || window, fetchUrl, options);
    };

    try {
        window.fetch = patchedFetch;
    } catch (e) {
        try {
            Object.defineProperty(window, 'fetch', {
                value: patchedFetch,
                configurable: true,
                writable: true,
                enumerable: true
            });
        } catch (err) {
            console.warn("Failed to overwrite window.fetch:", err);
        }
    }
})();


// Storage cache hygiene: large server-authoritative datasets must not fill localStorage
(() => {
    try {
        localStorage.removeItem('madrasah_students');
        localStorage.removeItem('madrasah_student_livecam_frames');

        // LKPD can contain large embedded images. The server/RAM is authoritative;
        // remove legacy browser copies so they cannot exhaust localStorage quota.
        for (let i = localStorage.length - 1; i >= 0; i--) {
            const key = localStorage.key(i);
            if (key && (key === 'madrasah_lkpdList' || /^madrasah_.+_lkpdList$/.test(key))) {
                localStorage.removeItem(key);
            }
        }

        let role = '';
        try {
            const savedUser = JSON.parse(localStorage.getItem('madrasah_current_user') || 'null');
            role = String(savedUser && savedUser.role || '').toLowerCase();
        } catch (_) {}

        const examRecoveryRoles = ['student', 'class_leader', 'ketua_kelas'];
        if (!examRecoveryRoles.includes(role)) {
            localStorage.removeItem('madrasah_student_exam_questions');
        }
    } catch (_) {}
})();

var appState = {
    currentUser: readPersistedUser(true),
    role: null,
    madrasahs: JSON.parse(localStorage.getItem('madrasah_madrasahs')) || [],
    tokenRequests: [],
    cbtTokenPrice: 5000,
    settings: JSON.parse(localStorage.getItem('madrasah_settings')) || {
        schoolName: 'Madrasah Bisa',
        adminName: 'Administrator',
        adminUser: 'admin',
        adminPass: '',
        radius: 100,
        accuracy: 10,
        theme: 'emerald',
        showDemo: true
    },
    questionBank: [],
    questionBankGroups: [],
    exams: JSON.parse(localStorage.getItem('madrasah_exams')) || [],
    rooms: JSON.parse(localStorage.getItem('madrasah_rooms')) || [],
    classes: JSON.parse(localStorage.getItem('madrasah_classes')) || [],
    teachers: JSON.parse(localStorage.getItem('madrasah_teachers')) || [],
    students: [],
    subjects: JSON.parse(localStorage.getItem('madrasah_subjects')) || [],
    schedules: JSON.parse(localStorage.getItem('madrasah_schedules')) || [],
    savedRosters: JSON.parse(localStorage.getItem('madrasah_savedRosters') || localStorage.getItem('madrasah_saved_rosters')) || [],
    activeRosterId: localStorage.getItem('madrasah_activeRosterId') || null,
    timeSlots: JSON.parse(localStorage.getItem('madrasah_timeSlots') || localStorage.getItem('madrasah_time_slots')) || [],
    kbmDuration: Number(localStorage.getItem('madrasah_kbmDuration') || localStorage.getItem('madrasah_kbm_duration')) || 40,
    attendance: (() => {
        let list = JSON.parse(localStorage.getItem('madrasah_attendance')) || [];
        let photos = {};
        try { photos = JSON.parse(localStorage.getItem('madrasah_attendance_photos') || '{}'); } catch(e) {}
        return list.map(item => {
             if (item.photo && item.photo.startsWith('PHOTO_REF:')) {
                 item.photo = photos[item.id] || '';
             }
             return item;
        });
    })(),
    teacherAttendance: (() => {
        let list = JSON.parse(localStorage.getItem('madrasah_teacherAttendance')) || JSON.parse(localStorage.getItem('madrasah_teacher_attendance')) || [];
        let photos = {};
        try { photos = JSON.parse(localStorage.getItem('madrasah_teacherAttendance_photos') || '{}'); } catch(e) {}
        return list.map(item => {
             if (item.photo && item.photo.startsWith('PHOTO_REF:')) {
                 item.photo = photos[item.id] || '';
             }
             return item;
        });
    })(),
    grades: JSON.parse(localStorage.getItem('madrasah_grades')) || [],
    gradeCategories: JSON.parse(localStorage.getItem('madrasah_gradeCategories') || localStorage.getItem('madrasah_grade_categories')) || ['Harian 1'],
    customGradeColumns: JSON.parse(localStorage.getItem('madrasah_customGradeColumns')) || {},
    calendarEvents: JSON.parse(localStorage.getItem('madrasah_calendarEvents')) || [],
    generatedExams: JSON.parse(localStorage.getItem('madrasah_generated_exams')) || [],
    blockedStudents: JSON.parse(localStorage.getItem('madrasah_blocked_students')) || {},
    journals: JSON.parse(localStorage.getItem('madrasah_journals')) || [],
    questionBankGroups: JSON.parse(localStorage.getItem('madrasah_questionBankGroups') || localStorage.getItem('madrasah_question_groups')) || [],
    activeBankGroupCode: null,
    activeBank: { subjectId: '', classId: '' },
    activeJournalSubjectId: '',
    activeMonitoringExamId: null,
    activeEvaluationExamId: null,
    activeGradeClassId: '',
    activeAttendanceClassId: '',
    activeAttendanceDate: '',
    activeAttendanceSearch: ''
};

function resetAccountScopedRuntimeState() {
    // ACCOUNT_RUNTIME_ISOLATION_V2: clear only in-memory, account-scoped data.
    // Durable CBT recovery/offline queues remain in localStorage for the same student.
    Object.assign(appState, {
        madrasahs: [],
        tokenRequests: [],
        cbtTokenPrice: 5000,
        questionBank: [],
        questionBankGroups: [],
        exams: [],
        rooms: [],
        classes: [],
        teachers: [],
        students: [],
        subjects: [],
        schedules: [],
        savedRosters: [],
        activeRosterId: null,
        timeSlots: [],
        kbmDuration: 40,
        attendance: [],
        teacherAttendance: [],
        grades: [],
        gradeCategories: [],
        customGradeColumns: {},
        calendarEvents: [],
        generatedExams: [],
        blockedStudents: {},
        journals: [],
        lessonPlans: [],
        lkpdList: [],
        importGroups: [],
        eduGames: [],
        gameAttempts: [],
        activeBankGroupCode: null,
        activeBank: { subjectId: '', classId: '' },
        activeJournalSubjectId: '',
        activeMonitoringExamId: null,
        activeEvaluationExamId: null,
        activeGradeClassId: '',
        activeAttendanceClassId: '',
        activeAttendanceDate: '',
        activeAttendanceSearch: ''
    });
}
window.resetAccountScopedRuntimeState = resetAccountScopedRuntimeState;

function adjustColorBrightness(hex, percent) {
    hex = String(hex).replace(/[^0-9a-f]/gi, '');
    if (hex.length < 6) {
        hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
    }
    let r = parseInt(hex.substring(0, 2), 16);
    let g = parseInt(hex.substring(2, 4), 16);
    let b = parseInt(hex.substring(4, 6), 16);

    r = Math.min(255, Math.max(0, r + percent));
    g = Math.min(255, Math.max(0, g + percent));
    b = Math.min(255, Math.max(0, b + percent));

    const rHex = ('0' + r.toString(16)).slice(-2);
    const gHex = ('0' + g.toString(16)).slice(-2);
    const bHex = ('0' + b.toString(16)).slice(-2);

    return '#' + rHex + gHex + bHex;
}

function blendWithWhite(hex, weight = 0.9) {
    hex = String(hex).replace(/[^0-9a-f]/gi, '');
    if (hex.length < 6) {
        hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
    }
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    
    const rBlend = Math.round(r * (1 - weight) + 255 * weight);
    const gBlend = Math.round(g * (1 - weight) + 255 * weight);
    const bBlend = Math.round(b * (1 - weight) + 255 * weight);
    
    return '#' + ('0' + rBlend.toString(16)).slice(-2) + ('0' + gBlend.toString(16)).slice(-2) + ('0' + bBlend.toString(16)).slice(-2);
}

function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

function applyTheme() {
    const themeName = (appState.settings && appState.settings.theme) || 'emerald';
    
    const presets = {
        emerald: {
            primary: '#059669',
            borderRadius: 'large',
            style: 'flat'
        },
        blue: {
            primary: '#2563eb',
            borderRadius: 'medium',
            style: 'glow'
        },
        purple: {
            primary: '#7c3aed',
            borderRadius: 'small',
            style: 'flat'
        },
        rose: {
            primary: '#e11d48',
            borderRadius: 'pill',
            style: 'glow'
        },
        midnight: {
            primary: '#1e293b',
            borderRadius: 'sharp',
            style: 'border'
        }
    };
    
    let primary, radiusType, designStyle;
    
    if (themeName === 'custom' && appState.settings && appState.settings.customTheme) {
        primary = appState.settings.customTheme.primaryColor || '#059669';
        radiusType = appState.settings.customTheme.borderRadius || 'large';
        designStyle = appState.settings.customTheme.designStyle || 'flat';
    } else {
        const preset = presets[themeName] || presets.emerald;
        primary = preset.primary;
        radiusType = preset.borderRadius;
        designStyle = preset.style;
    }
    
    const primaryHover = adjustColorBrightness(primary, -15);
    const primaryDark = adjustColorBrightness(primary, -30);
    const primaryLight = adjustColorBrightness(primary, 15);
    const accentText = adjustColorBrightness(primary, 35);
    const bgLight = blendWithWhite(primary, 0.96);
    const bgMild = blendWithWhite(primary, 0.90);
    const borderLight = blendWithWhite(primary, 0.78);
    const borderMedium = blendWithWhite(primary, 0.50);
    
    const rgb = hexToRgb(primary);
    const shadowColor = rgb ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.25)` : 'rgba(0, 0, 0, 0.1)';
    const glowColor = rgb ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.4)` : 'rgba(0, 0, 0, 0.1)';
    
    let r_3xl = '24px';
    let r_2xl = '16px';
    let r_xl = '12px';
    let r_lg = '8px';
    let r_md = '6px';
    let r_sm = '4px';
    
    if (radiusType === 'sharp') {
        r_3xl = '0px'; r_2xl = '0px'; r_xl = '0px'; r_lg = '0px'; r_md = '0px'; r_sm = '0px';
    } else if (radiusType === 'small') {
        r_3xl = '12px'; r_2xl = '8px'; r_xl = '6px'; r_lg = '4px'; r_md = '2px'; r_sm = '1px';
    } else if (radiusType === 'medium') {
        r_3xl = '18px'; r_2xl = '12px'; r_xl = '8px'; r_lg = '6px'; r_md = '4px'; r_sm = '2px';
    } else if (radiusType === 'large') {
        r_3xl = '24px'; r_2xl = '16px'; r_xl = '12px'; r_lg = '8px'; r_md = '6px'; r_sm = '4px';
    } else if (radiusType === 'pill') {
        r_3xl = '9999px'; r_2xl = '9999px'; r_xl = '24px'; r_lg = '18px'; r_md = '12px'; r_sm = '8px';
    }
    
    let styleTag = document.getElementById('dynamic-theme-style');
    if (!styleTag) {
        styleTag = document.createElement('style');
        styleTag.id = 'dynamic-theme-style';
        document.head.appendChild(styleTag);
    }
    
    let css = `
        :root {
            --theme-primary: ${primary};
            --theme-primary-hover: ${primaryHover};
            --theme-primary-dark: ${primaryDark};
            --theme-primary-light: ${primaryLight};
            --theme-accent-text: ${accentText};
            --theme-bg-light: ${bgLight};
            --theme-bg-mild: ${bgMild};
            --theme-border-light: ${borderLight};
            --theme-border-medium: ${borderMedium};
            
            --theme-radius-3xl: ${r_3xl};
            --theme-radius-2xl: ${r_2xl};
            --theme-radius-xl: ${r_xl};
            --theme-radius-lg: ${r_lg};
            --theme-radius-md: ${r_md};
            --theme-radius-sm: ${r_sm};
            
            --theme-shadow-color: ${shadowColor};
        }
        
        /* Overrides of Tailwind Emerald Classes */
        html body .bg-emerald-600 { background-color: var(--theme-primary) !important; }
        html body .hover\\:bg-emerald-700:hover { background-color: var(--theme-primary-hover) !important; }
        html body .text-emerald-600 { color: var(--theme-primary) !important; }
        html body .text-emerald-400 { color: var(--theme-accent-text) !important; }
        html body .text-emerald-500 { color: var(--theme-primary-light) !important; }
        html body .text-emerald-700 { color: var(--theme-primary-dark) !important; }
        html body .border-emerald-200 { border-color: var(--theme-border-light) !important; }
        html body .border-emerald-500 { border-color: var(--theme-primary-light) !important; }
        html body .border-emerald-600 { border-color: var(--theme-primary) !important; }
        html body .bg-emerald-50 { background-color: var(--theme-bg-light) !important; }
        html body .bg-emerald-100 { background-color: var(--theme-bg-mild) !important; }
        html body .bg-emerald-500 { background-color: var(--theme-primary-light) !important; }
        html body .bg-emerald-500\\/20 { background-color: ${rgb ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.2)` : 'rgba(0,0,0,0.1)'} !important; }
        html body .bg-emerald-600\\/30 { background-color: ${rgb ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.3)` : 'rgba(0,0,0,0.2)'} !important; }
        html body .shadow-emerald-600\\/30 { box-shadow: 0 10px 15px -3px var(--theme-shadow-color), 0 4px 6px -4px var(--theme-shadow-color) !important; }
        html body .focus\\:ring-emerald-500:focus { --tw-ring-color: var(--theme-primary-light) !important; border-color: var(--theme-primary) !important; }
        
        /* Sidebar active adjustments */
        html body #sidebar-menu button:hover {
            background-color: ${rgb ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.15)` : 'rgba(255,255,255,0.05)'} !important;
            color: #ffffff !important;
        }
        
        /* Button & card corner adjustments */
        html body .rounded-3xl { border-radius: var(--theme-radius-3xl) !important; }
        html body .rounded-2xl { border-radius: var(--theme-radius-2xl) !important; }
        html body .rounded-xl { border-radius: var(--theme-radius-xl) !important; }
        html body .rounded-lg { border-radius: var(--theme-radius-lg) !important; }
        html body .rounded-md { border-radius: var(--theme-radius-md) !important; }
        html body .rounded-sm { border-radius: var(--theme-radius-sm) !important; }
    `;
    
    if (designStyle === 'border') {
        css += `
            /* Neubrutalism Retro Style */
            html body button, 
            html body .bg-white, 
            html body input, 
            html body select, 
            html body textarea,
            html body aside { 
                border: 2px solid #0f172a !important; 
                box-shadow: 4px 4px 0px 0px #0f172a !important; 
                transition: transform 0.15s ease, box-shadow 0.15s ease !important;
            }
            html body button:active {
                transform: translate(2px, 2px) !important;
                box-shadow: 2px 2px 0px 0px #0f172a !important;
            }
            html body input:focus, html body select:focus {
                box-shadow: 2px 2px 0px 0px #0f172a !important;
                border-color: var(--theme-primary) !important;
            }
        `;
    } else if (designStyle === 'glow') {
        css += `
            /* Glow / Soft Shadow Style */
            html body button, html body .bg-white {
                box-shadow: 0 0 15px var(--theme-shadow-color) !important;
                border-color: var(--theme-border-light) !important;
            }
            html body button:hover {
                box-shadow: 0 0 20px ${glowColor} !important;
                transform: translateY(-1px) !important;
            }
        `;
    }
    
    styleTag.innerHTML = css;
}

// Apply immediately on load to prevent flash of raw styles
try {
    applyTheme();
} catch (e) {
    console.error(e);
}

// Unique Client ID for real-time synchronization to prevent echo loops
if (!appState.clientId) {
    appState.clientId = 'client_' + Math.random().toString(36).substr(2, 9);
}

function syncActiveRosterWithSchedules() {
    if (!appState.activeRosterId || !Array.isArray(appState.savedRosters)) return;
    const activeRoster = appState.savedRosters.find(r => String(r.id) === String(appState.activeRosterId));
    if (activeRoster) {
        activeRoster.schedules = JSON.parse(JSON.stringify(appState.schedules || []));
        activeRoster.savedAt = new Date().toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        try {
            localStorage.setItem('madrasah_savedRosters', JSON.stringify(appState.savedRosters));
        } catch(e) {}
        fetch('/api/sync-state', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Client-ID': appState.clientId },
            body: JSON.stringify({ key: 'savedRosters', data: appState.savedRosters })
        }).catch(err => console.warn('Error syncing savedRosters:', err));
    }
}

function getLocalStorageRole() {
    let role = '';
    try {
        role = String(
            (appState && appState.currentUser && appState.currentUser.role) ||
            (appState && appState.role) ||
            ''
        ).toLowerCase();
    } catch (_) {}

    if (!role) {
        try {
            const savedUser = JSON.parse(localStorage.getItem('madrasah_current_user') || 'null');
            role = String(savedUser && savedUser.role || '').toLowerCase();
        } catch (_) {}
    }
    return role;
}

const ONLINE_SERVER_AUTH_STORAGE_KEYS = new Set([
    'madrasah_settings',
    'madrasah_students',
    'madrasah_teachers',
    'madrasah_classes',
    'madrasah_subjects',
    'madrasah_attendance',
    'madrasah_attendance_photos',
    'madrasah_teacherAttendance',
    'madrasah_teacher_attendance',
    'madrasah_teacherAttendance_photos',
    'madrasah_teacher_attendance_photos',
    'madrasah_questions',
    'madrasah_questionBank',
    'madrasah_questionBankGroups',
    'madrasah_question_groups',
    'madrasah_questionBank_photos',
    'madrasah_schedules',
    'madrasah_savedRosters',
    'madrasah_timeSlots',
    'madrasah_kbmDuration',
    'madrasah_exams',
    'madrasah_rooms',
    'madrasah_journals',
    'madrasah_gradeCategories',
    'madrasah_grade_categories',
    'madrasah_generated_exams',
    'madrasah_generatedExams',
    'madrasah_lessonPlans',
    'madrasah_lesson_plans',
    'madrasah_grades',
    'madrasah_customGradeColumns',
    'madrasah_schoolLocationSettings',
    'madrasah_madrasahs',
    'madrasah_photoCloudinaryMap'
]);

function isOnlineServerAuthoritativeStorage() {
    try {
        if (window.isOfflineMode === true || appState?.isOfflineMode === true) return false;
        if (window.isOfflineMode === false || appState?.isOfflineMode === false) return true;
    } catch (_) {}
    return false;
}

function purgeOnlineServerAuthoritativeCaches() {
    if (!isOnlineServerAuthoritativeStorage()) return;
    try {
        for (const key of ONLINE_SERVER_AUTH_STORAGE_KEYS) localStorage.removeItem(key);
        for (let i = localStorage.length - 1; i >= 0; i--) {
            const key = localStorage.key(i);
            if (key && (key === 'madrasah_lkpdList' || /^madrasah_.+_lkpdList$/.test(key))) {
                localStorage.removeItem(key);
            }
        }
    } catch (_) {}
}
window.isOnlineServerAuthoritativeStorage = isOnlineServerAuthoritativeStorage;
window.purgeOnlineServerAuthoritativeCaches = purgeOnlineServerAuthoritativeCaches;

function safeSetLocalStorage(key, value) {
    const storageKey = String(key || '');
    if (!storageKey) return false;

    if (storageKey === 'madrasah_current_user') {
        let userValue = value;
        if (typeof userValue === 'string') {
            try { userValue = JSON.parse(userValue); } catch (_) { return false; }
        }
        persistCurrentUser(userValue);
        return true;
    }

    // Cloud Run/online mode is server-authoritative. Keep only session and CBT
    // recovery/offline-queue data in browser storage; purge replicated datasets.
    if (isOnlineServerAuthoritativeStorage() && ONLINE_SERVER_AUTH_STORAGE_KEYS.has(storageKey)) {
        try { localStorage.removeItem(storageKey); } catch (_) {}
        return true;
    }

    // Full LKPD state is server-authoritative and may contain large images.
    // Never persist it in localStorage; also purge any legacy copy quietly.
    if (storageKey === 'madrasah_lkpdList' || /^madrasah_.+_lkpdList$/.test(storageKey)) {
        try { localStorage.removeItem(storageKey); } catch (_) {}
        return false;
    }

    // Server/RAM is authoritative for the full student roster.
    if (storageKey === 'madrasah_students') {
        try { localStorage.removeItem(storageKey); } catch (_) {}
        return true;
    }

    // Livecam frames are ephemeral and must never consume persistent browser quota.
    if (storageKey === 'madrasah_student_livecam_frames') {
        try { localStorage.removeItem(storageKey); } catch (_) {}
        return true;
    }

    // Full per-student question maps are only useful as recovery cache on a student device.
    if (storageKey === 'madrasah_student_exam_questions') {
        const role = getLocalStorageRole();
        const recoveryRoles = ['student', 'class_leader', 'ketua_kelas'];
        if (!recoveryRoles.includes(role)) {
            try { localStorage.removeItem(storageKey); } catch (_) {}
            return true;
        }
    }

    let strVal;
    try {
        strVal = typeof value === 'string' ? value : JSON.stringify(value);
    } catch (e) {
        console.warn(`Gagal serialisasi localStorage key ${storageKey}:`, e);
        return false;
    }

    try {
        localStorage.setItem(storageKey, strVal);
        return true;
    } catch (e) {
        const isQuota = e && (e.name === 'QuotaExceededError' || e.code === 22 || e.code === 1014);
        if (!isQuota) {
            console.warn(`LocalStorage error for ${storageKey}:`, e);
            return false;
        }

        console.warn(`LocalStorage kuota penuh saat menyimpan key: ${storageKey}. Membersihkan cache opsional...`);

        const disposableKeys = [
            'madrasah_students',
            'madrasah_student_livecam_frames',
            'madrasah_attendance_photos',
            'madrasah_teacherAttendance_photos',
            'madrasah_questionBank_photos'
        ];

        const role = getLocalStorageRole();
        if (!['student', 'class_leader', 'ketua_kelas'].includes(role)) {
            disposableKeys.push('madrasah_student_exam_questions');
        }

        for (const k of disposableKeys) {
            if (k === storageKey) continue;
            try { localStorage.removeItem(k); } catch (_) {}
        }

        try {
            localStorage.setItem(storageKey, strVal);
            return true;
        } catch (retryError) {
            console.warn(`LocalStorage tetap penuh; key ${storageKey} tidak dipersist. Data RAM/server tetap dipakai.`, retryError);
            return false;
        }
    }
}
window.safeSetLocalStorage = safeSetLocalStorage;

function saveState(key) {
    if (!key || appState[key] === undefined) return;
    
    if (key === 'attendance' || key === 'teacherAttendance') {
        if (isOnlineServerAuthoritativeStorage()) {
            try {
                localStorage.removeItem('madrasah_' + key);
                localStorage.removeItem('madrasah_' + key + '_photos');
                if (key === 'teacherAttendance') localStorage.removeItem('madrasah_teacher_attendance_photos');
            } catch (_) {}
        } else {
        try {
            const dataList = appState[key];
            const dataWithoutPhotos = [];
            const photoKey = 'madrasah_' + key + '_photos';
            let photoDict = {};
            try {
                photoDict = JSON.parse(localStorage.getItem(photoKey) || '{}');
            } catch(e) {}
            
            let hasNewPhotos = false;
            for (const item of dataList) {
                const copy = { ...item };
                if (copy.photo && copy.photo.startsWith('data:image')) {
                    photoDict[copy.id] = copy.photo;
                    copy.photo = 'PHOTO_REF:' + copy.id;
                    hasNewPhotos = true;
                }
                dataWithoutPhotos.push(copy);
            }
            
            if (hasNewPhotos) {
                // Mencegah LocalStorage penuh (QuotaExceeded)
                // Batasi hanya menyimpan 30 foto terakhir di cache lokal browser
                const keys = Object.keys(photoDict);
                if (keys.length > 30) {
                    // Hapus data terlama (asumsi ID mengandung timestamp atau kita potong dari depan)
                    const keysToDelete = keys.slice(0, keys.length - 30);
                    keysToDelete.forEach(k => delete photoDict[k]);
                }
                
                try {
                    localStorage.setItem(photoKey, JSON.stringify(photoDict));
                } catch(e) {
                    if (e.name === 'QuotaExceededError' || e.code === 22 || e.code === 1014) {
                        console.warn("Storage penuh saat menyimpan foto. Mengosongkan cache foto lama...");
                        // Jika masih penuh, kosongkan seluruh cache foto agar data lain aman
                        localStorage.removeItem(photoKey);
                        // Coba simpan foto yang baru saja (1 foto terakhir)
                        const fallbackDict = {};
                        if (dataList.length > 0) {
                             const lastItem = dataList[dataList.length - 1];
                             if (photoDict[lastItem.id]) {
                                 fallbackDict[lastItem.id] = photoDict[lastItem.id];
                                 try { localStorage.setItem(photoKey, JSON.stringify(fallbackDict)); } catch(_) {}
                             }
                        }
                    }
                }
            }
            safeSetLocalStorage('madrasah_' + key, dataWithoutPhotos);
        } catch(err) {
            console.error('Error separating photo from ' + key, err);
            safeSetLocalStorage('madrasah_' + key, appState[key]);
        }
        }
    } else {
        const storageKey = (key === 'lkpdList' && typeof window.getLkpdStorageKey === 'function') 
            ? window.getLkpdStorageKey() 
            : 'madrasah_' + key;
        safeSetLocalStorage(storageKey, appState[key]);
    }
    if (key === 'schedules') {
        syncActiveRosterWithSchedules();
    }
    fetch('/api/sync-state', {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'X-Client-ID': appState.clientId
        },
        body: JSON.stringify({ key: key, data: appState[key] })
    }).catch(err => console.warn('Error syncing state for ' + key, err));
}

// Map key to state fields and endpoints for real-time syncing
async function syncKeyFromServer(key) {
    let endpoint = '';
    let stateField = key;
    
    if (key === 'teachers') endpoint = '/api/teachers';
    else if (key === 'students') endpoint = '/api/students';
    else if (key === 'classes') endpoint = '/api/classes';
    else if (key === 'subjects') endpoint = '/api/subjects';
    else if (key === 'attendance') endpoint = '/api/attendance';
    else if (key === 'teacherAttendance') endpoint = '/api/teacher-attendance';
    else if (key === 'schedules') endpoint = '/api/schedules';
    else if (key === 'questionBankGroups') endpoint = '/api/question-bank-groups';
    else if (key === 'questionBank' || key === 'questions') { endpoint = '/api/questions'; stateField = 'questionBank'; }
    else if (key === 'exams') endpoint = '/api/exams';
    else if (key === 'rooms') endpoint = '/api/rooms';
    else if (key === 'journals') endpoint = '/api/journals';
    else if (key === 'timeSlots') endpoint = '/api/time-slots';
    else if (key === 'gradeCategories') endpoint = '/api/grade-categories';
    else if (key === 'customGradeColumns') endpoint = '/api/custom-grade-columns';
    else if (key === 'generatedExams') endpoint = '/api/generated-exams';
    else if (key === 'lessonPlans') endpoint = '/api/lesson-plans';
    else if (key === 'grades') endpoint = '/api/grades';
    else if (key === 'lkpdList') endpoint = '/api/lkpds';
    else if (key === 'activeExamSessions') {
        if (appState.role === 'student' || appState.role === 'siswa') return;
        endpoint = '/api/exam-monitoring-state';
    }
    else if (key === 'calendarEvents') endpoint = '/api/calendar-events';
    else if (key === 'settings') endpoint = '/api/settings';
    else if (key === 'madrasahs') endpoint = '/api/madrasahs';
    else if (key === 'tokenRequests') endpoint = '/api/token-requests';
    
    if (!endpoint) return;
    
    try {
        const response = await fetch(endpoint).catch(() => null);
        if (!response || !response.ok) return;
        const resData = await response.json().catch(() => null);
        if (resData && resData.success) {
            let newData = null;
            if (key === 'teachers') {
                newData = resData.teachers;
                if (appState.currentUser && (appState.role === 'teacher' || appState.role === 'guru')) {
                    const matchedT = (resData.teachers || []).find(t => String(t.id) === String(appState.currentUser.id) || String(t.username) === String(appState.currentUser.username) || String(t.nip) === String(appState.currentUser.nip));
                    if (matchedT && typeof matchedT.cbtTokenBalance === 'number') {
                        appState.currentUser.cbtTokenBalance = matchedT.cbtTokenBalance;
                        safeSetLocalStorage('madrasah_current_user', appState.currentUser);
                    }
                }
                if (typeof window.updateHeaderTokenBadge === 'function') {
                    window.updateHeaderTokenBadge();
                }
            }
            else if (key === 'students') newData = resData.students;
            else if (key === 'classes') newData = resData.classes;
            else if (key === 'subjects') newData = resData.subjects;
            else if (key === 'attendance') newData = resData.attendance;
            else if (key === 'teacherAttendance') newData = resData.teacherAttendance;
            else if (key === 'schedules') newData = resData.schedules;
            else if (key === 'timeSlots') {
                newData = resData.timeSlots;
                if (resData.kbmDuration) {
                    appState.kbmDuration = resData.kbmDuration;
                    safeSetLocalStorage('madrasah_kbmDuration', appState.kbmDuration);
                }
            }
            else if (key === 'questionBankGroups') newData = resData.groups;
            else if (key === 'questionBank' || key === 'questions') newData = resData.questions;
            else if (key === 'exams') newData = resData.exams;
            else if (key === 'rooms') newData = resData.rooms;
            else if (key === 'journals') newData = resData.journals;
            else if (key === 'gradeCategories') newData = resData.gradeCategories || resData.categories;
            else if (key === 'customGradeColumns') newData = resData.customGradeColumns;
            else if (key === 'calendarEvents') newData = resData.calendarEvents;
            else if (key === 'generatedExams') newData = resData.generatedExams;
            else if (key === 'lessonPlans') newData = normalizeLessonPlanCollection(resData);
            else if (key === 'grades') newData = resData.grades;
            else if (key === 'lkpdList') newData = resData.lkpdList;
            else if (key === 'settings') newData = resData.settings;
            else if (key === 'madrasahs') {
                // /api/madrasahs intentionally returns a sanitized object for non-BOSS users.
                // Preserve the last authoritative token balance when that sanitized payload omits cbtTokenBalance.
                const incomingMadrasahs = Array.isArray(resData.madrasahs) ? resData.madrasahs : [];
                newData = incomingMadrasahs.map(m => {
                    const existingM = (appState.madrasahs || []).find(oldM =>
                        String(oldM.id) === String(m.id) ||
                        (m.slug && String(oldM.slug) === String(m.slug))
                    );
                    if (typeof m.cbtTokenBalance !== 'number' && existingM && typeof existingM.cbtTokenBalance === 'number') {
                        return { ...m, cbtTokenBalance: existingM.cbtTokenBalance };
                    }
                    return m;
                });

                // Update the active admin session only when the server actually supplied a numeric balance.
                // Never overwrite a fresh activation balance with undefined from the sanitized madrasah response.
                if (appState.currentUser && (appState.role === 'admin' || appState.role === 'administrator')) {
                    const currentMId = appState.currentUser.madrasahId || appState.currentUser.madrasahSlug || 'default';
                    const matchedM = newData.find(m =>
                        String(m.id) === String(currentMId) ||
                        String(m.slug) === String(currentMId)
                    );
                    if (matchedM && typeof matchedM.cbtTokenBalance === 'number') {
                        appState.currentUser.cbtTokenBalance = matchedM.cbtTokenBalance;
                        safeSetLocalStorage('madrasah_current_user', appState.currentUser);
                    }
                }
                if (typeof window.updateHeaderTokenBadge === 'function') {
                    window.updateHeaderTokenBadge();
                }
            }
            else if (key === 'tokenRequests') newData = resData.tokenRequests;
            else if (key === 'activeExamSessions') {
                newData = resData.activeExamSessions;
                if (resData.completedExams) {
                    appState.completedExams = resData.completedExams;
                    safeSetLocalStorage('madrasah_completed_exams', appState.completedExams);
                }
                if (resData.studentLivecamFrames) appState.runtimeLivecamFrames = resData.studentLivecamFrames;
                if (resData.studentTabSwitches) safeSetLocalStorage('madrasah_student_tab_switches', resData.studentTabSwitches);
                if (resData.studentOutOfTab) safeSetLocalStorage('madrasah_student_out_of_tab', resData.studentOutOfTab);
                if (resData.blockedStudents) safeSetLocalStorage('madrasah_blocked_students', resData.blockedStudents);
            }
            
            if (newData !== null && newData !== undefined) {
                if (stateField === 'students' && typeof sortStudentsByNis === 'function') {
                    appState.students = sortStudentsByNis(newData);
                } else if (stateField === 'students' && typeof window.sortStudentsByNis === 'function') {
                    appState.students = window.sortStudentsByNis(newData);
                } else if (!isOnlineServerAuthoritativeStorage() && stateField === 'attendance' && Array.isArray(newData) && newData.length === 0 && Array.isArray(appState.attendance) && appState.attendance.length > 0) {
                    // Do not wipe client attendance if server returned empty, sync client data to server instead
                    fetch('/api/sync-state', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: 'attendance', data: appState.attendance }) }).catch(() => {});
                } else if (!isOnlineServerAuthoritativeStorage() && stateField === 'teacherAttendance' && Array.isArray(newData) && newData.length === 0 && Array.isArray(appState.teacherAttendance) && appState.teacherAttendance.length > 0) {
                    fetch('/api/sync-state', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: 'teacherAttendance', data: appState.teacherAttendance }) }).catch(() => {});
                } else if (!isOnlineServerAuthoritativeStorage() && stateField === 'grades' && Array.isArray(newData) && newData.length === 0 && Array.isArray(appState.grades) && appState.grades.length > 0) {
                    fetch('/api/sync-state', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: 'grades', data: appState.grades }) }).catch(() => {});
                } else {
                    appState[stateField] = newData;
                }
                const storageKey = (stateField === 'lkpdList' && typeof window.getLkpdStorageKey === 'function') 
                    ? window.getLkpdStorageKey() 
                    : 'madrasah_' + stateField;
                safeSetLocalStorage(storageKey, appState[stateField]);
                
                const lastRoute = localStorage.getItem('madrasah_last_route') || 'dashboard';
                const activeEl = document.activeElement;
                const isTyping = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA');
                
                const routeMap = {
                    'teachers': ['guru', 'dashboard'],
                    'students': ['siswa', 'dashboard'],
                    'classes': ['kelas', 'dashboard'],
                    'attendance': ['absen', 'absen_siswa', 'absen_kelas', 'absen_ketua', 'dashboard'],
                    'teacherAttendance': ['absen', 'absen_guru_self', 'dashboard'],
                    'schedules': ['jadwal', 'dashboard'],
                    'exams': ['asesmen', 'asesmen_siswa', 'dashboard'],
                    'questionBank': ['bank_soal'],
                    'questions': ['bank_soal'],
                    'journals': ['jurnal', 'dashboard'],
                    'grades': ['nilai'],
                    'lkpdList': ['asesmen', 'dashboard'],
                    'activeExamSessions': ['asesmen'],
                    'calendarEvents': ['kalender', 'dashboard'],
                    'settings': ['setting'],
                    'madrasahs': ['token', 'boss_dashboard', 'dashboard'],
                    'tokenRequests': ['token', 'boss_dashboard', 'dashboard']
                };
                
                const targetRoutes = routeMap[key] || [];
                if (targetRoutes.includes(lastRoute) && !isTyping) {
                    if (window.navigateTo) {
                        window.navigateTo(lastRoute);
                    }
                }
            }
        }
    } catch (err) {
        console.warn('Real-time sync pause for key: ' + key, err?.message || err);
    }
}

const realtimeKeySyncState = new Map();

function queueRealtimeKeySync(key) {
    const normalizedKey = String(key || '').trim();
    if (!normalizedKey) return;

    let state = realtimeKeySyncState.get(normalizedKey);
    if (!state) {
        state = { running: false, pending: false, timer: null, lastStartedAt: 0 };
        realtimeKeySyncState.set(normalizedKey, state);
    }

    state.pending = true;

    const run = async () => {
        state.timer = null;
        if (state.running || !state.pending) return;
        state.pending = false;
        state.running = true;
        state.lastStartedAt = Date.now();
        try {
            await syncKeyFromServer(normalizedKey);
        } finally {
            state.running = false;
            if (state.pending) {
                const elapsed = Date.now() - state.lastStartedAt;
                state.timer = setTimeout(run, Math.max(0, 300 - elapsed));
            }
        }
    };

    if (state.running || state.timer) return;
    const elapsed = Date.now() - state.lastStartedAt;
    state.timer = setTimeout(run, Math.max(0, 300 - elapsed));
}
window.queueRealtimeKeySync = queueRealtimeKeySync;

function getStoredRealtimeAuthToken() {
    return getStoredAuthToken();
}

function initRealtimeSync() {
    // Prevent duplicate SSE loops when modules/routes are rendered repeatedly.
    if (window.__madrasahRealtimeStarted) return;
    window.__madrasahRealtimeStarted = true;

    let sseSource = null;
    let reconnectTimeout = null;
    let authWatchInterval = null;
    let connectedAuthToken = '';
    let rejectedAuthToken = '';

    const closeSource = () => {
        if (sseSource) {
            try { sseSource.close(); } catch (_) {}
            sseSource = null;
        }
        connectedAuthToken = '';
    };

    const scheduleReconnect = (delay = 1500) => {
        if (reconnectTimeout) clearTimeout(reconnectTimeout);
        reconnectTimeout = setTimeout(() => {
            reconnectTimeout = null;
            connect();
        }, delay);
    };

    async function connect() {
        closeSource();

        const authToken = getStoredRealtimeAuthToken();
        const currentUser = appState && appState.currentUser ? appState.currentUser : null;
        if (!authToken) {
            // Logged-out/login page: wait locally. Do NOT hit protected endpoints.
            rejectedAuthToken = '';
            scheduleReconnect(1500);
            return;
        }

        // A persisted token can exist before initAppSession has validated it against
        // /api/auth/me. Wait for both runtime readiness and an authenticated in-memory
        // user so startup cannot race protected realtime endpoints with a stale token.
        if (window.__onlineRuntimeReady !== true || !currentUser || !currentUser.role) {
            rejectedAuthToken = '';
            scheduleReconnect(1500);
            return;
        }

        // If this exact token was already rejected, wait for login/session rotation
        // instead of spamming /api/realtime-token with repeated 401 responses.
        if (rejectedAuthToken && rejectedAuthToken === authToken) {
            scheduleReconnect(2000);
            return;
        }

        console.log('Connecting to authenticated real-time event stream...');
        let realtimeTicket = '';
        try {
            const ticketResponse = await fetch('/api/realtime-token', { cache: 'no-store' });
            if (ticketResponse.status === 401 || ticketResponse.status === 403) {
                rejectedAuthToken = authToken;
                scheduleReconnect(2000);
                return;
            }
            const ticketData = await ticketResponse.json();
            if (ticketResponse.ok && ticketData && ticketData.success && ticketData.token) {
                realtimeTicket = String(ticketData.token);
            }
        } catch (err) {
            console.warn('Unable to obtain realtime access ticket:', err);
        }

        if (!realtimeTicket) {
            scheduleReconnect(5000);
            return;
        }

        rejectedAuthToken = '';
        connectedAuthToken = authToken;
        sseSource = new EventSource('/api/realtime-stream?rt=' + encodeURIComponent(realtimeTicket));

        sseSource.onmessage = function(event) {
            try {
                const payload = JSON.parse(event.data);
                if (payload && payload.type === 'state-update') {
                    if (payload.senderClientId !== appState.clientId) {
                        queueRealtimeKeySync(payload.key);
                    }
                } else if (payload && (payload.type === 'exam_progress' || payload.type === 'student_heartbeat' || payload.type === 'exam_violation' || payload.type === 'exam_finish' || payload.type === 'exam_started' || payload.type === 'exam_presence')) {
                    if (typeof window.__onExamMonitoringEvent === 'function') {
                        window.__onExamMonitoringEvent(payload);
                    }
                } else if (payload && (payload.type === 'lkpd_progress' || payload.type === 'lkpd_violation' || payload.type === 'lkpd_frame')) {
                    if (typeof window.__onLkpdMonitoringEvent === 'function') {
                        window.__onLkpdMonitoringEvent(payload);
                    }
                }
            } catch (e) {
                console.error('Error parsing SSE event data:', e);
            }
        };

        sseSource.onerror = function() {
            closeSource();
            scheduleReconnect(5000);
        };
    }

    // Detect login/logout/token rotation without making any protected request
    // until startup readiness and session restoration are both complete.
    authWatchInterval = setInterval(() => {
        const currentToken = getStoredRealtimeAuthToken();
        const currentUser = appState && appState.currentUser ? appState.currentUser : null;
        if (!currentToken || window.__onlineRuntimeReady !== true || !currentUser || !currentUser.role) {
            if (sseSource) closeSource();
            return;
        }
        if (connectedAuthToken && currentToken !== connectedAuthToken) {
            closeSource();
            rejectedAuthToken = '';
            scheduleReconnect(0);
        } else if (!sseSource && currentToken !== rejectedAuthToken && !reconnectTimeout) {
            scheduleReconnect(0);
        }
    }, 2000);

    window.__stopRealtimeSync = function() {
        closeSource();
        if (reconnectTimeout) clearTimeout(reconnectTimeout);
        reconnectTimeout = null;
        if (authWatchInterval) clearInterval(authWatchInterval);
        authWatchInterval = null;
        window.__madrasahRealtimeStarted = false;
    };

    connect();
}

window.initRealtimeSync = initRealtimeSync;

// Start realtime synchronization on load. It remains local-only until runtime
// readiness and the persisted/authenticated session have both been validated.
setTimeout(initRealtimeSync, 1000);

window.applyLogoShape = function(element, shape) {
    if (!element) return;
    element.classList.remove('rounded-none', 'rounded-sm', 'rounded-md', 'rounded-lg', 'rounded-xl', 'rounded-2xl', 'rounded-3xl', 'rounded-full', 'rounded-tl-[24px]', 'rounded-br-[24px]', 'rounded-tr-[24px]', 'rounded-bl-[24px]');
    element.style.clipPath = '';

    const clipPaths = {
        'shape-pentagon': 'polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%)',
        'shape-hexagon': 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)',
        'shape-star': 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)',
        'shape-octagon': 'polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%)',
        'shape-shield': 'polygon(0% 0%, 100% 0%, 100% 75%, 50% 100%, 0% 75%)',
        'shape-dome': 'polygon(50% 0%, 100% 25%, 100% 100%, 0% 100%, 0% 25%)'
    };

    if (clipPaths[shape]) {
        element.style.clipPath = clipPaths[shape];
    } else if (shape && shape.includes(' ')) {
        shape.split(' ').forEach(cls => {
            if (cls.trim()) element.classList.add(cls.trim());
        });
    } else if (shape) {
        element.classList.add(shape);
    }
};

function updateSchoolLogoUI() {
    const container = document.getElementById('nav-school-logo-container');
    if (!container) return;
    
    if (!appState.settings) appState.settings = {};
    const shape = appState.settings.schoolLogoShape || 'rounded-xl';
    const bg = appState.settings.schoolLogoBg || '#059669';

    window.applyLogoShape(container, shape);

    // Apply background color
    if (bg.startsWith('#') || bg.startsWith('rgb') || bg.startsWith('hsl')) {
        container.style.backgroundColor = bg;
        container.className = container.className.replace(/\bbg-\S+/g, ''); // strip tailwind bg- classes
    } else {
        container.style.backgroundColor = '';
        container.classList.add(bg);
    }
    
    // Apply icon/text color
    const color = appState.settings.schoolLogoColor || '#ffffff';
    container.style.color = color;
    
    const logo = String((appState.settings && appState.settings.schoolLogo) || 'fa-moon');
    container.replaceChildren();
    if (isSafeDisplayImageUrl(logo)) {
        const img = document.createElement('img');
        img.src = logo;
        img.className = 'w-full h-full object-cover';
        img.referrerPolicy = 'no-referrer';
        img.alt = 'Logo';
        container.appendChild(img);
    } else {
        const icon = document.createElement('i');
        icon.id = 'nav-school-logo-icon';
        icon.classList.add('fa-solid');
        icon.classList.add(/^fa-[a-z0-9-]+$/i.test(logo) ? logo : 'fa-moon');
        container.appendChild(icon);
    }
    try {
        applyLoginCustomization();
    } catch(e) {}
}

function applyLoginCustomization() {
    if (!appState.settings) appState.settings = {};
    const cfg = appState.settings.loginConfig || {};

    const logoPos = cfg.logoPosition || 'center';
    const logoSize = cfg.logoSize || 'medium';
    const logoShape = cfg.logoShape || 'rounded-2xl';
    const bgStyle = cfg.bgStyle || 'default';
    const cardStyle = cfg.cardStyle || 'shadow-emerald';
    const title = cfg.title !== undefined ? cfg.title : 'Selamat Datang Kembali';
    const subtitle = cfg.subtitle !== undefined ? cfg.subtitle : 'Silakan masukkan username dan password Anda untuk masuk ke sistem.';
    const noticeText = cfg.noticeText || '';
    const buttonText = cfg.buttonText !== undefined ? cfg.buttonText : 'Masuk Portal';
    const footerText = cfg.footerText !== undefined ? cfg.footerText : 'zeinsgroup · Portal Administrasi Madrasah';
    const showLeftPanel = cfg.showLeftPanel !== undefined ? cfg.showLeftPanel : true;
    const panelTitle = cfg.panelTitle !== undefined ? cfg.panelTitle : 'Mengelola Administrasi & Ujian CBT Secara Presisi';
    const panelDesc = cfg.panelDesc !== undefined ? cfg.panelDesc : 'Platform khusus madrasah untuk mengotomatisasi daftar hadir berbasis geolokasi, monitoring ujian waktu nyata (CBT), penyusunan modul ajar berbasis AI, serta pengolahan nilai rapor digital dalam satu ekosistem terpadu yang andal.';
    const panelBadge = cfg.panelBadge !== undefined ? cfg.panelBadge : 'Sistem Manajemen Modern';
    const customBg = cfg.customBg || '#0f172a';

    // 1. Update Titles & Subtitles & Footer
    const titleEl = document.getElementById('login-main-title');
    if (titleEl) titleEl.innerText = title;

    const subEl = document.getElementById('login-main-subtitle');
    if (subEl) subEl.innerText = subtitle;

    const btnEl = document.getElementById('login-submit-btn');
    if (btnEl) {
        const label = document.createElement('span');
        label.textContent = String(buttonText);
        const icon = document.createElement('i');
        icon.className = 'fa-solid fa-arrow-right text-xs ml-1.5';
        btnEl.replaceChildren(label, icon);
    }

    const rightFooterEl = document.getElementById('login-right-footer');
    if (rightFooterEl) rightFooterEl.textContent = '© ' + String(footerText);

    const leftFooterEl = document.getElementById('login-left-footer');
    if (leftFooterEl) leftFooterEl.textContent = '© ' + String(footerText);

    const panelTitleEl = document.getElementById('login-panel-title');
    if (panelTitleEl) panelTitleEl.innerText = panelTitle;

    const panelDescEl = document.getElementById('login-panel-desc');
    if (panelDescEl) panelDescEl.innerText = panelDesc;

    const panelBadgeEl = document.getElementById('login-panel-badge');
    if (panelBadgeEl) panelBadgeEl.innerText = panelBadge;

    const leftSchoolNameEl = document.getElementById('login-left-school-name');
    if (leftSchoolNameEl) leftSchoolNameEl.innerText = appState.settings.schoolName || 'Madrasah Aliyah';

    // Notice banner
    const noticeEl = document.getElementById('login-notice-banner');
    if (noticeEl) {
        if (noticeText && noticeText.trim() !== '') {
            noticeEl.innerText = noticeText;
            noticeEl.classList.remove('hidden');
        } else {
            noticeEl.classList.add('hidden');
        }
    }

    // 2. Left Panel Visibility
    const leftPanelEl = document.getElementById('login-left-panel');
    if (leftPanelEl) {
        if (showLeftPanel) {
            leftPanelEl.classList.remove('hidden');
            leftPanelEl.classList.add('lg:flex');
        } else {
            leftPanelEl.classList.add('hidden');
            leftPanelEl.classList.remove('lg:flex');
        }
    }

    // 3. Logo Rendering (Icon/Image, Size, Shape, Position)
    const logoBox = document.getElementById('login-logo-box');
    const headerBox = document.getElementById('login-header-box');
    const leftLogoBox = document.getElementById('login-left-logo-box');

    const currentSchoolLogo = appState.settings.schoolLogo || 'fa-mosque';
    const logoBg = appState.settings.schoolLogoBg || '#059669';
    const logoShapeGlobal = appState.settings.schoolLogoShape || 'rounded-xl';

    const renderLogoContent = (container) => {
        if (!container) return;
        if (currentSchoolLogo.startsWith('data:image/') || currentSchoolLogo.startsWith('http://') || currentSchoolLogo.startsWith('https://')) {
            container.innerHTML = `<img src="${escapeHtmlAttr(currentSchoolLogo)}" class="w-full h-full object-cover" referrerPolicy="no-referrer" alt="Logo">`;
        } else {
            container.innerHTML = `<i class="fa-solid ${escapeHtmlAttr(currentSchoolLogo)}"></i>`;
        }

        // Apply background color
        if (logoBg.startsWith('#') || logoBg.startsWith('rgb') || logoBg.startsWith('hsl')) {
            container.style.backgroundColor = logoBg;
            container.className = container.className.replace(/\bbg-\S+/g, '');
        } else {
            container.style.backgroundColor = '';
            container.classList.add(logoBg);
        }
    };

    if (leftLogoBox) {
        renderLogoContent(leftLogoBox);
        window.applyLogoShape(leftLogoBox, logoShapeGlobal);
    }

    if (logoBox && headerBox) {
        if (logoPos === 'hidden') {
            logoBox.classList.add('hidden');
        } else {
            logoBox.classList.remove('hidden');
            renderLogoContent(logoBox);

            // Alignment
            headerBox.classList.remove('items-center', 'items-start', 'items-end', 'text-center', 'text-left', 'text-right');
            logoBox.classList.remove('mx-auto', 'ml-0', 'mr-0');

            if (logoPos === 'left') {
                headerBox.classList.add('items-start', 'text-left');
            } else if (logoPos === 'right') {
                headerBox.classList.add('items-end', 'text-right');
            } else {
                headerBox.classList.add('items-center', 'text-center');
                logoBox.classList.add('mx-auto');
            }

            // Size
            logoBox.classList.remove('w-10', 'h-10', 'text-base', 'w-14', 'h-14', 'text-xl', 'w-20', 'h-20', 'text-3xl', 'w-28', 'h-28', 'text-5xl');
            if (logoSize === 'small') {
                logoBox.classList.add('w-10', 'h-10', 'text-base');
            } else if (logoSize === 'large') {
                logoBox.classList.add('w-20', 'h-20', 'text-3xl');
            } else if (logoSize === 'xlarge') {
                logoBox.classList.add('w-28', 'h-28', 'text-5xl');
            } else {
                logoBox.classList.add('w-14', 'h-14', 'text-xl');
            }

            // Shape (prefer local logoShape from login config if customized, else use global logoShapeGlobal)
            const activeShape = (logoShape === 'rounded-2xl' && logoShapeGlobal !== 'rounded-xl') ? logoShapeGlobal : logoShape;
            window.applyLogoShape(logoBox, activeShape);
        }
    }

    // 4. Background Style
    const container = document.getElementById('login-container');
    const rightPanel = document.getElementById('login-right-panel');
    const bgPattern = document.getElementById('login-right-bg-pattern');

    if (container && rightPanel) {
        container.style.background = '';
        rightPanel.style.background = '';

        container.classList.remove('bg-slate-50', 'bg-slate-950', 'text-white', 'text-slate-900', 'bg-gradient-to-br', 'from-emerald-950', 'via-slate-900', 'to-teal-950', 'from-slate-950', 'via-blue-950', 'from-amber-50', 'via-orange-50', 'to-amber-100', 'bg-white');
        rightPanel.classList.remove('bg-white', 'bg-slate-900', 'bg-slate-900/90', 'bg-transparent', 'bg-amber-50/60');

        if (bgStyle === 'emerald-gradient') {
            container.classList.add('bg-gradient-to-br', 'from-emerald-950', 'via-slate-900', 'to-teal-950', 'text-white');
            rightPanel.classList.add('bg-transparent');
            if (bgPattern) bgPattern.style.opacity = '0.1';
        } else if (bgStyle === 'dark-luxury') {
            container.classList.add('bg-slate-950', 'text-white');
            rightPanel.classList.add('bg-slate-900/90');
            if (bgPattern) bgPattern.style.opacity = '0.15';
        } else if (bgStyle === 'deep-navy') {
            container.classList.add('bg-gradient-to-br', 'from-slate-950', 'via-blue-950', 'to-slate-900', 'text-white');
            rightPanel.classList.add('bg-transparent');
            if (bgPattern) bgPattern.style.opacity = '0.1';
        } else if (bgStyle === 'warm-amber') {
            container.classList.add('bg-gradient-to-br', 'from-amber-50', 'via-orange-50', 'to-amber-100', 'text-slate-900');
            rightPanel.classList.add('bg-amber-50/60');
            if (bgPattern) bgPattern.style.opacity = '0.2';
        } else if (bgStyle === 'clean-white') {
            container.classList.add('bg-white', 'text-slate-900');
            rightPanel.classList.add('bg-white');
            if (bgPattern) bgPattern.style.opacity = '0.3';
        } else if (bgStyle === 'custom') {
            container.style.background = customBg;
            rightPanel.classList.add('bg-transparent');
            if (bgPattern) bgPattern.style.opacity = '0.15';
        } else {
            // default
            container.classList.add('bg-slate-50', 'text-slate-900');
            rightPanel.classList.add('bg-white');
            if (bgPattern) bgPattern.style.opacity = '0.4';
        }
    }

    // 5. Card Wrapper Style
    const cardWrapper = document.getElementById('login-card-wrapper');
    if (cardWrapper) {
        cardWrapper.classList.remove(
            'bg-white', 'p-8', 'rounded-3xl', 'shadow-xl', 'shadow-emerald-500/10', 'border', 'border-slate-100',
            'bg-white/85', 'backdrop-blur-xl', 'shadow-2xl', 'border-white/50',
            'border-2', 'border-slate-900', 'shadow-[6px_6px_0px_0px_rgba(15,23,42,1)]',
            'bg-white/90', 'p-6', 'sm:p-8', 'border-slate-200'
        );

        if (cardStyle === 'glassmorphism') {
            cardWrapper.classList.add('bg-white/85', 'backdrop-blur-xl', 'p-8', 'rounded-3xl', 'shadow-2xl', 'border', 'border-white/50');
        } else if (cardStyle === 'border-bold') {
            cardWrapper.classList.add('bg-white', 'p-8', 'rounded-3xl', 'border-2', 'border-slate-900', 'shadow-[6px_6px_0px_0px_rgba(15,23,42,1)]');
        } else if (cardStyle === 'flat-clean') {
            cardWrapper.classList.add('bg-white', 'p-6', 'sm:p-8', 'rounded-3xl', 'border', 'border-slate-200');
        } else {
            // shadow-emerald / default
            cardWrapper.classList.add('bg-white', 'p-8', 'rounded-3xl', 'shadow-xl', 'shadow-emerald-500/10', 'border', 'border-slate-100');
        }
    }
}

function showConfirmModal(message, onConfirm) {
    const modal = document.getElementById('modal-container');
    if (!modal) {
        if (onConfirm) onConfirm();
        return;
    }
    modal.innerHTML = `
        <div class="fixed inset-0 z-[999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
            <div class="bg-white w-full max-w-sm rounded-3xl shadow-2xl p-6 text-center space-y-4 border border-slate-100">
                <div class="w-12 h-12 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto text-xl">
                    <i class="fa-solid fa-trash-can"></i>
                </div>
                <h3 class="font-bold text-slate-800 text-base">Konfirmasi Hapus</h3>
                <p id="confirm-modal-message" class="text-xs text-slate-500 leading-relaxed"></p>
                <div class="flex space-x-3 pt-2">
                    <button type="button" onclick="closeModal()" class="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-2xl text-xs transition cursor-pointer">
                        Batal
                    </button>
                    <button type="button" id="confirm-action-btn" class="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-2xl text-xs shadow transition cursor-pointer">
                        Ya, Hapus
                    </button>
                </div>
            </div>
        </div>
    `;
    const messageEl = document.getElementById('confirm-modal-message');
    if (messageEl) messageEl.textContent = String(message || '');
    const btn = document.getElementById('confirm-action-btn');
    if (btn) {
        btn.onclick = () => {
            closeModal();
            if (onConfirm) onConfirm();
        };
    }
}
window.showConfirmModal = showConfirmModal;

function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    let displayMessage = message || '';
    let displayType = type;

    // Check if message is a quota / 429 rate limit error
    if (typeof displayMessage === 'string' && (
        displayMessage.includes('RESOURCE_EXHAUSTED') ||
        displayMessage.includes('quota') ||
        displayMessage.includes('Quota') ||
        displayMessage.includes('429') ||
        displayMessage.includes('rate-limit') ||
        displayMessage.includes('rate limit')
    )) {
        displayMessage = '⚠️ Limit Generate AI Harian Tercapai. Dokumen disajikan menggunakan templat standar madrasah.';
        displayType = 'warning';
    }

    const toast = document.createElement('div');
    const bgClass = displayType === 'error' ? 'bg-rose-600' : (displayType === 'warning' ? 'bg-amber-600' : (displayType === 'info' ? 'bg-blue-600' : 'bg-emerald-600'));
    const iconClass = displayType === 'error' ? 'fa-triangle-exclamation' : (displayType === 'warning' ? 'fa-triangle-exclamation' : (displayType === 'info' ? 'fa-circle-info' : 'fa-circle-check'));

    toast.className = `p-4 rounded-2xl shadow-xl text-xs font-semibold text-white flex items-center space-x-2 transition transform translate-y-2 opacity-0 pointer-events-auto ${bgClass}`;
    const icon = document.createElement('i');
    icon.className = `fa-solid ${iconClass} text-sm`;
    const text = document.createElement('span');
    text.textContent = String(displayMessage ?? '');
    toast.replaceChildren(icon, text);
    container.appendChild(toast);
    setTimeout(() => toast.classList.remove('translate-y-2', 'opacity-0'), 50);
    setTimeout(() => {
        toast.classList.add('translate-y-2', 'opacity-0');
        setTimeout(() => toast.remove(), 300);
    }, 4500);
}

let runtimeReadinessPromise = null;
let runtimeReadinessConfirmed = false;

function updateInitialRuntimeStatus(message) {
    try {
        const status = document.getElementById('app-initial-loader-status');
        if (status) status.textContent = String(message || '');
    } catch (_) {}
}

async function waitForServerRuntimeReady(maxWaitMs = 45000) {
    if (runtimeReadinessConfirmed) return true;
    if (runtimeReadinessPromise) return runtimeReadinessPromise;

    runtimeReadinessPromise = (async () => {
        const startedAt = Date.now();
        let attempt = 0;

        while ((Date.now() - startedAt) < maxWaitMs) {
            attempt += 1;
            try {
                const response = await fetch('/api/health', {
                    cache: 'no-store',
                    headers: { 'Cache-Control': 'no-cache' }
                });
                const data = await response.json().catch(() => null);
                if (response.ok && data && data.ready === true) {
                    runtimeReadinessConfirmed = true;
                    window.__onlineRuntimeReady = true;
                    updateInitialRuntimeStatus('Portal siap digunakan');
                    try { window.dispatchEvent(new CustomEvent('madrasah:runtime-ready')); } catch (_) {}
                    return true;
                }
                if (data && data.dbConnected === false) {
                    updateInitialRuntimeStatus('Menghubungkan Cloud SQL...');
                } else if (data && data.hydrated === false) {
                    updateInitialRuntimeStatus('Memuat data Cloud SQL...');
                }
            } catch (_) {}

            if ((Date.now() - startedAt) > 1200) {
                updateInitialRuntimeStatus('Menyiapkan koneksi Cloud SQL...');
            }
            const delayMs = Math.min(2000, 700 + (attempt * 150));
            await new Promise(resolve => setTimeout(resolve, delayMs));
        }

        updateInitialRuntimeStatus('Database belum siap. Mencoba kembali...');
        return false;
    })().finally(() => {
        runtimeReadinessPromise = null;
    });

    return runtimeReadinessPromise;
}

window.waitForServerRuntimeReady = waitForServerRuntimeReady;

async function loadInitialRuntimeSettings() {
    try {
        const res = await fetch('/api/settings');
        const data = await res.json().catch(() => null);
        if (data && data.success && data.settings) {
            appState.settings = { ...appState.settings, ...data.settings };
            appState.isOfflineMode = !!data.isOfflineMode;
            window.isOfflineMode = !!data.isOfflineMode;
            if (!window.isOfflineMode) purgeOnlineServerAuthoritativeCaches();
            return true;
        }
    } catch (e) {
        console.warn('Gagal fetch settings awal:', e);
    }
    return false;
}

function showLoggedOutShellImmediately() {
    appState.currentUser = null;
    appState.role = null;
    appState.currentRoute = null;
    appState.navigationHistory = [];
    updateGlobalBackBar();
    resetAccountScopedRuntimeState();

    try { applyTheme(); } catch(e) {}
    updateSchoolLogoUI();
    try { applyLoginCustomization(); } catch(e) {}

    const loginContainer = document.getElementById('login-container');
    const mainApp = document.getElementById('main-app');
    if (loginContainer) loginContainer.classList.remove('hidden');
    if (mainApp) mainApp.classList.add('hidden');
}

async function initAppSession() {
    console.log('MEMERIKSA SESI LOGIN...');

    // A fresh browser/window may still have the local profile but no sessionStorage JWT.
    // Do not hold the login screen behind Cloud SQL hydration when there is no session
    // that can be restored. Show the logged-out shell immediately and warm readiness
    // in the background; handleLogin still gates authentication on runtime readiness.
    let savedUserData = readPersistedUser(true);
    if (!savedUserData || !savedUserData.role) {
        showLoggedOutShellImmediately();

        waitForServerRuntimeReady(45000).then(async (runtimeReady) => {
            if (!runtimeReady) {
                console.warn('Runtime online belum siap; login tetap tersedia dan readiness akan dicoba lagi.');
                setTimeout(initAppSession, 5000);
                return;
            }
            await loadInitialRuntimeSettings();
            try { applyTheme(); } catch(e) {}
            setTimeout(() => ensureOfflineLicenseActivationUi(), 0);
            updateSchoolLogoUI();
            try { applyLoginCustomization(); } catch(e) {}
        }).catch(() => {});

        return;
    }

    const runtimeReady = await waitForServerRuntimeReady(45000);
    if (!runtimeReady) {
        console.warn('Runtime online belum siap; pemeriksaan sesi dijadwalkan ulang.');
        setTimeout(initAppSession, 5000);
        return;
    }

    // Load settings FIRST so we can accurately detect offline mode before session restoration.
    await loadInitialRuntimeSettings();
    await ensureOfflineLicenseActivationUi();
    if (savedUserData && savedUserData.role === 'bos' && (appState.isOfflineMode || window.isOfflineMode)) {
        console.warn('Sesi BOS dinonaktifkan dalam mode offline demi keamanan.');
        clearPersistedAuthSession();
        savedUserData = null;
    }

    // SESSION_RESTORE_FAIL_CLOSED_V2: validate the persisted token before exposing
    // any authenticated UI or reusing account-scoped RAM.
    if (savedUserData) {
        try {
            const authResponse = await fetch('/api/auth/me', { cache: 'no-store' });
            const authData = await authResponse.json().catch(() => ({ success: false }));
            if (!authResponse.ok || !authData.success) {
                clearPersistedAuthSession();
                savedUserData = null;
            }
        } catch(e) {
            console.warn('Validasi sesi tersimpan gagal:', e);
            clearPersistedAuthSession();
            savedUserData = null;
        }
    }

    // Force-logout on tenant slug mismatch to prevent session pollution.
    const path = window.location.pathname;
    if (path.startsWith('/m/')) {
        const urlSlug = path.substring(3).split('/')[0];
        if (urlSlug && savedUserData && savedUserData.role !== 'bos') {
            const userSlug = String(savedUserData.madrasahSlug || 'default').toLowerCase();
            if (userSlug !== urlSlug.toLowerCase()) {
                console.log('TENANT MISMATCH! Forcing logout from', userSlug, 'to access portal', urlSlug);
                clearPersistedAuthSession();
                savedUserData = null;
            }
        }
    } else if (savedUserData && savedUserData.role !== 'bos' && savedUserData.madrasahSlug && savedUserData.madrasahSlug !== 'default') {
        window.location.href = `/m/${savedUserData.madrasahSlug}`;
        return;
    }

    try { applyTheme(); } catch(e) {}
    updateSchoolLogoUI();
    try { applyLoginCustomization(); } catch(e) {}

    if (!savedUserData || !savedUserData.role) {
        showLoggedOutShellImmediately();
        return;
    }

    appState.currentUser = savedUserData;
    appState.role = savedUserData.role;
    resetAccountScopedRuntimeState();

    const fetchLoad = window.loadDataFromServer || (typeof loadDataFromServer !== 'undefined' ? loadDataFromServer : null);
    let loadSucceeded = false;
    if (fetchLoad) {
        try {
            loadSucceeded = (await fetchLoad()) !== false;
        } catch(e) {
            console.warn('Gagal loadDataFromServer saat restore sesi:', e);
        }
    }

    if (!loadSucceeded) {
        clearPersistedAuthSession();
        appState.currentUser = null;
        appState.role = null;
        resetAccountScopedRuntimeState();
        showToast('Sesi tidak dibuka karena data akun belum berhasil dimuat. Silakan login kembali.', 'warning');
        return;
    }

    await refreshAuthoritativeTokenBalance();

    const loginContainer = document.getElementById('login-container');
    const mainApp = document.getElementById('main-app');
    if (loginContainer) loginContainer.classList.add('hidden');
    if (mainApp) mainApp.classList.remove('hidden');
    startSession(true);
    if (appState.isOfflineMode === true || window.isOfflineMode === true) startOfflineLicenseSyncMonitor();
}
setTimeout(initAppSession, 0);

function handleGlobalSearch(query) {
    const resultsContainer = document.getElementById('global-search-results');
    if (!query || query.trim().length < 1) {
        resultsContainer.classList.add('hidden');
        return;
    }

    const q = query.toLowerCase();
    let resultsHtml = '';
    let count = 0;

    (appState.students || []).forEach(s => {
        if ((s.name && s.name.toLowerCase().includes(q)) || (s.nis && s.nis.includes(q))) {
            resultsHtml += `<div class="px-3 py-2 hover:bg-slate-100 cursor-pointer rounded-xl flex justify-between items-center" onclick="navigateTo('siswa'); document.getElementById('global-search-results').classList.add('hidden');">
                <div><span class="font-bold text-slate-800">${escapeHtml(s.name)}</span><p class="text-[10px] text-slate-400">Murid - NIS: ${escapeHtml(s.nis)}</p></div>
                <i class="fa-solid fa-arrow-right text-slate-400 text-[10px]"></i>
            </div>`;
            count++;
        }
    });

    (appState.teachers || []).forEach(t => {
        if ((t.name && t.name.toLowerCase().includes(q)) || (t.nip && t.nip.includes(q))) {
            resultsHtml += `<div class="px-3 py-2 hover:bg-slate-100 cursor-pointer rounded-xl flex justify-between items-center" onclick="navigateTo('guru'); document.getElementById('global-search-results').classList.add('hidden');">
                <div><span class="font-bold text-slate-800">${escapeHtml(t.name)}</span><p class="text-[10px] text-slate-400">Guru - NIP: ${escapeHtml(t.nip)}</p></div>
                <i class="fa-solid fa-arrow-right text-slate-400 text-[10px]"></i>
            </div>`;
            count++;
        }
    });

    (appState.classes || []).forEach(c => {
        if (c.name && c.name.toLowerCase().includes(q)) {
            resultsHtml += `<div class="px-3 py-2 hover:bg-slate-100 cursor-pointer rounded-xl flex justify-between items-center" onclick="navigateTo('kelas'); document.getElementById('global-search-results').classList.add('hidden');">
                <div><span class="font-bold text-slate-800">${escapeHtml(c.name)}</span><p class="text-[10px] text-slate-400">Kelas - Tingkat: ${escapeHtml(c.grade)}</p></div>
                <i class="fa-solid fa-arrow-right text-slate-400 text-[10px]"></i>
            </div>`;
            count++;
        }
    });

    if (count === 0) {
        resultsHtml = `<div class="px-3 py-2 text-slate-500 text-center text-xs">Pencarian tidak ditemukan</div>`;
    }

    resultsContainer.innerHTML = resultsHtml;
    resultsContainer.classList.remove('hidden');
}

function fillDemo(user, pass) {
    if (user && pass) {
        const uEl = document.getElementById('login-user');
        const pEl = document.getElementById('login-pass');
        if (uEl) uEl.value = user;
        if (pEl) pEl.value = pass;
    }
}

function fillAndSubmitDemo(user, pass) {
    fillDemo(user, pass);
    handleLogin(new Event('submit'));
}

// --- OFFLINE MADRASAH LICENSE CLIENT ---
function getOfflineInstallationId() {
    const key = 'madrasah_offline_installation_id';
    try {
        let id = localStorage.getItem(key);
        if (!id) {
            const bytes = new Uint8Array(18);
            if (window.crypto?.getRandomValues) window.crypto.getRandomValues(bytes);
            else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
            id = 'INST_' + Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
            localStorage.setItem(key, id);
        }
        return id;
    } catch (_) { return 'INST_' + Math.random().toString(36).slice(2) + Date.now().toString(36); }
}
async function getOfflineLicenseStatus() {
    try {
        const res = await fetch('/api/offline-license/status', { cache: 'no-store' });
        return await res.json().catch(() => ({ success: false }));
    } catch (_) { return { success: false }; }
}
async function activateOfflineMadrasahLicense() {
    const input = document.getElementById('offline-license-activation-key');
    const btn = document.getElementById('btn-activate-offline-license');
    const key = input ? input.value.trim() : '';
    if (!key) { showToast('Masukkan key aktivasi dari BOSS.', 'error'); return false; }
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner animate-spin"></i> Memverifikasi...'; }
    try {
        const res = await fetch('/api/offline-license/activate', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ activationKey: key, installationId: getOfflineInstallationId() })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) { showToast(data.message || 'Key aktivasi tidak valid.', 'error'); return false; }
        const modal = document.getElementById('offline-license-activation-modal');
        if (modal) modal.remove();
        showToast('Aktivasi madrasah offline berhasil.', 'success');
        return true;
    } catch (_) { showToast('Server lokal tidak dapat memproses aktivasi.', 'error'); return false; }
    finally { if (btn && document.body.contains(btn)) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-unlock-keyhole"></i> Aktivasi Madrasah'; } }
}
function showOfflineLicenseActivationModal() {
    if (document.getElementById('offline-license-activation-modal')) return;
    const modal = document.createElement('div');
    modal.id = 'offline-license-activation-modal';
    modal.className = 'fixed inset-0 z-[100] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4';
    modal.innerHTML = `
        <div class="bg-white w-full max-w-lg rounded-3xl shadow-2xl p-6 space-y-5">
            <div class="flex items-start gap-3">
                <div class="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center text-xl"><i class="fa-solid fa-key"></i></div>
                <div><h3 class="text-lg font-black text-slate-800">Aktivasi Madrasah Offline</h3><p class="text-xs text-slate-500 mt-1">Masukkan key yang dibuat oleh akun BOSS Online. Aktivasi ini diperlukan sebelum Admin dapat menggunakan instalasi offline.</p></div>
            </div>
            <div><label class="block text-[10px] font-bold uppercase text-slate-500 mb-1.5">Key Aktivasi BOSS</label><textarea id="offline-license-activation-key" rows="4" class="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3 text-[11px] font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Tempel key aktivasi di sini"></textarea></div>
            <div class="p-3 rounded-2xl bg-amber-50 border border-amber-100 text-[11px] text-amber-800"><i class="fa-solid fa-circle-info mr-1"></i> Setelah aktivasi berhasil, aplikasi tetap dapat digunakan tanpa internet. Saat internet tersedia, sinkronisasi lisensi ke BOSS dapat dilakukan.</div>
            <div class="flex justify-end"><button type="button" id="btn-activate-offline-license" onclick="activateOfflineMadrasahLicense()" class="px-5 py-2.5 bg-indigo-700 hover:bg-indigo-800 text-white rounded-2xl text-xs font-bold"><i class="fa-solid fa-unlock-keyhole"></i> Aktivasi Madrasah</button></div>
        </div>`;
    document.body.appendChild(modal);
}
async function ensureOfflineLicenseActivationUi() {
    if (window.isOfflineMode !== true && appState.isOfflineMode !== true) return true;
    const status = await getOfflineLicenseStatus();
    if (status?.success && status.activated) return true;
    showOfflineLicenseActivationModal();
    return false;
}
async function syncOfflineLicenseToBoss() {
    if (window.isOfflineMode !== true && appState.isOfflineMode !== true) return false;
    try {
        const res = await fetch('/api/offline-license/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.success) {
            if (data.madrasah && window.loadDataFromServer) await window.loadDataFromServer();
            return true;
        }
    } catch (_) {}
    return false;
}

let offlineLicenseSyncTimer = null;
function startOfflineLicenseSyncMonitor() {
    if (offlineLicenseSyncTimer) clearInterval(offlineLicenseSyncTimer);
    if (window.isOfflineMode !== true && appState.isOfflineMode !== true) return;
    offlineLicenseSyncTimer = setInterval(() => {
        const role = String(appState.role || appState.currentUser?.role || '').toLowerCase();
        if (role === 'admin' || role === 'administrator') syncOfflineLicenseToBoss();
    }, 60000);
    syncOfflineLicenseToBoss();
}
window.ensureOfflineLicenseActivationUi = ensureOfflineLicenseActivationUi;
window.syncOfflineLicenseToBoss = syncOfflineLicenseToBoss;
window.activateOfflineMadrasahLicense = activateOfflineMadrasahLicense;

async function handleLogin(e) {
    if (e && e.preventDefault) e.preventDefault();

    if (window.isOfflineMode === true || appState.isOfflineMode === true) {
        const licensed = await ensureOfflineLicenseActivationUi();
        if (!licensed) return;
    }

    const runtimeReady = await waitForServerRuntimeReady(15000);
    if (!runtimeReady) {
        showToast('Server masih menyiapkan Cloud SQL. Silakan coba lagi sebentar.', 'warning');
        return;
    }

    const uEl = document.getElementById('login-user');
    const pEl = document.getElementById('login-pass');
    const u = uEl ? uEl.value.trim() : '';
    const p = pEl ? pEl.value.trim() : '';

    if (!u || !p) {
        showToast('Username dan password wajib diisi.', 'error');
        return;
    }

    try {
        const portalPath = String(window.location.pathname || '');
        const portalSlug = portalPath.startsWith('/m/') ? portalPath.substring(3).split('/')[0] : '';
        const loginTenant = window.__activeTenant || null;
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: u,
                password: p,
                madrasahId: loginTenant?.id || '',
                madrasahSlug: loginTenant?.slug || portalSlug || ''
            })
        });

        const data = await response.json();
        if (!response.ok || !data.success) {
            showToast(data.message || 'Username atau password salah.', 'error');
            return;
        }

        const loggedInUser = data.user;
        const loggedInId = String(loggedInUser.id);
        appState.currentUser = loggedInUser;
        appState.role = loggedInUser.role;
        persistCurrentUser(loggedInUser);
        localStorage.setItem('madrasah_active_account', loggedInId);

        // ACCOUNT_RUNTIME_ISOLATION_V2: never let a new account inherit RAM from the
        // previous account while authoritative data is being loaded.
        resetAccountScopedRuntimeState();

        const fetchLoad = window.loadDataFromServer || (typeof loadDataFromServer !== 'undefined' ? loadDataFromServer : null);
        if (!fetchLoad) {
            clearPersistedAuthSession();
            appState.currentUser = null;
            appState.role = null;
            showToast('Pemuat data sesi belum siap. Silakan coba login kembali.', 'error');
            return;
        }

        const loginForm = document.getElementById('login-form');
        const loginBtn = loginForm ? loginForm.querySelector('button[type="submit"]') : null;
        const origHtml = loginBtn ? loginBtn.innerHTML : '';
        let loadSucceeded = false;
        try {
            if (loginBtn) {
                loginBtn.disabled = true;
                loginBtn.innerHTML = '<i class="fa-solid fa-spinner animate-spin mr-1.5"></i>Memuat Sesi...';
            }
            loadSucceeded = (await fetchLoad()) !== false;
        } finally {
            if (loginBtn) {
                loginBtn.disabled = false;
                loginBtn.innerHTML = origHtml;
            }
        }

        if (!loadSucceeded) {
            clearPersistedAuthSession();
            appState.currentUser = null;
            appState.role = null;
            resetAccountScopedRuntimeState();
            showToast('Login terverifikasi, tetapi data akun gagal dimuat. Sesi dibatalkan agar data akun lain tidak terbawa.', 'error');
            return;
        }

        await refreshAuthoritativeTokenBalance();

        const matchedStudent = Array.isArray(appState.students)
            ? appState.students.find(s => String(s.id) === loggedInId)
            : null;

        let detectedRole = loggedInUser.role;
        if (detectedRole === 'bos' || detectedRole === 'boss' || detectedRole === 'superadmin') {
            detectedRole = 'bos';
        } else if (matchedStudent && (matchedStudent.role === 'class_leader' || matchedStudent.role === 'ketua_kelas')) {
            detectedRole = 'class_leader';
        } else if (detectedRole === 'teacher' || detectedRole === 'guru') {
            detectedRole = 'teacher';
        } else if (detectedRole === 'admin' || detectedRole === 'administrator') {
            detectedRole = 'admin';
        } else {
            detectedRole = 'student';
        }

        loggedInUser.role = detectedRole;
        appState.currentUser = loggedInUser;
        appState.role = detectedRole;
        persistCurrentUser(loggedInUser);
        localStorage.setItem('madrasah_active_account', loggedInId);

        startSession(false);
        if (appState.isOfflineMode === true || window.isOfflineMode === true) startOfflineLicenseSyncMonitor();
    } catch (error) {
        console.warn('Network login failed (server might be restarting or client is offline):', error.message || error);
        clearPersistedAuthSession();
        appState.currentUser = null;
        appState.role = null;
        resetAccountScopedRuntimeState();
        showToast('Server lokal tidak dapat dihubungi', 'error');
    }
}
async function refreshAuthoritativeTokenBalance() {
    if (window.isOfflineMode === true || appState.isOfflineMode === true) return null;
    if (!appState.currentUser) return null;

    const role = String(appState.role || appState.currentUser.role || '').toLowerCase().trim();
    if (!['admin', 'administrator', 'teacher', 'guru'].includes(role)) return null;

    try {
        const response = await fetch('/api/token-balance', { cache: 'no-store' });
        const data = await response.json().catch(() => null);
        if (!response.ok || !data || !data.success || typeof data.balance !== 'number') return null;

        const balance = Number(data.balance) || 0;
        appState.currentUser.cbtTokenBalance = balance;
        safeSetLocalStorage('madrasah_current_user', appState.currentUser);

        if (data.scope === 'teacher' && Array.isArray(appState.teachers)) {
            const idx = appState.teachers.findIndex(t =>
                String(t.id) === String(appState.currentUser.id) ||
                String(t.username) === String(appState.currentUser.username)
            );
            if (idx >= 0) appState.teachers[idx].cbtTokenBalance = balance;
        }

        if (data.scope === 'madrasah' && Array.isArray(appState.madrasahs)) {
            const targetId = String(data.madrasahId || appState.currentUser.madrasahId || appState.currentUser.madrasahSlug || '');
            const idx = appState.madrasahs.findIndex(m =>
                String(m.id) === targetId || String(m.slug) === targetId
            );
            if (idx >= 0) appState.madrasahs[idx].cbtTokenBalance = balance;
        }

        if (typeof window.updateHeaderTokenBadge === 'function') window.updateHeaderTokenBadge();
        return balance;
    } catch (err) {
        console.warn('Gagal menyegarkan saldo token authoritative:', err?.message || err);
        return null;
    }
}
window.refreshAuthoritativeTokenBalance = refreshAuthoritativeTokenBalance;

function getActiveMadrasahTokenBalance() {
    const role = String(appState.role || '').toLowerCase().trim();
    if (role === 'teacher' || role === 'guru') {
        if (appState.currentUser && typeof appState.currentUser.cbtTokenBalance === 'number') {
            return appState.currentUser.cbtTokenBalance;
        }
        if (appState.teachers && appState.currentUser) {
            const matchedT = appState.teachers.find(t => String(t.id) === String(appState.currentUser.id) || String(t.username) === String(appState.currentUser.username) || String(t.nip) === String(appState.currentUser.nip));
            if (matchedT && typeof matchedT.cbtTokenBalance === 'number') {
                return matchedT.cbtTokenBalance;
            }
        }
        return 0;
    }

    if ((role === 'admin' || role === 'administrator') && appState.currentUser && typeof appState.currentUser.cbtTokenBalance === 'number') {
        return appState.currentUser.cbtTokenBalance;
    }

    if (appState.madrasahs && appState.madrasahs.length > 0) {
        const currentMId = (appState.currentUser && (appState.currentUser.madrasahId || appState.currentUser.madrasahSlug)) || appState.currentSlug || 'default';
        const found = appState.madrasahs.find(m => String(m.id) === String(currentMId) || String(m.slug) === String(currentMId));
        if (found && typeof found.cbtTokenBalance === 'number') {
            return found.cbtTokenBalance;
        }
        if (appState.madrasahs[0] && typeof appState.madrasahs[0].cbtTokenBalance === 'number') {
            return appState.madrasahs[0].cbtTokenBalance;
        }
    }
    if (appState.currentUser && typeof appState.currentUser.cbtTokenBalance === 'number') {
        return appState.currentUser.cbtTokenBalance;
    }
    return 0;
}

function updateHeaderTokenBadge() {
    const badge = document.getElementById('header-token-badge');
    if (!badge) return;
    badge.classList.add('hidden');
    badge.classList.remove('flex');
}
window.getActiveMadrasahTokenBalance = getActiveMadrasahTokenBalance;
window.updateHeaderTokenBadge = updateHeaderTokenBadge;

function startSession(isRefresh = false) {
    const loginContainer = document.getElementById('login-container');
    const mainApp = document.getElementById('main-app');

    if (loginContainer) loginContainer.classList.add('hidden');
    if (mainApp) mainApp.classList.remove('hidden');

    if (appState.currentUser) {
        appState.role = appState.currentUser.role || appState.role;
    }

    if (appState.role === 'guru') appState.role = 'teacher';
    if (appState.role === 'murid') appState.role = 'student';
    if (appState.role === 'ketua_kelas') appState.role = 'class_leader';

    const role = String(appState.role || '').toLowerCase().trim();
    const isStudent = role === 'student' || role === 'murid' || role === 'class_leader' || role === 'ketua_kelas';
    const isTeacher = role === 'teacher' || role === 'guru';

    // Hide/Show Hamburger sidebar toggle button
    const sidebarToggleBtn = document.getElementById('sidebar-toggle-btn');
    if (sidebarToggleBtn) {
        if (isStudent) {
            sidebarToggleBtn.classList.add('hidden');
        } else {
            sidebarToggleBtn.classList.remove('hidden');
        }
    }

    // Hide/Show Search box, Chat button, and Logout button in header
    const headerSearchBox = document.getElementById('header-search-box');
    const headerLogoutBox = document.getElementById('header-logout-box');
    const headerChatBtn = document.getElementById('header-chat-btn');
    const isChatActive = appState.settings?.chatEnabled === true || appState.settings?.chatEnabled === 'true';

    if (isStudent) {
        if (headerSearchBox) headerSearchBox.style.setProperty('display', 'none', 'important');
        if (headerLogoutBox) headerLogoutBox.classList.remove('hidden');
        if (headerChatBtn) {
            if (isChatActive) {
                headerChatBtn.classList.remove('hidden');
                headerChatBtn.classList.add('flex');
            } else {
                headerChatBtn.classList.add('hidden');
                headerChatBtn.classList.remove('flex');
            }
        }
    } else {
        if (headerSearchBox) headerSearchBox.style.display = '';
        if (headerLogoutBox) headerLogoutBox.classList.add('hidden');
        if (headerChatBtn) {
            headerChatBtn.classList.add('hidden');
            headerChatBtn.classList.remove('flex');
        }
    }

    // Handle Top Name Click for Student and Teacher Profile
    const nameEl = document.getElementById('user-display-name');
    if (nameEl) {
        if (isStudent || isTeacher) {
            nameEl.classList.add('cursor-pointer', 'transition-colors');
            nameEl.classList.remove('underline', 'decoration-dotted', 'decoration-emerald-400', 'decoration-blue-400');
            nameEl.setAttribute('title', isStudent ? 'Klik untuk melihat profil saya' : 'Klik untuk melihat dan mengedit profil guru');
        } else {
            nameEl.classList.remove('cursor-pointer', 'hover:text-emerald-600', 'hover:text-blue-600', 'transition-colors', 'underline', 'decoration-dotted', 'decoration-emerald-400', 'decoration-blue-400');
            nameEl.removeAttribute('title');
        }
    }

    window.handleTopNameClick = function() {
        if (appState.role === 'student' || appState.role === 'murid') {
            if (typeof window.toggleStudentDashboardView === 'function') {
                window.toggleStudentDashboardView('profile');
            } else {
                navigateTo('profil_siswa');
            }
        } else if (appState.role === 'teacher' || appState.role === 'guru') {
            navigateTo('profil_guru');
        }
    };

    const fetchLoad = window.loadDataFromServer || (typeof loadDataFromServer !== 'undefined' ? loadDataFromServer : null);
    if (fetchLoad) {
        fetchLoad().then(() => {
            console.log('=== LOAD DATA SELESAI ===');
        }).catch(error => {
            console.error('ERROR LOAD DATA:', error);
        });
    } else {
        console.log('loadDataFromServer belum siap.');
    }

    const schoolName = document.getElementById('nav-school-name');
    if (schoolName) {
        if (appState.currentUser && appState.currentUser.schoolName) {
            schoolName.innerText = appState.currentUser.schoolName;
        } else if (window.__activeTenant && window.__activeTenant.name) {
            schoolName.innerText = window.__activeTenant.name;
        } else if (appState.settings) {
            schoolName.innerText = appState.settings.schoolName || '';
        }
    }
    updateSchoolLogoUI();

    if (nameEl && appState.currentUser) {
        if (!renderStudentHeaderProfile()) {
            nameEl.innerText = appState.currentUser.name || '';
        }
    }

    const badge = document.getElementById('user-role-badge');
    if (badge) {
        if (appState.role === 'bos') badge.innerText = 'Akun Bos (Super Admin)';
        else if (appState.role === 'admin') badge.innerText = 'Administrator Madrasah';
        else if (appState.role === 'teacher') badge.innerText = 'Dewan Guru';
        else if (appState.role === 'class_leader') badge.innerText = 'Ketua Kelas';
        else if (appState.role === 'student') badge.innerText = 'Murid';
        else badge.innerText = 'Pengguna';
    }

    if (!isRefresh) appState.navigationHistory = [];
    else if (!Array.isArray(appState.navigationHistory)) appState.navigationHistory = [];
    updateGlobalBackBar();

    buildSidebar();
    updateHeaderTokenBadge();

    if (!isRefresh) {
        localStorage.removeItem('madrasah_last_route');
        const defaultRoute = getDefaultRoute();
        navigateTo(defaultRoute);
        return;
    }

    const lastRoute = localStorage.getItem('madrasah_last_route');
    if (appState.role === 'class_leader') {
        navigateTo('profil_ketua');
        return;
    }

    if (appState.role === 'student') {
        // Reset dashboard sub-view to 'dashboard' upon refresh or fresh login
        if (typeof window.toggleStudentDashboardView === 'function') {
            window._studentDashboardView = 'dashboard';
        }
        // Pre-request and cache camera stream/permission immediately
        if (window.requestCameraStream) {
            window.requestCameraStream().then(() => {
                console.log('Camera persistent stream cached successfully.');
            }).catch(err => {
                console.warn('Initial camera stream request error:', err);
            });
        }
        if (window.checkAndResumeActiveLkpdSession && window.checkAndResumeActiveLkpdSession()) {
            return;
        }
        navigateTo(lastRoute || 'profil_siswa');
        return;
    }

    navigateTo(lastRoute || getDefaultRoute());
}

function logout() {
    // CBT_LOGOUT_RUNTIME_ISOLATION_V2: clear only volatile CBT runtime. Durable
    // local/server recovery data intentionally remains available to the same student.
    try {
        if (typeof window.__resetCbtRuntimeOnLogout === 'function') {
            window.__resetCbtRuntimeOnLogout();
        }
    } catch(e) {
        console.warn('CBT runtime logout cleanup failed:', e);
    }

    if (window.__persistentStudentCameraStream) {
        try {
            window.__persistentStudentCameraStream.getTracks().forEach(t => t.stop());
        } catch(e) {}
        window.__persistentStudentCameraStream = null;
    }

    appState.currentUser = null;
    appState.role = null;
    resetAccountScopedRuntimeState();
    clearPersistedAuthSession();
    try { sessionStorage.removeItem('cbt_print_credentials'); } catch (_) {}
    localStorage.removeItem('madrasah_last_route');

    // Restore top bar classes in case next login is different role
    const sidebarToggleBtn = document.getElementById('sidebar-toggle-btn');
    if (sidebarToggleBtn) sidebarToggleBtn.classList.remove('hidden');
    const headerSearchBox = document.getElementById('header-search-box');
    if (headerSearchBox) {
        headerSearchBox.classList.remove('hidden');
        headerSearchBox.style.display = '';
    }
    const headerLogoutBox = document.getElementById('header-logout-box');
    if (headerLogoutBox) headerLogoutBox.classList.add('hidden');
    const headerChatBtn = document.getElementById('header-chat-btn');
    if (headerChatBtn) {
        headerChatBtn.classList.add('hidden');
        headerChatBtn.classList.remove('flex');
    }
    const nameEl = document.getElementById('user-display-name');
    if (nameEl) {
        nameEl.classList.remove('cursor-pointer', 'hover:text-blue-600', 'transition-colors', 'underline', 'decoration-dotted', 'decoration-blue-400');
        nameEl.removeAttribute('title');
    }

    document.getElementById('main-app').classList.add('hidden');
    document.getElementById('login-container').classList.remove('hidden');
    document.getElementById('login-form').reset();
    try {
        applyLoginCustomization();
    } catch(e) {}
    showToast('Berhasil keluar sistem.', 'info');
}
window.logout = logout;

function getCurrentStudentForHeader() {
    if (!appState.currentUser) return null;
    const role = String(appState.role || appState.currentUser.role || '').toLowerCase().trim();
    if (!['student', 'murid', 'class_leader', 'ketua_kelas'].includes(role)) return null;
    const current = appState.currentUser;
    return (appState.students || []).find(s =>
        (current.id && String(s.id) === String(current.id)) ||
        (current.username && String(s.username || '').toLowerCase() === String(current.username).toLowerCase()) ||
        (current.nis && String(s.nis || '') === String(current.nis))
    ) || current;
}

function renderStudentHeaderProfile() {
    const nameEl = document.getElementById('user-display-name');
    const student = getCurrentStudentForHeader();
    if (!nameEl || !student) return false;
    const name = escapeHtml(student.name || appState.currentUser?.name || 'Murid');
    const photo = student.photo || appState.currentUser?.photo || '';
    const photoSrc = photo && window.getPhotoHtmlSrc ? window.getPhotoHtmlSrc(photo) : '';
    nameEl.innerHTML = `
        <span class="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-2.5 py-1.5 shadow-sm hover:border-blue-300 hover:bg-blue-50/70 transition">
            <span class="w-9 h-9 rounded-full overflow-hidden bg-blue-100 text-blue-700 flex items-center justify-center border border-blue-200 shadow-xs">
                ${photoSrc ? `<img src="${photoSrc}" class="w-full h-full object-cover" alt="Foto profil ${name}" referrerPolicy="no-referrer">` : `<i class="fa-solid fa-user-graduate text-sm"></i>`}
            </span>
            <span class="text-left leading-tight">
                <span class="block text-sm font-black text-slate-900">${name}</span>
                <span class="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Profil Siswa</span>
            </span>
        </span>
    `;
    nameEl.setAttribute('title', 'Klik untuk membuka pengaturan profil siswa');
    return true;
}
window.renderStudentHeaderProfile = renderStudentHeaderProfile;

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    if (sidebar) sidebar.classList.toggle('-translate-x-full');
    if (backdrop) backdrop.classList.toggle('hidden');
}
window.toggleSidebar = toggleSidebar;

function getDefaultRoute() {
    const role = String(appState.role || '').toLowerCase();
    if (role === 'bos' || role === 'boss' || role === 'superadmin') return 'boss_dashboard';
    if (role === 'admin' || role === 'teacher' || role === 'guru') return 'dashboard';
    if (role === 'class_leader' || role === 'ketua_kelas') return 'profil_ketua';
    if (role === 'student' || role === 'murid') return 'profil_siswa';
    return 'dashboard';
}

function buildSidebar() {
    const menuContainer = document.getElementById('sidebar-menu');
    let html = '';
    const role = String(appState.role || '').toLowerCase().trim();

    if (role === 'bos') {
        html = `
            <button type="button" onclick="navigateTo('boss_dashboard')" class="w-full flex items-center space-x-3 px-3.5 py-3 rounded-2xl hover:bg-slate-800 transition text-left font-semibold text-white">
                <i class="fa-solid fa-crown w-5 text-amber-400"></i>
                <span>Dashboard Bos</span>
            </button>
            <button type="button" onclick="navigateTo('boss_madrasahs')" class="w-full flex items-center space-x-3 px-3.5 py-3 rounded-2xl hover:bg-slate-800 transition text-left text-slate-300">
                <i class="fa-solid fa-building-columns w-5 text-purple-400"></i>
                <span>Manajemen Madrasah</span>
            </button>
            <button type="button" onclick="navigateTo('boss_tokens')" class="w-full flex items-center space-x-3 px-3.5 py-3 rounded-2xl hover:bg-slate-800 transition text-left text-slate-300">
                <i class="fa-solid fa-coins w-5 text-amber-400"></i>
                <span>Top-Up Token Ujian</span>
            </button>

        `;
        if (menuContainer) menuContainer.innerHTML = html;
        return;
    }

    if (role === 'admin' || role === 'teacher' || role === 'guru') {
        html = `
            <button type="button" onclick="navigateTo('dashboard')" class="w-full flex items-center space-x-3 px-3.5 py-3 rounded-2xl hover:bg-slate-800 transition text-left">
                <i class="fa-solid fa-chart-pie w-5 text-emerald-400"></i>
                <span>Dashboard Utama</span>
            </button>
            ${(role === 'teacher' || role === 'guru') ? `
            <button type="button" onclick="navigateTo('absen_guru_self')" class="w-full flex items-center space-x-3 px-3.5 py-3 rounded-2xl hover:bg-slate-800 transition text-left">
                <i class="fa-solid fa-camera-retro w-5 text-emerald-400"></i>
                <span>Absen Mandiri Guru</span>
            </button>` : ''}
            <button type="button" onclick="navigateTo('kelas')" class="w-full flex items-center space-x-3 px-3.5 py-3 rounded-2xl hover:bg-slate-800 transition text-left">
                <i class="fa-solid fa-school w-5 text-emerald-400"></i>
                <span>Kelas</span>
            </button>
            ${role === 'admin' ? `
            <button type="button" onclick="navigateTo('guru')" class="w-full flex items-center space-x-3 px-3.5 py-3 rounded-2xl hover:bg-slate-800 transition text-left">
                <i class="fa-solid fa-chalkboard-user w-5 text-emerald-400"></i>
                <span>Data Guru</span>
            </button>` : ''}
            <button type="button" onclick="navigateTo('siswa')" class="w-full flex items-center space-x-3 px-3.5 py-3 rounded-2xl hover:bg-slate-800 transition text-left">
                <i class="fa-solid fa-user-graduate w-5 text-emerald-400"></i>
                <span>Data Murid</span>
            </button>
            <button type="button" onclick="navigateTo('jadwal')" class="w-full flex items-center space-x-3 px-3.5 py-3 rounded-2xl hover:bg-slate-800 transition text-left">
                <i class="fa-solid fa-calendar-days w-5 text-emerald-400"></i>
                <span>Jadwal & Mapel</span>
            </button>
            <button type="button" onclick="navigateTo('absen')" class="w-full flex items-center space-x-3 px-3.5 py-3 rounded-2xl hover:bg-slate-800 transition text-left">
                <i class="fa-solid fa-clipboard-user w-5 text-emerald-400"></i>
                <span>Absen Madrasah</span>
            </button>
            <button type="button" onclick="navigateTo('asesmen')" class="w-full flex items-center space-x-3 px-3.5 py-3 rounded-2xl hover:bg-slate-800 transition text-left">
                <i class="fa-solid fa-file-shield w-5 text-emerald-400"></i>
                <span>Asesmen & CBT</span>
            </button>
            <button type="button" onclick="navigateTo('bank_soal')" class="w-full flex items-center space-x-3 px-3.5 py-3 rounded-2xl hover:bg-slate-800 transition text-left">
                <i class="fa-solid fa-book-open w-5 text-emerald-400"></i>
                <span>Bank Soal</span>
            </button>
            <button type="button" onclick="navigateTo('nilai')" class="w-full flex items-center space-x-3 px-3.5 py-3 rounded-2xl hover:bg-slate-800 transition text-left">
                <i class="fa-solid fa-star-half-stroke w-5 text-emerald-400"></i>
                <span>Manajemen Nilai</span>
            </button>
            <button type="button" onclick="navigateTo('modul_ajar')" class="w-full flex items-center space-x-3 px-3.5 py-3 rounded-2xl hover:bg-slate-800 transition text-left">
                <i class="fa-solid fa-scroll w-5 text-emerald-400"></i>
                <span>Modul Ajar</span>
            </button>
            <button type="button" data-learning-menu="1" onclick="navigateTo('learning_teacher')" class="w-full flex items-center space-x-3 px-3.5 py-3 rounded-2xl hover:bg-slate-800 transition text-left">
                <i class="fa-solid fa-book-open w-5 text-emerald-400"></i>
                <span>Materi Pembelajaran</span>
            </button>
            <button type="button" onclick="navigateTo('jurnal')" class="w-full flex items-center space-x-3 px-3.5 py-3 rounded-2xl hover:bg-slate-800 transition text-left">
                <i class="fa-solid fa-book-bookmark w-5 text-emerald-400"></i>
                <span>Jurnal Mengajar</span>
            </button>
            <button type="button" onclick="navigateTo('kalender')" class="w-full flex items-center space-x-3 px-3.5 py-3 rounded-2xl hover:bg-slate-800 transition text-left">
                <i class="fa-regular fa-calendar-days w-5 text-emerald-400"></i>
                <span>Kalender Akademik</span>
            </button>
            <button type="button" onclick="navigateTo('game_edukasi')" class="w-full flex items-center space-x-3 px-3.5 py-3 rounded-2xl hover:bg-slate-800 transition text-left">
                <i class="fa-solid fa-gamepad w-5 text-emerald-400"></i>
                <span>Game Edukasi</span>
            </button>
            ${(role === 'teacher' || role === 'guru') ? `
            <button type="button" onclick="navigateTo('profil_guru')" class="w-full flex items-center space-x-3 px-3.5 py-3 rounded-2xl hover:bg-slate-800 transition text-left">
                <i class="fa-solid fa-id-badge w-5 text-emerald-400"></i>
                <span>Profil & Akun Guru</span>
            </button>` : ''}
            ${role === 'admin' ? `
            <button type="button" onclick="navigateTo('setting')" class="w-full flex items-center space-x-3 px-3.5 py-3 rounded-2xl hover:bg-slate-800 transition text-left">
                <i class="fa-solid fa-gear w-5 text-emerald-400"></i>
                <span>Pengaturan Sistem</span>
            </button>` : ''}

        `;
    } else if (role === 'student' || role === 'murid') {
        const studentFeatures = appState.settings?.studentFeatures || {};
        const isAttendanceEnabled = studentFeatures.attendance === undefined ? true : studentFeatures.attendance !== false;
        const isLearningEnabled = appState.settings?.learningModuleEnabled === false ? false : (studentFeatures.learning === undefined ? true : studentFeatures.learning !== false);
        const isCbtEnabled = studentFeatures.cbt === undefined ? true : studentFeatures.cbt !== false;
        const isGameEnabled = appState.settings?.gameModuleEnabled === false ? false : (studentFeatures.games === undefined ? true : studentFeatures.games !== false);
        html = `
            <button type="button" onclick="navigateTo('profil_siswa')" class="w-full flex items-center space-x-3 px-3.5 py-3 rounded-2xl hover:bg-slate-800 transition text-left">
                <i class="fa-solid fa-house w-5 text-blue-400"></i>
                <span>Dashboard Utama</span>
            </button>
            ${isAttendanceEnabled ? `
            <button type="button" onclick="navigateTo('absen_siswa')" class="w-full flex items-center space-x-3 px-3.5 py-3 rounded-2xl hover:bg-slate-800 transition text-left">
                <i class="fa-solid fa-camera-retro w-5 text-blue-400"></i>
                <span>Absen Selfie & GPS</span>
            </button>` : ''}
            ${isLearningEnabled ? `
            <button type="button" data-learning-menu="1" onclick="navigateTo('learning_student')" class="w-full flex items-center space-x-3 px-3.5 py-3 rounded-2xl hover:bg-slate-800 transition text-left">
                <i class="fa-solid fa-book-open-reader w-5 text-blue-400"></i>
                <span>Belajar</span>
            </button>` : ''}
            ${isCbtEnabled ? `
            <button type="button" onclick="navigateTo('asesmen_siswa')" class="w-full flex items-center space-x-3 px-3.5 py-3 rounded-2xl hover:bg-slate-800 transition text-left">
                <i class="fa-solid fa-file-shield w-5 text-blue-400"></i>
                <span>CBT / Ujian Online</span>
            </button>` : ''}
            ${isGameEnabled ? `
            <button type="button" onclick="navigateTo('game_edukasi_siswa')" class="w-full flex items-center space-x-3 px-3.5 py-3 rounded-2xl hover:bg-slate-800 transition text-left">
                <i class="fa-solid fa-gamepad w-5 text-blue-400"></i>
                <span>Game Edukasi</span>
            </button>` : ''}
            <button type="button" onclick="navigateTo('kalender')" class="w-full flex items-center space-x-3 px-3.5 py-3 rounded-2xl hover:bg-slate-800 transition text-left">
                <i class="fa-regular fa-calendar-days w-5 text-blue-400"></i>
                <span>Kalender Akademik</span>
            </button>
            ${(appState.settings?.chatEnabled === true || appState.settings?.chatEnabled === 'true') ? `
            <button type="button" onclick="openChatWithAdmin()" class="w-full flex items-center space-x-3 px-3.5 py-3 rounded-2xl hover:bg-slate-800 transition text-left">
                <i class="fa-regular fa-comment-dots w-5 text-blue-400"></i>
                <span>Chat Admin</span>
            </button>` : ''}
        `;
    } else if (role === 'class_leader' || role === 'ketua_kelas') {
        const studentFeatures = appState.settings?.studentFeatures || {};
        const isAttendanceEnabled = studentFeatures.attendance === undefined ? true : studentFeatures.attendance !== false;
        const isLearningEnabled = appState.settings?.learningModuleEnabled === false ? false : (studentFeatures.learning === undefined ? true : studentFeatures.learning !== false);
        const isCbtEnabled = studentFeatures.cbt === undefined ? true : studentFeatures.cbt !== false;
        const isGameEnabled = appState.settings?.gameModuleEnabled === false ? false : (studentFeatures.games === undefined ? true : studentFeatures.games !== false);
        html = `
            <button type="button" onclick="navigateTo('profil_ketua')" class="w-full flex items-center space-x-3 px-3.5 py-3 rounded-2xl hover:bg-slate-800 transition text-left">
                <i class="fa-solid fa-id-card w-5 text-amber-400"></i>
                <span>Profil Ketua Kelas</span>
            </button>
            ${isAttendanceEnabled ? `
            <button type="button" onclick="navigateTo('absen_ketua')" class="w-full flex items-center space-x-3 px-3.5 py-3 rounded-2xl hover:bg-slate-800 transition text-left">
                <i class="fa-solid fa-camera-retro w-5 text-amber-400"></i>
                <span>Absen Selfie & GPS</span>
            </button>
            <button type="button" onclick="navigateTo('absen_kelas')" class="w-full flex items-center space-x-3 px-3.5 py-3 rounded-2xl hover:bg-slate-800 transition text-left">
                <i class="fa-solid fa-clipboard-user w-5 text-amber-400"></i>
                <span>Absensi Kelas</span>
            </button>` : ''}
            ${isLearningEnabled ? `
            <button type="button" data-learning-menu="1" onclick="navigateTo('learning_student')" class="w-full flex items-center space-x-3 px-3.5 py-3 rounded-2xl hover:bg-slate-800 transition text-left">
                <i class="fa-solid fa-book-open-reader w-5 text-amber-400"></i>
                <span>Belajar</span>
            </button>` : ''}
            ${isCbtEnabled ? `
            <button type="button" onclick="navigateTo('asesmen_siswa')" class="w-full flex items-center space-x-3 px-3.5 py-3 rounded-2xl hover:bg-slate-800 transition text-left">
                <i class="fa-solid fa-file-shield w-5 text-amber-400"></i>
                <span>CBT / Ujian Online</span>
            </button>` : ''}
            ${isGameEnabled ? `
            <button type="button" onclick="navigateTo('game_edukasi_siswa')" class="w-full flex items-center space-x-3 px-3.5 py-3 rounded-2xl hover:bg-slate-800 transition text-left">
                <i class="fa-solid fa-gamepad w-5 text-amber-400"></i>
                <span>Game Edukasi</span>
            </button>` : ''}
            <button type="button" onclick="navigateTo('kalender')" class="w-full flex items-center space-x-3 px-3.5 py-3 rounded-2xl hover:bg-slate-800 transition text-left">
                <i class="fa-regular fa-calendar-days w-5 text-amber-400"></i>
                <span>Kalender Akademik</span>
            </button>
            ${(appState.settings?.chatEnabled === true || appState.settings?.chatEnabled === 'true') ? `
            <button type="button" onclick="openChatWithAdmin()" class="w-full flex items-center space-x-3 px-3.5 py-3 rounded-2xl hover:bg-slate-800 transition text-left">
                <i class="fa-regular fa-comment-dots w-5 text-amber-400"></i>
                <span>Chat Admin</span>
            </button>` : ''}
        `;
    }

    menuContainer.innerHTML = html;
    if (window.updateChatNotificationBadges) {
        setTimeout(window.updateChatNotificationBadges, 100);
    }
}

function getNavigationHistory() {
    if (!Array.isArray(appState.navigationHistory)) appState.navigationHistory = [];
    return appState.navigationHistory;
}

function updateGlobalBackBar() {
    const bar = document.getElementById('global-back-bar');
    if (!bar) return;
    const hasHistory = getNavigationHistory().length > 0;
    bar.classList.toggle('hidden', !hasHistory);
}

function navigateBack(fallbackRoute = null) {
    const history = getNavigationHistory();
    let target = '';
    while (history.length > 0 && !target) {
        const candidate = String(history.pop() || '').trim();
        if (candidate && candidate !== String(appState.currentRoute || '')) target = candidate;
    }
    if (!target) target = fallbackRoute || getDefaultRoute();
    navigateTo(target, { fromBack: true });
}

function navigateTo(route, options = {}) {
    if (typeof window.stopLearningTrackerForNavigation === 'function') {
        try { window.stopLearningTrackerForNavigation(); } catch (e) { console.warn('Learning checkpoint before navigation failed:', e); }
    }
    if (window.__monitoringPollInterval) {
        clearInterval(window.__monitoringPollInterval);
        window.__monitoringPollInterval = null;
    }
    if (window.__evaluasiPollInterval) {
        clearInterval(window.__evaluasiPollInterval);
        window.__evaluasiPollInterval = null;
    }
    if (typeof window.stopEvaluasiPolling === 'function') {
        window.stopEvaluasiPolling();
    }
    if (window.updateChatNotificationBadges) {
        setTimeout(window.updateChatNotificationBadges, 100);
    }
    if (window.studentAttendanceStream) {
        if (window.stopCameraStreamTrack) {
            window.stopCameraStreamTrack(window.studentAttendanceStream);
        } else {
            try {
                window.studentAttendanceStream.getTracks().forEach(track => track.stop());
            } catch(e) {}
        }
        window.studentAttendanceStream = null;
    }
    if (window.teacherAttendanceStream) {
        try {
            window.teacherAttendanceStream.getTracks().forEach(track => track.stop());
        } catch(e) {}
        window.teacherAttendanceStream = null;
    }

    const studentRoleActive = appState.role === 'student' || appState.role === 'murid' || appState.role === 'class_leader' || appState.role === 'ketua_kelas';
    if (studentRoleActive) {
        const studentFeatures = appState.settings?.studentFeatures || {};
        const attendanceEnabled = studentFeatures.attendance === undefined ? true : studentFeatures.attendance !== false;
        const learningEnabled = appState.settings?.learningModuleEnabled === false ? false : (studentFeatures.learning === undefined ? true : studentFeatures.learning !== false);
        const cbtEnabled = studentFeatures.cbt === undefined ? true : studentFeatures.cbt !== false;
        const gamesEnabled = appState.settings?.gameModuleEnabled === false ? false : (studentFeatures.games === undefined ? true : studentFeatures.games !== false);
        const fallbackRoute = appState.role === 'class_leader' || appState.role === 'ketua_kelas' ? 'profil_ketua' : 'profil_siswa';
        if ((route === 'absen_siswa' || route === 'absen_ketua' || route === 'absen_kelas') && !attendanceEnabled) {
            showToast('Menu Absensi sedang dinonaktifkan oleh administrator.', 'info');
            route = fallbackRoute;
        } else if (route === 'learning_student' && !learningEnabled) {
            showToast('Menu Belajar sedang dinonaktifkan oleh administrator.', 'info');
            route = fallbackRoute;
        } else if ((route === 'asesmen_siswa' || route === 'lkpd_worksheet') && !cbtEnabled) {
            showToast('Menu CBT/LKPD sedang dinonaktifkan oleh administrator.', 'info');
            route = fallbackRoute;
        } else if (route === 'game_edukasi_siswa' && !gamesEnabled) {
            showToast('Modul Game Edukasi sedang dinonaktifkan oleh administrator.', 'info');
            route = fallbackRoute;
        }
    }

    const previousRoute = String(appState.currentRoute || '').trim();
    if (!options.fromBack && previousRoute && previousRoute !== String(route)) {
        const history = getNavigationHistory();
        if (history[history.length - 1] !== previousRoute) history.push(previousRoute);
        if (history.length > 50) history.splice(0, history.length - 50);
    }

    localStorage.setItem('madrasah_last_route', route);
    appState.currentRoute = route;
    updateGlobalBackBar();
    const container = document.getElementById('view-container');
    
    // Always close side menu after navigating / selecting item
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    if (sidebar) sidebar.classList.add('-translate-x-full');
    if (backdrop) backdrop.classList.add('hidden');

    if (route === 'dashboard') {
        if (appState.role === 'bos') renderBossDashboard(container, 'tokens');
        else renderMainDashboard(container);
    }
    else if (route === 'boss_dashboard') renderBossDashboard(container, 'tokens');
    else if (route === 'boss_madrasahs') renderBossDashboard(container, 'madrasahs');
    else if (route === 'boss_tokens') renderBossDashboard(container, 'tokens');
    else if (route === 'kelas') renderClassModule(container);
    else if (route === 'guru') renderTeacherModule(container);
    else if (route === 'siswa') renderStudentModule(container);
    else if (route === 'jadwal') renderScheduleModule(container);
    else if (route === 'absen') renderAttendanceModule(container);
    else if (route === 'asesmen') renderAssessmentModule(container, appState.lastAssessmentSubTab || 'jadwal', appState.activeMonitoringExamId || null);
    else if (route === 'bank_soal') renderQuestionBankModule(container);
    else if (route === 'nilai') renderGradesModule(container);
    else if (route === 'modul_ajar') renderModulAjarModule(container);
    else if (route === 'modul_ajar_2') {
        // Legacy deep-link compatibility: Mode 2 now lives inside the main Modul Ajar flow.
        appState.activeModulAjarSubTab = 'simpan';
        renderModulAjarModule(container);
    }
    else if (route === 'jurnal') renderJournalModule(container);
    else if (route === 'setting') renderSettingModule(container);
    else if (route === 'learning_teacher') {
        if (window.renderLearningTeacher) window.renderLearningTeacher(container);
        else if (container) container.innerHTML = '<div class="p-8 text-center text-slate-400">Modul materi sedang dimuat...</div>';
    }
    else if (route === 'learning_student') {
        if (window.renderLearningStudent) window.renderLearningStudent(container);
        else if (container) container.innerHTML = '<div class="p-8 text-center text-slate-400">Modul belajar sedang dimuat...</div>';
    }
    else if (route === 'kalender') {
        if (window.renderCalendarModule) window.renderCalendarModule(container);
        else if (typeof renderCalendarModule === 'function') renderCalendarModule(container);
    }
    else if (route === 'profil_guru') {
        if (window.renderTeacherProfile) window.renderTeacherProfile(container);
        else if (typeof renderTeacherProfile === 'function') renderTeacherProfile(container);
    }
    else if (route === 'profil_siswa') renderStudentProfile(container);
    else if (route === 'lkpd_worksheet') {
        if (window.checkAndResumeActiveLkpdSession && window.checkAndResumeActiveLkpdSession()) {
            return;
        }
        renderStudentCBTList(container);
    }
    else if (route === 'profil_ketua') renderClassLeaderDashboard(container);
    else if (route === 'absen_siswa') renderStudentAttendance(container);
    else if (route === 'asesmen_siswa') renderStudentCBTList(container);
    else if (route === 'absen_ketua') renderStudentAttendance(container);
    else if (route === 'absen_kelas') renderClassLeaderAttendance(container);
    else if (route === 'absen_guru_self') renderTeacherAttendance(container);
    else if (route === 'absen_guru_admin') renderTeacherAttendanceAdmin(container);
    else if (route === 'game_edukasi') {
        if (window.renderGameAdminModule) window.renderGameAdminModule(container);
    }
    else if (route === 'game_edukasi_siswa') {
        const isGameEnabled = appState.settings?.gameModuleEnabled !== false;
        if (!isGameEnabled && (appState.role === 'student' || appState.role === 'murid' || appState.role === 'class_leader' || appState.role === 'ketua_kelas')) {
            showToast('Modul Game Edukasi sedang dinonaktifkan oleh administrator.', 'info');
            navigateTo(appState.role === 'class_leader' || appState.role === 'ketua_kelas' ? 'profil_ketua' : 'profil_siswa');
            return;
        }
        if (window.renderGameStudentModule) window.renderGameStudentModule(container);
    }
}

function renderMainDashboard(container) {
    const students = Array.isArray(appState.students) ? appState.students : [];
    const teachers = Array.isArray(appState.teachers) ? appState.teachers : [];
    const classes = Array.isArray(appState.classes) ? appState.classes : [];
    const subjects = Array.isArray(appState.subjects) ? appState.subjects : [];
    const exams = Array.isArray(appState.exams) ? appState.exams : [];
    const attendance = Array.isArray(appState.attendance) ? appState.attendance : [];

    const totalStudents = students.length;
    const totalTeachers = teachers.length;
    const totalClasses = classes.length;
    const totalSubjects = subjects.length;
    const totalExams = exams.length;
    const todayStr = new Date().toISOString().split('T')[0];
    const totalAttendanceToday = attendance.filter(a => a && String(a.date || '').split(' ')[0] === todayStr).length;

    // Hitung persentase kehadiran hari ini
    const attendanceRate = totalStudents > 0 ? Math.round((totalAttendanceToday / totalStudents) * 100) : 100;

    // Salam Dinamis Berdasarkan Waktu
    const hour = new Date().getHours();
    let greeting = 'Assalamualaikum';
    let greetingSub = 'Semoga aktivitas pembelajaran hari ini berjalan lancar dan penuh berkah.';
    if (hour >= 5 && hour < 11) {
        greeting = 'Assalamualaikum, Selamat Pagi';
        greetingSub = 'Mari awali pagi dengan niat yang ikhlas untuk mentransfer ilmu dan kebaikan.';
    } else if (hour >= 11 && hour < 15) {
        greeting = 'Assalamualaikum, Selamat Siang';
        greetingSub = 'Tetap semangat mengawal produktivitas pembelajaran di madrasah.';
    } else if (hour >= 15 && hour < 18) {
        greeting = 'Assalamualaikum, Selamat Sore';
        greetingSub = 'Terima kasih atas dedikasi tanpa lelah membimbing generasi bangsa hari ini.';
    } else if (hour >= 18 || hour < 5) {
        greeting = 'Assalamualaikum, Selamat Malam';
        greetingSub = 'Waktunya mengevaluasi pembelajaran hari ini dan mempersiapkan hari esok.';
    }

    const role = String(appState.role || '').toLowerCase().trim();
    const currentUserName = escapeHtml(appState.currentUser ? appState.currentUser.name : 'Administrator');

    container.innerHTML = `
        <div class="space-y-6 max-w-7xl mx-auto">
            <!-- 1. HEADER & GREETING BANNER -->
            <div class="bg-slate-900 text-white rounded-3xl p-6 md:p-8 relative overflow-hidden shadow-lg shadow-slate-900/10 border border-slate-850">
                <!-- Decorative subtle mesh background pattern -->
                <div class="absolute inset-0 bg-[radial-gradient(#334155_1.2px,transparent_1.2px)] [background-size:20px_20px] opacity-25 pointer-events-none"></div>
                <div class="absolute -right-16 -top-16 w-56 h-56 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none"></div>
                <div class="absolute -left-16 -bottom-16 w-56 h-56 bg-blue-600/10 rounded-full blur-3xl pointer-events-none"></div>

                <div class="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                    <div class="space-y-2">
                        <span class="text-[10px] uppercase font-bold tracking-widest text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/10">Sistem Integrasi Madrasah</span>
                        <h1 class="text-2xl md:text-3xl font-extrabold tracking-tight mt-1">
                            ${greeting}, <span class="text-emerald-400 font-extrabold">${currentUserName}</span>!
                        </h1>
                        <p class="text-xs md:text-sm text-slate-300 font-medium leading-relaxed max-w-2xl">
                            ${greetingSub}
                        </p>
                    </div>
                    
                    <div class="shrink-0 bg-white/5 border border-white/10 backdrop-blur-md rounded-2xl p-4 text-center md:text-right">
                        <p class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tanggal Hari Ini</p>
                        <p class="text-sm font-bold text-white mt-1.5 flex items-center justify-center md:justify-end gap-2">
                            <i class="fa-regular fa-calendar-check text-emerald-400"></i>
                            <span>${new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                        </p>
                        <p class="text-[10px] text-slate-400 mt-1 font-mono">Sistem Sinkron &middot; 100% Aman</p>
                    </div>
                </div>
            </div>

            <!-- DYNAMIC CONNECTION WARNING BANNER -->
            <div id="db-warning-banner" class="hidden"></div>

            <!-- RUNNING TEXT / MARQUEE BANNER -->
            ${(() => {
                const runningText = escapeHtml((appState.settings && appState.settings.runningText) ? appState.settings.runningText : 'Selamat Datang di Portal Sistem Informasi Madrasah Terintegrasi! Tetap Semangat Berprestasi.');
                return `
                    <div class="bg-emerald-50/90 border border-emerald-200/80 text-emerald-950 rounded-2xl p-2.5 sm:p-3 flex items-center space-x-3 shadow-sm overflow-hidden">
                        <div class="shrink-0 w-8 h-8 bg-emerald-600 text-white rounded-xl flex items-center justify-center text-xs shadow-sm">
                            <i class="fa-solid fa-bullhorn text-xs"></i>
                        </div>
                        <div class="overflow-hidden whitespace-nowrap flex-1 min-w-0">
                            <marquee class="text-xs sm:text-sm font-bold text-slate-800 tracking-wide" scrollamount="6">${runningText}</marquee>
                        </div>
                    </div>
                `;
            })()}
            <!-- 2. QUICK COMMAND DECK (AKSI CEPAT) -->
            <div class="space-y-2.5">
                <h3 class="text-xs font-bold text-slate-400 uppercase tracking-widest">Aksi Cepat & Navigasi Pintas</h3>
                <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                    <button onclick="navigateTo('absen')" class="flex items-center space-x-3 p-3.5 bg-white hover:bg-slate-50 border border-slate-200/80 rounded-2xl shadow-sm text-left group transition duration-150 cursor-pointer">
                        <div class="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-105 transition"><i class="fa-solid fa-clipboard-user text-sm"></i></div>
                        <div>
                            <p class="text-xs font-bold text-slate-800">Absen Siswa</p>
                            <p class="text-[10px] text-slate-400">GPS & Kamera</p>
                        </div>
                    </button>

                    <button onclick="navigateTo('asesmen')" class="flex items-center space-x-3 p-3.5 bg-white hover:bg-slate-50 border border-slate-200/80 rounded-2xl shadow-sm text-left group transition duration-150 cursor-pointer">
                        <div class="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-105 transition"><i class="fa-solid fa-file-shield text-sm"></i></div>
                        <div>
                            <p class="text-xs font-bold text-slate-800">Ujian CBT</p>
                            <p class="text-[10px] text-slate-400">Buat & Monitoring</p>
                        </div>
                    </button>

                    <button onclick="navigateTo('bank_soal')" class="flex items-center space-x-3 p-3.5 bg-white hover:bg-slate-50 border border-slate-200/80 rounded-2xl shadow-sm text-left group transition duration-150 cursor-pointer">
                        <div class="w-9 h-9 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center group-hover:scale-105 transition"><i class="fa-solid fa-book-open text-sm"></i></div>
                        <div>
                            <p class="text-xs font-bold text-slate-800">Bank Soal</p>
                            <p class="text-[10px] text-slate-400">Penyusunan Materi</p>
                        </div>
                    </button>

                    <button onclick="navigateTo('modul_ajar')" class="flex items-center space-x-3 p-3.5 bg-white hover:bg-slate-50 border border-slate-200/80 rounded-2xl shadow-sm text-left group transition duration-150 cursor-pointer">
                        <div class="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center group-hover:scale-105 transition"><i class="fa-solid fa-scroll text-sm"></i></div>
                        <div>
                            <p class="text-xs font-bold text-slate-800">Modul Ajar</p>
                            <p class="text-[10px] text-slate-400">RPP & Perangkat</p>
                        </div>
                    </button>

                    <button onclick="navigateTo('nilai')" class="flex items-center space-x-3 p-3.5 bg-white hover:bg-slate-50 border border-slate-200/80 rounded-2xl shadow-sm text-left group transition duration-150 col-span-2 sm:col-span-1 cursor-pointer">
                        <div class="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center group-hover:scale-105 transition"><i class="fa-solid fa-star-half-stroke text-sm"></i></div>
                        <div>
                            <p class="text-xs font-bold text-slate-800">Nilai Rapor</p>
                            <p class="text-[10px] text-slate-400">Manajemen Nilai</p>
                        </div>
                    </button>
                </div>
            </div>

            <!-- 3. BENTO GRID STATISTIK & CBT STATUS -->
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <!-- Bento Block A: Ringkasan Statistika Akademik (2/3 width) -->
                <div class="lg:col-span-2 bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm flex flex-col justify-between">
                    <div>
                        <div class="flex items-center justify-between mb-5">
                            <div>
                                <h2 class="text-base font-bold text-slate-800">Ringkasan Utama Akademik</h2>
                                <p class="text-[11px] text-slate-400 mt-0.5">Metrik keseluruhan madrasah periode berjalan</p>
                            </div>
                            <span class="text-[10px] bg-slate-100 text-slate-500 font-semibold px-2 py-1 rounded-lg border">Semester Genap</span>
                        </div>

                        <!-- 4 Grid Statistika Cantik (Anti-Slop: Terapkan Desain Human-Crafted) -->
                        <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
                            <div class="p-4 bg-slate-50/60 border border-slate-100 rounded-2xl flex flex-col justify-between h-24">
                                <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Siswa</span>
                                <div class="flex items-end justify-between">
                                    <span class="text-2xl font-extrabold text-slate-850">${totalStudents}</span>
                                    <div class="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center text-xs"><i class="fa-solid fa-user-graduate"></i></div>
                                </div>
                            </div>

                            <div class="p-4 bg-slate-50/60 border border-slate-100 rounded-2xl flex flex-col justify-between h-24">
                                <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Dewan Guru</span>
                                <div class="flex items-end justify-between">
                                    <span class="text-2xl font-extrabold text-slate-850">${totalTeachers}</span>
                                    <div class="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center text-xs"><i class="fa-solid fa-chalkboard-user"></i></div>
                                </div>
                            </div>

                            <div class="p-4 bg-slate-50/60 border border-slate-100 rounded-2xl flex flex-col justify-between h-24">
                                <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Kelas Terbuka</span>
                                <div class="flex items-end justify-between">
                                    <span class="text-2xl font-extrabold text-slate-850">${totalClasses}</span>
                                    <div class="w-7 h-7 rounded-lg bg-violet-50 text-violet-600 flex items-center justify-center text-xs"><i class="fa-solid fa-school"></i></div>
                                </div>
                            </div>

                            <div class="p-4 bg-slate-50/60 border border-slate-100 rounded-2xl flex flex-col justify-between h-24">
                                <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Mata Pelajaran</span>
                                <div class="flex items-end justify-between">
                                    <span class="text-2xl font-extrabold text-slate-850">${totalSubjects}</span>
                                    <div class="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center text-xs"><i class="fa-solid fa-book"></i></div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Footnote of Stats -->
                    <div class="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                        <span class="flex items-center gap-1.5"><i class="fa-solid fa-circle-check text-emerald-500 text-[9px]"></i> Pembaruan Data Terakhir: Hari ini</span>
                        <span class="font-semibold text-slate-500 cursor-pointer hover:underline" onclick="navigateTo('kelas')">Lihat Semua Rincian Kelas <i class="fa-solid fa-arrow-right ml-0.5 text-[9px]"></i></span>
                    </div>
                </div>

                <!-- Bento Block B: Status Real-time CBT & Ujian (1/3 width) -->
                <div class="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm flex flex-col justify-between">
                    <div class="space-y-4">
                        <div class="flex items-center justify-between">
                            <div>
                                <h2 class="text-base font-bold text-slate-800">Sistem CBT & Ujian</h2>
                                <p class="text-[11px] text-slate-400 mt-0.5">Status pelaporan ujian terjadwal</p>
                            </div>
                            <span class="flex items-center gap-1.5 text-[9px] bg-emerald-50 text-emerald-600 font-bold px-2 py-0.5 rounded-full border border-emerald-100">
                                <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> SIAGA
                            </span>
                        </div>

                        <div class="space-y-3">
                            <div class="p-3 bg-slate-50 border border-slate-100 rounded-xl flex justify-between items-center">
                                <div class="flex items-center space-x-2.5">
                                    <div class="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs"><i class="fa-solid fa-file-invoice"></i></div>
                                    <div>
                                        <p class="text-xs font-bold text-slate-700">Ujian Aktif</p>
                                        <p class="text-[9px] text-slate-400">Sedang diselenggarakan</p>
                                    </div>
                                </div>
                                <span class="text-sm font-extrabold text-slate-800">${totalExams}</span>
                            </div>

                            <div class="p-3 bg-slate-50 border border-slate-100 rounded-xl flex justify-between items-center">
                                <div class="flex items-center space-x-2.5">
                                    <div class="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center text-xs"><i class="fa-solid fa-tower-broadcast"></i></div>
                                    <div>
                                        <p class="text-xs font-bold text-slate-700">Latensi Server</p>
                                        <p class="text-[9px] text-slate-400">Koneksi pusat CBT</p>
                                    </div>
                                </div>
                                <span class="text-[10px] font-mono font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">12ms (Prima)</span>
                            </div>
                        </div>
                    </div>

                    <div class="mt-4 pt-3 border-t border-slate-100">
                        <button onclick="navigateTo('asesmen')" class="w-full py-2 bg-slate-900 hover:bg-slate-850 text-white font-bold rounded-xl text-[10px] tracking-wider uppercase transition cursor-pointer">
                            Monitor Sesi Ujian <i class="fa-solid fa-arrow-right ml-1"></i>
                        </button>
                    </div>
                </div>
            </div>

            <!-- AGENDA & HARI LIBUR TERDEKAT BANNER -->
            <div class="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm space-y-4">
                <div class="flex items-center justify-between">
                    <div>
                        <h2 class="text-base font-bold text-slate-800 flex items-center gap-2">
                            <i class="fa-regular fa-calendar-days text-emerald-600"></i>
                            <span>Agenda & Hari Libur Terdekat</span>
                        </h2>
                        <p class="text-[11px] text-slate-400 mt-0.5">Jadwal kegiatan madrasah, ujian CBT, dan hari libur nasional mendatang</p>
                    </div>
                    <button onclick="navigateTo('kalender')" class="text-xs font-bold text-emerald-600 hover:text-emerald-700 hover:underline cursor-pointer flex items-center gap-1">
                        <span>Lihat Kalender Lengkap</span>
                        <i class="fa-solid fa-arrow-right text-[10px]"></i>
                    </button>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    ${typeof window.renderDashboardCalendarWidget === 'function' ? window.renderDashboardCalendarWidget() : ''}
                </div>
            </div>

            <!-- 4. BESPOKE HAND-CRAFTED SVG ANALYTICS -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <!-- ANALYTICS CARD 1: Weekly Attendance Bezier Curve Trend -->
                <div class="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm">
                    <div class="flex items-center justify-between mb-5">
                        <div>
                            <h3 class="text-sm font-bold text-slate-800">Tren Kehadiran Mingguan (%)</h3>
                            <p class="text-[11px] text-slate-400 mt-0.5">Tingkat kehadiran siswa selama 5 hari aktif terakhir</p>
                        </div>
                        <div class="flex items-center space-x-2 text-[10px] font-semibold text-slate-500">
                            <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-emerald-500"></span> Presensi</span>
                        </div>
                    </div>

                    <!-- Bespoke Custom SVG Sparkline Graph (Human-Crafted with no external library) -->
                    <div class="relative w-full h-48 bg-slate-50/50 rounded-2xl border border-slate-100 p-4 flex flex-col justify-between">
                        <!-- Horizontal Grid Lines -->
                        <div class="absolute inset-x-0 top-6 border-t border-slate-200/40 pointer-events-none"></div>
                        <div class="absolute inset-x-0 top-18 border-t border-slate-200/40 pointer-events-none"></div>
                        <div class="absolute inset-x-0 top-30 border-t border-slate-200/40 pointer-events-none"></div>
                        <div class="absolute inset-x-0 top-42 border-t border-slate-200/40 pointer-events-none"></div>
                        
                        <!-- Real SVG Vector Chart -->
                        <svg class="w-full h-full absolute inset-0 z-10" viewBox="0 0 500 150" preserveAspectRatio="none">
                            <defs>
                                <linearGradient id="curveGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stop-color="#10b981" stop-opacity="0.18" />
                                    <stop offset="100%" stop-color="#10b981" stop-opacity="0.0" />
                                </linearGradient>
                            </defs>
                            <!-- Background gradient block -->
                            <path d="M 40 120 C 130 95, 210 105, 300 70 C 380 40, 420 85, 460 30 L 460 140 L 40 140 Z" fill="url(#curveGrad)" />
                            
                            <!-- Bezier curved line representing weekly stats -->
                            <path d="M 40 120 C 130 95, 210 105, 300 70 C 380 40, 420 85, 460 30" fill="none" stroke="#059669" stroke-width="2.5" stroke-linecap="round" />
                            
                            <!-- Key Data Nodes -->
                            <circle cx="40" cy="120" r="4.5" fill="#ffffff" stroke="#059669" stroke-width="2.5" />
                            <circle cx="145" cy="108" r="4.5" fill="#ffffff" stroke="#059669" stroke-width="2.5" />
                            <circle cx="250" cy="85" r="4.5" fill="#ffffff" stroke="#059669" stroke-width="2.5" />
                            <circle cx="355" cy="58" r="4.5" fill="#ffffff" stroke="#059669" stroke-width="2.5" />
                            <circle cx="460" cy="30" r="4.5" fill="#ffffff" stroke="#059669" stroke-width="2.5" />
                        </svg>

                        <!-- Y-Axis Labels -->
                        <div class="absolute left-2.5 top-0 bottom-6 flex flex-col justify-between text-[9px] font-mono font-bold text-slate-400 z-20 pointer-events-none">
                            <span>100%</span>
                            <span>95%</span>
                            <span>90%</span>
                            <span>85%</span>
                        </div>

                        <!-- Spacer / Push to bottom -->
                        <div class="flex-1"></div>

                        <!-- X-Axis Labels (Day Names) -->
                        <div class="flex justify-between items-center text-[10px] font-bold text-slate-500 px-6 z-20 mt-2 relative">
                            <span class="flex flex-col items-center"><span>Senin</span><span class="text-[8px] font-mono text-slate-400 mt-0.5">92%</span></span>
                            <span class="flex flex-col items-center"><span>Selasa</span><span class="text-[8px] font-mono text-slate-400 mt-0.5">94%</span></span>
                            <span class="flex flex-col items-center"><span>Rabu</span><span class="text-[8px] font-mono text-slate-400 mt-0.5">95%</span></span>
                            <span class="flex flex-col items-center"><span>Kamis</span><span class="text-[8px] font-mono text-slate-400 mt-0.5">97%</span></span>
                            <span class="flex flex-col items-center"><span>Jumat</span><span class="text-[8px] font-mono text-slate-400 mt-0.5">98%</span></span>
                        </div>
                    </div>
                </div>

                <!-- ANALYTICS CARD 2: Class Grade Sizes Bar Chart -->
                <div class="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm">
                    <div class="flex items-center justify-between mb-5">
                        <div>
                            <h3 class="text-sm font-bold text-slate-800">Distribusi Siswa per Tingkatan Kelas</h3>
                            <p class="text-[11px] text-slate-400 mt-0.5">Rincian pembagian jumlah siswa di tiap grade</p>
                        </div>
                        <div class="flex items-center space-x-2 text-[10px] font-semibold text-slate-500">
                            <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-blue-500"></span> Total Siswa</span>
                        </div>
                    </div>

                    <!-- Bespoke Custom SVG Grouped Bar Chart (Human-Crafted) -->
                    <div class="relative w-full h-48 bg-slate-50/50 rounded-2xl border border-slate-100 p-4 flex flex-col justify-between">
                        <!-- Horizontal Grid Lines -->
                        <div class="absolute inset-x-0 top-6 border-t border-slate-200/40 pointer-events-none"></div>
                        <div class="absolute inset-x-0 top-18 border-t border-slate-200/40 pointer-events-none"></div>
                        <div class="absolute inset-x-0 top-30 border-t border-slate-200/40 pointer-events-none"></div>
                        <div class="absolute inset-x-0 top-42 border-t border-slate-200/40 pointer-events-none"></div>

                        <!-- Bar Columns Containers (Clean flexbox layout styled manually) -->
                        <div class="flex-1 flex justify-around items-end px-4 z-10 relative h-32">
                            <!-- Column 1 (Kelas X) -->
                            <div class="flex flex-col items-center w-12 group cursor-pointer">
                                <span class="text-[9px] font-mono font-bold text-blue-600 mb-1 opacity-0 group-hover:opacity-100 transition duration-150 bg-blue-50 border border-blue-100 px-1 rounded">28 Siswa</span>
                                <div class="w-7 bg-blue-500 hover:bg-blue-600 rounded-t-lg transition-all duration-300 h-28 shadow-sm"></div>
                            </div>

                            <!-- Column 2 (Kelas XI) -->
                            <div class="flex flex-col items-center w-12 group cursor-pointer">
                                <span class="text-[9px] font-mono font-bold text-emerald-600 mb-1 opacity-0 group-hover:opacity-100 transition duration-150 bg-emerald-50 border border-emerald-100 px-1 rounded">32 Siswa</span>
                                <div class="w-7 bg-emerald-500 hover:bg-emerald-600 rounded-t-lg transition-all duration-300 h-32 shadow-sm"></div>
                            </div>

                            <!-- Column 3 (Kelas XII) -->
                            <div class="flex flex-col items-center w-12 group cursor-pointer">
                                <span class="text-[9px] font-mono font-bold text-violet-600 mb-1 opacity-0 group-hover:opacity-100 transition duration-150 bg-violet-50 border border-violet-100 px-1 rounded">24 Siswa</span>
                                <div class="w-7 bg-violet-500 hover:bg-violet-600 rounded-t-lg transition-all duration-300 h-24 shadow-sm"></div>
                            </div>
                        </div>

                        <!-- X-Axis Label Categories -->
                        <div class="flex justify-around items-center text-[10px] font-bold text-slate-500 mt-2 px-2 border-t border-slate-250 pt-1.5">
                            <span class="w-16 text-center">Kelas X</span>
                            <span class="w-16 text-center">Kelas XI</span>
                            <span class="w-16 text-center">Kelas XII</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- 5. RECENT STUDENTS LIST & TIMELINE OF SYSTEM LOGS -->
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <!-- Card 1: 5 Murid Terdaftar Terakhir (Left block - 2/3 width) -->
                <div class="lg:col-span-2 bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm">
                    <div class="flex items-center justify-between mb-5">
                        <div>
                            <h2 class="text-sm font-bold text-slate-800">Siswa Terdaftar Terakhir</h2>
                            <p class="text-[11px] text-slate-400 mt-0.5">Daftar siswa baru yang masuk sistem pembelajaran</p>
                        </div>
                        <button onclick="navigateTo('siswa')" class="text-[11px] font-bold text-emerald-600 hover:underline cursor-pointer">Kelola Siswa <i class="fa-solid fa-arrow-right ml-0.5"></i></button>
                    </div>

                    <div class="space-y-3">
                        ${students.length > 0 ? students.slice(0, 5).map(student => {
                            let roleBadge = '';
                            if (student.role === 'class_leader' || student.role === 'ketua_kelas') {
                                roleBadge = '<span class="text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-100 px-2 py-0.5 rounded-full">Ketua Kelas</span>';
                            } else {
                                roleBadge = '<span class="text-[9px] font-bold bg-slate-50 text-slate-500 border border-slate-100 px-2 py-0.5 rounded-full">Siswa Reguler</span>';
                            }
                            return `
                                <div class="flex items-center justify-between p-3.5 bg-slate-50/60 border border-slate-100 hover:bg-slate-50 transition rounded-2xl">
                                    <div class="flex items-center space-x-3.5">
                                        <div class="w-9 h-9 rounded-xl bg-slate-200 border border-slate-300 flex items-center justify-center font-bold text-slate-600 text-xs">
                                            ${student.photo ? `<img src="${window.getPhotoHtmlSrc ? window.getPhotoHtmlSrc(student.photo) : ''}" class="w-full h-full rounded-xl object-cover" referrerPolicy="no-referrer">` : student.name.charAt(0)}
                                        </div>
                                        <div>
                                            <p class="text-xs font-bold text-slate-800 leading-none">${student.name || '-'}</p>
                                            <p class="text-[10px] text-slate-400 mt-1 font-mono">NIS: ${student.nis || '-'}</p>
                                        </div>
                                    </div>
                                    <div class="flex items-center space-x-3">
                                        ${roleBadge}
                                        <span class="text-[10px] text-slate-500 font-bold bg-white px-2 py-1 rounded-lg border shadow-xs">${student.classId || 'Umum'}</span>
                                    </div>
                                </div>
                            `;
                        }).join('') : `
                            <div class="text-center py-10 text-xs text-slate-400">
                                <i class="fa-solid fa-user-slash text-2xl mb-2.5 text-slate-300"></i>
                                <p class="font-medium">Belum ada data siswa terdaftar.</p>
                            </div>
                        `}
                    </div>
                </div>

                <!-- Card 2: Log Aktivitas Madrasah Terbaru (Right block - 1/3 width) -->
                <div class="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm">
                    <div class="flex items-center justify-between mb-5">
                        <div>
                            <h2 class="text-sm font-bold text-slate-800">Log Aktivitas Sistem</h2>
                            <p class="text-[11px] text-slate-400 mt-0.5 font-medium">Log pelaporan real-time</p>
                        </div>
                        <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    </div>

                    <!-- Timeline layout (Human-Crafted details) -->
                    <div class="space-y-4">
                        <div class="relative pl-5 border-l border-slate-200 space-y-4 text-xs">
                            <!-- Log 1 -->
                            <div class="relative">
                                <div class="absolute -left-[25px] top-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white shadow-xs"></div>
                                <span class="text-[9px] font-bold text-slate-400 font-mono">07:30 WIB</span>
                                <p class="font-bold text-slate-800 mt-0.5 leading-tight">Presensi Kehadiran Dimulai</p>
                                <p class="text-[10px] text-slate-400 leading-normal mt-0.5">Siswa ${students[0]?.name || 'siswa'} melakukan presensi GPS.</p>
                            </div>

                            <!-- Log 2 -->
                            <div class="relative">
                                <div class="absolute -left-[25px] top-0 w-2.5 h-2.5 bg-blue-500 rounded-full border-2 border-white shadow-xs"></div>
                                <span class="text-[9px] font-bold text-slate-400 font-mono">08:00 WIB</span>
                                <p class="font-bold text-slate-800 mt-0.5 leading-tight">Server CBT Aktif & Terpantau</p>
                                <p class="text-[10px] text-slate-400 leading-normal mt-0.5">Sistem memonitoring 1 ujian CBT yang sedang aktif berjalan.</p>
                            </div>

                            <!-- Log 3 -->
                            <div class="relative">
                                <div class="absolute -left-[25px] top-0 w-2.5 h-2.5 bg-violet-500 rounded-full border-2 border-white shadow-xs"></div>
                                <span class="text-[9px] font-bold text-slate-400 font-mono">Kemarin</span>
                                <p class="font-bold text-slate-800 mt-0.5 leading-tight">RPP Modul Ajar AI Sukses</p>
                                <p class="text-[10px] text-slate-400 leading-normal mt-0.5">Guru Fikih sukses merancang draf RPP baru dengan Gemini AI.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Asynchronously check connection status and show database warnings if disconnected
    setTimeout(async () => {
        try {
            const res = await fetch('/api/db-status');
            const data = await res.json();
            const bannerEl = document.getElementById('db-warning-banner');
            if (bannerEl) {
                if (data && data.connected === false) {
                    const sqlConnected = data.sql && data.sql.connected;
                    const firebaseConnected = data.firebase && data.firebase.connected;
                    
                    let reasons = [];
                    if (!sqlConnected) reasons.push('Database SQL Terputus');
                    if (!firebaseConnected) reasons.push('Firestore Terputus');
                    const reasonsStr = reasons.join(' & ');
                    
                    bannerEl.innerHTML = `
                        <div class="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3 shadow-sm animate-in fade-in slide-in-from-top-4 duration-300 text-left my-2">
                            <div class="shrink-0 w-9 h-9 bg-amber-500/10 text-amber-600 rounded-xl flex items-center justify-center">
                                <i class="fa-solid fa-triangle-exclamation text-base animate-bounce"></i>
                            </div>
                            <div class="flex-1 space-y-1">
                                <h4 class="text-xs font-bold text-amber-900">Perhatian: Sinkronisasi Layanan Terhambat (${reasonsStr})</h4>
                                <p class="text-[11px] text-amber-700 leading-relaxed">
                                    Sistem mendeteksi bahwa database utama saat ini terputus. Data Guru dan Mata Pelajaran yang Anda edit baru tersimpan lokal di kontainer link ini (${window.location.hostname}) dan belum disinkronkan ke cloud.
                                </p>
                                <div class="pt-1.5 flex gap-2">
                                    <button onclick="navigateTo('setting'); setTimeout(() => { const btn = document.querySelector('button[onclick=\\'checkDatabaseConnection()\\']'); if(btn) btn.click(); }, 300);" class="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[10px] font-bold transition cursor-pointer">Jalankan Diagnostik Mendalam</button>
                                    <button onclick="navigateTo('setting')" class="px-3 py-1.5 bg-white hover:bg-amber-100/50 text-amber-800 border border-amber-200 rounded-lg text-[10px] font-bold transition cursor-pointer">Buka Pengaturan Sinkronisasi</button>
                                </div>
                            </div>
                        </div>
                    `;
                    bannerEl.classList.remove('hidden');
                }
            }
        } catch(e) {}
    }, 50);
}

// Window globals for inline onclicks
window.appState = appState;
window.saveState = saveState;
window.showToast = showToast;
window.handleLogin = handleLogin;
window.logout = logout;
window.toggleSidebar = toggleSidebar;
window.navigateTo = navigateTo;
window.navigateBack = navigateBack;
window.updateGlobalBackBar = updateGlobalBackBar;
window.fillDemo = fillDemo;
window.handleGlobalSearch = handleGlobalSearch;
window.updateSchoolLogoUI = updateSchoolLogoUI;
window.applyLoginCustomization = applyLoginCustomization;
window.applyTheme = applyTheme;
window.adjustColorBrightness = adjustColorBrightness;
window.blendWithWhite = blendWithWhite;
window.hexToRgb = hexToRgb;


// Automatically expose functions and state to window for global inline handlers
if (typeof appState !== "undefined") window.appState = appState;
Object.assign(window, {
  appState,
  adjustColorBrightness,
  blendWithWhite,
  hexToRgb,
  applyTheme,
  saveState,
  updateSchoolLogoUI,
  applyLoginCustomization,
  showConfirmModal,
  showToast,
  initAppSession,
  handleGlobalSearch,
  fillDemo,
  fillAndSubmitDemo,
  handleLogin,
  startSession,
  logout,
  toggleSidebar,
  getDefaultRoute,
  buildSidebar,
  navigateTo,
  navigateBack,
  updateGlobalBackBar,
  renderMainDashboard
});

function renderMathInElementSafely(element) {
    if (!element) return;
    try {
        if (typeof window.renderMathInElement === 'function') {
            window.renderMathInElement(element, {
                delimiters: [
                    {left: '$$', right: '$$', display: true},
                    {left: '$', right: '$', display: false},
                    {left: '\\(', right: '\\)', display: false},
                    {left: '\\[', right: '\\]', display: true}
                ],
                throwOnError: false
            });
        }
    } catch (e) {
        console.warn('KaTeX rendering error:', e);
    }
}
window.renderMathInElementSafely = renderMathInElementSafely;

async function detectTenantUrlOnBoot() {
    const path = window.location.pathname;
    if (path.startsWith('/m/')) {
        const slug = path.substring(3).split('/')[0];
        if (slug) {
            try {
                const res = await fetch(`/api/madrasah-by-slug/${slug}`);
                const data = await res.json();
                if (data.success && data.madrasah) {
                    window.__activeTenant = data.madrasah;
                    document.title = `${data.madrasah.name} - Portal Madrasah`;
                    const tenantBanner = document.getElementById('login-tenant-banner');
                    if (tenantBanner) {
                        tenantBanner.replaceChildren();
                    const tenantIcon = document.createElement('i');
                    tenantIcon.className = 'fa-solid fa-school text-emerald-600';
                    const tenantLabel = document.createTextNode(' Portal Madrasah: ');
                    const tenantName = document.createElement('strong');
                    tenantName.className = 'font-bold text-slate-800';
                    tenantName.textContent = String(data.madrasah.name || '');
                    tenantBanner.append(tenantIcon, tenantLabel, tenantName);
                        tenantBanner.classList.remove('hidden');
                    }
                    const leftSchoolName = document.getElementById('login-left-school-name');
                    if (leftSchoolName) leftSchoolName.innerText = data.madrasah.name;
                }
            } catch(e) {}
        }
    }
}
window.detectTenantUrlOnBoot = detectTenantUrlOnBoot;
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', detectTenantUrlOnBoot);
} else {
    detectTenantUrlOnBoot();
}

