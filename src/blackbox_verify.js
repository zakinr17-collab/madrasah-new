import { generateMasterV2ModulAjar } from './masterGenerativeRulesEngine.js';

const CoreKodingTests = [
    { id: 1, type: "KODING", materi: "Manajemen Objek & Istilah Struktur Pemrograman" },
    { id: 2, type: "KODING", materi: "Pengenalan Variabel dan Konstanta" },
    { id: 3, type: "KODING", materi: "Konsep Perulangan" },
    { id: 4, type: "KODING", materi: "Dasar Fungsi dalam Pemrograman" },
    { id: 5, type: "KODING", materi: "Struktur Data Sederhana" },
    { id: 6, type: "KODING", materi: "Keamanan Data Pribadi" },
    { id: 7, type: "KODING", materi: "Etika Penggunaan Teknologi" },
    { id: 8, type: "KODING", materi: "Pengenalan Basis Data" },
    { id: 9, type: "KODING", materi: "Pemrosesan Teks" },
    { id: 10, type: "KODING", materi: "Antarmuka Pengguna" }
];

const AdversarialTests = [
    { id: 11, type: "KODING", materi: "Sejarah Perkembangan Komputer" },
    { id: 12, type: "AI", materi: "Sejarah Perkembangan Komputer" }
];

const AllTests = [...CoreKodingTests, ...AdversarialTests];

// General check function
function inspectOutput(type, materi, result) {
    const fields = Object.keys(result).filter(f => typeof result[f] === 'string');
    
    // Terms that are forbidden unless explicitly present in the materiInti (case-insensitive)
    const defaultsToCheck = [
        // AI
        'prompt engineering', 'hallucination', 'dataset', 'bias ai', 'fact-checking', 'generative ai', 'model ai',
        'asisten cerdas', 'sistem otomatis', 'teknologi cerdas', 'otomatisasi',
        // Koding
        'syntax', 'debugging', 'if-else', 'sintaks', 'perulangan', 'percabangan', 'loop', 'fungsi', 'objek', 'variabel',
        // Jaringan
        'router', 'switch', 'ip address', 'topologi', 'alamat ip',
        // Data
        'spreadsheet',
        // Algoritma
        'flowchart', 'pseudocode', 'tracing', 'bagan alur',
        // Etika Digital
        'phishing', 'hoaks'
    ];

    let templateBiasCount = 0;
    let irrelevantVocabularyCount = 0;
    const detectedBiases = [];
    const detectedIrrelevant = [];

    const lowerMateri = materi.toLowerCase();

    for (const forbidden of defaultsToCheck) {
        // Skip check if the forbidden term is actually requested as part of the material
        if (lowerMateri.includes(forbidden.toLowerCase())) continue;

        // Special exceptions (e.g. if the word 'pemrograman' is in the materi, we don't count 'program' or 'kode' as bias)
        // But for things like 'debugging', 'syntax', 'flowchart', 'pseudocode', 'asisten cerdas', 'otomatisasi', etc:
        for (const field of fields) {
            if (['selectedJenis', 'identitasModul', 'daftarPustaka'].includes(field)) continue;
            const text = result[field].toLowerCase();
            if (text.includes(forbidden.toLowerCase())) {
                templateBiasCount++;
                detectedBiases.push(`${field}:${forbidden}`);
            }
        }
    }

    // Diagnostic leak detection matching runSelfValidation rules
    const allForbiddens = {
        AI: ['router', 'switch', 'ip address', 'syntax', 'if-else', 'flowchart', 'pseudocode', 'tracing'],
        KODING: ['router', 'ip address', 'topologi', 'ping', 'model ai', 'prompt engineering'],
        JARINGAN: ['syntax error', 'prompt engineering', 'model ai', 'flowchart', 'pseudocode'],
        DATA: ['router', 'ip address', 'syntax', 'debugging', 'flowchart', 'pseudocode', 'prompt engineering'],
        ALGORITMA: ['router', 'ip address', 'prompt engineering', 'model ai', 'phishing'],
        ETIKA_DIGITAL: ['router', 'ip address', 'syntax', 'debugging', 'flowchart', 'pseudocode'],
        PROYEK: ['router', 'ip address', 'syntax', 'debugging', 'flowchart', 'pseudocode'],
        KONSEP: ['router', 'ip address', 'syntax', 'debugging', 'flowchart', 'pseudocode', 'prompt engineering']
    };
    const forbiddenList = allForbiddens[type] || [];
    const leakDetails = [];
    for (const word of forbiddenList) {
        if (lowerMateri.includes(word.toLowerCase())) continue;
        for (const field of Object.keys(result)) {
            if (['kompetensiAwal', 'profilPancasila', 'saranaPrasarana', 'targetPeserta', 'selectedJenis'].includes(field)) continue;
            const valStr = String(result[field] || '').toLowerCase();
            let isLeaking = false;
            if (word === 'ping') {
                isLeaking = /\bping\b/i.test(valStr);
            } else {
                isLeaking = valStr.includes(word.toLowerCase());
            }
            if (isLeaking) {
                leakDetails.push(`${field} contains "${word}"`);
            }
        }
    }

    // Checking for unresolved placeholders
    let unresolvedPlaceholders = 0;
    const placeholderMatches = [];
    const placeholderRegex = /{{[A-Z0-9_]+}}/g;
    for (const field of fields) {
        const text = result[field];
        const matches = text.match(placeholderRegex);
        if (matches) {
            unresolvedPlaceholders += matches.length;
            placeholderMatches.push(...matches);
        }
    }

    // Checking if the LKPD contains any default system/automation boilerplate activities
    const lkpdText = (result.lkpd || '').toLowerCase();
    let lkpdValid = true;
    if (lkpdText.includes('otomatisasi dalam kehidupan sehari-hari') || 
        lkpdText.includes('asisten ai') ||
        lkpdText.includes('perancangan bagan alur') ||
        lkpdText.includes('flowchart') ||
        lkpdText.includes('perbaikan error (debugging)') ||
        lkpdText.includes('sintaks')) {
        // Check if these were actually requested in the materi
        const defaultsToCheckInLKPD = ['otomatisasi', 'asisten ai', 'flowchart', 'debugging', 'sintaks'];
        for (const word of defaultsToCheckInLKPD) {
            if (lkpdText.includes(word) && !lowerMateri.includes(word)) {
                lkpdValid = false;
                detectedBiases.push(`lkpd_boilerplate:${word}`);
            }
        }
    }

    // Checking Glosarium dynamic relevance
    const glosText = (result.glosarium || '').toLowerCase();
    let glosValid = true;
    const staticDefaults = ['dataset', 'otomatisasi', 'sistem cerdas', 'hallucination'];
    for (const fallback of staticDefaults) {
        if (glosText.includes(fallback) && !lowerMateri.includes(fallback)) {
            glosValid = false;
            detectedBiases.push(`glosarium_boilerplate:${fallback}`);
        }
    }

    const topicDominance = result.topicDominanceScore || 0;
    const topicDrift = result.topicDriftScore || 0;
    const domainLeakage = result.domainLeakageCount || 0;
    const unresolved = unresolvedPlaceholders;

    const hasBias = templateBiasCount > 0 || !lkpdValid || !glosValid;
    const status = (topicDominance >= 90 && topicDrift <= 15 && domainLeakage === 0 && !hasBias && unresolved === 0) ? "PASSED" : "FAILED";

    return {
        id: result.id,
        materi: materi,
        topicDominance,
        topicDrift,
        domainLeakage,
        leakDetails,
        templateBias: hasBias ? "YES" : "NO",
        detectedBiases,
        irrelevantVocabulary: irrelevantVocabularyCount,
        placeholder: unresolved,
        status
    };
}

function runBlackBoxVerification() {
    console.log("=== EXECUTING DEEP BLACK-BOX VERIFICATION ===");
    const tableRows = [];

    for (const test of AllTests) {
        const result = generateMasterV2ModulAjar({
            jenisMateri: test.type,
            materiInti: test.materi,
            subbab: test.materi,
            babUtama: `Bab ${test.materi}`
        });

        const report = inspectOutput(test.type, test.materi, result);
        tableRows.push(report);
    }

    // Output formatted Markdown table
    console.log("\n| No | Materi Inti | Topic Dominance | Topic Drift | Domain Leakage | Template Bias | Irrelevant Vocabulary | Placeholder | Status |");
    console.log("|---|---|---|---|---|---|---|---|---|");
    tableRows.forEach((row, index) => {
        console.log(`| ${index + 1} | ${row.materi} | ${row.topicDominance.toFixed(1)}% | ${row.topicDrift.toFixed(1)}% | ${row.domainLeakage} | ${row.templateBias} | ${row.irrelevantVocabulary} | ${row.placeholder} | ${row.status} |`);
    });

    console.log("\n=== DETAILED FAILURE EXPLANATIONS & BIAS REPORTING ===");
    let failuresExist = false;
    tableRows.forEach(row => {
        if (row.status === "FAILED") {
            failuresExist = true;
            console.log(`\n❌ TEST CASE FAILED: "${row.materi}"`);
            console.log(`   - Detected Biases: ${JSON.stringify(row.detectedBiases)}`);
            console.log(`   - Placeholders   : ${row.placeholder}`);
            console.log(`   - Topic Dominance: ${row.topicDominance}%`);
            console.log(`   - Domain Leakage : ${row.domainLeakage} -> ${JSON.stringify(row.leakDetails)}`);
        }
    });

    if (!failuresExist) {
        console.log("\n✨ FINAL BLACK-BOX VERIFICATION = PASSED ✨");
        console.log("All 12 complex curriculum scenarios perfectly satisfied strict topic locks and zero template-bias checks!");
    } else {
        console.log("\n❌ FINAL BLACK-BOX VERIFICATION = FAILED ❌");
    }
}

runBlackBoxVerification();
