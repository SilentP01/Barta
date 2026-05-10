@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$path=Join-Path $env:LOCALAPPDATA 'Barta\email.env'; if (Test-Path $path) { Remove-Item $path; Write-Host 'Barta configuration reset.' } else { Write-Host 'No saved Barta configuration found.' }"
