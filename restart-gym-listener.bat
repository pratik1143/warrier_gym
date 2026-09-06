@echo off
title THE WARRIOR GYM - Restart Biometric Listener
color 0E
cd /d "%~dp0"

echo Restarting The Warrior Gym Biometric Listener...
call "%~dp0stop-gym-listener.bat"
timeout /t 2 >nul
call "%~dp0start-gym-listener.bat"
