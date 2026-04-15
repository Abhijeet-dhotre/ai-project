@echo off
echo Starting Backend Server...
start "Backend" cmd /k "npm run server"

timeout /t 2 /nobreak > nul

echo Starting Frontend...
start "Frontend" cmd /k "npm run dev"

echo Servers starting...
echo - Backend API: localhost:5000
echo - Frontend: localhost:5173
echo.
echo Make sure MongoDB is running locally before starting!
echo Close each window to stop servers.
pause