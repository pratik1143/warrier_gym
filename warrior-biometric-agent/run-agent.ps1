$ErrorActionPreference = 'Continue'
$agentRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$python = Join-Path $agentRoot '.venv\Scripts\python.exe'
$runtimePython = Join-Path $agentRoot '.runtime-python.txt'
$logPath = Join-Path $agentRoot 'logs\agent-supervisor.log'

Set-Location $agentRoot
New-Item -ItemType Directory -Force -Path (Split-Path -Parent $logPath) | Out-Null

if (-not (Test-Path $python) -and (Test-Path $runtimePython)) {
  $python = (Get-Content $runtimePython -Raw).Trim()
}

if (-not (Test-Path $python)) {
  Add-Content -Path $logPath -Value "$(Get-Date -Format o) Agent environment missing. Run install-agent-autostart.bat."
  exit 1
}

while ($true) {
  Add-Content -Path $logPath -Value "$(Get-Date -Format o) Starting biometric agent."
  & $python -u (Join-Path $agentRoot 'services\device_service.py') 2>&1 | Add-Content -Path $logPath
  $exitCode = $LASTEXITCODE
  Add-Content -Path $logPath -Value "$(Get-Date -Format o) Agent exited with code $exitCode; retrying in 10 seconds."
  Start-Sleep -Seconds 10
}
