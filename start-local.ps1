$configPath = Join-Path $env:LOCALAPPDATA "Barta\email.env"
$configDir = Split-Path $configPath

# Create config folder if not exists
if (!(Test-Path $configDir)) {
  New-Item -ItemType Directory -Path $configDir | Out-Null
}

# Load saved config if exists
if (Test-Path $configPath) {
  foreach ($line in Get-Content $configPath) {
    if ($line -match "^(DATABASE_URL|EMAIL_PROVIDER|EMAIL_API_KEY|EMAIL_FROM|EMAIL_FROM_NAME)=(.*)$") {
      [Environment]::SetEnvironmentVariable($matches[1], $matches[2], "Process")
    }
  }
}

# Prompt for DB if missing
if (!$env:DATABASE_URL) {
  $env:DATABASE_URL = Read-Host "PostgreSQL DATABASE_URL"
}

# Prompt for email provider
if (!$env:EMAIL_PROVIDER) {
  $env:EMAIL_PROVIDER = Read-Host "Email provider API (brevo or sendgrid)"
}

# Prompt for API key securely
if (!$env:EMAIL_API_KEY) {
  $secureKey = Read-Host "Email API key" -AsSecureString
  $plainKey = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
    [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureKey)
  )
  $env:EMAIL_API_KEY = $plainKey -replace "\s+", ""
}

# Sender email
if (!$env:EMAIL_FROM) {
  $env:EMAIL_FROM = Read-Host "Verified sender email"
}

# Default sender name
if (!$env:EMAIL_FROM_NAME) {
  $env:EMAIL_FROM_NAME = "no-reply.Barta"
}

# Save config locally (optional)
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

# Start app
Write-Host "Starting Barta..."

# FIXED: no hardcoded 127.0.0.1
$port = if ($env:PORT) { $env:PORT } else { 3000 }

Write-Host "Local access: http://localhost:$port"
Write-Host "Production (Railway): use Railway URL"

node "$PSScriptRoot\server.js"