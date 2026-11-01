// ============================================================================
// AI ASSISTANT UI (ADMIN) — Kolom chat AI khusus akun admin.
// Tombol melayang di dashboard admin -> panel chat geser dari kanan.
// Terhubung ke /api/ai-assistant/* (memakai API key aktif di pengaturan).
// ============================================================================
(function () {
  function isAdminUser() {
    const role = String(window.appState?.role || window.appState?.currentUser?.role || '').toLowerCase();
    return role === 'admin' || role === 'administrator' || role === 'bos' || role === 'superadmin';
  }

  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c]));
  }

  function mdLite(s) {
    // Render ringan: baris baru -> <br>, blok kode sederhana
    return esc(s).replace(/\n/g, '<br>');
  }

  window.renderAiAssistantButton = function () {
    if (!isAdminUser()) return '';
    return `
      <button id="ai-assistant-fab" onclick="window.openAiAssistantPanel()" title="Asisten AI Madrasah"
        class="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-2xl shadow-indigo-500/40 flex items-center justify-center hover:scale-105 active:scale-95 transition-transform cursor-pointer">
        <i class="fa-solid fa-robot text-xl"></i>
        <span class="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-400 border-2 border-white animate-pulse"></span>
      </button>`;
  };

  window.openAiAssistantPanel = function () {
    let panel = document.getElementById('ai-assistant-panel');
    if (panel) { panel.classList.remove('translate-x-full'); return; }
    panel = document.createElement('div');
    panel.id = 'ai-assistant-panel';
    panel.className = 'fixed top-0 right-0 z-[60] h-full w-full sm:w-[420px] bg-white shadow-2xl border-l border-slate-200 flex flex-col translate-x-full transition-transform duration-300';
    panel.innerHTML = `
      <div class="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 text-white">
        <div class="flex items-center gap-2.5">
          <div class="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center"><i class="fa-solid fa-robot"></i></div>
          <div>
            <p class="text-sm font-extrabold leading-tight">Asisten Madrasah</p>
            <p class="text-[10px] text-indigo-100">AI aktif: profil pengaturan &bull; mengenal aplikasi ini</p>
          </div>
        </div>
        <div class="flex items-center gap-1">
          <button onclick="window.resetAiAssistantChat()" title="Percakapan baru" class="w-8 h-8 rounded-lg hover:bg-white/15 flex items-center justify-center cursor-pointer"><i class="fa-solid fa-rotate-right text-xs"></i></button>
          <button onclick="window.closeAiAssistantPanel()" title="Tutup" class="w-8 h-8 rounded-lg hover:bg-white/15 flex items-center justify-center cursor-pointer"><i class="fa-solid fa-xmark"></i></button>
        </div>
      </div>
      <div id="ai-assistant-messages" class="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-slate-50"></div>
      <div class="border-t border-slate-200 p-3 bg-white">
        <div class="flex items-end gap-2">
          <textarea id="ai-assistant-input" rows="1" placeholder="Tanya apa saja… (fitur aplikasi / pertanyaan umum)"
            class="flex-1 resize-none max-h-28 px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400"></textarea>
          <button id="ai-assistant-send" onclick="window.sendAiAssistantMessage()"
            class="w-10 h-10 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center shrink-0 cursor-pointer"><i class="fa-solid fa-paper-plane text-sm"></i></button>
        </div>
        <p class="text-[10px] text-slate-400 mt-1.5">Asisten memakai API key yang diaktifkan di Pengaturan.</p>
      </div>`;
    document.body.appendChild(panel);
    requestAnimationFrame(() => panel.classList.remove('translate-x-full'));
    const input = document.getElementById('ai-assistant-input');
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); window.sendAiAssistantMessage(); }
    });
    window.loadAiAssistantHistory();
    setTimeout(() => input.focus(), 350);
  };

  window.closeAiAssistantPanel = function () {
    const panel = document.getElementById('ai-assistant-panel');
    if (panel) panel.classList.add('translate-x-full');
  };

  function messagesBox() { return document.getElementById('ai-assistant-messages'); }

  function appendBubble(role, text, opts = {}) {
    const box = messagesBox();
    if (!box) return;
    const wrap = document.createElement('div');
    const isUser = role === 'user';
    wrap.className = `flex ${isUser ? 'justify-end' : 'justify-start'}`;
    wrap.innerHTML = `
      <div class="${isUser
        ? 'bg-indigo-600 text-white rounded-2xl rounded-br-md'
        : 'bg-white text-slate-800 border border-slate-200 rounded-2xl rounded-bl-md shadow-sm'} max-w-[85%] px-3.5 py-2.5 text-sm leading-relaxed ${opts.pending ? 'opacity-60' : ''}"
        ${opts.id ? `id="${opts.id}"` : ''}>
        ${isUser ? esc(text) : mdLite(text)}
      </div>`;
    box.appendChild(wrap);
    box.scrollTop = box.scrollHeight;
    return wrap;
  }

  function showTyping() {
    const box = messagesBox();
    if (!box) return;
    const d = document.createElement('div');
    d.id = 'ai-assistant-typing';
    d.className = 'flex justify-start';
    d.innerHTML = `<div class="bg-white border border-slate-200 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm flex gap-1.5">
      <span class="w-2 h-2 rounded-full bg-slate-300 animate-bounce"></span>
      <span class="w-2 h-2 rounded-full bg-slate-300 animate-bounce" style="animation-delay:0.15s"></span>
      <span class="w-2 h-2 rounded-full bg-slate-300 animate-bounce" style="animation-delay:0.3s"></span></div>`;
    box.appendChild(d);
    box.scrollTop = box.scrollHeight;
  }
  function hideTyping() { document.getElementById('ai-assistant-typing')?.remove(); }

  window.loadAiAssistantHistory = async function () {
    try {
      const res = await fetch('/api/ai-assistant/history', { credentials: 'include' });
      const data = await res.json();
      const turns = Array.isArray(data?.turns) ? data.turns : [];
      const box = messagesBox();
      if (box && turns.length === 0) {
        box.innerHTML = `<div class="text-center py-8 px-4">
          <div class="w-14 h-14 mx-auto rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-3"><i class="fa-solid fa-robot text-2xl"></i></div>
          <p class="text-sm font-bold text-slate-700">Halo, Admin! 👋</p>
          <p class="text-xs text-slate-500 mt-1">Saya Asisten Madrasah — saya mengenal aplikasi ini, bisa cek data live (siswa, ujian, kehadiran), dan bisa mengantarimu langsung ke halaman tertentu.</p>
          <div class="flex flex-wrap gap-2 justify-center mt-4">
            <button onclick="window.aiAssistantQuick('Berapa jumlah siswa dan guru saat ini?')" class="text-[11px] px-3 py-1.5 bg-white border border-slate-200 rounded-full hover:border-indigo-300 text-slate-600 cursor-pointer">Berapa siswa & guru?</button>
            <button onclick="window.aiAssistantQuick('Antar saya ke halaman evaluasi')" class="text-[11px] px-3 py-1.5 bg-white border border-slate-200 rounded-full hover:border-indigo-300 text-slate-600 cursor-pointer">Antar ke Evaluasi</button>
            <button onclick="window.aiAssistantQuick('Bagaimana cara membuat ujian CBT baru?')" class="text-[11px] px-3 py-1.5 bg-white border border-slate-200 rounded-full hover:border-indigo-300 text-slate-600 cursor-pointer">Cara buat ujian?</button>
          </div></div>`;
        return;
      }
      turns.forEach((t) => appendBubble(t.role, t.content));
    } catch (e) { /* abaikan */ }
  };

  window.aiAssistantQuick = function (text) {
    const input = document.getElementById('ai-assistant-input');
    if (input) { input.value = text; window.sendAiAssistantMessage(); }
  };

  window.resetAiAssistantChat = async function () {
    try { await fetch('/api/ai-assistant/reset', { method: 'POST', credentials: 'include' }); } catch (e) {}
    const box = messagesBox();
    if (box) box.innerHTML = '';
    window.loadAiAssistantHistory();
  };

  window.sendAiAssistantMessage = async function () {
    const input = document.getElementById('ai-assistant-input');
    const sendBtn = document.getElementById('ai-assistant-send');
    const text = String(input?.value || '').trim();
    if (!text || !input) return;
    input.value = '';
    input.style.height = 'auto';
    appendBubble('user', text);
    showTyping();
    if (sendBtn) { sendBtn.disabled = true; sendBtn.classList.add('opacity-50'); }
    try {
      const res = await fetch('/api/ai-assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ message: text }),
      });
      const data = await res.json();
      hideTyping();
      if (data?.success && data.reply) {
        appendBubble('assistant', data.reply);
        // Agent: antar admin langsung ke halaman yang diminta
        if (Array.isArray(data.navigation) && data.navigation.length && typeof window.navigateTo === 'function') {
          data.navigation.forEach((route) => {
            if (typeof route === 'string' && route) {
              try { window.navigateTo(route); } catch (e) {}
            }
          });
          if (typeof showToast === 'function') showToast('Asisten mengantarkanmu ke halaman tujuan.', 'info');
        }
      } else {
        appendBubble('assistant', data?.message || 'Maaf, terjadi kesalahan. Coba lagi.', { pending: true });
      }
    } catch (e) {
      hideTyping();
      appendBubble('assistant', 'Tidak dapat menghubungi server. Periksa koneksi lalu coba lagi.', { pending: true });
    } finally {
      hideTyping();
      if (sendBtn) { sendBtn.disabled = false; sendBtn.classList.remove('opacity-50'); }
      input.focus();
    }
  };

  // Suntikkan tombol FAB setelah dashboard dirender (pantau perubahan route)
  const origNavigateTo = window.navigateTo;
  window.navigateTo = function (route, options) {
    const r = origNavigateTo ? origNavigateTo.call(this, route, options) : undefined;
    setTimeout(() => {
      const old = document.getElementById('ai-assistant-fab');
      if (old) old.remove();
      const main = document.getElementById('main-app');
      if (main && !main.classList.contains('hidden') && isAdminUser() && typeof window.renderAiAssistantButton === 'function') {
        const holder = document.createElement('div');
        holder.innerHTML = window.renderAiAssistantButton();
        document.body.appendChild(holder.firstElementChild);
      }
      // Tutup panel bila pindah halaman
      const panel = document.getElementById('ai-assistant-panel');
      if (panel && panel.classList.contains('translate-x-full') === false && route !== 'ai-assistant') {
        // biarkan terbuka; admin bisa menutup manual
      }
    }, 400);
    return r;
  };

  // Saat load pertama (mis. refresh di dashboard)
  setTimeout(() => {
    const main = document.getElementById('main-app');
    if (main && !main.classList.contains('hidden') && isAdminUser() && !document.getElementById('ai-assistant-fab')) {
      const holder = document.createElement('div');
      holder.innerHTML = window.renderAiAssistantButton();
      if (holder.firstElementChild) document.body.appendChild(holder.firstElementChild);
    }
  }, 2500);
})();
