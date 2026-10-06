global.window = {};
import { getComprehensiveModulAjarStandardData } from './src/pedagogyNonAIEngine.js';

const result = getComprehensiveModulAjarStandardData({
    subjectName: 'Bahasa Arab',
    topic: 'التَّعَارُف',
    grade: 'X',
    semester: '1',
    model: 'Deep Learning',
    alokasiWaktu: '4 JP',
    jenisMateri: 'OTOMATIS'
});

console.log("IDENTITAS:", result.identitasModul);
console.log("\nKEGIATAN:", result.kegiatanPembelajaran);
console.log("\nLKPD:", result.lkpd);
