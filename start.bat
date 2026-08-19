@echo off
TITLE WH3 Mod Manager

:: Dynamically change directory to where the batch file is located
cd /d "%~dp0"

echo Initializing WH3 Mod Manager (Tauri v2 Native)...

if not exist "src-tauri\target\release\wh3-mod-manager.exe" (
    echo Building native release binary...
    call npm run build
    cd src-tauri
    cargo build --release
    cd ..
)

if exist "src-tauri\target\release\wh3-mod-manager.exe" (
    start "" "src-tauri\target\release\wh3-mod-manager.exe"
    exit /b 0
)

pause