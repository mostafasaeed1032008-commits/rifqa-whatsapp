@echo off
chcp 65001 > nul
title رفع مشروع رِفقة إلى GitHub
cd /d "%~dp0"
python -X utf8 push_to_github.py
pause
