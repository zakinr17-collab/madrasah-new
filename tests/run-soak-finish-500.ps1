# ============================================================
# SOAK + FINISH 500 - jawab SEMUA soal lalu SELESAI (finish)
# Skrip: tests/k6-cbt-finalization.js
# Exam: EX1795224886982
# ============================================================

$env:BASE_URL = "https://madrasahku.ai.studio"
$env:TENANT = "default"
$env:EXAM_ID = "EX1795224886982"
$env:ACCOUNTS_FILE = "./accounts.loadtest.local.json"

$env:VUS = "500"
$env:ACCOUNT_OFFSET = "0"

# Ramp 240s = login tersebar ~125/menit (terbukti bersih; JANGAN dipersingkat)
$env:RAMP_SECONDS = "240"

# Jawab tiap soal dgn jeda kecil (sisa waktu untuk finish semua di akhir)
$env:ANSWER_DELAY_SECONDS = "0.05"

# Finish: jitter 2s antar siswa biar tidak ngebut serentak
$env:FINISH_JITTER_SECONDS = "2"
$env:FINISH_RETRIES = "3"
$env:FINISH_RETRY_BASE_SECONDS = "0.5"

$env:ANSWER_RETRIES = "3"
$env:ANSWER_RETRY_BASE_SECONDS = "0.5"
$env:VERIFY_RETRIES = "4"
$env:VERIFY_RETRY_BASE_SECONDS = "0.5"

k6 run .\tests\k6-cbt-finalization.js 2>&1 | Tee-Object -FilePath .\soak-finish-result-500.txt
