================================================================================
           PANDUAN INSTALASI PERTAMA KALI & UPDATE APLIKASI MADRASAH DIGITAL
================================================================================

Aplikasi Manajemen Madrasah & Sistem CBT (Computer Based Test) Digital.
Built with Node.js (Express), React (Vite), TypeScript, PostgreSQL & Drizzle ORM / JSON Store.

================================================================================
0. RINGKASAN PERINTAH TERMINAL / SHELL (QUICK COMMAND CHEATSHEET)
================================================================================

Bagi Anda yang ingin langsung mengetikkan perintah di Terminal / Command Prompt (CMD) / PowerShell, berikut urutan perintah persis yang harus diketikkan:

--------------------------------------------------------------------------------
A. KETIKAN TERMINAL UNTUK INSTALASI PERTAMA KALI (FRESH INSTALL)
--------------------------------------------------------------------------------

1. Buka Terminal / CMD di laptop/komputer server Anda, lalu masuk ke folder proyek:
   cd C:\MadrasahDigital
   (atau di Linux/Mac: cd /home/user/MadrasahDigital)

2. Cek apakah Node.js dan npm sudah terpasang:
   node -v
   npm -v

3. Install semua perpustakaan/paket dependensi Node.js:
   npm install

4. Buat file variabel lingkungan (.env) dari file contoh (.env.example):
   - Di Windows CMD:
     copy .env.example .env
   - Di Linux / Mac / PowerShell:
     cp .env.example .env

5. Buka & edit file .env untuk memasukkan GEMINI_API_KEY atau DATABASE_URL:
   - Di Windows:
     notepad .env
   - Di Linux / Mac:
     nano .env

6. (Opsional - Jika menggunakan database PostgreSQL):
   npm run db:push
   (Atau bisa juga: npx drizzle-kit push)

   *Catatan jika muncul error 'drizzle-kit not found':*
   - Pastikan Anda sudah menjalankan 'npm install' terlebih dahulu (Langkah 3).
   - Jangan jalankan npm install dengan '--production' karena drizzle-kit berada di devDependencies.
   - Ketikkan 'npm run db:push' (yang sudah kami sediakan di package.json).

7. Build & Jalankan Aplikasi:
   - Untuk Mode Uji Coba / Pengkodingan (Dev Mode):
     npm run dev
   - ATAU Untuk Mode Produksi Sekolah (Recommended):
     npm run build
     npm start

8. Buka browser (Chrome / Edge / Firefox) dan akses alamat:
   http://localhost:3000


--------------------------------------------------------------------------------
B. KETIKAN TERMINAL UNTUK UPDATE APLIKASI (OVERWRITE KODE RELEASES BARU)
--------------------------------------------------------------------------------

1. Setelah menimpa/mengganti file kode lama dengan file rilis baru (PASTIKAN file .env JANGAN dihapus):
   cd C:\MadrasahDigital

2. Update paket & dependensi npm versi terbaru:
   npm install

3. Update struktur database PostgreSQL (jika pakai PostgreSQL):
   npx drizzle-kit push

4. Build ulang aplikasi:
   npm run build

5. Jalankan server aplikasi versi terbaru:
   npm start

6. Buka browser di:
   http://localhost:3000


================================================================================
1. PANDUAN INSTALASI PERTAMA KALI (FRESH INSTALLATION) DI LOCALHOST
================================================================================

Ikuti langkah-langkah di bawah ini jika Anda baru pertama kali memasang/menginstal 
aplikasi Madrasah Digital di komputer/laptop server lokal Anda.

LANGKAH 1: PERSIAPAN PRASYARAT SOFTWARE
--------------------------------------------------------------------------------
1. Node.js (Versi 18 atau yang lebih baru):
   - Unduh dan pasang dari situs resmi: https://nodejs.org
   - Verifikasi pemasangan di terminal/CMD dengan mengetikkan:
     node -v
     npm -v

2. PostgreSQL Database (Opsional untuk Database Relasional):
   - Jika ingin menyimpan data ke database PostgreSQL lokal, unduh dari: https://www.postgresql.org/download/
   - Atau gunakan pgAdmin / DBeaver untuk mengelola database.
   - Catatan: Jika PostgreSQL tidak dikonfigurasi, sistem akan secara otomatis menyimpan data ke file JSON lokal (local_store.json / folder data/) sehingga aplikasi tetap 100% langsung dapat berjalan.

LANGKAH 2: DOWNLOAD & EKSTRAK SOURCE CODE
--------------------------------------------------------------------------------
1. Di Google AI Studio / GitHub, unduh source code proyek ini (Export to ZIP atau Git Clone).
2. Ekstrak file ZIP tersebut ke folder baru di komputer Anda (misal: C:\MadrasahDigital atau /home/user/MadrasahDigital).
3. Buka folder tersebut melalui Terminal / Command Prompt (CMD) / PowerShell atau VS Code Terminal.

LANGKAH 3: INSTAL DEPENDENSI NPM
--------------------------------------------------------------------------------
Jalankan perintah berikut di terminal pada direktori utama proyek:

  npm install

Proses ini akan mengunduh semua paket & library Node.js yang diperlukan (Express, React, Drizzle, Tailwind, dll.).

LANGKAH 4: KONFIGURASI LINGKUNGAN (.env)
--------------------------------------------------------------------------------
1. Di folder utama proyek (sejajar dengan package.json), buat file baru bernama `.env` (tanpa tanda kutip, pastikan ekstensinya bukan .env.txt).
2. Buka file `.env` dengan Notepad atau Text Editor, lalu masukkan konfigurasi dasar berikut:

  PORT=3000
  NODE_ENV=development
  
  # API Key Google Gemini (Diperlukan untuk fitur AI Pembuat Soal CBT, Modul Ajar, dll.)
  GEMINI_API_KEY=isi_dengan_api_key_gemini_anda

  # Konfigurasi PostgreSQL (Isi jika menggunakan PostgreSQL lokal)
  # Format: postgresql://username:password@localhost:5432/nama_database
  DATABASE_URL=postgresql://postgres:password123@localhost:5432/madrasah_db

3. Dapatkan API Key Gemini gratis di: https://ai.google.dev

LANGKAH 5: INISIALISASI DATABASE POSTGRESQL (JIKA MENGGUNAKAN POSTGRESQL)
--------------------------------------------------------------------------------
Jika Anda menggunakan PostgreSQL (DATABASE_URL diatur pada file .env):
1. Buka pgAdmin / psql, lalu buat database kosong baru:
   CREATE DATABASE madrasah_db;

2. Jalankan migrasi / push skema database menggunakan Drizzle ORM:
   npx drizzle-kit push
   
   Perintah ini akan secara otomatis membuat seluruh tabel (Siswa, Guru, Kelas, Absensi, CBT, Roster Jadwal, dll.) di database PostgreSQL Anda.

LANGKAH 6: JALANKAN APLIKASI
--------------------------------------------------------------------------------
Ada 2 mode untuk menjalankan aplikasi:

A. Mode Development (Untuk Uji Coba & Pengkodingan):
   npm run dev
   Buka browser di: http://localhost:3000

B. Mode Production (Rekomendasi Utama untuk Penggunaan Harian Sekolah):
   npm run build
   npm run start
   Buka browser di: http://localhost:3000

LANGKAH 7: AKUN ADMIN PERTAMA KALI
--------------------------------------------------------------------------------
Saat aplikasi pertama kali dibuka di browser (http://localhost:3000), Anda dapat langsung login sebagai Administrator atau mendaftarkan akun Admin baru sesuai petunjuk di layar login.


================================================================================
2. PANDUAN UPDATE APLIKASI DI LOCALHOST (OVERWRITE TANPA KEHILANGAN DATA)
================================================================================

Jika Anda telah menginstal aplikasi ini sebelumnya di localhost dan ingin memperbarui 
ke versi terbaru, ikuti langkah-langkah aman berikut untuk memperbarui aplikasi 
tanpa kehilangan data.

================================================================================
PENJELASAN RINCI: APA MAKSUD "TIMPA FILE" (OVERWRITE FILES)?
================================================================================
"Timpa file" artinya mengganti file kode sumber aplikasi versi lama dengan 
file kode sumber versi terbaru yang baru diunduh.

MENGAPA DATA KITA TIDAK AKAN HILANG SAAT TIMPA FILE?
- Seluruh data Madrasah (Data Siswa, Guru, Absensi, CBT, Jadwal Pelajaran, dll.) 
  tersimpan di dalam server database PostgreSQL (misalnya di database `madrasah_db`) 
  atau di file penyimpan data lokal (`local_store.json`).
- Mengganti atau menimpa file kodingan (`.js`, `.ts`, `.html`, `package.json`) 
  SAMA SEKALI TIDAK MENGANGGU ATAU MENGHAPUS isi tabel pada database Anda.

FILE / FOLDER YANG WAJIB DIPERTAHANKAN (JANGAN DIHAPUS / JANGAN DITIMPA):
1. File `.env` -> Berisi konfigurasi `DATABASE_URL` PostgreSQL & `GEMINI_API_KEY` Anda.
2. Folder `uploads/` (jika ada) -> Berisi dokumen/foto upload pengguna.
3. File `local_store.json` / folder `data/` (jika tidak menggunakan PostgreSQL).

CARA PRAKTIS MENIMPA FILE KODE APLIKASI DI WINDOWS / LINUX / MAC:
1. Ekstrak file ZIP versi rilis baru ke folder lain.
2. Salin (Copy) seluruh file dan folder rilis baru tersebut.
3. Tempel (Paste) langsung ke dalam folder aplikasi Anda di localhost.
4. Ketika muncul konfirmasi dari Windows/Mac: "Replace or Skip Files?" 
   (Timpa atau Lewati File?), pilih: "Replace the files in the destination" 
   (Timpa semua file di tujuan).
================================================================================

LANGKAH-LANGKAH URUTAN UPDATE APLIKASI:

LANGKAH 1: BACKUP DATA SEBELUM UPDATE
--------------------------------------------------------------------------------
A. Backup via Sistem Interface:
   - Masuk ke menu "Pengaturan" -> pilih tab "Pengaturan Sistem".
   - Klik tombol "Backup Data JSON" untuk mengunduh seluruh data (Siswa, Guru, 
     Kelas, Absensi, CBT, Jadwal, dll.) ke file JSON lokal sebagai cadangan.

B. Backup via PostgreSQL Dump (opsional tapi disarankan jika memakai PostgreSQL):
   - Buka terminal/CMD di komputer lokal dan jalankan perintah pg_dump:
     pg_dump -U postgres -d madrasah_db > backup_madrasah_$(date +%Y%m%d).sql

LANGKAH 2: LAKUKAN TIMPA FILE (OVERWRITE KODE TERBARU)
--------------------------------------------------------------------------------
- Jika menggunakan Git:
  Jalankan di terminal: `git pull origin main`

- Jika mengunduh file ZIP rilis baru:
  1. Ekstrak file ZIP baru.
  2. Copy seluruh isi folder baru dan Paste ke folder instalasi lama Anda.
  3. Pilih "Replace / Overwrite All".
  4. PASTIKAN file `.env` Anda tetap utuh.

LANGKAH 3: UPDATE DEPENDENSI NPM
--------------------------------------------------------------------------------
Buka terminal/CMD di direktori proyek dan jalankan:
  npm install

LANGKAH 4: VERIFIKASI KONFIGURASI LINGKUNGAN (.env)
--------------------------------------------------------------------------------
Pastikan file `.env` berisi konfigurasi yang sesuai:
  PORT=3000
  NODE_ENV=production
  GEMINI_API_KEY=isi_api_key_gemini
  DATABASE_URL=postgresql://postgres:password@localhost:5432/madrasah_db

LANGKAH 5: UPDATE SKEMA DATABASE POSTGRESQL (MIGRASI SKEMA)
--------------------------------------------------------------------------------
Jika versi baru memiliki penambahan tabel atau kolom baru di PostgreSQL, jalankan perintah push skema Drizzle ORM:
  npx drizzle-kit push

Catatan: Perintah ini memperbarui tabel PostgreSQL secara aman (menambah kolom 
atau tabel baru) tanpa menghapus data yang sudah ada di dalam PostgreSQL.

LANGKAH 6: BUILD & JALANKAN APLIKASI
--------------------------------------------------------------------------------
A. Untuk Mode Produksi:
   npm run build
   npm run start

B. Untuk Mode Pengembang (Development):
   npm run dev

Buka browser dan akses: http://localhost:3000

LANGKAH 7: VERIFIKASI DATA & INTEGRITAS
--------------------------------------------------------------------------------
- Login sebagai Admin.
- Cek ketersediaan data Siswa, Guru, Absensi, dan Roster Jadwal Pelajaran.
- Jika ada tabel yang kosong atau butuh pemulihan, gunakan menu "Pengaturan" -> 
  "Restore Data JSON" untuk memulihkan file backup yang diunduh pada Langkah 1.


================================================================================
3. SOLUSI MEMBUAT FILE .EXE (DOUBLE-CLICK TO RUN) DI WINDOWS
================================================================================

Karena aplikasi ini ditulis menggunakan Node.js + React, Anda tidak perlu menulis ulang kodenya ke Python hanya untuk membuat file .exe. Ada beberapa metode praktis agar pengguna tinggal klik langsung jalan di Windows:

METODE A: Menggunakan Batch File (.bat) - SANGAT MUDAH & CEPAT
Metode ini paling direkomendasikan karena tidak menambah ukuran file aplikasi dan langsung memanfaatkan engine Node.js yang sudah terpasang.

1. Buat file teks baru di folder utama proyek Anda.
2. Beri nama file tersebut: "Mulai_Aplikasi.bat"
3. Edit file tersebut menggunakan Notepad, lalu masukkan skrip berikut:

   @echo off
   echo Menjalankan Aplikasi Madrasah...
   start http://localhost:3000
   npm run build && npm start
   pause

4. Simpan file tersebut. Kini, setiap kali pengguna mengklik dua kali file "Mulai_Aplikasi.bat" tersebut, terminal akan otomatis mem-build aplikasi, menyalakan server lokal, dan membuka browser ke halaman utama secara otomatis!

---

METODE B: Menggunakan PKG (Mengompilasi Node.js menjadi .exe Tunggal)
Metode ini membungkus backend Node.js Anda menjadi satu file executable (.exe) mandiri sehingga bisa dijalankan tanpa perlu mengetik command di terminal.

1. Instal library `pkg` secara global di komputer Anda melalui terminal:
   
   npm install -g pkg

2. Jalankan perintah berikut untuk mengompilasi file server backend (`dist/server.cjs`) menjadi file .exe untuk Windows 64-bit:
   
   pkg dist/server.cjs --targets node18-win-x64 --output AplikasiMadrasah.exe

3. Setelah proses selesai, Anda akan mendapatkan file `AplikasiMadrasah.exe` yang siap dijalankan dengan sekali klik.

---

METODE C: Menggunakan Electron (Aplikasi Desktop Profesional)
Jika Anda ingin aplikasi ini berjalan dalam jendela (window) mandiri yang terpisah dari browser umum (seperti Google Chrome atau Microsoft Edge), Anda dapat mengintegrasikan Electron JS ke dalam proyek ini. Electron akan membungkus frontend React dan backend Express menjadi satu installer aplikasi desktop profesional (.exe) seperti VS Code, Discord, atau Spotify.


================================================================================
4. PANDUAN MENGAKSES KAMERA / LIVE CAM DI IP LOKAL (WI-FI / HTTP & HTTPS)
================================================================================
Secara default, kebijakan keamanan browser modern (Google Chrome, Edge, Safari, Firefox,
serta Android WebView) menetapkan bahwa akses kamera (navigator.mediaDevices.getUserMedia)
HANYA diizinkan secara otomatis pada "Secure Origin" (seperti localhost atau situs HTTPS).

Ketika server diakses via IP address lokal (misal: http://192.168.1.50:3000), browser HP
menganggap protokol HTTP sebagai "Insecure Origin" dan memblokir akses kamera live stream.

Berikut adalah 3 solusi lengkap agar kamera / live cam dapat diakses:

================================================================================
CARA A: MENGGUNAKAN CADDY SERVER (PALING MUDAH, OTOMATIS & REKOMENDASI UTAMA)
        *SOLUSI TERBAIK: KAMERA OTOMATIS AKTIF TANPA MENGUBAH SETTING HP SISWA*
================================================================================
Caddy Server (https://caddyserver.com) adalah web server modern yang sangat ringan dan 
dapat meng-generate sertifikat SSL internal (HTTPS) secara 100% otomatis tanpa perlu 
mengubah kode aplikasi Node.js/Express Anda sama sekali.

Dengan Caddy Server, server lokal Anda akan berjalan di HTTPS, sehingga browser HP siswa 
mengenalinya sebagai "Secure Origin". Kamera live stream absensi & CBT akan otomatis 
terbuka dengan lancar TANPA PERLU MENGUBAH SETTING APAPUN DI HP SISWA!

Langkah-Langkah Rinci Penggunaan Caddy Server:

1. Unduh Caddy Server di Komputer Server:
   - Unduh executable Caddy gratis dari: https://caddyserver.com/download
   - Atau install via Terminal/CMD:
     * Windows (via Winget): `winget install CaddyServer.Caddy`
     * Windows (via Chocolatey): `choco install caddy`
     * macOS: `brew install caddy`
     * Linux (Ubuntu/Debian): `sudo apt install caddy`

2. Buat File Konfigurasi `Caddyfile`:
   - Di folder utama proyek aplikasi ini (sejajar dengan `package.json`), buat file teks 
     baru bernama `Caddyfile` (tanpa ekstensi file).
   - Isi file `Caddyfile` tersebut dengan 3 baris kode sederhana berikut (ganti `192.168.1.50` 
     dengan IP Wi-Fi lokal komputer server Anda):

     192.168.1.50:443 {
         tls internal
         reverse_proxy localhost:3000
     }

3. Jalankan Aplikasi & Caddy Server:
   a. Jalankan aplikasi Node.js Anda di port 3000 seperti biasa:
      `npm run dev`  (atau `npm start`)
   b. Buka Terminal / CMD baru di folder proyek, lalu jalankan perintah Caddy:
      `caddy run`
      Caddy akan otomatis membuat SSL Certificate internal dan mengarahkan lalu lintas 
      HTTPS (port 443) ke port 3000 aplikasi Anda.

4. Akses dari HP Siswa / Client:
   a. Minta siswa membuka alamat HTTPS via browser HP (tanpa mengetikkan port :3000):
      `https://192.168.1.50`
   b. Saat pertama kali dibuka, browser HP akan menampilkan pesan peringatan 
      ("Koneksi Anda tidak privat / Connection is not private") karena menggunakan 
      sertifikat SSL internal self-signed.
   c. Siswa cukup menekan tombol "Lanjutan" (Advanced) lalu klik 
      "Lanjutkan ke 192.168.1.50 (tidak aman)" / Proceed.
   d. Selesai! Kamera absensi & live cam CBT langsung meminta izin akses kamera dan 
      BERJALAN 100% SANGAT LANCAR TANPA MENGUBAH PENGATURAN APAPUN DI HP SISWA!

================================================================================
CARA B: MENGGUNAKAN TOMBOL "UPLOAD FOTO / KAMERA HP" (ALTERNATIF PRAKTIS)
================================================================================
Jika server tetap menggunakan HTTP biasa (tanpa HTTPS/SSL):
1. Ketika halaman absensi atau ujian dibuka via HTTP IP lokal, jika kamera live stream 
   diblokir oleh browser HP, sistem aplikasi secara cerdas otomatis menampilkan 
   tombol alternatif "Upload Foto / Kamera HP".
2. Siswa/Guru cukup menekan tombol tersebut. Browser HP akan langsung memanggil aplikasi 
   kamera bawaan perangkat HP untuk mengambil foto selfie, lalu foto akan otomatis 
   diunggah dan diproses oleh sistem.

================================================================================
CARA C: MENGIZINKAN INSECURE ORIGIN DI CHROME FLAGS HP CLIENT
================================================================================
Jika ingin tetap memakai HTTP tanpa SSL namun ingin fitur live streaming kamera aktif:
1. Buka Google Chrome di perangkat HP / Laptop client.
2. Ketik pada address bar:
   `chrome://flags/#unsafely-treat-insecure-origin-as-secure`
3. Pada opsi "Insecure origins treated as secure", masukkan IP dan Port server Anda:
   `http://192.168.1.50:3000`
4. Ubah status dropdown dari Default menjadi **Enabled**.
5. Klik tombol **Relaunch** di bagian bawah untuk memuat ulang Chrome.
6. Kamera live stream dan pemantauan ujian livecam kini aktif sempurna.


================================================================================
5. PANDUAN KONFIGURASI WEBRTC SFU (LIVEKIT SERVER) UNTUK CBT LIVE MONITORING
================================================================================

Aplikasi ini mendukung dual-mode WebRTC untuk monitoring video ujian CBT secara real-time:
1. Mode Default (P2P): Berjalan otomatis tanpa konfigurasi server tambahan. Sangat hemat bandwidth server, namun jika jumlah siswa banyak (>5 siswa) atau jaringan LAN dibatasi firewall/NAT symetric, koneksi video bisa tidak stabil atau gagal terhubung pada beberapa perangkat.
2. Mode SFU (LiveKit Server): Menggunakan server streaming tersentralisasi. Video dari HP siswa dipancarkan satu kali ke server SFU, lalu admin/guru mengambil aliran tersebut dari server. Sangat stabil, andal, lancar untuk banyak siswa sekaligus, dan sanggup menembus berbagai jenis pembatasan firewall/NAT.

Berikut adalah perbandingan & cara instalasi LiveKit Server (Docker vs Tanpa Docker):

================================================================================
A. PERBANDINGAN METODE LIVEKIT (DOCKER VS TANPA DOCKER)
================================================================================
| Fitur / Parameter  | Menggunakan Docker (Local) | Tanpa Docker (LiveKit Cloud) | Tanpa Docker (Local Binary) |
|--------------------|----------------------------|-------------------------------|-----------------------------|
| Ketersediaan       | Offline (LAN Lokal & Wi-Fi)| Online (Butuh Internet)       | Offline (LAN Lokal & Wi-Fi) |
| Biaya              | 100% Gratis Selamanya      | Gratis s.d 50 GB / bulan      | 100% Gratis Selamanya       |
| Limit Jumlah Siswa | Tidak terbatas (Batas HW)  | Terbatas kuota bandwidth      | Tidak terbatas (Batas HW)   |
| Kemudahan Setup    | Sangat Mudah (1-command)   | Sangat Mudah (Instan di web)  | Sedang (Manual Config YAML) |
| Rekomendasi        | UTAMA untuk ujian offline  | Alternatif jika ujian online  | Cadangan jika tanpa Docker  |

================================================================================
B. METODE 1: MENGGUNAKAN DOCKER (REKOMENDASI UTAMA - OFFLINE / LAN SEKOLAH)
================================================================================
Docker mengemas seluruh service LiveKit Server ke dalam satu kontainer siap pakai. Sangat direkomendasikan untuk ujian di jaringan LAN sekolah tanpa membutuhkan koneksi internet.

Langkah-Langkah:
1. Unduh dan pasang Docker Desktop di Komputer Server Anda:
   - Windows/Mac: Unduh dari https://www.docker.com/products/docker-desktop
   - Linux: Jalankan perintah `sudo apt install docker.io docker-compose`

2. Jalankan LiveKit Server dalam mode developer dengan satu perintah terminal berikut:
   docker run --rm -p 7880:7880 -p 7881:7881 -p 7882:7882/udp \
     livekit/livekit-server \
     --dev \
     --key-file /dev/null \
     --keys "{devkey: secret}"

   *Penjelasan:*
   - Port 7880: Port WebSocket & HTTP API.
   - Port 7881-7882: Port UDP/TCP untuk transmisi media WebRTC.
   - `--dev`: Mengaktifkan mode development (bypass pemeriksaan SSL/HTTPS untuk mempermudah development lokal).
   - `--keys`: Menentukan API Key (`devkey`) dan API Secret (`secret`).

3. Konfigurasi di Aplikasi Madrasah Digital:
   - Login sebagai Admin di aplikasi Madrasah Digital (http://localhost:3000).
   - Masuk ke menu "Pengaturan" -> tab "Pengaturan Sistem & Konfigurasi".
   - Isi form konfigurasi LiveKit sebagai berikut:
     * LiveKit Server URL: `ws://localhost:7880` (Ganti `localhost` dengan IP Wi-Fi lokal server jika diakses dari perangkat siswa, misal: `ws://192.168.1.50:7880` atau `wss://192.168.1.50:7880` jika menggunakan HTTPS Caddy)
     * LiveKit API Key: `devkey`
     * LiveKit API Secret: `secret`
   - Klik "Simpan Pengaturan Utama".

Selesai! Live-monitoring CBT berbasis SFU telah aktif dan berjalan 100% lokal tanpa kuota internet!

================================================================================
C. METODE 2: TANPA DOCKER VIA LIVEKIT CLOUD (SANGAT MUDAH - ONLINE)
================================================================================
Jika sekolah menyelenggarakan ujian secara online (melalui internet) atau tidak ingin repot menginstal Docker di server, Anda bisa menggunakan LiveKit Cloud gratis.

Langkah-Langkah:
1. Daftar Akun Gratis:
   - Buka situs https://livekit.io lalu klik "Sign Up" atau masuk ke LiveKit Cloud Console.
2. Buat Project Baru:
   - Buat sebuah proyek baru di dashboard cloud Anda.
3. Dapatkan Kredensial API:
   - Setelah proyek dibuat, LiveKit Cloud akan secara otomatis memberikan:
     * LiveKit Server URL (Format: `wss://namaproyek-xxxx.livekit.cloud`)
     * LiveKit API Key (Format: `APIxxxxxxxxxxxx`)
     * LiveKit API Secret (Format: string panjang rahasia)
4. Masukkan Kredensial ke Aplikasi Madrasah Digital:
   - Buka menu "Pengaturan" -> "Pengaturan Sistem & Konfigurasi".
   - Masukkan Server URL (wss://...), API Key, dan API Secret yang Anda dapatkan dari dashboard LiveKit Cloud tadi.
   - Klik "Simpan Pengaturan Utama".

Kelebihan: Anda mendapatkan kapasitas gratis sebesar 50 GB bandwidth per bulan, yang mana sangat cukup untuk ujian skala kecil hingga menengah tanpa setup server lokal sama sekali!

================================================================================
D. METODE 3: TANPA DOCKER VIA LOCAL BINARY (OFFLINE - TANPA DOCKER)
================================================================================
Jika Anda ingin setup lokal offline namun komputer server Anda tidak diizinkan memasang Docker.

Langkah-Langkah:
1. Unduh Binary LiveKit Server:
   - Buka halaman GitHub Release LiveKit Server: https://github.com/livekit/livekit/releases
   - Unduh file kompresi server yang sesuai dengan OS Anda (misal: `livekit-server_Windows_x86_64.zip` untuk Windows atau `livekit-server_Linux_x86_64.tar.gz` untuk Linux).
2. Ekstrak File:
   - Ekstrak file tersebut ke sebuah folder di komputer server Anda. Anda akan mendapatkan file executable bernama `livekit-server`.
3. Buat File Konfigurasi `livekit.yaml` di folder yang sama:
   ```yaml
   port: 7880
   bind_addresses:
     - ""
   keys:
     devkey: secret
   ```
4. Jalankan LiveKit Server via Terminal / CMD:
   - Di Windows CMD: `livekit-server.exe --config livekit.yaml --dev`
   - Di Linux/Mac: `./livekit-server --config livekit.yaml --dev`
5. Masukkan Kredensial ke Aplikasi Madrasah Digital seperti pada langkah di Metode 1.


================================================================================
6. FITUR PENYUSUNAN OTOMATIS JADWAL PELAJARAN (BEBAS BENTROKAN)
================================================================================

Menu "Jadwal & Mata Pelajaran" dilengkapi dengan fitur Penyusunan Otomatis 
Jadwal KBM (Auto-Scheduler) yang cerdas dan bebas konflik/bentrokan.

CARA MENGGUNAKAN FITUR AUTO-SCHEDULER:
1. Masuk ke menu "Jadwal & Mata Pelajaran" di Dashboard Admin.
2. Klik tombol "Susun Otomatis Jadwal" di pojok kanan atas.
3. Pilih Hari KBM (misal: Senin - Sabtu) dan tentukan Mode Penyusunan:
   - Mode Reset & Susun Ulang: Menggantikan semua jadwal terpasang dengan jadwal baru.
   - Mode Tambahkan ke Jadwal Ada: Mempertahankan jadwal lama dan mengisi slot jam 
     yang masih kosong.
4. Klik tombol "Jalankan Auto-Scheduler".
5. Sistem akan menjalankan algoritma Anti-Collision yang memastikan:
   - Tidak ada Guru yang mengajar di 2 kelas berbeda pada jam pelajaran yang sama.
   - Tidak ada Kelas yang memiliki 2 mata pelajaran pada jam pelajaran yang sama.
6. Tinjau hasil penyusunan jadwal pada modal Pratinjau (Preview).
7. Klik "Terapkan Jadwal Ke Sistem" untuk menyimpan jadwal.
8. Setelah diterapkan, jadwal secara otomatis tersimpan dan pengguna dapat 
   mengedit, menambah, atau menghapus jadwal secara manual sewaktu-waktu.


================================================================================
7. KONTAK & BANTUAN
================================================================================
Jika mengalami kendala teknis saat instalasi pertama kali maupun update di localhost, 
pastikan service Node.js dan PostgreSQL telah berjalan dan kredensial database 
pada file `.env` sudah sesuai.

================================================================================
Dibuat dengan dedikasi untuk Madrasah Digital
================================================================================
