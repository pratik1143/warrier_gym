@echo off
setlocal
title THE WARRIOR GYM - Biometric Access Agent
color 0E
cd /d "%~dp0"

echo ==================================================
echo    THE WARRIOR GYM BIOMETRIC ACCESS AGENT
echo       Hikvision / ESSL Engine
echo ==================================================
echo.

set "VENV_PY=%~dp0.venv\Scripts\python.exe"
if exist "%VENV_PY%" goto check_dependencies

if defined CODEX_PYTHON (
    if exist "%CODEX_PYTHON%" (
        "%CODEX_PYTHON%" -m venv "%~dp0.venv"
        goto check_venv
    )
)

where py >nul 2>&1
if %errorlevel%==0 (
    py -3 -m venv "%~dp0.venv"
) else (
    where python >nul 2>&1
    if errorlevel 1 (
        echo ERROR: Python 3 is not installed or is not on PATH.
        echo Install Python 3.10 or newer, then run this file again.
        pause
        exit /b 1
    )
    python -m venv "%~dp0.venv"
)
:check_venv
if errorlevel 1 (
    echo ERROR: Could not create the agent Python environment.
    pause
    exit /b 1
)

:check_dependencies
"%VENV_PY%" -c "import firebase_admin, requests, urllib3, PIL" >nul 2>&1
if not errorlevel 1 goto run_agent

echo Installing the biometric agent dependencies...
"%VENV_PY%" -m pip install --disable-pip-version-check --no-cache-dir -r "%~dp0requirements.txt"
if errorlevel 1 (
    echo ERROR: Dependency installation failed. Check the gym PC's internet connection and try again.
    pause
    exit /b 1
)

:run_agent
echo Starting the biometric agent. Logs: logs\warrior_biometric_agent.log
echo Press Ctrl+C to stop the agent.

:restart_loop
"%VENV_PY%" services\device_service.py
set EXIT_CODE=%errorlevel%
if %EXIT_CODE%==0 (
    echo Agent stopped cleanly.
    goto end
)
echo.
echo [AUTO-RESTART] Agent exited with code %EXIT_CODE%. Restarting in 5 seconds...
echo Check logs\warrior_biometric_agent.log for details.
timeout /t 5 /nobreak >nul
goto restart_loop

:end
pause
