<#
  set-github-secrets.ps1
  - Encodes YOUR_KEYSTORE.jks as base64 and sets it as the KEYSTORE_BASE64 secret
  - Prompts for KEYSTORE_PASSWORD, KEY_ALIAS, KEY_PASSWORD and sets them as repository secrets
  - Requires GitHub CLI (gh) and that you are authenticated (gh auth login)
  Usage (PowerShell):
    ./scripts/set-github-secrets.ps1 -RepoOwner owner -RepoName repo
#>
param(
  [Parameter(Mandatory=$false)] [string] $RepoOwner,
  [Parameter(Mandatory=$false)] [string] $RepoName
)

function Fail($msg) {
  Write-Error $msg
  exit 1
}

$keystorePath = Join-Path $PSScriptRoot '..\YOUR_KEYSTORE.jks' | Resolve-Path -ErrorAction SilentlyContinue
if (-not $keystorePath) {
  Fail "Keystore not found at YOUR_KEYSTORE.jks. Place your keystore file in the repository root with the filename YOUR_KEYSTORE.jks"
}

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
  Fail "GitHub CLI 'gh' is required. Install from https://cli.github.com/ and run 'gh auth login' before continuing."
}

# Read keystore bytes and base64 encode
Write-Host "Reading keystore and encoding to base64..."
$bytes = [System.IO.File]::ReadAllBytes($keystorePath)
$base64 = [Convert]::ToBase64String($bytes)

# Prompt for other secrets
$keystorePassword = Read-Host -AsSecureString "Enter KEYSTORE_PASSWORD (will be stored as a secret)"
$keyAlias = Read-Host "Enter KEY_ALIAS"
$keyPassword = Read-Host -AsSecureString "Enter KEY_PASSWORD (will be stored as a secret)"

# Convert securestrings to plain for gh secret set input (only in memory)
$kpPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($keystorePassword))
$keyPasswordPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($keyPassword))

# Determine repo parameter for gh
$repoArg = ""
if ($RepoOwner -and $RepoName) {
  $repoArg = "--repo $RepoOwner/$RepoName"
} elseif ($env:GITHUB_REPOSITORY) {
  $repoArg = "--repo $env:GITHUB_REPOSITORY"
}

# Helper to set secret
function Set-Secret($name, $value) {
  Write-Host "Setting secret $name..."
  $p = Start-Process -FilePath gh -ArgumentList @('secret','set',$name,$repoArg,'--body',$value) -NoNewWindow -Wait -PassThru -ErrorAction Stop
  if ($p.ExitCode -ne 0) {
    Fail "Failed to set secret $name"
  }
}

# Set KEYSTORE_BASE64 (this may be large)
Set-Secret -name 'KEYSTORE_BASE64' -value $base64
# Set other secrets
Set-Secret -name 'KEYSTORE_PASSWORD' -value $kpPlain
Set-Secret -name 'KEY_ALIAS' -value $keyAlias
Set-Secret -name 'KEY_PASSWORD' -value $keyPasswordPlain

# Cleanup plaintext memory variables
$kpPlain = $null
$keyPasswordPlain = $null
[System.GC]::Collect(); [System.GC]::WaitForPendingFinalizers()

Write-Host "All secrets set. Do NOT commit your keystore file to the repository."