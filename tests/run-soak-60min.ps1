# Soak test 1 jam: 800 siswa tetap online, heartbeat + jawab soal bertahap + sinkronisasi berkala.
# Gunakan ujian LOAD TEST yang fresh (belum completed).
# Tahapan yang disarankan: 200 VU x 30 menit dulu, cek metrics Cloud Run & Cloud SQL,
# baru jalankan 800 VU x 60 menit.

$env:BASE_URL = "https://madrasahku.ai.studio"
$env:TENANT = "default"
$env:EXAM_ID = "EX1789481153233"   # GANTI: ujian load test fresh, belum completed
$env:ACCOUNTS_FILE = "./accounts.loadtest.local.json"

$env:VUS = "800"
$env:ACCOUNT_OFFSET = "0"

# Ujian 1 jam penuh
$env:SOAK_MINUTES = "60"

# Sebar login agar tidak 800 siswa login serentak
$env:RAMP_SECONDS = "120"

# Pola perilaku siswa nyata
$env:HEARTBEAT_SECONDS = "15"      # heartbeat tiap ~15 detik (+jitter)
$env:ANSWER_SECONDS = "30"         # jawab soal tiap ~30 detik (+jitter)
$env:SUMMARY_SECONDS = "60"        # cek my-summary tiap ~60 detik

# 10% siswa mensimulasikan reconnect di tengah ujian
$env:RECOVERY_RATE = "0.10"
$env:VIOLATION_RATE = "0"

# Retry menghadapi blip (429/502/503/504)
$env:ANSWER_RETRIES = "3"
$env:ANSWER_RETRY_BASE_SECONDS = "0.5"
$env:VERIFY_RETRIES = "3"
$env:VERIFY_RETRY_BASE_SECONDS = "0.5"

k6 run .\tests\k6-cbt-soak.js

# Selama test berjalan, pantau di Cloud Console:
# - Cloud Run: jumlah instance, CPU/memori per instance, cold start (lonjakan p99)
# - Cloud SQL: jumlah koneksi aktif, CPU
# - Tren memori naik terus = indikasi memory leak; koneksi SQL naik terus = pooling bocor
