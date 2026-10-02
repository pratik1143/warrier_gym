@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0install-agent-autostart.ps1"
if errorlevel 1 (
  echo.
  echo Agent setup did not finish. Read the error above, fix the listed requirement, and run this installer again.
  pause
  exit /b 1
)
echo.
pause
