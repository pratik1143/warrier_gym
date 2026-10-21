@echo off
title THE WARRIOR GYM - Health Check Diagnostics
color 0B
cd /d "%~dp0"

echo Running The Warrior Gym Hikvision diagnostics...
echo.
where py >nul 2>&1
if %errorlevel%==0 (
    py warrior-biometric-agent\ping_hikvision.py
) else (
    python warrior-biometric-agent\ping_hikvision.py
)
echo.
echo (Optional) Full agent diagnostics: py warrior-biometric-agent\test_diagnostics.py
echo.
pause
