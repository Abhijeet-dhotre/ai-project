@echo off
echo Creating MongoDB data directory...
if not exist "C:\data\db" mkdir "C:\data\db"

echo Starting MongoDB...
start "MongoDB" cmd /k "mongod --dbpath C:\data\db"

timeout /t 3 /nobreak > nul

echo Starting Backend Server...
start "Backend" cmd /k "npm run server"

timeout /t 2 /nobreak > nul

echo Starting Frontend...
start "Frontend" cmd /k "npm run dev"

echo All servers starting...
echo - MongoDB: localhost:27017
echo - Backend API: localhost:5000
echo - Frontend: localhost:5173
echo.
echo Close each window individually to stop servers.
pause