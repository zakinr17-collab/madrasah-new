(function () {
    const CHAT_CELL_CLASS = 'student-direct-chat-cell';
    const CHAT_HEADER_CLASS = 'student-direct-chat-header';
    let enhanceScheduled = false;

    function isAdminChatEnabled() {
        const state = window.appState || {};
        const role = String(state.currentUser?.role || state.role || '').toLowerCase();
        const enabled = state.settings?.chatEnabled;
        return role === 'admin' && (enabled === true || enabled === 'true');
    }

    function insertBeforeActionCell(parent, node) {
        const last = parent.lastElementChild;
        if (last) parent.insertBefore(node, last);
        else parent.appendChild(node);
    }

    function ensureChatHeader(table) {
        if (!table || table.querySelector(`.${CHAT_HEADER_CLASS}`)) return false;
        const headerRow = table.querySelector('thead tr');
        if (!headerRow) return false;

        const th = document.createElement('th');
        th.className = `${CHAT_HEADER_CLASS} p-4 text-center`;
        th.textContent = 'Chat';
        insertBeforeActionCell(headerRow, th);
        return true;
    }

    function ensureChatCell(row, studentId) {
        if (!row || !studentId || row.querySelector(`.${CHAT_CELL_CLASS}`)) return false;

        const td = document.createElement('td');
        td.className = `${CHAT_CELL_CLASS} p-4 text-center`;

        const button = document.createElement('button');
        button.type = 'button';
        button.dataset.studentid = String(studentId);
        button.className = 'student-chat-btn relative inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-50 text-blue-700 rounded-xl hover:bg-blue-100 transition font-semibold text-xs cursor-pointer';
        button.title = 'Buka chat siswa';
        button.setAttribute('aria-label', 'Buka chat siswa');
        button.innerHTML = '<i class="fa-regular fa-comment-dots"></i><span>Chat</span>';
        button.addEventListener('click', () => {
            if (typeof window.openChatWithStudent === 'function') {
                window.openChatWithStudent(String(studentId));
            }
        });

        td.appendChild(button);
        insertBeforeActionCell(row, td);
        return true;
    }

    function enhanceStudentTableChat() {
        enhanceScheduled = false;
        if (!isAdminChatEnabled()) return;

        const checkboxes = document.querySelectorAll('.student-page-checkbox');
        const touchedTables = new Set();
        let changed = false;

        checkboxes.forEach((checkbox) => {
            const studentId = checkbox.value;
            const row = checkbox.closest('tr');
            const table = checkbox.closest('table');
            if (!row || !table || !studentId) return;

            touchedTables.add(table);
            changed = ensureChatCell(row, studentId) || changed;
        });

        touchedTables.forEach((table) => {
            changed = ensureChatHeader(table) || changed;
        });

        // Reuse the existing unread-message logic only when new direct-chat
        // controls were inserted. This avoids a MutationObserver render loop.
        if (changed && typeof window.updateChatNotificationBadges === 'function') {
            window.updateChatNotificationBadges();
        }
    }

    function scheduleEnhance() {
        if (enhanceScheduled) return;
        enhanceScheduled = true;
        requestAnimationFrame(enhanceStudentTableChat);
    }

    const start = () => {
        scheduleEnhance();
        const observer = new MutationObserver(scheduleEnhance);
        observer.observe(document.body, { childList: true, subtree: true });

        // Other modules can call this after a manual re-render if needed.
        window.refreshStudentDirectChatButtons = scheduleEnhance;
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start, { once: true });
    } else {
        start();
    }
})();
