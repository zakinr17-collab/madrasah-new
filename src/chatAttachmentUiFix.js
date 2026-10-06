(function () {
    const MAX_ATTACHMENT_BYTES = 2 * 1024 * 1024;
    const IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);
    const VIDEO_MIME_TYPES = new Set(['video/mp4', 'video/webm']);
    const DOCUMENT_MIME_TYPES = new Set([
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.android.package-archive',
        'application/octet-stream'
    ]);

    function getAttachmentElements() {
        return {
            preview: document.getElementById('chat-attachment-preview'),
            image: document.getElementById('chat-preview-img'),
            video: document.getElementById('chat-preview-vid'),
            document: document.getElementById('chat-preview-doc'),
            input: document.getElementById('chat-file-input')
        };
    }

    function hidePreviewMedia(elements) {
        const { image, video, document: documentPreview } = elements;

        if (image) {
            image.classList.add('hidden');
            image.removeAttribute('src');
        }

        if (video) {
            try { video.pause(); } catch (_) {}
            video.classList.add('hidden');
            video.removeAttribute('src');
            try { video.load(); } catch (_) {}
        }

        if (documentPreview) documentPreview.classList.add('hidden');
    }

    function resetChatAttachmentUi() {
        window.chatAttachmentData = null;
        const elements = getAttachmentElements();
        hidePreviewMedia(elements);
        if (elements.preview) elements.preview.classList.add('hidden');
        if (elements.input) elements.input.value = '';
    }

    function showToast(message, type) {
        if (typeof window.showToast === 'function') window.showToast(message, type);
    }

    function getChatAuthHeaders(extra = {}) {
        const stored = typeof window.getStoredAuthToken === 'function' ? window.getStoredAuthToken() : '';
        const currentToken = window.appState?.currentUser?.token;
        const token = stored || (currentToken ? String(currentToken) : '');
        return {
            ...extra,
            ...(token ? { Authorization: `Bearer ${token}` } : {})
        };
    }

    function isSafeDataUrl(type, data) {
        if (!data || data.length > 8 * 1024 * 1024) return false;
        if (type === 'image') {
            return /^data:image\/(?:jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=\r\n]+$/i.test(data);
        }
        if (type === 'video') {
            return /^data:video\/(?:mp4|webm);base64,[A-Za-z0-9+/=\r\n]+$/i.test(data);
        }
        return /^data:(?:application\/pdf|application\/msword|application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document|application\/vnd\.android\.package-archive|application\/octet-stream);base64,[A-Za-z0-9+/=\r\n]+$/i.test(data);
    }

    function resolveAttachmentType(file) {
        const mime = String(file?.type || '').toLowerCase();
        const fileName = String(file?.name || '').toLowerCase();

        if (IMAGE_MIME_TYPES.has(mime)) return 'image';
        if (VIDEO_MIME_TYPES.has(mime)) return 'video';
        if (fileName.endsWith('.apk')) return 'apk';
        if (DOCUMENT_MIME_TYPES.has(mime)) return 'document';
        return '';
    }

    function revealDocumentPreview(candidate) {
        const elements = getAttachmentElements();
        hidePreviewMedia(elements);
        window.chatAttachmentData = candidate;
        if (elements.document) elements.document.classList.remove('hidden');
        if (elements.preview) elements.preview.classList.remove('hidden');
    }

    function revealVideoPreview(candidate) {
        const elements = getAttachmentElements();
        hidePreviewMedia(elements);
        window.chatAttachmentData = candidate;
        if (!elements.video || !elements.preview) return;
        elements.video.src = candidate.data;
        elements.video.classList.remove('hidden');
        elements.preview.classList.remove('hidden');
    }

    function revealImagePreview(candidate) {
        const probe = new Image();
        probe.onload = () => {
            const elements = getAttachmentElements();
            hidePreviewMedia(elements);
            window.chatAttachmentData = candidate;
            if (!elements.image || !elements.preview) return;
            elements.image.src = candidate.data;
            elements.image.classList.remove('hidden');
            elements.preview.classList.remove('hidden');
        };
        probe.onerror = () => {
            resetChatAttachmentUi();
            showToast('Gambar tidak dapat dipreview. Pilih JPG, PNG, atau WebP lain.', 'error');
        };
        probe.src = candidate.data;
    }

    window.clearChatAttachment = resetChatAttachmentUi;

    window.handleChatAttachment = function (event) {
        const input = event?.target || document.getElementById('chat-file-input');
        const file = input?.files?.[0];

        if (!file) {
            resetChatAttachmentUi();
            return;
        }

        if (file.size > MAX_ATTACHMENT_BYTES) {
            resetChatAttachmentUi();
            showToast('Ukuran file maksimal 2MB', 'error');
            return;
        }

        const type = resolveAttachmentType(file);
        if (!type) {
            resetChatAttachmentUi();
            showToast('Tipe lampiran tidak didukung. Gunakan JPG, PNG, WebP, MP4, WebM, PDF, DOC/DOCX, atau APK.', 'error');
            return;
        }

        const reader = new FileReader();
        reader.onerror = () => {
            resetChatAttachmentUi();
            showToast('File gagal dibaca. Silakan pilih ulang lampiran.', 'error');
        };
        reader.onload = (loadEvent) => {
            const data = String(loadEvent?.target?.result || '');
            const candidate = {
                type,
                data,
                name: String(file.name || 'lampiran').slice(0, 120)
            };

            if (!isSafeDataUrl(type, data)) {
                resetChatAttachmentUi();
                showToast('Lampiran tidak valid atau formatnya tidak didukung.', 'error');
                return;
            }

            if (type === 'image') revealImagePreview(candidate);
            else if (type === 'video') revealVideoPreview(candidate);
            else revealDocumentPreview(candidate);
        };
        reader.readAsDataURL(file);
    };

    async function performClearConversation(senderId, receiverId) {
        try {
            const response = await fetch('/api/chats/clear', {
                method: 'POST',
                headers: getChatAuthHeaders({ 'Content-Type': 'application/json' }),
                body: JSON.stringify({ senderId, receiverId })
            });

            const raw = await response.text().catch(() => '');
            let payload = null;
            if (raw) {
                try { payload = JSON.parse(raw); } catch (_) {}
            }

            if (!response.ok || payload?.success === false) {
                throw new Error(payload?.message || 'Gagal mengosongkan obrolan');
            }

            window.appState.chats = (window.appState.chats || []).filter((chat) => !(
                (String(chat.senderId) === String(senderId) && String(chat.receiverId) === String(receiverId)) ||
                (String(chat.senderId) === String(receiverId) && String(chat.receiverId) === String(senderId))
            ));

            resetChatAttachmentUi();
            if (typeof window.updateChatNotificationBadges === 'function') {
                window.updateChatNotificationBadges();
            }
            if (document.getElementById('chat-messages-container') && typeof window.refreshChatMessages === 'function') {
                window.refreshChatMessages(senderId, receiverId);
            }
            showToast('Obrolan berhasil dikosongkan');
        } catch (error) {
            showToast(`Gagal mengosongkan obrolan: ${error?.message || 'terjadi kesalahan'}`, 'error');
        }
    }

    window.clearAllChats = function (senderId, receiverId) {
        const message = 'Apakah Anda yakin ingin mengosongkan semua pesan dalam obrolan ini?';
        const confirmAction = () => performClearConversation(senderId, receiverId);

        if (typeof window.showConfirmModal === 'function') {
            window.showConfirmModal(message, confirmAction);
            return;
        }

        if (window.confirm(message)) confirmAction();
    };

    function normalizeCurrentPreview() {
        const elements = getAttachmentElements();
        if (!elements.preview) return;

        // The original chat markup creates an empty <img src="">. Keep it hidden
        // unless a valid attachment has explicitly populated the preview.
        if (!window.chatAttachmentData) {
            hidePreviewMedia(elements);
            elements.preview.classList.add('hidden');
        }

        const closeButton = elements.preview.querySelector('button');
        if (closeButton) {
            closeButton.setAttribute('aria-label', 'Hapus lampiran');
            closeButton.title = 'Hapus lampiran';
            closeButton.style.touchAction = 'manipulation';
        }
    }

    function wireClearConversationButton(senderId, receiverId) {
        const clearButton = document.getElementById('chat-clear-btn');
        if (!clearButton) return;

        clearButton.style.touchAction = 'manipulation';
        clearButton.setAttribute('aria-label', 'Kosongkan chat');
        clearButton.onclick = (event) => {
            event.preventDefault();
            window.clearAllChats(senderId, receiverId);
        };
    }

    const originalRenderChatModal = window.renderChatModal;
    if (typeof originalRenderChatModal === 'function') {
        window.renderChatModal = function (...args) {
            const result = originalRenderChatModal.apply(this, args);
            const [, , senderId, receiverId] = args;
            resetChatAttachmentUi();
            normalizeCurrentPreview();
            wireClearConversationButton(senderId, receiverId);
            return result;
        };
    }

    // Capture-phase handler makes the small red X reliable on touch devices and
    // avoids depending on an inline onclick handler.
    document.addEventListener('click', (event) => {
        const target = event.target instanceof Element ? event.target : null;
        const closeButton = target?.closest('#chat-attachment-preview button');
        if (!closeButton) return;

        event.preventDefault();
        event.stopPropagation();
        resetChatAttachmentUi();
    }, true);

    const observer = new MutationObserver(() => normalizeCurrentPreview());
    if (document.body) observer.observe(document.body, { childList: true, subtree: true });
    else document.addEventListener('DOMContentLoaded', () => {
        observer.observe(document.body, { childList: true, subtree: true });
        normalizeCurrentPreview();
    }, { once: true });
})();
