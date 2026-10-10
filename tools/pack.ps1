<#
.SYNOPSIS
    Build the player-importable ZIP for "Just Better Than Mega Gatling".

.DESCRIPTION
    The repository root doubles as the mod root (pack.json sits at the top),
    so a plain `git clone` can be imported through GP-Next's "import folder".
    The ZIP, however, must carry runtime files only, therefore this script
    copies a whitelist into a staging folder and archives that one.

    Pipeline:
      1. read the version from pack.json
      2. stage the whitelist entries
      3. build the ZIP with forward-slash entries -- the game's unzip library
         cannot read the backslash entries that CreateFromDirectory produces
      4. validate entry separators, JSON syntax and manifest fields
      5. unpack to a temp folder and re-run the test suite against the
         packaged artifact (via JBTMG_PKG_ROOT / JBTMG_ENTRY)

.PARAMETER ModDir
    Mod source directory (the one holding pack.json).
    Defaults to the repository root, i.e. the parent of this script.

.PARAMETER OutDir
    Where the ZIP is written. Defaults to <ModDir>\dist.

.PARAMETER Personal
    Build the local-only variant: everything inside <ModDir>\private is copied
    into the package's audio\ folder on top of the public contents.
    Use this ONLY for builds you keep to yourself -- private\ is gitignored and
    its contents must never end up in a published ZIP.

.PARAMETER SkipVerify
    Skip step 5 (unpack + re-run the test suite).

.EXAMPLE
    powershell -NoProfile -ExecutionPolicy Bypass -File tools\pack.ps1
    powershell -NoProfile -ExecutionPolicy Bypass -File tools\pack.ps1 -Personal
#>
[CmdletBinding()]
param(
    [string]$ModDir,
    [string]$OutDir,
    [switch]$Personal,
    [switch]$SkipVerify
)

$ErrorActionPreference = 'Stop'

if (-not $ModDir) { $ModDir = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path }
$ModDir = (Resolve-Path $ModDir).Path
if (-not $OutDir) { $OutDir = Join-Path $ModDir 'dist' }

# Runtime files shipped to players. Everything else (tests, tools, docs,
# package.json, CHANGELOG, .git*) is development-only.
#
# LICENSE and NOTICE.md are NOT optional: the MIT terms require the copyright
# and permission notice to travel with every copy of the software, and NOTICE.md
# is what tells a player where the bundled audio stands.
$WHITELIST = @('pack.json', 'README.md', 'LICENSE', 'NOTICE.md', 'jsons', 'scripts')

$manifestPath = Join-Path $ModDir 'pack.json'
if (-not (Test-Path $manifestPath)) { throw "pack.json not found in $ModDir" }
$manifest = Get-Content $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
$version = if ($manifest.version) { $manifest.version } else { '0.0.0' }
# Derive an ASCII slug from name. A fully non-ASCII name collapses to an empty
# string, in which case fall back to the last segment of the uuid.
# NOTE: keep this file ASCII-only -- PowerShell 5.1 reads .ps1 as ANSI unless it
# carries a UTF-8 BOM, so non-ASCII comments break the parser.
$slug = $manifest.name.ToLower() -replace '[^a-z0-9]+', '-'
$slug = $slug.Trim('-')
if (-not $slug) {
    $slug = (('' + $manifest.uuid) -split '\.') | Select-Object -Last 1
    Write-Host "  note: name is non-ASCII, using uuid segment as slug: $slug" -ForegroundColor Yellow
}
$profile = if ($Personal) { 'personal (local only)' } else { 'public' }
$suffix = if ($Personal) { '-personal' } else { '' }

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
$OutZip = Join-Path $OutDir ("{0}-{1}{2}.zip" -f $slug, $version, $suffix)
$stage = Join-Path $OutDir '.staging'

Write-Host "=== Profile: $profile ===" -ForegroundColor Cyan

$fail = 0

# ---- 1/2. stage -----------------------------------------------------------

if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
New-Item -ItemType Directory -Force -Path $stage | Out-Null

Write-Host "=== Staging whitelist ===" -ForegroundColor Cyan
foreach ($item in $WHITELIST) {
    $src = Join-Path $ModDir $item
    if (-not (Test-Path $src)) {
        Write-Host ("  MISSING $item") -ForegroundColor Yellow
        continue
    }
    $dst = Join-Path $stage $item
    if ((Get-Item $src).PSIsContainer) { Copy-Item $src $dst -Recurse -Force }
    else { Copy-Item $src $dst -Force }
    Write-Host "  staged  $item"
}

# -Personal: overlay the gitignored private\ assets into audio\.
if ($Personal) {
    $priv = Join-Path $ModDir 'private'
    if (Test-Path $priv) {
        $audioStage = Join-Path $stage 'audio'
        New-Item -ItemType Directory -Force -Path $audioStage | Out-Null
        Get-ChildItem -Path $priv -File | ForEach-Object {
            Copy-Item $_.FullName (Join-Path $audioStage $_.Name) -Force
            Write-Host "  overlay $($_.Name)   <- private\" -ForegroundColor Yellow
        }
    } else {
        Write-Host "  note: -Personal was given but private\ does not exist" -ForegroundColor Yellow
    }
}

# ---- 3. build the ZIP -----------------------------------------------------

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

if (Test-Path $OutZip) { Remove-Item $OutZip -Force }
$archive = [System.IO.Compression.ZipFile]::Open($OutZip, [System.IO.Compression.ZipArchiveMode]::Create)
try {
    Get-ChildItem -Path $stage -Recurse -File | ForEach-Object {
        $rel = $_.FullName.Substring($stage.Length + 1).Replace('\', '/')
        $entry = $archive.CreateEntry($rel, [System.IO.Compression.CompressionLevel]::Optimal)
        $stream = $entry.Open()
        $bytes = [System.IO.File]::ReadAllBytes($_.FullName)
        $stream.Write($bytes, 0, $bytes.Length)
        $stream.Dispose()
    }
} finally {
    $archive.Dispose()
}

# ---- 4. validate ----------------------------------------------------------

Write-Host "`n=== ZIP entries ===" -ForegroundColor Cyan
$chk = [System.IO.Compression.ZipFile]::OpenRead($OutZip)
$names = @()
$chk.Entries | ForEach-Object {
    $names += $_.FullName
    Write-Host ("  {0,-42} {1,9} bytes" -f $_.FullName, $_.Length)
}
$chk.Dispose()

Write-Host "`n=== Validation ===" -ForegroundColor Cyan

$badSlash = @($names | Where-Object { $_.Contains('\') })
if ($badSlash.Count) {
    Write-Host "  FAIL backslash entries: $($badSlash -join ', ')" -ForegroundColor Red
    $fail++
} else {
    Write-Host "  OK   all entries use forward slashes"
}

$devLeak = @($names | Where-Object { $_ -match '^(tests|tools|docs|private|effect)/' -or $_ -eq 'package.json' })
if ($devLeak.Count) {
    Write-Host "  FAIL dev-only files leaked into the package: $($devLeak -join ', ')" -ForegroundColor Red
    $fail++
} else {
    Write-Host "  OK   no dev-only files in the package"
}

foreach ($required in @('pack.json', 'README.md', 'LICENSE', 'NOTICE.md', 'scripts/main.js')) {
    if ($names -notcontains $required) {
        Write-Host "  FAIL required file missing from the package: $required" -ForegroundColor Red
        $fail++
    }
}

if ($manifest.PSObject.Properties.Name -contains 'requiredGpNextFeatures') {
    Write-Host "  FAIL pack.json declares requiredGpNextFeatures (GP-Next 1.5.0-pre.1 rejects it)" -ForegroundColor Red
    $fail++
} else {
    Write-Host "  OK   pack.json declares no unknown GP-Next feature requirements"
}
if (-not $manifest.uuid) { Write-Host "  FAIL pack.json has no uuid" -ForegroundColor Red; $fail++ }

# ---- 5. unpack and re-run the suite against the artifact ------------------

if ($SkipVerify) {
    Write-Host "`n=== Verify: skipped (-SkipVerify) ===" -ForegroundColor Yellow
} else {
    Write-Host "`n=== Verify: re-running the suite against the packaged artifact ===" -ForegroundColor Cyan
    $node = Get-Command node -ErrorAction SilentlyContinue
    if (-not $node) {
        Write-Host "  SKIP node not found on PATH" -ForegroundColor Yellow
    } else {
        $tmp = Join-Path $env:TEMP ('jbtmg-verify-' + [guid]::NewGuid().ToString('N').Substring(0, 8))
        if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force }
        [System.IO.Compression.ZipFile]::ExtractToDirectory($OutZip, $tmp)
        # the unpacked copy carries no package.json, so mark the tree as ESM
        # (use WriteAllText -- Set-Content would prepend a BOM and break JSON.parse)
        [System.IO.File]::WriteAllText(
            (Join-Path $tmp 'package.json'),
            '{"type":"module"}',
            (New-Object System.Text.UTF8Encoding($false)))

        $env:JBTMG_PKG_ROOT = $tmp
        $env:JBTMG_ENTRY = Join-Path $tmp 'scripts\main.js'
        try {
            & node (Join-Path $ModDir 'tests\run.mjs')
            if ($LASTEXITCODE -ne 0) {
                Write-Host "  FAIL packaged artifact failed the suite" -ForegroundColor Red
                $fail++
            }
        } finally {
            Remove-Item Env:\JBTMG_PKG_ROOT -ErrorAction SilentlyContinue
            Remove-Item Env:\JBTMG_ENTRY -ErrorAction SilentlyContinue
            Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
        }
    }
}

# ---- cleanup --------------------------------------------------------------

Remove-Item $stage -Recurse -Force -ErrorAction SilentlyContinue

Write-Host "`n=== Result ===" -ForegroundColor Cyan
Write-Host "  profile: $profile"
Write-Host "  output : $OutZip"
Write-Host "  size   : $((Get-Item $OutZip).Length) bytes"
if ($fail -gt 0) {
    Write-Host "  FAILED ($fail checks)" -ForegroundColor Red
    exit 1
}
Write-Host "  OK" -ForegroundColor Green
