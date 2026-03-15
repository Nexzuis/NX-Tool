@echo off
title Ghosthome Monitor

echo ========================================
echo   GHOSTHOME INFRASTRUCTURE MONITOR
echo ========================================
echo.

:: Start the backend monitor + API (port 4301)
echo Starting Monitor API on port 4301...
start "Ghosthome API" cmd /k "cd /d "%~dp0modules\ghosthome-monitor" && node index.js"

:: Wait a moment for the API to initialize
timeout /t 3 /nobreak >nul

:: Start the Next.js frontend on port 4300
echo Starting Frontend on port 4300...
start "Ghosthome Frontend" cmd /k "cd /d "%~dp0modules\ghosthome-frontend" && npm run dev"

echo.
echo Both services starting:
echo   API:      http://localhost:4301
echo   Frontend: http://localhost:4300
echo.
echo Close this window or press any key to exit.
pause >nul
