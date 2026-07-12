$workdir = "C:\Users\Administrator\.qclaw\workspace\knowhow-engine"

# Check if already running on port 3080
$portInUse = netstat -ano -p TCP | Select-String ":3080 " | Select-String "LISTENING"
if ($portInUse) {
    Write-Host "Port 3080 already in use - engine may already be running"
    try {
        $h = Invoke-RestMethod -Uri "http://localhost:3080/health" -ErrorAction Stop
        Write-Host "HEALTH=OK status=$($h.status) chains=$($h.chains_loaded)"
        exit 0
    } catch {
        Write-Host "Port busy but health fails"
    }
}

# Kill only node on port 3080
$oldPid = Get-Content "$workdir\engine.pid" -ErrorAction SilentlyContinue
if ($oldPid) {
    Stop-Process -Id $oldPid -Force -ErrorAction SilentlyContinue
    Start-Sleep 1
}

# Start hidden process with MODE=both
$env:MODE = "both"
$pinfo = New-Object System.Diagnostics.ProcessStartInfo
$pinfo.FileName = "D:\openclaw\nodejs\node.exe"
$pinfo.Arguments = "src/index.js"
$pinfo.WorkingDirectory = $workdir
$pinfo.UseShellExecute = $false
$pinfo.CreateNoWindow = $true
$pinfo.RedirectStandardOutput = $true
$pinfo.RedirectStandardError = $true

$p = [System.Diagnostics.Process]::Start($pinfo)
$p.Id | Out-File "$workdir\engine.pid" -Encoding ASCII
Write-Host "PID=$($p.Id)"

# Wait for startup
Start-Sleep 3

# Test health
try {
    $h = Invoke-RestMethod -Uri "http://localhost:3080/health" -ErrorAction Stop
    Write-Host "HEALTH=OK status=$($h.status) chains=$($h.chains_loaded)"
} catch {
    Write-Host "HEALTH=FAIL"
    # Show stderr
    $se = $p.StandardError.ReadToEnd()
    if ($se) { Write-Host "STDERR: $se" }
    exit 1
}

# Test MCP capabilities
try {
    $m = Invoke-RestMethod -Uri "http://localhost:3080/api/mcp" -ErrorAction Stop
    Write-Host "MCP_CAP=OK server=$($m.server_name) protocol=$($m.protocol)"
} catch {
    Write-Host "MCP_CAP=FAIL"
}

# Test MCP initialize
try {
    $body = '{"jsonrpc":"2.0","id":"1","method":"initialize","params":{"protocolVersion":"2025-03-26"}}'
    $r = Invoke-RestMethod -Uri "http://localhost:3080/api/mcp/message?sessionId=test1" -Method Post -Body $body -ContentType "application/json" -ErrorAction Stop
    Write-Host "MCP_INIT=OK version=$($r.result.protocolVersion)"
} catch {
    Write-Host "MCP_INIT=FAIL"
}

# Test MCP tools/list
try {
    $body2 = '{"jsonrpc":"2.0","id":"2","method":"tools/list"}'
    $r2 = Invoke-RestMethod -Uri "http://localhost:3080/api/mcp/message?sessionId=test1" -Method Post -Body $body2 -ContentType "application/json" -ErrorAction Stop
    Write-Host "MCP_TOOLS=OK tool=$($r2.result.tools[0].name)"
} catch {
    Write-Host "MCP_TOOLS=FAIL"
}

Write-Host "DONE"
