$filePath = 'e:\Projects\ProjectBarta\public\app.js'
$bytes = [System.IO.File]::ReadAllBytes($filePath)
$cleanBytes = $bytes | Where-Object { $_ -ne 0 }
[System.IO.File]::WriteAllBytes($filePath, $cleanBytes)
Write-Host "Done: null bytes removed"
