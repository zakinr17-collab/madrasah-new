param(
    [string]$BaseUrl = "https://madrasahku.ai.studio",
    [string]$Tenant = "default",
    [Parameter(Mandatory = $true)]
    [string]$ExamId,
    [string]$AccountsPath = "",
    [int]$AccountOffset = 0,
    [int]$Count = 0
)

$ErrorActionPreference = "Stop"
$BaseUrl = $BaseUrl.TrimEnd('/')

if ([string]::IsNullOrWhiteSpace($AccountsPath)) {
    $ScriptDir = [string]$PSScriptRoot
    if ([string]::IsNullOrWhiteSpace($ScriptDir)) {
        $ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
    }
    $PreferredAccounts = Join-Path $ScriptDir "accounts.loadtest.local.json"
    $FallbackAccounts = Join-Path $ScriptDir "accounts.local.json"
    if (Test-Path $PreferredAccounts) {
        $AccountsPath = $PreferredAccounts
    } elseif (Test-Path $FallbackAccounts) {
        $AccountsPath = $FallbackAccounts
    } else {
        $AccountsPath = $PreferredAccounts
    }
}

if (-not (Test-Path $AccountsPath)) {
    throw "File akun load-test tidak ditemukan: $AccountsPath"
}

$Accounts = @(Get-Content -Raw -Path $AccountsPath | ConvertFrom-Json)
if ($Accounts.Count -eq 0) {
    throw "File akun load-test kosong."
}
if ($AccountOffset -lt 0 -or $AccountOffset -ge $Accounts.Count) {
    throw "AccountOffset di luar rentang akun."
}

$TakeCount = if ($Count -gt 0) { $Count } else { $Accounts.Count - $AccountOffset }
if (($AccountOffset + $TakeCount) -gt $Accounts.Count) {
    throw "Rentang cleanup melebihi jumlah akun: offset=$AccountOffset count=$TakeCount total=$($Accounts.Count)."
}

$Targets = @($Accounts | Select-Object -Skip $AccountOffset -First $TakeCount)
$MissingIds = @($Targets | Where-Object { [string]::IsNullOrWhiteSpace([string]$_.studentId) })
if ($MissingIds.Count -gt 0) {
    throw "Ada $($MissingIds.Count) akun tanpa studentId. Buat ulang file akun dengan prepare-loadtest-accounts.ps1."
}

Write-Host "=== Madrasah Bisa - Cleanup State CBT Soak ===" -ForegroundColor Cyan
Write-Host "Target      : $BaseUrl"
Write-Host "Tenant      : $Tenant"
Write-Host "Exam ID     : $ExamId"
Write-Host "Akun target : $($Targets.Count) (offset $AccountOffset)"
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

$EncodedTenant = [uri]::EscapeDataString($Tenant)
$ExamsResponse = Invoke-RestMethod `
    -Uri "$BaseUrl/api/exams?madrasahId=$EncodedTenant" `
    -Method Get `
    -Headers $Headers

$Exam = @($ExamsResponse.exams) | Where-Object { [string]$_.id -eq [string]$ExamId } | Select-Object -First 1
if (-not $Exam) {
    throw "Exam '$ExamId' tidak ditemukan pada tenant '$Tenant'."
}

$ExamName = ""
if ($Exam.title) {
    $ExamName = [string]$Exam.title
} elseif ($Exam.name) {
    $ExamName = [string]$Exam.name
} elseif ($Exam.subject) {
    $ExamName = [string]$Exam.subject
}

if ($ExamName -notmatch '(?i)LOAD[\s_-]*TEST') {
    throw "Cleanup dibatalkan: ujian '$ExamName' tidak teridentifikasi sebagai LOAD TEST. Ubah nama ujian test agar mengandung 'LOAD TEST'."
}

Write-Host "Ujian terverifikasi: $ExamName" -ForegroundColor Green
Write-Host "Cleanup hanya menghapus state pengerjaan CBT untuk akun target; siswa dan jadwal ujian tidak dihapus." -ForegroundColor Yellow
Write-Host ""

$Succeeded = 0
$Failed = New-Object System.Collections.Generic.List[object]
$Index = 0

foreach ($Account in $Targets) {
    $Index++
    $StudentId = [string]$Account.studentId
    try {
        $Body = @{
            studentId = $StudentId
            examId = $ExamId
        } | ConvertTo-Json

        $Result = Invoke-RestMethod `
            -Uri "$BaseUrl/api/reset-student-exam" `
            -Method Post `
            -ContentType "application/json" `
            -Headers $Headers `
            -Body $Body

        if (-not $Result.success) {
            $ServerMessage = if ($Result.message) { [string]$Result.message } else { "Server menolak reset." }
            throw $ServerMessage
        }
        $Succeeded++
    } catch {
        $Failed.Add([PSCustomObject]@{
            studentId = $StudentId
            username = [string]$Account.username
            error = $_.Exception.Message
        })
    }

    if (($Index % 25) -eq 0 -or $Index -eq $Targets.Count) {
        Write-Progress `
            -Activity "Membersihkan state CBT soak" `
            -Status "$Index / $($Targets.Count) diproses; sukses=$Succeeded gagal=$($Failed.Count)" `
            -PercentComplete (($Index / [Math]::Max(1, $Targets.Count)) * 100)
    }
}

Write-Progress -Activity "Membersihkan state CBT soak" -Completed
$Token = $null
$Headers = $null

Write-Host ""
Write-Host "Cleanup selesai. Sukses: $Succeeded / $($Targets.Count)" -ForegroundColor Green
if ($Failed.Count -gt 0) {
    Write-Host "Gagal: $($Failed.Count)" -ForegroundColor Red
    $Failed | Format-Table -AutoSize
    exit 1
}

Write-Host "State active session, completed/force-finished, answers, question packet, violation/block, livecam frame, dan nilai ujian load-test akun target telah direset melalui endpoint server." -ForegroundColor Green
