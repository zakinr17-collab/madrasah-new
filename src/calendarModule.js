/**
 * Module: Kalender Akademik & Agenda Madrasah
 * Provides interactive calendar view, national holiday markers, and exam schedule management.
 */

// Default fallback events if none exist in appState
export const defaultCalendarEvents = [
    {
        id: "CAL-1",
        title: "Awal Semester Ganjil 2026/2027",
        category: "Kegiatan Madrasah",
        type: "kegiatan",
        isHoliday: false,
        isExam: false,
        startDate: "2026-07-13",
        endDate: "2026-07-13",
        color: "#10b981",
        description: "Hari pertama masuk madrasah dan Pembukaan MATSAMA (Masa Ta'aruf Siswa Madrasah)."
    },
    {
        id: "CAL-2",
        title: "HUT Kemerdekaan RI Ke-81",
        category: "Hari Libur",
        type: "libur",
        isHoliday: true,
        isExam: false,
        startDate: "2026-08-17",
        endDate: "2026-08-17",
        color: "#ef4444",
        description: "Hari Libur Nasional Peringatan Hari Kemerdekaan Republik Indonesia."
    },
    {
        id: "CAL-3",
        title: "Asesmen Sumatif Tengah Semester (ASTS) Ganjil",
        category: "Jadwal Ujian",
        type: "ujian",
        isHoliday: false,
        isExam: true,
        startDate: "2026-09-21",
        endDate: "2026-09-26",
        color: "#8b5cf6",
        description: "Pelaksanaan Ujian ASTS berbasis Computer Based Test (CBT) untuk seluruh kelas VII - XII."
    },
    {
        id: "CAL-4",
        title: "Maulid Nabi Muhammad SAW 1448 H",
        category: "Hari Libur",
        type: "libur",
        isHoliday: true,
        isExam: false,
        startDate: "2026-09-24",
        endDate: "2026-09-24",
        color: "#ef4444",
        description: "Hari Libur Nasional Peringatan Maulid Nabi Muhammad SAW."
    },
    {
        id: "CAL-5",
        title: "Asesmen Sumatif Akhir Semester (ASAS) Ganjil",
        category: "Jadwal Ujian",
        type: "ujian",
        isHoliday: false,
        isExam: true,
        startDate: "2026-12-01",
        endDate: "2026-12-10",
        color: "#8b5cf6",
        description: "Ujian Semester Ganjil berbasis CBT dan Penilaian Praktik Kinerja Siswa."
    },
    {
        id: "CAL-6",
        title: "Libur Semester Ganjil Madrasah",
        category: "Hari Libur",
        type: "libur",
        isHoliday: true,
        isExam: false,
        startDate: "2026-12-21",
        endDate: "2027-01-02",
        color: "#ef4444",
        description: "Libur Pembagian Rapor dan Pergantian Semester Ganjil ke Semester Genap."
    }
];

// Active view state variables
if (window._currentCalendarYear === undefined) {
    window._currentCalendarYear = new Date().getFullYear();
    window._currentCalendarMonth = new Date().getMonth(); // 0 - 11
}
if (!window._currentCalendarCategoryFilter) {
    window._currentCalendarCategoryFilter = 'all';
}
if (!window._calendarSearchQuery) {
    window._calendarSearchQuery = '';
}

/**
 * Ensure appState.calendarEvents is populated
 */
function getCalendarEvents() {
    if (!window.appState) return defaultCalendarEvents;
    if (!Array.isArray(window.appState.calendarEvents) || window.appState.calendarEvents.length === 0) {
        window.appState.calendarEvents = [...defaultCalendarEvents];
        if (typeof window.saveState === 'function') {
            window.saveState('calendarEvents');
        }
    }
    return window.appState.calendarEvents;
}

/**
 * Render the main Kalender Akademik module view
 */
export function renderCalendarModule(container) {
    if (!container) return;

    const role = String(window.appState?.role || '').toLowerCase().trim();
    const isAdmin = role === 'admin';
    const events = getCalendarEvents();

    const currYear = window._currentCalendarYear;
    const currMonth = window._currentCalendarMonth;

    const monthNames = [
        "Januari", "Februari", "Maret", "April", "Mei", "Juni",
        "Juli", "Agustus", "September", "Oktober", "November", "Desember"
    ];

    // Filter events for active month
    const activeCategory = window._currentCalendarCategoryFilter || 'all';
    const searchQuery = (window._calendarSearchQuery || '').toLowerCase().trim();

    // Stats calculations
    const monthPrefix = `${currYear}-${String(currMonth + 1).padStart(2, '0')}`;
    const totalMonthEvents = events.filter(e => {
        const sMonth = (e.startDate || '').substring(0, 7);
        const eMonth = (e.endDate || '').substring(0, 7);
        return sMonth === monthPrefix || eMonth === monthPrefix;
    }).length;

    const holidayCount = events.filter(e => e.isHoliday || e.category === 'Hari Libur').length;
    const examCount = events.filter(e => e.isExam || e.category === 'Jadwal Ujian').length;
    const activityCount = events.filter(e => !e.isHoliday && !e.isExam).length;

    // Days calculation for grid
    const firstDayIndex = new Date(currYear, currMonth, 1).getDay(); // 0 = Sunday
    const daysInMonth = new Date(currYear, currMonth + 1, 0).getDate();
    const prevMonthDays = new Date(currYear, currMonth, 0).getDate();

    const todayStr = new Date().toISOString().split('T')[0];

    // Filtered list for agenda list below
    const filteredEvents = events.filter(e => {
        if (activeCategory !== 'all') {
            if (activeCategory === 'libur' && !e.isHoliday && e.category !== 'Hari Libur') return false;
            if (activeCategory === 'ujian' && !e.isExam && e.category !== 'Jadwal Ujian') return false;
            if (activeCategory === 'kegiatan' && (e.isHoliday || e.isExam) && e.category !== 'Kegiatan Madrasah') return false;
            if (activeCategory === 'rapat' && e.category !== 'Rapat Guru') return false;
        }
        if (searchQuery) {
            const matchTitle = (e.title || '').toLowerCase().includes(searchQuery);
            const matchDesc = (e.description || '').toLowerCase().includes(searchQuery);
            const matchCat = (e.category || '').toLowerCase().includes(searchQuery);
            if (!matchTitle && !matchDesc && !matchCat) return false;
        }
        return true;
    }).sort((a, b) => (a.startDate || '').localeCompare(b.startDate || ''));

    container.innerHTML = `
        <div class="space-y-6 max-w-7xl mx-auto">
            <!-- Header Banner -->
            <div class="bg-white text-slate-900 rounded-3xl p-6 sm:p-8 relative overflow-hidden shadow-sm border border-slate-200">
                <div class="absolute inset-0 bg-[radial-gradient(#cbd5e1_1.2px,transparent_1.2px)] [background-size:20px_20px] opacity-35 pointer-events-none"></div>
                
                <div class="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div class="space-y-2">
                        <div class="flex items-center space-x-2">
                            <span class="text-[10px] uppercase font-bold tracking-widest text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">
                                <i class="fa-solid fa-calendar-days mr-1.5"></i> Kalender & Agenda Madrasah
                            </span>
                        </div>
                        <h1 class="text-2xl sm:text-3xl font-black tracking-tight text-black">
                            Kalender Akademik & Hari Libur
                        </h1>
                        <p class="text-xs sm:text-sm text-black font-semibold leading-relaxed max-w-2xl">
                            Pantau jadwal ujian penting, hari libur nasional, rapat dewan guru, dan agenda kegiatan madrasah secara terstruktur.
                        </p>
                    </div>

                    <div class="flex items-center gap-3 shrink-0 flex-wrap">
                        <button type="button" onclick="window.openDownloadCalendarPdfModal()" class="px-5 py-3 bg-white text-slate-900 hover:bg-slate-50 border border-slate-200 active:scale-95 font-bold text-xs rounded-2xl shadow-sm flex items-center gap-2.5 transition cursor-pointer">
                            <i class="fa-solid fa-file-pdf text-rose-600 text-sm"></i>
                            <span>Cetak Kalender (PDF)</span>
                        </button>
                        ${isAdmin ? `
                        <button type="button" onclick="window.showAddCalendarEventModal && window.showAddCalendarEventModal()" class="px-5 py-3 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold text-xs rounded-2xl shadow-lg shadow-emerald-600/30 flex items-center gap-2.5 transition cursor-pointer">
                            <i class="fa-solid fa-calendar-plus text-sm"></i>
                            <span>Tambah Agenda / Hari Libur</span>
                        </button>
                        ` : ''}
                    </div>
                </div>
            </div>

            <!-- Top Summary Metric Cards -->
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div class="p-4 bg-white border border-slate-200/80 rounded-2xl shadow-sm flex flex-col justify-between h-24">
                    <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Event Bulan Ini</span>
                    <div class="flex items-end justify-between">
                        <span class="text-2xl font-extrabold text-slate-800">${totalMonthEvents}</span>
                        <div class="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-xs"><i class="fa-solid fa-calendar-week"></i></div>
                    </div>
                </div>

                <div class="p-4 bg-white border border-slate-200/80 rounded-2xl shadow-sm flex flex-col justify-between h-24">
                    <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Hari Libur Nasional</span>
                    <div class="flex items-end justify-between">
                        <span class="text-2xl font-extrabold text-rose-600">${holidayCount}</span>
                        <div class="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center text-xs"><i class="fa-solid fa-umbrella-beach"></i></div>
                    </div>
                </div>

                <div class="p-4 bg-white border border-slate-200/80 rounded-2xl shadow-sm flex flex-col justify-between h-24">
                    <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Jadwal Ujian Penting</span>
                    <div class="flex items-end justify-between">
                        <span class="text-2xl font-extrabold text-purple-600">${examCount}</span>
                        <div class="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center text-xs"><i class="fa-solid fa-file-pen"></i></div>
                    </div>
                </div>

                <div class="p-4 bg-white border border-slate-200/80 rounded-2xl shadow-sm flex flex-col justify-between h-24">
                    <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Kegiatan & Rapat</span>
                    <div class="flex items-end justify-between">
                        <span class="text-2xl font-extrabold text-emerald-600">${activityCount}</span>
                        <div class="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-xs"><i class="fa-solid fa-bullhorn"></i></div>
                    </div>
                </div>
            </div>

            <!-- Calendar Main Card -->
            <div class="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm space-y-6">
                <!-- Navigation & Controls -->
                <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                    <!-- Month & Year Selector -->
                    <div class="flex items-center space-x-3">
                        <div class="flex items-center space-x-1 bg-slate-100 p-1 rounded-2xl border border-slate-200/60">
                            <button type="button" onclick="window.changeCalendarMonth(-1)" class="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-white text-slate-700 hover:shadow-sm transition cursor-pointer" title="Bulan Sebelumnya">
                                <i class="fa-solid fa-chevron-left text-xs"></i>
                            </button>
                            <button type="button" onclick="window.resetCalendarToday()" class="px-3.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-white rounded-xl hover:shadow-sm transition cursor-pointer">
                                Hari Ini
                            </button>
                            <button type="button" onclick="window.changeCalendarMonth(1)" class="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-white text-slate-700 hover:shadow-sm transition cursor-pointer" title="Bulan Selanjutnya">
                                <i class="fa-solid fa-chevron-right text-xs"></i>
                            </button>
                        </div>

                        <div class="flex items-center space-x-2">
                            <select onchange="window.setCalendarMonth(this.value)" class="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer">
                                ${monthNames.map((m, idx) => `<option value="${idx}" ${idx === currMonth ? 'selected' : ''}>${m}</option>`).join('')}
                            </select>
                            <select onchange="window.setCalendarYear(this.value)" class="px-3 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer">
                                ${[2024, 2025, 2026, 2027, 2028].map(y => `<option value="${y}" ${y === currYear ? 'selected' : ''}>${y}</option>`).join('')}
                            </select>
                        </div>
                    </div>

                    <!-- Category Filter Chips -->
                    <div class="flex items-center flex-wrap gap-2">
                        <button type="button" onclick="window.filterCalendarCategory('all')" class="px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${activeCategory === 'all' ? 'bg-slate-900 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}">
                            Semua Event
                        </button>
                        <button type="button" onclick="window.filterCalendarCategory('libur')" class="px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${activeCategory === 'libur' ? 'bg-rose-600 text-white shadow-sm' : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200/60'}">
                            <i class="fa-solid fa-umbrella-beach mr-1"></i> Hari Libur
                        </button>
                        <button type="button" onclick="window.filterCalendarCategory('ujian')" class="px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${activeCategory === 'ujian' ? 'bg-purple-600 text-white shadow-sm' : 'bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200/60'}">
                            <i class="fa-solid fa-file-pen mr-1"></i> Jadwal Ujian
                        </button>
                        <button type="button" onclick="window.filterCalendarCategory('kegiatan')" class="px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${activeCategory === 'kegiatan' ? 'bg-emerald-600 text-white shadow-sm' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200/60'}">
                            <i class="fa-solid fa-bullhorn mr-1"></i> Kegiatan
                        </button>
                        <button type="button" onclick="window.filterCalendarCategory('rapat')" class="px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${activeCategory === 'rapat' ? 'bg-amber-600 text-white shadow-sm' : 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200/60'}">
                            <i class="fa-solid fa-users mr-1"></i> Rapat Guru
                        </button>
                    </div>
                </div>

                <!-- Calendar Month Grid -->
                <div class="overflow-x-auto">
                    <div class="min-w-[700px]">
                        <!-- Days Header -->
                        <div class="grid grid-cols-7 text-center font-bold text-xs uppercase tracking-wider py-2 bg-slate-50 border border-slate-200/80 rounded-t-2xl text-slate-600">
                            <div class="text-rose-600 py-1">Minggu</div>
                            <div class="py-1">Senin</div>
                            <div class="py-1">Selasa</div>
                            <div class="py-1">Rabu</div>
                            <div class="py-1">Kamis</div>
                            <div class="py-1">Jumat</div>
                            <div class="py-1 text-emerald-700">Sabtu</div>
                        </div>

                        <!-- Days Cells Grid -->
                        <div class="grid grid-cols-7 border-l border-r border-b border-slate-200/80 rounded-b-2xl bg-slate-100/40 divide-x divide-y divide-slate-200/80">
                            ${(() => {
                                let gridHTML = '';
                                const totalCells = Math.ceil((firstDayIndex + daysInMonth) / 7) * 7;

                                for (let i = 0; i < totalCells; i++) {
                                    let dateNum = 0;
                                    let cellClass = "min-h-[110px] p-2 bg-white flex flex-col justify-between transition hover:bg-slate-50/80 relative";
                                    let isCurrentMonthCell = false;
                                    let cellDateStr = "";

                                    if (i < firstDayIndex) {
                                        // Previous month filler
                                        dateNum = prevMonthDays - firstDayIndex + i + 1;
                                        cellClass = "min-h-[110px] p-2 bg-slate-50/50 text-slate-300 opacity-60";
                                        const pMonth = currMonth === 0 ? 11 : currMonth - 1;
                                        const pYear = currMonth === 0 ? currYear - 1 : currYear;
                                        cellDateStr = `${pYear}-${String(pMonth + 1).padStart(2, '0')}-${String(dateNum).padStart(2, '0')}`;
                                    } else if (i >= firstDayIndex + daysInMonth) {
                                        // Next month filler
                                        dateNum = i - (firstDayIndex + daysInMonth) + 1;
                                        cellClass = "min-h-[110px] p-2 bg-slate-50/50 text-slate-300 opacity-60";
                                        const nMonth = currMonth === 11 ? 0 : currMonth + 1;
                                        const nYear = currMonth === 11 ? currYear + 1 : currYear;
                                        cellDateStr = `${nYear}-${String(nMonth + 1).padStart(2, '0')}-${String(dateNum).padStart(2, '0')}`;
                                    } else {
                                        // Current month day
                                        dateNum = i - firstDayIndex + 1;
                                        isCurrentMonthCell = true;
                                        cellDateStr = `${currYear}-${String(currMonth + 1).padStart(2, '0')}-${String(dateNum).padStart(2, '0')}`;
                                    }

                                    const isToday = cellDateStr === todayStr;
                                    const dayOfWeek = i % 7; // 0 = Sunday
                                    const isSunday = dayOfWeek === 0;

                                    // Find events for this cell date
                                    const dayEvents = events.filter(e => {
                                        if (!e.startDate) return false;
                                        const start = e.startDate;
                                        const end = e.endDate || e.startDate;
                                        return cellDateStr >= start && cellDateStr <= end;
                                    }).filter(e => {
                                        if (activeCategory === 'all') return true;
                                        if (activeCategory === 'libur') return e.isHoliday || e.category === 'Hari Libur';
                                        if (activeCategory === 'ujian') return e.isExam || e.category === 'Jadwal Ujian';
                                        if (activeCategory === 'kegiatan') return !e.isHoliday && !e.isExam && e.category === 'Kegiatan Madrasah';
                                        if (activeCategory === 'rapat') return e.category === 'Rapat Guru';
                                        return true;
                                    });

                                    let dayBadgeDots = '';
                                    let eventsMarkup = '';

                                    if (dayEvents.length > 0) {
                                        eventsMarkup = dayEvents.slice(0, 3).map(ev => {
                                            let bgStyle = 'bg-slate-100 text-slate-800 border-slate-200';
                                            let icon = 'fa-calendar';

                                            if (ev.isHoliday || ev.category === 'Hari Libur') {
                                                bgStyle = 'bg-rose-100 text-rose-800 border-rose-200 hover:bg-rose-200';
                                                icon = 'fa-umbrella-beach';
                                            } else if (ev.isExam || ev.category === 'Jadwal Ujian') {
                                                bgStyle = 'bg-purple-100 text-purple-800 border-purple-200 hover:bg-purple-200';
                                                icon = 'fa-file-pen';
                                            } else if (ev.category === 'Rapat Guru') {
                                                bgStyle = 'bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-200';
                                                icon = 'fa-users';
                                            } else {
                                                bgStyle = 'bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-200';
                                                icon = 'fa-bullhorn';
                                            }

                                            return `
                                                <div onclick="event.stopPropagation(); window.showCalendarEventDetailModal('${ev.id}')" 
                                                     class="${bgStyle} border text-[10px] font-bold px-1.5 py-0.5 rounded-lg truncate cursor-pointer transition flex items-center space-x-1" 
                                                     title="${ev.title}">
                                                    <i class="fa-solid ${icon} text-[9px] shrink-0"></i>
                                                    <span class="truncate">${ev.title}</span>
                                                </div>
                                            `;
                                        }).join('');

                                        if (dayEvents.length > 3) {
                                            eventsMarkup += `<div class="text-[9px] font-bold text-slate-400 pl-1">+${dayEvents.length - 3} agenda lain</div>`;
                                        }
                                    }

                                    gridHTML += `
                                        <div class="${cellClass} ${isCurrentMonthCell ? 'cursor-pointer' : ''}" 
                                             ${isCurrentMonthCell && isAdmin ? `onclick="window.showAddCalendarEventModal('${cellDateStr}')"` : ''}>
                                            <div class="flex items-center justify-between">
                                                <span class="text-xs font-bold ${isToday ? 'w-6 h-6 bg-emerald-600 text-white rounded-full flex items-center justify-center shadow-sm' : (isSunday ? 'text-rose-600 font-extrabold' : 'text-slate-700')}">
                                                    ${dateNum}
                                                </span>
                                                ${isToday ? `<span class="text-[9px] font-bold text-emerald-600 uppercase tracking-wider hidden sm:inline">Hari Ini</span>` : ''}
                                            </div>

                                            <div class="space-y-1 mt-1.5 flex-1 overflow-hidden">
                                                ${eventsMarkup}
                                            </div>
                                        </div>
                                    `;
                                }
                                return gridHTML;
                            })()}
                        </div>
                    </div>
                </div>
            </div>

            <!-- Agenda List View Section -->
            <div class="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm space-y-4">
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h2 class="text-base font-bold text-slate-800 flex items-center gap-2">
                            <i class="fa-solid fa-list-check text-emerald-600"></i>
                            <span>Daftar Agenda & Hari Libur</span>
                        </h2>
                        <p class="text-xs text-slate-400">Rincian seluruh jadwal kegiatan, libur nasional, dan masa ujian madrasah</p>
                    </div>

                    <div class="flex items-center space-x-3">
                        <div class="relative w-full sm:w-64">
                            <i class="fa-solid fa-magnifying-glass absolute left-3.5 top-3 text-slate-400 text-xs"></i>
                            <input type="text" value="${window._calendarSearchQuery || ''}" oninput="window.handleCalendarSearch(this.value)" placeholder="Cari nama agenda / libur..." class="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none">
                        </div>
                    </div>
                </div>

                <!-- Event Cards List -->
                ${filteredEvents.length === 0 ? `
                    <div class="p-10 text-center border-2 border-dashed border-slate-200 rounded-2xl space-y-2">
                        <div class="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto text-xl">
                            <i class="fa-solid fa-calendar-xmark"></i>
                        </div>
                        <p class="text-xs font-bold text-slate-600">Tidak ada agenda atau hari libur yang ditemukan</p>
                        <p class="text-[11px] text-slate-400">Coba ubah kata kunci pencarian atau filter kategori di atas.</p>
                    </div>
                ` : `
                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        ${filteredEvents.map(ev => {
                            let badgeBg = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                            let icon = 'fa-bullhorn';

                            if (ev.isHoliday || ev.category === 'Hari Libur') {
                                badgeBg = 'bg-rose-50 text-rose-700 border-rose-200';
                                icon = 'fa-umbrella-beach';
                            } else if (ev.isExam || ev.category === 'Jadwal Ujian') {
                                badgeBg = 'bg-purple-50 text-purple-700 border-purple-200';
                                icon = 'fa-file-pen';
                            } else if (ev.category === 'Rapat Guru') {
                                badgeBg = 'bg-amber-50 text-amber-700 border-amber-200';
                                icon = 'fa-users';
                            }

                            const isMultiDay = ev.startDate && ev.endDate && ev.startDate !== ev.endDate;
                            const formatDate = (dateStr) => {
                                if (!dateStr) return '-';
                                const d = new Date(dateStr);
                                return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
                            };

                            const dateDisplay = isMultiDay 
                                ? `${formatDate(ev.startDate)} &ndash; ${formatDate(ev.endDate)}`
                                : formatDate(ev.startDate);

                            return `
                                <div class="p-4 bg-slate-50/70 border border-slate-200/80 hover:border-slate-300 rounded-2xl shadow-sm transition space-y-3 flex flex-col justify-between group">
                                    <div class="space-y-2">
                                        <div class="flex items-center justify-between">
                                            <span class="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg border ${badgeBg} flex items-center gap-1.5">
                                                <i class="fa-solid ${icon}"></i> ${ev.category || 'Kegiatan'}
                                            </span>
                                            ${ev.isHoliday ? `<span class="text-[9px] font-bold text-rose-600 bg-rose-100/80 px-2 py-0.5 rounded-full">Libur</span>` : ''}
                                        </div>

                                        <h3 class="text-sm font-bold text-slate-800 leading-snug group-hover:text-emerald-700 transition">
                                            ${ev.title}
                                        </h3>

                                        <p class="text-xs text-slate-500 leading-relaxed line-clamp-2">
                                            ${ev.description || 'Tidak ada deskripsi tambahan.'}
                                        </p>
                                    </div>

                                    <div class="pt-3 border-t border-slate-200/60 flex items-center justify-between text-xs">
                                        <div class="flex items-center space-x-1.5 text-slate-600 font-semibold text-[11px]">
                                            <i class="fa-regular fa-clock text-slate-400"></i>
                                            <span>${dateDisplay}</span>
                                        </div>

                                        <div class="flex items-center space-x-1">
                                            <button type="button" onclick="window.showCalendarEventDetailModal('${ev.id}')" class="p-1.5 hover:bg-slate-200 rounded-lg text-slate-600 transition" title="Rincian">
                                                <i class="fa-solid fa-circle-info text-xs"></i>
                                            </button>
                                            ${isAdmin ? `
                                            <button type="button" onclick="window.showAddCalendarEventModal('', '${ev.id}')" class="p-1.5 hover:bg-blue-100 text-blue-600 rounded-lg transition" title="Edit">
                                                <i class="fa-solid fa-pen-to-square text-xs"></i>
                                            </button>
                                            <button type="button" onclick="window.deleteCalendarEvent('${ev.id}')" class="p-1.5 hover:bg-rose-100 text-rose-600 rounded-lg transition" title="Hapus">
                                                <i class="fa-solid fa-trash-can text-xs"></i>
                                            </button>
                                            ` : ''}
                                        </div>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                `}
            </div>
        </div>
    `;
}

/**
 * Handle month changes (-1 or +1)
 */
export function changeCalendarMonth(delta) {
    let m = window._currentCalendarMonth + delta;
    let y = window._currentCalendarYear;
    if (m < 0) {
        m = 11;
        y -= 1;
    } else if (m > 11) {
        m = 0;
        y += 1;
    }
    window._currentCalendarMonth = m;
    window._currentCalendarYear = y;
    refreshCalendarView();
}

export function setCalendarMonth(val) {
    window._currentCalendarMonth = parseInt(val, 10);
    refreshCalendarView();
}

export function setCalendarYear(val) {
    window._currentCalendarYear = parseInt(val, 10);
    refreshCalendarView();
}

export function resetCalendarToday() {
    window._currentCalendarYear = new Date().getFullYear();
    window._currentCalendarMonth = new Date().getMonth();
    refreshCalendarView();
}

export function filterCalendarCategory(cat) {
    window._currentCalendarCategoryFilter = cat;
    refreshCalendarView();
}

export function handleCalendarSearch(query) {
    window._calendarSearchQuery = query;
    refreshCalendarView();
}

function refreshCalendarView() {
    const container = document.getElementById('view-container');
    if (container && window.appState?.currentRoute === 'kalender') {
        renderCalendarModule(container);
    }
}

/**
 * Open Modal to Add or Edit Calendar Event
 */
export function showAddCalendarEventModal(defaultDate = '', editId = null) {
    const events = getCalendarEvents();
    let existing = null;
    if (editId) {
        existing = events.find(e => String(e.id) === String(editId));
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const initialDate = existing?.startDate || defaultDate || todayStr;
    const initialEndDate = existing?.endDate || initialDate;

    const modalHTML = `
        <div id="calendar-event-modal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
            <div class="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
                <div class="p-6 bg-slate-900 text-white flex items-center justify-between">
                    <div class="flex items-center space-x-3">
                        <div class="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white text-lg font-bold shadow-md">
                            <i class="fa-solid fa-calendar-plus"></i>
                        </div>
                        <div>
                            <h3 class="font-extrabold text-sm text-white">${existing ? 'Edit Agenda / Hari Libur' : 'Tambah Agenda / Hari Libur Baru'}</h3>
                            <p class="text-xs text-slate-300">Konfigurasi jadwal kegiatan atau hari libur madrasah</p>
                        </div>
                    </div>
                    <button type="button" onclick="document.getElementById('calendar-event-modal')?.remove()" class="text-slate-400 hover:text-white p-2 rounded-xl">
                        <i class="fa-solid fa-xmark text-lg"></i>
                    </button>
                </div>

                <form onsubmit="window.handleSaveCalendarEventSubmit(event, '${editId || ''}')" class="p-6 space-y-4 overflow-y-auto">
                    <div class="space-y-1.5">
                        <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider">Judul Agenda / Hari Libur <span class="text-rose-500">*</span></label>
                        <input type="text" id="cal-event-title" required value="${existing?.title || ''}" placeholder="Cth: Ujian Akhir Semester Ganjil / Hari Libur Nasional" class="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-semibold focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none">
                    </div>

                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div class="space-y-1.5">
                            <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider">Kategori Event</label>
                            <select id="cal-event-category" class="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500">
                                <option value="Hari Libur" ${existing?.category === 'Hari Libur' ? 'selected' : ''}>Hari Libur</option>
                                <option value="Jadwal Ujian" ${existing?.category === 'Jadwal Ujian' ? 'selected' : ''}>Jadwal Ujian</option>
                                <option value="Kegiatan Madrasah" ${existing?.category === 'Kegiatan Madrasah' || !existing ? 'selected' : ''}>Kegiatan Madrasah</option>
                                <option value="Rapat Guru" ${existing?.category === 'Rapat Guru' ? 'selected' : ''}>Rapat Guru</option>
                            </select>
                        </div>

                        <div class="space-y-1.5">
                            <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider">Warna Tag</label>
                            <select id="cal-event-color" class="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500">
                                <option value="#ef4444" ${existing?.color === '#ef4444' ? 'selected' : ''}>Merah (Libur Nasional)</option>
                                <option value="#8b5cf6" ${existing?.color === '#8b5cf6' ? 'selected' : ''}>Ungu (Jadwal Ujian)</option>
                                <option value="#10b981" ${existing?.color === '#10b981' || !existing ? 'selected' : ''}>Hijau (Kegiatan Madrasah)</option>
                                <option value="#f59e0b" ${existing?.color === '#f59e0b' ? 'selected' : ''}>Kuning/Amber (Rapat)</option>
                                <option value="#06b6d4" ${existing?.color === '#06b6d4' ? 'selected' : ''}>Biru/Cyan (Pengumuman)</option>
                            </select>
                        </div>
                    </div>

                    <div class="p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-2">
                        <p class="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Atribut Penanda Spesifik</p>
                        <div class="flex items-center space-x-6">
                            <label class="flex items-center space-x-2 cursor-pointer">
                                <input type="checkbox" id="cal-is-holiday" ${existing?.isHoliday ? 'checked' : ''} class="w-4 h-4 text-rose-600 rounded focus:ring-rose-500">
                                <span class="text-xs font-bold text-slate-700">Hari Libur (Merah)</span>
                            </label>
                            <label class="flex items-center space-x-2 cursor-pointer">
                                <input type="checkbox" id="cal-is-exam" ${existing?.isExam ? 'checked' : ''} class="w-4 h-4 text-purple-600 rounded focus:ring-purple-500">
                                <span class="text-xs font-bold text-slate-700">Jadwal Ujian CBT</span>
                            </label>
                        </div>
                    </div>

                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div class="space-y-1.5">
                            <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider">Tanggal Mulai <span class="text-rose-500">*</span></label>
                            <input type="date" id="cal-start-date" required value="${initialDate}" class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none">
                        </div>

                        <div class="space-y-1.5">
                            <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider">Tanggal Selesai</label>
                            <input type="date" id="cal-end-date" value="${initialEndDate}" class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none">
                        </div>
                    </div>

                    <div class="space-y-1.5">
                        <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider">Deskripsi / Catatan Tambahan</label>
                        <textarea id="cal-event-desc" rows="3" placeholder="Informasi rincian mengenai kegiatan, sasaran kelas, atau instruksi libur..." class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none">${existing?.description || ''}</textarea>
                    </div>

                    <div class="pt-4 border-t border-slate-100 flex items-center justify-end space-x-3">
                        <button type="button" onclick="document.getElementById('calendar-event-modal')?.remove()" class="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-2xl transition cursor-pointer">
                            Batal
                        </button>
                        <button type="submit" class="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs rounded-2xl shadow-md shadow-emerald-600/20 transition cursor-pointer flex items-center gap-2">
                            <i class="fa-solid fa-check text-xs"></i>
                            <span>Simpan Agenda</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    `;

    const oldModal = document.getElementById('calendar-event-modal');
    if (oldModal) oldModal.remove();

    const div = document.createElement('div');
    div.innerHTML = modalHTML;
    document.body.appendChild(div.firstElementChild);
}

/**
 * Save Submit Handler
 */
export function handleSaveCalendarEventSubmit(e, editId) {
    e.preventDefault();

    const title = document.getElementById('cal-event-title')?.value.trim();
    const category = document.getElementById('cal-event-category')?.value;
    const color = document.getElementById('cal-event-color')?.value;
    const isHoliday = document.getElementById('cal-is-holiday')?.checked || false;
    const isExam = document.getElementById('cal-is-exam')?.checked || false;
    const startDate = document.getElementById('cal-start-date')?.value;
    const endDate = document.getElementById('cal-end-date')?.value || startDate;
    const description = document.getElementById('cal-event-desc')?.value.trim();

    if (!title || !startDate) {
        if (window.showToast) window.showToast('Judul dan tanggal mulai wajib diisi!', 'error');
        return;
    }

    const events = getCalendarEvents();

    if (editId) {
        const idx = events.findIndex(item => String(item.id) === String(editId));
        if (idx !== -1) {
            events[idx] = {
                ...events[idx],
                title,
                category,
                type: isHoliday ? 'libur' : (isExam ? 'ujian' : 'kegiatan'),
                isHoliday,
                isExam,
                startDate,
                endDate,
                color,
                description,
                updated_at: new Date().toISOString()
            };
        }
    } else {
        const newObj = {
            id: 'CAL-' + Date.now(),
            title,
            category,
            type: isHoliday ? 'libur' : (isExam ? 'ujian' : 'kegiatan'),
            isHoliday,
            isExam,
            startDate,
            endDate,
            color,
            description,
            created_at: new Date().toISOString()
        };
        events.push(newObj);
    }

    window.appState.calendarEvents = events;
    if (typeof window.saveState === 'function') {
        window.saveState('calendarEvents');
    }

    document.getElementById('calendar-event-modal')?.remove();
    if (window.showToast) {
        window.showToast(editId ? 'Agenda berhasil diperbarui!' : 'Agenda baru berhasil ditambahkan!', 'success');
    }

    refreshCalendarView();
}

/**
 * Delete Event Handler
 */
export function deleteCalendarEvent(eventId) {
    if (!eventId) return;

    const action = async () => {
        const events = getCalendarEvents().filter(e => String(e.id) !== String(eventId));
        window.appState.calendarEvents = events;
        if (typeof window.saveState === 'function') {
            window.saveState('calendarEvents');
        }
        try {
            const response = await fetch(`/api/calendar-events/${encodeURIComponent(eventId)}`, { method: 'DELETE' });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
        } catch (err) {
            console.warn('Gagal menghapus agenda di server:', err);
        }
        if (window.showToast) window.showToast('Agenda berhasil dihapus!', 'success');
        refreshCalendarView();
    };

    if (typeof window.showConfirmModal === 'function') {
        window.showConfirmModal('Apakah Anda yakin ingin menghapus agenda / hari libur ini?', action);
    } else {
        if (confirm('Apakah Anda yakin ingin menghapus agenda ini?')) {
            action();
        }
    }
}

/**
 * Show Calendar Event Detail Modal
 */
export function showCalendarEventDetailModal(eventId) {
    const events = getCalendarEvents();
    const ev = events.find(e => String(e.id) === String(eventId));
    if (!ev) return;

    const role = String(window.appState?.role || '').toLowerCase().trim();
    const isAdmin = role === 'admin';

    let badgeBg = 'bg-emerald-50 text-emerald-700 border-emerald-200';
    let icon = 'fa-bullhorn';

    if (ev.isHoliday || ev.category === 'Hari Libur') {
        badgeBg = 'bg-rose-50 text-rose-700 border-rose-200';
        icon = 'fa-umbrella-beach';
    } else if (ev.isExam || ev.category === 'Jadwal Ujian') {
        badgeBg = 'bg-purple-50 text-purple-700 border-purple-200';
        icon = 'fa-file-pen';
    } else if (ev.category === 'Rapat Guru') {
        badgeBg = 'bg-amber-50 text-amber-700 border-amber-200';
        icon = 'fa-users';
    }

    const formatDate = (dateStr) => {
        if (!dateStr) return '-';
        const d = new Date(dateStr);
        return d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    };

    const isMultiDay = ev.startDate && ev.endDate && ev.startDate !== ev.endDate;

    const modalHTML = `
        <div id="calendar-detail-modal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
            <div class="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden flex flex-col">
                <div class="p-6 bg-slate-900 text-white flex items-center justify-between">
                    <span class="text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-lg border ${badgeBg} flex items-center gap-1.5">
                        <i class="fa-solid ${icon}"></i> ${ev.category || 'Kegiatan'}
                    </span>
                    <button type="button" onclick="document.getElementById('calendar-detail-modal')?.remove()" class="text-slate-400 hover:text-white p-2 rounded-xl">
                        <i class="fa-solid fa-xmark text-lg"></i>
                    </button>
                </div>

                <div class="p-6 space-y-4">
                    <div>
                        <h3 class="text-lg font-extrabold text-slate-800 leading-snug">${ev.title}</h3>
                        ${ev.isHoliday ? `<span class="inline-block mt-1 text-[10px] font-bold text-rose-600 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-md">Hari Libur Resmi</span>` : ''}
                    </div>

                    <div class="p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-2">
                        <div class="flex items-center space-x-2 text-xs font-semibold text-slate-700">
                            <i class="fa-regular fa-calendar-days text-emerald-600 text-sm"></i>
                            <span>${formatDate(ev.startDate)}</span>
                        </div>
                        ${isMultiDay ? `
                        <div class="flex items-center space-x-2 text-xs font-semibold text-slate-700 pl-5">
                            <span class="text-slate-400 font-bold">sampai:</span>
                            <span>${formatDate(ev.endDate)}</span>
                        </div>
                        ` : ''}
                    </div>

                    <div class="space-y-1">
                        <p class="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Deskripsi / Rincian</p>
                        <p class="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100">
                            ${ev.description || 'Tidak ada deskripsi rincian untuk agenda ini.'}
                        </p>
                    </div>

                    <div class="pt-4 border-t border-slate-100 flex items-center justify-between">
                        <button type="button" onclick="document.getElementById('calendar-detail-modal')?.remove()" class="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition">
                            Tutup
                        </button>

                        ${isAdmin ? `
                        <div class="flex items-center space-x-2">
                            <button type="button" onclick="document.getElementById('calendar-detail-modal')?.remove(); window.showAddCalendarEventModal('', '${ev.id}')" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center gap-1.5">
                                <i class="fa-solid fa-pen-to-square text-xs"></i> <span>Edit</span>
                            </button>
                            <button type="button" onclick="document.getElementById('calendar-detail-modal')?.remove(); window.deleteCalendarEvent('${ev.id}')" class="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center gap-1.5">
                                <i class="fa-solid fa-trash-can text-xs"></i> <span>Hapus</span>
                            </button>
                        </div>
                        ` : ''}
                    </div>
                </div>
            </div>
        </div>
    `;

    const oldModal = document.getElementById('calendar-detail-modal');
    if (oldModal) oldModal.remove();

    const div = document.createElement('div');
    div.innerHTML = modalHTML;
    document.body.appendChild(div.firstElementChild);
}

/**
 * Dashboard Widget HTML Generator for Upcoming Calendar Events
 */
export function renderDashboardCalendarWidget() {
    const events = getCalendarEvents();
    const todayStr = new Date().toISOString().split('T')[0];

    // Get upcoming events
    const upcoming = events.filter(e => (e.endDate || e.startDate) >= todayStr)
        .sort((a, b) => (a.startDate || '').localeCompare(b.startDate || ''))
        .slice(0, 4);

    if (upcoming.length === 0) {
        return `
            <div class="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl text-center space-y-1">
                <p class="text-xs font-bold text-slate-600">Belum ada agenda terdekat</p>
                <p class="text-[10px] text-slate-400">Seluruh kegiatan madrasah terpantau aman.</p>
            </div>
        `;
    }

    return upcoming.map(ev => {
        let badgeBg = 'bg-emerald-50 text-emerald-700 border-emerald-200';
        let icon = 'fa-bullhorn';

        if (ev.isHoliday || ev.category === 'Hari Libur') {
            badgeBg = 'bg-rose-50 text-rose-700 border-rose-200';
            icon = 'fa-umbrella-beach';
        } else if (ev.isExam || ev.category === 'Jadwal Ujian') {
            badgeBg = 'bg-purple-50 text-purple-700 border-purple-200';
            icon = 'fa-file-pen';
        } else if (ev.category === 'Rapat Guru') {
            badgeBg = 'bg-amber-50 text-amber-700 border-amber-200';
            icon = 'fa-users';
        }

        const formatDate = (dateStr) => {
            if (!dateStr) return '';
            const d = new Date(dateStr);
            return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
        };

        return `
            <div onclick="window.showCalendarEventDetailModal('${ev.id}')" class="p-3 bg-slate-50 hover:bg-slate-100 border border-slate-200/80 rounded-2xl transition cursor-pointer flex items-center justify-between">
                <div class="flex items-center space-x-3 min-w-0 pr-2">
                    <div class="w-8 h-8 rounded-xl ${badgeBg} border flex items-center justify-center shrink-0 text-xs">
                        <i class="fa-solid ${icon}"></i>
                    </div>
                    <div class="min-w-0">
                        <p class="text-xs font-bold text-slate-800 truncate">${ev.title}</p>
                        <p class="text-[10px] text-slate-400 font-medium">${ev.category || 'Agenda'}</p>
                    </div>
                </div>

                <div class="shrink-0 text-right">
                    <span class="text-[10px] font-bold text-slate-700 bg-white px-2 py-1 rounded-lg border border-slate-200 shadow-2xs">
                        ${formatDate(ev.startDate)}
                    </span>
                </div>
            </div>
        `;
    }).join('');
}

export function openDownloadCalendarPdfModal() {
    const defaultDinas = "KEMENTERIAN AGAMA REPUBLIK INDONESIA";
    const defaultKantor = "KANTOR KEMENTERIAN AGAMA KOTA SURABAYA";
    const defaultMadrasah = window.appState?.schoolName || "MTs AL-AZHAR SURABAYA";
    const defaultAlamat = "Jl. Veteran No. 12, Surabaya, Telp (031) 123456, Email: info@mtsalazhar.sch.id";
    const defaultTahun = "2026/2027";
    const defaultTempat = "Surabaya";
    
    // Reset logos state
    window._pdfLogoKiriBase64 = window._pdfLogoKiriBase64 || "";
    window._pdfLogoKananBase64 = window._pdfLogoKananBase64 || "";

    // Get formatted date today
    const dToday = new Date();
    const formattedToday = dToday.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

    const modalHTML = `
        <div id="calendar-pdf-modal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
            <div class="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
                <!-- Header -->
                <div class="p-6 bg-slate-900 text-white flex items-center justify-between">
                    <div class="flex items-center space-x-3">
                        <div class="w-10 h-10 rounded-xl bg-rose-600 flex items-center justify-center text-white text-lg font-bold shadow-md">
                            <i class="fa-solid fa-file-pdf"></i>
                        </div>
                        <div>
                            <h3 class="font-extrabold text-sm text-white">Cetak & Unduh Kalender Akademik PDF</h3>
                            <p class="text-xs text-slate-300">Pengaturan kop surat, logo kanan-kiri, identitas madrasah, dan tanda tangan</p>
                        </div>
                    </div>
                    <button type="button" onclick="document.getElementById('calendar-pdf-modal')?.remove()" class="text-slate-400 hover:text-white p-2 rounded-xl">
                        <i class="fa-solid fa-xmark text-lg"></i>
                    </button>
                </div>

                <!-- Form -->
                <form onsubmit="window.generateCalendarPdfReport(event)" class="p-6 space-y-4 overflow-y-auto">
                    <!-- KOP SURAT SETTINGS -->
                    <div class="border border-slate-200 rounded-2xl p-4 bg-slate-50/50 space-y-3">
                        <p class="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-200 pb-1.5">
                            <i class="fa-solid fa-heading text-rose-600"></i>
                            <span>Pengaturan Kop Surat & Logo Cetak</span>
                        </p>
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div class="space-y-1">
                                <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Nama Instansi / Kementerian / Yayasan</label>
                                <input type="text" id="pdf-kop-dinas" required value="${defaultDinas}" class="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-rose-500">
                            </div>
                            <div class="space-y-1">
                                <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Nama Kantor / Wilayah Kerja</label>
                                <input type="text" id="pdf-kop-kantor" required value="${defaultKantor}" class="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-rose-500">
                            </div>
                        </div>
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div class="space-y-1">
                                <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Nama Madrasah / Sekolah</label>
                                <input type="text" id="pdf-kop-madrasah" required value="${defaultMadrasah}" class="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-rose-500">
                            </div>
                            <div class="space-y-1">
                                <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Alamat Lengkap & Kontak Madrasah</label>
                                <input type="text" id="pdf-kop-alamat" required value="${defaultAlamat}" class="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-rose-500">
                            </div>
                        </div>

                        <!-- Logo Kiri & Logo Kanan Upload -->
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                            <div class="space-y-1.5">
                                <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Logo Kiri Kop (Cth: Kemenag / Yayasan)</label>
                                <div class="flex items-center space-x-2">
                                    <input type="file" id="pdf-logo-kiri" accept="image/*" onchange="window.handlePdfLogoUpload(this, 'kiri')" class="hidden">
                                    <button type="button" onclick="document.getElementById('pdf-logo-kiri')?.click()" class="px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-[11px] font-bold flex items-center gap-1.5 cursor-pointer shadow-sm">
                                        <i class="fa-solid fa-image text-rose-600"></i>
                                        <span id="pdf-logo-kiri-label">Pilih Logo Kiri</span>
                                    </button>
                                    <div id="pdf-logo-kiri-preview" class="w-10 h-10 rounded-xl border border-slate-200 bg-white flex items-center justify-center text-slate-400 overflow-hidden shadow-sm p-0.5">
                                        ${window._pdfLogoKiriBase64 ? `<img src="${window._pdfLogoKiriBase64}" class="w-full h-full object-contain" />` : '<i class="fa-solid fa-image text-xs"></i>'}
                                    </div>
                                </div>
                            </div>
                            <div class="space-y-1.5">
                                <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Logo Kanan Kop (Cth: Sekolah / Madrasah)</label>
                                <div class="flex items-center space-x-2">
                                    <input type="file" id="pdf-logo-kanan" accept="image/*" onchange="window.handlePdfLogoUpload(this, 'kanan')" class="hidden">
                                    <button type="button" onclick="document.getElementById('pdf-logo-kanan')?.click()" class="px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-[11px] font-bold flex items-center gap-1.5 cursor-pointer shadow-sm">
                                        <i class="fa-solid fa-image text-emerald-600"></i>
                                        <span id="pdf-logo-kanan-label">Pilih Logo Kanan</span>
                                    </button>
                                    <div id="pdf-logo-kanan-preview" class="w-10 h-10 rounded-xl border border-slate-200 bg-white flex items-center justify-center text-slate-400 overflow-hidden shadow-sm p-0.5">
                                        ${window._pdfLogoKananBase64 ? `<img src="${window._pdfLogoKananBase64}" class="w-full h-full object-contain" />` : '<i class="fa-solid fa-image text-xs"></i>'}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- IDENTITAS DOKUMEN -->
                    <div class="border border-slate-200 rounded-2xl p-4 bg-slate-50/50 space-y-3">
                        <p class="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-200 pb-1.5">
                            <i class="fa-solid fa-file-invoice text-emerald-600"></i>
                            <span>Identitas Kalender</span>
                        </p>
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div class="space-y-1">
                                <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Tahun Pelajaran</label>
                                <input type="text" id="pdf-tahun-pelajaran" required value="${defaultTahun}" placeholder="Cth: 2026/2027" class="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-rose-500">
                            </div>
                            <div class="space-y-1">
                                <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Rentang Semester Yang Dicetak</label>
                                <select id="pdf-semester-rentang" class="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500">
                                    <option value="satu_tahun_kalender">Satu Tahun Berjalan (Januari - Desember)</option>
                                    <option value="ganjil">Semester Ganjil (Juli - Desember)</option>
                                    <option value="genap">Semester Genap (Januari - Juni)</option>
                                    <option value="satu_tahun">Satu Tahun Ajaran (Juli - Juni)</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <!-- PENGESAHAN & PENANDATANGAN -->
                    <div class="border border-slate-200 rounded-2xl p-4 bg-slate-50/50 space-y-3">
                        <p class="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-200 pb-1.5">
                            <i class="fa-solid fa-signature text-purple-600"></i>
                            <span>Pejabat Pengesahan (Tanda Tangan)</span>
                        </p>
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div class="space-y-1">
                                <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Tempat Penetapan</label>
                                <input type="text" id="pdf-tempat-penetapan" required value="${defaultTempat}" class="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-rose-500">
                            </div>
                            <div class="space-y-1">
                                <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Tanggal Penetapan</label>
                                <input type="text" id="pdf-tanggal-penetapan" required value="${formattedToday}" class="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-rose-500">
                            </div>
                        </div>

                        <!-- 2 Kolom Pejabat -->
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                            <!-- Kolom Kiri -->
                            <div class="p-3 bg-white border border-slate-200 rounded-xl space-y-2">
                                <span class="text-[9px] font-black uppercase text-slate-400 block border-b border-slate-100 pb-1">Pejabat Kiri (Penyusun)</span>
                                <div class="space-y-1.5">
                                    <label class="block text-[9px] font-semibold text-slate-500">Jabatan Pengesah Kiri</label>
                                    <input type="text" id="pdf-jabatan-kiri" required value="Kepala Urusan Tata Usaha" class="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold">
                                </div>
                                <div class="space-y-1.5">
                                    <label class="block text-[9px] font-semibold text-slate-500">Nama Lengkap & Gelar</label>
                                    <input type="text" id="pdf-nama-kiri" required value="Siti Nurhaliza, S.Pd." class="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold">
                                </div>
                                <div class="space-y-1.5">
                                    <label class="block text-[9px] font-semibold text-slate-500">NIP (Tulis '-' jika tidak ada)</label>
                                    <input type="text" id="pdf-nip-kiri" required value="198204122009032012" class="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold">
                                </div>
                            </div>

                            <!-- Kolom Kanan -->
                            <div class="p-3 bg-white border border-slate-200 rounded-xl space-y-2">
                                <span class="text-[9px] font-black uppercase text-slate-400 block border-b border-slate-100 pb-1">Pejabat Kanan (Penyetuju)</span>
                                <div class="space-y-1.5">
                                    <label class="block text-[9px] font-semibold text-slate-500">Jabatan Pengesah Kanan</label>
                                    <input type="text" id="pdf-jabatan-kanan" required value="Kepala Madrasah" class="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold">
                                </div>
                                <div class="space-y-1.5">
                                    <label class="block text-[9px] font-semibold text-slate-500">Nama Lengkap & Gelar</label>
                                    <input type="text" id="pdf-nama-kanan" required value="H. Ahmad Fauzi, M.Pd.I." class="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold">
                                </div>
                                <div class="space-y-1.5">
                                    <label class="block text-[9px] font-semibold text-slate-500">NIP (Tulis '-' jika tidak ada)</label>
                                    <input type="text" id="pdf-nip-kanan" required value="197508152000031002" class="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold">
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- BUTTONS -->
                    <div class="pt-4 border-t border-slate-100 flex items-center justify-end space-x-3">
                        <button type="button" onclick="document.getElementById('calendar-pdf-modal')?.remove()" class="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-2xl transition cursor-pointer">
                            Batal
                        </button>
                        <button type="submit" class="px-6 py-2.5 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-bold text-xs rounded-2xl shadow-md shadow-rose-600/20 transition cursor-pointer flex items-center gap-2">
                            <i class="fa-solid fa-print text-xs"></i>
                            <span>Cetak Sekarang (Print / PDF)</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    `;

    const oldModal = document.getElementById('calendar-pdf-modal');
    if (oldModal) oldModal.remove();

    const div = document.createElement('div');
    div.innerHTML = modalHTML;
    document.body.appendChild(div.firstElementChild);
}

// Logo upload handler helper
window.handlePdfLogoUpload = function(input, side) {
    if (input.files && input.files[0]) {
        const file = input.files[0];
        const reader = new FileReader();
        reader.onload = function(e) {
            const base64Str = e.target.result;
            if (side === 'kiri') {
                window._pdfLogoKiriBase64 = base64Str;
                const preview = document.getElementById('pdf-logo-kiri-preview');
                if (preview) preview.innerHTML = `<img src="${base64Str}" class="w-full h-full object-contain" />`;
                const label = document.getElementById('pdf-logo-kiri-label');
                if (label) label.textContent = "Logo Kiri Terunggah";
            } else {
                window._pdfLogoKananBase64 = base64Str;
                const preview = document.getElementById('pdf-logo-kanan-preview');
                if (preview) preview.innerHTML = `<img src="${base64Str}" class="w-full h-full object-contain" />`;
                const label = document.getElementById('pdf-logo-kanan-label');
                if (label) label.textContent = "Logo Kanan Terunggah";
            }
        };
        reader.readAsDataURL(file);
    }
};

export function generateCalendarPdfReport(event) {
    event.preventDefault();

    // Collect all input values
    const kopDinas = document.getElementById('pdf-kop-dinas')?.value || '';
    const kopKantor = document.getElementById('pdf-kop-kantor')?.value || '';
    const kopMadrasah = document.getElementById('pdf-kop-madrasah')?.value || '';
    const kopAlamat = document.getElementById('pdf-kop-alamat')?.value || '';
    const tahunPelajaran = document.getElementById('pdf-tahun-pelajaran')?.value || '';
    const semesterRentang = document.getElementById('pdf-semester-rentang')?.value || 'satu_tahun_kalender';
    const tempatPenetapan = document.getElementById('pdf-tempat-penetapan')?.value || '';
    const tanggalPenetapan = document.getElementById('pdf-tanggal-penetapan')?.value || '';
    const jabatanKiri = document.getElementById('pdf-jabatan-kiri')?.value || '';
    const namaKiri = document.getElementById('pdf-nama-kiri')?.value || '';
    const nipKiri = document.getElementById('pdf-nip-kiri')?.value || '';
    const jabatanKanan = document.getElementById('pdf-jabatan-kanan')?.value || '';
    const namaKanan = document.getElementById('pdf-nama-kanan')?.value || '';
    const nipKanan = document.getElementById('pdf-nip-kanan')?.value || '';

    // Retrieve uploaded logos from window context
    const logoKiri = window._pdfLogoKiriBase64 || '';
    const logoKanan = window._pdfLogoKananBase64 || '';

    // Remove form modal
    document.getElementById('calendar-pdf-modal')?.remove();

    // Get active calendar year
    const activeYear = window._currentCalendarYear || new Date().getFullYear();

    // Decide month range
    let monthRange = [];
    let semesterLabel = "";
    if (semesterRentang === 'ganjil') {
        semesterLabel = "GANJIL (JULI - DESEMBER)";
        monthRange = [
            { year: activeYear, month: 6 },  // Juli
            { year: activeYear, month: 7 },  // Agustus
            { year: activeYear, month: 8 },  // September
            { year: activeYear, month: 9 },  // Oktober
            { year: activeYear, month: 10 }, // November
            { year: activeYear, month: 11 }  // Desember
        ];
    } else if (semesterRentang === 'genap') {
        semesterLabel = "GENAP (JANUARI - JUNI)";
        monthRange = [
            { year: activeYear, month: 0 },  // Januari
            { year: activeYear, month: 1 },  // Februari
            { year: activeYear, month: 2 },  // Maret
            { year: activeYear, month: 3 },  // April
            { year: activeYear, month: 4 },  // Mei
            { year: activeYear, month: 5 }   // Juni
        ];
    } else if (semesterRentang === 'satu_tahun') {
        semesterLabel = "SATU TAHUN AJARAN (JULI - JUNI)";
        monthRange = [
            { year: activeYear, month: 6 },  // Juli
            { year: activeYear, month: 7 },  // Agustus
            { year: activeYear, month: 8 },  // September
            { year: activeYear, month: 9 },  // Oktober
            { year: activeYear, month: 10 }, // November
            { year: activeYear, month: 11 }, // Desember
            { year: activeYear + 1, month: 0 },  // Januari
            { year: activeYear + 1, month: 1 },  // Februari
            { year: activeYear + 1, month: 2 },  // Maret
            { year: activeYear + 1, month: 3 },  // April
            { year: activeYear + 1, month: 4 },  // Mei
            { year: activeYear + 1, month: 5 }   // Juni
        ];
    } else {
        // default to 'satu_tahun_kalender' (Januari - Desember)
        semesterLabel = "SATU TAHUN BERJALAN (JANUARI - DESEMBER)";
        monthRange = [
            { year: activeYear, month: 0 },  // Januari
            { year: activeYear, month: 1 },  // Februari
            { year: activeYear, month: 2 },  // Maret
            { year: activeYear, month: 3 },  // April
            { year: activeYear, month: 4 },  // Mei
            { year: activeYear, month: 5 },  // Juni
            { year: activeYear, month: 6 },  // Juli
            { year: activeYear, month: 7 },  // Agustus
            { year: activeYear, month: 8 },  // September
            { year: activeYear, month: 9 },  // Oktober
            { year: activeYear, month: 10 }, // November
            { year: activeYear, month: 11 }  // Desember
        ];
    }

    // Retrieve active events to map
    const events = getCalendarEvents();

    // Helper functions for drawing mini months
    const drawMonthHtml = (year, monthIdx) => {
        const monthNames = [
            "Januari", "Februari", "Maret", "April", "Mei", "Juni",
            "Juli", "Agustus", "September", "Oktober", "November", "Desember"
        ];
        const firstDayIdx = new Date(year, monthIdx, 1).getDay(); // 0 = Sunday
        const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();
        
        let html = `
        <div style="border: 1px solid #000; padding: 8px; background: #fff; page-break-inside: avoid; display: flex; flex-direction: column; justify-content: space-between;">
            <div style="text-align: center; font-weight: bold; font-size: 11px; text-transform: uppercase; margin-bottom: 6px; border-bottom: 1.5px solid #000; padding-bottom: 3px;">
                ${monthNames[monthIdx]} ${year}
            </div>
            <table style="width: 100%; border-collapse: collapse; font-size: 10px; text-align: center;">
                <thead>
                    <tr style="font-weight: bold; border-bottom: 1px solid #000;">
                        <th style="color: #ef4444; padding: 2px;">Mg</th>
                        <th style="padding: 2px;">Sn</th>
                        <th style="padding: 2px;">Sl</th>
                        <th style="padding: 2px;">Rb</th>
                        <th style="padding: 2px;">Km</th>
                        <th style="padding: 2px;">Jm</th>
                        <th style="padding: 2px; color: #047857;">Sb</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        let cellCount = 0;
        let rowHtml = '<tr>';
        
        for (let i = 0; i < firstDayIdx; i++) {
            rowHtml += '<td style="padding: 3px;"></td>';
            cellCount++;
        }
        
        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${year}-${String(monthIdx + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const isSunday = (cellCount % 7) === 0;
            
            const dayEvents = events.filter(ev => {
                const start = ev.startDate;
                const end = ev.endDate || ev.startDate;
                return dateStr >= start && dateStr <= end;
            });
            
            let isHighlighted = false;
            let borderStyle = '';
            let bgColor = '';
            let textColor = '';
            
            if (dayEvents.length > 0) {
                isHighlighted = true;
                const ev = dayEvents[0];
                borderStyle = 'border: 1px solid #000;';
                if (ev.isHoliday || ev.category === 'Hari Libur') {
                    bgColor = '#ff0000';
                    textColor = '#ffffff';
                } else if (ev.isExam || ev.category === 'Jadwal Ujian') {
                    bgColor = '#800080';
                    textColor = '#ffffff';
                } else if (ev.category === 'Rapat Guru') {
                    bgColor = '#ffa500';
                    textColor = '#000000';
                } else {
                    bgColor = '#008000';
                    textColor = '#ffffff';
                }
            }
            
            if (isSunday && !isHighlighted) {
                textColor = '#ff0000';
            }
            
            let contentStyle = `display: inline-block; width: 15px; height: 15px; line-height: 15px; text-align: center; font-weight: bold;`;
            if (bgColor) contentStyle += `background-color: ${bgColor};`;
            if (textColor) contentStyle += `color: ${textColor};`;
            if (borderStyle) contentStyle += borderStyle;
            if (bgColor || borderStyle) contentStyle += `border-radius: 50%;`;
            
            rowHtml += `<td style="padding: 2px 0;"><span style="${contentStyle}">${day}</span></td>`;
            cellCount++;
            
            if (cellCount % 7 === 0) {
                rowHtml += '</tr>';
                if (day < daysInMonth) {
                    rowHtml += '<tr>';
                }
            }
        }
        
        while (cellCount % 7 !== 0) {
            rowHtml += '<td style="padding: 3px;"></td>';
            cellCount++;
        }
        if (cellCount % 7 === 0 && !rowHtml.endsWith('</tr>')) {
            rowHtml += '</tr>';
        }
        
        html += rowHtml + `
                </tbody>
            </table>
        </div>
        `;
        return html;
    };

    // Filter events chronologically inside the selected months
    const filteredEventsForTable = events.filter(ev => {
        if (!ev.startDate) return false;
        const sMonth = parseInt(ev.startDate.substring(5, 7), 10) - 1;
        const sYear = parseInt(ev.startDate.substring(0, 4), 10);
        
        return monthRange.some(m => m.year === sYear && m.month === sMonth);
    }).sort((a, b) => (a.startDate || '').localeCompare(b.startDate || ''));

    // Build Table Rows
    const tableRowsHtml = filteredEventsForTable.map((ev, idx) => {
        const isMultiDay = ev.startDate && ev.endDate && ev.startDate !== ev.endDate;
        const formatDateText = (dateStr) => {
            if (!dateStr) return '-';
            const d = new Date(dateStr);
            return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
        };
        const dateDisplay = isMultiDay 
            ? `${formatDateText(ev.startDate)} s.d. ${formatDateText(ev.endDate)}`
            : formatDateText(ev.startDate);

        let markerColor = '#008000';
        if (ev.isHoliday || ev.category === 'Hari Libur') markerColor = '#ff0000';
        else if (ev.isExam || ev.category === 'Jadwal Ujian') markerColor = '#800080';
        else if (ev.category === 'Rapat Guru') markerColor = '#ffa500';

        return `
            <tr style="border-bottom: 1px solid #000;">
                <td style="border: 1px solid #000; padding: 5px; text-align: center;">${idx + 1}</td>
                <td style="border: 1px solid #000; padding: 5px; font-weight: bold;">${ev.title}</td>
                <td style="border: 1px solid #000; padding: 5px;">${dateDisplay}</td>
                <td style="border: 1px solid #000; padding: 5px; text-align: center;">
                    <span style="display: inline-block; width: 8px; height: 8px; background-color: ${markerColor}; border-radius: 50%; margin-right: 5px;"></span>
                    ${ev.category || 'Kegiatan'}
                </td>
            </tr>
        `;
    }).join('');

    // Generate month columns based on rentang semester ganjil / genap / satu tahun
    const columnsCount = (semesterRentang === 'satu_tahun' || semesterRentang === 'satu_tahun_kalender' || monthRange.length > 6) ? 4 : 3;
    const gridStyle = `display: grid; grid-template-columns: repeat(${columnsCount}, 1fr); gap: 10px; margin-top: 15px; margin-bottom: 20px;`;

    // Construct print html content
    const printableHtml = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Cetak Kalender Akademik - \${kopMadrasah}</title>
            <style>
                @media print {
                    @page {
                        size: A4 landscape;
                        margin: 1cm;
                    }
                    body {
                        background: #fff;
                        color: #000;
                        margin: 0;
                        padding: 0;
                        font-family: 'Arial', sans-serif;
                    }
                    .no-print {
                        display: none !important;
                    }
                }
                body {
                    margin: 20px;
                    background-color: #f8fafc;
                    font-family: 'Arial', sans-serif;
                }
                .sheet {
                    background: white;
                    padding: 24px;
                    border-radius: 8px;
                    box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
                    max-width: 1100px;
                    margin: 0 auto;
                }
                @media print {
                    .sheet {
                        box-shadow: none;
                        padding: 0;
                        max-width: 100%;
                    }
                }
            </style>
        </head>
        <body>
            <div class="no-print" style="max-width: 1100px; margin: 0 auto 15px auto; display: flex; justify-content: space-between; align-items: center; background: #1e293b; color: white; padding: 12px 20px; border-radius: 12px; font-family: sans-serif; font-size: 13px;">
                <span><b>Pratinjau Cetak Resmi:</b> Kalender Akademik Madrasah (Siap Cetak / Save to PDF)</span>
                <button onclick="window.print()" style="background: #2563eb; color: white; border: none; padding: 8px 16px; border-radius: 8px; font-weight: bold; cursor: pointer; display: flex; align-items: center; gap: 6px;">
                    🖨️ Cetak Sekarang / Simpan PDF
                </button>
            </div>

            <div class="sheet">
                <!-- KOP SURAT PEMERINTAH / YAYASAN -->
                <table style="width: 100%; border-collapse: collapse; border-bottom: 4px double #000; padding-bottom: 8px; margin-bottom: 15px;">
                    <tr>
                        <td style="width: 15%; text-align: left; vertical-align: middle; padding: 5px;">
                            ${logoKiri ? `<img src="${logoKiri}" style="max-height: 80px; max-width: 80px; object-fit: contain;" />` : ''}
                        </td>
                        <td style="width: 70%; text-align: center; vertical-align: middle; padding: 5px;">
                            <div style="font-size: 12px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px;">${kopDinas}</div>
                            <div style="font-size: 13px; font-weight: bold; text-transform: uppercase; margin: 2px 0;">${kopKantor}</div>
                            <div style="font-size: 18px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; color: #000;">${kopMadrasah}</div>
                            <div style="font-size: 9px; font-style: italic; color: #334155; margin-top: 3px;">${kopAlamat}</div>
                        </td>
                        <td style="width: 15%; text-align: right; vertical-align: middle; padding: 5px;">
                            ${logoKanan ? `<img src="${logoKanan}" style="max-height: 80px; max-width: 80px; object-fit: contain;" />` : ''}
                        </td>
                    </tr>
                </table>

                <!-- DOCUMENT TITLE -->
                <div style="text-align: center; margin-top: 10px; margin-bottom: 15px;">
                    <h2 style="font-size: 14px; font-weight: bold; text-transform: uppercase; margin: 0; padding: 0; letter-spacing: 0.5px;">KALENDER AKADEMIK MADRASAH</h2>
                    <h3 style="font-size: 11px; font-weight: bold; text-transform: uppercase; margin: 3px 0 0 0; color: #334155;">TAHUN PELAJARAN ${tahunPelajaran} &ndash; SEMESTER ${semesterLabel}</h3>
                </div>

                <!-- MONTHS GRID -->
                <div style="${gridStyle}">
                    ${monthRange.map(m => drawMonthHtml(m.year, m.month)).join('')}
                </div>

                <div style="display: flex; gap: 20px; align-items: flex-start; margin-top: 15px; page-break-inside: avoid;">
                    <!-- EVENTS TABLE -->
                    <div style="flex: 2; page-break-inside: avoid;">
                        <h4 style="font-size: 10px; font-weight: bold; text-transform: uppercase; border-bottom: 2px solid #000; margin: 0 0 8px 0; padding-bottom: 3px;">DAFTAR AGENDA & HARI LIBUR SEMESTER ${semesterLabel}</h4>
                        <table style="width: 100%; border-collapse: collapse; font-size: 9px;">
                            <thead>
                                <tr style="background-color: #f1f5f9; border-top: 1px solid #000; border-bottom: 1.5px solid #000;">
                                    <th style="border: 1px solid #000; padding: 4px; width: 30px; text-align: center;">No</th>
                                    <th style="border: 1px solid #000; padding: 4px; text-align: left;">Nama Agenda / Hari Libur</th>
                                    <th style="border: 1px solid #000; padding: 4px; text-align: left; width: 160px;">Tanggal Pelaksanaan</th>
                                    <th style="border: 1px solid #000; padding: 4px; text-align: center; width: 110px;">Kategori</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${tableRowsHtml || `<tr><td colspan="4" style="border: 1px solid #000; padding: 6px; text-align: center; font-style: italic; color: #475569;">Tidak ada kegiatan madrasah terjadwal pada semester ini.</td></tr>`}
                            </tbody>
                        </table>
                    </div>

                    <!-- COLOR LEGEND -->
                    <div style="flex: 0.6; border: 1px solid #000; padding: 8px; border-radius: 4px; font-size: 9px; background: #fff; page-break-inside: avoid;">
                        <h4 style="font-weight: bold; text-transform: uppercase; margin: 0 0 6px 0; padding-bottom: 2px; border-bottom: 1px solid #000;">Keterangan Warna</h4>
                        <div style="display: flex; flex-direction: column; gap: 4px;">
                            <div style="display: flex; align-items: center; gap: 6px;">
                                <span style="display: inline-block; width: 10px; height: 10px; background-color: #ff0000; border-radius: 50%;"></span>
                                <span><b>Hari Libur</b> (Merah)</span>
                            </div>
                            <div style="display: flex; align-items: center; gap: 6px;">
                                <span style="display: inline-block; width: 10px; height: 10px; background-color: #800080; border-radius: 50%;"></span>
                                <span><b>Jadwal Ujian</b> (Ungu)</span>
                            </div>
                            <div style="display: flex; align-items: center; gap: 6px;">
                                <span style="display: inline-block; width: 10px; height: 10px; background-color: #008000; border-radius: 50%;"></span>
                                <span><b>Kegiatan Madrasah</b> (Hijau)</span>
                            </div>
                            <div style="display: flex; align-items: center; gap: 6px;">
                                <span style="display: inline-block; width: 10px; height: 10px; background-color: #ffa500; border-radius: 50%;"></span>
                                <span><b>Rapat Guru</b> (Kuning/Amber)</span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- RATIFICATION SIGNATURE BLOCK -->
                <div style="margin-top: 25px; display: flex; justify-content: space-between; font-size: 10px; page-break-inside: avoid;">
                    <div style="width: 250px; text-align: center;">
                        <p style="margin: 0 0 40px 0;">Mengetahui,<br><b>${jabatanKiri}</b></p>
                        <p style="text-decoration: underline; font-weight: bold; margin: 0;">${namaKiri}</p>
                        <p style="margin: 2px 0 0 0;">NIP. ${nipKiri || '-'}</p>
                    </div>
                    <div style="width: 280px; text-align: center;">
                        <p style="margin: 0 0 40px 0;">Ditetapkan di: ${tempatPenetapan}<br>Pada Tanggal: ${tanggalPenetapan}<br><b>${jabatanKanan}</b></p>
                        <p style="text-decoration: underline; font-weight: bold; margin: 0;">${namaKanan}</p>
                        <p style="margin: 2px 0 0 0;">NIP. ${nipKanan || '-'}</p>
                    </div>
                </div>
            </div>
        </body>
        </html>
    `;

    // Open printing popup
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        if (window.showToast) window.showToast('Browser memblokir jendela popup baru! Izinkan popup untuk mencetak.', 'error');
        return;
    }

    printWindow.document.write(printableHtml);
    printWindow.document.close();
}

// Bind all exported functions to window for global invocation in inline HTML
if (typeof window !== 'undefined') {
    window.renderCalendarModule = renderCalendarModule;
    window.changeCalendarMonth = changeCalendarMonth;
    window.setCalendarMonth = setCalendarMonth;
    window.setCalendarYear = setCalendarYear;
    window.resetCalendarToday = resetCalendarToday;
    window.filterCalendarCategory = filterCalendarCategory;
    window.handleCalendarSearch = handleCalendarSearch;
    window.showAddCalendarEventModal = showAddCalendarEventModal;
    window.handleSaveCalendarEventSubmit = handleSaveCalendarEventSubmit;
    window.deleteCalendarEvent = deleteCalendarEvent;
    window.showCalendarEventDetailModal = showCalendarEventDetailModal;
    window.renderDashboardCalendarWidget = renderDashboardCalendarWidget;
    window.openDownloadCalendarPdfModal = openDownloadCalendarPdfModal;
    window.generateCalendarPdfReport = generateCalendarPdfReport;
}
