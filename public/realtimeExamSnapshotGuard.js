// Prevent browser-side full-tenant CBT monitoring snapshots from being pulled by
// legacy realtime state-sync. Modern CBT monitoring already uses micro-events and
// /api/exams/:examId/monitor, while POST /api/exam-monitoring-state is still kept
// intact for explicit staff mutations such as block/message/duration changes.
(() => {
    const nativeFetch = window.fetch;
    if (typeof nativeFetch !== 'function' || window.__madrasahExamSnapshotGuardInstalled) return;

    function requestMethod(resource, options) {
        const explicit = options && options.method;
        if (explicit) return String(explicit).toUpperCase();
        if (typeof Request !== 'undefined' && resource instanceof Request) {
            return String(resource.method || 'GET').toUpperCase();
        }
        return 'GET';
    }

    function requestUrl(resource) {
        if (typeof resource === 'string') return resource;
        if (typeof URL !== 'undefined' && resource instanceof URL) return resource.toString();
        if (resource && typeof resource.url === 'string') return resource.url;
        return '';
    }

    window.fetch = function(resource, options) {
        const method = requestMethod(resource, options);
        const rawUrl = requestUrl(resource);

        if (method === 'GET' && rawUrl) {
            try {
                const parsed = new URL(rawUrl, window.location.origin);
                if (parsed.pathname === '/api/exam-monitoring-state') {
                    return Promise.resolve(new Response(JSON.stringify({
                        success: false,
                        suppressed: true,
                        message: 'Legacy full monitoring snapshot suppressed; use exam-scoped monitoring.'
                    }), {
                        status: 200,
                        headers: {
                            'Content-Type': 'application/json',
                            'X-Madrasah-Legacy-Monitoring-Suppressed': '1'
                        }
                    }));
                }
            } catch (_) {}
        }

        return nativeFetch.call(this || window, resource, options);
    };

    window.__madrasahExamSnapshotGuardInstalled = true;
})();
