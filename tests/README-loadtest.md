# CBT Load Test - Madrasah Bisa (Windows)

Script ini mensimulasikan siswa tanpa membuka ratusan browser/HP. Laptop Windows menjalankan k6 lalu menembak API produksi `https://madrasahku.ai.studio`.

## Penting sebelum tes

- Jangan hapus 800 siswa dummy. Mereka dipakai sebagai virtual user.
- Gunakan **ujian LOAD TEST khusus**, jangan ujian sungguhan.
- Sebaiknya ujian test memiliki minimal 5-10 soal dan dapat diakses oleh siswa dummy.
- Default script `FINISH=0`, sehingga ujian tidak diselesaikan. Ini memudahkan tes bertahap 20 -> 800 menggunakan ujian yang sama.
- `VIOLATION_RATE=0` secara default agar siswa dummy tidak terblokir akibat tes berulang.
- Script ini menguji HTTP/API CBT. WebRTC/livecam harus diuji terpisah dengan beberapa browser nyata.

## 1. Update repo lokal

Buka PowerShell:

```powershell
cd D:\zaki\madrasah
git pull
```

## 2. Install k6

Cara Windows yang paling sederhana:

```powershell
winget install k6 --source winget
```

Tutup/buka PowerShell bila perlu, lalu cek:

```powershell
k6 version
```

## 3. Buat file akun dari siswa yang sudah ada

Jalankan:

```powershell
powershell -ExecutionPolicy Bypass -File .\tests\prepare-loadtest-accounts.ps1 -Tenant default -StudentPassword 123456
```

Helper akan meminta username dan password admin Madrasah Utama. Password admin tidak ditampilkan dan tidak ditulis ke file.

Hasilnya:

```text
tests\accounts.local.json
```

File ini berisi akun siswa dummy dan di-ignore oleh Git.

Jika dummy siswa dahulu dibuat/import tanpa password khusus, backend memakai password default `123456`. Jika dahulu memakai password lain, ganti parameter `-StudentPassword`.

Helper juga menampilkan daftar `exam id`. Pilih ujian LOAD TEST khusus.

## 4. Set target test

Contoh:

```powershell
$env:BASE_URL="https://madrasahku.ai.studio"
$env:TENANT="default"
$env:EXAM_ID="ISI_ID_UJIAN_LOAD_TEST"
$env:ANSWERS_PER_STUDENT="3"
$env:RAMP_SECONDS="20"
$env:FINISH="0"
$env:VIOLATION_RATE="0"
$env:RECOVERY_RATE="0.10"
```

`RECOVERY_RATE=0.10` berarti sekitar 10% virtual siswa melakukan `attempt/start` lagi untuk mensimulasikan refresh/reconnect.

## 5. Jalankan bertahap

### 20 siswa

```powershell
$env:VUS="20"
k6 run .\tests\k6-cbt-load.js
```

### 50 siswa

```powershell
$env:VUS="50"
k6 run .\tests\k6-cbt-load.js
```

### 100 siswa

```powershell
$env:VUS="100"
k6 run .\tests\k6-cbt-load.js
```

### 200 siswa

```powershell
$env:VUS="200"
k6 run .\tests\k6-cbt-load.js
```

### 300 siswa

```powershell
$env:VUS="300"
$env:RAMP_SECONDS="30"
k6 run .\tests\k6-cbt-load.js
```

### 500 siswa

```powershell
$env:VUS="500"
$env:RAMP_SECONDS="45"
k6 run .\tests\k6-cbt-load.js
```

### 800 siswa

```powershell
$env:VUS="800"
$env:RAMP_SECONDS="60"
k6 run .\tests\k6-cbt-load.js
```

Jangan lanjut ke tahap berikutnya jika tahap sebelumnya menghasilkan error yang berarti.

## Alur tiap virtual siswa

Setiap VU hanya menjalankan satu iterasi:

1. login sebagai siswa berbeda
2. GET daftar ujian
3. POST `/api/exam/attempt/start-questions`
4. POST `/api/exam/attempt/start`
5. POST heartbeat
6. POST jawaban beberapa soal
7. sebagian kecil melakukan recovery/start ulang
8. GET `/api/exam/my-summary`
9. optional finish jika `FINISH=1`

Ini mengikuti jalur CBT server-authoritative aplikasi saat ini.

## Hasil yang dilihat

Fokus ke statistik k6:

- `http_req_failed`
- `http_req_duration p(95)`
- `http_req_duration p(99)`
- `login_fail`
- `start_questions_fail`
- `attempt_start_fail`
- `answer_fail`
- `heartbeat_fail`
- `successful_students`

Threshold default:

```text
HTTP failed < 1%
p95 < 2 detik
p99 < 5 detik
checks > 99%
```

Jika threshold gagal, jangan langsung menambah jumlah VU. Cari endpoint mana yang mulai lambat/error.

## Sambil k6 berjalan

Pantau Cloud Run dan Cloud SQL:

- CPU
- memory
- request latency
- 5xx / 503 / 504
- restart/OOM container
- Cloud SQL connections
- Cloud SQL CPU/write latency

Anda juga boleh membuka dashboard monitoring guru dari satu browser. Progress siswa k6 seharusnya muncul melalui event CBT, walaupun k6 sendiri tidak membuka kamera.

## Tes finish massal

Jangan gunakan pada ujian test yang ingin dipakai berulang. Untuk tes final submission, buat/copy ujian LOAD TEST baru lalu:

```powershell
$env:EXAM_ID="ID_UJIAN_TEST_BARU"
$env:VUS="100"
$env:FINISH="1"
k6 run .\tests\k6-cbt-load.js
```

Setelah itu verifikasi nilai/completed exam tersimpan.

## Tes violation

Default mati. Jika memang ingin menguji jalur anti-cheat, gunakan persentase kecil pada ujian test khusus:

```powershell
$env:VIOLATION_RATE="0.02"
```

Artinya kira-kira 2% siswa mengirim satu event tab-switch simulasi. Jangan gunakan angka besar karena sistem dapat memblokir akun setelah pelanggaran berulang.

## Jika login siswa gagal

Penyebab paling umum:

- password dummy bukan `123456`
- tenant salah
- akun dummy tidak punya username sesuai data restore
- ujian tidak tersedia untuk kelas siswa tersebut

Jalankan kembali helper dengan password dummy yang benar.

## Setelah load test selesai

800 siswa dummy tidak perlu dihapus langsung. Simpan sampai seluruh rangkaian 20 -> 800, recovery, dan final submission selesai. Setelah semua tes selesai dan hasilnya sudah dicatat, baru hapus data dummy jika memang tidak lagi diperlukan.


## Recovery akun dummy setelah restore backup lama

Backup lama dapat tidak membawa credential. Setelah backend terbaru ter-deploy, jalankan:

```powershell
powershell -ExecutionPolicy Bypass -File .\tests\reset-loadtest-passwords.ps1 -Tenant default
```

Script hanya memilih akun dengan pola username `loadtestNNN` dan NIS `LTNNN`. Proses dibatalkan otomatis bila jumlah target tidak sama dengan `ExpectedCount` (default 800). Password baru diminta secara tersembunyi dan tidak dicetak ke terminal.


## Cleanup orphan state setelah ujian load-test terhapus

Backend terbaru membersihkan state CBT otomatis saat ujian dihapus. Untuk ujian load-test yang **sudah terlanjur dihapus sebelum perbaikan ini**, gunakan helper orphan cleanup.

Lakukan dry-run terlebih dahulu:

```powershell
powershell -ExecutionPolicy Bypass -File .\tests\cleanup-cbt-orphans.ps1 -Tenant default -DryRun
```

Jika daftar orphan sesuai dengan ujian load-test lama, jalankan cleanup sebenarnya:

```powershell
powershell -ExecutionPolicy Bypass -File .\tests\cleanup-cbt-orphans.ps1 -Tenant default
```

Helper meminta kredensial admin secara lokal dan tidak menulis password/JWT ke file. Endpoint hanya membersihkan orphan state pada tenant target dan tidak menghapus siswa, ujian yang masih ada, atau LKPD. Key legacy yang tidak dapat dibuktikan tenant/type-nya tidak ditebak secara destruktif.
