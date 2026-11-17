# Run this from a normal PowerShell terminal, where GitHub credentials are available.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $root
function Invoke-Checked {
    param([string]$Program, [string[]]$Arguments)
    & $Program @Arguments
    if ($LASTEXITCODE -ne 0) { throw "$Program failed with exit code $LASTEXITCODE" }
}
$manifest = Get-Content -LiteralPath 'chrome addon/manifest.json' -Raw | ConvertFrom-Json
$version = $manifest.version
$tag = "v$version"
$repo = 'Nicolas-Wehrle/Wiss-Stundenplan'
Invoke-Checked -Program 'python' -Arguments @('scripts/verify-release.py')
Invoke-Checked -Program 'gh' -Arguments @('api', 'user', '--jq', '.login')
$dirty = @(git status --porcelain)
if ($LASTEXITCODE -ne 0 -or $dirty.Count -gt 0) { throw 'The checkout must be clean and committed before publishing.' }
$revision = git rev-parse HEAD
if ($LASTEXITCODE -ne 0) { throw 'Could not determine the release commit.' }
Invoke-Checked -Program 'git' -Arguments @('push', 'origin', 'main')
$assetNames = @('WISS-Stundenplan-Chrome.zip', 'WISS-Stundenplan-Firefox.zip', 'WISS-Stundenplan-Firefox.xpi', 'WISS-Stundenplan.apk', 'WISS-Stundenplan.user.js', 'Chrome-Web-Store-Assets.zip', 'SHA256SUMS.txt')
$assets = @($assetNames | ForEach-Object { Join-Path $root "release/$tag/$_" })
$notes = Join-Path $root "release-notes/$version.txt"
# Windows PowerShell 5 treats redirected native stderr as an ErrorRecord.
$savedErrorPreference = $ErrorActionPreference
$ErrorActionPreference = 'Continue'
$existing = gh release view $tag --repo $repo --json isDraft --jq '.isDraft' 2>$null
$releaseExists = $LASTEXITCODE -eq 0
$ErrorActionPreference = $savedErrorPreference
if ($releaseExists) {
    if ($existing -eq 'false') {
        Write-Host "Release is already published: https://github.com/$repo/releases/tag/$tag"
        exit 0
    }
    Invoke-Checked -Program 'gh' -Arguments (@('release', 'upload', $tag, '--repo', $repo, '--clobber') + $assets)
} else {
    Invoke-Checked -Program 'gh' -Arguments (@('release', 'create', $tag, '--repo', $repo, '--target', $revision, '--title', $version, '--notes-file', $notes, '--draft') + $assets)
}
# Publishing happens only after every asset has uploaded successfully.
Invoke-Checked -Program 'gh' -Arguments @('release', 'edit', $tag, '--repo', $repo, '--draft=false', '--latest', '--notes-file', $notes)
Invoke-Checked -Program 'gh' -Arguments @('release', 'view', $tag, '--repo', $repo, '--json', 'url,assets,isDraft')
