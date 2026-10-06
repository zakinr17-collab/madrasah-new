param(
    [string]$BaseUrl = "https://madrasahku.ai.studio",
    [string]$Tenant = "default",
    [string]$StudentPassword = "123456",
    [string]$OutputPath = (Join-Path $PSScriptRoot "accounts.local.json")
)

$ErrorActionPreference = "Stop"
$BaseUrl = $BaseUrl.TrimEnd('/')

Write-Host "=== Madrasah Bisa - Siapkan Akun Load Test ===" -ForegroundColor Cyan
Write-Host "Target : $BaseUrl"
Write-Host "Tenant : $Tenant"
Write-Host ""

$AdminUser = Read-Host "Username admin madrasah"
$SecureAdminPassword = Read-Host "Password admin (tidak ditampilkan)" -AsSecureString
$Credential = New-Object System.Net.NetworkCredential("", $SecureAdminPassword)
$AdminPassword = $Credential.Password

try {
    $LoginBody = @{
        username = $AdminUser
        password = $AdminPassword
        madrasahId = $Tenant
        madrasahSlug = $Tenant
    } | ConvertTo-Json

    $Login = Invoke-RestMethod `
        -Uri "$BaseUrl/api/login" `
        -Method Post `
        -ContentType "application/json" `
        -Headers @{ "X-Madrasah-Id" = $Tenant } `
        -Body $LoginBody
} finally {
    $AdminPassword = $null
    $Credential = $null
    $SecureAdminPassword = $null
}

$Token = $null
if ($Login.user -and $Login.user.token) {
    $Token = [string]$Login.user.token
} elseif ($Login.token) {
    $Token = [string]$Login.token
}

if (-not $Token) {
    throw "Login berhasil tetapi token tidak ditemukan pada response."
}

$Headers = @{
    "Authorization" = "Bearer $Token"
    "X-Auth-Token" = $Token
    "X-Madrasah-Id" = $Tenant
    "X-User-Role" = "admin"
}

$EncodedTenant = [uri]::EscapeDataString($Tenant)
$StudentsResponse = Invoke-RestMethod `
    -Uri "$BaseUrl/api/students?madrasahId=$EncodedTenant" `
    -Method Get `
    -Headers $Headers

$Students = @($StudentsResponse.students)
if ($Students.Count -eq 0) {
    throw "Tidak ada siswa yang ditemukan pada tenant '$Tenant'."
}

$Accounts = @()
foreach ($Student in $Students) {
    $Username = ""
    if ($Student.username) {
        $Username = [string]$Student.username
    } elseif ($Student.nis) {
        $Username = "siswa_$($Student.nis)"
    }

    if ([string]::IsNullOrWhiteSpace($Username)) {
        continue
    }

    $Accounts += [PSCustomObject]@{
        studentId = [string]$Student.id
        nis = [string]$Student.nis
        username = $Username
        password = $StudentPassword
    }
}

if ($Accounts.Count -eq 0) {
    throw "Data siswa ada, tetapi tidak ada username yang dapat dipakai."
}

$OutputDir = Split-Path -Parent $OutputPath
if ($OutputDir -and -not (Test-Path $OutputDir)) {
    New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
}

$Json = $Accounts | ConvertTo-Json -Depth 4
$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($OutputPath, $Json, $Utf8NoBom)

Write-Host ""
Write-Host "Berhasil membuat $($Accounts.Count) akun load test:" -ForegroundColor Green
Write-Host "  $OutputPath"
Write-Host ""
Write-Host "CATATAN: password siswa pada file menggunakan nilai -StudentPassword ('$StudentPassword')." -ForegroundColor Yellow
Write-Host "Jika dummy siswa dahulu dibuat/import tanpa password khusus, default backend adalah 123456." -ForegroundColor Yellow

try {
    $ExamsResponse = Invoke-RestMethod `
        -Uri "$BaseUrl/api/exams?madrasahId=$EncodedTenant" `
        -Method Get `
        -Headers $Headers
    $Exams = @($ExamsResponse.exams)

    if ($Exams.Count -gt 0) {
        Write-Host ""
        Write-Host "Daftar ujian tenant ini (pilih UJIAN LOAD TEST khusus):" -ForegroundColor Cyan
        $Exams | ForEach-Object {
            $DisplayName = ""
            if ($_.title) { $DisplayName = [string]$_.title }
            elseif ($_.name) { $DisplayName = [string]$_.name }
            elseif ($_.subject) { $DisplayName = [string]$_.subject }

            [PSCustomObject]@{
                id = [string]$_.id
                nama = $DisplayName
                status = [string]$_.status
                kelas = [string]$_.classId
            }
        } | Format-Table -AutoSize
    } else {
        Write-Host "Belum ada ujian. Buat satu ujian LOAD TEST khusus dari aplikasi sebelum menjalankan k6." -ForegroundColor Yellow
    }
} catch {
    Write-Host "Tidak dapat menampilkan daftar ujian: $($_.Exception.Message)" -ForegroundColor Yellow
}

$Token = $null
$Headers = $null
Write-Host ""
Write-Host "Selesai. Admin password dan JWT tidak ditulis ke file." -ForegroundColor Green
