@echo off
chcp 65001 > nul
title Rifqa WhatsApp Engine
cd /d "%~dp0"
echo ====================================================
echo   🕋 RIFQA SMART WHATSAPP & CRM REALTIME ENGINE
echo ====================================================

:: Free port 3005 if busy
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3005 ^| findstr LISTENING') do (
    echo Freeing occupied port 3005 (PID %%a)...
    taskkill /f /pid %%a >nul 2>&1
)

:: Open CRM Dashboard in default browser
start "" "index.html"

:: Run Node.js Server
node server.js
pause
