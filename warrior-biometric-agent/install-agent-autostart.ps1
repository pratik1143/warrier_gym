$ErrorActionPreference = 'Stop'
$agentRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$pythonVenv = Join-Path $agentRoot '.venv\Scripts\python.exe'
$envPath = Join-Path $agentRoot '.env'
$credentialPath = Join-Path $agentRoot 'serviceAccountKey.json'

if (-not (Test-Path $envPath)) {
  throw "Missing $envPath. Copy .env.example to .env and configure the gym terminal and Firebase credentials first."
}

if (-not (Test-Path $pythonVenv)) {
  $managedPython = $env:CODEX_PYTHON
  if ($managedPython -and (Test-Path $managedPython)) {
    & $managedPython -m venv (Join-Path $agentRoot '.venv')
    if ($LASTEXITCODE -ne 0) { throw 'Could not create the agent Python environment.' }
  }
}

if (-not (Test-Path $pythonVenv)) {
  $pyLauncher = Get-Command py.exe -ErrorAction SilentlyContinue
  $pythonCommand = Get-Command python.exe -ErrorAction SilentlyContinue
  if ($pyLauncher) {
    & $pyLauncher.Source -3 -m venv (Join-Path $agentRoot '.venv')
  } elseif ($pythonCommand) {
    & $pythonCommand.Source -m venv (Join-Path $agentRoot '.venv')
  } else {
    throw 'Python 3.10 or newer is required on the gym PC. Install Python, then run this installer again.'
  }
  if ($LASTEXITCODE -ne 0) { throw 'Could not create the agent Python environment.' }
}

$envConfig = @{}
Get-Content $envPath | ForEach-Object {
  if ($_ -match '^\s*([^#=]+)=(.*)$') {
    $envConfig[$Matches[1].Trim()] = $Matches[2].Trim().Trim('"').Trim("'")
  }
}
$credentialSetting = $envConfig['FIREBASE_CREDENTIALS_PATH']
if ($credentialSetting) {
  $credentialPath = [System.IO.Path]::GetFullPath((Join-Path $agentRoot $credentialSetting))
}
if (-not (Test-Path $credentialPath)) {
  throw "Firebase service-account file not found at $credentialPath. The agent needs it to receive commands from the CRM."
}

& $pythonVenv -m pip install --disable-pip-version-check --no-cache-dir -r (Join-Path $agentRoot 'requirements.txt')
if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed. Check internet access on the gym PC and retry.' }

$taskName = 'Warrior Gym Biometric Agent'
$scriptPath = Join-Path $agentRoot 'run-agent.ps1'
$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$scriptPath`""
$trigger = New-ScheduledTaskTrigger -AtLogOn -User "$env:USERDOMAIN\$env:USERNAME"
$settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([TimeSpan]::Zero) -StartWhenAvailable -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Description 'Runs and supervises the local Warrior Gym Hikvision biometric agent.' -Force | Out-Null
Start-ScheduledTask -TaskName $taskName
Write-Host 'The biometric agent is installed for automatic start at this Windows user logon and has been started now.' -ForegroundColor Green
Write-Host 'Verify the green Online status in the CRM before starting face/fingerprint capture or a gate test.'
