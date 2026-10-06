@echo off
:: =========================================================================
:: Script Otomatis Buka Port 3000 di Windows Defender Firewall
:: Madrasah Bisa - CBT & Manajemen Sekolah Local Server
:: =========================================================================

echo.
echo =========================================================================
echo    MEMBUKA PORT 3000 DI WINDOWS FIREWALL UNTUK SERVER CBT MADRASAH
echo =========================================================================
echo.

:: Memeriksa hak Administrator
net session >nul 2>&1
if %errorLevel% NEQ 0 (
    echo [PERINGATAN] Script ini membutuhkan hak Administrator!
    echo Silakan Klik Kanan pada file ini lalu pilih "Run as administrator".
    echo.
    pause
    exit /b 1
)

echo Menambahkan aturan Firewall Inbound untuk Port 3000 (TCP)...
netsh advfirewall firewall delete rule name="Madrasah_Bisa_CBT_Port_3000" >nul 2>&1
netsh advfirewall firewall add rule name="Madrasah_Bisa_CBT_Port_3000" dir=in action=allow protocol=TCP localport=3000 profile=any description="Membuka Port 3000 untuk server ujian CBT Madrasah Bisa di jaringan lokal LAN/Wi-Fi."

if %errorLevel% EQU 0 (
    echo.
    echo =========================================================================
    echo [SUKSES] Port 3000 Berhasil Di-Allow di Windows Firewall!
    echo Sekarang HP Siswa dan Router AP dapat mengakses server tanpa diblokir.
    echo =========================================================================
    echo.
) else (
    echo.
    echo [GAGAL] Terjadi kesalahan saat menambahkan aturan Firewall.
    echo.
)

pause
