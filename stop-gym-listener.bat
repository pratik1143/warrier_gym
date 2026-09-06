@echo off
title THE WARRIOR GYM - Stop Biometric Listener
color 0C
cd /d "%~dp0"

echo Stopping The Warrior Gym Biometric Listener Service...
taskkill /F /FI "WINDOWTITLE eq THE WARRIOR GYM - Biometric Access Agent*" /T >nul 2>&1
taskkill /F /FI "WINDOWTITLE eq THE WARRIOR GYM - Real-Time ESSL Biometric Listener*" /T >nul 2>&1
wmic process where "commandline like '%%device_service.py%%'" call terminate >nul 2>&1
echo Listener service stopped successfully.
timeout /t 3 >nul
