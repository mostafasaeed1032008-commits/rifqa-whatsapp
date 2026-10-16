@echo off
title Rifqa WhatsApp Engine
cd /d "%~dp0"
echo ===================================================
echo 🕋  Starting Rifqa WhatsApp Engine & CRM Dashboard
echo ===================================================

for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3005') do (
    taskkill /f /pid %%a >nul 2>&1
)

start index.html
node server.js
pause
