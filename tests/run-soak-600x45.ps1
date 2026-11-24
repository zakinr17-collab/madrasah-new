# ============================================================
# SOAK 600x45 - jawab tiap 30 detik selama 45 menit (pola soak lulus)
# Sebelum run: pastikan ujian EX1795526660912 masih aktif (belum completed)
# ============================================================

$env:BASE_URL = "https://madrasahku.ai.studio"
$env:TENANT = "default"
$env:EXAM_ID = "EX1795526660912"
$env:ACCOUNTS_FILE = "./accounts.loadtest.local.json"

$env:VUS = "600"
$env:ACCOUNT_OFFSET = "0"

$env:SOAK_MINUTES = "45"

# Ramp 300s = login tersebar ~120/menit (terbukti bersih; JANGAN dipersingkat)
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

k6 run .\tests\k6-cbt-soak.js 2>&1 | Tee-Object -FilePath .\soak-result-600x45.txt
