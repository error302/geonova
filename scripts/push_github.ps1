param(
  [Parameter(Mandatory = $false)]
  [string]$Owner = "error302",

  [Parameter(Mandatory = $false)]
  [string]$Repo = "geonova",

  [Parameter(Mandatory = $false)]
  [string]$Branch = "main",

  [Parameter(Mandatory = $false)]
  [string]$CommitMessage = "Fix payments, security hardening, and project point delete",

  [Parameter(Mandatory = $false)]
  [string]$Token = $env:GITHUB_TOKEN
)

$ErrorActionPreference = "Stop"

function Require-Token {
  if ([string]::IsNullOrWhiteSpace($Token)) {
    throw "Missing GitHub token. Set GITHUB_TOKEN env var or pass -Token."
  }
}

function ApiHeaders {
  return @{
    "Authorization" = "Bearer $Token"
    "Accept"        = "application/vnd.github+json"
    "User-Agent"    = "GeoNova-Codex-Pusher"
  }
}

function Invoke-GitHubApi {
  param(
    [Parameter(Mandatory = $true)][string]$Method,
    [Parameter(Mandatory = $true)][string]$Url,
    [Parameter(Mandatory = $false)]$Body
  )

  $headers = ApiHeaders
  if ($null -ne $Body) {
    $json = ($Body | ConvertTo-Json -Depth 20)
    return Invoke-RestMethod -Method $Method -Uri $Url -Headers $headers -ContentType "application/json" -Body $json
  }

  return Invoke-RestMethod -Method $Method -Uri $Url -Headers $headers
}

function Get-GitBlobSha {
  param(
    [Parameter(Mandatory = $true)][byte[]]$Bytes
  )

  $prefix = [System.Text.Encoding]::UTF8.GetBytes("blob $($Bytes.Length)`0")
  $all = New-Object byte[] ($prefix.Length + $Bytes.Length)
  [Array]::Copy($prefix, 0, $all, 0, $prefix.Length)
  [Array]::Copy($Bytes, 0, $all, $prefix.Length, $Bytes.Length)
  $sha1 = [System.Security.Cryptography.SHA1]::Create()
  $hash = $sha1.ComputeHash($all)
  return ($hash | ForEach-Object { $_.ToString("x2") }) -join ""
}

function Get-RepoRoot {
  # This script lives in scripts/, so repo root is parent dir.
  return (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
}

function Should-ConsiderNewFile {
  param([Parameter(Mandatory = $true)][string]$RelativePath)

  if ($RelativePath.StartsWith("src/")) { return $true }
  if ($RelativePath -ieq "middleware.ts") { return $true }
  return $false
}

Require-Token

$apiBase = "https://api.github.com"
$refUrl = "$apiBase/repos/$Owner/$Repo/git/ref/heads/$Branch"

Write-Output "Fetching remote ref $Owner/$Repo@$Branch ..."
$ref = Invoke-GitHubApi -Method "GET" -Url $refUrl
$baseCommitSha = $ref.object.sha

$commit = Invoke-GitHubApi -Method "GET" -Url "$apiBase/repos/$Owner/$Repo/git/commits/$baseCommitSha"
$baseTreeSha = $commit.tree.sha

Write-Output "Fetching remote tree (recursive) ..."
$tree = Invoke-GitHubApi -Method "GET" -Url "$apiBase/repos/$Owner/$Repo/git/trees/$baseTreeSha?recursive=1"

$remoteBlobs = @{}
foreach ($item in $tree.tree) {
  if ($item.type -eq "blob") {
    $remoteBlobs[$item.path] = $item.sha
  }
}

$root = Get-RepoRoot

Write-Output "Computing local diffs vs remote tree ..."
$updates = New-Object System.Collections.Generic.List[object]

# 1) Updates for tracked remote blobs that exist locally and differ.
foreach ($path in $remoteBlobs.Keys) {
  $localPath = Join-Path $root $path
  if (-not (Test-Path -LiteralPath $localPath)) { continue }

  $bytes = [System.IO.File]::ReadAllBytes($localPath)
  $localSha = Get-GitBlobSha -Bytes $bytes
  if ($localSha -ne $remoteBlobs[$path]) {
    $updates.Add([pscustomobject]@{ path = $path; bytes = $bytes })
  }
}

# 2) New files under src/ and middleware.ts.
$localCandidates = Get-ChildItem -LiteralPath (Join-Path $root "src") -Recurse -File -Force |
  ForEach-Object {
    $_.FullName.Substring($root.Length + 1).Replace("\", "/")
  }
$localCandidates += "middleware.ts"

$localCandidates = $localCandidates | Sort-Object -Unique

foreach ($rel in $localCandidates) {
  if ($remoteBlobs.ContainsKey($rel)) { continue }
  if (-not (Should-ConsiderNewFile -RelativePath $rel)) { continue }
  $full = Join-Path $root $rel
  if (-not (Test-Path -LiteralPath $full)) { continue }
  $bytes = [System.IO.File]::ReadAllBytes($full)
  $updates.Add([pscustomobject]@{ path = $rel; bytes = $bytes })
}

if ($updates.Count -eq 0) {
  Write-Output "No differences detected. Nothing to push."
  exit 0
}

Write-Output ("Files to update/add: " + $updates.Count)

Write-Output "Creating blobs ..."
$treeItems = @()
foreach ($u in $updates) {
  $b64 = [Convert]::ToBase64String($u.bytes)
  $blob = Invoke-GitHubApi -Method "POST" -Url "$apiBase/repos/$Owner/$Repo/git/blobs" -Body @{
    content  = $b64
    encoding = "base64"
  }
  $treeItems += @{
    path = $u.path
    mode = "100644"
    type = "blob"
    sha  = $blob.sha
  }
}

Write-Output "Creating tree ..."
$newTree = Invoke-GitHubApi -Method "POST" -Url "$apiBase/repos/$Owner/$Repo/git/trees" -Body @{
  base_tree = $baseTreeSha
  tree      = $treeItems
}

Write-Output "Creating commit ..."
$newCommit = Invoke-GitHubApi -Method "POST" -Url "$apiBase/repos/$Owner/$Repo/git/commits" -Body @{
  message = $CommitMessage
  tree    = $newTree.sha
  parents = @($baseCommitSha)
}

Write-Output "Updating ref ..."
$null = Invoke-GitHubApi -Method "PATCH" -Url $refUrl -Body @{
  sha   = $newCommit.sha
  force = $false
}

Write-Output "Done. Pushed commit $($newCommit.sha) to $Owner/$Repo@$Branch."

