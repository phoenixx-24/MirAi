@echo off
setlocal
cd /d "%~dp0"

echo ========================================================
echo        Starting MirAi Fitness Platform
echo ========================================================
echo.

where py >nul 2>nul
if %ERRORLEVEL% equ 0 (
    py launch.py
) else (
    where python >nul 2>nul
    if %ERRORLEVEL% equ 0 (
        python launch.py
    ) else (
        echo [ERROR] Python is not installed or not in PATH.
        echo Please run setup.bat first or install Python 3.11+.
        pause
        exit /b 1
    )
)

if %ERRORLEVEL% neq 0 (
    echo.
    echo [NOTICE] If launch failed due to missing dependencies,
    echo run setup.bat to install everything automatically.
    echo.
    pause
)
