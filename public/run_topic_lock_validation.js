import { generateMasterV2ModulAjar } from './masterGenerativeRulesEngine.js';

function checkStringContains(text, pattern) {
    if (!text) return false;
    return text.toLowerCase().includes(pattern.toLowerCase());
}

const TEST_CASES = [
    {
        domain: "AI",
        materiInti: "Pengenalan Konsep Otomatisasi & Istilah Teknologi",
        forbiddenDefaults: [
            'prompt engineering', 'hallucination', 'dataset', 'bias AI', 'fact-checking', 'generative AI', 'model AI'
        ],
        requiredTerms: ['Otomatisasi', 'Istilah Teknologi']
    },
    {
        domain: "KODING",
        materiInti: "Konsep Manajemen Memori & Alokasi RAM",
        forbiddenDefaults: [
            'syntax', 'debugging', 'if-else', 'loop', 'sintaks', 'perulangan', 'percabangan'
        ],
        requiredTerms: ['Manajemen Memori', 'Alokasi RAM']
    },
    {
        domain: "KODING",
        materiInti: "Manajemen Objek & Istilah Struktur Pemrograman",
        forbiddenDefaults: [
            'syntax', 'debugging', 'if-else', 'loop', 'sintaks', 'perulangan', 'percabangan',
            'asisten cerdas', 'sistem otomatis', 'teknologi cerdas', 'Kecerdasan Artifisial'
        ],
        requiredTerms: ['Manajemen Objek', 'Struktur Pemrograman']
    },
    {
        domain: "JARINGAN",
        materiInti: "Pencarian Web Terstruktur & Search Engine",
        forbiddenDefaults: [
            'router', 'switch', 'ip address', 'topologi', 'alamat ip'
        ],
        requiredTerms: ['Pencarian Web', 'Search Engine']
    },
    {
        domain: "DATA",
        materiInti: "Analisis Dampak Polusi Udara & Grafik Korelasi",
        forbiddenDefaults: [
            'dataset', 'spreadsheet'
        ],
        requiredTerms: ['Polusi Udara', 'Grafik Korelasi']
    },
    {
        domain: "ALGORITMA",
        materiInti: "Perencanaan Rute Terpendek Pengiriman Barang",
        forbiddenDefaults: [
            'flowchart', 'pseudocode', 'tracing', 'bagan alur'
        ],
        requiredTerms: ['Rute Terpendek', 'Pengiriman Barang']
    },
    {
        domain: "ETIKA_DIGITAL",
        materiInti: "Prinsip Hak Cipta Karya Seni Musik Digital",
        forbiddenDefaults: [
            'phishing', 'hoaks', 'fact-checking'
        ],
        requiredTerms: ['Hak Cipta', 'Musik Digital']
    },
    {
        domain: "PROYEK",
        materiInti: "Rancangan Prototipe Lampu Belajar Hemat Energi",
        forbiddenDefaults: [
            'software', 'aplikasi web'
        ],
        requiredTerms: ['Lampu Belajar', 'Hemat Energi']
    },
    {
        domain: "KONSEP",
        materiInti: "Teori Pembagian Kerja & Efisiensi Organisasi",
        forbiddenDefaults: [
            'mind map', 'peta konsep'
        ],
        requiredTerms: ['Pembagian Kerja', 'Efisiensi Organisasi']
    }
];

function runTopicLockValidation() {
    console.log("=== RUNNING STRICT TOPIC LOCK & ZERO TEMPLATE-BIAS VALIDATION SUITE ===");
    let allPassed = true;

    for (const test of TEST_CASES) {
        console.log(`\n--------------------------------------------------`);
        console.log(`Testing Domain: ${test.domain}`);
        console.log(`Materi Inti   : "${test.materiInti}"`);
        console.log(`--------------------------------------------------`);

        const result = generateMasterV2ModulAjar({
            jenisMateri: test.domain,
            materiInti: test.materiInti,
            subbab: test.materiInti,
            babUtama: `Bab ${test.materiInti}`
        });

        // 1. Verify Selected Domain Lock
        const domainLockVerified = result.selectedJenis === test.domain;
        console.log(`  ✓ selectedJenis matches domain: ${domainLockVerified ? "YES" : "NO"}`);

        // 2. Check Topic Drift (Checking if required terms are in the output fields)
        let topicDrift = false;
        const driftDetails = [];
        const checkedFields = ['capaianPembelajaran', 'tujuanPembelajaran', 'pertanyaanPemantik', 'kegiatanPembelajaran', 'lkpd', 'asesmen', 'glosarium'];
        
        for (const term of test.requiredTerms) {
            let foundInAtLeastOne = false;
            for (const field of checkedFields) {
                if (checkStringContains(result[field], term)) {
                    foundInAtLeastOne = true;
                }
            }
            if (!foundInAtLeastOne) {
                topicDrift = true;
                driftDetails.push(term);
            }
        }
        console.log(`  ✓ Topic Drift Verified (No drift): ${!topicDrift ? "YES" : `NO (Missing required terms: ${driftDetails.join(', ')})`}`);

        // 3. Check Default Subtopic Override & Domain Template Bias
        let templateBiasDetected = false;
        const biasDetails = [];
        
        for (const forbiddenWord of test.forbiddenDefaults) {
            for (const field of Object.keys(result)) {
                if (['kompetensiAwal', 'profilPancasila', 'saranaPrasarana', 'targetPeserta', 'selectedJenis'].includes(field)) continue;
                const valStr = typeof result[field] === 'string' ? result[field] : JSON.stringify(result[field]);
                if (valStr && checkStringContains(valStr, forbiddenWord)) {
                    // Make sure it wasn't explicitly allowed by the materiInti itself (which shouldn't be the case for our test cases)
                    if (!test.materiInti.toLowerCase().includes(forbiddenWord.toLowerCase())) {
                        templateBiasDetected = true;
                        biasDetails.push(`${field}:${forbiddenWord}`);
                    }
                }
            }
        }
        console.log(`  ✓ Domain Template Bias & Default Subtopic Overrides: ${!templateBiasDetected ? "NONE DETECTED (PERFECT)" : `BIAS DETECTED (${biasDetails.join(', ')})`}`);

        // 4. Calculate Topic Dominance (%)
        // Topic dominance is evaluated based on whether key fields are strictly customized to the topic and have zero default overrides
        let scoredSections = 0;
        let successfulSections = 0;
        for (const field of checkedFields) {
            scoredSections++;
            let sectionHasTopic = false;
            for (const term of test.requiredTerms) {
                if (checkStringContains(result[field], term)) {
                    sectionHasTopic = true;
                }
            }
            let sectionHasBias = false;
            const valStr = typeof result[field] === 'string' ? result[field] : JSON.stringify(result[field]);
            for (const forbiddenWord of test.forbiddenDefaults) {
                if (valStr && checkStringContains(valStr, forbiddenWord)) {
                    sectionHasBias = true;
                }
            }

            if (sectionHasTopic && !sectionHasBias) {
                successfulSections++;
            }
        }

        const topicDominancePercent = (successfulSections / scoredSections) * 100;
        console.log(`  ✓ Topic Dominance Score: ${topicDominancePercent.toFixed(2)}% (Target >= 90%)`);

        const testPassed = domainLockVerified && !topicDrift && !templateBiasDetected && topicDominancePercent >= 90;
        if (testPassed) {
            console.log(`  🎉 STATUS: PASSED`);
        } else {
            console.error(`  ❌ STATUS: FAILED`);
            allPassed = false;
        }
    }

    console.log("\n==========================================");
    console.log("FINAL ADVERSARIAL VALIDATION SUMMARY");
    console.log("==========================================");
    if (allPassed) {
        console.log("SUCCESS: STRICT TOPIC LOCK & ZERO TEMPLATE-BIAS PERFECTLY PROVEN ACROSS ALL 8 DOMAINS!");
        process.exit(0);
    } else {
        console.error("FAILURE: SOME DOMAINS BREACHED STRICT TOPIC LOCK OR EXHBIITED TEMPLATE BIAS.");
        process.exit(1);
    }
}

runTopicLockValidation();
