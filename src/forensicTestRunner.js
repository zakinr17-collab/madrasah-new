import { generateMasterV2ModulAjar, autoDetectMaterialType, parseAlokasiJP } from './masterGenerativeRulesEngine.js';

const DOMAINS = ['AI', 'KODING', 'JARINGAN', 'DATA', 'ALGORITMA', 'ETIKA_DIGITAL', 'PROYEK', 'KONSEP'];

const HOSTILE_INPUTS = {
    AI: "Penerapan model kecerdasan artifisial dan prompt engineering",
    KODING: "Pemrograman baris kode Python dan perbaikan error syntax",
    JARINGAN: "Konfigurasi perangkat router switch dan pengalamatan IP address",
    DATA: "Pengolahan dataset tabel dan visualisasi grafik statistik",
    ALGORITMA: "Perancangan flowchart dan penelusuran alur logika pseudocode",
    ETIKA_DIGITAL: "Verifikasi fakta hoaks, privasi, dan etika komunikasi siber",
    PROYEK: "Perancangan prototipe produk digital dan uji coba pengguna",
    KONSEP: "Kajian definisi, hakikat, dan ruang lingkup teori keilmuan"
};

const FORBIDDEN_WORDS = {
    AI: ['router', 'switch', 'ip address', 'syntax', 'if-else', 'flowchart', 'pseudocode', 'tracing'],
    KODING: ['router', 'ip address', 'topologi', 'ping', 'model ai', 'prompt engineering'],
    JARINGAN: ['syntax error', 'prompt engineering', 'model ai', 'flowchart', 'pseudocode'],
    DATA: ['router', 'ip address', 'syntax', 'debugging', 'flowchart', 'pseudocode', 'prompt engineering'],
    ALGORITMA: ['router', 'ip address', 'prompt engineering', 'model ai', 'phishing'],
    ETIKA_DIGITAL: ['router', 'ip address', 'syntax', 'debugging', 'flowchart', 'pseudocode'],
    PROYEK: ['router', 'ip address', 'syntax', 'debugging', 'flowchart', 'pseudocode'],
    KONSEP: ['router', 'ip address', 'syntax', 'debugging', 'flowchart', 'pseudocode', 'prompt engineering']
};

function recursiveSearch(obj, forbiddenList, path = '') {
    if (!obj) return [];
    let leaks = [];
    if (typeof obj === 'string') {
        const lower = obj.toLowerCase();
        for (const word of forbiddenList) {
            const regex = new RegExp(`\\b${word}\\b`, 'i');
            if (regex.test(lower)) {
                leaks.push({ path, word, snippet: obj.substring(0, 100) });
            }
        }
    } else if (Array.isArray(obj)) {
        obj.forEach((item, idx) => {
            leaks = leaks.concat(recursiveSearch(item, forbiddenList, `${path}[${idx}]`));
        });
    } else if (typeof obj === 'object') {
        for (const key of Object.keys(obj)) {
            // Skip user input echo fields if any
            if (['kompetensiAwal', 'profilPancasila'].includes(key)) continue;
            leaks = leaks.concat(recursiveSearch(obj[key], forbiddenList, `${path}.${key}`));
        }
    }
    return leaks;
}

function runForensicAudits() {
    console.log("=== STARTING MASTER GENERATIVE RULES ENGINE V2 FORENSIC AUDIT ===");
    let totalTests = 0;
    let failedTests = 0;

    // 1. Strict Domain Lock & Explicit Domain Override Test (8 domains x inputs)
    console.log("\n[Test 1] Strict Domain Lock & Explicit Domain Override (8 x Inputs)...");
    for (const domain of DOMAINS) {
        totalTests++;
        const inputStr = HOSTILE_INPUTS[domain];
        const result = generateMasterV2ModulAjar({
            jenisMateri: domain,
            materiInti: inputStr,
            subbab: inputStr,
            babUtama: inputStr
        });

        if (result.selectedJenis !== domain) {
            console.error(`❌ FAIL: Domain override failed for ${domain}. Got: ${result.selectedJenis}`);
            failedTests++;
        } else {
            const forbidden = FORBIDDEN_WORDS[domain] || [];
            const leaks = recursiveSearch(result, forbidden);
            if (leaks.length > 0) {
                console.error(`❌ FAIL: Leakage found in domain ${domain}:`, leaks);
                failedTests++;
            } else {
                console.log(`  ✓ Domain ${domain} locked successfully with zero leakage.`);
            }
        }
    }

    // 2. Auto Detection Test
    console.log("\n[Test 2] Auto Detection Isolation Test...");
    const autoTests = [
        { text: "flowchart percabangan pseudocode", expected: "ALGORITMA" },
        { text: "Python syntax variabel debugging", expected: "KODING" },
        { text: "konfigurasi IP router switch", expected: "JARINGAN" },
        { text: "visualisasi dataset grafik statistik", expected: "DATA" },
        { text: "prompt engineering AI model", expected: "AI" },
        { text: "phishing hoaks privasi siber", expected: "ETIKA_DIGITAL" },
        { text: "prototipe produk inovasi", expected: "PROYEK" },
        { text: "definisi hakikat konsep teori", expected: "KONSEP" }
    ];

    for (const test of autoTests) {
        totalTests++;
        const detected = autoDetectMaterialType("Informatika", test.text, test.text, test.text);
        if (detected !== test.expected) {
            console.error(`❌ FAIL: Auto detection for "${test.text}" expected ${test.expected}, got ${detected}`);
            failedTests++;
        } else {
            console.log(`  ✓ Auto detection "${test.text}" -> ${detected}`);
        }
    }

    // 3. Total JP Test (2, 4, 6, 8 JP)
    console.log("\n[Test 3] Total JP Stress Test (2, 4, 6, 8 JP)...");
    const jpValues = ['2 JP', '4 JP', '6 JP', '8 JP'];
    for (const domain of DOMAINS) {
        for (const jp of jpValues) {
            totalTests++;
            try {
                const res = generateMasterV2ModulAjar({
                    jenisMateri: domain,
                    alokasiWaktu: jp,
                    materiInti: `Materi ${domain} ${jp}`
                });
                if (!res.kegiatanPembelajaran || res.selectedJenis !== domain) {
                    throw new Error("Invalid output structure or domain mismatch");
                }
                console.log(`  ✓ ${domain} @ ${jp} generated successfully.`);
            } catch (err) {
                console.error(`❌ FAIL: ${domain} @ ${jp} threw error:`, err.message);
                failedTests++;
            }
        }
    }

    // 4. Variation Nonce Stress Test (100 variations per domain)
    console.log("\n[Test 4] Variation Nonce Stress Test (100 variations per domain)...");
    for (const domain of DOMAINS) {
        totalTests++;
        let nonceFailed = false;
        for (let nonce = 0; nonce < 100; nonce++) {
            const res = generateMasterV2ModulAjar({
                jenisMateri: domain,
                variationNonce: nonce,
                materiInti: `Test Nonce ${nonce}`
            });
            if (res.selectedJenis !== domain) {
                nonceFailed = true;
                break;
            }
        }
        if (nonceFailed) {
            console.error(`❌ FAIL: Variation nonce changed domain for ${domain}`);
            failedTests++;
        } else {
            console.log(`  ✓ 100 variation nonces passed for ${domain}`);
        }
    }

    // 5. Legacy Fields & Recursive Scan Test
    console.log("\n[Test 5] Legacy Fields & Recursive Output Scan...");
    for (const domain of DOMAINS) {
        totalTests++;
        const res = generateMasterV2ModulAjar({ jenisMateri: domain });
        const legacyFields = ['kompetensiAwal', 'profilPancasila', 'saranaPrasarana', 'targetPeserta', 'modelPembelajaran', 'persiapanPembelajaran', 'pengayaanRemedial', 'lembarKerja'];
        let legacyOk = true;
        for (const lf of legacyFields) {
            if (!res[lf] || typeof res[lf] !== 'string') {
                legacyOk = false;
                console.error(`❌ FAIL: Legacy field missing or invalid for ${domain}: ${lf}`);
            }
        }
        if (!legacyOk) {
            failedTests++;
        } else {
            console.log(`  ✓ Legacy fields present and valid for ${domain}`);
        }
    }

    console.log("\n==========================================");
    console.log(`TOTAL TESTS: ${totalTests}`);
    console.log(`FAILED TESTS: ${failedTests}`);
    console.log("==========================================");

    if (failedTests > 0) {
        console.error("❌ FORENSIC AUDIT FAILED: LEAKAGE OR BUGS DETECTED.");
        process.exit(1);
    } else {
        console.log("✅ ZERO DOMAIN LEAKAGE VERIFIED ACROSS ALL ADVERSARIAL TESTS.");
        process.exit(0);
    }
}

runForensicAudits();
