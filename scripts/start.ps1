# Start Know-how Engine as background process
$ErrorActionPreference = "Continue"
$workdir = "C:\Users\Administrator\.qclaw\workspace\knowhow-engine"
$logDir = "$workdir\logs"
$null = New-Item -ItemType Directory -Path $logDir -Force

# Start process with separate log files
$pinfo = New-Object System.Diagnostics.ProcessStartInfo
$pinfo.FileName = "D:\openclaw\nodejs\node.exe"
$pinfo.Arguments = "src/index.js"
$pinfo.WorkingDirectory = $workdir
$pinfo.RedirectStandardOutput = $true
$pinfo.RedirectStandardError = $true
$pinfo.UseShellExecute = $false
$pinfo.CreateNoWindow = $true

$p = [System.Diagnostics.Process]::Start($pinfo)

# Write PIDs
$p.Id | Out-File "$workdir\engine.pid" -Encoding ASCII

# Read initial output
Start-Sleep -Milliseconds 500

# Save PIDs
Write-Host "Know-how Engine started. PID: $($p.Id)"
Write-Host "Health check in 3s..."

Start-Sleep 3

try {
    $h = Invoke-RestMethod -Uri "http://localhost:3080/health" -ErrorAction Stop
    Write-Host "Health: $($h.status) | chains: $($h.chains_loaded)"
} catch {
    Write-Host "Health check failed: $_"
    Write-Host "--- stdout tail ---"
    try {
        $so = $p.StandardOutput.ReadToEnd()
        if ($so) { Write-Host $so }
    } catch {}
}
