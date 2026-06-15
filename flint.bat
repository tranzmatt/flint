@echo off
:: ============================
:: Flint — Install Script v4
:: Windows Port
:: With Python AI Agent
:: ============================

setlocal EnableDelayedExpansion
title Flint Installer

set "FLINT_DIR=%USERPROFILE%\.flint"
set "FLINT_APP=%FLINT_DIR%\app"
set "AGENT_DIR=%FLINT_DIR%\agent"
set "ICON_DIR=%FLINT_DIR%\icons"
set "SCRIPT_DIR=%~dp0"

echo.
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo   Flint — Local Knowledge Base
echo   Secure, private, desktop-first + AI Agent
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo.

:: ---- Step 1: Check Node.js ----
echo [1/9] Checking Node.js...

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [WARNING] Node.js not found.
    echo Install it from https://nodejs.org ^(v18+^) and re-run this script.
    pause
    exit /b 1
)

for /f "tokens=1 delims=v" %%a in ('node -v') do set "NODE_VERSION=%%a"
for /f "tokens=1 delims=." %%a in ('node -v ^| findstr /r "[0-9]"') do (
    set "NODE_RAW=%%a"
)
for /f "tokens=* delims=v" %%a in ('node -v') do set "NODE_FULL=%%a"
for /f "tokens=1 delims=." %%a in ("!NODE_FULL!") do set "NODE_MAJOR=%%a"

if !NODE_MAJOR! LSS 18 (
    echo [ERROR] Node.js 18+ required. You have !NODE_FULL!. Please upgrade.
    pause
    exit /b 1
)

for /f %%v in ('node -v') do echo       OK  Node.js %%v
for /f %%v in ('npm -v') do echo       OK  npm %%v

:: ---- Step 2: Check Python ----
echo.
echo [2/9] Checking Python...

set "PYTHON_CMD="
where python3 >nul 2>&1 && set "PYTHON_CMD=python3"
if not defined PYTHON_CMD (
    where python >nul 2>&1 && set "PYTHON_CMD=python"
)

if not defined PYTHON_CMD (
    echo [WARNING] Python not found. AI Agent will not be available.
    echo           Install Python 3 from https://python.org
) else (
    for /f "tokens=*" %%v in ('!PYTHON_CMD! --version 2^>^&1') do echo       OK  %%v
)

:: ---- Step 3: Clean old installation ----
echo.
echo [3/9] Preparing installation directory...

set "VAULT_BACKUP="
if exist "%FLINT_DIR%\vault-backup.json" (
    set "VAULT_BACKUP=%FLINT_DIR%\vault-backup.json"
    copy "%FLINT_DIR%\vault-backup.json" "%TEMP%\flint-vault-backup.json" >nul 2>&1
)

if exist "%FLINT_DIR%\app" (
    echo       Cleaning old installation...
    rmdir /s /q "%FLINT_DIR%\app" 2>nul
)
if exist "%FLINT_DIR%\.build" rmdir /s /q "%FLINT_DIR%\.build" 2>nul
if exist "%FLINT_DIR%\agent" rmdir /s /q "%FLINT_DIR%\agent" 2>nul

mkdir "%FLINT_APP%" 2>nul
mkdir "%FLINT_DIR%" 2>nul

:: Restore vault backup if existed
if exist "%TEMP%\flint-vault-backup.json" (
    copy "%TEMP%\flint-vault-backup.json" "%FLINT_DIR%\vault-backup.json" >nul 2>&1
)

echo       OK  Directory ready

:: ---- Step 4: Build the web app ----
echo.
echo [4/9] Building Flint...

set "BUILD_DIR=%FLINT_DIR%\.build"
mkdir "%BUILD_DIR%" 2>nul

:: Copy source files to build dir (exclude node_modules, dist, .git)
echo       Copying source files...
for /f "delims=" %%f in ('dir /b "%SCRIPT_DIR%"') do (
    set "fname=%%f"
    if /i not "!fname!"=="node_modules" (
        if /i not "!fname!"=="dist" (
            if /i not "!fname!"==".git" (
                if exist "%SCRIPT_DIR%!fname!\" (
                    xcopy "%SCRIPT_DIR%!fname!" "%BUILD_DIR%\!fname!\" /e /i /q >nul 2>&1
                ) else (
                    copy "%SCRIPT_DIR%!fname!" "%BUILD_DIR%\" >nul 2>&1
                )
            )
        )
    )
)

cd /d "%BUILD_DIR%"

echo       Installing npm dependencies...
call npm install --loglevel=error 2>nul
if %errorlevel% neq 0 call npm install
if %errorlevel% neq 0 (
    echo [ERROR] npm install failed.
    pause
    exit /b 1
)

echo       Compiling...
call npm run build
if %errorlevel% neq 0 (
    echo [ERROR] npm run build failed.
    pause
    exit /b 1
)

if not exist "%BUILD_DIR%\dist\index.html" (
    echo [ERROR] Build failed — dist\index.html not created.
    pause
    exit /b 1
)

echo       OK  Build complete

:: ---- Step 5: Set up Python AI Agent ----
echo.
echo [5/9] Setting up AI Agent...

mkdir "%AGENT_DIR%" 2>nul

if exist "%BUILD_DIR%\agent\" (
    xcopy "%BUILD_DIR%\agent\*" "%AGENT_DIR%\" /e /i /q >nul 2>&1
    echo       OK  Agent files copied
) else (
    echo       [WARNING] No agent\ directory found in source
)

if defined PYTHON_CMD (
    if exist "%AGENT_DIR%\requirements.txt" (
        echo       Installing Python packages ^(flask, flask-cors, requests^)...
        !PYTHON_CMD! -m pip install -q flask flask-cors requests 2>nul
        if %errorlevel% neq 0 (
            !PYTHON_CMD! -m pip install --user -q flask flask-cors requests 2>nul
            if %errorlevel% neq 0 (
                echo       [WARNING] pip install failed. Run: pip install flask flask-cors requests
            )
        )
        !PYTHON_CMD! -c "import flask, flask_cors, requests" >nul 2>&1
        if %errorlevel% equ 0 (
            echo       OK  Python packages installed
        ) else (
            echo       [WARNING] Some packages missing. AI will use browser fallback.
        )
    )
)

if defined PYTHON_CMD (
    if exist "%AGENT_DIR%\agent.py" (
        !PYTHON_CMD! -c "import ast; ast.parse(open(r'%AGENT_DIR%\agent.py').read())" >nul 2>&1
        if %errorlevel% equ 0 (
            echo       OK  Agent script valid
        ) else (
            echo       [WARNING] Agent script has errors
        )
    )
)

:: ---- Step 6: Create application icon ----
echo.
echo [6/9] Creating application icon...

mkdir "%ICON_DIR%" 2>nul

if exist "%BUILD_DIR%\public\flint-logo.png" (
    copy "%BUILD_DIR%\public\flint-logo.png" "%FLINT_DIR%\icon.png" >nul 2>&1
    copy "%BUILD_DIR%\public\flint-logo.png" "%FLINT_APP%\icon.png" >nul 2>&1
    copy "%BUILD_DIR%\public\flint-logo.png" "%ICON_DIR%\flint.png" >nul 2>&1
    copy "%ICON_DIR%\flint.png" "%ICON_DIR%\flint-256.png" >nul 2>&1
    copy "%ICON_DIR%\flint.png" "%ICON_DIR%\flint-128.png" >nul 2>&1
    copy "%ICON_DIR%\flint.png" "%ICON_DIR%\flint-64.png" >nul 2>&1
    copy "%ICON_DIR%\flint.png" "%ICON_DIR%\flint-48.png" >nul 2>&1
    echo       OK  Icon created from PNG
) else (
    echo       [WARNING] No flint-logo.png found
)

:: ---- Step 7: Set up Electron app ----
echo.
echo [7/9] Setting up desktop mode...

:: Create package.json for Electron app
(
echo {
echo   "name": "flint-desktop",
echo   "version": "1.0.0",
echo   "private": true,
echo   "main": "main.cjs"
echo }
) > "%FLINT_APP%\package.json"

:: Copy Electron main process
if exist "%BUILD_DIR%\electron\main.cjs" (
    copy "%BUILD_DIR%\electron\main.cjs" "%FLINT_APP%\main.cjs" >nul 2>&1
) else (
    echo       [WARNING] electron\main.cjs not found
)

:: Copy built web app
if exist "%BUILD_DIR%\dist\" (
    xcopy "%BUILD_DIR%\dist\" "%FLINT_APP%\dist\" /e /i /q >nul 2>&1
)

:: Copy agent into app dir
mkdir "%FLINT_APP%\agent" 2>nul
if exist "%AGENT_DIR%\" (
    xcopy "%AGENT_DIR%\" "%FLINT_APP%\agent\" /e /i /q >nul 2>&1
)

:: Install Electron
cd /d "%FLINT_APP%"
echo       Installing Electron (this may take a minute)...
call npm install electron --save-dev --loglevel=error 2>nul
if %errorlevel% neq 0 (
    echo       Retrying Electron install...
    call npm install electron --save-dev
)

set "ELECTRON_OK=false"
if exist "%FLINT_APP%\node_modules\electron\" (
    set "ELECTRON_OK=true"
    for /f %%v in ('node -e "console.log(require('./node_modules/electron/package.json').version)" 2^>nul') do (
        echo       OK  Electron v%%v
    )
) else (
    echo       [WARNING] Electron not available. Will use browser mode.
)

:: Clean up build directory
rmdir /s /q "%BUILD_DIR%" 2>nul

:: ---- Step 8: Create launcher scripts ----
echo.
echo [8/9] Creating launcher...

:: Main launcher script
(
echo @echo off
echo :: Flint Desktop Launcher v4 — with AI Agent
echo setlocal EnableDelayedExpansion
echo.
echo set "FLINT_DIR=%FLINT_DIR%"
echo set "FLINT_APP=%FLINT_APP%"
echo set "AGENT_PID_FILE=%TEMP%\flint-agent.pid"
echo.
echo :: Start Python AI Agent in background
echo set "PYTHON_CMD="
echo where python3 ^>nul 2^>^&1 ^&^& set "PYTHON_CMD=python3"
echo if not defined PYTHON_CMD ^(
echo     where python ^>nul 2^>^&1 ^&^& set "PYTHON_CMD=python"
echo ^)
echo.
echo if defined PYTHON_CMD ^(
echo     if exist "%FLINT_DIR%\agent\agent.py" ^(
echo         start /b "" !PYTHON_CMD! "%FLINT_DIR%\agent\agent.py"
echo         echo Agent started
echo         timeout /t 1 /nobreak ^>nul
echo     ^)
echo ^)
echo.
echo :: Launch Electron or fallback to browser
echo if exist "%FLINT_APP%\node_modules\electron\" ^(
echo     "%FLINT_APP%\node_modules\.bin\electron.cmd" "%FLINT_APP%" %%*
echo ^) else ^(
echo     echo Flint: Electron not found, opening in browser...
echo     start "" "http://localhost:4777"
echo     !PYTHON_CMD! -m http.server 4777 --directory "%FLINT_APP%\dist"
echo ^)
) > "%FLINT_DIR%\flint.bat"

:: Agent-only launcher
(
echo @echo off
echo :: Flint AI Agent standalone launcher
echo set "PYTHON_CMD="
echo where python3 ^>nul 2^>^&1 ^&^& set "PYTHON_CMD=python3"
echo if not defined PYTHON_CMD ^(
echo     where python ^>nul 2^>^&1 ^&^& set "PYTHON_CMD=python"
echo ^)
echo if not defined PYTHON_CMD ^(
echo     echo Error: Python 3 not found
echo     pause
echo     exit /b 1
echo ^)
echo echo Starting Flint AI Agent on http://localhost:5100
echo echo Press Ctrl+C to stop
echo !PYTHON_CMD! "%FLINT_DIR%\agent\agent.py"
) > "%FLINT_DIR%\flint-agent.bat"

:: Add Flint to user PATH if not already there
echo %PATH% | findstr /i "%FLINT_DIR%" >nul 2>&1
if %errorlevel% neq 0 (
    setx PATH "%PATH%;%FLINT_DIR%" >nul 2>&1
    echo       OK  Added to PATH (restart terminal to use 'flint' command^)
) else (
    echo       OK  Already in PATH
)

echo       OK  Launchers created

:: ---- Step 9: Create Start Menu shortcut ----
echo.
echo [9/9] Creating Start Menu entry...

set "START_MENU=%APPDATA%\Microsoft\Windows\Start Menu\Programs"
set "SHORTCUT_FILE=%START_MENU%\Flint.lnk"

:: Use PowerShell to create a proper .lnk shortcut
powershell -NoProfile -Command "$ws = New-Object -ComObject WScript.Shell; $sc = $ws.CreateShortcut('%SHORTCUT_FILE%'); $sc.TargetPath = '%FLINT_DIR%\flint.bat'; $sc.IconLocation = '%FLINT_DIR%\icon.png'; $sc.WorkingDirectory = '%FLINT_DIR%'; $sc.Description = 'Flint Local Knowledge Base with AI'; $sc.Save()" >nul 2>&1

:: Also create Desktop shortcut
set "DESKTOP=%USERPROFILE%\Desktop"
powershell -NoProfile -Command "$ws = New-Object -ComObject WScript.Shell; $sc = $ws.CreateShortcut('%DESKTOP%\Flint.lnk'); $sc.TargetPath = '%FLINT_DIR%\flint.bat'; $sc.IconLocation = '%FLINT_DIR%\icon.png'; $sc.WorkingDirectory = '%FLINT_DIR%'; $sc.Description = 'Flint Local Knowledge Base with AI'; $sc.Save()" >nul 2>&1

echo       OK  Start Menu and Desktop shortcuts created

:: ---- Done ----
echo.
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo   OK  Flint installed successfully!
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo.
echo   Open from Desktop:    Double-click Flint shortcut
echo   Open from Start Menu: Search 'Flint'
echo   Run from terminal:    flint
echo   AI Agent only:        flint-agent
echo   Installed at:         %FLINT_APP%
echo.

if "%ELECTRON_OK%"=="true" (
    echo   Mode:    Desktop app ^(Electron^)
) else (
    echo   Mode:    Browser mode ^(install Electron for desktop^)
)

if defined PYTHON_CMD (
    echo   AI:      Python Agent + Ollama
) else (
    echo   AI:      Browser fallback ^(install Python for agent^)
)

echo.
echo   For full AI: Install Ollama from https://ollama.ai
echo   Then run:    ollama pull llama3.2
echo.
pause
endlocal
