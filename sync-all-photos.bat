@echo off
title THE WARRIOR GYM - 1-Click Hikvision Photo Sync to Database
color 0A
cd /d "%~dp0"

echo ================================================================
echo       THE WARRIOR GYM - HIKVISION PHOTO SYNC ENGINE
echo   Pulls all face photos from DS-K1T320EFWX directly to Firestore
echo ================================================================
echo.
echo Connecting to Hikvision machine at 192.168.1.45...
echo Syncing member profile images to database...
echo.

cd backend
npx ts-node src/scripts/pull_all_hikvision_photos.ts

echo.
echo ================================================================
echo   Photo sync completed! You can refresh your CRM dashboard.
echo ================================================================
pause
