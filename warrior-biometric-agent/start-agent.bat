@echo off
title THE WARRIOR GYM - Biometric Access Agent
color 0E
cd /d "%~dp0"

echo ==================================================
echo    THE WARRIOR GYM BIOMETRIC ACCESS AGENT
echo       Hikvision DS-K1T320EFWX ^& ESSL Engine
echo ==================================================
echo.
echo Starting Biometric Agent Engine...
echo Logs are saved to: logs\warrior_biometric_agent.log
echo Press Ctrl+C to stop the agent.
echo.

where py >nul 2>&1
if %errorlevel%==0 (
    py services\device_service.py
) else (
    python services\device_service.py
)

pause
