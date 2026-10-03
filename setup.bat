@echo off
setlocal enabledelayedexpansion

echo ========================================================
echo        MirAi Fitness Platform - Automated Setup
echo ========================================================
echo.

cd /d "%~dp0"

:: 1. Check Python
echo [1/5] Checking Python installation...
set "PY_CMD="
where py >nul 2>nul
if %ERRORLEVEL% equ 0 (
    set "PY_CMD=py -3.11"
    %PY_CMD% --version >nul 2>nul
    if %ERRORLEVEL% neq 0 (
        set "PY_CMD=py"
    )
) else (
    where python >nul 2>nul
    if %ERRORLEVEL% equ 0 (
        set "PY_CMD=python"
    )
)

if "%PY_CMD%"=="" (
    echo [ERROR] Python was not found in PATH!
    echo Please install Python 3.11+ from https://www.python.org/downloads/
    echo Make sure to check "Add Python to PATH" during installation.
    pause
    exit /b 1
)
echo Found Python: %PY_CMD%
echo.

:: 2. Check Node.js & NPM
echo [2/5] Checking Node.js installation...
where npm >nul 2>nul
if %ERRORLEVEL% equ 0 (
    echo Found Node.js / NPM.
) else (
    echo [ERROR] Node.js / npm was not found in PATH!
    echo Please install Node.js 20+ from https://nodejs.org/
    pause
    exit /b 1
)
echo.

:: 3. Setup Frontend Dependencies
echo [3/5] Installing Frontend Dependencies (npm install)...
if not exist "node_modules" (
    call npm install
    if %ERRORLEVEL% neq 0 (
        echo [WARNING] npm install reported issues. Retrying with --legacy-peer-deps...
        call npm install --legacy-peer-deps
    )
) else (
    echo node_modules already exists. Skipping npm install. (Run 'npm install' manually if you updated dependencies).
)
echo.

:: 4. Setup Python Virtual Environment and Backend Dependencies
echo [4/5] Setting up Backend Python Virtual Environment...
cd backend
if not exist ".venv" (
    echo Creating virtual environment at backend\.venv...
    %PY_CMD% -m venv .venv
    if %ERRORLEVEL% neq 0 (
        echo [ERROR] Failed to create virtual environment!
        cd ..
        pause
        exit /b 1
    )
)

set "VENV_PY=.venv\Scripts\python.exe"
if not exist "%VENV_PY%" (
    set "VENV_PY=.venv\bin\python"
)

echo Upgrading pip...
"%VENV_PY%" -m pip install --upgrade pip

echo Installing backend requirements...
"%VENV_PY%" -m pip install -r requirements.txt
if exist "requirements-games.txt" (
    echo Installing game requirements...
    "%VENV_PY%" -m pip install -r requirements-games.txt
)

:: Environment config
if not exist ".env" (
    echo Copying .env.example to .env...
    copy .env.example .env >nul
)

:: Download models
echo Checking AI models...
if not exist "models\pose_landmarker.task" (
    echo Downloading Pose Landmarker model...
    "%VENV_PY%" download_models.py
)
if not exist "models\face_landmarker.task" (
    echo Downloading Face Landmarker model...
    "%VENV_PY%" download_models.py --expression
)

cd ..
echo.

:: 5. Done
echo [5/5] Setup Complete!
echo ========================================================
echo   MirAi is fully configured and ready to run!
echo   You can launch the app at any time using start.bat
echo ========================================================
echo.

set /p START_NOW="Do you want to launch the application now? (Y/N): "
if /i "%START_NOW%"=="Y" (
    call start.bat
) else (
    echo You can start the app later by running start.bat
    pause
)
