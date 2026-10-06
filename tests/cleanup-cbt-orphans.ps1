param(
    [string]$BaseUrl = "https://madrasahku.ai.studio",
    [string]$Tenant = "default",
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"
$BaseUrl = $BaseUrl.TrimEnd('/')

Write-Host "=== Madrasah Bisa - Cleanup Orphan State CBT ===" -ForegroundColor Cyan
Write-Host "Target : $BaseUrl"
Write-Host "Tenant : $Tenant"
Write-Host "Mode   : $(if ($DryRun) { 'DRY RUN (tidak menghapus)' } else { 'CLEANUP' })"
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
    throw "Login admin berhasil tetapi token tidak ditemukan."
}

$Headers = @{
    "Authorization" = "Bearer $Token"
    "X-Auth-Token" = $Token
    "X-Madrasah-Id" = $Tenant
    "X-User-Role" = "admin"
}

$Body = @{
    dryRun = [bool]$DryRun
} | ConvertTo-Json

try {
    $Result = Invoke-RestMethod `
        -Uri "$BaseUrl/api/exams/cleanup-orphan-state?madrasahId=$([uri]::EscapeDataString($Tenant))" `
        -Method Post `
        -ContentType "application/json" `
        -Headers $Headers `
        -Body $Body
} finally {
    $Token = $null
    $Headers = $null
}

if (-not $Result.success) {
    $Message = if ($Result.message) { [string]$Result.message } else { "Server menolak cleanup orphan CBT." }
    throw $Message
}

Write-Host ""
Write-Host "Orphan exam ditemukan : $($Result.orphanExamCount)" -ForegroundColor Cyan
if ($Result.orphanExamIds -and @($Result.orphanExamIds).Count -gt 0) {
    Write-Host "Exam ID orphan:"
    @($Result.orphanExamIds) | ForEach-Object { Write-Host "  - $_" }
}

if ($DryRun) {
    Write-Host ""
    Write-Host "Dry run selesai. Tidak ada state yang dihapus." -ForegroundColor Yellow
    Write-Host "State terdeteksi : $($Result.removedStateKeys)"
    Write-Host "Message terdeteksi: $($Result.removedMessageKeys)"
    Write-Host "Violation terdeteksi: $($Result.removedViolationKeys)"
} else {
    Write-Host ""
    Write-Host "Cleanup selesai." -ForegroundColor Green
    Write-Host "State dihapus    : $($Result.removedStateKeys)"
    Write-Host "Message dihapus  : $($Result.removedMessageKeys)"
    Write-Host "Violation dihapus: $($Result.removedViolationKeys)"
    Write-Host "Total key dihapus: $($Result.removedTotalKeys)" -ForegroundColor Green
}
