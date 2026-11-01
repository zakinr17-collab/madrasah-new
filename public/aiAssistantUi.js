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
  function isTeacherUser() {
    const role = String(window.appState?.role || window.appState?.currentUser?.role || '').toLowerCase();
    return role === 'teacher' || role === 'guru';
  }
  // Status izin guru di-cache agar FAB tidak berkedip; cek ringan sekali per sesi.
  let teacherAllowedCache = null;
  async function teacherAllowed() {
    if (teacherAllowedCache !== null) return teacherAllowedCache;
    try {
      const res = await fetch('/api/ai-assistant/teacher/history', { credentials: 'include' });
      const data = await res.json();
      teacherAllowedCache = data?.allowed === true;
    } catch (e) { teacherAllowedCache = false; }
    return teacherAllowedCache;
  }

  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c]));
  }

  function mdLite(s) {
    // Render ringan: baris baru -> <br>, blok kode sederhana
    return esc(s).replace(/\n/g, '<br>');
  }

  window.renderAiAssistantButton = function () {
    if (isAdminUser()) return `
      <button id="ai-assistant-fab" onclick="window.openAiAssistantPanel()" title="Asisten AI Madrasah"
        class="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-2xl shadow-indigo-500/40 flex items-center justify-center hover:scale-105 active:scale-95 transition-transform cursor-pointer">
        <i class="fa-solid fa-robot text-xl"></i>
        <span class="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-400 border-2 border-white animate-pulse"></span>
      </button>`;
    return `
      <button id="ai-assistant-fab" onclick="window.openAiAssistantPanel()" title="Asisten Guru"
        class="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-gradient-to-br from-emerald-600 to-teal-600 text-white shadow-2xl shadow-emerald-500/40 flex items-center justify-center hover:scale-105 active:scale-95 transition-transform cursor-pointer">
        <i class="fa-solid fa-robot text-xl"></i>
      </button>`;
  };

  window.openAiAssistantPanel = function () {
    let panel = document.getElementById('ai-assistant-panel');
    if (panel) { panel.classList.remove('translate-x-full'); return; }
    const teacherMode = isTeacherUser();
    const headerGrad = teacherMode ? 'from-emerald-600 to-teal-600' : 'from-indigo-600 to-violet-600';
    panel = document.createElement('div');
    panel.id = 'ai-assistant-panel';
    panel.className = 'fixed top-0 right-0 z-[60] h-full w-full sm:w-[420px] bg-white shadow-2xl border-l border-slate-200 flex flex-col translate-x-full transition-transform duration-300';
    panel.innerHTML = `
      <div class="flex items-center justify-between px-4 py-3 bg-gradient-to-r ${headerGrad} text-white">
        <div class="flex items-center gap-2.5">
          <div class="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center"><i class="fa-solid fa-robot"></i></div>
          <div>
            <p class="text-sm font-extrabold leading-tight">${teacherMode ? 'Asisten Guru' : 'Asisten Madrasah'}</p>
            <p class="text-[10px] text-white/80">${teacherMode ? 'Hanya data kelas ampuan Anda & panduan aplikasi' : 'AI aktif: profil pengaturan &bull; mengenal aplikasi ini'}</p>
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
        <p class="text-[10px] text-slate-400 mt-1.5">${teacherMode ? 'Asisten hanya bisa melihat data kelas ampuan Anda — tidak bisa mengubah apa pun.' : 'Asisten memakai API key yang diaktifkan di Pengaturan.'}</p>
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
    const teacherMode = isTeacherUser();
    const historyUrl = teacherMode ? '/api/ai-assistant/teacher/history' : '/api/ai-assistant/history';
    try {
      const res = await fetch(historyUrl, { credentials: 'include' });
      const data = await res.json();
      const allowed = teacherMode ? (data?.allowed === true) : true;
      const turns = Array.isArray(data?.turns) ? data.turns : [];
      const box = messagesBox();
      if (!allowed) {
        if (box) box.innerHTML = `<div class="text-center py-8 px-4">
          <div class="w-14 h-14 mx-auto rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mb-3"><i class="fa-solid fa-lock text-2xl"></i></div>
          <p class="text-sm font-bold text-slate-700">Asisten AI belum diizinkan</p>
          <p class="text-xs text-slate-500 mt-1">Fitur ini memerlukan izin dari admin madrasah melalui menu Perizinan Guru. Hubungi admin Anda.</p></div>`;
        const input = document.getElementById('ai-assistant-input');
        const send = document.getElementById('ai-assistant-send');
        if (input) input.disabled = true;
        if (send) send.disabled = true;
        return;
      }
      if (box && turns.length === 0) {
        if (teacherMode) {
          box.innerHTML = `<div class="text-center py-8 px-4">
          <div class="w-14 h-14 mx-auto rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3"><i class="fa-solid fa-robot text-2xl"></i></div>
          <p class="text-sm font-bold text-slate-700">Halo! 👋</p>
          <p class="text-xs text-slate-500 mt-1">Saya Asisten Guru — saya bisa melihat data kelas ampuan Anda, mengantar ke halaman, menunjukkan lokasi fitur, dan menjawab pertanyaan umum.</p>
          <div class="flex flex-wrap gap-2 justify-center mt-4">
            <button onclick="window.aiAssistantQuick('Tampilkan ringkasan data saya')" class="text-[11px] px-3 py-1.5 bg-white border border-slate-200 rounded-full hover:border-emerald-300 text-slate-600 cursor-pointer">Ringkasan data saya</button>
            <button onclick="window.aiAssistantQuick('Antar saya ke bank soal')" class="text-[11px] px-3 py-1.5 bg-white border border-slate-200 rounded-full hover:border-emerald-300 text-slate-600 cursor-pointer">Antar ke Bank Soal</button>
          </div></div>`;
        } else {
        box.innerHTML = `<div class="text-center py-8 px-4">
          <div class="w-14 h-14 mx-auto rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-3"><i class="fa-solid fa-robot text-2xl"></i></div>
          <p class="text-sm font-bold text-slate-700">Halo, Admin! 👋</p>
          <p class="text-xs text-slate-500 mt-1">Saya Asisten Madrasah — saya mengenal aplikasi ini, bisa cek data live (siswa, ujian, kehadiran), dan bisa mengantarimu langsung ke halaman tertentu.</p>
          <div class="flex flex-wrap gap-2 justify-center mt-4">
            <button onclick="window.aiAssistantQuick('Berapa jumlah siswa dan guru saat ini?')" class="text-[11px] px-3 py-1.5 bg-white border border-slate-200 rounded-full hover:border-indigo-300 text-slate-600 cursor-pointer">Berapa siswa & guru?</button>
            <button onclick="window.aiAssistantQuick('Antar saya ke halaman evaluasi')" class="text-[11px] px-3 py-1.5 bg-white border border-slate-200 rounded-full hover:border-indigo-300 text-slate-600 cursor-pointer">Antar ke Evaluasi</button>
            <button onclick="window.aiAssistantQuick('Bagaimana cara membuat ujian CBT baru?')" class="text-[11px] px-3 py-1.5 bg-white border border-slate-200 rounded-full hover:border-indigo-300 text-slate-600 cursor-pointer">Cara buat ujian?</button>
          </div></div>`;
        }
        return;
      }
      turns.forEach((t) => appendBubble(t.role, t.content));
    } catch (e) { /* abaikan */ }
  };

  window.aiAssistantQuick = function (text) {
    const input = document.getElementById('ai-assistant-input');
    if (input) { input.value = text; window.sendAiAssistantMessage(); }
  };

  // ---------------------------------------------------------------------------
  // SOROT ELEMEN UI: kunci elemen (server) -> selector -> highlight + tooltip
  // ---------------------------------------------------------------------------
  const UI_ELEMENT_SELECTORS = {
    setting: {
      account_search: "#account-search-input",
      set_school_name: "#set-school",
      set_admin_name: "#set-admin-name",
      chat_toggle: "#set-chat-enabled",
      running_text: "#set-running-text",
      turn_username: "#set-turn-username",
    },
    siswa: {
      student_search: "#student-search-input, #search-student-input, input[placeholder*='cari siswa' i], input[placeholder*='Cari siswa' i]",
      add_student_btn: "button[onclick*='openAddStudent'], button[onclick*='addStudent']",
    },
    guru: {
      teacher_search: "#teacher-search-input, #search-teacher-input, input[placeholder*='cari guru' i], input[placeholder*='Cari guru' i]",
    },
    kelas: {
      class_search: "input[placeholder*='cari kelas' i], input[placeholder*='Cari kelas' i], #class-search-input",
    },
    bank_soal: {
      question_search: "input[placeholder*='cari soal' i], input[placeholder*='Cari soal' i], #question-search-input",
    },
    asesmen: {
      exam_list: "#exam-list-container, #assessment-list",
    },
    modul_ajar: {
      subject_search: "input[placeholder*='cari mapel' i], input[placeholder*='Cari mapel' i], #mapel-search-input",
    },
    dashboard: {
      attendance_trend: "div.bg-white.rounded-3xl:has(> div h3)", // fallback di bawah via teks
      quick_actions: "#main-app .grid.grid-cols-1.sm\\:grid-cols-2.lg\\:grid-cols-3",
      agenda_banner: "#main-app",
    },
  };

  window.aiAssistantHighlight = function (route, element, label, attempt = 0) {
    try {
      const map = UI_ELEMENT_SELECTORS[route];
      if (!map || !map[element]) return;
      let el = document.querySelector(map[element]);
      if (!el) {
        // Fallback teks: cari judul/elemen yang mengandung kata kunci label
        const key = String(label || element).toLowerCase();
        const candidates = Array.from(document.querySelectorAll('#main-app h1, #main-app h2, #main-app h3, #main-app p, #main-app button, #main-app input'));
        el = candidates.find((c) => c.textContent && c.textContent.toLowerCase().includes(key.split(' ').slice(-2).join(' ')));
        if (el) el = el.closest('div.bg-white, .rounded-3xl, section, form') || el;
      }
      if (!el) {
        // Halaman mungkin masih dirender — coba lagi hingga ~8 detik.
        if (attempt < 16) setTimeout(() => window.aiAssistantHighlight(route, element, label, attempt + 1), 500);
        return;
      }
      // Di layar kecil, panel chat menutupi elemen yang disorot -> geser panel dulu
      const panel = document.getElementById('ai-assistant-panel');
      let panelReopened = false;
      if (panel && !panel.classList.contains('translate-x-full')) {
        panel.classList.add('translate-x-full');
        panelReopened = true;
      }
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Wrap: beberapa elemen (checkbox) tidak bisa diberi ring
      const target = el;
      target.style.position = target.style.position || 'relative';
      target.style.zIndex = '50';
      target.style.transition = 'box-shadow 0.3s ease';
      let pulses = 0;
      const pulse = () => {
        if (pulses % 2 === 0) {
          target.style.boxShadow = '0 0 0 4px rgba(99,102,241,0.55), 0 0 24px 6px rgba(99,102,241,0.35)';
          target.style.outline = '3px solid rgba(99,102,241,0.9)';
          target.style.outlineOffset = '2px';
        } else {
          target.style.boxShadow = '0 0 0 4px rgba(99,102,241,0.15)';
        }
        pulses++;
        if (pulses < 22) setTimeout(pulse, 450);
        else {
          target.style.boxShadow = ''; target.style.outline = ''; target.style.zIndex = '';
          if (panelReopened && panel) panel.classList.remove('translate-x-full');
        }
      };
      pulse();
      // Tooltip panah
      const tip = document.createElement('div');
      tip.textContent = '👉 ' + (label || 'Elemen ini');
      tip.style.cssText = 'position:absolute;top:-34px;left:0;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;font-size:12px;font-weight:700;padding:6px 12px;border-radius:12px;white-space:nowrap;z-index:60;box-shadow:0 8px 20px rgba(79,70,229,.4);';
      const holder = target.closest('div,form,section') || target.parentElement;
      if (holder && getComputedStyle(holder).position === 'static') holder.style.position = 'relative';
      (holder || target.parentElement).appendChild(tip);
      setTimeout(() => tip.remove(), 5000);
      if (typeof showToast === 'function') showToast('Asisten menunjukkan: ' + (label || element), 'info');
    } catch (e) { /* diam */ }
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
      const endpoint = isTeacherUser() ? '/api/ai-assistant/teacher/chat' : '/api/ai-assistant/chat';
      const res = await fetch(endpoint, {
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
        // Agent: aksi tulis menunggu konfirmasi admin → tombol [Lanjutkan]/[Batal]
        if (Array.isArray(data.pendingWrites) && data.pendingWrites.length) {
          data.pendingWrites.forEach((p) => {
            if (!p?.id) return;
            const box = document.getElementById('ai-assistant-messages');
            if (!box) return;
            const wrap = document.createElement('div');
            wrap.className = 'bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-2';
            wrap.innerHTML = `
              <p class="text-[11px] font-bold text-amber-800"><i class="fa-solid fa-pen-to-square mr-1"></i>Aksi butuh konfirmasi</p>
              <p class="text-xs text-slate-700">${esc(p.summary || '')}</p>
              <div class="flex gap-2">
                <button class="text-[11px] font-bold px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer">✓ Lanjutkan</button>
                <button class="text-[11px] font-bold px-3 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 cursor-pointer">✕ Batal</button>
              </div>`;
            const [btnOk, btnNo] = wrap.querySelectorAll('button');
            const decide = async (cancel) => {
              btnOk.disabled = btnNo.disabled = true;
              btnOk.classList.add('opacity-50'); btnNo.classList.add('opacity-50');
              try {
                const res = await fetch('/api/ai-assistant/confirm', {
                  method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ token: p.id, cancel }),
                });
                const d = await res.json();
                wrap.querySelector('p.text-xs').textContent = (p.summary || '') + ' — ' + (d.message || (cancel ? 'Dibatalkan.' : 'Selesai.'));
                wrap.classList.toggle('bg-amber-50', false);
                wrap.classList.add(cancel ? 'bg-slate-100' : 'bg-emerald-50', cancel ? 'border-slate-200' : 'border-emerald-200');
                if (!cancel && d.success && appendBubble) appendBubble('assistant', '✅ ' + (d.message || 'Aksi dijalankan.'));
              } catch (e) {
                wrap.querySelector('p.text-xs').textContent = (p.summary || '') + ' — gagal memproses konfirmasi.';
              }
            };
            btnOk.onclick = () => decide(false);
            btnNo.onclick = () => decide(true);
            box.appendChild(wrap);
            box.scrollTop = box.scrollHeight;
          });
        }
        // Agent: tunjuk/sorot elemen UI
        if (Array.isArray(data.highlights) && data.highlights.length) {
          data.highlights.forEach((h) => {
            if (h && typeof h.route === 'string' && typeof h.element === 'string') {
              const label = h.label || h.element;
              setTimeout(() => window.aiAssistantHighlight(h.route, h.element, label), 1200);
              // Tombol "sorot lagi" di bubble jawaban
              setTimeout(() => {
                const box = document.getElementById('ai-assistant-messages');
                if (!box) return;
                const btn = document.createElement('button');
                btn.textContent = '👉 Sorot lagi';
                btn.className = 'text-[11px] font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-full mt-1 cursor-pointer';
                btn.onclick = () => window.aiAssistantHighlight(h.route, h.element, label);
                const last = box.lastElementChild;
                if (last) last.appendChild(btn);
              }, 1400);
            }
          });
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
