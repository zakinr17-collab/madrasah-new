param(
    [string]$BaseUrl = "https://madrasahku.ai.studio",
    [string]$Tenant = "default",
    [string]$StudentPassword = "",
    [int]$ExpectedCount = 800
)

$ErrorActionPreference = "Stop"
$BaseUrl = $BaseUrl.TrimEnd('/')

Write-Host "=== Madrasah Bisa - Recovery Password Akun Load Test ===" -ForegroundColor Cyan
Write-Host "Target : $BaseUrl"
Write-Host "Tenant : $Tenant"
Write-Host ""

$AdminUser = Read-Host "Username admin madrasah"
$SecureAdminPassword = Read-Host "Password admin (tidak ditampilkan)" -AsSecureString
$AdminCredential = New-Object System.Net.NetworkCredential("", $SecureAdminPassword)
$AdminPassword = $AdminCredential.Password

if ([string]::IsNullOrWhiteSpace($StudentPassword)) {
    $SecureStudentPassword = Read-Host "Password BARU untuk akun loadtest (tidak ditampilkan)" -AsSecureString
    $StudentCredential = New-Object System.Net.NetworkCredential("", $SecureStudentPassword)
    $StudentPassword = $StudentCredential.Password
}
if ([string]::IsNullOrWhiteSpace($StudentPassword) -or $StudentPassword.Length -lt 8) {
    throw "Password baru minimal 8 karakter."
}

try {
    $LoginBody = @{
        username = $AdminUser
        password = $AdminPassword
        madrasahId = $Tenant
        madrasahSlug = $Tenant
    } | ConvertTo-Json
    $Login = Invoke-RestMethod -Uri "$BaseUrl/api/login" -Method Post -ContentType "application/json" -Headers @{ "X-Madrasah-Id" = $Tenant } -Body $LoginBody
} finally {
    $AdminPassword = $null
    $AdminCredential = $null
    $SecureAdminPassword = $null
}

$Token = if ($Login.user -and $Login.user.token) { [string]$Login.user.token } elseif ($Login.token) { [string]$Login.token } else { $null }
if (-not $Token) { throw "Login admin berhasil tetapi token tidak ditemukan." }

$Headers = @{
    "Authorization" = "Bearer $Token"
    "X-Auth-Token" = $Token
    "X-Madrasah-Id" = $Tenant
    "X-User-Role" = "admin"
}

$EncodedTenant = [uri]::EscapeDataString($Tenant)
$StudentsResponse = Invoke-RestMethod -Uri "$BaseUrl/api/students?madrasahId=$EncodedTenant" -Method Get -Headers $Headers
$Targets = @($StudentsResponse.students | Where-Object {
    ([string]$_.username -match '^loadtest[0-9]{3}$') -and ([string]$_.nis -match '^LT[0-9]{3}$')
})

Write-Host "Akun loadtest yang ditemukan: $($Targets.Count)" -ForegroundColor Yellow
if ($Targets.Count -ne $ExpectedCount) {
    throw "Dibatalkan: jumlah target $($Targets.Count), sedangkan ExpectedCount=$ExpectedCount. Tidak ada password yang diubah."
}

$Body = @{
    ids = @($Targets | ForEach-Object { [string]$_.id })
    password = $StudentPassword
} | ConvertTo-Json -Depth 4

$Result = Invoke-RestMethod -Uri "$BaseUrl/api/admin/reset-student-passwords-bulk" -Method Post -ContentType "application/json" -Headers $Headers -Body $Body
if (-not $Result.success -or [int]$Result.updated -ne $ExpectedCount) {
    throw "Reset tidak lengkap. updated=$($Result.updated), requested=$($Result.requested), skipped=$($Result.skipped)"
}

Write-Host "Berhasil mereset password $($Result.updated) akun loadtest." -ForegroundColor Green
Write-Host "Password tidak dicetak ke terminal. Gunakan nilai yang baru saja Anda masukkan untuk membuat file akun k6." -ForegroundColor Green

$StudentPassword = $null
$SecureStudentPassword = $null
$StudentCredential = $null
$Token = $null
$Headers = $null
