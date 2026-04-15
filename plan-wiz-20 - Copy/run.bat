@echo off
cd /d "%~dp0"
start cmd /k "npm i && npm run dev"