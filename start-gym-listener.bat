@echo off
title THE WARRIOR GYM - Biometric Access Agent (Hikvision)
color 0E
cd /d "%~dp0"

echo ==================================================
echo    THE WARRIOR GYM BIOMETRIC ACCESS AGENT
echo      Hikvision DS-K1T320EFWX
echo ==================================================
echo.
echo Pre-flight check of the Hikvision terminal...
where py >nul 2>&1
if %errorlevel%==0 (set PYCMD=py) else (set PYCMD=python)
%PYCMD% warrior-biometric-agent\ping_hikvision.py
echo.
echo Starting Warrior Biometric Agent (block/unblock, delete, enroll, member sync)...
echo Logs: warrior-biometric-agent\logs\warrior_biometric_agent.log
echo Press Ctrl+C to stop the agent.
echo.
%PYCMD% warrior-biometric-agent\services\device_service.py
pause
