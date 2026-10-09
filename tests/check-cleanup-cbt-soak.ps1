# Offline-only PowerShell regression for cleanup-cbt-soak.ps1. No API calls.
$ErrorActionPreference = 'Stop'
$CleanupScript = Join-Path $PSScriptRoot 'cleanup-cbt-soak.ps1'
$FixtureDir = Join-Path ([System.IO.Path]::GetTempPath()) ('cbt-cleanup-preflight-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $FixtureDir -Force | Out-Null
$FixturePath = Join-Path $FixtureDir 'accounts.json'

function Write-Fixture([object]$Rows) {
    $Json = ConvertTo-Json -InputObject $Rows -Depth 5
    $Utf8 = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($FixturePath, $Json, $Utf8)
}

function Assert-Valid([int]$ExpectedCount) {
    & $CleanupScript -ExamId 'LOAD-TEST-FIXTURE' -AccountsPath $FixturePath -Count $ExpectedCount -ValidateOnly | Out-Null
    if ($LASTEXITCODE -and $LASTEXITCODE -ne 0) { throw "Cleanup validation returned exit code $LASTEXITCODE" }
}

function Assert-Rejected([int]$ExpectedCount, [string]$ExpectedError) {
    $Rejected = $false
    try {
        & $CleanupScript -ExamId 'LOAD-TEST-FIXTURE' -AccountsPath $FixturePath -Count $ExpectedCount -ValidateOnly | Out-Null
    } catch {
        if ($_.Exception.Message -like "*$ExpectedError*") { $Rejected = $true }
        else { throw }
    }
    if (-not $Rejected) { throw "Expected cleanup preflight rejection: $ExpectedError" }
}

try {
    $Rows = @(
        for ($i = 0; $i -lt 800; $i++) {
            [PSCustomObject]@{
                studentId = "STUDENT-$i"
                username = ('loadtest{0:D3}' -f $i)
                nis = ('LT{0:D3}' -f $i)
                password = 'fixture-do-not-use'
            }
        }
    )
    Write-Fixture $Rows
    Assert-Valid 800
    Assert-Valid 1
    Assert-Rejected 801 'Rentang cleanup melebihi jumlah akun'
    $Rows[25].username = 'real-student'
    Write-Fixture $Rows
    Assert-Rejected 800 'tidak sesuai pola'
    $Rows[25].username = 'loadtest025'
    $Rows[25].studentId = $Rows[24].studentId
    Write-Fixture $Rows
    Assert-Rejected 800 'studentId duplikat'
    $Rows[25].studentId = 'STUDENT-25'
    Write-Fixture ([PSCustomObject]@{ accounts = $Rows })
    Assert-Rejected 800 'array JSON'
    Write-Host 'PASS: PowerShell CBT cleanup handles 800 accounts, offset/count, non-loadtest guard, duplicate guard, and malformed JSON.'
} finally {
    Remove-Item -LiteralPath $FixtureDir -Recurse -Force -ErrorAction SilentlyContinue
}
