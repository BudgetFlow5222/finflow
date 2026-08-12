@echo off
REM ============================================================
REM  FinFlow — Windows quick start script
REM  Double-click this file (or run it in PowerShell/CMD)
REM  to install dependencies and launch FinFlow in dev mode.
REM ============================================================
setlocal

echo.
echo ============================================
echo   FinFlow - Windows Quick Start
echo ============================================
echo.

REM Check Node is installed
where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js is not installed or not in PATH.
  echo Please install Node.js LTS from https://nodejs.org then re-run this script.
  pause
  exit /b 1
)

for /f "tokens=*" %%v in ('node --version') do set NODE_VER=%%v
echo [OK] Node.js %NODE_VER% detected.

REM Check npm works
where npm >nul 2>nul
if errorlevel 1 (
  echo [ERROR] npm is not available. If you see a PowerShell execution policy error,
  echo run this once in PowerShell as your user:
  echo     Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
  pause
  exit /b 1
)

echo [OK] npm is available.
echo.

REM Install dependencies if node_modules is missing
if not exist "node_modules" (
  echo [SETUP] Installing dependencies (first run, ~2-5 minutes)...
  echo.
  call npm install
  if errorlevel 1 (
    echo.
    echo [ERROR] npm install failed. See messages above.
    pause
    exit /b 1
  )
  echo.
  echo [OK] Dependencies installed.
  echo.
) else (
  echo [OK] Dependencies already installed ^(node_modules exists^).
)

REM Make sure the database folder exists for dev mode
if not exist "db" mkdir db

echo.
echo ============================================
echo   Launching FinFlow in dev mode...
echo   A desktop window will open shortly.
echo   Press Ctrl+C in this window to stop.
echo ============================================
echo.

call npm run electron:dev

endlocal
pause
