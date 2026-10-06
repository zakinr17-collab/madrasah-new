// Master Generative Rules Engine V2 (Refactored & Audited - Strict fokus Lock)
// Rules-Based Non-AI Modul Ajar Generator

import sentenceBank from './data/sentence_bank.json' with { type: 'json' };
import rulesData from './data/rules.json' with { type: 'json' };

export function parseAlokasiJP(alokasiString = '') {
    if (!alokasiString || typeof alokasiString !== 'string') return 4;
    const jpMatch = alokasiString.match(/(\d+)\s*JP/i);
    if (jpMatch) return parseInt(jpMatch[1], 10) || 4;
    const menitMatch = alokasiString.match(/(\d+)\s*x\s*\d+/i);
    if (menitMatch) return parseInt(menitMatch[1], 10) || 4;
    const numMatch = alokasiString.match(/(\d+)/);
    if (numMatch) {
        const val = parseInt(numMatch[1], 10);
        if (val > 0 && val <= 40) return val;
    }
    return 4;
}

function getPatternIndex(seedString, maxOptions, nonce = 0) {
    if (!maxOptions || maxOptions <= 0) return 0;
    const combined = `${seedString}_nonce_${nonce}`;
    let hash = 0;
    for (let i = 0; i < combined.length; i++) {
        hash = ((hash << 5) - hash) + combined.charCodeAt(i);
        hash |= 0;
    }
    const x = Math.sin(hash + 0.12345) * 10000;
    const randVal = x - Math.floor(x);
    return Math.floor(randVal * maxOptions);
}

export function autoDetectMaterialType(subjectName = '', topic = '', subbab = '', detail = '') {
    const combined = `${subjectName} ${topic} ${subbab} ${detail}`.toLowerCase();
    const subj = (subjectName || '').toLowerCase();
    
    // Subject overrides (top priority)
    if (subj.includes('arab') || subj.includes('inggris') || subj.includes('indonesia') || subj.includes('jerman') || subj.includes('prancis') || subj.includes('bahasa')) return 'BAHASA';
    if (subj.includes('matematika') || subj.includes('math')) return 'MATEMATIKA';
    if (subj.includes('biologi') || subj.includes('fisika') || subj.includes('kimia') || subj.includes('ipa')) return 'ILMU_ALAM';
    if (subj.includes('sejarah') || subj.includes('geografi') || subj.includes('sosiologi') || subj.includes('ekonomi') || subj.includes('ips') || subj.includes('pkn')) return 'ILMU_SOSIAL';
    if (subj.includes('pjok') || subj.includes('jasmani') || subj.includes('olahraga')) return 'PJOK';
    if (subj.includes('seni') || subj.includes('art') || subj.includes('budaya') || subj.includes('prakarya')) return 'PROYEK';

    // Original detection
    if (/\b(ai|generative ai|prompt|kecerdasan buatan|chatgpt|gemini|llm|machine learning|model ai|bias ai)\b/.test(combined)) {
        return 'AI';
    }
    if (/\b(etika digital|keamanan siber|jejak digital|privasi|hoaks|hak cipta|literasi digital|sosial media|phishing)\b/.test(combined)) {
        return 'ETIKA_DIGITAL';
    }
    if (/\b(koding|coding|pemrograman|program|c\+\+|python|pascal|javascript|html|css|syntax|sintaks|if-else|if else|loop|for|while|array|variabel|debugging|compiler|ide|unoardusim|arduino)\b/.test(combined)) {
        return 'KODING';
    }
    if (/\b(jaringan|network|router|switch|ip address|ip|topologi|lan|wan|wifi|konektivitas|troubleshooting|cyber|keamanan jaringan)\b/.test(combined)) {
        return 'JARINGAN';
    }
    if (/\b(algoritma|flowchart|pseudocode|dekomposisi|abstraksi|berpikir komputasional|computational thinking|pengurutan|pencarian)\b/.test(combined)) {
        return 'ALGORITMA';
    }
    if (/\b(data|dataset|tabel|grafik|analisis data|visualisasi|statistik|excel|spreadsheet|database|sql)\b/.test(combined)) {
        return 'DATA';
    }
    if (/\b(proyek|prototipe|produk|karya|inovasi|pameran|perancangan)\b/.test(combined)) {
        return 'PROYEK';
    }
    if (/\b(bahasa|teks|hiwar|qira|istima|kitabah|mufradat|grammar|vocabulary|speaking|listening|reading|writing|dialog|percakapan)\b/.test(combined)) {
        return 'BAHASA';
    }
    return 'KONSEP';
}

export function deriveTopicVocabulary(materiInti) {
    if (!materiInti || typeof materiInti !== 'string') {
        return {
            main: "Konsep Utama",
            list: ["Konsep Utama", "Langkah Terkait", "Penerapan Praktis", "Materi Inti"]
        };
    }

    const cleanMateri = materiInti.replace(/&/g, 'dan').replace(/dan/gi, 'dan').replace(/atau/gi, 'atau').trim();
    const parts = cleanMateri.split(/(?:dan|atau|,\s*|\bserta\b|-|\/)/gi)
        .map(p => p.trim())
        .filter(p => p.length > 2);

    const list = [];
    for (const part of parts) {
        const cleaned = part.replace(/^[^a-zA-Z0-9\s]+|[^a-zA-Z0-9\s]+$/g, '').trim();
        if (cleaned.length > 2 && !list.includes(cleaned)) {
            list.push(cleaned);
        }
    }

    const genericModifiers = [
        'manajemen', 'istilah', 'struktur', 'dasar', 'konsep', 'proses', 'sistem', 
        'teknik', 'pengenalan', 'studi', 'analisis', 'teori', 'penggunaan', 'aplikasi', 
        'metode', 'penerapan', 'dalam', 'dengan', 'yang', 'untuk', 'pada', 'dan', 
        'atau', 'serta', 'dari', 'tentang', 'secara', 'contoh'
    ];

    // Sub-phrase extraction (non-mechanically splitting)
    const subPhrases = [];
    for (const part of list) {
        const words = part.split(/\s+/).map(w => w.replace(/[^a-zA-Z0-9]/g, '').trim()).filter(w => w.length > 2);
        
        // Remove prefix modifiers to get clean sub-phrases (e.g., "Istilah Struktur Pemrograman" -> "Struktur Pemrograman")
        if (words.length >= 2) {
            if (genericModifiers.includes(words[0].toLowerCase())) {
                const sub = words.slice(1).join(' ');
                // Ensure the extracted sub-phrase remains a coherent compound term of at least 2 words (Rule 6)
                if (sub.split(/\s+/).length >= 2) {
                    if (sub.length > 2 && !subPhrases.includes(sub)) {
                        subPhrases.push(sub);
                    }
                }
            }
        }
    }

    // Combine primary segments with sub-phrases
    for (const sp of subPhrases) {
        if (!list.some(item => item.toLowerCase() === sp.toLowerCase())) {
            list.push(sp);
        }
    }

    if (list.length === 0) {
        list.push(cleanMateri);
    }

    const formattedList = list.map(item => {
        return item.split(/\s+/).map(word => {
            if (word.length === 0) return '';
            return word[0].toUpperCase() + word.substring(1).toLowerCase();
        }).join(' ');
    });

    // Pad to 4 items using compound phrases
    while (formattedList.length < 4) {
        const fallbackWord = formattedList[0] || 'Konsep';
        formattedList.push(fallbackWord);
    }

    return {
        main: formattedList[0] || cleanMateri,
        list: formattedList
    };
}

export function resolveTerm(term, materi) {
    const lower = (materi || '').toLowerCase();
    const t = term.toLowerCase();
    
    if (lower.includes(t)) {
        return term;
    }
    
    const fallbacks = {
        'syntax': 'aturan penulisan',
        'sintaks': 'aturan penulisan',
        'debugging': 'pengujian hasil',
        'debug': 'pemeriksaan',
        'if-else': 'alur keputusan',
        'if else': 'alur keputusan',
        'percabangan': 'alur keputusan',
        'perulangan': 'proses berulang',
        'loop': 'proses berulang',
        'variabel': 'parameter data',
        'fungsi': 'peran utama/kegunaan',
        'objek': 'komponen',
        'pseudocode': 'notasi langkah terstruktur',
        'flowchart': 'diagram alur',
        'bagan alur': 'diagram alur',
        'prompt engineering': 'penerapan praktis',
        'prompt-engineering': 'penerapan praktis',
        'prompt': 'instruksi',
        'prompts': 'instruksi',
        'dataset': 'data',
        'data set': 'data',
        'data-set': 'data',
        'hallucination': 'kekeliruan informasi',
        'halusinasi': 'kesalahan',
        'bias': 'keterbatasan',
        'bias ai': 'keterbatasan',
        'asisten ai': 'asisten cerdas',
        'asisten cerdas': 'asisten cerdas',
        'teknologi cerdas': 'teknologi cerdas',
        'model ai': 'sistem cerdas',
        'router': 'node penghubung',
        'switch': 'perangkat hub',
        'ip address': 'identitas koneksi',
        'alamat ip': 'identitas koneksi',
        'topologi': 'skema struktur',
        'spreadsheet': 'aplikasi pengolah data',
        'phishing': 'ancaman keamanan digital',
        'hoaks': 'informasi palsu',
        'hoax': 'informasi palsu'
    };
    
    return fallbacks[t] || term;
}

export function replacePlaceholdersRecursive(obj, safeMateri, safeSubbab, safeBab) {
    if (typeof obj === 'string') {
        let s = obj
            .replace(/{{MATERI_INTI}}/g, safeMateri)
            .replace(/{{KONSEP_UTAMA}}/g, safeSubbab)
            .replace(/{{BAB_UTAMA}}/g, safeBab)
            .replace(/{{SUBBAB}}/g, safeSubbab);
            
        s = s.replace(/{{[A-Z0-9_]+}}/g, safeMateri);
        return s;
    } else if (Array.isArray(obj)) {
        return obj.map(item => replacePlaceholdersRecursive(item, safeMateri, safeSubbab, safeBab));
    } else if (typeof obj === 'object' && obj !== null) {
        const copy = {};
        for (const key of Object.keys(obj)) {
            copy[key] = replacePlaceholdersRecursive(obj[key], safeMateri, safeSubbab, safeBab);
        }
        return copy;
    }
    return obj;
}

export function runSelfValidation(result, safeMateri, selectedJenis) {
    const vocab = deriveTopicVocabulary(safeMateri);
    const checkedFields = ['capaianPembelajaran', 'tujuanPembelajaran', 'pertanyaanPemantik', 'kegiatanPembelajaran', 'lkpd', 'asesmen', 'glosarium'];
    
    let scoredSections = 0;
    let successfulSections = 0;
    for (const field of checkedFields) {
        if (!result[field]) continue;
        scoredSections++;
        const valStr = String(result[field]).toLowerCase();
        let sectionHasTopic = false;
        for (const term of vocab.list) {
            if (valStr.includes(term.toLowerCase())) {
                sectionHasTopic = true;
            }
        }
        
        let sectionHasBias = false;
        const forbiddenDefaults = [
            'prompt engineering', 'hallucination', 'dataset', 'bias ai', 'fact-checking', 'generative ai', 'model ai',
            'syntax', 'debugging', 'if-else', 'sintaks', 'perulangan', 'percabangan',
            'router', 'switch', 'ip address', 'topologi', 'alamat ip',
            'spreadsheet',
            'flowchart', 'pseudocode', 'tracing', 'bagan alur',
            'phishing', 'hoaks'
        ];
        for (const word of forbiddenDefaults) {
            if (!safeMateri.toLowerCase().includes(word) && valStr.includes(word)) {
                sectionHasBias = true;
            }
        }

        if (sectionHasTopic && !sectionHasBias) {
            successfulSections++;
        }
    }
    const topicDominance = scoredSections > 0 ? (successfulSections / scoredSections) * 100 : 100;

    let missingTerms = 0;
    for (const term of vocab.list) {
        let found = false;
        for (const field of checkedFields) {
            if (result[field] && String(result[field]).toLowerCase().includes(term.toLowerCase())) {
                found = true;
                break;
            }
        }
        if (!found) {
            missingTerms++;
        }
    }
    const topicDrift = vocab.list.length > 0 ? (missingTerms / vocab.list.length) * 100 : 0;

    let leakageCount = 0;
    const allForbiddens = {
        AI: ['router', 'switch', 'ip address', 'syntax', 'if-else', 'flowchart', 'pseudocode', 'tracing'],
        KODING: ['router', 'ip address', 'topologi', 'ping', 'model ai', 'prompt engineering', 'kecerdasan artifisial', 'kecerdasan buatan', 'asisten cerdas', 'teknologi cerdas', 'sistem cerdas'],
        JARINGAN: ['syntax error', 'prompt engineering', 'model ai', 'flowchart', 'pseudocode', 'kecerdasan artifisial', 'kecerdasan buatan', 'asisten cerdas', 'teknologi cerdas', 'sistem cerdas'],
        DATA: ['router', 'ip address', 'syntax', 'debugging', 'flowchart', 'pseudocode', 'prompt engineering', 'kecerdasan artifisial', 'kecerdasan buatan', 'asisten cerdas', 'teknologi cerdas', 'sistem cerdas'],
        ALGORITMA: ['router', 'ip address', 'prompt engineering', 'model ai', 'phishing', 'kecerdasan artifisial', 'kecerdasan buatan', 'asisten cerdas', 'teknologi cerdas', 'sistem cerdas'],
        ETIKA_DIGITAL: ['router', 'ip address', 'syntax', 'debugging', 'flowchart', 'pseudocode', 'kecerdasan artifisial', 'kecerdasan buatan', 'asisten cerdas', 'teknologi cerdas', 'sistem cerdas'],
        PROYEK: ['router', 'ip address', 'syntax', 'debugging', 'flowchart', 'pseudocode', 'kecerdasan artifisial', 'kecerdasan buatan', 'asisten cerdas', 'teknologi cerdas', 'sistem cerdas'],
        KONSEP: ['router', 'ip address', 'syntax', 'debugging', 'flowchart', 'pseudocode', 'prompt engineering', 'kecerdasan artifisial', 'kecerdasan buatan', 'asisten cerdas', 'teknologi cerdas', 'sistem cerdas']
    };
    const forbiddenList = allForbiddens[selectedJenis] || [];
    for (const word of forbiddenList) {
        if (safeMateri.toLowerCase().includes(word)) continue;
        for (const field of Object.keys(result)) {
            if (['kompetensiAwal', 'profilPancasila', 'saranaPrasarana', 'targetPeserta', 'selectedJenis'].includes(field)) continue;
            const valStr = String(result[field] || '').toLowerCase();
            let isLeaking = false;
            if (word === 'ping') {
                // Check for whole word "ping" using regex to avoid matching "pendampingan"
                isLeaking = /\bping\b/i.test(valStr);
            } else {
                isLeaking = valStr.includes(word);
            }
            if (isLeaking) {
                leakageCount++;
            }
        }
    }
    const domainLeakage = leakageCount;

    let defaultSubtopicOverride = 0;
    const allDefaults = [
        'prompt engineering', 'hallucination', 'dataset', 'bias ai', 'fact-checking', 'generative ai', 'model ai',
        'syntax', 'debugging', 'if-else', 'sintaks', 'perulangan', 'percabangan',
        'router', 'switch', 'ip address', 'topologi', 'alamat ip',
        'spreadsheet',
        'flowchart', 'pseudocode', 'tracing', 'bagan alur',
        'phishing', 'hoaks'
    ];
    for (const word of allDefaults) {
        if (safeMateri.toLowerCase().includes(word)) continue;
        for (const field of Object.keys(result)) {
            if (['kompetensiAwal', 'profilPancasila', 'saranaPrasarana', 'targetPeserta', 'selectedJenis'].includes(field)) continue;
            const valStr = String(result[field] || '').toLowerCase();
            if (valStr.includes(word)) {
                defaultSubtopicOverride++;
            }
        }
    }

    const domainTemplateBias = defaultSubtopicOverride > 0;

    let unresolvedPlaceholder = 0;
    const placeholderRegex = /{{[A-Z0-9_]+}}/g;
    for (const field of Object.keys(result)) {
        const valStr = String(result[field] || '');
        const matches = valStr.match(placeholderRegex);
        if (matches) {
            unresolvedPlaceholder += matches.length;
        }
    }

    let irrelevantVocabulary = 0;
    const otherKeywords = [];
    const allKeys = ['AI', 'KODING', 'JARINGAN', 'DATA', 'ALGORITMA', 'ETIKA_DIGITAL', 'PROYEK', 'KONSEP'];
    for (const k of allKeys) {
        if (k === selectedJenis) continue;
        const kw = rulesData.material_types[k]?.keywords || [];
        otherKeywords.push(...kw);
    }
    for (const word of otherKeywords) {
        if (safeMateri.toLowerCase().includes(word.toLowerCase())) continue;
        for (const field of Object.keys(result)) {
            if (['kompetensiAwal', 'profilPancasila', 'saranaPrasarana', 'targetPeserta', 'selectedJenis'].includes(field)) continue;
            const valStr = String(result[field] || '').toLowerCase();
            if (valStr.includes(word.toLowerCase())) {
                irrelevantVocabulary++;
            }
        }
    }

    return {
        topicDominance,
        topicDrift,
        domainLeakage,
        defaultSubtopicOverride,
        domainTemplateBias,
        unresolvedPlaceholder,
        irrelevantVocabulary
    };
}

const domainCapaian = {
    AI: "Peserta didik mampu memahami konsep dasar Kecerdasan Artifisial (AI), teknik penyusunan prompt terstruktur, evaluasi keluaran model, analisis bias, serta etika dan privasi penggunaan sistem AI.",
    DATA: "Peserta didik mampu mengumpulkan dataset, melakukan pembersihan data (data cleaning), mengolah variabel, membuat visualisasi grafik yang komunikatif, dan menarik kesimpulan berbasis analisis data.",
    JARINGAN: "Peserta didik mampu memahami arsitektur jaringan komputer, fungsi perangkat keras (router, switch), konfigurasi alamat IP, pengujian konektivitas, dan analisis pemecahan gangguan (troubleshooting).",
    ALGORITMA: "Peserta didik mampu melakukan dekomposisi masalah, merancang langkah logis, menyusun flowchart dan pseudocode, serta melakukan penelusuran (tracing) untuk memastikan kebenaran alur penyelesaian.",
    KODING: "Peserta didik mampu menuliskan baris kode program (syntax) menggunakan struktur percabangan, perulangan, dan variabel, serta melakukan pengujian dan perbaikan kesalahan (debugging).",
    ETIKA_DIGITAL: "Peserta didik mampu mengenali jejak digital, mengidentifikasi hoaks dan disinformasi melalui verifikasi fakta, menghargai hak cipta, serta menerapkan keamanan data pribadi dan etika siber.",
    PROYEK: "Peserta didik mampu merencanakan perancangan produk inovasi digital dari identifikasi masalah, penyusunan spesifikasi, pembuatan prototipe, hingga uji coba dan presentasi karya.",
    KONSEP: "Peserta didik mampu memahami definisi, hakikat, ruang lingkup, dan struktur teori konsep keilmuan serta mengaitkannya dengan fenomena di dunia nyata."
};

const domainTP = {
    AI: {
        C1_C2: "Peserta didik mampu menjelaskan prinsip kerja dasar model AI Generatif, struktur prompt, dan karakteristik luaran AI.",
        C3_C4: "Peserta didik mampu merancang prompt terstruktur (role, context, instruction) serta menguji dan membandingkan variasi luaran AI.",
        C5_C6: "Peserta didik mampu mengevaluasi akurasi, potensi bias, dan isu halusinasi luaran AI, serta menyusun panduan etika penggunaan AI."
    },
    DATA: {
        C1_C2: "Peserta didik mampu mengidentifikasi jenis dataset, tipe variabel, dan komponen tabel pengolahan data.",
        C3_C4: "Peserta didik mampu membersihkan data mentah dan menggunakan perangkat spreadsheet untuk menghasilkan visualisasi grafik yang relevan.",
        C5_C6: "Peserta didik mampu menganalisis tren dari grafik visual serta menyusun rekomendasi keputusan berbasis bukti data."
    },
    JARINGAN: {
        C1_C2: "Peserta didik mampu menjelaskan fungsi perangkat keras jaringan (router, switch, node) dan konsep dasar topologi.",
        C3_C4: "Peserta didik mampu mengonfigurasi alamat IP (IP address) dan melakukan pengujian koneksi menggunakan perintah ping.",
        C5_C6: "Peserta didik mampu menganalisis titik gangguan koneksi (troubleshooting) dan mengevaluasi keamanan akses jaringan."
    },
    ALGORITMA: {
        C1_C2: "Peserta didik mampu menjelaskan konsep dekomposisi masalah dan fungsi simbol-simbol dasar flowchart.",
        C3_C4: "Peserta didik mampu merancang flowchart dan pseudocode secara sistematis serta melakukan penelusuran (tracing) jalannya proses.",
        C5_C6: "Peserta didik mampu mengevaluasi keefektifan alur logika, mendeteksi infinite loop, dan menyempurnakan rancangan algoritma."
    },
    KODING: {
        C1_C2: "Peserta didik mampu mengenali struktur dasar syntax, variabel, dan tipe data dalam bahasa pemrograman.",
        C3_C4: "Peserta didik mampu menuliskan kode program dengan struktur percabangan (if-else) atau perulangan serta melakukan eksekusi program.",
        C5_C6: "Peserta didik mampu mendeteksi syntax error/logic error, melakukan debugging, dan menguji ketahanan skrip program."
    },
    ETIKA_DIGITAL: {
        C1_C2: "Peserta didik mampu menjelaskan pentingnya privasi akun, hak cipta, dan dampak negatif penyebaran hoaks.",
        C3_C4: "Peserta didik mampu menerapkan teknik verifikasi fakta (fact-checking) terhadap informasi digital dan mengevaluasi keamanan akun.",
        C5_C6: "Peserta didik mampu merancang kampanye budaya siber yang positif dan menyusun panduan digital hygiene mandiri."
    },
    PROYEK: {
        C1_C2: "Peserta didik mampu mengidentifikasi kebutuhan pengguna dan mendefinisikan masalah nyata untuk solusi proyek.",
        C3_C4: "Peserta didik mampu merancang spesifikasi produk dan membangun prototipe solusi digital secara kolaboratif.",
        C5_C6: "Peserta didik mampu melakukan uji coba produk, mengumpulkan umpan balik (feedback), dan mempresentasikan karya akhir."
    },
    BAHASA: {
        C1_C2: "Peserta didik mampu melafalkan dan mengartikan kosakata serta ungkapan dasar dengan tepat.",
        C3_C4: "Peserta didik mampu menggunakan ungkapan dan tata bahasa dalam kalimat atau percakapan sederhana.",
        C5_C6: "Peserta didik mampu menyusun dan mempresentasikan teks atau dialog secara fasih dan bermakna."
    },
    KONSEP: {
        C1_C2: "Peserta didik mampu menjelaskan definisi dan karakteristik dasar dari konsep keilmuan yang dipelajari.",
        C3_C4: "Peserta didik mampu menguraikan komponen-komponen teori dan menyusun peta konsep (mind map) yang runtut.",
        C5_C6: "Peserta didik mampu menganalisis penerapan teori dalam penerapan materi nyata dan menyusun kesimpulan komprehensif."
    }
};

const domainRefleksiStud = {
    AI: "1. Bagian mana dari materi \"{{MATERI_INTI}}\" yang paling menarik bagi kalian?\n2. Bagaimana cara kalian memastikan hasil atau informasi terkait \"{{MATERI_INTI}}\" dapat dipercaya dan terbebas dari bias?",
    DATA: "1. Pengalaman apa yang paling berkesan saat mengolah data dan membuat visualisasi terkait \"{{MATERI_INTI}}\"?\n2. Bagaimana data membantu kita mengambil keputusan secara objektif?",
    JARINGAN: "1. Tantangan apa yang kalian hadapi saat merancang koneksi atau memecahkan masalah terkait \"{{MATERI_INTI}}\"?\n2. Mengapa pemahaman tentang arsitektur dan sistem koneksi sangat penting di era digital?",
    ALGORITMA: "1. Bagaimana proses dekomposisi dan perancangan langkah logis membantu menyelesaikan masalah terkait \"{{MATERI_INTI}}\"?\n2. Mengapa penelusuran alur penting untuk membuktikan kebenaran logika?",
    KODING: "1. Pengalaman apa yang kalian peroleh saat menuliskan instruksi program dan memperbaiki error (debugging) terkait \"{{MATERI_INTI}}\"?\n2. Mengapa ketelitian dalam logika penulisan sangat menentukan keberhasilan program?",
    ETIKA_DIGITAL: "1. Pelajaran penting apa yang kalian dapatkan mengenai tanggung jawab siber dan privasi terkait \"{{MATERI_INTI}}\"?\n2. Bagaimana cara kalian menerapkan budaya siber yang santun dan aman dalam kehidupan sehari-hari?",
    PROYEK: "1. Pengalaman paling berharga apa yang kalian rasakan saat merancang prototipe produk \"{{MATERI_INTI}}\" bersama tim?\n2. Bagaimana cara kelompok menghadapi perbedaan pendapat dan umpan balik pengguna?",
    BAHASA: "1. Kesulitan apa yang paling dirasakan saat mempraktikkan kosakata atau ungkapan terkait \"{{MATERI_INTI}}\"?\n2. Bagaimana cara kalian mengatasi rasa gugup saat berbicara menggunakan bahasa tersebut di depan kelas?",
    KONSEP: "1. Bagaimana peta konsep membantu kalian memahami teori \"{{MATERI_INTI}}\" secara utuh?\n2. Contoh penerapan apa di sekitar kalian yang paling mencerminkan konsep yang dipelajari?"
};

const domainRefleksiTeach = {
    AI: "1. Apakah peserta didik mampu menguasai konsep dasar \"{{MATERI_INTI}}\" dengan aktif?\n2. Seberapa efektif pemahaman peserta didik mengenai etika dan verifikasi hasil terkait \"{{MATERI_INTI}}\"?",
    DATA: "1. Apakah peserta didik dapat memvisualisasikan data \"{{MATERI_INTI}}\" dengan tepat?\n2. Bagaimana pemahaman peserta didik dalam merumuskan kesimpulan berbasis analisis data?",
    JARINGAN: "1. Apakah peserta didik memahami skema koneksi atau sistem \"{{MATERI_INTI}}\" dengan baik?\n2. Seberapa efektif bimbingan dalam mengatasi kendala teknis peserta didik?",
    ALGORITMA: "1. Apakah peserta didik dapat menyusun alur logis \"{{MATERI_INTI}}\" secara runtut dan sistematis?\n2. Bagaimana efektivitas latihan desk-check dalam menemukan kesalahan logika?",
    KODING: "1. Apakah peserta didik dapat memahami instruksi program dan struktur logika \"{{MATERI_INTI}}\" dengan baik?\n2. Seberapa efektif proses bimbingan praktikum dalam membantu peserta didik melakukan debugging?",
    ETIKA_DIGITAL: "1. Apakah peserta didik mampu mengidentifikasi risiko keamanan siber atau hoaks terkait \"{{MATERI_INTI}}\" secara kritis?\n2. Bagaimana antusiasme peserta didik dalam menyusun kampanye etika digital?",
    PROYEK: "1. Apakah kolaborasi dan manajemen proyek dalam tim untuk \"{{MATERI_INTI}}\" berjalan dengan efektif?\n2. Seberapa baik kualitas prototipe dan presentasi karya yang dihasilkan peserta didik?",
    BAHASA: "1. Apakah peserta didik sudah mampu melafalkan kosakata \"{{MATERI_INTI}}\" dengan fasih dan tepat?\n2. Seberapa antusias peserta didik saat mempraktikkan dialog atau menyusun teks mandiri?",
    KONSEP: "1. Apakah peserta didik mampu menguasai definisi dan kerangka teoretis terkait \"{{MATERI_INTI}}\" dengan baik?\n2. Seberapa aktif peserta didik dalam menghubungkan konsep dengan penerapan materi nyata?"
};

function getDomainBahanAjar(type, safeSubject, safeMateri, safeSubbab) {
    const subj = (safeSubject || '').toLowerCase();
    if (subj.includes('arab') || subj.includes('inggris') || subj.includes('indonesia') || subj.includes('jerman') || subj.includes('prancis') || subj.includes('bahasa')) {
        return `Ringkasan Materi & Bahan Bacaan (${safeSubbab}):\nMateri "${safeMateri}" merupakan fokus kajian kebahasaan dan komunikasi pada bab ini.\nKonsep Utama: Pemahaman kosakata esensial, struktur tata bahasa (qawaid/grammar), serta ungkapan komunikasi aktif seputar "${safeMateri}".\nLangkah Belajar: Cermati teks/dialog model, tirukan pelafalan yang benar, pelajari makna kata penting, dan gunakan dalam latihan percakapan mandiri atau berpasangan.`;
    }
    if (subj.includes('matematika') || subj.includes('math')) {
        return `Ringkasan Materi & Bahan Bacaan (${safeSubbab}):\nMateri "${safeMateri}" merupakan fokus konsep perhitungan, pola, dan pemodelan matematis pada bab ini.\nKonsep Utama: Prinsip, rumus, dan hubungan matematis yang mendasari penyelesaian masalah "${safeMateri}".\nLangkah Belajar: Pahami definisi konsep, pelajari contoh soal langkah demi langkah, dan selesaikan latihan soal terstruktur mulai dari pemahaman dasar hingga pemecahan masalah (HOTS).`;
    }
    if (subj.includes('biologi') || subj.includes('fisika') || subj.includes('kimia') || subj.includes('ipa')) {
        return `Ringkasan Materi & Bahan Bacaan (${safeSubbab}):\nMateri "${safeMateri}" merupakan fokus penyelidikan ilmiah dan telaah fenomena alam pada bab ini.\nKonsep Utama: Struktur, fungsi, mekanisme, atau hukum ilmiah yang mendasari fenomena "${safeMateri}".\nLangkah Belajar: Amati objek/gejala kontekstual, rumuskan pertanyaan penyelidikan ilmiah, lakukan analisis data observasi, dan simpulkan keteraturan ilmiah yang ditemukan.`;
    }
    if (subj.includes('sejarah') || subj.includes('geografi') || subj.includes('sosiologi') || subj.includes('ekonomi') || subj.includes('ips') || subj.includes('pkn')) {
        return `Ringkasan Materi & Bahan Bacaan (${safeSubbab}):\nMateri "${safeMateri}" merupakan fokus kajian historis, spasial, sosial, atau kewarganegaraan pada bab ini.\nKonsep Utama: Latar belakang peristiwa, dinamika interaksi, hubungan sebab-akibat, serta dampak sosial dari kajian "${safeMateri}".\nLangkah Belajar: Telusuri sumber literatur terpercaya, analisis kronologi dan hubungan kausalitas, diskusikan perbedaan sudut pandang, dan rumuskan simpulan kritis.`;
    }
    if (subj.includes('pjok') || subj.includes('jasmani') || subj.includes('olahraga')) {
        return `Ringkasan Materi & Bahan Bacaan (${safeSubbab}):\nMateri "${safeMateri}" merupakan fokus penguasaan gerak fisik dan keterampilan motorik pada bab ini.\nKonsep Utama: Teknik dasar, efisiensi mekanika gerak, kebugaran, dan keselamatan dalam beraktivitas terkait "${safeMateri}".\nLangkah Belajar: Lakukan pemanasan teratur, cermati demonstrasi teknik yang benar, lakukan latihan drill berulang secara bertahap, dan terapkan nilai sportivitas saat evaluasi.`;
    }
    return `Ringkasan Materi & Bahan Bacaan (${safeSubbab}):\nMateri "${safeMateri}" merupakan fokus kajian utama pada bab ini.\nKonsep Utama: Prinsip konseptual dan kerangka kerja dasar terkait "${safeMateri}" untuk pemecahan masalah kontekstual.\nLangkah Belajar: Pelajari konsep esensial, diskusikan implementasi nyata, lakukan kajian analitis terstruktur, dan susun simpulan yang komprehensif.`;
}

function getDomainLKPD(type, safeSubject, safeMateri, safeGrade, safeSemester) {
    const subj = (safeSubject || '').toLowerCase();
    let cat = 'KONSEP';
    if (subj.includes('arab') || subj.includes('inggris') || subj.includes('indonesia') || subj.includes('jerman') || subj.includes('prancis') || subj.includes('bahasa')) cat = 'BAHASA';
    else if (subj.includes('matematika') || subj.includes('math')) cat = 'MATEMATIKA';
    else if (subj.includes('biologi') || subj.includes('fisika') || subj.includes('kimia') || subj.includes('ipa')) cat = 'ILMU_ALAM';
    else if (subj.includes('sejarah') || subj.includes('geografi') || subj.includes('sosiologi') || subj.includes('ekonomi') || subj.includes('ips') || subj.includes('pkn')) cat = 'ILMU_SOSIAL';
    else if (subj.includes('pjok') || subj.includes('jasmani') || subj.includes('olahraga')) cat = 'PJOK';

    const lkpdData = {
        BAHASA: {
            act1: `Pemahaman Kosakata & Teks "${safeMateri}"`,
            act1_desc: `1. Baca dan cermati teks/dialog berbahasa terkait "${safeMateri}".\n2. Identifikasi kosakata baru dan carilah maknanya secara mandiri.`,
            act2: `Latihan Tata Bahasa & Struktur "${safeMateri}"`,
            act2_desc: `1. Perhatikan pola kalimat yang digunakan dalam ungkapan "${safeMateri}".\n2. Lengkapilah bagian rumpang pada latihan soal dengan kata/ungkapan yang tepat.`,
            act3: `Praktik & Unjuk Kerja "${safeMateri}"`,
            act3_desc: `1. Susunlah percakapan atau teks pendek orisinal terkait topik "${safeMateri}".\n2. Praktikkan bersama rekan kelompok dengan memperhatikan pelafalan dan intonasi yang benar.`
        },
        MATEMATIKA: {
            act1: `Eksplorasi Konsep Dasar "${safeMateri}"`,
            act1_desc: `1. Amati masalah kontekstual yang disajikan terkait "${safeMateri}".\n2. Rumuskan informasi apa yang diketahui dan apa yang ditanyakan.`,
            act2: `Latihan Prosedural "${safeMateri}"`,
            act2_desc: `1. Gunakan rumus atau langkah penyelesaian yang tepat untuk memecahkan persoalan "${safeMateri}".\n2. Selesaikan serangkaian soal latihan secara cermat dan sistematis.`,
            act3: `Penerapan & Pemecahan Masalah "${safeMateri}"`,
            act3_desc: `1. Diskusikan penyelesaian soal cerita (Higher Order Thinking) yang melibatkan prinsip "${safeMateri}".\n2. Sajikan langkah penyelesaian kalian dan lakukan verifikasi kebenaran hasil akhir.`
        },
        ILMU_ALAM: {
            act1: `Observasi Fenomena "${safeMateri}"`,
            act1_desc: `1. Amati bahan/objek simulasi terkait "${safeMateri}" dengan teliti.\n2. Catat temuan awal dan rumuskan pertanyaan penyelidikan ilmiah.`,
            act2: `Pengumpulan Data & Analisis "${safeMateri}"`,
            act2_desc: `1. Lakukan eksperimen/pengamatan terstruktur mengenai "${safeMateri}".\n2. Catat data hasil percobaan ke dalam tabel observasi yang rapi.`,
            act3: `Menarik Kesimpulan "${safeMateri}"`,
            act3_desc: `1. Diskusikan keterkaitan antara hasil data percobaan "${safeMateri}" dengan landasan teori.\n2. Rumuskan kesimpulan akhir dan sampaikan di depan kelas.`
        },
        ILMU_SOSIAL: {
            act1: `Identifikasi Isu/Latar Belakang "${safeMateri}"`,
            act1_desc: `1. Kaji sumber literatur terkait latar belakang historis/spasial/sosial dari "${safeMateri}".\n2. Tuliskan poin-poin utama dan fakta-fakta relevan yang kalian temukan.`,
            act2: `Analisis Hubungan & Dinamika "${safeMateri}"`,
            act2_desc: `1. Diskusikan hubungan sebab-akibat atau dinamika yang terjadi pada fenomena "${safeMateri}".\n2. Gunakan berbagai sudut pandang untuk menganalisis dampaknya.`,
            act3: `Evaluasi & Sintesis "${safeMateri}"`,
            act3_desc: `1. Rangkum argumen utama dari diskusi tentang isu "${safeMateri}".\n2. Susun laporan analisis akhir yang memuat simpulan kritis dan rekomendasi tindak lanjut.`
        },
        PJOK: {
            act1: `Pemahaman Gerak Dasar "${safeMateri}"`,
            act1_desc: `1. Amati demonstrasi atau panduan visual mengenai teknik "${safeMateri}".\n2. Catat tahapan pelaksanaan gerak secara berurutan dan bagian tubuh yang dominan digunakan.`,
            act2: `Latihan Mandiri/Berpasangan "${safeMateri}"`,
            act2_desc: `1. Praktikkan gerakan "${safeMateri}" sesuai tahapan yang benar (awalan, pelaksanaan, akhir).\n2. Lakukan pengamatan (peer observation) terhadap teknik rekan kalian.`,
            act3: `Penerapan & Evaluasi Fisik "${safeMateri}"`,
            act3_desc: `1. Terapkan keterampilan "${safeMateri}" ke dalam situasi bermain sederhana atau latihan terukur.\n2. Lakukan evaluasi terhadap keselamatan dan keefektifan gerak.`
        },
        KONSEP: {
            act1: `Identifikasi Konsep Dasar "${safeMateri}"`,
            act1_desc: `1. Pelajari karakteristik utama dari konsep "${safeMateri}" secara mandiri.\n2. Tuliskan deskripsi ringkas mengenai hakikat dan tujuan "${safeMateri}".`,
            act2: `Pemahaman Lanjutan "${safeMateri}"`,
            act2_desc: `1. Diskusikan bersama kelompok mengenai penerapan prinsip "${safeMateri}" dalam berbagai skenario.\n2. Kategorikan bagian-bagian pendukung dari "${safeMateri}" secara terstruktur.`,
            act3: `Analisis Kritis & Penerapan "${safeMateri}"`,
            act3_desc: `1. Lakukan kajian mendalam terhadap penyelesaian masalah kontekstual menggunakan prinsip "${safeMateri}".\n2. Susun laporan hasil diskusi secara komprehensif.`
        }
    };

    const sel = lkpdData[cat] || lkpdData['KONSEP'];
    return `13. LEMBAR KERJA PESERTA DIDIK (LKPD)
Mata Pelajaran : ${safeSubject}
Topik / Materi Inti : "${safeMateri}"
Kelas / Semester : ${safeGrade} / ${safeSemester}

Aktivitas 1: ${sel.act1}
${sel.act1_desc}

Aktivitas 2: ${sel.act2}
${sel.act2_desc}

Aktivitas 3: ${sel.act3}
${sel.act3_desc}`;
}

function sanitizeOutputForStrictTopicLock(value, safeMateri, domain) {
    if (typeof value !== 'string') return value;

    const lowerMateri = safeMateri.toLowerCase();
    let result = value;

    const inMateri = (pattern) => lowerMateri.includes(pattern.toLowerCase());

    // 0. Absolute AI fokus Leak Elimination
    const containsAI = /\b(ai|artificial intelligence|generative ai|kecerdasan buatan|kecerdasan artifisial|prompt|rekayasa prompt|prompt-engineering|prompt engineering)\b/i.test(safeMateri);
    
    if (!containsAI) {
        let replacementDomainName = "Sistem / Konsep";
        let replacementPerspektif = "secara sistematis";
        let replacementLatihan = "Latihan Praktik Terstruktur";
        let replacementSistem = "sistem terstruktur";
        let replacementAsisten = "media/alat bantu pendukung";
        
        if (domain === 'KODING') {
            replacementDomainName = "Koding & Pemrograman";
            replacementPerspektif = "secara logis dan terstruktur";
            replacementLatihan = "Latihan Praktik Pemrograman";
            replacementSistem = "struktur logika program";
            replacementAsisten = "media pemrograman";
        } else if (domain === 'JARINGAN') {
            replacementDomainName = "Jaringan Komputer";
            replacementPerspektif = "berbasis skema jaringan";
            replacementLatihan = "Latihan Praktik Jaringan";
            replacementSistem = "sistem konektivitas";
            replacementAsisten = "alat bantu simulasi";
        } else if (domain === 'DATA') {
            replacementDomainName = "Analisis Data";
            replacementPerspektif = "secara analitis";
            replacementLatihan = "Latihan Praktik Analisis Data";
            replacementSistem = "sistem pengolahan data";
            replacementAsisten = "aplikasi pengolah data";
        } else if (domain === 'ALGORITMA') {
            replacementDomainName = "Algoritma & Alur Logika";
            replacementPerspektif = "secara logis";
            replacementLatihan = "Latihan Praktik Algoritma";
            replacementSistem = "bagan alur logika";
            replacementAsisten = "media perancangan";
        }

        result = result.replace(/Latihan Praktik Berbasis Kecerdasan Artifisial \(AI\)/gi, replacementLatihan);
        result = result.replace(/Latihan Praktik Berbasis Kecerdasan Artifisial/gi, replacementLatihan);
        result = result.replace(/Kecerdasan Artifisial \(AI\)/g, replacementDomainName);
        result = result.replace(/Kecerdasan Artifisial/g, replacementDomainName);
        result = result.replace(/Kecerdasan buatan/gi, replacementDomainName);
        result = result.replace(/perspektif Kecerdasan Artifisial/gi, replacementPerspektif);
        result = result.replace(/perspektif cerdas/gi, replacementPerspektif);
        result = result.replace(/menggunakan perspektif cerdas/gi, "secara logis dan kritis");
        result = result.replace(/menggunakan perspektif sistem/gi, "secara logis");
        result = result.replace(/teknologi cerdas/gi, "pendekatan sistematis");
        result = result.replace(/sistem cerdas/gi, replacementSistem);
        result = result.replace(/asisten\/perangkat bantu/gi, "media pembelajaran");
        result = result.replace(/dengan bantuan perangkat bantu/gi, "secara mandiri");
        result = result.replace(/asisten cerdas/gi, replacementAsisten);
        result = result.replace(/asisten ai/gi, replacementAsisten);
        result = result.replace(/model ai/gi, replacementSistem);
        result = result.replace(/model-ai/gi, replacementSistem);
        result = result.replace(/\bmodel ai\b/gi, replacementSistem);
        result = result.replace(/\bAI\b/g, "Sistem");
        result = result.replace(/\bai\b/g, "sistem");
    }

    // 1. AI fokus Hardening & Template Bias Eraser
    if (!inMateri('prompt engineering') && !inMateri('prompt-engineering')) {
        result = result.replace(/\bprompt engineering\b/gi, 'penerapan praktis');
        result = result.replace(/\bprompt-engineering\b/gi, 'penerapan praktis');
        result = result.replace(/\brekayasa prompt\b/gi, 'penerapan praktis');
    }
    if (!inMateri('generative ai') && !inMateri('ai generatif') && !inMateri('kecerdasan buatan') && !inMateri('kecerdasan artifisial')) {
        result = result.replace(/\bgenerative ai\b/gi, 'konsep tingkat lanjut');
        result = result.replace(/\bgenerative-ai\b/gi, 'konsep tingkat lanjut');
        result = result.replace(/\bai generatif\b/gi, 'konsep tingkat lanjut');
    }
    if (!inMateri('model ai') && !inMateri('model-ai')) {
        result = result.replace(/\bmodel ai\b/gi, 'sistem cerdas');
        result = result.replace(/\bmodel-ai\b/gi, 'sistem cerdas');
    }
    if (!inMateri('dataset') && !inMateri('data set') && !inMateri('data-set')) {
        result = result.replace(/\bdataset\b/gi, 'data');
        result = result.replace(/\bdata-set\b/gi, 'data');
        result = result.replace(/\bdata set\b/gi, 'data');
    }
    if (!inMateri('hallucination') && !inMateri('halusinasi')) {
        result = result.replace(/\bhallucination\b/gi, 'kekeliruan informasi');
        result = result.replace(/\bhalusinasi\b/gi, 'kesalahan');
    }
    if (!inMateri('bias')) {
        result = result.replace(/\bbias ai\b/gi, 'ketidakakuratan');
        result = result.replace(/\bbias\b/gi, 'keterbatasan');
    }
    if (!inMateri('fact-checking') && !inMateri('fact checking') && !inMateri('fact-check') && !inMateri('fact check')) {
        result = result.replace(/\bfact-checking\b/gi, 'verifikasi fakta');
        result = result.replace(/\bfact checking\b/gi, 'verifikasi fakta');
        result = result.replace(/\bfact-check\b/gi, 'verifikasi');
        result = result.replace(/\bfact check\b/gi, 'verifikasi');
    }
    if (!inMateri('prompt') && !inMateri('prompts')) {
        result = result.replace(/\bprompt\b/gi, 'instruksi');
        result = result.replace(/\bprompts\b/gi, 'instruksi');
    }
    if (!inMateri('asisten ai') && !inMateri('asisten-ai')) {
        result = result.replace(/\basisten ai\b/gi, 'asisten cerdas');
        result = result.replace(/\basisten-ai\b/gi, 'asisten cerdas');
    }
    if (!inMateri('asisten cerdas')) {
        result = result.replace(/\basisten cerdas\b/gi, 'perangkat bantu');
    }
    if (!inMateri('tools ai') && !inMateri('tools-ai')) {
        result = result.replace(/\btools ai\b/gi, 'media pendukung');
        result = result.replace(/\btools-ai\b/gi, 'media pendukung');
    }
    if (!inMateri('manusia sebagai model ai')) {
        result = result.replace(/\bmanusia sebagai model ai\b/gi, 'peran manusia dalam proses ini');
    }
    if (!inMateri('sistem otomatis') && !inMateri('otomatisasi') && !inMateri('otomatis')) {
        result = result.replace(/\bsistem otomatis\b/gi, 'sistem terstruktur');
        result = result.replace(/\botomatisasi\b/gi, 'proses sistematis');
        result = result.replace(/\botomatis\b/gi, 'sistematis');
    }
    if (!inMateri('teknologi cerdas')) {
        result = result.replace(/\bteknologi cerdas\b/gi, 'metode pendukung');
    }

    // 2. JARINGAN fokus Hardening
    if (!inMateri('router')) {
        result = result.replace(/\brouter\b/gi, 'node penghubung');
    }
    if (!inMateri('switch')) {
        result = result.replace(/\bswitch\b/gi, 'perangkat jaringan');
    }
    if (!inMateri('ip address') && !inMateri('alamat ip') && !inMateri('ip')) {
        result = result.replace(/\bip address\b/gi, 'identitas koneksi');
        result = result.replace(/\balamat ip\b/gi, 'alamat jaringan');
        result = result.replace(/\balamat ip address\b/gi, 'alamat identitas koneksi');
    }
    if (!inMateri('topologi')) {
        result = result.replace(/\btopologi\b/gi, 'skema struktur');
    }

    // 3. KODING fokus Hardening
    if (!inMateri('syntax') && !inMateri('sintaks')) {
        result = result.replace(/\bsyntax\b/gi, 'struktur aturan');
        result = result.replace(/\bsintaks\b/gi, 'aturan penulisan');
    }
    if (!inMateri('debugging') && !inMateri('debug')) {
        result = result.replace(/\bdebugging\b/gi, 'pengujian hasil');
        result = result.replace(/\bdebug\b/gi, 'perbaikan');
    }
    if (!inMateri('if-else') && !inMateri('percabangan')) {
        result = result.replace(/\bif-else\b/gi, 'logika keputusan');
        result = result.replace(/\bif else\b/gi, 'logika keputusan');
        result = result.replace(/\bpercabangan\b/gi, 'alur keputusan');
    }
    if (!inMateri('loop') && !inMateri('perulangan')) {
        result = result.replace(/\bloop\b/gi, 'proses berulang');
        result = result.replace(/\bperulangan\b/gi, 'langkah berulang');
    }
    if (!inMateri('fungsi')) {
        result = result.replace(/fungsionalitasnya/gi, 'kegunaan dan perannya');
        result = result.replace(/fungsionalitas/gi, 'kegunaan dan peran');
        result = result.replace(/fungsional/gi, 'fungsional');
        result = result.replace(/\bfungsi\b/gi, 'kegunaan/peran');
    }
    if (!inMateri('objek')) {
        result = result.replace(/\bobjek\b/gi, 'komponen');
    }
    if (!inMateri('variabel')) {
        result = result.replace(/\bvariabel\b/gi, 'parameter');
    }

    // 4. ALGORITMA fokus Hardening
    if (!inMateri('flowchart') && !inMateri('bagan alur')) {
        result = result.replace(/\bflowchart\b/gi, 'diagram alur');
        result = result.replace(/\bbagan alur\b/gi, 'diagram alur');
    }
    if (!inMateri('pseudocode')) {
        result = result.replace(/\bpseudocode\b/gi, 'notasi langkah terstruktur');
    }
    if (!inMateri('tracing') && !inMateri('penelusuran')) {
        result = result.replace(/\btracing\b/gi, 'pemeriksaan');
        result = result.replace(/\bpenelusuran\b/gi, 'pemeriksaan alur');
    }

    // 5. DATA fokus Hardening
    if (!inMateri('spreadsheet') && !inMateri('spread sheet')) {
        result = result.replace(/\bspreadsheet\b/gi, 'aplikasi pengolah data');
        result = result.replace(/\bspread sheet\b/gi, 'lembar kerja digital');
    }

    // 6. ETIKA_DIGITAL fokus Hardening
    if (!inMateri('phishing')) {
        result = result.replace(/\bphishing\b/gi, 'ancaman keamanan digital');
    }
    if (!inMateri('hoaks') && !inMateri('hoax')) {
        result = result.replace(/\bhoaks\b/gi, 'informasi palsu');
        result = result.replace(/\bhoax\b/gi, 'informasi tidak akurat');
    }

    // 7. KONSEP fokus Hardening
    if (!inMateri('mind map') && !inMateri('mindmap')) {
        result = result.replace(/\bmind map\b/gi, 'peta analisis');
        result = result.replace(/\bmindmap\b/gi, 'peta analisis');
    }
    if (!inMateri('peta konsep')) {
        result = result.replace(/\bpeta konsep\b/gi, 'skema keterhubungan');
    }

    return result;
}

function sanitizeObject(obj, safeMateri, domain) {
    if (typeof obj === 'string') {
        return sanitizeOutputForStrictTopicLock(obj, safeMateri, domain);
    } else if (Array.isArray(obj)) {
        return obj.map(item => sanitizeObject(item, safeMateri, domain));
    } else if (typeof obj === 'object' && obj !== null) {
        const copy = {};
        for (const key of Object.keys(obj)) {
            if (key === 'selectedJenis') {
                copy[key] = obj[key];
            } else {
                copy[key] = sanitizeObject(obj[key], safeMateri, domain);
            }
        }
        return copy;
    }
    return obj;
}

export function generateMasterV2ModulAjar(inputs = {}) {
    const defaultTopic = inputs.topic || inputs.materiInti || inputs.subbab || inputs.babUtama || 'Materi Pokok';
    const {
        schoolName = 'Nama Sekolah',
        teacherName = 'Tim Guru Mata Pelajaran',
        subjectName = 'Mata Pelajaran',
        phase = 'D',
        grade = 'VIII',
        semester = '1',
        babUtama = defaultTopic,
        subbab = defaultTopic,
        materiInti = defaultTopic,
        alokasiWaktu = '4 JP',
        jenisMateri = 'OTOMATIS',
        modelPembelajaran = 'Deep Learning',
        variationNonce
    } = inputs;

    const nonce = (variationNonce !== undefined && variationNonce !== null) 
        ? variationNonce 
        : Math.floor(Math.random() * 100000);

    const totalJP = parseAlokasiJP(alokasiWaktu);
    const jumlahPertemuan = Math.max(1, Math.ceil(totalJP / 2));
    const formattedAlokasi = `${totalJP} JP (${jumlahPertemuan} Pertemuan @ 2 JP)`;

    // Phase and Grade consistency check
    let finalPhase = phase;
    const upperGrade = (grade || '').toUpperCase();
    if (upperGrade.includes('XII') || upperGrade.includes('XI') || upperGrade.includes('12') || upperGrade.includes('11')) {
        finalPhase = 'F';
    } else if (upperGrade.includes('X') || upperGrade.includes('10')) {
        finalPhase = 'E';
    } else if (upperGrade.includes('IX') || upperGrade.includes('VIII') || upperGrade.includes('VII') || upperGrade.includes('9') || upperGrade.includes('8') || upperGrade.includes('7')) {
        finalPhase = 'D';
    }

    // STRICT fokus LOCK: if jenisMateri is explicitly provided and not OTOMATIS, use it absolutely.
    const selectedJenis = (jenisMateri && jenisMateri !== 'OTOMATIS' && jenisMateri.trim() !== '') 
        ? jenisMateri.toUpperCase() 
        : autoDetectMaterialType(subjectName, babUtama, subbab, materiInti);

    const matRules = rulesData.material_types[selectedJenis] || rulesData.material_types['KONSEP'];
    const seed = `${subjectName}_${babUtama}_${subbab}_${materiInti}_${grade}_${selectedJenis}`;

    // Establish Single Source of Truth: fokus Context
    const domainContext = {
        type: selectedJenis,
        rules: matRules,
        subject: subjectName || 'Mata Pelajaran',
        phase: finalPhase || 'D',
        grade: grade || 'VIII',
        semester: semester || '1',
        bab: babUtama || 'Materi Utama',
        subbab: subbab || 'Topik Pokok',
        materi: materiInti || 'Konsep Dasar',
        selectedJenis: selectedJenis
    };

    const safeSchool = schoolName || 'MTs / SMA Negeri 1';
    const safeTeacher = teacherName || 'Tim Guru Mata Pelajaran';
    const safeSubject = domainContext.subject;
    const safePhase = domainContext.phase;
    const safeGrade = domainContext.grade;
    const safeSemester = domainContext.semester;
    const safeBab = domainContext.bab;
    const safeSubbab = domainContext.subbab;
    const safeMateri = domainContext.materi;

    const karIndex = getPatternIndex(seed + '_kar', sentenceBank.karakteristik_materi.length, nonce);
    const rawKarakteristik = sentenceBank.karakteristik_materi[karIndex];
    const karakteristikFormatted = rawKarakteristik
        .replace(/{{MATERI_INTI}}/g, safeMateri)
        .replace(/{{KONSEP_UTAMA}}/g, safeSubbab)
        .replace(/{{BAB_UTAMA}}/g, safeBab)
        .replace(/{{SUBBAB}}/g, safeSubbab);

    // STRICT TOPIC LOCK: Dynamic, non-biased Capaian Pembelajaran definitions
    const domainCaps = {
        AI: `Peserta didik mampu memahami, menganalisis, dan mengevaluasi penerapan "${safeMateri}" menggunakan perspektif ${resolveTerm('asisten cerdas', safeMateri)} secara kritis, kreatif, dan beretika.`,
        DATA: `Peserta didik mampu mengumpulkan, mengolah, menganalisis, dan memvisualisasikan data terkait "${safeMateri}" untuk menarik kesimpulan dan rekomendasi keputusan berbasis bukti data.`,
        JARINGAN: `Peserta didik mampu memahami arsitektur, konektivitas, konfigurasi, dan pemecahan masalah (troubleshooting) sistem/node yang berkaitan dengan penerapan "${safeMateri}".`,
        ALGORITMA: `Peserta didik mampu melakukan dekomposisi, merancang alur logika, ${resolveTerm('flowchart', safeMateri)}, dan menyusun langkah sistematis (${resolveTerm('pseudocode', safeMateri)}) dalam memecahkan masalah terkait "${safeMateri}".`,
        KODING: `Peserta didik mampu memodelkan, menuliskan struktur logika/instruksi program, melakukan pengujian, dan melakukan perbaikan kesalahan (${resolveTerm('debugging', safeMateri)}) dalam implementasi praktis terkait "${safeMateri}".`,
        ETIKA_DIGITAL: `Peserta didik mampu menganalisis implikasi, keamanan informasi, hak cipta, perlindungan data pribadi, dan etika komunikasi dalam konteks materi "${safeMateri}".`,
        PROYEK: `Peserta didik mampu merencanakan, merancang prototipe, melakukan kolaborasi tim, mengumpulkan umpan balik, dan mempresentasikan karya inovasi digital terkait "${safeMateri}".`,
        BAHASA: `Peserta didik mampu menguasai keterampilan berbahasa, menganalisis struktur/kosakata, serta menggunakan ungkapan yang relevan terkait "${safeMateri}" dalam konteks komunikasi aktif.`,
        MATEMATIKA: `Peserta didik mampu memahami konsep matematis, memodelkan masalah, merumuskan prosedur perhitungan, dan mengomunikasikan logika penyelesaian terkait "${safeMateri}".`,
        ILMU_ALAM: `Peserta didik mampu melakukan observasi ilmiah, mengumpulkan data eksperimen, menganalisis hubungan konsep, dan menarik kesimpulan berbasis fakta empiris terkait "${safeMateri}".`,
        ILMU_SOSIAL: `Peserta didik mampu mengidentifikasi fakta historis/sosial/geografis, menelaah sebab-akibat, membedah sudut pandang, dan menyusun sintesis pemikiran kritis terkait "${safeMateri}".`,
        PJOK: `Peserta didik mampu mempraktikkan keterampilan gerak, mengevaluasi efektivitas gerakan fisik, dan menerapkan nilai sportivitas/kerja sama dalam aktivitas terkait "${safeMateri}".`,
        KONSEP: `Peserta didik mampu mengkaji secara mendalam definisi teoretis, ruang lingkup, hakikat, dan klasifikasi konseptual terkait "${safeMateri}" serta relevansinya di dunia nyata.`
    };

    // STRICT TOPIC LOCK: Dynamic, non-biased Bloom's Taxonomy Tujuan Pembelajaran (TP) C1-C6
    const domainTps = {
        AI: {
            C1_C2: `Peserta didik mampu menjelaskan konsep dasar, definisi esensial, dan istilah teknis terkait "${safeMateri}" secara kritis menggunakan perspektif cerdas.`,
            C3_C4: `Peserta didik mampu merancang langkah praktis, mensimulasikan alur kerja, dan menganalisis penerapan "${safeMateri}" dengan bantuan ${resolveTerm('asisten ai', safeMateri)} secara sistematis.`,
            C5_C6: `Peserta didik mampu mengevaluasi akurasi, meminimalkan potensi ${resolveTerm('bias', safeMateri)}/kesalahan, serta merumuskan panduan etis pemanfaatan ${resolveTerm('asisten ai', safeMateri)} pada materi "${safeMateri}".`
        },
        DATA: {
            C1_C2: `Peserta didik mampu mengidentifikasi tipe ${resolveTerm('variabel', safeMateri)}, parameter, dan kebutuhan ${resolveTerm('dataset', safeMateri)} dasar terkait "${safeMateri}".`,
            C3_C4: `Peserta didik mampu mengolah data, membuat visualisasi grafik, dan menganalisis tren informasi terkait "${safeMateri}".`,
            C5_C6: `Peserta didik mampu menarik kesimpulan analitis, menyusun laporan, dan merekomendasikan keputusan berbasis data terkait "${safeMateri}".`
        },
        JARINGAN: {
            C1_C2: `Peserta didik mampu menjelaskan fungsi perangkat jaringan, ${resolveTerm('topologi', safeMateri)}, dan alur komunikasi data terkait "${safeMateri}".`,
            C3_C4: `Peserta didik mampu mengonfigurasi skema pengalamatan, ${resolveTerm('ip address', safeMateri)}, dan menguji konektivitas sistem pada penerapan "${safeMateri}".`,
            C5_C6: `Peserta didik mampu menganalisis kesalahan (troubleshooting), menguji keamanan node, dan menyempurnakan keandalan koneksi "${safeMateri}".`
        },
        ALGORITMA: {
            C1_C2: `Peserta didik mampu menjelaskan dekomposisi masalah, langkah logis, dan fungsi simbol-simbol ${resolveTerm('bagan alur', safeMateri)} terkait "${safeMateri}".`,
            C3_C4: `Peserta didik mampu merancang ${resolveTerm('flowchart', safeMateri)} dan ${resolveTerm('pseudocode', safeMateri)} sistematis untuk merumuskan alur keputusan terkait "${safeMateri}".`,
            C5_C6: `Peserta didik mampu mengevaluasi tingkat efisiensi, merampingkan logika langkah, dan menguji kasus batas (edge cases) pada penerapan "${safeMateri}".`
        },
        KODING: {
            C1_C2: `Peserta didik mampu mengenali aturan penulisan dasar, struktur parameter data, dan inisialisasi tipe data untuk mengimplementasikan "${safeMateri}".`,
            C3_C4: `Peserta didik mampu menuliskan baris kode program menggunakan struktur alur keputusan atau proses berulang terkait "${safeMateri}".`,
            C5_C6: `Peserta didik mampu mendeteksi kesalahan (error), melakukan pengujian hasil secara mandiri, dan menguji kegunaan program "${safeMateri}".`
        },
        ETIKA_DIGITAL: {
            C1_C2: `Peserta didik mampu menyebutkan regulasi, prinsip keamanan, dan aturan perlindungan informasi terkait aktivitas "${safeMateri}".`,
            C3_C4: `Peserta didik mampu membedakan jenis pelanggaran etika dan menerapkan standar hak cipta/privasi yang benar dalam kasus "${safeMateri}".`,
            C5_C6: `Peserta didik mampu menyusun panduan perilaku digital yang positif, aman, dan etis dalam lingkungan interaksi seputar "${safeMateri}".`
        },
        PROYEK: {
            C1_C2: `Peserta didik mampu mengumpulkan kebutuhan pengguna dan menyusun daftar spesifikasi untuk merancang produk inovasi/karya terkait "${safeMateri}".`,
            C3_C4: `Peserta didik mampu membangun sketsa, mendemonstrasikan kerangka (wireframe), dan mengembangkan prototipe/karya seputar "${safeMateri}".`,
            C5_C6: `Peserta didik mampu menyempurnakan karya, mengumpulkan umpan balik pengguna, dan mempresentasikan hasil rancangan akhir "${safeMateri}".`
        },
        BAHASA: {
            C1_C2: `Peserta didik mampu mengenali kosakata baru (mufradat/vocabulary), melafalkan dengan benar, dan mengartikan istilah terkait "${safeMateri}".`,
            C3_C4: `Peserta didik mampu mengaplikasikan tata bahasa/struktur kalimat dalam percakapan atau penyusunan teks terkait "${safeMateri}".`,
            C5_C6: `Peserta didik mampu menyusun naskah orisinal, berdialog secara spontan, serta mengapresiasi teks berbahasa dalam konteks "${safeMateri}".`
        },
        MATEMATIKA: {
            C1_C2: `Peserta didik mampu memahami rumusan dasar, membedakan variabel, dan mengidentifikasi informasi dari masalah kontekstual "${safeMateri}".`,
            C3_C4: `Peserta didik mampu menyusun model matematika dan menerapkan prosedur operasional perhitungan yang tepat terkait "${safeMateri}".`,
            C5_C6: `Peserta didik mampu memecahkan masalah tingkat tinggi (HOTS), melakukan pembuktian matematis, dan mengevaluasi kebenaran hasil akhir "${safeMateri}".`
        },
        ILMU_ALAM: {
            C1_C2: `Peserta didik mampu mengidentifikasi gejala, menyebutkan komponen penyusun, dan mendeskripsikan fenomena alam terkait "${safeMateri}".`,
            C3_C4: `Peserta didik mampu merancang prosedur pengamatan, melaksanakan eksperimen, dan mengelompokkan data hasil percobaan "${safeMateri}".`,
            C5_C6: `Peserta didik mampu menganalisis hubungan sebab-akibat fenomena, menyusun simpulan ilmiah, dan mengkritisi anomali hasil eksperimen "${safeMateri}".`
        },
        ILMU_SOSIAL: {
            C1_C2: `Peserta didik mampu mendeskripsikan fakta, tokoh, latar waktu/tempat, serta karakteristik fenomena sosial-historis terkait "${safeMateri}".`,
            C3_C4: `Peserta didik mampu mengklasifikasikan data literatur, menghubungkan peristiwa kausalitas, dan menafsirkan dinamika terkait "${safeMateri}".`,
            C5_C6: `Peserta didik mampu melakukan sintesis dari berbagai sudut pandang, merumuskan argumentasi kritis, dan mengevaluasi dampak "${safeMateri}".`
        },
        PJOK: {
            C1_C2: `Peserta didik mampu menyebutkan bagian-bagian gerakan dasar dan memahami pentingnya keselamatan dalam melakukan aktivitas "${safeMateri}".`,
            C3_C4: `Peserta didik mampu mempraktikkan rangkaian teknik secara berkesinambungan dan mengaplikasikannya dalam simulasi permainan "${safeMateri}".`,
            C5_C6: `Peserta didik mampu menganalisis keefektifan mekanika gerak, memperbaiki kesalahan rekan (peer-correction), dan merancang strategi pada situasi nyata terkait "${safeMateri}".`
        },
        KONSEP: {
            C1_C2: `Peserta didik mampu menjelaskan definisi, pengertian esensial, dan ruang lingkup konseptual dari "${safeMateri}".`,
            C3_C4: `Peserta didik mampu menguraikan komponen utama dan memetakan keterkaitan unsur-unsur teoretis terkait "${safeMateri}".`,
            C5_C6: `Peserta didik mampu mengevaluasi penerapan teori, menarik kesimpulan yang komprehensif, dan mengaitkan konsep "${safeMateri}" dengan penerapan materi nyata.`
        }
    };

    const activeTP = domainTps[domainContext.type] || domainTps['KONSEP'];
    const tp1 = activeTP.C1_C2;
    const tp2 = activeTP.C3_C4;
    const tp3 = activeTP.C5_C6;

    // STRICT TOPIC LOCK: Pertanyaan Pemantik must be dynamically centered on safeMateri to prevent default subtopic overrides
    const pemantikFenomena = `Bagaimana fenomena terkait "${safeMateri}" diimplementasikan dalam ${domainContext.rules.name} untuk mempermudah aktivitas manusia sehari-hari?`;
    const pemantikMasalah = `Apa masalah atau batasan utama yang harus diantisipasi saat kita merancang solusi berbasis "${safeMateri}"?`;
    const pemantikPrediksi = `Bagaimana dampak jangka panjang dari penerapan "${safeMateri}" terhadap efisiensi dan keilmuan ini?`;
    const pemantikPerbandingan = `Bagaimana perbandingan efektivitas antara metode konvensional dengan metode modern yang menerapkan konsep "${safeMateri}"?`;
    const pemantikProblemSolving = `Langkah strategis apa yang dapat diambil untuk memecahkan kendala atau kegagalan sistem dalam penerapan "${safeMateri}"?`;

    const kbcAllahIdx = getPatternIndex(seed + '_kbc_allah', sentenceBank.kbc.cinta_allah.length, nonce);
    const kbcIlmuIdx = getPatternIndex(seed + '_kbc_ilmu', sentenceBank.kbc.cinta_ilmu.length, nonce);
    const kbcDiriIdx = getPatternIndex(seed + '_kbc_diri', sentenceBank.kbc.cinta_diri.length, nonce);
    const kbcSesamaIdx = getPatternIndex(seed + '_kbc_sesama', sentenceBank.kbc.cinta_sesama.length, nonce);
    const kbcLingkunganIdx = getPatternIndex(seed + '_kbc_lingkungan', sentenceBank.kbc.cinta_lingkungan.length, nonce);
    const kbcTanahAirIdx = getPatternIndex(seed + '_kbc_tanahair', sentenceBank.kbc.cinta_tanah_air.length, nonce);

    const kbcAllah = sentenceBank.kbc.cinta_allah[kbcAllahIdx].replace(/{{MATERI_INTI}}/g, safeMateri);
    const kbcIlmu = sentenceBank.kbc.cinta_ilmu[kbcIlmuIdx].replace(/{{MATERI_INTI}}/g, safeMateri);
    const kbcDiri = sentenceBank.kbc.cinta_diri[kbcDiriIdx].replace(/{{MATERI_INTI}}/g, safeMateri);
    const kbcSesama = sentenceBank.kbc.cinta_sesama[kbcSesamaIdx].replace(/{{BAB_UTAMA}}/g, safeBab).replace(/{{MATERI_INTI}}/g, safeMateri);
    const kbcLingkungan = sentenceBank.kbc.cinta_lingkungan[kbcLingkunganIdx].replace(/{{MATERI_INTI}}/g, safeMateri);
    const kbcTanahAir = sentenceBank.kbc.cinta_tanah_air[kbcTanahAirIdx].replace(/{{MATERI_INTI}}/g, safeMateri);

    let kegiatanPembelajaranText = `08. KEGIATAN PEMBELAJARAN (${jumlahPertemuan} PERTEMUAN - ALOKASI ${totalJP} JP)\n`;

    const getDynamicActivities = (domain, safeMateri) => {
        const fallbacks = {
            BAHASA: {
                pTunggal: `Guru melakukan apersepsi dan mengenalkan materi "${safeMateri}". Peserta didik menyimak, menirukan pelafalan, membaca teks/dialog terkait, dan mempraktikkannya secara berpasangan atau mandiri.`,
                p1: `Guru mengenalkan kosakata (mufradat/vocabulary) dan ungkapan dasar terkait "${safeMateri}". Peserta didik menyimak, menirukan pelafalan, dan mencocokkan makna.`,
                p2: `Peserta didik mengamati pola tata bahasa (qawaid/grammar) pada ungkapan "${safeMateri}". Peserta didik berlatih melengkapi teks/dialog rumpang dan menyusun kalimat sederhana.`,
                p3: `Peserta didik berlatih mempraktikkan percakapan (hiwar/dialog) terkait "${safeMateri}" secara berpasangan dengan memperhatikan intonasi dan pelafalan.`,
                p4: `Peserta didik mempresentasikan teks atau dialog orisinal terkait "${safeMateri}" di depan kelas, disusul umpan balik dari guru dan rekan.`
            },
            MATEMATIKA: {
                pTunggal: `Guru mengenalkan konsep "${safeMateri}". Peserta didik mengamati masalah kontekstual, merumuskan model matematika, dan menyelesaikan masalah melalui latihan terbimbing.`,
                p1: `Guru memaparkan konsep dasar "${safeMateri}". Peserta didik melakukan eksplorasi untuk menemukan pola atau rumus matematika yang relevan.`,
                p2: `Peserta didik berlatih menggunakan rumus/prosedur "${safeMateri}" melalui serangkaian soal bertahap (dari mudah ke sulit).`,
                p3: `Peserta didik mendiskusikan masalah kontekstual/soal cerita yang berkaitan dengan "${safeMateri}", dan bekerja sama mencari solusi.`,
                p4: `Peserta didik mempresentasikan langkah penyelesaian masalah "${safeMateri}" dan melakukan evaluasi/verifikasi atas kebenaran hasil.`
            },
            ILMU_ALAM: { // Biologi, Fisika, Kimia
                pTunggal: `Guru mengenalkan fenomena terkait "${safeMateri}". Peserta didik melakukan observasi/eksperimen, mengumpulkan data, dan merumuskan kesimpulan ilmiah.`,
                p1: `Guru menyajikan fenomena alam terkait "${safeMateri}". Peserta didik merumuskan pertanyaan penyelidikan dan mengkaji dasar teori.`,
                p2: `Peserta didik melakukan percobaan, observasi, atau simulasi untuk menyelidiki karakteristik "${safeMateri}" secara terstruktur.`,
                p3: `Peserta didik menganalisis data hasil observasi/eksperimen tentang "${safeMateri}" dan membandingkannya dengan teori.`,
                p4: `Peserta didik menyusun laporan ilmiah tentang "${safeMateri}" dan mempresentasikannya di depan kelas.`
            },
            ILMU_SOSIAL: { // Sejarah, Geografi, Sosiologi
                pTunggal: `Guru menyajikan isu/kasus terkait "${safeMateri}". Peserta didik mengkaji sumber literatur, menganalisis hubungan sebab-akibat, dan menyajikan laporan hasil analisis.`,
                p1: `Guru memaparkan latar belakang "${safeMateri}". Peserta didik mengkaji sumber-sumber literatur dan mengidentifikasi fakta-fakta penting.`,
                p2: `Peserta didik menganalisis hubungan sebab-akibat, kronologi, atau dinamika sosial/spasial dari "${safeMateri}" dalam kelompok diskusi.`,
                p3: `Peserta didik mengkaji berbagai sudut pandang/interpretasi mengenai fenomena "${safeMateri}" secara kritis.`,
                p4: `Peserta didik mempresentasikan hasil analisis dan interpretasi mengenai "${safeMateri}" dan merumuskan kesimpulan akhir.`
            },
            PJOK: {
                pTunggal: `Guru memandu pemanasan. Guru mendemonstrasikan gerakan/teknik "${safeMateri}". Peserta didik mempraktikkan teknik tersebut, diikuti pendinginan dan evaluasi.`,
                p1: `Guru memandu pemanasan. Guru menjelaskan konsep dan mendemonstrasikan gerak dasar "${safeMateri}". Peserta didik mencoba gerak dasar secara bertahap.`,
                p2: `Peserta didik mempraktikkan teknik "${safeMateri}" dalam bentuk latihan berpasangan atau kelompok kecil, dengan saling mengamati (peer observation).`,
                p3: `Peserta didik menerapkan gerak/teknik "${safeMateri}" dalam situasi permainan yang dimodifikasi atau simulasi nyata.`,
                p4: `Evaluasi performa gerak "${safeMateri}". Peserta didik melakukan unjuk kerja secara bergantian, diikuti dengan refleksi dan pendinginan.`
            },
            KONSEP: {
                pTunggal: `Guru memaparkan materi konseptual utama. Peserta didik mengkaji literatur, berdiskusi, merumuskan pemahaman terkait "${safeMateri}", serta berpartisipasi aktif dalam kegiatan.`,
                p1: `Guru menyajikan pengantar materi. Peserta didik mengeksplorasi definisi, ruang lingkup, dan prinsip dasar dari "${safeMateri}".`,
                p2: `Peserta didik berdiskusi kelompok untuk membedah unsur-unsur penting, karakteristik, dan hubungan antar bagian dalam "${safeMateri}".`,
                p3: `Peserta didik mendiskusikan implementasi, studi kasus, atau contoh nyata dari teori "${safeMateri}" dalam kehidupan sehari-hari.`,
                p4: `Peserta didik menyajikan hasil analisis, merangkum kesimpulan tentang "${safeMateri}", dan mengevaluasi pemahaman mereka.`
            }
        };

        let cat = 'KONSEP';
        const subj = (safeSubject || '').toLowerCase();
        if (subj.includes('arab') || subj.includes('inggris') || subj.includes('indonesia') || subj.includes('jerman') || subj.includes('prancis') || subj.includes('bahasa')) cat = 'BAHASA';
        else if (subj.includes('matematika') || subj.includes('math')) cat = 'MATEMATIKA';
        else if (subj.includes('biologi') || subj.includes('fisika') || subj.includes('kimia') || subj.includes('ipa')) cat = 'ILMU_ALAM';
        else if (subj.includes('sejarah') || subj.includes('geografi') || subj.includes('sosiologi') || subj.includes('ekonomi') || subj.includes('ips') || subj.includes('pkn')) cat = 'ILMU_SOSIAL';
        else if (subj.includes('pjok') || subj.includes('jasmani') || subj.includes('olahraga')) cat = 'PJOK';
        
        return fallbacks[cat] || fallbacks['KONSEP'];
    };

    const activeKegiatan = getDynamicActivities(domainContext.type, safeMateri) || getDynamicActivities('KONSEP', safeMateri);

    for (let p = 1; p <= jumlahPertemuan; p++) {
        let pTitle = '';
        let pKegiatan = '';

        const subjLower = (safeSubject || '').toLowerCase();
        let pTunggalTitle = `PERTEMUAN TUNGGAL (2 JP): EKSPLORASI & PENDALAMAN MATERI`;
        let p1Title = `PERTEMUAN KE-1 (2 JP): EKSPLORASI KONSEP & PEMAHAMAN AWAL`;
        let p2Title = `PERTEMUAN KE-2 (2 JP): PENERAPAN PRAKTIS & ANALISIS TERSTRUKTUR`;
        let p3Title = `PERTEMUAN KE-3 (2 JP): PENDALAMAN MATERI & DISKUSI KELOMPOK`;
        let p4Title = `PERTEMUAN KE-${p} (2 JP): UNJUK KERJA, PRESENTASI & EVALUASI AKHIR`;

        if (subjLower.includes('arab') || subjLower.includes('inggris') || subjLower.includes('indonesia') || subjLower.includes('bahasa')) {
            pTunggalTitle = `PERTEMUAN TUNGGAL (2 JP): EKSPLORASI KOSAKATA & PRAKTIK KOMUNIKASI`;
            p1Title = `PERTEMUAN KE-1 (2 JP): KOSAKATA (MUFRADAT/VOCABULARY) & MEMBACA`;
            p2Title = `PERTEMUAN KE-2 (2 JP): STRUKTUR KALIMAT (QAWAID/GRAMMAR) & LATIHAN`;
            p3Title = `PERTEMUAN KE-3 (2 JP): PRAKTIK PERCAKAPAN (HIWAR/DIALOG) & MENULIS`;
            p4Title = `PERTEMUAN KE-${p} (2 JP): UNJUK KERJA KOMUNIKATIF & EVALUASI AKHIR`;
        } else if (subjLower.includes('matematika') || subjLower.includes('math')) {
            pTunggalTitle = `PERTEMUAN TUNGGAL (2 JP): PEMAHAMAN KONSEP & PEMECAHAN MASALAH`;
            p1Title = `PERTEMUAN KE-1 (2 JP): PEMAHAMAN KONSEP & PEMODELAN MATEMATIKA`;
            p2Title = `PERTEMUAN KE-2 (2 JP): LATIHAN PROSEDURAL & PENERAPAN RUMUS`;
            p3Title = `PERTEMUAN KE-3 (2 JP): PEMECAHAN MASALAH KONTEKSTUAL & SOAL HOTS`;
            p4Title = `PERTEMUAN KE-${p} (2 JP): VERIFIKASI HASIL, PRESENTASI & EVALUASI AKHIR`;
        } else if (subjLower.includes('biologi') || subjLower.includes('fisika') || subjLower.includes('kimia') || subjLower.includes('ipa')) {
            pTunggalTitle = `PERTEMUAN TUNGGAL (2 JP): OBSERVASI FENOMENA & ANALISIS ILMIAH`;
            p1Title = `PERTEMUAN KE-1 (2 JP): OBSERVASI FENOMENA & PERUMUSAN HIPOTESIS`;
            p2Title = `PERTEMUAN KE-2 (2 JP): EKSPERIMEN & PENGUMPULAN DATA ILMIAH`;
            p3Title = `PERTEMUAN KE-3 (2 JP): ANALISIS DATA & PEMBUKTIAN KONSEP`;
            p4Title = `PERTEMUAN KE-${p} (2 JP): PRESENTASI LAPORAN ILMIAH & EVALUASI AKHIR`;
        } else if (subjLower.includes('sejarah') || subjLower.includes('geografi') || subjLower.includes('sosiologi') || subjLower.includes('ekonomi') || subjLower.includes('ips') || subjLower.includes('pkn')) {
            pTunggalTitle = `PERTEMUAN TUNGGAL (2 JP): KAJIAN LITERATUR & ANALISIS SOSIAL/HISTORIS`;
            p1Title = `PERTEMUAN KE-1 (2 JP): IDENTIFIKASI FAKTA & LATAR BELAKANG MATERI`;
            p2Title = `PERTEMUAN KE-2 (2 JP): ANALISIS DINAMIKA, HUBUNGAN SEBAB-AKIBAT & DISKUSI`;
            p3Title = `PERTEMUAN KE-3 (2 JP): KAJIAN KRITIS BERBAGAI PERSPEKTIF`;
            p4Title = `PERTEMUAN KE-${p} (2 JP): SINTESIS HASIL ANALISIS & PRESENTASI KELOMPOK`;
        } else if (subjLower.includes('pjok') || subjLower.includes('jasmani') || subjLower.includes('olahraga')) {
            pTunggalTitle = `PERTEMUAN TUNGGAL (2 JP): DEMONSTRASI & PRAKTIK KETERAMPILAN GERAK`;
            p1Title = `PERTEMUAN KE-1 (2 JP): PENGENALAN TEKNIK & PEMAHAMAN GERAK DASAR`;
            p2Title = `PERTEMUAN KE-2 (2 JP): LATIHAN KETERAMPILAN GERAK SECARA BERTAHAP`;
            p3Title = `PERTEMUAN KE-3 (2 JP): APLIKASI GERAK DALAM SIMULASI PERMAINAN`;
            p4Title = `PERTEMUAN KE-${p} (2 JP): UJI UNJUK KERJA FISIK & EVALUASI REFLEKTIF`;
        }

        if (jumlahPertemuan === 1) {
            pTitle = pTunggalTitle;
            pKegiatan = activeKegiatan.pTunggal;
        } else if (p === 1) {
            pTitle = p1Title;
            pKegiatan = activeKegiatan.p1;
        } else if (p === 2) {
            pTitle = p2Title;
            pKegiatan = activeKegiatan.p2;
        } else if (p === 3) {
            pTitle = p3Title;
            pKegiatan = activeKegiatan.p3;
        } else {
            pTitle = p4Title;
            pKegiatan = activeKegiatan.p4;
        }

        kegiatanPembelajaranText += `\n${pTitle}
- Pendahuluan (15 Menit): Guru membuka dengan doa bersama, cek presensi, apersepsi interaktif, dan menyampaikan pertanyaan pemantik.
- Kegiatan Inti (60 Menit): ${pKegiatan}
- Penutup (15 Menit): Refleksi singkat, penguatan nilai PPP, menyimpulkan poin utama, dan instruksi pertemuan selanjutnya.\n`;
    }

    let mod14_ProyekOrTugas = '';
    if (domainContext.type === 'PROYEK') {
        mod14_ProyekOrTugas = `14. TUGAS / PROYEK UTAMA\nImplementasi & Penugasan Kontekstual:\n1. Pembentukan kelompok kerja (3-4 siswa) terkait topik \"${safeMateri}\".\n2. Eksplorasi materi dan penyusunan instrumen penyelesaian tugas \"${safeMateri}\".\n3. Presentasi dan diskusi pemecahan masalah.\n4. Penyerahan laporan akhir tugas/proyek.`;
    } else if (totalJP >= 6) {
        mod14_ProyekOrTugas = `14. PENUGASAN KOMPREHENSIF\nTantangan Terpadu Pembelajaran (Alokasi Waktu Mencukupi):\n1. Kerjakan dalam kelompok kecil untuk menyusun gagasan terpadu berbasis ${safeSubbab}.\n2. Terapkan materi \"${safeMateri}\" pada skenario kasus yang disajikan.\n3. Lakukan pengkajian hasil, perumusan kesimpulan, dan presentasikan di depan kelas.`;
    } else {
        mod14_ProyekOrTugas = `14. PENUGASAN SINGKAT (MINI CHALLENGE)\nLatihan Terstruktur berbasis Topik Utama (Alokasi ${totalJP} JP):\n1. Kerjakan penugasan mandiri/berpasangan terkait subbab ${safeSubbab}.\n2. Selesaikan evaluasi singkat terkait \"${safeMateri}\" pada Lembar Kerja.\n3. Lakukan tukar hasil karya untuk verifikasi antar-rekan sebaya (peer review).`;
    }

    const refleksiPesertaDidikRaw = domainRefleksiStud[domainContext.type] || domainRefleksiStud['KONSEP'];
    const refleksiPesertaDidikFormatted = refleksiPesertaDidikRaw
        .replace(/prompt engineering/gi, safeMateri)
        .replace(/membasmi hoaks/gi, safeMateri)
        .replace(/menuliskan sintaks kode/gi, safeMateri)
        .replace(/konfigurasi IP address/gi, safeMateri)
        .replace(/membuat visualisasi grafik/gi, safeMateri)
        .replace(/dekomposisi dan pembuatan flowchart/gi, safeMateri)
        .replace(/peta konsep/gi, safeMateri)
        .replace(/merancang prototipe produk/gi, safeMateri);

    const refleksiGuruRaw = domainRefleksiTeach[domainContext.type] || domainRefleksiTeach['KONSEP'];
    const refleksiGuruFormatted = refleksiGuruRaw
        .replace(/menyusun prompt terstruktur/gi, `memahami dan menerapkan konsep ${safeMateri}`)
        .replace(/memilih jenis grafik/gi, `memahami dan menerapkan konsep ${safeMateri}`)
        .replace(/memahami fungsi setiap perangkat jaringan/gi, `memahami dan menerapkan konsep ${safeMateri}`)
        .replace(/menyusun alur flowchart/gi, `memahami dan menerapkan konsep ${safeMateri}`)
        .replace(/memahami struktur percabangan atau perulangan/gi, `memahami dan menerapkan konsep ${safeMateri}`)
        .replace(/mengidentifikasi risiko siber dan hoaks/gi, `memahami dan menerapkan konsep ${safeMateri}`)
        .replace(/kualitas prototipe dan presentasi karya/gi, `memahami dan menerapkan konsep ${safeMateri}`)
        .replace(/menguasai definisi dan kerangka teoretis/gi, `memahami dan menerapkan konsep ${safeMateri}`);

    const mod01_Identitas = `01. IDENTITAS MODUL
- Nama Instansi : ${safeSchool}
- Penyusun : ${safeTeacher}
- Mata Pelajaran : ${safeSubject}
- Fase / Kelas / Semester : Fase ${safePhase} - Kelas ${safeGrade} / Semester ${safeSemester}
- Bab Utama : ${safeBab}
- Subbab / Topik : ${safeSubbab}
- Materi Inti : ${safeMateri}
- Alokasi Waktu : ${formattedAlokasi}
- Kategori / Jenis Materi : ${domainContext.rules.name}`;

    const mod02_Identifikasi = `02. KOMPETENSI AWAL & PROFIL PESERTA DIDIK
- Kompetensi Awal: Peserta didik memiliki pemahaman dasar pendukung yang relevan sebelum mempelajari "${safeMateri}" dalam lingkup ${domainContext.rules.name}.
- Kesiapan Belajar : Tingkat pemahaman awal dan keterampilan prosedural yang beragam terkait "${safeMateri}".
- Karakteristik Utama : Membutuhkan visualisasi konseptual, bimbingan bertahap (scaffolding), serta latihan praktik langsung terkait "${safeMateri}".`;

    const mod02_ProfilPancasila = `Profil Pelajar Pancasila:
1. Bernalar Kritis: Peserta didik mampu menguraikan, menganalisis, dan memecahkan tantangan logis terkait "${safeMateri}".
2. Mandiri: Peserta didik menunjukkan kemandirian dan tanggung jawab dalam mengeksplorasi konsep "${safeMateri}".
3. Gotong Royong: Berkolaborasi secara harmonis dalam merumuskan penyelesaian terkait "${safeMateri}" bersama kelompok.

Sinergi Nilai Karakter:
- Ketaatan Keilmuan: Menghayati keteraturan ciptaan Tuhan melalui penguasaan materi "${safeMateri}".`;

    const mod02_SaranaPrasarana = `Sarana & Prasarana:
- Perangkat keras: Ruang kelas, perangkat penunjang yang relevan, atau lembar kerja (cetak) yang disesuaikan untuk materi "${safeMateri}".
- Perangkat lunak / media: Media interaktif, slide presentasi, papan tulis, atau media pendukung ${domainContext.rules.name}.
- Media belajar: Buku teks utama, draf artikel rujukan, dan panduan praktis terkait "${safeMateri}".`;

    const mod02_TargetPeserta = `Target Peserta Didik:
1. Reguler / Tipikal: Mampu memahami secara umum, merancang, dan menganalisis penerapan "${safeMateri}".
2. Kesulitan Belajar: Memerlukan pendampingan bertahap (scaffolding) dan visualisasi konseptual mendasar tentang "${safeMateri}".
3. Pencapaian Tinggi: Mampu memecahkan tantangan penerapan materi HOTS tingkat lanjut dan mengkreasi solusi inovatif seputar "${safeMateri}".`;

    const mod03_Karakteristik = `03. KARAKTERISTIK MATERI
${karakteristikFormatted}

Kata Kunci Topik:
${domainContext.rules.keywords.join(', ')}`;

    let bloomAlignmentText = `04. TUJUAN PEMBELAJARAN (BLOOM REVISED C1 - C6 & SELARAS INDIKATOR)
1. [Kognitif C1-C2 / Pemahaman Konsep]
   ${tp1}
   → Indikator: Memahami dan menjelaskan komponen atau konsep dasar.
   → Aktivitas: Pengamatan contoh & diskusi kelompok.
   → Asesmen: Tes tulis / Tanya jawab diagnostik-formatif.
 
2. [Kognitif C3-C4 / Penerapan & Analisis]
   ${tp2}
   → Indikator: Menerapkan konsep pada kasus atau soal latihan.
   → Aktivitas: Praktik penugasan atau pengerjaan LKPD.
   → Asesmen: Penilaian unjuk kerja & verifikasi hasil.`;

    if (totalJP >= 4) {
        bloomAlignmentText += `\n\n3. [Kognitif C5-C6 / Evaluasi & Inovasi]
   ${tp3}
   → Indikator: Menganalisis masalah yang lebih kompleks dan mempresentasikan hasil.
   → Aktivitas: Evaluasi kritis / Analisis mendalam / Presentasi hasil.
   → Asesmen: Rubrik produk & lembar observasi HOTS.`;
    }

    bloomAlignmentText += `\n\n4. [Sikap & Komunikasi]
   Peserta didik mampu mendokumentasikan dan mempresentasikan hasil pemahaman serta karya/analisis terkait "${safeMateri}" secara komunikatif, jujur, dan bertanggung jawab.`;

    const mod05_PPP = `05. PENGUATAN PROFIL PELAJAR PANCASILA
1. Cinta Allah & Ketaatan Keilmuan:
   ${kbcAllah}
2. Cinta Ilmu & Rasa Ingin Tahu:
   ${kbcIlmu}
3. Cinta Diri & Digital Hygiene:
   ${kbcDiri}
4. Cinta Sesama & Kolaborasi:
   ${kbcSesama}
5. Cinta Lingkungan & Efisiensi Sumber Daya:
   ${kbcLingkungan}
6. Cinta Tanah Air & Kemandirian Belajar:
   ${kbcTanahAir}`;

    const mod06_PembelajaranMendalam = `06. PEMBELAJARAN MENDALAM (DEEP LEARNING DOMAIN-SPECIFIC)
- Berkesadaran (Mindful Learning):
  ${domainContext.rules.deep_learning.mindful}
- Bermakna (Meaningful Learning):
  ${domainContext.rules.deep_learning.meaningful}
- Menggembirakan (Joyful Learning):
  ${domainContext.rules.deep_learning.joyful}`;

    const mod07_PertanyaanPemantik = `07. PERTANYAAN PEMANTIK
1. Bagaimana penerapan atau fungsi utama dari "${safeMateri}" dalam konteks ${safeSubject}?
2. Mengapa kita perlu mempelajari "${safeMateri}", dan apa dampaknya jika kita tidak memahaminya?
3. Bisakah kalian memberikan contoh nyata penggunaan "${safeMateri}" di kehidupan sehari-hari?`;

    const safePersiapanRaw = domainContext.rules.persiapan_guru || "Menyiapkan bahan ajar dan lembar kerja.";
    const safePersiapanFormatted = safePersiapanRaw
        .replace(/IDE\/Code Editor \(Scratch\/Python\/C\+\+\/UnoArduSim\)/gi, `perangkat lunak atau media simulasi pendukung "${safeMateri}"`)
        .replace(/Cisco Packet Tracer \/ Simulator Web/gi, `alat peraga atau media pendukung "${safeMateri}"`)
        .replace(/Draw\.io \/ Lucidchart \/ Papan Tulis/gi, `media perancangan diagram/skema "${safeMateri}"`)
        .replace(/Google Sheets\/Excel\/LibreOffice Calc/gi, `perangkat lunak pengolahan data atau tabel cetak "${safeMateri}"`)
        .replace(/kejahatan siber \(phishing\/hoaks\)/gi, `kasus/isu siber terkait "${safeMateri}"`)
        .replace(/Kanban board \/ Gantt chart/gi, `lembar kontrol rencana kerja proyek "${safeMateri}"`)
        .replace(/akun\/platform AI Generatif/gi, `asisten cerdas atau bahan bacaan terkait "${safeMateri}"`);

    const mod08_PersiapanDanLangkah = `08. PERSIAPAN GURU & KEGIATAN PEMBELAJARAN

A. PERSIAPAN GURU :
${safePersiapanFormatted}

B. STRUKTUR KEGIATAN PEMBELAJARAN:
${kegiatanPembelajaranText}`;

    const diagnostikQuestion = `1. Apa yang Anda ketahui tentang konsep dasar "${safeMateri}"?\n2. Bagaimana pemahaman mendalam terkait "${safeMateri}" dapat membantu memecahkan masalah dalam kehidupan sehari-hari?`;
    const rubrikFormatted = `1. Penguasaan Konsep "${safeMateri}" (30%): Mampu menjelaskan definisi, prinsip dasar, dan elemen materi secara akurat.\n2. Penerapan & Praktik (35%): Ketepatan dalam mengaplikasikan "${safeMateri}" pada latihan, soal, atau studi kasus terkait.\n3. Analisis & Evaluasi (20%): Mampu menganalisis masalah, memeriksa ketepatan hasil, dan memberikan evaluasi kritis.\n4. Komunikasi & Kolaborasi (15%): Penyampaian hasil kerja yang jelas, partisipasi aktif dalam kelompok, dan presentasi yang komunikatif.`;

    const mod09_Asesmen = `09. ASESMEN DAN PENILAIAN SPESIFIK

1. Asesmen Diagnostik (Awal Pembelajaran):
${diagnostikQuestion}

2. Asesmen Formatif (Proses Pembelajaran):
- Observasi unjuk kerja dan keterlibatan aktif peserta didik dalam materi "${safeMateri}".
- Penilaian keaktifan diskusi dan pengisian LKPD terkait "${safeMateri}".

3. Asesmen Sumatif (Akhir Pembelajaran):
- Evaluasi pencapaian kompetensi melalui tes tertulis/praktik terkait "${safeMateri}".
- Penilaian produk/praktik menggunakan Rubrik Khusus "${safeMateri}".

4. Rubrik Penilaian Khusus:
${rubrikFormatted}`;

    const mod10_Diferensiasi = `10. DIFERENSIASI PEMBELAJARAN 
- Diferensiasi Konten : Menyediakan bahan bacaan dengan tingkat kerumitan bervariasi, peta konsep, serta daftar istilah penting terkait "${safeMateri}".
- Diferensiasi Proses : Memberikan bimbingan terarah (scaffolding) bagi kelompok awal, pendampingan praktis terstruktur, serta tantangan analisis penerapan materi mandiri terkait "${safeMateri}" bagi kelompok mahir.
- Diferensiasi Produk : Menyelesaikan tugas/karya dasar sesuai standar (reguler) vs menghasilkan karya/analisis mendalam dengan pengayaan terkait "${safeMateri}" (mahir).`;

    const mod11_Remedial = `11. PROGRAM REMEDIAL
- Sasaran : Peserta didik dengan pencapaian Kriteria Ketercapaian (KKTP < 75) pada materi "${safeMateri}".
- Bentuk Kegiatan : Penjelasan ulang konsep dasar ${safeSubbab}, pendampingan individual (scaffolding), serta latihan soal adaptif dalam ${domainContext.rules.name}.`;

    const mod12_Pengayaan = `12. PROGRAM PENGAYAAN
- Sasaran : Peserta didik dengan pencapaian tinggi (KKTP ≥ 75) pada materi "${safeMateri}".
- Bentuk Kegiatan : Pemecahan penerapan materi HOTS yang lebih mendalam, eksplorasi fitur/metode tingkat lanjut, atau menjadi tutor sebaya dalam memandu konsep "${safeMateri}".`;

    const mod13_LKPD = getDomainLKPD(domainContext.type, safeSubject, safeMateri, safeGrade, safeSemester);

    const mod15_Refleksi = `15. REFLEKSI GURU DAN PESERTA DIDIK

Refleksi Peserta Didik:
${refleksiPesertaDidikFormatted}

Refleksi Guru:
${refleksiGuruFormatted}`;

    const glosVocabulary = deriveTopicVocabulary(safeMateri);
    const glosTerms = glosVocabulary.list;
    const glosEntries = [];
    
    const getSubstantiveDefinition = (term, safeMateri, subj) => {
        const lowerTerm = term.toLowerCase();
        if(subj.includes('arab') || subj.includes('inggris')) return `Kosakata atau ungkapan penting yang digunakan dalam konteks "${safeMateri}".`;
        if(subj.includes('matematika')) return `Konsep, rumus, atau prinsip matematis dasar terkait "${safeMateri}".`;
        return `Konsep atau elemen penting yang menjadi bagian dari materi "${safeMateri}".`;
    };

    for (let i = 0; i < glosTerms.length; i++) {
        const term = glosTerms[i];
        glosEntries.push(`${i + 1}. ${term} : ${getSubstantiveDefinition(term, safeMateri, safeSubject.toLowerCase())}`);
    }
    const finalGlosariumText = glosEntries.slice(0, 6).join('\n');

    const mod16_Lampiran = `16. LAMPIRAN: GLOSARIUM DAN DAFTAR PUSTAKA

A. GLOSARIUM TOPIK:
${finalGlosariumText}

B. DAFTAR PUSTAKA:
1. Kemendikbudristek. 2024. Buku Teks Utama ${safeSubject} Kelas ${safeGrade}.
2. Tim Pengembang Kurikulum. 2024. Panduan Pembelajaran ${domainContext.rules.name}.
3. Buku pengayaan atau referensi tambahan yang relevan dengan materi "${safeMateri}" pada mata pelajaran ${safeSubject}.`;

    const finalOutput = {
        selectedJenis: domainContext.type,
        identitasModul: mod01_Identitas,
        capaianPembelajaran: domainCaps[domainContext.type] || domainCaps['KONSEP'],
        karakteristikMateri: `${karakteristikFormatted}\n\nFokus Materi Inti Utama:\n"${safeMateri}"\n\nKata Kunci Topik:\n${domainContext.rules.keywords.map(kw => resolveTerm(kw, safeMateri)).join(', ')}`,
        kbc: `1. Cinta Allah & Ketaatan Keilmuan:\n${kbcAllah}\n\n2. Cinta Ilmu & Rasa Ingin Tahu:\n${kbcIlmu}\n\n3. Cinta Diri & Perawatan Pribadi:\n${kbcDiri}\n\n4. Cinta Sesama & Kolaborasi:\n${kbcSesama}\n\n5. Cinta Lingkungan & Efisiensi Sumber Daya:\n${kbcLingkungan}\n\n6. Cinta Tanah Air & Kemandirian Belajar:\n${kbcTanahAir}`,
        pembelajaranMendalam: `- Berkesadaran (Mindful Learning):\n  ${domainContext.rules.deep_learning.mindful}\n- Bermakna (Meaningful Learning):\n  ${domainContext.rules.deep_learning.meaningful}\n- Menggembirakan (Joyful Learning):\n  ${domainContext.rules.deep_learning.joyful}`,
        tujuanPembelajaran: `${bloomAlignmentText}`,
        pemahamanBermakna: `Penguasaan terhadap "${safeMateri}" dalam ${domainContext.rules.name} membekali peserta didik dengan kecakapan berpikir analitis, pemecahan masalah secara terstruktur, and keterampilan aplikatif yang dapat dipertanggungjawabkan.`,
        pertanyaanPemantik: `${mod07_PertanyaanPemantik}`,
        praktikPedagogis: `- Pendekatan Pembelajaran : Student-Centered Learning & Subject-Based Inquiry (${domainContext.rules.name})\n- Model Pembelajaran : ${modelPembelajaran}\n- Metode Pembelajaran : Eksplorasi Terbimbing, Diskusi Kelompok, Pemecahan Masalah, & Penugasan Kontekstual terkait "${safeMateri}".\n- Alasan Pemilihan Pendekatan : Mendukung pemahaman konseptual dan keterampilan prosedural secara langsung melalui pengalaman belajar bermakna.`,
        mitraPembelajaran: `- Guru Mata Pelajaran : Fasilitator dan mentor utama proses pembelajaran "${safeMateri}".\n- Teman Sebaya : Kolaborator dalam diskusi kelompok, perancangan, dan peer review.\n- Sumber Belajar : Modul ajar, lembar kerja peserta didik, dan dokumentasi terkait penerapan materi "${safeMateri}".`,
        lingkunganPembelajaran: `- Lingkungan Fisik : Ruang kelas atau laboratorium ruang praktik yang tertata kondusif.\n- Lingkungan Belajar : Media penunjang simulasi atau penerapan materi terkait "${safeMateri}".\n- Pengaturan Kelompok : Kerja mandiri dan kolaborasi kelompok kecil (3-4 orang).\n- Alternatif Pembelajaran : Lembar kerja cetak dan diskusi kelompok terbimbing.`,
        pemanfaatanDigital: `- Perangkat : Media fisik pendukung atau Lembar Kerja Cetak.\n- Fasilitas Pendukung : Alat bantu pembelajaran yang relevan untuk mengeksplorasi dan memverifikasi "${safeMateri}".\n- Aktivitas Kelas : Eksplorasi interaktif, simulasi alur, dan verifikasi hasil secara nyata.`,
        kegiatanPembelajaran: kegiatanPembelajaranText,
        asesmen: `${mod09_Asesmen}`,
        diferensiasiPembelajaran: `- Diferensiasi Konten : Menyediakan bahan bacaan dengan tingkat kerumitan bervariasi, peta konsep, serta daftar istilah penting terkait "${safeMateri}".\n- Diferensiasi Proses : Memberikan bimbingan terarah (scaffolding) bagi kelompok awal, pendampingan praktis terstruktur, serta tantangan analisis penerapan materi mandiri terkait "${safeMateri}" bagi kelompok mahir.\n- Diferensiasi Produk : Menyelesaikan tugas/karya dasar sesuai standar (reguler) vs menghasilkan karya/analisis mendalam dengan pengayaan terkait "${safeMateri}" (mahir).`,
        remedial: mod11_Remedial,
        pengayaan: mod12_Pengayaan,
        lkpd: mod13_LKPD,
        miniChallengeProyek: mod14_ProyekOrTugas,
        refleksi: mod15_Refleksi,
        bahanAjar: getDomainBahanAjar(domainContext.type, safeSubject, safeMateri, safeSubbab),
        glosarium: finalGlosariumText,
        daftarPustaka: `1. Kemendikbudristek. 2024. Buku Teks Utama ${safeSubject} Kelas ${safeGrade}.\n2. Tim Pengembang Kurikulum. 2024. Panduan Pembelajaran ${domainContext.rules.name}.\n3. Buku pengayaan atau referensi tambahan yang relevan dengan materi "${safeMateri}" pada mata pelajaran ${safeSubject}.`,
        // Legacy compatibility fields:
        kompetensiAwal: mod02_Identifikasi,
        profilPancasila: mod02_ProfilPancasila,
        saranaPrasarana: mod02_SaranaPrasarana,
        targetPeserta: mod02_TargetPeserta,
        modelPembelajaran: `Model : ${modelPembelajaran} | Metode : Problem Solving, Praktik Hands-On`,
        persiapanPembelajaran: safePersiapanFormatted,
        pengayaanRemedial: `${mod11_Remedial}\n\n${mod12_Pengayaan}`,
        lembarKerja: `${mod14_ProyekOrTugas}\n\n${refleksiPesertaDidikFormatted}`
    };

    const resolvedOutput = replacePlaceholdersRecursive(finalOutput, safeMateri, safeSubbab, safeBab);
    const sanitizedOutput = sanitizeObject(resolvedOutput, safeMateri, domainContext.type);
    const validationSummary = runSelfValidation(sanitizedOutput, safeMateri, domainContext.type);

    sanitizedOutput.validationSummary = validationSummary;
    sanitizedOutput.DOMAIN_TEMPLATE_BIAS = validationSummary.domainTemplateBias;
    sanitizedOutput.topicDominanceScore = validationSummary.topicDominance;
    sanitizedOutput.topicDriftScore = validationSummary.topicDrift;
    sanitizedOutput.domainLeakageCount = validationSummary.domainLeakage;
    sanitizedOutput.defaultSubtopicOverrideCount = validationSummary.defaultSubtopicOverride;
    sanitizedOutput.unresolvedPlaceholderCount = validationSummary.unresolvedPlaceholder;
    sanitizedOutput.irrelevantVocabularyCount = validationSummary.irrelevantVocabulary;

    return sanitizedOutput;
}

export default generateMasterV2ModulAjar;
