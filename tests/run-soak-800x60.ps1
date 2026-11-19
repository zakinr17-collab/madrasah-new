# ============================================================
# SOAK STRESS 800x60 - headroom untuk multi-school
# Sebelum run: buat ujian load test FRESH (belum completed), lalu
# ganti EXAM_ID di bawah dengan ID ujian baru tersebut.
# ============================================================

$env:BASE_URL = "https://madrasahku.ai.studio"
$env:TENANT = "default"
$env:EXAM_ID = "GANTI_DENGAN_EXAM_ID_FRESH"
$env:ACCOUNTS_FILE = "./accounts.loadtest.local.json"

$env:VUS = "800"
$env:ACCOUNT_OFFSET = "0"

$env:SOAK_MINUTES = "60"

# Ramp 300s = login tersebar ~160/menit; 120s terbukti menyebabkan massal HTTP 0
$env:RAMP_SECONDS = "300"

$env:HEARTBEAT_SECONDS = "15"
$env:ANSWER_SECONDS = "30"
$env:SUMMARY_SECONDS = "60"

$env:RECOVERY_RATE = "0.10"
$env:VIOLATION_RATE = "0"

$env:ANSWER_RETRIES = "3"
$env:ANSWER_RETRY_BASE_SECONDS = "0.5"
$env:VERIFY_RETRIES = "3"
$env:VERIFY_RETRY_BASE_SECONDS = "0.5"

k6 run .\tests\k6-cbt-soak.js 2>&1 | Tee-Object -FilePath .\soak-result-800.txt
