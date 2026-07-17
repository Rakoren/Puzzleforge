<#
Split this co-located repo into the two repos the PRD describes:
  - puzzleforge-engine  (private core library)
  - puzzleforge-web     (public MIT app)

Both get a CLEAN initial commit (no maze-books history), as sibling folders of
the current checkout. Creating the GitHub repos and archiving maze-books are
manual steps printed at the end (see docs/REPO-SPLIT.md).

Usage:   powershell -ExecutionPolicy Bypass -File scripts\split-repos.ps1 [OutputParentDir]
#>
param([string]$Out)

$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
if (-not $Out) { $Out = (Split-Path -Parent $RepoRoot) }
$EngineDir = Join-Path $Out "puzzleforge-engine"
$WebDir    = Join-Path $Out "puzzleforge-web"

Set-Location $RepoRoot
git rev-parse HEAD *> $null; if ($LASTEXITCODE -ne 0) { throw "Run this inside the git repo." }
foreach ($d in @($EngineDir, $WebDir)) {
  if (Test-Path $d) { throw "Refusing to overwrite existing: $d" }
  New-Item -ItemType Directory -Path $d | Out-Null
}

# git archive exports only tracked files (no .git, no node_modules). Write to a
# temp .tar file rather than piping — PowerShell corrupts binary pipelines.
function Export-Tree($treeish, $dest) {
  $tmp = Join-Path $env:TEMP ("pf-split-" + [guid]::NewGuid().ToString() + ".tar")
  git archive --format=tar -o $tmp $treeish
  tar -xf $tmp -C $dest
  Remove-Item $tmp
}

Write-Host "-> Exporting engine (everything except puzzleforge-web/) ..."
Export-Tree "HEAD" $EngineDir
Remove-Item -Recurse -Force (Join-Path $EngineDir "puzzleforge-web") -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force (Join-Path $EngineDir "scripts") -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force (Join-Path $EngineDir ".claude") -ErrorAction SilentlyContinue

Write-Host "-> Exporting web (puzzleforge-web/ as its own root) ..."
Export-Tree "HEAD:puzzleforge-web" $WebDir
@"
node_modules/
*.pdf
*.log
.DS_Store
out/
dist/

# Workspace (team) data - local, not committed
data/
"@ | Set-Content -NoNewline (Join-Path $WebDir ".gitignore")

Write-Host "-> Repointing the web app at the sibling engine folder ..."
node -e "const fs=require('fs'),p=process.argv[1]+'/package.json';const j=JSON.parse(fs.readFileSync(p,'utf8'));if(j.dependencies&&j.dependencies['puzzleforge-engine']){j.dependencies['puzzleforge-engine']='file:../puzzleforge-engine';}fs.writeFileSync(p,JSON.stringify(j,null,2)+'\n');" $WebDir

function Commit-Repo($dir, $name) {
  Push-Location $dir
  git init -q
  git add -A
  git -c user.name="Rakoren" -c user.email="noreply@puzzleforge.local" commit -q -m "Initial commit - $name (split from maze-books sandbox)"
  Pop-Location
  Write-Host "  ok $dir"
}

Write-Host "-> Creating clean initial commits ..."
Commit-Repo $EngineDir "puzzleforge-engine"
Commit-Repo $WebDir "puzzleforge-web"

Write-Host ""
Write-Host "Done. Two repos prepared as siblings:"
Write-Host "  $EngineDir   (private)"
Write-Host "  $WebDir      (public, MIT)"
Write-Host ""
Write-Host "Next (manual - needs your GitHub account):"
Write-Host "  1. Create EMPTY repos 'puzzleforge-engine' (private) and 'puzzleforge-web' (public) on GitHub."
Write-Host "  2. Push each:"
Write-Host "       cd `"$EngineDir`"; git remote add origin <engine-url>; git push -u origin main"
Write-Host "       cd `"$WebDir`";    git remote add origin <web-url>;    git push -u origin main"
Write-Host "  3. Smoke-test:  (engine) npm install; npm test    (web) npm install; npm start"
Write-Host "  4. Archive the old maze-books repo on GitHub."
Write-Host ""
Write-Host "See docs/REPO-SPLIT.md for the full walkthrough."
