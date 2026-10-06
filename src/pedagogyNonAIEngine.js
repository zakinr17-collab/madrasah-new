// Pedagogy Non-AI Engine
// Standar Generator Perangkat Pembelajaran Berbasis Modul Ajar
// Kurikulum Merdeka & Profil Pelajar Pancasila

import { generateMasterV2ModulAjar, autoDetectMaterialType } from './masterGenerativeRulesEngine.js';

function removeModulPrefix(str) {
    if (!str) return "";
    return str
        .replace(/modul\s*ajar\s*/gi, '')
        .replace(/modul\s*(\d+)\s*:?/gi, 'Bab $1:')
        .replace(/\bmodul\b/gi, 'Materi')
        .replace(/\bModul\b/g, 'Materi')
        .trim();
}

function analyzeSubjectAndTopic(subjectName = '', topic = '', materiDetail = '') {
    const raw = `${subjectName} ${topic} ${materiDetail}`.toLowerCase();
    const cleanTopic = removeModulPrefix(topic) || subjectName || 'Materi Pembelajaran';

    // Koding AI / Informatika / Computer Science / System
    const kodingAiKeywords = [
        'koding', 'coding', 'ai', 'informatika', 'sistem komputer', 'komputer', 'single board', 'sbc', 
        'arduino', 'raspberry', 'mikrokontroler', 'microcontroller', 'sensor', 'actuator', 'unoardusim', 
        'ide arduino', 'led', 'iot', 'kecerdasan buatan', 'artificial intelligence', 'big data', 'cyber security', 
        'keamanan siber', 'algoritma', 'python', 'c++', 'pemrograman', 'program', 'papan sirkuit', 'mikroprosesor', 
        'memori', 'input/output', 'computational thinking', 'berpikir komputasional', 'tinkercad', 'pinmode', 'digitalwrite', 'delay'
    ];

    // Bahasa Arab
    const bahasaArabKeywords = [
        'bahasa arab', 'arab', 'nahwu', 'sharaf', 'hiwar', 'mufradat', 'qira\'ah', 'qirah', 'kitabah', 
        'kalam', 'istima', 'balaghat', 'tarjamah', 'lughah'
    ];

    // Procedural / Tata Cara / Ibadah Amaliah / Praktik
    const proceduralKeywords = [
        'shalat', 'sholat', 'wudhu', 'wudlu', 'zakat', 'puasa', 'shaum', 'haji', 'umrah', 'jenazah', 
        'qurban', 'kurban', 'aqiqah', 'akikah', 'taharah', 'thaharah', 'tayammum', 'adzan', 'iqamah', 
        'sujud', 'zikir', 'doa', 'tata cara', 'praktik', 'prosedur', 'langkah', 'teknik', 'cara kerja', 
        'perakitan', 'senam', 'atletik', 'renang', 'sepak bola', 'prakarya', 'instalasi', 'pengukuran'
    ];

    // Textual / Tajwid / Bahasa / Sastra
    const textualKeywords = [
        'tajwid', 'mad ', 'nun mati', 'mim mati', 'idgham', 'ikhfa', 'izhar', 'iqlab', 'waqaf',
        'surat', 'surah', 'ayat', 'hadis', 'hadits', 'tafsir', 'teks', 'puisi', 'cerpen', 'pantun', 
        'pidato', 'artikel', 'novel', 'paragraf', 'narasi', 'deskripsi', 'eksposisi', 'eksplanasi', 'persuasi',
        'kosakata', 'dialogue', 'grammar', 'reading', 'writing', 'listening', 'speaking'
    ];

    // Akidah / Moral / Karakter / Nilai
    const akidahMoralKeywords = [
        'akidah', 'aqidah', 'tauhid', 'asmaul husna', 'iman', 'malaikat', 'kitab', 'rasul', 'hari akhir', 
        'kiamat', 'qadha', 'qadar', 'takdir', 'akhlak', 'terpuji', 'mahmudah', 'tercela', 'mazmumah', 
        'ikhlas', 'sabar', 'syukur', 'tawadhu', 'husnuzhan', 'jujur', 'amanah', 'adil', 'ukhuwah', 
        'ghibah', 'fitnah', 'riya', 'hasad', 'dengki', 'sombong', 'takabur', 'namimah', 'etika', 'moral'
    ];

    // Sejarah / Sosial / PPKn / Geografi / Ekonomi
    const historicalSocialKeywords = [
        'sejarah', 'ski', 'kebudayaan islam', 'dakwah', 'khulafaur', 'rasyidin', 'umayyah', 'abbasiyah', 
        'usmani', 'uthmaniyah', 'walisongo', 'nusantara', 'perjuangan', 'kerajaan', 'proklamasi', 'kemerdekaan', 
        'sosiologi', 'interaksi sosial', 'stratifikasi', 'konflik', 'ekonomi', 'pasar', 'uang', 'perbankan', 
        'inflasi', 'perdagangan', 'geografi', 'peta', 'iklim', 'lingkungan sosial', 'ppkn', 'pancasila', 
        'uud', 'uud 1945', 'demokrasi', 'norma', 'hak asasi', 'ham', 'bhinneka', 'nkri'
    ];

    // Matematika / Sains / IPA / Fisika / Biologi / Kimia
    const mathScienceKeywords = [
        'rumus', 'aljabar', 'persamaan', 'pertidaksamaan', 'fungsi', 'geometri', 'trigonometri', 'kalkulus', 
        'peluang', 'matriks', 'vektor', 'statistika', 'aritmatika', 'bilangan', 'pecahan', 'sudut', 'luas', 'keliling',
        'fisika', 'gaya', 'gerak', 'energi', 'kalor', 'suhu', 'listrik', 'magnet', 'optik', 'cahaya', 'gelombang', 
        'bunyi', 'biologi', 'sel', 'jaringan', 'organ', 'fotosintesis', 'respirasi', 'ekosistem', 'rantai makanan', 
        'genetika', 'dna', 'metabolisme', 'kimia', 'atom', 'molekul', 'unsur', 'senyawa', 'reaksi', 'larutan', 
        'asam', 'basa', 'ph', 'stoikiometri', 'tata surya'
    ];

    let category = 'general';
    if (kodingAiKeywords.some(k => raw.includes(k))) {
        category = 'koding_ai';
    } else if (bahasaArabKeywords.some(k => raw.includes(k))) {
        category = 'bahasa_arab';
    } else if (proceduralKeywords.some(k => raw.includes(k))) {
        category = 'procedural';
    } else if (textualKeywords.some(k => raw.includes(k))) {
        category = 'textual';
    } else if (akidahMoralKeywords.some(k => raw.includes(k))) {
        category = 'akidah_moral';
    } else if (historicalSocialKeywords.some(k => raw.includes(k))) {
        category = 'historical_social';
    } else if (mathScienceKeywords.some(k => raw.includes(k))) {
        category = 'math_science';
    }

    let focusTitle1 = `Pengertian, Konsep Dasar, dan Landasan ${cleanTopic}`;
    let focusTitle2 = `Prinsip Pokok, Analisis Kaidah, dan Ruang Lingkup ${cleanTopic}`;
    let focusTitle3 = `Aplikasi Praktis, Evaluasi Kinerja, dan Refleksi Bermakna`;

    let subMateri1 = `Konsep dasar, batasan pengertian, dan dasar rujukan pokok materi ${cleanTopic}`;
    let subMateri2 = `Analisis mendalam komponen, hubungan fungsional, dan kasus pembelajaran pemecahan masalah ${cleanTopic}`;
    let subMateri3 = `Praktik unjuk kerja, asesmen sumatif, serta internalisasi nilai karakter dan kebermanfaatan hidup`;

    let caseStudyQuestions = [];
    let lkpdRows = [];

    if (category === 'koding_ai') {
        focusTitle1 = `Arsitektur Hardware, Komponen Sirkuit & Konsep Dasar ${cleanTopic}`;
        focusTitle2 = `Pemrograman, Simulasi & Algoritma Pengontrolan Perangkat ${cleanTopic}`;
        focusTitle3 = `Pengembangan Prototipe Hardware/Software, Pengujian & Keamanan Siber`;

        subMateri1 = `Analisis komponen Single Board Computer/Controller (SBC/SBCo), mikroprosesor, memori, I/O, serta berpikir komputasional pada ${cleanTopic}`;
        subMateri2 = `Pengembangan baris kode (C++/Python/Block), penggunaan simulator (UnoArduSim/Tinkercad), konfigurasi pin sensor, serta integrasi AI`;
        subMateri3 = `Perancangan prototipe produk IoT/Embedded System, pengujian fungsionalitas, dokumentasi kode, serta etika dan keamanan siber (Cyber Security)`;

        caseStudyQuestions = [
            `Jelaskan perbedaan mendasar antara Single Board Computer (SBC - contoh: Raspberry Pi) dengan Single Board Controller (SBCo - contoh: Arduino)! Pada kondisi seperti apa masing-masing perangkat tersebut paling efisien dan optimal diterapkan?`,
            `Dalam pemrograman Arduino untuk indikator lampu LED pada pin 13, perhatikan perintah 'delay(500)'. Jika nilai delay diubah dari 100 ms menjadi 500 ms, analisislah efek yang terjadi pada ritme siklus program dan jelaskan peran logika timing dalam control system!`,
            `Bagaimana algoritma penulisan sinyal kode SOS Morse (... --- ...) dapat diimplementasikan menggunakan fungsi digitalWrite(), pinMode(), dan delay() pada simulator UnoArduSim? Uraikan alur logikanya secara runtut!`,
            `Analisislah potensi ancaman keamanan siber (Cyber Security) pada integrasi perangkat IoT dan library Kecerdasan Buatan (Artificial Intelligence) di masyarakat modern, serta langkah preventif yang wajib diterapkan!`
        ];

        lkpdRows = [
            { col1: 'Spesifikasi & Komponen Hardware', col2: 'SBC, Mikrokontroler, Memory, & Port I/O', col3: 'Landasan fisik sistem embedded' },
            { col1: 'Sintaks & Struktur Kode Program', col2: 'pinMode(), digitalWrite(), delay(), & Void Loop', col3: 'Instruksi eksekusi perangkat lunak' },
            { col1: 'Simulasi Perangkat (UnoArduSim)', col2: 'Uji coba rangkaian sensor & indikator LED', col3: 'Validasi logika sebelum perakitan nyata' },
            { col1: 'Prototipe Aplikasi & Etika AI', col2: 'Rancangan solusi cerdas berbasis kebutuhan nyata', col3: 'Wujud inovasi & tanggung jawab siber' }
        ];
    } else if (category === 'bahasa_arab') {
        focusTitle1 = `Mufradat Kunci, Kaidah Nahwu/Sharaf, dan Struktur Kalimat ${cleanTopic}`;
        focusTitle2 = `Praktik Hiwar (Percakapan), Qira'ah (Membaca Teks), dan Fahmul Maqru'`;
        focusTitle3 = `Kitabah (Menulis), Tarjamah, dan Aplikasi Komunikasi Arab Komprehensif`;

        subMateri1 = `Penguasaan al-mufradat (kosakata), kaidah nahwu (tarkib), dan sharaf mendasar terkait topik ${cleanTopic}`;
        subMateri2 = `Keterampilan istima' (menyimak) dan kalam (bicara) melalui hiwar komunikatif serta pembacaan teks qira'ah berharakat`;
        subMateri3 = `Latihan kitabah (menulis kalimat/paragraf Arab), penerjemahan kontekstual, dan unjuk kerja komunikasi lisan/tulisan`;

        caseStudyQuestions = [
            `Analisislah penerapan kaidah Nahwu/Sharaf pada kalimat Bahasa Arab terkait ${cleanTopic}! Jelaskan posisi kata (I'rab) dan perubahan bentuk katanya!`,
            `Buatlah draf Hiwar (dialog percakapan Bahasa Arab) singkat antara 2 siswa yang membahas tentang ${cleanTopic} menggunakan mufradat dan ungkapan komunikatif yang tepat!`,
            `Bagaimana cara mengatasi kesulitan siswa dalam membedakan penggunaan dhamir (kata ganti) dan fi'il (kata kerja) saat menyusun kalimat Bahasa Arab?`,
            `Terjemahkan teks paragraf pendek Bahasa Arab seputar ${cleanTopic} ke dalam Bahasa Indonesia yang komunikatif dan sesuai konteks budaya!`
        ];

        lkpdRows = [
            { col1: 'Mufradat & Ungkapan Kunci', col2: 'Penguasaan kosakata dan makna kontekstual', col3: 'Fondasi perbendaharaan kata' },
            { col1: 'Kaidah Nahwu & Sharaf (Tarkib)', col2: 'Analisis struktur kalimat dan i\'rab', col3: 'Menjamin ketepatan tata bahasa' },
            { col1: 'Maharah Kalam & Qira\'ah', col2: 'Latihan membaca dan percakapan (hiwar)', col3: 'Meningkatkan kelancaran berkomunikasi' },
            { col1: 'Kitabah & Tarjamah', col2: 'Menulis paragraf Arab & penerjemahan', col3: 'Mewujudkan kecakapan literasi Arab' }
        ];
    } else if (category === 'procedural') {
        focusTitle1 = `Pengertian, Landasan Hukum, Syarat, dan Rukun ${cleanTopic}`;
        focusTitle2 = `Tata Cara Pelaksanaan Langkah demi Langkah dan Hal-Hal yang Membatalkan / Kesalahan Umum`;
        focusTitle3 = `Praktik Demonstrasi Nyata, Hikmah Pelaksanaan, dan Uji Kompetensi`;

        subMateri1 = `Ketentuan syariat/teori dasar, syarat sah, rukun utama, dan adab persiapan dalam ${cleanTopic}`;
        subMateri2 = `Alur urutan pelaksanaan secara tepat, hal yang membatalkan/merusak, serta alternatif kemudahan (rukhshah)`;
        subMateri3 = `Simulasi praktik langsung secara tertib dan khusyuk, penghayatan hikmah, serta evaluasi unjuk kerja`;

        caseStudyQuestions = [
            `Dalam pelaksanaan ${cleanTopic}, seseorang menghadapi situasi mendesak di mana salah satu syarat atau rukun pendukung tidak dapat dipenuhi secara sempurna karena kondisi darurat. Bagaimana tinjauan hukum dan solusi praktis yang tepat sesuai kaidah yang telah dipelajari?`,
            `Dua orang peserta didik berdiskusi mengenai urutan pelaksanaan ${cleanTopic}. Siswa pertama berpendapat bahwa urutan langkah bersifat fleksibel selama semua rukun terpenuhi, sedangkan siswa kedua menegaskan bahwa tertib urutan merupakan rukun yang mutlak. Analisislah argumentasi mana yang paling tepat beserta alasannya!`,
            `Bagaimana strategi pembiasaan yang efektif agar pelaksanaan ${cleanTopic} tidak sekadar menjadi rutinitas mekanis tanpa penghayatan, melainkan benar-benar membentuk karakter disiplin dan kesalehan pribadi?`,
            `Amatilah praktik ${cleanTopic} di masyarakat sekitar. Jelaskan salah satu kekeliruan umum yang sering dijumpai di lapangan dan berikan penjelasan edukatif yang santun untuk meluruskannya!`
        ];

        lkpdRows = [
            { col1: 'Syarat dan Ketentuan Sah', col2: 'Hal-hal yang wajib dipenuhi sebelum melaksanakan', col3: 'Menentukan keabsahan pelaksanaan' },
            { col1: 'Rukun dan Urutan Langkah', col2: 'Bagian inti pokok yang harus dikerjakan secara tertib', col3: 'Membentuk struktur amaliah yang sah' },
            { col1: 'Faktor Pembatal / Kekeliruan', col2: 'Tindakan atau kondisi yang merusak keabsahan', col3: 'Wajib dihindari atau diperbaiki' },
            { col1: 'Hikmah dan Nilai Karakter', col2: 'Dampak positif bagi ketenangan jiwa dan kedisiplinan', col3: 'Membentuk pribadi yang istiqamah' }
        ];
    } else if (category === 'textual') {
        focusTitle1 = `Kaidah Kebahasaan / Tajwid, Ciri Khusus, dan Struktur Teks ${cleanTopic}`;
        focusTitle2 = `Analisis Makna, Kosakata Kunci, dan Kandungan Nilai Esensial`;
        focusTitle3 = `Praktik Membaca Tartil / Menyusun Teks, Internalisasi Pesan, dan Asesmen`;

        subMateri1 = `Pengenalan lafal/teks, kaidah hukum bacaan/kebahasaan, dan struktur kalimat ${cleanTopic}`;
        subMateri2 = `Pembedahan makna per kata, asbabun nuzul/latar belakang teks, dan pesan utama yang terkandung`;
        subMateri3 = `Keterampilan melafalkan secara fasih/menulis teks komunikatif, serta refleksi pengamalan pesan moral`;

        caseStudyQuestions = [
            `Ketika membaca atau menelaah teks mengenai ${cleanTopic}, ditemukan perbedaan pelafalan atau penafsiran makna antar konteks kalimat. Bagaimana kaidah kebahasaan/tajwid membantu kita menentukan pembacaan dan pemaknaan yang paling tepat?`,
            `Jelaskan bagaimana pesan utama yang terkandung dalam bahasan ${cleanTopic} dapat dihubungkan dengan tantangan etika komunikasi generasi muda di media sosial saat ini!`,
            `Seorang peserta didik mampu melafalkan atau menghafal teks ${cleanTopic} dengan sangat baik, namun belum mencerminkan pesan nilai tersebut dalam tindakannya. Berikan analisis dan saran konstruktif agar penguasaan tekstual selaras dengan pengamalan kontekstual!`,
            `Buatlah telaah komparasi singkat antara makna tersurat (tekstual) dan makna tersirat (kontekstual) dari tema ${cleanTopic} dalam memecahkan persoalan kehidupan sehari-hari!`
        ];

        lkpdRows = [
            { col1: 'Kaidah / Hukum Dasar', col2: 'Aturan bacaan, struktur teks, atau tata bahasa baku', col3: 'Pedoman pembacaan/penulisan yang benar' },
            { col1: 'Kosakata / Istilah Kunci', col2: 'Kata-kata penting dan arti mendalamnya', col3: 'Kunci memahami pesan pokok teks' },
            { col1: 'Kandungan / Pesan Pokok', col2: 'Intisari ajaran dan arahan yang disampaikan teks', col3: 'Pedoman moral dan sikap hidup' },
            { col1: 'Aplikasi Komunikasi & Adab', col2: 'Penerapan pesan dalam tutur kata dan interaksi nyata', col3: 'Mewujudkan komunikasi santun dan berfaedah' }
        ];
    } else if (category === 'akidah_moral') {
        focusTitle1 = `Hakikat Makna, Landasan Dalil, dan Tingkatan ${cleanTopic}`;
        focusTitle2 = `Ciri-Ciri Indikator Sikap Positif, Dampak Baik vs Bahaya Sikap Tercela`;
        focusTitle3 = `Strategi Pembiasaan Karakter, Pemecahan Masalah Pergaulan, dan Uji Kompetensi`;

        subMateri1 = `Definisi konseptual, landasan dalil naqli/aqli, dan kedudukan ${cleanTopic} dalam pembinaan jiwa`;
        subMateri2 = `Identifikasi perilaku konkret sehari-hari, dampak positif bagi kedamaian batin, dan ancaman bahayanya jika diabaikan`;
        subMateri3 = `Latihan komitmen diri, penyelesaian dilema moral dalam pergaulan remaja, dan evaluasi capaian karakter`;

        caseStudyQuestions = [
            `Dalam pergaulan remaja, seseorang sering tergoda untuk mengorbankan nilai integritas demi mendapatkan penerimaan kelompok sebaya. Bagaimana nilai-nilai dalam ${cleanTopic} membimbing seseorang agar tetap teguh berkarakter mulia tanpa menjadi terkucilkan?`,
            `Bandingkan dampak jangka panjang antara seseorang yang mengedepankan prinsip ${cleanTopic} dengan orang yang bersikap oportunis dan mengabaikannya dalam lingkungan sekolah dan masyarakat!`,
            `Ketika menghadapi situasi yang menekan atau merugikan, bagaimana cara praktis mengendalikan respons emosional agar tetap mencerminkan akhlak terpuji sesuai materi yang dipelajari?`,
            `Berikan satu contoh nyata keteladanan tokoh masyarakat dalam menerapkan nilai ${cleanTopic} dan analisislah inspirasi yang dapat kita petik untuk kehidupan sehari-hari!`
        ];

        lkpdRows = [
            { col1: 'Konsep & Dalil Pokok', col2: 'Landasan wahyu dan pengertian nilai karakter', col3: 'Fondasi keyakinan dan prinsip hidup' },
            { col1: 'Ciri & Indikator Perilaku', col2: 'Bentuk tindakan nyata yang mencerminkan materi', col3: 'Tolok ukur keberhasilan internalisasi sikap' },
            { col1: 'Analisis Dilema Pergaulan', col2: 'Tantangan nyata di lingkungan dan solusinya', col3: 'Melatih pertimbangan etika yang bijaksana' },
            { col1: 'Lembar Komitmen Pembiasaan', col2: 'Rencana aksi nyata perbaikan diri dalam sepekan', col3: 'Membiasakan karakter mulia secara konsisten' }
        ];
    } else if (category === 'historical_social') {
        focusTitle1 = `Latar Belakang Historis, Kronologi Peristiwa, dan Setting Sosial ${cleanTopic}`;
        focusTitle2 = `Peran Tokoh Kunci, Faktor Keberhasilan / Tantangan, dan Dinamika Peradaban`;
        focusTitle3 = `Nilai Keteladanan (Ibrah), Analisis Komparasi Masa Kini, dan Evaluasi`;

        subMateri1 = `Latar belakang peristiwa, kronologi waktu, kondisi geografis/sosial, dan awal mula perkembangan ${cleanTopic}`;
        subMateri2 = `Strategi perjuangan, kepemimpinan tokoh, faktor pendorong kemajuan, serta tantangan yang dihadapi`;
        subMateri3 = `Pengambilan hikmah (ibrah), relevansi keteladanan masa lalu bagi generasi masa kini, dan asesmen pemahaman`;

        caseStudyQuestions = [
            `Analisislah faktor-faktor kunci yang melatarbelakangi keberhasilan strategi kepemimpinan dan perkembangan pada era ${cleanTopic}! Mengapa strategi tersebut mampu bertahan dan memberikan pengaruh luas?`,
            `Dalam dinamika sejarah ${cleanTopic}, tantangan internal maupun eksternal sering kali muncul. Bagaimana cara para tokoh saat itu mengatasi krisis tersebut dan nilai kepemimpinan apa yang dapat dipelajari?`,
            `Bagaimana kita dapat mengambil ibrah (pelajaran berharga) dari sejarah ${cleanTopic} untuk memperkuat rasa persatuan, toleransi, dan kemajuan bangsa di era global saat ini?`,
            `Jika Anda membandingkan tantangan sosial pada masa ${cleanTopic} dengan era digital sekarang, persamaan dan perbedaan mendasar apa yang Anda temukan dalam menjaga keharmonisan masyarakat?`
        ];

        lkpdRows = [
            { col1: 'Garis Waktu (Kronologi)', col2: 'Urutan peristiwa penting dan kurun waktu terjadinya', col3: 'Memetakan alur sejarah secara sistematis' },
            { col1: 'Tokoh & Peran Strategis', col2: 'Nama tokoh penggerak dan kontribusi nyatanya', col3: 'Meneladani dedikasi dan kepemimpinan' },
            { col1: 'Faktor Pendukung & Hambatan', col2: 'Kondisi sosial-politik yang memengaruhi peristiwa', col3: 'Menganalisis sebab-akibat dinamika sejarah' },
            { col1: 'Ibrah (Nilai Keteladanan)', col2: 'Pelajaran moral yang relevan untuk kehidupan masa kini', col3: 'Membangun wawasan kebangsaan dan moral' }
        ];
    } else if (category === 'math_science') {
        focusTitle1 = `Fenomena Alam / Masalah Nyata, Definisi Konsep, dan Struktur Rumus ${cleanTopic}`;
        focusTitle2 = `Pembuktian Konseptual, Langkah Prosedur Perhitungan / Eksperimen, dan Analisis Data`;
        focusTitle3 = `Aplikasi Pemecahan Masalah Nyata, Penemuan Solusi Teknologi, dan Evaluasi`;

        subMateri1 = `Pengamatan fenomena, definisi besaran/variabel, dan pemahaman konsep dasar rumus/hukum ilmiah ${cleanTopic}`;
        subMateri2 = `Langkah-langkah sistematis penyelesaian soal perhitungan atau alur eksperimen ilmiah yang teruji`;
        subMateri3 = `Penerapan konsep ${cleanTopic} dalam teknologi, kehidupan sehari-hari, serta uji kemampuan pemecahan masalah`;

        caseStudyQuestions = [
            `Diberikan suatu persoalan kontekstual yang melibatkan konsep ${cleanTopic}. Identifikasilah variabel-variabel yang diketahui, tentukan hubungan matematis/ilmiah yang berlaku, dan uraikan langkah penyelesaiannya secara sistematis!`,
            `Dalam suatu eksperimen atau perhitungan mengenai ${cleanTopic}, terjadi ketidaksesuaian antara hasil teoretis dengan data observasi. Analisislah faktor-faktor apa saja yang dapat menyebabkan penyimpangan tersebut dan bagaimana cara meminimalkannya!`,
            `Jelaskan bagaimana konsep ${cleanTopic} diterapkan dalam perkembangan teknologi modern atau pemecahan masalah lingkungan di sekitar kita!`,
            `Dua peserta didik menggunakan pendekatan rumus/metode yang berbeda untuk menyelesaikan soal ${cleanTopic}. Analisislah efektivitas kedua metode tersebut dan tentukan kondisi di mana masing-masing metode lebih tepat digunakan!`
        ];

        lkpdRows = [
            { col1: 'Identifikasi Masalah & Variabel', col2: 'Menemukan besaran/faktor kunci dari kasus nyata', col3: 'Fondasi analisis matematis/saintifik' },
            { col1: 'Kaidah Rumus / Hukum Ilmiah', col2: 'Prinsip ilmiah atau hubungan matematis yang berlaku', col3: 'Pedoman pemecahan masalah yang valid' },
            { col1: 'Langkah Perhitungan / Praktikum', col2: 'Prosedur bertahap dalam mengolah data', col3: 'Melatih ketelitian dan daya nalar logis' },
            { col1: 'Penerapan Teknologi & Kehidupan', col2: 'Contoh nyata pemanfaatan konsep di era modern', col3: 'Menumbuhkan kesadaran aplikasi sains' }
        ];
    } else {
        caseStudyQuestions = [
            `Dalam memahami materi ${cleanTopic}, terdapat berbagai sudut pandang mengenai cara terbaik mengaplikasikannya. Analisislah pandangan-pandangan tersebut dan rumuskan kesimpulan yang paling objektif dan aplikatif!`,
            `Bagaimana penguasaan konsep ${cleanTopic} dapat membantu peserta didik dalam berpikir kritis dan memecahkan persoalan praktis di lingkungan sekolah dan keluarga?`,
            `Jelaskan langkah-langkah konkret yang dapat diambil untuk memastikan materi ${cleanTopic} dipahami secara bermakna (meaningful learning) dan bukan sekadar hafalan singkat!`,
            `Berikan contoh penerapan prinsip ${cleanTopic} dalam menghadapi perkembangan teknologi informasi dan komunikasi di era saat ini!`
        ];

        lkpdRows = [
            { col1: 'Konsep & Istilah Utama', col2: 'Definisi dan cakupan materi yang dipelajari', col3: 'Fondasi pemahaman materi' },
            { col1: 'Analisis Hubungan & Ciri', col2: 'Karakteristik penting dan keterkaitan antar unsur', col3: 'Melatih daya nalar analitis' },
            { col1: 'Pemecahan Masalah Pemecahan Masalah', col2: 'Penerapan konsep pada situasi nyata', col3: 'Mengembangkan daya pikir kritis' },
            { col1: 'Refleksi & Rencana Tindak Lanjut', col2: 'Evaluasi kebermanfaatan materi bagi diri sendiri', col3: 'Membentuk sikap pembelajar sepanjang hayat' }
        ];
    }

    const schoolNameDefault = (category === 'koding_ai' || category === 'math_science' || category === 'historical_social' || category === 'general')
        ? 'SMA / SMK Negeri 1' 
        : 'Nama Sekolah';

    const curriculumHeader = (category === 'koding_ai' || category === 'math_science' || category === 'historical_social' || category === 'general')
        ? 'KURIKULUM MERDEKA NASIONAL'
        : (category === 'bahasa_arab' ? 'KURIKULUM MERDEKA MADRASAH' : 'KURIKULUM MERDEKA TERINTEGRASI Pancasila');

    const profilPelajar = (category === 'koding_ai' || category === 'math_science' || category === 'historical_social' || category === 'general')
        ? 'Profil Pelajar Pancasila (PPP)'
        : 'Profil Pelajar Pancasila (PPP) & Pelajar Rahmatan Lil \'Alamin (PRA)';

    const profilPelajarItems = category === 'koding_ai'
        ? '- Profil Pelajar Pancasila: Bernalar Kritis, Kreatif, Bergotong Royong, Mandiri, Berpikir Komputasional'
        : (category === 'bahasa_arab'
            ? '- Profil Pelajar Pancasila: Bernalar Kritis, Kebhinnekaan Global, Bergotong Royong\n- Profil Pelajar Rahmatan Lil \'Alamin: Ta\'addub, Tasamuh'
            : ((category === 'general' || category === 'math_science' || category === 'historical_social')
                ? '- Profil Pelajar Pancasila: Bernalar Kritis, Kreatif, Bergotong Royong, Mandiri, Berakhlak Mulia'
                : '- Profil Pelajar Pancasila: Bertakwa kepada Tuhan YME, Berakhlak Mulia, Bernalar Kritis, Bergotong Royong\n- Profil Pelajar Rahmatan Lil \'Alamin: Ta\'addub, Tawassuth, Tasamuh, Tathawwur wa Ibtikar'
            )
        );

    const sumberBelajar = category === 'koding_ai'
        ? 'Buku Teks Utama Informatika Kemendikbudristek Kelas XII, Simulator UnoArduSim, IDE Arduino, Modul Hardware & AI'
        : (category === 'bahasa_arab'
            ? 'Buku Teks Utama Bahasa Arab Kementerian Agama RI, Kamus Bahasa Arab, Media Audio-Visual'
            : ((category === 'general' || category === 'math_science' || category === 'historical_social')
                ? `Buku Teks Utama ${subjectName || cleanTopic} Kurikulum Merdeka Kemendikbudristek, Jurnal & Literatur Pendukung`
                : 'Buku Teks Utama PAI & Madrasah Kementerian Agama RI / Kemendikbudristek, Kitab Rujukan & Dalil Naqli'
            )
        );

    const glosariumText = category === 'koding_ai'
        ? `LAMPIRAN 2: GLOSARIUM
1. Algoritma (Algorithm) : Kumpulan instruksi terstruktur dan terbatas yang dapat diimplementasikan dalam bentuk program komputer untuk menyelesaikan masalah komputasi.
2. Arduino : Mikrokontroler papan tunggal (single board controller) bersifat open-source yang digunakan untuk mengontrol perangkat elektronik dan sensor.
3. Single Board Computer (SBC) : Komputer utuh yang dibangun pada satu papan sirkuit mencakup mikroprosesor, memori, slot I/O, dan sistem operasi (contoh: Raspberry Pi).
4. Single Board Controller : Papan sirkuit terpadu berbasis mikrokontroler khusus untuk mengontrol masukan (input sensor) dan keluaran (output actuator).
5. Integrated Development Environment (IDE) : Perangkat lunak aplikasi tempat programmer menulis, mengompilasi, dan mengunggah kode program (contoh: IDE Arduino).
6. UnoArduSim : Simulator perangkat lunak offline untuk menguji dan menganalisis eksekusi kode program C++ Arduino tanpa harus menyambungkan hardware fisik.
7. Kecerdasan Buatan (Artificial Intelligence) : Kemampuan sistem komputer untuk menirukan fungsi kecerdasan manusia seperti pembelajaran, pemrosesan data, dan pengambilan keputusan.
8. Keamanan Siber (Cyber Security) : Praktik dan prosedur teknis untuk melindungi komputer, jaringan, data, dan program dari akses atau serangan jahat tak terotorisasi.
9. Sensor : Komponen input elektronik yang mendeteksi perubahan fisik (suhu, cahaya, jarak) dan mengirimkan sinyal ke unit pengontrol.
10. Actuator : Komponen output yang mengubah sinyal kontrol dari mikrokontroler menjadi aksi fisik atau indikator (contoh: Lampu LED, Servo, Buzzer).`
        : (category === 'bahasa_arab'
            ? `LAMPIRAN 2: GLOSARIUM
1. Mufradat : Kosakata atau perbendaharaan kata dalam Bahasa Arab.
2. Hiwar : Dialog atau percakapan interaktif Bahasa Arab antar dua orang atau lebih.
3. Nahwu : Ilmu tata bahasa Arab yang mempelajari kedudukan kata dalam kalimat dan hukum I'rab (harakat akhir).
4. Sharaf : Ilmu tata bahasa Arab yang mempelajari perubahan bentuk kata (tasrif) dari kata dasar menjadi berbagai bentuk kata kerja dan kata benda.
5. Qira'ah : Keterampilan membaca, menelaah, dan memahami kandungan makna teks Bahasa Arab.
6. Kitabah : Keterampilan menulis huruf, kata, dan paragraf Bahasa Arab secara rapi dan akurat sesuai kaidah imla'.
7. Istima' : Keterampilan menyimak dan menangkap pesan audio Bahasa Arab.
8. Kalam : Keterampilan berbicara dan mengekspresikan gagasan secara lisan dalam Bahasa Arab.`
            : ((category === 'general' || category === 'math_science' || category === 'historical_social')
                ? `LAMPIRAN 2: GLOSARIUM
1. Konsep Utama : Definisi dasar dan pemahaman esensial tentang ${cleanTopic}.
2. Analisis : Proses mengurai komponen dan hubungan antar variabel pada ${cleanTopic}.
3. Pemecahan Masalah : Pendekatan pemecahan masalah kontekstual berbasis fenomena nyata.
4. Evaluasi : Penilaian tingkat keberhasilan dan ketercapaian tujuan pembelajaran ${cleanTopic}.`
                : `LAMPIRAN 2: GLOSARIUM
1. Dalil Naqli : Landasan hukum agama yang bersumber langsung dari Al-Qur'an dan Hadis Nabi.
2. Tawassuth : Sikap moderat, seimbang, dan tidak berlebih-lebihan dalam beragama dan bermasyarakat.
3. Tasamuh : Sikap toleran dan saling menghargai perbedaan antar sesama manusia.
4. Ta'addub : Perilaku beradab, berakhlak mulia, dan menjunjung tinggi norma kesopanan.`
            )
        );

    const daftarPustakaText = category === 'koding_ai'
        ? `LAMPIRAN 3: DAFTAR PUSTAKA
1. Kemendikbudristek. 2024. Buku Teks Utama Informatika Kelas XII. Jakarta: Pusat Kurikulum dan Perbukuan.
2. Rosch, Winn L. Hardware Bible, Fifth Edition.
3. Banzi, Massimo & Shiloh, Michael. Getting Started with Arduino.
4. Dokumentasi Resmi Simulator UnoArduSim & Python AI SDK.`
        : (category === 'bahasa_arab'
            ? `LAMPIRAN 3: DAFTAR PUSTAKA
1. Kementerian Agama RI. 2024. Buku Teks Utama Bahasa Arab Madrasah Aliyah.
2. Munawwir, Ahmad Warson. Kamus Al-Munawwir Arab-Indonesia.
3. Nuha, Ulin. Metodologi Pembelajaran Bahasa Arab.`
            : ((category === 'general' || category === 'math_science' || category === 'historical_social')
                ? `LAMPIRAN 3: DAFTAR PUSTAKA
1. Kemendikbudristek. 2024. Buku Teks Utama ${subjectName || cleanTopic} Kurikulum Merdeka.
2. Tim Penulis Akademis. Panduan Pembelajaran ${subjectName || cleanTopic}.
3. Jurnal Pendidikan & Riset Ilmiah ${subjectName || cleanTopic}.`
                : `LAMPIRAN 3: DAFTAR PUSTAKA
1. Kementerian Agama RI. 2024. Buku Teks PAI & Madrasah Aliyah.
2. Al-Qur'an dan Terjemahannya Kemenag RI.
3. An-Nawawi, Imam. Kitab Arba'in An-Nawawiyah.`
            )
        );

    return {
        category,
        cleanTopic,
        focusTitle1,
        focusTitle2,
        focusTitle3,
        subMateri1,
        subMateri2,
        subMateri3,
        caseStudyQuestions,
        lkpdRows,
        schoolNameDefault,
        curriculumHeader,
        profilPelajar,
        profilPelajarItems,
        sumberBelajar,
        glosariumText,
        daftarPustakaText
    };
}

// Generate comprehensive Modul Ajar Standard Data (Clean formatting, no excessive dashes, context-sensitive)
function getComprehensiveModulAjarStandardData(params = {}) {
    let subjectName, topic, materiDetail, grade, semester, model, babUtama, subbab, jenisMateri, schoolName, teacherName, alokasiWaktu, variationNonce;
    if (typeof params === 'object' && params !== null && !Array.isArray(params) && (params.subjectName !== undefined || params.topic !== undefined || params.grade !== undefined)) {
        subjectName = params.subjectName;
        topic = params.topic;
        materiDetail = params.materiDetail;
        grade = params.grade;
        semester = params.semester || '1';
        model = params.model || 'Deep Learning';
        babUtama = params.babUtama || params.bab || topic;
        subbab = params.subbab || topic;
        jenisMateri = params.jenisMateri || params.jenis || 'OTOMATIS';
        schoolName = params.schoolName;
        teacherName = params.teacherName;
        alokasiWaktu = params.alokasiWaktu || params.alokasi;
        variationNonce = params.variationNonce;
    } else {
        subjectName = arguments[0];
        topic = arguments[1];
        grade = arguments[2];
        semester = arguments[3] || '1';
        materiDetail = arguments[4] || '';
        model = arguments[5] || 'Deep Learning';
        babUtama = topic;
        subbab = topic;
        jenisMateri = 'OTOMATIS';
        alokasiWaktu = '4 JP';
        variationNonce = Date.now() + Math.floor(Math.random() * 10000);
    }

    const safeSubject = subjectName || 'Koding dan AI';
    const safeTopic = topic || 'Materi Utama Pembelajaran';
    const safeGrade = grade || 'VIII';

    const analysis = analyzeSubjectAndTopic(safeSubject, safeTopic, materiDetail);

    // Call Master V2 Engine
    const v2Data = generateMasterV2ModulAjar({
        schoolName: schoolName || (params && params.schoolName) || analysis.schoolNameDefault,
        teacherName: teacherName || 'Tim Guru Pengajar, S.Pd.',
        subjectName: safeSubject,
        phase: safeGrade.includes('X') ? 'E' : (safeGrade.includes('XI') || safeGrade.includes('XII') ? 'F' : 'D'),
        grade: safeGrade,
        semester: semester,
        babUtama: babUtama || safeTopic,
        subbab: subbab || safeTopic,
        materiInti: materiDetail || safeTopic,
        alokasiWaktu: alokasiWaktu || '4 JP',
        jenisMateri: jenisMateri || 'OTOMATIS',
        modelPembelajaran: model || 'Deep Learning',
        variationNonce: variationNonce !== undefined ? variationNonce : (Date.now() + Math.floor(Math.random() * 10000))
    });

    return v2Data;
}

function getComprehensiveModulAjarStandardDataLegacy(params = {}) {
    let subjectName, topic, materiDetail, grade, semester, model;
    if (typeof params === 'object' && params !== null && !Array.isArray(params) && (params.subjectName !== undefined || params.topic !== undefined || params.grade !== undefined)) {
        subjectName = params.subjectName;
        topic = params.topic;
        materiDetail = params.materiDetail;
        grade = params.grade;
        semester = params.semester || '1';
        model = params.model || 'Deep Learning';
    } else {
        subjectName = arguments[0];
        topic = arguments[1];
        grade = arguments[2];
        semester = arguments[3] || '1';
        materiDetail = arguments[4] || '';
        model = arguments[5] || 'Deep Learning';
    }

    const safeSubject = subjectName || 'Mata Pelajaran';
    const safeTopic = topic || 'Materi Utama Pembelajaran';
    const safeGrade = grade || 'VII MTs';
    const safeModel = model === 'Deep Learning' ? 'Deep Learning (Mindful, Meaningful, Joyful Learning)' : (model || 'Discovery Learning dan Problem Based Learning');

    const analysis = analyzeSubjectAndTopic(safeSubject, safeTopic, materiDetail);
    const t = analysis.cleanTopic;
    const sName = (params && params.schoolName) ? params.schoolName : analysis.schoolNameDefault;

    return {
        identitasModul: `MODUL AJAR ${analysis.curriculumHeader}
FASE D / E / F - KELAS ${safeGrade.toUpperCase()}
MATA PELAJARAN : ${safeSubject.toUpperCase()}

INFORMASI UMUM
A. IDENTITAS MODUL
Nama Instansi : ${sName}
Nama Penyusun : Tim Guru Pengajar, S.Pd.
Mata Pelajaran : ${safeSubject}
Fase / Kelas / Semester : Fase D/E/F - ${safeGrade} / Semester ${semester}
Elemen / Topik : ${t}
Alokasi Waktu : 3 Pertemuan x (2 x 40 menit) = 6 Jam Pelajaran (JP)
Tahun Penyusunan : 2025 / 2026

CAPAIAN PEMBELAJARAN (CP) FASE:
Pada akhir fase ini, peserta didik memiliki kemampuan memahami, menganalisis, menginternalisasi, serta mengomunikasikan prinsip dasar, kaidah keilmuan, dan penerapan kontekstual materi ${t}. Peserta didik dibekali kecakapan berpikir kritis, keterampilan kolaboratif, serta kematangan budi pekerti untuk memecahkan permasalahan nyata secara mandiri, bijak, dan bertanggung jawab.

TABEL ELEMEN DAN CAPAIAN PEMBELAJARAN ELEMEN:
1. Elemen Pemahaman Konseptual:
   Peserta didik mampu menjelaskan, mengidentifikasi, dan menganalisis konsep kunci, landasan teori/hukum, serta ruang lingkup pembahasan materi ${t} secara utuh dan terstruktur.
2. Elemen Penalaran Kritis & Unjuk Kerja:
   Peserta didik mampu menerapkan prosedur kerja, memecahkan persoalan kasus pembelajaran, menghubungkan materi dengan fenomena kehidupan sehari-hari, serta menyajikan hasil telaah secara komunikatif dan sistematis.`,

        kompetensiAwal: `B. KOMPETENSI AWAL
1. Kedudukan dan Urgensi Materi:
   Materi ${t} memiliki peran penting dalam membangun fondasi keilmuan dan keterampilan praktis peserta didik. Penguasaan terhadap materi ini menjadi prasyarat esensial dalam menumbuhkan pola pikir ilmiah, kepribadian yang tertib, serta kecakapan hidup.
2. Integrasi Pengetahuan dan Tindakan Nyata:
   Pembelajaran ${t} memadukan penguasaan landasan konseptual dengan keterampilan aplikatif. Peserta didik dibimbing untuk tidak sekadar menghafal definisi, melainkan mampu menalar alur logika, mengevaluasi fakta di lapangan, dan mengambil tindakan yang tepat.
3. Pertanyaan Eksploratif Awal:
   - Apa pengertian mendasar dan prinsip utama dari ${t}?
   - Bagaimana alur tahapan atau kaidah penting yang harus diperhatikan dalam ${t}?
   - Apa saja faktor keberhasilan, kendala umum, atau hal yang perlu diantisipasi dalam penerapannya?
   - Bagaimana cara mengaplikasikan nilai-nilai dan keahlian materi ini dalam kehidupan sehari-hari?${materiDetail ? `\n\nFokus Tambahan Guru:\n${materiDetail}` : ''}`,

        profilPancasila: `C. PROFIL PELAJAR & PENDEKATAN PROFIL PELAJAR PANCASILA
${analysis.profilPelajarItems}

Prinsip Pendekatan Profil Pelajar Pancasila:
1. Mindful Learning: Menumbuhkan kesadaran penuh, empati, dan kehadiran utuh dalam menyerap keilmuan.
2. Meaningful Learning: Mengaitkan setiap prinsip materi dengan nilai kebermanfaatan nyata bagi diri dan lingkungan.
3. Joyful Learning: Menciptakan suasana belajar yang positif, menginspirasi, dan memotivasi partisipasi aktif.`,

        saranaPrasarana: `D. SARANA DAN PRASARANA
1. Media Pembelajaran: Komputer / Laptop, LCD Proyektor, Jaringan Internet, Slide Presentasi Interaktif, Video Pembelajaran Kontekstual, dan Papan Tulis.
2. Sumber Belajar: ${analysis.sumberBelajar}.
3. Lingkungan Belajar: Ruang kelas yang nyaman, bersih, sirkulasi udara baik, serta fleksibel untuk formasi diskusi kelompok.`,

        targetPeserta: `E. TARGET PESERTA DIDIK
1. Peserta Didik Reguler / Tipikal: Mampu mengikuti alur pembelajaran umum tanpa hambatan kognitif yang berarti.
2. Peserta Didik dengan Hambatan Belajar: Membutuhkan pendampingan terfokus, penyederhanaan instruksi bertahap (scaffolding), serta bantuan tutor sebaya.
3. Peserta Didik Pencapaian Tinggi (Cerdas Berbakat): Memiliki kecepatan belajar di atas rata-rata dan diberikan tugas pengayaan kasus pembelajaran HOTS mendalam.`,

        modelPembelajaran: `F. MODEL DAN METODE PEMBELAJARAN
- Pendekatan: Profil Pelajar Pancasila dan Pembelajaran Berdiferensiasi (Konten, Proses, dan Produk).
- Model Pembelajaran: ${safeModel}.
- Metode Pembelajaran: Ceramah Interaktif, Diskusi Kelompok, Tanya Jawab Reflektif, Analisis Kasus Kontekstual, Penugasan LKPD, dan Presentasi Hasil.`,

        tujuanPembelajaran: `KOMPETENSI INTI
A. TUJUAN PEMBELAJARAN
Setelah mengikuti proses pembelajaran yang terpadu dan menyenangkan, peserta didik diharapkan mampu:
1. Menjelaskan pengertian, landasan pokok, serta ruang lingkup materi ${t} secara tepat dan komprehensif.
2. Menganalisis karakteristik, alur tahapan, atau kaidah penting yang berlaku dalam ${t} dengan daya nalar kritis.
3. Mendemonstrasikan keterampilan praktis atau prosedur pemecahan masalah terkait ${t} secara tertib dan sistematis.
4. Membandingkan fenomena nyata di lingkungan sekitar dengan prinsip-prinsip ideal materi ${t}.
5. Menyelesaikan persoalan kasus pembelajaran yang menantang dengan merumuskan solusi alternatif yang logis dan etis.
6. Mempresentasikan hasil diskusi kelompok secara komunikatif, percaya diri, dan santun.
7. Menginternalisasi nilai-nilai Profil Pelajar Pancasila dan Pelajar Rahmatan Lil 'Alamin dalam kehidupan sehari-hari.`,

        pemahamanBermakna: `B. PEMAHAMAN BERMAKNA
1. Penguasaan terhadap ${t} membekali peserta didik dengan kerangka berpikir yang kokoh dan aplikatif.
2. Pemahaman yang mendalam bukan sekadar menghafal istilah, melainkan mengerti alasan di balik setiap prinsip dan cara menjalankannya secara tepat.
3. Keterampilan menganalisis materi ini menumbuhkan ketelitian, kebiasaan berpikir runtut, serta rasa tanggung jawab dalam mengambil keputusan.
4. Pembelajaran ${t} melatih kepekaan sosial dan komitmen untuk memberikan kontribusi positif di tengah masyarakat.`,

        pertanyaanPemantik: `C. PERTANYAAN PEMANTIK
1. Mengapa materi ${t} penting untuk kita pelajari dan bagaimana pengaruhnya dalam rutinitas kehidupan kita?
2. Bagaimana jadinya jika seseorang atau suatu sistem tidak menerapkan prinsip-prinsip ${t} dengan benar?
3. Apa tantangan terbesar yang sering dihadapi dalam mengaplikasikan materi ini di kehidupan nyata?
4. Pernahkah kalian mengamati kejadian di sekitar kalian yang berkaitan langsung dengan materi ini? Apa hikmah yang dapat dipetik?`,

        persiapanPembelajaran: `PERSIAPAN PEMBELAJARAN
1. Guru menyusun lembar Modul Ajar, memeriksa perangkat presentasi multimedia, dan menggandakan instrumen LKPD.
2. Guru memetakan kesiapan awal peserta didik melalui pertanyaan apersepsi diagnostik non-kognitif dan kognitif.
3. Guru mengatur formasi tempat duduk kelas agar kondusif untuk interaksi kolaboratif dan suasana belajar yang penuh perhatian (mindful learning).`,

        kegiatanPembelajaran: analysis.category === 'bahasa_arab' ? `D. KEGIATAN PEMBELAJARAN (STRUKTUR BUKU TEKS BAHASA ARAB / NAHWU MADRASAH & Pancasila)

1. PETA KONSEP MODUL (خريطة المفاهيم)
   - القراءة (Qira'ah - Membaca Teks Berharakat)
   - فهم المقروء (Fahmul Maqru' - Pemahaman Wacana)
   - القواعد (Al-Qawa'id - Nahwu/Sharaf & Tarkib Gramatikal)
   - التمرينات (At-Tadribat - Latihan & Asesmen Terpadu A - G)

2. AL-MUFRADAT & AL-MUSTHALAHAT AL-JADIDAH (المفردات والمصطلحات الجديدة)
   KOSAKATA BARU (المفردات الجديدة):
   - مطر (Hujan), الريح (Angin), منهمر (Deras/Lebat), صحو (Cerah), بارد (Dingin), غائم (Mendung), العشب (Rumput), الراعي (Penggembala), مشرقة (Bersinar), فجأة (Tiba-tiba), وقف / يقف (Berdiri/Berhenti).

   ISTILAH GRAMATIKAL BARU (المصطلحات الجديدة):
   - الاستمرار (Keberlanjutan), التحول (Perubahan Keadaan), فعل ناسخ (Fi'il Nasikh), نسخ / ينسخ (Menghapus/Mengubah Hukum), رفع / يرفع (Rafa'/Merafa'kan), نصب / ينصب (Nasab/Menasabkan), منصوب (Manshub), التوقيت (Keterangan Waktu), النفي (Nafi/Penolakan), الاستدراك (Istidrak/Sanggahan), التمني (Tamanni/Pengandaian), التشبيه (Tasybih/Penyerupaan), الترجي (Tarajji/Harapan).

3. BACA DAN PERHATIKANLAH WACANA BERIKUT (اقرأ ولاحظ النص الآتي)
   Wacana: المطر
   "كان الجوُّ صحوًا، وفجأة اشتدت الريحُ، وصار الجوُّ غائمًا ، وأمسى المطرُ منهمرًا ، وبات الجوُّ باردًا. وفي اليوم التالي أصبحت الشمسُ مشرقةً، فخرج الراعي بغنمه مسرورًا فقد ظهر العشبُ الأخضر على الجبل، وأضحت الغنمُ متفرقةً تبحث عن العشب وتجري هنا وهناك، وظلَّ الجوُّ صحوًا. نظر الراعي إلى السماء، وقال: ليست السحبُ كثيرةً اليوم. وما زالت السماءُ صافيةً حتى غابت الشمس. وعندئذ وقف الراعي يصلي صلاة المغرب، ثم جلس يدعو الله. ثم عاد بغنمه وقد شكر الله على فضله."

   Pertanyaan Pemahaman Wacana (تفهيم المقروء):
   1. كيف كان الجوُّ ؟
   2. لماذا كان الراعي مسرورًا؟
   3. هل كان الراعي يصلي صلاة العشاء؟
   4. ماذا فعل الراعي بعد الصلاة؟

4. AMTSILAH & TABEL ANALISIS GRAMATIKAL (الأمثلة)
   Tabel I: Fi'il Nawasikh (الفعل الناسخ)
   - كان الجوُّ صحوًا | الفعل الناسخ: كان | معناه: التوقيت بالزمن الماضي | اسم: الجوُّ | خبر: صحوًا
   - صار الجوُّ غائمًا | الفعل الناسخ: صار | معناه: التحول من حال إلى حال | اسم: الجوُّ | خبر: غائمًا
   - أمسى المطرُ منهمرًا | الفعل الناسخ: أمسى | معناه: التوقيت بالمساء | اسم: المطرُ | خبر: منهمرًا
   - بات الجوُّ باردًا | الفعل الناسخ: بات | معناه: الاستمرار ليلاً | اسم: الجوُّ | خبر: باردًا
   - أصبحت الشمسُ مشرقةً | الفعل الناسخ: أصبح | معناه: التوقيت بالصباح | اسم: الشمسُ | خبر: مشرقةً
   - أضحت الغنمُ متفرقةً | الفعل الناسخ: أضحى | معناه: التوقيت بالضحى | اسم: الغنمُ | خبر: متفرقةً
   - ظلَّ الجوُّ صحوًا | الفعل الناسخ: ظل | معناه: الاستمرار نهارًا | اسم: الجوُّ | خبر: صحوًا
   - ليست السحبُ كثيرةً | الفعل الناسخ: ليس | معناه: النفي | اسم: السحبُ | خبر: كثيرةً
   - ما زالت السماءُ صافيةً | الفعل الناسخ: ما زال | معناه: الاستمرار | اسم: السماءُ | خبر: صافيةً

   Tabel II: Huruf Nawasikh (الحرف الناسخ)
   - إنَّ القدسَ مدينةٌ في فلسطين | الحرف الناسخ: إنَّ | معناه: التأكيد | اسم: القدسَ | خبر: مدينةٌ
   - يعلمون بأنَّ القدسَ مدينةٌ إسلامية | الحرف الناسخ: أنَّ | معناه: التأكيد | اسم: القدسَ | خبر: مدينةٌ
   - لكنَّ الإسلامَ دينٌ وسطيٌّ | الحرف الناسخ: لكنَّ | معناه: الاستدراك | اسم: الإسلامَ | خبر: دينٌ
   - كأنَّ القدسَ مكةٌ | الحرف الناسخ: كأنَّ | معناه: التشبيه | اسم: القدسَ | خبر: مكةٌ
   - ليتَ القدسَ عائدٌ للمسلمين | الحرف الناسخ: ليتَ | معناه: التمني | اسم: القدسَ | خبر: عائدٌ
   - لعلَّ يومَ النصرِ قريبٌ | الحرف الناسخ: لعلَّ | معناه: الترجي | اسم: يومَ | خبر: قريبٌ

5. PEMBAHASAN (البحث) & KAIDAH NAHWU (القاعدة النحوية)
   - Fi'il Nawasikh (كان وأخواتها) masuk ke susunan Mubtada' dan Khabar. Beramal: Merafa'kan isim (dengan dhammah) dan Menasabkan khabar (dengan fathah). Contoh: كان الجوُّ صحوًا.
   - Huruf Nawasikh (إنَّ وأخواتها) masuk ke susunan Mubtada' dan Khabar. Beramal sebaliknya: Menasabkan isim (dengan fathah) dan Merafa'kan khabar (dengan dhammah). Contoh: إنَّ القدسَ مدينةٌ.

6. CONTOH I'RAB (نموذج الإعراب)
   - كان الجوُّ صحوًا:
     * كان : فعل ماض ناقص يرفع الاسم وينصب الخبر.
     * الجوُّ : اسمها مرفوع بالضمة الظاهرة.
     * صحوًا : خبرها منصوب بالفتحة الظاهرة.
   - إنَّ الشمسَ طالعةٌ:
     * إنَّ : حرف توكيد ونصب تنصب الاسم وترفع الخبر.
     * الشمسَ : اسمها منصوب بالفتحة الظاهرة.
     * طالعةٌ : خبرها مرفوع بالضمة الظاهرة.

### ALUR PERTEMUAN PEMBELAJARAN (3 Pertemuan x 2 JP)
- PERTEMUAN 1: Focus Maharah Qira'ah & Al-Mufradat al-Jadidah (Eksplorasi wacana & pemahaman teks).
- PERTEMUAN 2: Focus Al-Qawa'id, Amtsilah & Pembahasan Nahwu/Sharaf (Praktik analisis i'rab & pola kalimat).
- PERTEMUAN 3: Focus At-Tadribat Terpadu A - G, Kitabah Deskriptif & Asesmen Maharah.
` : `D. KEGIATAN PEMBELAJARAN

### PERTEMUAN 1 (2 x 40 Menit)
Fokus: ${analysis.focusTitle1}

1. Kegiatan Pendahuluan (15 Menit):
   - Guru membuka pembelajaran dengan salam hangat, menyapa peserta didik, dan memimpin doa bersama (Mindful Learning).
   - Memeriksa presensi, kesiapan ruang belajar, serta memotivasi semangat belajar siswa.
   - Mengajukan pertanyaan pemantik awal untuk menggali rasa ingin tahu siswa terkait materi ${t}.
   - Menyampaikan tujuan pembelajaran, alur aktivitas, dan aspek penilaian yang akan dilakukan.

2. Kegiatan Inti (50 Menit):
   - Literasi & Eksplorasi: Peserta didik menyimak pemaparan materi melalui media visual/bacaan mengenai ${analysis.subMateri1}.
   - Critical Thinking: Peserta didik mengidentifikasi poin-poin utama, mengajukan pertanyaan kritis, dan membedakan aspek kunci materi.
   - Collaboration: Peserta didik berdiskusi dalam kelompok kecil (3-4 orang) mengerjakan LKPD Aktivitas 1 untuk memetakan konsep dan dasar rujukan.
   - Communication: Perwakilan kelompok menyampaikan hasil temuannya di depan kelas dengan bahasa yang santun dan jelas.
   - Creativity & Penguatan: Guru memberikan tanggapan positif, meluruskan miskonsepsi, dan menyimpulkan poin inti pertemuan pertama.

3. Kegiatan Penutup (15 Menit):
   - Guru bersama peserta didik melakukan refleksi atas pemahaman yang diperoleh (Joyful Learning).
   - Menyampaikan rangkuman singkat dan arahan kegiatan untuk pertemuan kedua.
   - Menutup kegiatan dengan doa kafaratul majelis dan salam penutup.

### PERTEMUAN 2 (2 x 40 Menit)
Fokus: ${analysis.focusTitle2}

1. Kegiatan Pendahuluan (15 Menit):
   - Pembukaan dengan salam, doa bersama, dan pengecekan kehadiran.
   - Apersepsi kilat untuk mengaitkan materi pertemuan 1 dengan materi lanjutan hari ini.
   - Menyampaikan fokus kajian pertemuan ke-2 seputar ${analysis.subMateri2}.

2. Kegiatan Inti (50 Menit):
   - Orientasi Masalah: Guru menayangkan skenario kasus atau fenomena aktual yang menantang terkait ${t}.
   - Kolaborasi & Analisis Data: Peserta didik dalam kelompok menelaah data, menguji berbagai alternatif solusi pada LKPD Aktivitas 2, dan menyusun argumentasi berbasis kaidah yang valid.
   - Presentasi Silang: Kelompok menyajikan peta analisis dan strategi pemecahan masalah. Kelompok lain memberikan tanggapan dan masukan membangun.
   - Sintesis & Konfirmasi: Guru mengarahkan sintesis bersama untuk menarik kesimpulan yang kokoh dan aplikatif.

3. Kegiatan Penutup (15 Menit):
   - Guru membimbing peserta didik merumuskan intisari pembelajaran pertemuan kedua.
   - Mengadakan kuis reflektif singkat untuk memverifikasi pemahaman.
   - Memberikan motivasi pengamalan sikap dan menutup dengan doa bersama serta salam.

### PERTEMUAN 3 (2 x 40 Menit)
Fokus: ${analysis.focusTitle3}

1. Kegiatan Pendahuluan (15 Menit):
   - Salam pembuka, doa bersama, dan pembiasaan adab belajar.
   - Guru menyampaikan agenda pertemuan ke-3: unjuk kerja, asesmen sumatif, dan peneguhan komitmen karakter.

2. Kegiatan Inti (50 Menit):
   - Unjuk Kerja & Asesmen Sumatif: Peserta didik menyelesaikan Uji Kompetensi Soal Analisis Kasus HOTS secara mandiri dan jujur.
   - Refleksi Terbimbing: Guru memfasilitasi pembahasan soal dan klarifikasi konsep-konsep penting.
   - Komitmen Pembiasaan: Peserta didik menyusun rencana aksi pembiasaan nilai-nilai ${t} dalam kehidupan sehari-hari.

3. Kegiatan Penutup (15 Menit):
   - Guru memberikan apresiasi atas partisipasi aktif seluruh peserta didik selama pembelajaran.
   - Memberikan arahan program pengayaan bagi yang tuntas dan program bimbingan remedial.
   - Doa bersama dan salam penutup.`,

        asesmen: analysis.category === 'bahasa_arab' ? `E. PEMBELAJARAN DIFERENSIASI BAHASA ARAB
- Peserta Didik Cerdas Berbakat: Penugasan pengayaan menyusun artikel deskriptif Bahasa Arab berharakat (اكتب نصا وصفي) dan analisis i'rab teks kompleks.
- Peserta Didik Butuh Bimbingan: Pendampingan bacaan berharakat, penyederhanaan tabel amsilah, dan latihan membaca bersama tutor sebaya.

F. ASESMEN & RUBRIK EVALUASI MAHARAH BAHASA ARAB

1. ASESMEN FORMATIF (Inquiry Learning & Observasi)
   - Observasi kelancaran membaca wacana berharakat dan keterlibatan hiwar.
   - Ketuntasan pengerjaan latihan At-Tadribat A - G.

2. RUBRIK PENILAIAN MAHARAH KALAM & QIRA'AH
   | No | Aspek Penilaian Keterampilan Berbahasa | Deskripsi Evaluasi | Skor Maksimal |
   |---|---|---|---|
   | 1 | Kelancaran (Fluency) | Tidak ada jeda berlebih, pembacaan dan tuturan lancar serta efektif | 20 |
   | 2 | Ketepatan (Accuracy - Nahwu/Sharaf) | Bebas dari kesalahan i'rab dan struktur kalimat (tarkib) | 20 |
   | 3 | Isi & Sosiolinguistik | Wacana sesuai tema, penguasaan mufradat dan makna mendalam | 30 |
   | 4 | Pelafalan & Bunyi Bahasa | Pengucapan makhraj huruf dan fonetik Bahasa Arab tepat | 15 |
   | 5 | Gestur & Strategi Komunikasi | Ekspresi, intonasi, dan adab berkomunikasi sangat baik | 15 |
   | | **TOTAL SKOR MAKSIMAL** | | **100** |

3. ASESMEN SUMATIF (At-Tadribat & Pengetahuan Gramatikal)
   - Latihan A: Analisis Mubtada & Khabar + Fi'il Nasikh (Syakal).
   - Latihan B: Penggunaan Huruf Nasikh + Syakal.
   - Latihan C & D: Melengkapi Kalimat & Analisis I'rab.
   - Latihan E, F, G: Menyusun Kalimat Mandiri & Analisis Paragraf.` : `E. PEMBELAJARAN DIFERENSIASI
- Bagi peserta didik yang memiliki kecepatan belajar tinggi: Diberikan penugasan pengayaan mandiri berupa analisis artikel ilmiah atau kasus pembelajaran kontekstual tingkat lanjut (HOTS).
- Bagi peserta didik yang membutuhkan bimbingan bertahap: Diberikan pendampingan intensif oleh guru, penyederhanaan alur instruksi, serta kolaborasi tutor sebaya yang suportif.
- Guru mengadaptasi metode dan media pembelajaran sesuai profil gaya belajar visual, auditori, maupun kinestetik.

F. ASESMEN / PENILAIAN

1. Asesmen Diagnostik (Sebelum Pembelajaran)
| No | Pertanyaan Diagnostik Kesiapan | Ya | Tidak |
|---|---|---|---|
| 1 | Apakah kamu sudah pernah mendengar atau membaca materi terkait ${t}? | [ ] | [ ] |
| 2 | Apakah kamu merasa siap untuk aktif berdiskusi dan berkolaborasi dalam kelompok? | [ ] | [ ] |
| 3 | Apakah kamu memiliki komitmen untuk mengamalkan materi ini dalam kehidupan sehari-hari? | [ ] | [ ] |

2. Asesmen Formatif (Selama Proses Pembelajaran)
- Teknik: Observasi keaktifan diskusi, penilaian kinerja presentasi, dan ketuntasan LKPD.
- Instrumen: Lembar observasi sikap (PPP & PRA) serta rubrik partisipasi kelompok.

3. Asesmen Sumatif (Akhir Pembelajaran)
- Teknik: Tes tertulis pemecahan masalah kasus HOTS.
- Instrumen: Uji kompetensi analisis terstruktur.

UJI KOMPETENSI ANALISIS KASUS HOTS
Jawablah pertanyaan analisis berikut secara kritis, runtut, dan komprehensif!

1. ${analysis.caseStudyQuestions[0]}

2. ${analysis.caseStudyQuestions[1]}

3. ${analysis.caseStudyQuestions[2]}

4. ${analysis.caseStudyQuestions[3]}`,

        pengayaanRemedial: analysis.category === 'bahasa_arab' ? `G. PENGAYAAN DAN REMEDIAL BAHASA ARAB

Program Pengayaan (التكرار والتوسع):
- Diberikan kepada peserta didik yang telah tuntas memahami kaidah Nahwu/Sharaf.
- Bentuk Kegiatan: Membaca dan menganalisis teks wacana pengayaan bertema "المساجد في عصور الأولى" (Masjid-masjid pada Masa Awal Islam), menyusun rincian mufradat tambahan, serta membuat teks deskriptif Bahasa Arab mandiri.

Program Remedial (التذليل والمتابعة):
- Diberikan kepada peserta didik yang memerlukan pendampingan membaca dan i'rab.
- Bentuk Kegiatan: Bimbingan personal membaca teks berharakat, penyederhanaan pola kalimat Fi'il/Huruf Nasikh, serta latihan terbimbing mengidentifikasi isim dan khabar.` : `G. PENGAYAAN DAN REMEDIAL

Program Pengayaan:
- Diberikan kepada peserta didik yang telah melampaui kriteria ketuntasan tujuan pembelajaran (KKTP).
- Bentuk kegiatan: Penelaahan kasus pembelajaran komparatif lanjutan, pembuatan infografis digital, atau tugas tutor sebaya untuk membantu rekan kelompok.

Program Remedial:
- Diberikan kepada peserta didik yang belum mencapai kriteria ketuntasan tujuan pembelajaran.
- Bentuk kegiatan: Penjelasan ulang konsep-konsep kunci dengan pendekatan diferensiasi proses, pendampingan tugas terbimbing, dan asesmen perbaikan pada indikator yang belum tuntas.`,

        lembarKerja: `H. REFLEKSI GURU DAN PESERTA DIDIK

Refleksi Guru:
1. Sejauh mana seluruh peserta didik terlibat aktif dan antusias dalam pembelajaran?
2. Bagian materi manakah yang paling mudah dipahami dan bagian mana yang memerlukan penguatan tambahan?
3. Apakah alokasi waktu dan strategi diferensiasi yang diterapkan sudah berjalan efektif?
4. Langkah perbaikan apa yang perlu dipersiapkan untuk menyempurnakan pertemuan berikutnya?

Refleksi Peserta Didik:
| No | Pertanyaan Refleksi Siswa | Catatan Jawaban Siswa |
|---|---|---|
| 1 | Hal penting apa yang paling bermanfaat yang kamu pelajari hari ini? | |
| 2 | Bagian manakah yang masih terasa menantang dan ingin kamu pelajari lebih lanjut? | |
| 3 | Apa langkah nyata yang akan kamu lakukan untuk memperbaiki hasil belajarmu? | |
| 4 | Tingkat kepuasan dan usahamu dalam pembelajaran (Skala 1 - 5 Bintang): | ★ ★ ★ ★ ★ |

Skala Pembiasaan Karakter Positif:
| No | Indikator Pembiasaan Diri | Selalu | Sering | Kadang | Belum |
|---|---|---|---|---|---|
| 1 | Menyimak materi dengan fokus dan penuh rasa ingin tahu | [ ] | [ ] | [ ] | [ ] |
| 2 | Menghargai pendapat teman saat berdiskusi dalam kelompok | [ ] | [ ] | [ ] | [ ] |
| 3 | Menyelesaikan tugas dengan jujur, disiplin, dan tepat waktu | [ ] | [ ] | [ ] | [ ] |
| 4 | Berusaha mempraktikkan nilai-nilai materi dalam keseharian | [ ] | [ ] | [ ] | [ ] |`,

        lkpd: `LAMPIRAN 1: LEMBAR KERJA PESERTA DIDIK (LKPD)
Mata Pelajaran: ${safeSubject}
Topik Bahasan: ${t}
Kelas / Semester: ${safeGrade} / Semester ${semester}
Nama Anggota Kelompok: 1. .........  2. .........  3. .........  4. .........

A. AKTIVITAS 1: Pemetaan Konsep Kunci dan Landasan Teori
Petunjuk: Identifikasilah konsep pokok, dasar hukum/ilmiah, serta pengertian materi ${t}!
| No | Aspek / Komponen Materi | Deskripsi & Penjelasan | Relevansi / Bukti Landasan |
|---|---|---|---|
| 1 | ${analysis.lkpdRows[0].col1} | ${analysis.lkpdRows[0].col2} | ${analysis.lkpdRows[0].col3} |
| 2 | ${analysis.lkpdRows[1].col1} | ${analysis.lkpdRows[1].col2} | ${analysis.lkpdRows[1].col3} |
| 3 | ${analysis.lkpdRows[2].col1} | ${analysis.lkpdRows[2].col2} | ${analysis.lkpdRows[2].col3} |

B. AKTIVITAS 2: Analisis Masalah dan Solusi Kontekstual
Petunjuk: Diskusikan kasus pembelajaran nyata berikut bersama anggota kelompokmu, lalu rumuskan langkah pemecahan masalah terbaik!
1. Permasalahan Nyata: Analisislah bagaimana menerapkan prinsip ${t} ketika menghadapi kendala di lingkungan masyarakat!
2. Alternatif Solusi: Tuliskan 2-3 usulan solusi yang logis, santun, dan berbasis bukti!
3. Kesimpulan Kelompok: Tuliskan kesimpulan akhir yang akan dipresentasikan di depan kelas!

C. AKTIVITAS 3: Lembar Pembiasaan dan Rencana Aksi Nyata
1. Buatlah rencana aksi pribadi yang berisi komitmen perbaikan sikap atau penerapan materi ${t} dalam kehidupan sehari-hari!
2. Catat pelaksanaan komitmen tersebut dan mintalah paraf orang tua/wali serta guru pengajar!`,

        glosarium: analysis.category === 'koding_ai' ? `LAMPIRAN 2: GLOSARIUM
1. Algoritma (Algorithm) : Kumpulan instruksi terstruktur dan terbatas yang dapat diimplementasikan dalam bentuk program komputer untuk menyelesaikan masalah komputasi.
2. Arduino : Mikrokontroler papan tunggal (single board controller) bersifat open-source yang digunakan untuk mengontrol perangkat elektronik dan sensor.
3. Single Board Computer (SBC) : Komputer utuh yang dibangun pada satu papan sirkuit mencakup mikroprosesor, memori, slot I/O, dan sistem operasi (contoh: Raspberry Pi).
4. Single Board Controller : Papan sirkuit terpadu berbasis mikrokontroler khusus untuk mengontrol masukan (input sensor) dan keluaran (output actuator).
5. Integrated Development Environment (IDE) : Perangkat lunak aplikasi tempat programmer menulis, mengompilasi, dan mengunggah kode program (contoh: IDE Arduino).
6. UnoArduSim : Simulator perangkat lunak offline untuk menguji dan menganalisis eksekusi kode program C++ Arduino tanpa harus menyambungkan hardware fisik.
7. Kecerdasan Buatan (Artificial Intelligence) : Kemampuan sistem komputer untuk menirukan fungsi kecerdasan manusia seperti pembelajaran, pemrosesan data, dan pengambilan keputusan.
8. Keamanan Siber (Cyber Security) : Praktik dan prosedur teknis untuk melindungi komputer, jaringan, data, dan program dari akses atau serangan jahat tak terotorisasi.
9. Sensor : Komponen input elektronik yang mendeteksi perubahan fisik (suhu, cahaya, jarak) dan mengirimkan sinyal ke unit pengontrol.
10. Actuator : Komponen output yang mengubah sinyal kontrol dari mikrokontroler menjadi aksi fisik atau indikator (contoh: Lampu LED, Servo, Buzzer).
11. Delay : Fungsi penunda dalam baris kode program untuk menahan instruksi selama satuan waktu tertentu (dalam milidetik).
12. DigitalWrite / PinMode : Perintah bawaan Arduino untuk mengonfigurasi status pin sebagai INPUT/OUTPUT dan mengirimkan sinyal HIGH/LOW.` : (analysis.category === 'bahasa_arab' ? `LAMPIRAN 2: GLOSARIUM
1. Mufradat : Kosakata atau perbendaharaan kata dalam Bahasa Arab.
2. Hiwar : Dialog atau percakapan interaktif Bahasa Arab antar dua orang atau lebih.
3. Nahwu : Ilmu tata bahasa Arab yang mempelajari kedudukan kata dalam kalimat dan hukum I'rab (harakat akhir).
4. Sharaf : Ilmu tata bahasa Arab yang mempelajari perubahan bentuk kata (tasrif) dari kata dasar menjadi berbagai bentuk kata kerja dan kata benda.
5. Qira'ah : Keterampilan membaca, menelaah, dan memahami kandungan makna teks Bahasa Arab.
6. Kitabah : Keterampilan menulis huruf, kata, dan paragraf Bahasa Arab secara rapi dan akurat sesuai kaidah imla'.
7. Istima' : Keterampilan menyimak dan menangkap pesan audio Bahasa Arab.
8. Kalam : Keterampilan berbicara dan mengekspresikan gagasan secara lisan dalam Bahasa Arab.
9. Tarkib : Struktur atau susunan kalimat dalam tata bahasa Arab.
10. Tarjamah : Proses mengalihbahasakan teks dari Bahasa Arab ke Bahasa Indonesia atau sebaliknya.` : `LAMPIRAN 2: GLOSARIUM
1. ${t} : Topik bahasan utama yang dipelajari dan mencakup keseluruhan prinsip, kaidah, serta implementasinya.
2. Analisis : Penyelidikan terhadap suatu peristiwa atau fenomena untuk mengetahui keadaan yang sebenarnya serta sebab-akibatnya.
3. Asesmen : Proses pengumpulan dan pengolahan informasi untuk mengukur pencapaian hasil belajar peserta didik.
4. Diferensiasi : Pendekatan pembelajaran yang menyesuaikan konten, proses, dan produk dengan kebutuhan dan profil belajar siswa.
5. HOTS (Higher Order Thinking Skills) : Keterampilan berpikir tingkat tinggi yang mencakup kemampuan menganalisis, mengevaluasi, dan mencipta.
6. Kolaborasi : Bekerja sama secara aktif dan saling mendukung dalam kelompok untuk mencapai tujuan bersama.
7. Moderasi : Sikap tidak berlebihan, seimbang, dan mengedepankan pertimbangan keadilan serta toleransi.
8. Refleksi : Kegiatan merenungkan dan mengevaluasi kembali pengalaman belajar yang telah dialami untuk perbaikan berkelanjutan.`),

        daftarPustaka: analysis.category === 'koding_ai' ? `LAMPIRAN 3: DAFTAR PUSTAKA
1. Kementerian Pendidikan, Kebudayaan, Riset, dan Teknologi. 2022. Buku Panduan Guru dan Siswa Informatika untuk SMA/MA Kelas XII. Jakarta: Pusat Kurikulum dan Perbukuan.
2. Rosch, W. L. 1997. Hardware Bible. Indiana: Sams Publishing.
3. Johnston, S. J. et al. 2018. Commodity Single Board Computer Clusters and Their Applications. Future Generation Computer Systems, 89, 201–212.
4. BBC Bitesize. 2022. Thinking Computationally: Introduction to Computational Thinking - KS3 Computer Science. BBC Education.
5. Wing, J. M. 2008. Computational Thinking and Thinking About Computing. Philosophical Transactions of the Royal Society, 366, 3717–3725.
6. Kementerian Agama Republik Indonesia. 2024. Pedoman Kurikulum Merdeka Terintegrasi Teknologi Madrasah. Jakarta: Ditjen Pendis.` : (analysis.category === 'bahasa_arab' ? `LAMPIRAN 3: DAFTAR PUSTAKA
1. Kementerian Agama Republik Indonesia. 2020. Buku Teks Utama Bahasa Arab Madrasah Aliyah Kelas X/XI/XII. Jakarta: Ditjen Pendis Kemenag RI.
2. Mustofa, Syaiful. 2017. Strategi Pembelajaran Bahasa Arab Inovatif. Malang: UIN Maliki Press.
3. Ni'mah, Fuad. 2016. Mulakhkhas Qawa'id al-Lughah al-'Arabiyah. Kairo: Dar al-Ma'arif.
4. Hermawan, Acep. 2018. Metodologi Pembelajaran Bahasa Arab. Bandung: PT Remaja Rosdakarya.` : `LAMPIRAN 3: DAFTAR PUSTAKA
1. Kementerian Pendidikan, Kebudayaan, Riset, dan Teknologi. 2024. Panduan Pembelajaran dan Asesmen Kurikulum Merdeka. Jakarta: BSKAP.
2. Kementerian Agama Republik Indonesia. 2024. Keputusan Menteri Agama (KMA) No. 450 Tahun 2024 tentang Pedoman Implementasi Kurikulum pada Madrasah. Jakarta: Ditjen Pendis.
3. Tim Penulis Ahli Mata Pelajaran. 2024. Buku Panduan Guru dan Siswa ${safeSubject} Kelas ${safeGrade}. Jakarta: Kementerian Agama RI / Kemendikbudristek.
4. Ensiklopedi Pendidikan dan Sains Indonesia. 2023. Jakarta: Balai Pustaka.`)
    };
}

// Generate Standar Soal & Kisi-Kisi Non-AI
function generateSoalKisiNonAIStandardData(plans = [], subjectName = 'Mata Pelajaran', mcCount = 10, essayCount = 5, optionCount = 5, difficulty = 'sedang') {
    let optsObj = null;
    if (typeof mcCount === 'object' && mcCount !== null) {
        optsObj = mcCount;
        mcCount = optsObj.mcCount !== undefined ? parseInt(optsObj.mcCount) : 10;
        essayCount = optsObj.essayCount !== undefined ? parseInt(optsObj.essayCount) : 5;
        optionCount = optsObj.optionCount !== undefined ? parseInt(optsObj.optionCount) : 5;
        difficulty = optsObj.difficulty || 'sedang';
    } else {
        mcCount = typeof mcCount === 'number' ? mcCount : (parseInt(mcCount) || 10);
        essayCount = typeof essayCount === 'number' ? essayCount : (parseInt(essayCount) || 5);
        optionCount = typeof optionCount === 'number' ? optionCount : (parseInt(optionCount) || 5);
    }

    const validPlans = (Array.isArray(plans) && plans.length > 0)
        ? plans
        : [{ title: subjectName, topic: subjectName, grade: 'VII' }];

    const questions = [];
    const letters = ['A', 'B', 'C', 'D', 'E'];
    const optLimit = optionCount === 4 ? 4 : 5;

    let qIndex = 1;

    // Generate MC Questions
    for (let i = 0; i < mcCount; i++) {
        const plan = validPlans[i % validPlans.length];
        const topicClean = removeModulPrefix(plan.topic || plan.title || subjectName);
        const analysis = analyzeSubjectAndTopic(subjectName, topicClean, '');

        const cogLevels = ['C1 (Mengingat)', 'C2 (Memahami)', 'C3 (Menerapkan)', 'C4 (Menganalisis)', 'C5 (Mengevaluasi)', 'C6 (Mencipta)'];
        let cog = 'C2 (Memahami)';
        if (difficulty === 'mudah') {
            cog = cogLevels[i % 3]; // C1, C2, C3
        } else if (difficulty === 'sulit') {
            cog = cogLevels[2 + (i % 4)]; // C3, C4, C5, C6
        } else {
            cog = cogLevels[i % 6];
        }

        const stemVariations = [
            `Berdasarkan kajian materi tentang <b>${topicClean}</b>, konsep utama yang menjadi landasan penerapannya adalah...`,
            `Dalam pelaksanaan atau pembahasan mengenai <b>${topicClean}</b>, hal penting yang harus diperhatikan secara tertib dan sistematis adalah...`,
            `Perhatikan pernyataan berikut terkait <b>${topicClean}</b>! Langkah yang paling tepat dalam memecahkan permasalahan nyata yang muncul adalah...`,
            `Manakah di antara pernyataan berikut yang paling tepat menggambarkan hikmah atau tujuan utama dari <b>${topicClean}</b>?`,
            `Seseorang sedang mempelajari <b>${topicClean}</b> dan ingin menerapkan prinsip dasarnya. Sikap yang paling mencerminkan pemahaman yang benar adalah...`
        ];

        const questionText = stemVariations[i % stemVariations.length];
        const correctIndex = i % optLimit;

        let rawOptionTexts = [];
        if (analysis.category === 'koding_ai') {
            rawOptionTexts = [
                `Memahami arsitektur hardware (SBC/Mikrokontroler), menuliskan baris kode program terstruktur, dan menguji simulasi pada UnoArduSim/Tinkercad.`,
                `Menghubungkan komponen elektronik secara acak tanpa mengonfigurasi status pinMode() dan tanpa memperhatikan batas tegangan listrik.`,
                `Mengabaikan fungsi delay() dan timing program sehingga sistem mengalami kondisi crash atau kegagalan eksekusi.`,
                `Menjalankan sistem tanpa menerapkan protokol keamanan siber (Cyber Security) dan etika kecerdasan buatan (AI).`,
                `Mengasumsikan bahwa seluruh rangkaian mikrokontroler dapat berjalan tanpa memerlukan instruksi perangkat lunak.`
            ];
        } else if (analysis.category === 'bahasa_arab') {
            rawOptionTexts = [
                `Menerapkan kaidah Nahwu/Sharaf (Tarkib) serta melatih maharah kalam, istima', qira'ah, dan kitabah secara fasih dan akurat.`,
                `Membaca teks Bahasa Arab tanpa memperhatikan harakat akhir dan kedudukan kata (I'rab) dalam struktur kalimat.`,
                `Mengabaikan penguasaan mufradat kunci serta mengabaikan adab komunikasi saat mempraktikkan hiwar.`,
                `Menerjemahkan teks kalimat secara harfiah tanpa mempertimbangkan konteks makna dan budaya Bahasa Arab.`,
                `Mengasumsikan bahwa semua kata kerja (fi'il) dalam Bahasa Arab memiliki bentuk tasrif yang konstan tanpa perubahan.`
            ];
        } else if (analysis.category === 'procedural') {
            rawOptionTexts = [
                `Melaksanakan seluruh rukun, syarat sah, dan tahapan prosedur secara tertib, sah, dan sesuai ketetapan baku.`,
                `Mengabaikan urutan langkah utama dan menggantikannya dengan kegiatan opsional yang tidak disyaratkan.`,
                `Melakukan tindakan yang dapat membatalkan keabsahan pelaksanaan seluruh proses kegiatan.`,
                `Melakukan kegiatan secara tergesa-gesa tanpa melakukan persiapan awal dan penelaahan aturan dasar.`,
                `Mengabaikan nilai kedisiplinan dan menganggap tata cara pelaksanaan tidak berpengaruh pada hasil akhir.`
            ];
        } else if (analysis.category === 'math_science') {
            rawOptionTexts = [
                `Menganalisis hubungan antarvariabel, menerapkan rumus/persamaan yang tepat, serta memverifikasi data hasil perhitungan.`,
                `Menggunakan data acak tanpa melakukan pengujian hipotesis ilmiah dan kalkulasi yang valid.`,
                `Mengabaikan standar satuan pengukuran dan prinsip-prinsip sains yang mendasarinya.`,
                `Menyimpulkan hasil observasi secara subjektif tanpa melalui pembuktian empiris.`,
                `Menolak melakukan langkah evaluasi dan verifikasi terhadap hasil perhitungan yang diperoleh.`
            ];
        } else {
            rawOptionTexts = [
                `Memahami landasan pokok serta menerapkan kaidah ${topicClean} secara tepat, disiplin, dan bertanggung jawab.`,
                `Melakukan kegiatan secara tergesa-gesa tanpa memperhatikan kaidah dan syarat yang berlaku.`,
                `Mengabaikan landasan konseptual dan hanya mementingkan hasil akhir yang instan.`,
                `Menyerahkan seluruh tanggung jawab kepada orang lain tanpa keterlibatan pribadi.`,
                `Menganggap materi tersebut hanya sebatas wawasan teori tanpa perlu diamalkan dalam kehidupan.`
            ];
        }

        // Place correct answer at correctIndex and fill remaining slots
        const options = [];
        let wrongIdx = 1;
        for (let o = 0; o < optLimit; o++) {
            const l = letters[o];
            if (o === correctIndex) {
                options.push(`${l}. ${rawOptionTexts[0]}`);
            } else {
                const text = rawOptionTexts[wrongIdx % rawOptionTexts.length];
                options.push(`${l}. ${text}`);
                wrongIdx++;
            }
        }

        questions.push({
            no: qIndex,
            type: 'mc',
            question: questionText,
            options: options,
            answerKey: letters[correctIndex],
            answer: letters[correctIndex],
            correctOptionText: options[correctIndex],
            explanation: `Pilihan ${letters[correctIndex]} adalah jawaban yang benar karena secara utuh mencerminkan pemahaman esensial dan penerapan kaidah ${topicClean} sesuai tujuan pembelajaran.`,
            kisiKisi: {
                kdCp: `Memahami dan menganalisis konsep serta penerapan ${topicClean}`,
                materiPokok: topicClean,
                indikatorSoal: `Peserta didik dapat mengidentifikasi prinsip utama dan prosedur yang tepat mengenai ${topicClean}`,
                levelKognitif: cog,
                bentukSoal: 'Pilihan Ganda (PG)'
            }
        });
        qIndex++;
    }

    // Generate Essay Questions
    for (let j = 0; j < essayCount; j++) {
        const plan = validPlans[j % validPlans.length];
        const topicClean = removeModulPrefix(plan.topic || plan.title || subjectName);
        const analysis = analyzeSubjectAndTopic(subjectName, topicClean, '');

        const essayStems = [
            `Jelaskan secara mendalam pengertian, landasan dasar, serta ruang lingkup utama dari materi <b>${topicClean}</b>!`,
            `Uraikan langkah-langkah sistematis atau tahapan prosedur penting yang harus dipenuhi dalam pelaksanaan <b>${topicClean}</b>!`,
            `Analisislah sebuah kasus pembelajaran nyata di lingkungan sekitar di mana prinsip <b>${topicClean}</b> sangat dibutuhkan untuk menyelesaikan permasalahan sosial atau etika!`,
            `Bandingkan dampak positif bagi individu dan masyarakat antara penerapan <b>${topicClean}</b> secara konsisten dengan kelalaian dalam melaksanakannya!`,
            `Rumuskan strategi konkret pembiasaan karakter luhur bagi peserta didik dengan berpedoman pada nilai-nilai yang terkandung dalam <b>${topicClean}</b>!`
        ];

        questions.push({
            no: qIndex,
            type: 'essay',
            question: essayStems[j % essayStems.length],
            options: [],
            answerKey: `Pedoman Penskoran: Siswa menjelaskan konsep dasar secara tepat (skor 4), menguraikan tahapan/argumentasi logis (skor 4), dan memberikan contoh aplikasi nyata yang relevan (skor 2). Total skor maksimal = 10.`,
            explanation: `Jawaban harus memuat: (1) Definisi dan landasan pokok ${topicClean}, (2) Alur atau prinsip analisis yang runtut, dan (3) Hubungan kontekstual dengan pemecahan masalah kehidupan sehari-hari.`,
            kisiKisi: {
                kdCp: `Mengevaluasi dan menyajikan solusi komprehensif terkait ${topicClean}`,
                materiPokok: topicClean,
                indikatorSoal: `Disajikan stimulus kontekstual, peserta didik dapat menganalisis dan menyusun uraian komprehensif mengenai ${topicClean}`,
                levelKognitif: 'C4 - C6 (HOTS)',
                bentukSoal: 'Uraian / Essay'
            }
        });
        qIndex++;
    }

    return {
        title: `Naskah Soal & Kisi-Kisi Ujian ${subjectName}`,
        subject: subjectName,
        semester: 'Ganjil / Genap',
        grade: validPlans[0]?.grade || 'VII MTs',
        academicYear: '2024/2025',
        questions: questions
    };
}

// Generate Standar RPP Lengkap Non-AI
function generateRPPLengkapNonAIData(plans = [], subjectName = 'Mata Pelajaran', grade = 'VII', guruName = '', guruNip = '', kepsekName = '', kepsekNip = '', schoolName = '', schoolLocation = '') {
    const validPlans = (Array.isArray(plans) && plans.length > 0)
        ? plans
        : [{ title: subjectName, topic: subjectName, grade: grade || 'VII' }];

    const formattedDate = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    const loc = schoolLocation || 'Tanjung Jabung Barat';

    const rpps = validPlans.map((plan, idx) => {
        const topicClean = removeModulPrefix(plan.topic || plan.title || subjectName) || `${subjectName} Bab ${idx + 1}`;
        const analysis = analyzeSubjectAndTopic(subjectName, topicClean, '');
        const sName = schoolName || analysis.schoolNameDefault;

        const htmlContent = `
            <div style="font-family: Arial, sans-serif; color: #000; line-height: 1.5; font-size: 10pt; padding: 25px; background: #fff; max-width: 900px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px;">
                <div style="text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px;">
                    <h2 style="font-size: 13pt; font-weight: bold; margin: 0; text-transform: uppercase;">RENCANA PELAKSANAAN PEMBELAJARAN (RPP)</h2>
                    <h3 style="font-size: 11pt; font-weight: bold; margin: 4px 0 0 0; color: #047857;">${analysis.curriculumHeader}</h3>
                    <p style="font-size: 9pt; margin: 2px 0 0 0;">${sName} - Tahun Pelajaran 2024/2025</p>
                </div>

                <table style="width: 100%; margin-bottom: 16px; font-size: 9.5pt; border-collapse: collapse;" border="0">
                    <tr><td style="width: 22%; font-weight: bold;">Satuan Pendidikan</td><td style="width: 28%;">: ${sName}</td><td style="width: 20%; font-weight: bold;">Kelas / Semester</td><td style="width: 30%;">: ${plan.grade || grade} / 1 (Ganjil)</td></tr>
                    <tr><td style="font-weight: bold;">Mata Pelajaran</td><td>: ${subjectName}</td><td style="font-weight: bold;">Alokasi Waktu</td><td>: 3 Pertemuan (6 x 40 Menit)</td></tr>
                    <tr><td style="font-weight: bold;">Materi / Topik</td><td colspan="3">: <b>${topicClean}</b></td></tr>
                </table>

                <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; padding: 10px; border-radius: 6px; margin-bottom: 16px; font-size: 9pt;">
                    <b>Capaian Pembelajaran (CP):</b><br>
                    Peserta didik mampu memahami, menganalisis, menginternalisasi prinsip pokok, serta memecahkan kasus pembelajaran kontekstual terkait materi <b>${topicClean}</b> dengan menjunjung tinggi nilai ${analysis.profilPelajar}.
                </div>

                <h4 style="font-size: 10pt; font-weight: bold; color: #065f46; margin: 14px 0 6px 0; border-bottom: 1px solid #d1fae5; padding-bottom: 4px;">A. TUJUAN PEMBELAJARAN</h4>
                <ol style="margin: 0; padding-left: 20px; font-size: 9.5pt;">
                    <li>Mendefinisikan pengertian, landasan pokok, serta ruang lingkup keilmuan ${topicClean} secara tepat.</li>
                    <li>Menganalisis prosedur atau kaidah penting dalam ${topicClean} dengan daya nalar kritis.</li>
                    <li>Menyelesaikan permasalahan kasus pembelajaran nyata yang berkaitan dengan ${topicClean} secara terstruktur dan kolaboratif.</li>
                    <li>Menunjukkan sikap berakhlak mulia, disiplin, dan mampu bekerja sama dalam pembelajaran.</li>
                </ol>

                <h4 style="font-size: 10pt; font-weight: bold; color: #065f46; margin: 14px 0 6px 0; border-bottom: 1px solid #d1fae5; padding-bottom: 4px;">B. PENDEKATAN & MODEL PEMBELAJARAN</h4>
                <p style="margin: 0; font-size: 9.5pt;"><b>Pendekatan:</b> Kurikulum Merdeka & Pembelajaran Berdiferensiasi.<br><b>Model:</b> Deep Learning (Mindful, Meaningful, Joyful Learning) / Problem Based Learning.<br><b>Metode:</b> Diskusi Kelompok, Analisis Kasus, Tanya Jawab Reflektif, dan Presentasi.</p>

                <h4 style="font-size: 10pt; font-weight: bold; color: #065f46; margin: 14px 0 6px 0; border-bottom: 1px solid #d1fae5; padding-bottom: 4px;">C. KEGIATAN PEMBELAJARAN</h4>
                
                <div style="margin-bottom: 10px;">
                    <b>Pertemuan 1: ${analysis.focusTitle1}</b>
                    <ul style="margin: 4px 0 0 0; padding-left: 20px; font-size: 9pt;">
                        <li><b>Pendahuluan (15 Menit):</b> Salam pembuka, doa bersama, presensi, apersepsi pertanyaan pemantik seputar ${topicClean}, dan penyampaian tujuan pembelajaran (Mindful Learning).</li>
                        <li><b>Kegiatan Inti (50 Menit):</b> Literasi tayangan konsep dasar, penelaahan LKPD Aktivitas 1 secara berkelompok (Collaboration), analisis kritis pertanyaan faktual (Critical Thinking), dan presentasi hasil kelompok (Communication).</li>
                        <li><b>Penutup (15 Menit):</b> Refleksi bersama perasaan belajar (Joyful Learning), rangkuman pokok materi, doa, dan salam.</li>
                    </ul>
                </div>

                <div style="margin-bottom: 10px;">
                    <b>Pertemuan 2: ${analysis.focusTitle2}</b>
                    <ul style="margin: 4px 0 0 0; padding-left: 20px; font-size: 9pt;">
                        <li><b>Pendahuluan (15 Menit):</b> Salam, doa bersama, flashback materi pertemuan 1, dan pengantar kasus pembelajaran kontekstual.</li>
                        <li><b>Kegiatan Inti (50 Menit):</b> Bedah masalah kasus pembelajaran pada LKPD Aktivitas 2, perumusan alternatif solusi bijak, verifikasi bukti rujukan, dan presentasi silang antar kelompok.</li>
                        <li><b>Penutup (15 Menit):</b> Penguatan materi oleh guru, kuis kilat pemahaman, arahan tugas mandiri, doa, dan salam.</li>
                    </ul>
                </div>

                <div style="margin-bottom: 10px;">
                    <b>Pertemuan 3: ${analysis.focusTitle3}</b>
                    <ul style="margin: 4px 0 0 0; padding-left: 20px; font-size: 9pt;">
                        <li><b>Pendahuluan (15 Menit):</b> Salam, doa, dan penjelasan tata tertib asesmen sumatif terstruktur.</li>
                        <li><b>Kegiatan Inti (50 Menit):</b> Pengerjaan Uji Kompetensi Soal HOTS secara mandiri dan berintegritas, pembahasan bersama, serta penyusunan komitmen pembiasaan karakter.</li>
                        <li><b>Penutup (15 Menit):</b> Apresiasi guru, pemberian tindak lanjut pengayaan/remedial, doa penutup, dan salam.</li>
                    </ul>
                </div>

                <h4 style="font-size: 10pt; font-weight: bold; color: #065f46; margin: 14px 0 6px 0; border-bottom: 1px solid #d1fae5; padding-bottom: 4px;">D. ASESMEN PEMBELAJARAN</h4>
                <table style="width: 100%; border-collapse: collapse; font-size: 9pt;" border="1" cellpadding="5">
                    <tr style="background-color: #f8fafc; font-weight: bold; text-align: center;">
                        <th style="border: 1px solid #000; width: 25%;">Jenis Asesmen</th>
                        <th style="border: 1px solid #000; width: 35%;">Teknik Penilaian</th>
                        <th style="border: 1px solid #000; width: 40%;">Bentuk Instrumen</th>
                    </tr>
                    <tr>
                        <td style="border: 1px solid #000;">1. Diagnostik</td>
                        <td style="border: 1px solid #000;">Pertanyaan Apersepsi Awal</td>
                        <td style="border: 1px solid #000;">Daftar Checklist Kesiapan Belajar</td>
                    </tr>
                    <tr>
                        <td style="border: 1px solid #000;">2. Formatif</td>
                        <td style="border: 1px solid #000;">Observasi & Kinerja Diskusi</td>
                        <td style="border: 1px solid #000;">Rubrik Partisipasi LKPD & Sikap PPP/PRA</td>
                    </tr>
                    <tr>
                        <td style="border: 1px solid #000;">3. Sumatif</td>
                        <td style="border: 1px solid #000;">Tes Tertulis</td>
                        <td style="border: 1px solid #000;">Naskah Soal Uraian Kasus HOTS</td>
                    </tr>
                </table>

                <table style="width: 100%; margin-top: 30px; font-size: 9.5pt; border: none;" border="0">
                    <tr>
                        <td style="width: 50%; text-align: center; vertical-align: top; border: none;">
                            Mengetahui,<br><b>Kepala Madrasah</b><br><br><br><br><br>
                            <b><u>${kepsekName || '................................'}</u></b><br>
                            NIP: ${kepsekNip || '................................'}
                        </td>
                        <td style="width: 50%; text-align: center; vertical-align: top; border: none;">
                            ${loc}, ${formattedDate}<br>
                            <b>Guru Mata Pelajaran</b><br><br><br><br><br>
                            <b><u>${guruName || '................................'}</u></b><br>
                            NIP: ${guruNip || '................................'}
                        </td>
                    </tr>
                </table>
            </div>
        `;

        return {
            id: `rpp_standard_${idx + 1}_${Date.now()}`,
            title: `RPP ${idx + 1}: ${topicClean}`,
            topic: topicClean,
            grade: plan.grade || grade,
            htmlContent: htmlContent
        };
    });

    return {
        success: true,
        rpps: rpps
    };
}

// Generate Standar Perangkat Pembelajaran Lainnya Non-AI (Silabus, ATP, KKTP, Prota, Prosem, Analisis KI-KD, TP, CP, LKPD)
function generateDeviceDocumentNonAIData(deviceType = 'silabus', plans = [], subjectName = 'Mata Pelajaran', grade = 'VII', guruName = '', guruNip = '', kepsekName = '', kepsekNip = '', schoolName = '', schoolLocation = '') {
    const validPlans = (Array.isArray(plans) && plans.length > 0)
        ? plans
        : [{ title: subjectName, topic: subjectName, grade: grade || 'VII' }];

    const formattedDate = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    const loc = schoolLocation || 'Tanjung Jabung Barat';
    const sampleTopic = removeModulPrefix(validPlans[0]?.topic || validPlans[0]?.title || subjectName);
    const mainAnalysis = analyzeSubjectAndTopic(subjectName, sampleTopic, '');
    const sName = schoolName || mainAnalysis.schoolNameDefault;
    const g = grade || validPlans[0]?.grade || 'VII';

    const teacherSign = `
        <table style="width: 100%; margin-top: 30px; font-size: 10pt; border: none;" border="0">
            <tr>
                <td style="width: 50%; text-align: center; vertical-align: top; border: none;">
                    Mengetahui,<br><b>${mainAnalysis.category === 'pai_agaislam' || mainAnalysis.category === 'bahasa_arab' ? 'Kepala Madrasah' : 'Kepala Sekolah / Madrasah'}</b><br><br><br><br><br>
                    <b><u>${kepsekName || '................................'}</u></b><br>
                    NIP: ${kepsekNip || '................................'}
                </td>
                <td style="width: 50%; text-align: center; vertical-align: top; border: none;">
                    ${loc}, ${formattedDate}<br>
                    <b>Guru Mata Pelajaran</b><br><br><br><br><br>
                    <b><u>${guruName || '................................'}</u></b><br>
                    NIP: ${guruNip || '................................'}
                </td>
            </tr>
        </table>
    `;

    if (deviceType === 'silabus') {
        const rowsHtml = validPlans.map((p, idx) => {
            const topicClean = removeModulPrefix(p.topic || p.title || subjectName) || `${subjectName} Bab ${idx + 1}`;
            return `
                <tr>
                    <td style="vertical-align: top; border: 1px solid #000;">
                        <b>3.${idx + 1} Memahami & menganalisis konsep ${topicClean}</b><br><br>
                        <b>4.${idx + 1} Menyajikan simpulan & solusi kontekstual terkait ${topicClean}</b>
                    </td>
                    <td style="vertical-align: top; border: 1px solid #000;">
                        3.${idx + 1}.1 Mendefinisikan ruang lingkup ${topicClean}<br>
                        3.${idx + 1}.2 Menjelaskan kaidah dan prinsip pokok ${topicClean}<br>
                        3.${idx + 1}.3 Menganalisis kasus pembelajaran ${topicClean}<br>
                        4.${idx + 1}.1 Melakukan demonstrasi/penugasan ${topicClean}<br>
                        4.${idx + 1}.2 Mempresentasikan hasil telaah ${topicClean}
                    </td>
                    <td style="vertical-align: top; border: 1px solid #000;">
                        <b>${topicClean}</b><br>
                        • Landasan Dasar<br>
                        • Prosedur & Analisis<br>
                        • Pembiasaan Karakter
                    </td>
                    <td style="vertical-align: top; border: 1px solid #000;">
                        <b>Mengamati:</b> Mencermati pemaparan konsep ${topicClean}<br>
                        <b>Menanya:</b> Mengidentifikasi pertanyaan kritis seputar materi<br>
                        <b>Mengeksplorasi:</b> Bekerja sama dalam kelompok menyelesaikan LKPD<br>
                        <b>Mengasosiasi:</b> Menyimpulkan solusi atas kasus pembelajaran<br>
                        <b>Mengomunikasikan:</b> Mempresentasikan hasil analisis di depan kelas
                    </td>
                    <td style="vertical-align: top; border: 1px solid #000;">
                        <b>Tugas:</b> Lembar Kerja Siswa (LKPD)<br>
                        <b>Observasi:</b> Keaktifan diskusi kelompok<br>
                        <b>Portofolio:</b> Laporan pemecahan masalah<br>
                        <b>Tes:</b> Uji Kompetensi Tertulis
                    </td>
                    <td style="vertical-align: top; border: 1px solid #000; text-align: center;">6 JP (3 TM)</td>
                    <td style="vertical-align: top; border: 1px solid #000;">${mainAnalysis.sumberBelajar}</td>
                </tr>
            `;
        }).join('');

        const html = `
            <div style="font-family: Arial, sans-serif; color: #000; line-height: 1.4; font-size: 10pt; padding: 20px; background: #fff; max-width: 1050px; margin: 0 auto; border: 1px solid #cbd5e1; border-radius: 8px;">
                <h2 style="text-align: center; font-size: 14pt; font-weight: bold; text-transform: uppercase; margin-bottom: 12px;">SILABUS PEMBELAJARAN</h2>
                <table style="width: 100%; margin-bottom: 15px; font-size: 10pt; border: none;">
                    <tr><td style="width: 18%; border:none;">Satuan Pendidikan</td><td style="width: 32%; border:none;">: ${sName}</td><td style="width: 18%; border:none;">Kelas / Semester</td><td style="width: 32%; border:none;">: ${g} / 1-2 (Ganjil & Genap)</td></tr>
                    <tr><td style="border:none;">Mata Pelajaran</td><td style="border:none;">: ${subjectName}</td><td style="border:none;">Tahun Pelajaran</td><td style="border:none;">: 2024/2025</td></tr>
                </table>

                <table style="width: 100%; border-collapse: collapse; font-size: 9pt;" border="1" cellpadding="6">
                    <thead>
                        <tr style="background-color: #d9e3b8; text-align: center; font-weight: bold; border: 1px solid #000;">
                            <th style="width: 18%; border: 1px solid #000;">Kompetensi Dasar (KD / CP)</th>
                            <th style="width: 16%; border: 1px solid #000;">Indikator Pencapaian</th>
                            <th style="width: 14%; border: 1px solid #000;">Materi Pokok</th>
                            <th style="width: 22%; border: 1px solid #000;">Kegiatan Pembelajaran</th>
                            <th style="width: 16%; border: 1px solid #000;">Penilaian</th>
                            <th style="width: 7%; border: 1px solid #000;">Waktu</th>
                            <th style="width: 7%; border: 1px solid #000;">Sumber</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHtml}
                    </tbody>
                </table>
                ${teacherSign}
            </div>
        `;
        return { success: true, items: [{ title: `Silabus - ${subjectName}`, htmlContent: html }] };
    }

    if (deviceType === 'atp') {
        const atpRows = validPlans.map((p, idx) => {
            const topicClean = removeModulPrefix(p.topic || p.title || subjectName) || `${subjectName} Bab ${idx + 1}`;
            return `
                <tr>
                    <td style="border: 1px solid #000; text-align: center; vertical-align: top;">${idx + 1}</td>
                    <td style="border: 1px solid #000; vertical-align: top;"><b>${topicClean}</b></td>
                    <td style="border: 1px solid #000; vertical-align: top;">Peserta didik mampu memahami, menganalisis, dan mengomunikasikan prinsip ${topicClean} secara kontekstual.</td>
                    <td style="border: 1px solid #000; vertical-align: top;">
                        ${idx + 1}.1 Menjelaskan konsep dan landasan dasar ${topicClean}<br>
                        ${idx + 1}.2 Menganalisis alur prosedur dan kasus pembelajaran ${topicClean}<br>
                        ${idx + 1}.3 Menyajikan laporan unjuk kerja dan komitmen nilai ${topicClean}
                    </td>
                    <td style="border: 1px solid #000; text-align: center; vertical-align: top;">6 JP</td>
                    <td style="border: 1px solid #000; vertical-align: top;">${mainAnalysis.profilPelajar}</td>
                </tr>
            `;
        }).join('');

        const html = `
            <div style="font-family: Arial, sans-serif; color: #000; line-height: 1.4; font-size: 10pt; padding: 20px; background: #fff; max-width: 1000px; margin: 0 auto; border: 1px solid #cbd5e1; border-radius: 8px;">
                <h2 style="text-align: center; font-size: 14pt; font-weight: bold; text-transform: uppercase; margin-bottom: 12px;">ALUR TUJUAN PEMBELAJARAN (ATP)</h2>
                <table style="width: 100%; margin-bottom: 15px; font-size: 10pt; border: none;">
                    <tr><td style="width: 18%; border:none;">Satuan Pendidikan</td><td style="width: 32%; border:none;">: ${sName}</td><td style="width: 18%; border:none;">Fase / Kelas</td><td style="width: 32%; border:none;">: Fase D/E/F - ${g}</td></tr>
                    <tr><td style="border:none;">Mata Pelajaran</td><td style="border:none;">: ${subjectName}</td><td style="border:none;">Tahun Pelajaran</td><td style="border:none;">: 2024/2025</td></tr>
                </table>

                <table style="width: 100%; border-collapse: collapse; font-size: 9pt;" border="1" cellpadding="6">
                    <thead>
                        <tr style="background-color: #e0f2fe; text-align: center; font-weight: bold; border: 1px solid #000;">
                            <th style="width: 5%; border: 1px solid #000;">No</th>
                            <th style="width: 18%; border: 1px solid #000;">Elemen / Topik</th>
                            <th style="width: 25%; border: 1px solid #000;">Capaian Pembelajaran (CP)</th>
                            <th style="width: 27%; border: 1px solid #000;">Alur Tujuan Pembelajaran (ATP)</th>
                            <th style="width: 7%; border: 1px solid #000;">Alokasi</th>
                            <th style="width: 18%; border: 1px solid #000;">Profil Pelajar</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${atpRows}
                    </tbody>
                </table>
                ${teacherSign}
            </div>
        `;
        return { success: true, items: [{ title: `ATP - ${subjectName}`, htmlContent: html }] };
    }

    if (deviceType === 'kktp') {
        const kktpRows = validPlans.map((p, idx) => {
            const topicClean = removeModulPrefix(p.topic || p.title || subjectName) || `${subjectName} Bab ${idx + 1}`;
            return `
                <tr>
                    <td style="border: 1px solid #000; text-align: center; vertical-align: top;">${idx + 1}</td>
                    <td style="border: 1px solid #000; vertical-align: top;"><b>${topicClean}</b></td>
                    <td style="border: 1px solid #000; vertical-align: top;">Mampu menjelaskan konsep, menganalisis prosedur, dan menyelesaikan kasus pembelajaran ${topicClean}</td>
                    <td style="border: 1px solid #000; vertical-align: top;">Belum mampu memahami konsep dasar ${topicClean} (0 - 60)</td>
                    <td style="border: 1px solid #000; vertical-align: top;">Memahami konsep dasar namun belum tepat dalam analisis kasus (61 - 70)</td>
                    <td style="border: 1px solid #000; vertical-align: top;">Memahami konsep dan mampu menganalisis sebagian besar kasus ${topicClean} (71 - 85)</td>
                    <td style="border: 1px solid #000; vertical-align: top;">Menguasai konsep secara utuh, analisis mendalam, dan mampu mempresentasikan solusi kreatif (86 - 100)</td>
                </tr>
            `;
        }).join('');

        const html = `
            <div style="font-family: Arial, sans-serif; color: #000; line-height: 1.4; font-size: 10pt; padding: 20px; background: #fff; max-width: 1050px; margin: 0 auto; border: 1px solid #cbd5e1; border-radius: 8px;">
                <h2 style="text-align: center; font-size: 14pt; font-weight: bold; text-transform: uppercase; margin-bottom: 12px;">KRITERIA KETERCAPAIAN TUJUAN PEMBELAJARAN (KKTP)</h2>
                <table style="width: 100%; margin-bottom: 15px; font-size: 10pt; border: none;">
                    <tr><td style="width: 18%; border:none;">Satuan Pendidikan</td><td style="width: 32%; border:none;">: ${sName}</td><td style="width: 18%; border:none;">Kelas / Semester</td><td style="width: 32%; border:none;">: ${g} / 1-2 (Ganjil & Genap)</td></tr>
                    <tr><td style="border:none;">Mata Pelajaran</td><td style="border:none;">: ${subjectName}</td><td style="border:none;">Tahun Pelajaran</td><td style="border:none;">: 2024/2025</td></tr>
                </table>

                <table style="width: 100%; border-collapse: collapse; font-size: 8.5pt;" border="1" cellpadding="6">
                    <thead>
                        <tr style="background-color: #fef3c7; text-align: center; font-weight: bold; border: 1px solid #000;">
                            <th style="width: 4%; border: 1px solid #000;">No</th>
                            <th style="width: 16%; border: 1px solid #000;">Tujuan Pembelajaran</th>
                            <th style="width: 20%; border: 1px solid #000;">Indikator Ketercapaian</th>
                            <th style="width: 15%; border: 1px solid #000;">Perlu Bimbingan (0 - 60)</th>
                            <th style="width: 15%; border: 1px solid #000;">Cukup (61 - 70)</th>
                            <th style="width: 15%; border: 1px solid #000;">Baik (71 - 85)</th>
                            <th style="width: 15%; border: 1px solid #000;">Sangat Baik (86 - 100)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${kktpRows}
                    </tbody>
                </table>
                ${teacherSign}
            </div>
        `;
        return { success: true, items: [{ title: `KKTP - ${subjectName}`, htmlContent: html }] };
    }

    if (deviceType === 'prota') {
        let totalJP = 0;
        const protaRows = validPlans.map((p, idx) => {
            const topicClean = removeModulPrefix(p.topic || p.title || subjectName) || `${subjectName} Bab ${idx + 1}`;
            const jp = 6;
            totalJP += jp;
            const smt = idx < Math.ceil(validPlans.length / 2) ? '1 (Ganjil)' : '2 (Genap)';
            return `
                <tr>
                    <td style="border: 1px solid #000; text-align: center;">${smt}</td>
                    <td style="border: 1px solid #000; text-align: center;">${idx + 1}</td>
                    <td style="border: 1px solid #000;"><b>${topicClean}</b></td>
                    <td style="border: 1px solid #000; text-align: center;">${jp} JP</td>
                    <td style="border: 1px solid #000;">3 Pertemuan x 2 JP</td>
                </tr>
            `;
        }).join('');

        const html = `
            <div style="font-family: Arial, sans-serif; color: #000; line-height: 1.4; font-size: 10pt; padding: 20px; background: #fff; max-width: 900px; margin: 0 auto; border: 1px solid #cbd5e1; border-radius: 8px;">
                <h2 style="text-align: center; font-size: 14pt; font-weight: bold; text-transform: uppercase; margin-bottom: 12px;">PROGRAM TAHUNAN (PROTA)</h2>
                <table style="width: 100%; margin-bottom: 15px; font-size: 10pt; border: none;">
                    <tr><td style="width: 18%; border:none;">Satuan Pendidikan</td><td style="width: 32%; border:none;">: ${sName}</td><td style="width: 18%; border:none;">Kelas / Tingkat</td><td style="width: 32%; border:none;">: ${g}</td></tr>
                    <tr><td style="border:none;">Mata Pelajaran</td><td style="border:none;">: ${subjectName}</td><td style="border:none;">Tahun Pelajaran</td><td style="border:none;">: 2024/2025</td></tr>
                </table>

                <table style="width: 100%; border-collapse: collapse; font-size: 9.5pt;" border="1" cellpadding="6">
                    <thead>
                        <tr style="background-color: #f1f5f9; text-align: center; font-weight: bold; border: 1px solid #000;">
                            <th style="width: 18%; border: 1px solid #000;">Semester</th>
                            <th style="width: 8%; border: 1px solid #000;">No Bab</th>
                            <th style="width: 44%; border: 1px solid #000;">Materi Pokok / Lingkup Pembelajaran</th>
                            <th style="width: 15%; border: 1px solid #000;">Alokasi Waktu</th>
                            <th style="width: 15%; border: 1px solid #000;">Keterangan</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${protaRows}
                        <tr style="background-color: #f8fafc; font-weight: bold;">
                            <td colspan="3" style="border: 1px solid #000; text-align: right; padding-right: 15px;">TOTAL ALOKASI WAKTU SATU TAHUN</td>
                            <td style="border: 1px solid #000; text-align: center;">${totalJP} JP</td>
                            <td style="border: 1px solid #000; text-align: center;">Tuntas</td>
                        </tr>
                    </tbody>
                </table>
                ${teacherSign}
            </div>
        `;
        return { success: true, items: [{ title: `PROTA - ${subjectName}`, htmlContent: html }] };
    }

    if (deviceType === 'prosem') {
        const prosemRows = validPlans.map((p, idx) => {
            const topicClean = removeModulPrefix(p.topic || p.title || subjectName) || `${subjectName} Bab ${idx + 1}`;
            return `
                <tr>
                    <td style="border: 1px solid #000; text-align: center;">${idx + 1}</td>
                    <td style="border: 1px solid #000;"><b>${topicClean}</b></td>
                    <td style="border: 1px solid #000; text-align: center;">6</td>
                    <td style="border: 1px solid #000; text-align: center;">2</td>
                    <td style="border: 1px solid #000; text-align: center;">2</td>
                    <td style="border: 1px solid #000; text-align: center;">2</td>
                    <td style="border: 1px solid #000; text-align: center;">-</td>
                    <td style="border: 1px solid #000; text-align: center;">-</td>
                    <td style="border: 1px solid #000; text-align: center;">-</td>
                    <td style="border: 1px solid #000; text-align: center;">-</td>
                    <td style="border: 1px solid #000; text-align: center;">-</td>
                    <td style="border: 1px solid #000; text-align: center;">-</td>
                    <td style="border: 1px solid #000; text-align: center;">-</td>
                    <td style="border: 1px solid #000; text-align: center;">-</td>
                    <td style="border: 1px solid #000; text-align: center;">-</td>
                </tr>
            `;
        }).join('');

        const html = `
            <div style="font-family: Arial, sans-serif; color: #000; line-height: 1.4; font-size: 10pt; padding: 20px; background: #fff; max-width: 1050px; margin: 0 auto; border: 1px solid #cbd5e1; border-radius: 8px;">
                <h2 style="text-align: center; font-size: 14pt; font-weight: bold; text-transform: uppercase; margin-bottom: 12px;">PROGRAM SEMESTER (PROSEM)</h2>
                <table style="width: 100%; margin-bottom: 15px; font-size: 10pt; border: none;">
                    <tr><td style="width: 18%; border:none;">Satuan Pendidikan</td><td style="width: 32%; border:none;">: ${sName}</td><td style="width: 18%; border:none;">Semester</td><td style="width: 32%; border:none;">: 1 (Ganjil)</td></tr>
                    <tr><td style="border:none;">Mata Pelajaran</td><td style="border:none;">: ${subjectName}</td><td style="border:none;">Tahun Pelajaran</td><td style="border:none;">: 2024/2025</td></tr>
                </table>

                <table style="width: 100%; border-collapse: collapse; font-size: 8pt;" border="1" cellpadding="4">
                    <thead>
                        <tr style="background-color: #f1f5f9; text-align: center; font-weight: bold; border: 1px solid #000;">
                            <th rowspan="2" style="width: 4%; border: 1px solid #000;">No</th>
                            <th rowspan="2" style="width: 28%; border: 1px solid #000;">Materi Pokok / Bab</th>
                            <th rowspan="2" style="width: 6%; border: 1px solid #000;">Jml JP</th>
                            <th colspan="2" style="border: 1px solid #000;">Juli</th>
                            <th colspan="2" style="border: 1px solid #000;">Agustus</th>
                            <th colspan="2" style="border: 1px solid #000;">September</th>
                            <th colspan="2" style="border: 1px solid #000;">Oktober</th>
                            <th colspan="2" style="border: 1px solid #000;">November</th>
                            <th colspan="2" style="border: 1px solid #000;">Desember</th>
                        </tr>
                        <tr style="background-color: #e2e8f0; text-align: center; font-weight: bold; border: 1px solid #000;">
                            <th style="width: 4%; border: 1px solid #000;">3</th><th style="width: 4%; border: 1px solid #000;">4</th>
                            <th style="width: 4%; border: 1px solid #000;">1</th><th style="width: 4%; border: 1px solid #000;">2</th>
                            <th style="width: 4%; border: 1px solid #000;">1</th><th style="width: 4%; border: 1px solid #000;">2</th>
                            <th style="width: 4%; border: 1px solid #000;">1</th><th style="width: 4%; border: 1px solid #000;">2</th>
                            <th style="width: 4%; border: 1px solid #000;">1</th><th style="width: 4%; border: 1px solid #000;">2</th>
                            <th style="width: 4%; border: 1px solid #000;">1</th><th style="width: 4%; border: 1px solid #000;">2</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${prosemRows}
                    </tbody>
                </table>
                ${teacherSign}
            </div>
        `;
        return { success: true, items: [{ title: `PROSEM - ${subjectName}`, htmlContent: html }] };
    }

    if (deviceType === 'analisis_kikd') {
        const rows = validPlans.map((p, idx) => {
            const topicClean = removeModulPrefix(p.topic || p.title || subjectName) || `${subjectName} Bab ${idx + 1}`;
            return `
                <tr>
                    <td style="border: 1px solid #000; text-align: center; vertical-align: top;">${idx + 1}</td>
                    <td style="border: 1px solid #000; vertical-align: top;"><b>${topicClean}</b></td>
                    <td style="border: 1px solid #000; vertical-align: top;">Memahami, menganalisis, serta menerapkan kaidah konseptual dan prosedural materi ${topicClean} secara terstruktur.</td>
                    <td style="border: 1px solid #000; vertical-align: top;">
                        <b>Kognitif:</b> C4 (Menganalisis) & C5 (Mengevaluasi)<br>
                        <b>Psikomotor:</b> P3 (Presisi) / P4 (Artikulasi)<br>
                        <b>Afektif:</b> A3 (Menghargai Nilai)
                    </td>
                    <td style="border: 1px solid #000; vertical-align: top;">Integrasi Mindful & Meaningful Learning Profil Pelajar Pancasila</td>
                    <td style="border: 1px solid #000; text-align: center; vertical-align: top;">6 JP</td>
                </tr>
            `;
        }).join('');

        const html = `
            <div style="font-family: Arial, sans-serif; color: #000; line-height: 1.4; font-size: 10pt; padding: 20px; background: #fff; max-width: 1000px; margin: 0 auto; border: 1px solid #cbd5e1; border-radius: 8px;">
                <h2 style="text-align: center; font-size: 14pt; font-weight: bold; text-transform: uppercase; margin-bottom: 4px;">ANALISIS CAPAIAN PEMBELAJARAN (CP / KI-KD)</h2>
                <p style="text-align: center; font-size: 10pt; color: #047857; font-weight: bold; margin-bottom: 12px;">${mainAnalysis.curriculumHeader}</p>
                <table style="width: 100%; margin-bottom: 15px; font-size: 10pt; border: none;">
                    <tr><td style="width: 18%; border:none;">Satuan Pendidikan</td><td style="width: 32%; border:none;">: ${sName}</td><td style="width: 18%; border:none;">Kelas / Tingkat</td><td style="width: 32%; border:none;">: ${g}</td></tr>
                    <tr><td style="border:none;">Mata Pelajaran</td><td style="border:none;">: ${subjectName}</td><td style="border:none;">Tahun Pelajaran</td><td style="border:none;">: 2024/2025</td></tr>
                </table>

                <table style="width: 100%; border-collapse: collapse; font-size: 8.5pt;" border="1" cellpadding="6">
                    <thead>
                        <tr style="background-color: #f1f5f9; text-align: center; font-weight: bold; border: 1px solid #000;">
                            <th style="width: 4%; border: 1px solid #000;">No</th>
                            <th style="width: 18%; border: 1px solid #000;">Elemen / Bab</th>
                            <th style="width: 28%; border: 1px solid #000;">Capaian Pembelajaran (CP)</th>
                            <th style="width: 22%; border: 1px solid #000;">Analisis Dimensi Kognitif & Psikomotor</th>
                            <th style="width: 20%; border: 1px solid #000;">Pendekatan Pancasila & Diferensiasi</th>
                            <th style="width: 8%; border: 1px solid #000;">Waktu</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows}
                    </tbody>
                </table>
                ${teacherSign}
            </div>
        `;
        return { success: true, items: [{ title: `Analisis CP - ${subjectName}`, htmlContent: html }] };
    }

    if (deviceType === 'tp') {
        const rows = validPlans.map((p, idx) => {
            const topicClean = removeModulPrefix(p.topic || p.title || subjectName) || `${subjectName} Bab ${idx + 1}`;
            return `
                <tr>
                    <td style="border: 1px solid #000; text-align: center; vertical-align: top;">${idx + 1}</td>
                    <td style="border: 1px solid #000; vertical-align: top;"><b>${topicClean}</b></td>
                    <td style="border: 1px solid #000; vertical-align: top;">Peserta didik mampu memahami, menganalisis, dan mempraktikkan konsep ${topicClean}.</td>
                    <td style="border: 1px solid #000; vertical-align: top;">
                        ${idx + 1}.1 Menjelaskan definisi, prinsip pokok, dan landasan ${topicClean}<br>
                        ${idx + 1}.2 Menganalisis alur prosedur dan pemecahan kasus ${topicClean}<br>
                        ${idx + 1}.3 Mendemonstrasikan keterampilan unjuk kerja dan komitmen nilai
                    </td>
                    <td style="border: 1px solid #000; text-align: center; vertical-align: top;">6 JP</td>
                </tr>
            `;
        }).join('');

        const html = `
            <div style="font-family: Arial, sans-serif; color: #000; line-height: 1.4; font-size: 10pt; padding: 20px; background: #fff; max-width: 1000px; margin: 0 auto; border: 1px solid #cbd5e1; border-radius: 8px;">
                <h2 style="text-align: center; font-size: 14pt; font-weight: bold; text-transform: uppercase; margin-bottom: 4px;">TUJUAN PEMBELAJARAN (TP) RINCI</h2>
                <p style="text-align: center; font-size: 10pt; color: #047857; font-weight: bold; margin-bottom: 12px;">${mainAnalysis.curriculumHeader}</p>
                <table style="width: 100%; margin-bottom: 15px; font-size: 10pt; border: none;">
                    <tr><td style="width: 18%; border:none;">Satuan Pendidikan</td><td style="width: 32%; border:none;">: ${sName}</td><td style="width: 18%; border:none;">Kelas / Tingkat</td><td style="width: 32%; border:none;">: ${g}</td></tr>
                    <tr><td style="border:none;">Mata Pelajaran</td><td style="border:none;">: ${subjectName}</td><td style="border:none;">Tahun Pelajaran</td><td style="border:none;">: 2024/2025</td></tr>
                </table>

                <table style="width: 100%; border-collapse: collapse; font-size: 8.5pt;" border="1" cellpadding="6">
                    <thead>
                        <tr style="background-color: #ecfdf5; text-align: center; font-weight: bold; border: 1px solid #000;">
                            <th style="width: 4%; border: 1px solid #000;">No</th>
                            <th style="width: 18%; border: 1px solid #000;">Elemen Pembelajaran</th>
                            <th style="width: 28%; border: 1px solid #000;">Capaian Pembelajaran (CP)</th>
                            <th style="width: 42%; border: 1px solid #000;">Tujuan Pembelajaran (TP) Rinci</th>
                            <th style="width: 8%; border: 1px solid #000;">Alokasi</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows}
                    </tbody>
                </table>
                ${teacherSign}
            </div>
        `;
        return { success: true, items: [{ title: `TP Rinci - ${subjectName}`, htmlContent: html }] };
    }

    if (deviceType === 'cp') {
        const rows = validPlans.map((p, idx) => {
            const topicClean = removeModulPrefix(p.topic || p.title || subjectName) || `${subjectName} Bab ${idx + 1}`;
            return `
                <tr>
                    <td style="border: 1px solid #000; text-align: center; vertical-align: top;">${idx + 1}</td>
                    <td style="border: 1px solid #000; vertical-align: top;"><b>${topicClean}</b></td>
                    <td style="border: 1px solid #000; vertical-align: top;">Pada akhir fase ini, peserta didik mampu menguasai pengetahuan konseptual, menganalisis fenomena kontekstual, dan memecahkan persoalan ${topicClean} secara mandiri, bernalar kritis, dan bertanggung jawab.</td>
                    <td style="border: 1px solid #000; vertical-align: top;">${mainAnalysis.profilPelajar} &bull; Profil Pelajar Pancasila</td>
                </tr>
            `;
        }).join('');

        const html = `
            <div style="font-family: Arial, sans-serif; color: #000; line-height: 1.4; font-size: 10pt; padding: 20px; background: #fff; max-width: 1000px; margin: 0 auto; border: 1px solid #cbd5e1; border-radius: 8px;">
                <h2 style="text-align: center; font-size: 14pt; font-weight: bold; text-transform: uppercase; margin-bottom: 4px;">CAPAIAN PEMBELAJARAN (CP) FASE</h2>
                <p style="text-align: center; font-size: 10pt; color: #047857; font-weight: bold; margin-bottom: 12px;">${mainAnalysis.curriculumHeader}</p>
                <table style="width: 100%; margin-bottom: 15px; font-size: 10pt; border: none;">
                    <tr><td style="width: 18%; border:none;">Satuan Pendidikan</td><td style="width: 32%; border:none;">: ${sName}</td><td style="width: 18%; border:none;">Fase / Kelas</td><td style="width: 32%; border:none;">: Fase D/E/F - ${g}</td></tr>
                    <tr><td style="border:none;">Mata Pelajaran</td><td style="border:none;">: ${subjectName}</td><td style="border:none;">Tahun Pelajaran</td><td style="border:none;">: 2024/2025</td></tr>
                </table>

                <table style="width: 100%; border-collapse: collapse; font-size: 9pt;" border="1" cellpadding="6">
                    <thead>
                        <tr style="background-color: #f0fdf4; text-align: center; font-weight: bold; border: 1px solid #000;">
                            <th style="width: 5%; border: 1px solid #000;">No</th>
                            <th style="width: 22%; border: 1px solid #000;">Elemen Pembelajaran</th>
                            <th style="width: 48%; border: 1px solid #000;">Deskripsi Capaian Pembelajaran (CP) Fase</th>
                            <th style="width: 25%; border: 1px solid #000;">Profil Pelajar & Pancasila</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows}
                    </tbody>
                </table>
                ${teacherSign}
            </div>
        `;
        return { success: true, items: [{ title: `CP Fase - ${subjectName}`, htmlContent: html }] };
    }

    if (deviceType === 'lkpd') {
        const lkpdBlocks = validPlans.map((p, idx) => {
            const topicClean = removeModulPrefix(p.topic || p.title || subjectName) || `${subjectName} Bab ${idx + 1}`;
            const subAnalysis = analyzeSubjectAndTopic(subjectName, topicClean, '');
            return `
                <div style="border: 1px solid #000; border-radius: 6px; padding: 15px; margin-bottom: 20px; background: #fff;">
                    <h3 style="margin: 0 0 8px 0; font-size: 12pt; color: #1e293b; font-weight: bold; text-align: center; border-bottom: 2px solid #000; padding-bottom: 6px;">
                        LEMBAR KERJA PESERTA DIDIK (LKPD) - BAB ${idx + 1}: ${topicClean.toUpperCase()}
                    </h3>
                    <p style="font-size: 9pt; margin-bottom: 10px;"><b>Mata Pelajaran:</b> ${subjectName} &nbsp;|&nbsp; <b>Kelas:</b> ${g} &nbsp;|&nbsp; <b>Nama Kelompok:</b> ...................................</p>
                    
                    <p style="font-size: 9.5pt; font-weight: bold; margin: 8px 0 4px 0; color: #047857;">AKTIVITAS 1: Pemetaan Konsep & Landasan Pokok</p>
                    <table style="width: 100%; border-collapse: collapse; font-size: 8.5pt;" border="1" cellpadding="5">
                        <tr style="background-color: #f1f5f9; font-weight: bold;">
                            <th style="width: 30%;">Aspek / Komponen</th>
                            <th style="width: 40%;">Deskripsi & Penjelasan Siswa</th>
                            <th style="width: 30%;">Bukti Landasan / Relevansi</th>
                        </tr>
                        <tr><td>${subAnalysis.lkpdRows[0].col1}</td><td>${subAnalysis.lkpdRows[0].col2}</td><td>${subAnalysis.lkpdRows[0].col3}</td></tr>
                        <tr><td>${subAnalysis.lkpdRows[1].col1}</td><td>${subAnalysis.lkpdRows[1].col2}</td><td>${subAnalysis.lkpdRows[1].col3}</td></tr>
                    </table>

                    <p style="font-size: 9.5pt; font-weight: bold; margin: 12px 0 4px 0; color: #047857;">AKTIVITAS 2: Analisis Pemecahan Masalah Kontekstual</p>
                    <div style="font-size: 9pt; background: #f8fafc; padding: 8px; border: 1px solid #cbd5e1; border-radius: 4px;">
                        <b>Pertanyaan Kasus:</b> ${subAnalysis.caseStudyQuestions[0]}<br><br>
                        <b>Ruang Jawab Diskusi Kelompok:</b><br><br><br><br>
                    </div>

                    <p style="font-size: 9.5pt; font-weight: bold; margin: 12px 0 4px 0; color: #047857;">AKTIVITAS 3: Refleksi & Komitmen Pembiasaan Pancasila</p>
                    <p style="font-size: 8.5pt; margin: 0;">Tuliskan 1 tindakan nyata berbudi pekerti luhur dan penuh kepedulian yang akan kamu wujudkan setelah mempelajari materi ${topicClean}:</p>
                    <div style="font-size: 9pt; border: 1px dashed #94a3b8; padding: 8px; min-height: 40px; margin-top: 4px;"></div>
                </div>
            `;
        }).join('');

        const html = `
            <div style="font-family: Arial, sans-serif; color: #000; line-height: 1.4; font-size: 10pt; padding: 20px; background: #fff; max-width: 900px; margin: 0 auto; border: 1px solid #cbd5e1; border-radius: 8px;">
                <h2 style="text-align: center; font-size: 14pt; font-weight: bold; text-transform: uppercase; margin-bottom: 4px;">KUMPULAN LEMBAR KERJA PESERTA DIDIK (LKPD)</h2>
                <p style="text-align: center; font-size: 10pt; color: #047857; font-weight: bold; margin-bottom: 15px;">${mainAnalysis.curriculumHeader}</p>
                ${lkpdBlocks}
                ${teacherSign}
            </div>
        `;
        return { success: true, items: [{ title: `LKPD - ${subjectName}`, htmlContent: html }] };
    }

    // Default Fallback / Perangkat Lainnya
    const deviceNameMap = {
        'analisis_kikd': 'ANALISIS CAPAIAN PEMBELAJARAN (CP / KI-KD)',
        'tp': 'TUJUAN PEMBELAJARAN (TP) RINCI',
        'cp': 'CAPAIAN PEMBELAJARAN (CP) FASE',
        'lkpd': 'LEMBAR KERJA PESERTA DIDIK (LKPD) KUMPULAN'
    };

    const docTitle = deviceNameMap[deviceType] || `${deviceType.toUpperCase()} PEMBELAJARAN`;

    const genericRows = validPlans.map((p, idx) => {
        const topicClean = removeModulPrefix(p.topic || p.title || subjectName) || `${subjectName} Bab ${idx + 1}`;
        return `
            <div style="border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px; margin-bottom: 12px; background: #fafafa;">
                <h4 style="margin: 0 0 6px 0; font-size: 11pt; color: #1e293b; font-weight: bold;">Bab ${idx + 1}: ${topicClean}</h4>
                <p style="margin: 0 0 4px 0; font-size: 9.5pt;"><b>Tujuan Pembelajaran:</b> Peserta didik mampu menjelaskan konsep dasar, menganalisis kaidah prosedural, serta memecahkan kasus pembelajaran kontekstual terkait ${topicClean}.</p>
                <p style="margin: 0 0 4px 0; font-size: 9pt; color: #475569;"><b>Alokasi Waktu:</b> 6 JP (3 Pertemuan) | <b>Profil Pelajar:</b> Bernalar Kritis, Bergotong Royong, Berakhlak Mulia.</p>
                <div style="font-size: 9pt; background: #fff; padding: 8px; border: 1px dashed #cbd5e1; border-radius: 4px; margin-top: 6px;">
                    <b>Aktivitas Pembelajaran:</b> Telaah materi konsep & dasar hukum &bull; Analisis kasus pembelajaran pemecahan masalah &bull; Praktik unjuk kerja & evaluasi sumatif HOTS.
                </div>
            </div>
        `;
    }).join('');

    const html = `
        <div style="font-family: Arial, sans-serif; color: #000; line-height: 1.4; font-size: 10pt; padding: 20px; background: #fff; max-width: 900px; margin: 0 auto; border: 1px solid #cbd5e1; border-radius: 8px;">
            <h2 style="text-align: center; font-size: 14pt; font-weight: bold; text-transform: uppercase; margin-bottom: 12px;">${docTitle}</h2>
            <table style="width: 100%; margin-bottom: 15px; font-size: 10pt; border: none;">
                <tr><td style="width: 18%; border:none;">Satuan Pendidikan</td><td style="width: 32%; border:none;">: ${sName}</td><td style="width: 18%; border:none;">Kelas / Tingkat</td><td style="width: 32%; border:none;">: ${g}</td></tr>
                <tr><td style="border:none;">Mata Pelajaran</td><td style="border:none;">: ${subjectName}</td><td style="border:none;">Tahun Pelajaran</td><td style="border:none;">: 2024/2025</td></tr>
            </table>

            <div style="margin-bottom: 20px;">
                ${genericRows}
            </div>

            ${teacherSign}
        </div>
    `;

    return { success: true, items: [{ title: `${docTitle} - ${subjectName}`, htmlContent: html }] };
}

// Generate Standar PPT Non-AI
function generatePPTNonAIData(plans = [], subjectName = 'Mata Pelajaran', grade = 'VII', theme = 'midnight', defaultTopic = '') {
    const validPlans = (Array.isArray(plans) && plans.length > 0)
        ? plans
        : [{ title: subjectName, topic: subjectName, grade: grade || 'VII' }];

    const targetTopic = defaultTopic || removeModulPrefix(validPlans[0]?.topic || validPlans[0]?.title || subjectName);
    const analysis = analyzeSubjectAndTopic(subjectName, targetTopic, '');

    return {
        title: targetTopic,
        subtitle: `${subjectName} - Kelas ${grade}`,
        slides: [
            {
                slideNumber: 1,
                title: targetTopic,
                subtitle: `Media Pembelajaran Interaktif ${subjectName}`,
                category: "PEMBUKAAN",
                bullets: [
                    `Mata Pelajaran : ${subjectName}`,
                    `Fase / Kelas : ${grade}`,
                    `Tahun Pelajaran : 2024 / 2025`
                ],
                speakerNotes: "Guru membuka presentasi dengan salam hangat, apersepsi pertanyaan pemantik, dan membangkitkan rasa ingin tahu siswa.",
                interactiveQuestion: {
                    question: `Apa yang pertama kali terlintas di pikiran kalian saat mendengar kata '${targetTopic}'?`,
                    answer: "Setiap gagasan awal kalian adalah langkah penting untuk memahami materi ini secara mendalam!"
                }
            },
            {
                slideNumber: 2,
                title: "Tujuan Pembelajaran & Profil Pelajar",
                subtitle: "Kompetensi Utama yang Ingin Dicapai",
                category: "TUJUAN",
                bullets: [
                    `Memahami pengertian, konsep pokok, dan dasar rujukan ${targetTopic}`,
                    `Mampu menganalisis alur prosedur atau kaidah penting secara kritis`,
                    `Menyelesaikan persoalan kasus pembelajaran nyata secara kolaboratif`,
                    `Menginternalisasi nilai Profil Pelajar Pancasila & Rahmatan Lil 'Alamin`
                ],
                speakerNotes: "Ajak siswa membaca target tujuan pembelajaran agar mereka memahami capaian akhir yang diharapkan.",
                interactiveQuestion: {
                    question: "Manakah tujuan pembelajaran yang paling membuat kalian tertantang?",
                    answer: "Semua tujuan dirancang saling menguatkan antara pengetahuan teoritis dan pengamalan nyata."
                }
            },
            {
                slideNumber: 3,
                title: "Pertanyaan Pemantik & Apersepsi",
                subtitle: "Eksplorasi Konteks Nyata",
                category: "APERSEPSI",
                bullets: [
                    `Mengapa pembahasan mengenai ${targetTopic} sangat penting dalam kehidupan kita?`,
                    `Bagaimana jadinya jika kita tidak menerapkan prinsip dasar materi ini dengan benar?`,
                    `Apa saja tantangan atau kekeliruan umum yang sering dijumpai di masyarakat?`
                ],
                speakerNotes: "Berikan kesempatan kepada 2-3 peserta didik untuk mengutarakan pendapat awal mereka.",
                interactiveQuestion: {
                    question: "Pernahkah kalian mengamati peristiwa terkait materi ini di lingkungan sekitar?",
                    answer: "Contoh nyata di sekitar kita adalah laboratorium terbaik untuk belajar!"
                }
            },
            {
                slideNumber: 4,
                title: analysis.focusTitle1,
                subtitle: "Konsep Pokok & Pengertian Dasar",
                category: "KONSEP",
                bullets: [
                    `Pengertian dan batasan ruang lingkup materi secara terminologis`,
                    `Landasan rujukan ilmiah dan dalil pokok yang mendasarinya`,
                    `Komponen utama yang menyusun keutuhan materi ${targetTopic}`
                ],
                speakerNotes: "Jelaskan definisi secara gamblang dengan menggunakan analogi yang dekat dengan keseharian siswa.",
                interactiveQuestion: {
                    question: `Sebutkan 1 kata kunci terpenting dari definisi ${targetTopic}!`,
                    answer: "Kata kunci tersebut membantu kita mengingat intisari konsep secara cepat."
                }
            },
            {
                slideNumber: 5,
                title: analysis.focusTitle2,
                subtitle: "Alur Prosedur & Analisis Kaidah",
                category: "PEMBAHASAN",
                bullets: [
                    `Tahapan alur pelaksanaan atau keterkaitan antar unsur materi`,
                    `Kaidah penting yang harus dipenuhi agar capaian sah dan optimal`,
                    `Faktor-faktor yang dapat membatalkan atau merusak keabsahan/keberhasilan`
                ],
                speakerNotes: "Arahkan siswa mencatat alur tahapan atau poin-poin kaidah secara runtut di buku catatan.",
                interactiveQuestion: {
                    question: "Mengapa urutan langkah atau kaidah penting harus diperhatikan secara tertib?",
                    answer: "Ketertiban alur memastikan setiap tujuan tercapai secara sah dan terhindar dari kesalahan fatal."
                }
            },
            {
                slideNumber: 6,
                title: "Pemecahan Masalah & Diskusi Kelompok",
                subtitle: "Penalaran Kritis (Critical Thinking)",
                category: "STUDI KASUS",
                bullets: [
                    analysis.caseStudyQuestions[0],
                    `Bekerjasamalah dalam kelompok untuk mendiskusikan bukti dan alternatif solusi`,
                    `Tuliskan hasil telaah pada LKPD dan siapkan perwakilan untuk presentasi`
                ],
                speakerNotes: "Fasilitasi kerja kelompok dan bimbing siswa yang membutuhkan scaffolding.",
                interactiveQuestion: {
                    question: "Apa solusi terbaik menurut kelompok kalian?",
                    answer: "Solusi yang baik adalah yang berpijak pada data/kaidah yang valid serta santun dan aplikatif."
                }
            },
            {
                slideNumber: 7,
                title: "Kuis Interaktif Cek Pemahaman",
                subtitle: "Uji Daya Ingat & Pemahaman Kilat",
                category: "EVALUASI",
                bullets: [
                    `Pilihlah opsi yang paling tepat untuk pertanyaan berikut:`,
                    `Dalam penerapan ${targetTopic}, hal utama yang harus selalu kita utamakan adalah...`,
                    `A. Mengabaikan prosedur demi kecepatan`,
                    `B. Mengikuti kaidah secara tertib, jujur, dan bertanggung jawab`,
                    `C. Menganggap materi hanya sebatas teori semata`
                ],
                speakerNotes: "Ajak seluruh kelas menjawab serentak atau memilih perwakilan siswa.",
                interactiveQuestion: {
                    question: "Jawaban yang benar adalah...?",
                    answer: "Jawaban Benar: B. Mengikuti kaidah secara tertib, jujur, dan bertanggung jawab!"
                }
            },
            {
                slideNumber: 8,
                title: "Rangkuman, Refleksi & Komitmen Diri",
                subtitle: "Pesan Moral & Motivasi",
                category: "PENUTUP",
                bullets: [
                    `Penguasaan terhadap ${targetTopic} membimbing kita menjadi pribadi yang berilmu dan berakhlak mulia`,
                    `Jadikan ilmu yang dipelajari sebagai pedoman nyata dalam bertindak setiap hari`,
                    `Teruslah bersemangat belajar dan menuntut ilmu demi kemaslahatan umat dan bangsa`
                ],
                speakerNotes: "Tutup sesi presentasi dengan doa penutup majelis dan motivasi penuh kasih sayang (Pancasila).",
                interactiveQuestion: {
                    question: "Apa komitmen pribadimu setelah mempelajari materi ini?",
                    answer: "Ilmu yang berkah adalah ilmu yang diamalkan dalam perbuatan nyata!"
                }
            }
        ]
    };
}

// Generate Standar Poster Non-AI
function generatePosterNonAIData(plans = [], subjectName = 'Mata Pelajaran', grade = 'VII', theme = 'modern', defaultTopic = '') {
    const validPlans = (Array.isArray(plans) && plans.length > 0)
        ? plans
        : [{ title: subjectName, topic: subjectName, grade: grade || 'VII' }];

    const targetTopic = defaultTopic || removeModulPrefix(validPlans[0]?.topic || validPlans[0]?.title || subjectName);
    const analysis = analyzeSubjectAndTopic(subjectName, targetTopic, '');

    return {
        title: `Infografis Interaktif: ${targetTopic}`,
        subtitle: `Media Pembelajaran Visual ${subjectName} Kelas ${grade}`,
        illustrationTitle: `Diagram Konsep & Peta Alur ${targetTopic}`,
        illustrationDescription: "Klik atau arahkan kursor pada hotspot bernyala untuk membedah detail komponen materi secara mendalam.",
        imageUrl: "",
        hotspots: [
            {
                id: "h1",
                x: 25,
                y: 30,
                label: "1. Landasan & Definisi",
                detail: `Memahami konsep mendasar dan rujukan pokok dari ${targetTopic} sebagai fondasi keilmuan yang kokoh.`
            },
            {
                id: "h2",
                x: 75,
                y: 30,
                label: "2. Syarat & Rukun / Komponen",
                detail: `Unsur-unsur esensial yang wajib dipenuhi dalam ${targetTopic} agar sah dan berjalan optimal.`
            },
            {
                id: "h3",
                x: 50,
                y: 65,
                label: "3. Prosedur & Langkah Nyata",
                detail: `Alur tata cara pelaksanaan bertahap secara tertib, sistematis, dan sesuai kaidah yang benar.`
            },
            {
                id: "h4",
                x: 30,
                y: 85,
                label: "4. Analisis Masalah & Solusi",
                detail: `Kecakapan berpikir kritis untuk mengidentifikasi kesalahan umum dan merumuskan solusi yang bijak.`
            },
            {
                id: "h5",
                x: 70,
                y: 85,
                label: "5. Hikmah & Karakter Mulia",
                detail: `Penerapan nilai kesalehan, kedisiplinan, dan tanggung jawab sosial dalam kehidupan sehari-hari.`
            }
        ],
        corePillars: [
            {
                title: "Pemahaman Konseptual",
                desc: `Menguasai hakikat makna, ruang lingkup, dan dalil/dasar rujukan materi ${targetTopic}.`,
                icon: "fa-solid fa-brain"
            },
            {
                title: "Ketelitian Prosedural",
                desc: "Menerapkan langkah-langkah praktis secara tertib, teliti, dan sesuai dengan standar yang berlaku.",
                icon: "fa-solid fa-list-check"
            },
            {
                title: "Internalisasi Karakter",
                desc: "Mewujudkan nilai-nilai kejujuran, gotong royong, dan moderasi beragama dalam pergaulan sehari-hari.",
                icon: "fa-solid fa-heart"
            }
        ],
        funFacts: [
            `Memahami ${targetTopic} secara terpadu terbukti meningkatkan daya nalar kritis dan ketenangan batin peserta didik.`,
            "Penerapan materi secara konsisten membentuk kebiasaan hidup yang disiplin, teratur, dan berdaya guna tinggi."
        ],
        inspirasionalQuote: `Ilmu adalah lentera penuntun, dan amal nyata adalah bukti keimanan sejati pada materi ${targetTopic}.`,
        keyTakeaway: `Kuasai konsepnya, amalkan prosedurnya, dan sebarkan kebaikannya dalam kehidupan bermasyarakat.`
    };
}

// Expose all functions to window for global compatibility
window.analyzeSubjectAndTopic = analyzeSubjectAndTopic;
window.getComprehensiveModulAjarStandardData = getComprehensiveModulAjarStandardData;
window.generateSoalKisiNonAIStandardData = generateSoalKisiNonAIStandardData;
window.generateRPPLengkapNonAIData = generateRPPLengkapNonAIData;
window.generateDeviceDocumentNonAIData = generateDeviceDocumentNonAIData;
window.generatePPTNonAIData = generatePPTNonAIData;
window.generatePosterNonAIData = generatePosterNonAIData;
