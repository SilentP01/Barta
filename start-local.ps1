$configPath = Join-Path $env:LOCALAPPDATA "Barta\email.env"
$configDir = Split-Path $configPath

if (!(Test-Path $configDir)) {
  New-Item -ItemType Directory -Path $configDir | Out-Null
}

if (Test-Path $configPath) {
  foreach ($line in Get-Content $configPath) {
    if ($line -match "^(DATABASE_URL|EMAIL_PROVIDER|EMAIL_API_KEY|EMAIL_FROM|EMAIL_FROM_NAME)=(.*)$") {
      [Environment]::SetEnvironmentVariable($matches[1], $matches[2], "Process")
    }
  }
}

if (!$env:DATABASE_URL) {
  $env:DATABASE_URL = Read-Host "PostgreSQL DATABASE_URL"
}

if (!$env:EMAIL_PROVIDER) {
  $env:EMAIL_PROVIDER = Read-Host "Email provider API (brevo or sendgrid)"
}

if (!$env:EMAIL_API_KEY) {
  $secureKey = Read-Host "Email API key" -AsSecureString
  $plainKey = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
    [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureKey)
  )
  $env:EMAIL_API_KEY = $plainKey -replace "\s+", ""
}

if (!$env:EMAIL_FROM) {
  $env:EMAIL_FROM = Read-Host "Verified sender email"
}

if (!$env:EMAIL_FROM_NAME) {
  $env:EMAIL_FROM_NAME = "no-reply.Barta"
}

if ($env:DATABASE_URL -and $env:EMAIL_PROVIDER -and $env:EMAIL_API_KEY -and $env:EMAIL_FROM -and !(Test-Path $configPath)) {
  $save = Read-Host "Save local Barta settings on this PC for next time? (y/n)"
  if ($save.Trim().ToLower() -eq "y") {
    @(
      "DATABASE_URL=$env:DATABASE_URL"
      "EMAIL_PROVIDER=$env:EMAIL_PROVIDER"
      "EMAIL_API_KEY=$env:EMAIL_API_KEY"
      "EMAIL_FROM=$env:EMAIL_FROM"
      "EMAIL_FROM_NAME=$env:EMAIL_FROM_NAME"
    ) | Set-Content -Path $configPath
  }
}

Write-Host "Starting Barta..."
Write-Host "Open http://127.0.0.1:3000"
node "$PSScriptRoot\server.js"
