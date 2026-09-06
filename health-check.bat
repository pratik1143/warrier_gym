@echo off
title THE WARRIOR GYM - Health Check Diagnostics
color 0B
cd /d "%~dp0"

echo Running The Warrior Gym System Diagnostics...
where py >nul 2>&1
if %errorlevel%==0 (
    py device-service\health_check.py
) else (
    python device-service\health_check.py
)
echo.
pause
